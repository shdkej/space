#!/usr/bin/env python3
"""Collect approved, account-level dashboard aggregates into a single atomic file."""
from analytics_history import attach_history
from calendar_periods import TIME_ZONES, requested_periods, merge_periods

import argparse
from datetime import datetime, time, timedelta, timezone
import json
import os
from pathlib import Path
import re
import tempfile
import sys
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import build_opener, HTTPRedirectHandler, Request
from zoneinfo import ZoneInfo

INSTAGRAM = "minimal_collector"
UTC = timezone.utc


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def request(url, token, payload=None):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    data = None if payload is None else json.dumps(payload).encode()
    with build_opener(NoRedirect()).open(Request(url, data=data, headers=headers), timeout=20) as response:
        return json.load(response)


def count(value):
    if isinstance(value, bool) or not re.fullmatch(r"[0-9]+", str(value)):
        raise ValueError("invalid aggregate")
    result = int(value)
    if result > 2**53 - 1:
        raise ValueError("invalid aggregate")
    return result


def period(end):
    return {"periodStart": (end - timedelta(days=7)).isoformat(),
            "periodEnd": (end - timedelta(days=1)).isoformat()}


def ga4_token():
    token = os.environ.get("GA4_ACCESS_TOKEN")
    if not token:
        import google.auth
        from google.auth.transport.requests import Request as GoogleRequest
        credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/analytics.readonly"])
        credentials.refresh(GoogleRequest())
        token = credentials.token
    return token


def ga4(now, scope, prop, token):
    keys = ["newUsers", "sessions"]
    report = request(f"https://analyticsdata.googleapis.com/v1beta/properties/{prop}:runReport", token, {
        "metrics": [{"name": key} for key in keys],
        "dateRanges": [{"startDate": "7daysAgo", "endDate": "yesterday"}],
        "keepEmptyRows": True,
    })
    if [item["name"] for item in report["metricHeaders"]] != keys:
        raise ValueError("unexpected GA4 columns")
    data = report.get("rows", [])
    values = dict.fromkeys(keys)
    if data:
        if len(data) != 1 or len(data[0]["metricValues"]) != len(keys):
            raise ValueError("unexpected GA4 rows")
        values = {key: count(item["value"]) for key, item in zip(keys, data[0]["metricValues"])}
    tz = report["metadata"]["timeZone"]
    return {"scope": scope, "values": values, "timeZone": tz, "method": "GA4 Data API",
                 **period(now.astimezone(ZoneInfo(tz)).date())}


def instagram(now):
    token = os.environ["INSTAGRAM_ACCESS_TOKEN"]
    account = os.environ.get("INSTAGRAM_ACCOUNT_ID") or "me"
    if account != "me" and not re.fullmatch(r"[0-9]{5,30}", account):
        raise ValueError("unexpected account ID")
    base = "https://graph.instagram.com/v23.0"
    profile = request(f"{base}/{account}?fields=id,username", token)
    if profile.get("username") != INSTAGRAM or not re.fullmatch(r"[0-9]{5,30}", str(profile.get("id", ""))):
        raise ValueError("Instagram account does not match @minimal_collector")
    end = datetime.combine(now.date(), time.min, UTC)
    values = {}
    for key in ["views", "reach"]:
        query = urlencode({"metric": key, "period": "day", "metric_type": "total_value",
                           "since": int((end - timedelta(days=7)).timestamp()), "until": int(end.timestamp())})
        try:
            response = request(f"{base}/{profile['id']}/insights?{query}", token)
        except HTTPError as error:
            if key == "reach" and error.code == 400:
                values[key] = None
                continue
            raise
        metric = next((item for item in response["data"] if item.get("name") == key), {})
        value = metric.get("total_value", {}).get("value")
        if value is None and key == "reach":
            values[key] = None
        else:
            values[key] = count(value)
    return {"scope": INSTAGRAM, "timeZone": "UTC", "method": "Instagram Insights API", **period(end.date()), "values": values}


def reporting_hosts(config):
    return config.get("hosts", [config["host"]] if "host" in config else [])


def posthog_query(config, known_hosts):
    # Host is allowlisted before attaching a bearer token. Numeric project IDs
    # come from an explicit public reporting inventory.
    host = os.environ.get("POSTHOG_HOST", "https://us.posthog.com").rstrip("/")
    if host not in {"https://us.posthog.com", "https://eu.posthog.com", "https://app.posthog.com"}:
        raise ValueError("unexpected PostHog host")
    project, app = config["project"], config["app_id"]
    if not re.fullmatch(r"[0-9]{1,24}", project):
        raise ValueError("invalid PostHog project")
    if app is None:
        app_filter = "properties.app_id IS NULL"
        selected_hosts = reporting_hosts(config)
        for name in [*known_hosts, *selected_hosts]:
            if not re.fullmatch(r"[a-z0-9.-]+", name):
                raise ValueError("invalid reporting hostname")
        if selected_hosts:
            names = ", ".join(f"'{name}'" for name in selected_hosts)
            app_filter += f" AND properties.$host IN ({names})"
        elif known_hosts:
            names = ", ".join(f"'{name}'" for name in known_hosts)
            app_filter += f" AND coalesce(properties.$host, '') NOT IN ({names})"
    elif isinstance(app, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,100}", app):
        app_filter = f"properties.app_id = '{app}'"
    else:
        raise ValueError("invalid PostHog app ID")
    return (f"{host}/api/projects/{project}/query/",
            f"{app_filter} AND coalesce(properties.traffic_kind, '') != 'synthetic'")


def timestamp_filter(start, end):
    return f"timestamp >= toDateTime({int(start.timestamp())}) AND timestamp < toDateTime({int(end.timestamp())})"


def posthog(now, scope, config, token, known_hosts=()):
    end = datetime.combine(now.date(), time.min, UTC)
    start = end - timedelta(days=7)
    url, app_filter = posthog_query(config, known_hosts)
    query = (f"SELECT uniq(properties['$session_id']), countIf(event = '$pageview'), count() "
             f"FROM events WHERE {timestamp_filter(start, end)} AND {app_filter}")
    response = request(url, token, {"query": {"kind": "HogQLQuery", "query": query}})
    sessions, pageviews, events = response["results"][0]
    return {"scope": scope, "timeZone": "UTC", "method": "PostHog HogQL", **period(end.date()),
            "values": {"sessions": count(sessions), "pageviews": count(pageviews), "events": count(events)}}


def calendar_start(day):
    return datetime.fromisoformat(day).replace(tzinfo=ZoneInfo(TIME_ZONES["posthog"]))


def posthog_period_batch(config, token, hosts, windows):
    url, scope = posthog_query(config, hosts)
    # Aggregate unique sessions directly for each requested time range.
    # A session can cross midnight, so summing daily distinct counts is incorrect.
    fields, starts, ends = [], [], []
    for window in windows:
        start = calendar_start(window["periodStart"])
        end = calendar_start(window["periodEnd"]) + timedelta(days=1)
        starts.append(start)
        ends.append(end)
        condition = timestamp_filter(start, end)
        fields.extend([f"uniqIf(properties['$session_id'], {condition})",
                       f"countIf(event = '$pageview' AND {condition})", f"countIf({condition})"])
    query = (f"SELECT {', '.join(fields)} FROM events WHERE {timestamp_filter(min(starts), max(ends))} "
             f"AND {scope}")
    data = request(url, token, {"query": {"kind": "HogQLQuery", "query": query}})
    values, = data["results"]
    if len(values) != len(fields):
        raise ValueError("Unexpected PostHog calendar columns")
    return [dict(zip(("sessions", "pageviews", "events"), map(count, values[i:i+3])))
            for i in range(0, len(values), 3)]


def ga4_period_batch(prop, token, windows):
    keys = ["newUsers", "sessions"]
    name = f"properties/{prop}"
    reports = [{"property": name, "metrics": [{"name": k} for k in keys], "keepEmptyRows": True,
                "dateRanges": [{"startDate": w["periodStart"], "endDate": w["periodEnd"]}]} for w in windows]
    response = request(f"https://analyticsdata.googleapis.com/v1beta/{name}:batchRunReports", token,
                       {"requests": reports})
    values = []
    for report in response["reports"]:
        if report["metadata"]["timeZone"] != TIME_ZONES["ga4"] or [m["name"] for m in report["metricHeaders"]] != keys:
            raise ValueError("Unexpected GA4 calendar definition")
        rows = report.get("rows", [])
        if not rows:
            values.append(dict.fromkeys(keys))
        else:
            row, = rows
            values.append(dict(zip(keys, (count(v["value"]) for v in row["metricValues"]), strict=True)))
    return values


def collect_periods(source, config, token, hosts, cached, now):
    needed = requested_periods(source, cached, now)
    updated = {"day": [], "week": [], "month": []}
    size = 5 if source == "ga4" else 8
    for start in range(0, len(needed), size):
        batch = needed[start:start+size]
        try:
            values = (ga4_period_batch(config, token, batch) if source == "ga4"
                      else posthog_period_batch(config, token, hosts, batch))
            observed = datetime.now(UTC).isoformat()
            for window, metrics in zip(batch, values, strict=True):
                updated[window["kind"]].append({"periodStart": window["periodStart"], "periodEnd": window["periodEnd"],
                                               "observedAt": observed, "timeZone": TIME_ZONES[source], "values": metrics})
        except (HTTPError, OSError, ValueError, KeyError, TypeError) as error:
            print(f"{source} calendar batch: {type(error).__name__}", file=sys.stderr)
    return merge_periods(source, cached, updated, datetime.now(UTC))


def inventory_for(source, inventory):
    if source == "instagram":
        return {INSTAGRAM: None}
    entries = inventory.get(source, {})
    if not isinstance(entries, dict) or not entries:
        raise ValueError("empty inventory")
    for scope, identifier in entries.items():
        if not isinstance(scope, str) or not scope.strip() or len(scope) > 100:
            raise ValueError("invalid public scope label")
        if source == "posthog":
            if not isinstance(identifier, dict) or set(identifier) not in ({"project", "app_id"}, {"project", "app_id", "host"}, {"project", "app_id", "hosts"}):
                raise ValueError("PostHog requires a project and app_id")
            if "hosts" in identifier and (not isinstance(identifier["hosts"], list) or not identifier["hosts"]):
                raise ValueError("Expected reporting hostnames")
            identifier = identifier["project"]
        if not isinstance(identifier, str) or not re.fullmatch(r"[0-9]{1,24}", identifier):
            raise ValueError("invalid source ID")
    return entries


def collect(source, output, inventory, calendar=False):
    now = datetime.now(UTC)
    scopes = inventory_for(source, inventory)
    destination = output / f"analytics-{source}.json"
    previous = json.loads(destination.read_text()) if destination.is_file() else {}
    old = {r["scope"]: r for r in previous.get("rows", [])}
    rows, success = [], 0
    token = ga4_token() if source == "ga4" else (os.environ.get("POSTHOG_PERSONAL_API_KEY") or os.environ.get("POSTHOG_ACCESS_TOKEN"))
    for scope, identifier in scopes.items():
        known_hosts = []
        try:
            if source == "ga4":
                row = ga4(now, scope, identifier, token)
            elif source == "instagram":
                row = instagram(now)
            else:
                if not token:
                    raise ValueError("missing PostHog read token")
                known_hosts = [host for item in scopes.values() if item["project"] == identifier["project"]
                               for host in reporting_hosts(item)]
                row = posthog(now, scope, identifier, token, known_hosts)
            cached = old.get(scope, {}).get("periods", {})
            if calendar and source in TIME_ZONES:
                row["periods"], done = collect_periods(source, identifier, token, known_hosts, cached, now)
                row["periodStatus"] = "ok" if done else "partial"
            elif cached:
                row["periods"] = cached
            row["observedAt"] = now.isoformat()
            row["status"] = "ok"
            success += 1
        except Exception as error:
            # Report only source and class/status; provider bodies can contain identifiers.
            reason = str(error.code) if isinstance(error, HTTPError) else type(error).__name__
            print(f"{source} {scope}: {reason}", file=sys.stderr)
            row = {**old.get(scope, {"scope": scope}), "status": "unavailable"}
        rows.append(row)
    if not success:
        raise ValueError("no successful observations")
    result = {"schemaVersion": 1, "source": source, "observedAt": now.isoformat(), "rows": rows}
    result = attach_history(source, result, previous)
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", dir=output, delete=False) as temp:
        json.dump(result, temp, allow_nan=False)
        temp.write("\n")
    os.replace(temp.name, destination)
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", choices=["ga4", "instagram", "posthog"])
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--inventory", type=Path, default=Path(__file__).with_name("analytics-inventory.json"))
    args = parser.parse_args()
    try:
        print(collect(args.source, args.output_dir, json.loads(args.inventory.read_text()), calendar=True))
    except HTTPError as error:
        parser.exit(1, f"{args.source} API returned HTTP {error.code}. Previous snapshot retained.\n")
    except Exception as error:
        parser.exit(1, f"{args.source} collection failed ({type(error).__name__}). Previous snapshot retained.\n")
