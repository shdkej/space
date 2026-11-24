#!/usr/bin/env python3
"""Collect approved, account-level dashboard aggregates into a single atomic file."""
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


def posthog(now, scope, config, token, known_hosts=()):
    # Host is allowlisted before attaching a bearer token. Numeric project IDs
    # come from an explicit public reporting inventory.
    host = os.environ.get("POSTHOG_HOST", "https://us.posthog.com").rstrip("/")
    if host not in {"https://us.posthog.com", "https://eu.posthog.com", "https://app.posthog.com"}:
        raise ValueError("unexpected PostHog host")
    end = datetime.combine(now.date(), time.min, UTC)
    start = end - timedelta(days=7)
    predicate = f"timestamp >= toDateTime({int(start.timestamp())}) AND timestamp < toDateTime({int(end.timestamp())})"
    project, app = config["project"], config["app_id"]
    if not re.fullmatch(r"[0-9]{1,24}", project):
        raise ValueError("invalid PostHog project")
    if app is None:
        app_filter = "properties.app_id IS NULL"
        selected_host = config.get("host")
        for name in [*known_hosts, *([selected_host] if selected_host else [])]:
            if not re.fullmatch(r"[a-z0-9.-]+", name):
                raise ValueError("invalid reporting hostname")
        if selected_host:
            app_filter += f" AND properties.$host = '{selected_host}'"
        elif known_hosts:
            names = ", ".join(f"'{name}'" for name in known_hosts)
            app_filter += f" AND coalesce(properties.$host, '') NOT IN ({names})"
    elif isinstance(app, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,100}", app):
        app_filter = f"properties.app_id = '{app}'"
    else:
        raise ValueError("invalid PostHog app ID")
    query = (f"SELECT uniq(properties['$session_id']), countIf(event = '$pageview'), count() "
             f"FROM events WHERE {predicate} AND {app_filter} "
             "AND coalesce(properties.traffic_kind, '') != 'synthetic'")

    response = request(f"{host}/api/projects/{project}/query/", token,
                       {"query": {"kind": "HogQLQuery", "query": query}})
    sessions, pageviews, events = response["results"][0]
    return {"scope": scope, "timeZone": "UTC", "method": "PostHog HogQL", **period(end.date()),
            "values": {"sessions": count(sessions), "pageviews": count(pageviews), "events": count(events)}}


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
            if not isinstance(identifier, dict) or set(identifier) not in ({"project", "app_id"}, {"project", "app_id", "host"}):
                raise ValueError("PostHog requires a project and app_id")
            identifier = identifier["project"]
        if not isinstance(identifier, str) or not re.fullmatch(r"[0-9]{1,24}", identifier):
            raise ValueError("invalid source ID")
    return entries


def collect(source, output, inventory):
    now = datetime.now(UTC)
    scopes = inventory_for(source, inventory)
    destination = output / f"analytics-{source}.json"
    previous = json.loads(destination.read_text()) if destination.is_file() else {}
    old = {r["scope"]: r for r in previous.get("rows", [])}
    rows, success = [], 0
    token = ga4_token() if source == "ga4" else (os.environ.get("POSTHOG_PERSONAL_API_KEY") or os.environ.get("POSTHOG_ACCESS_TOKEN"))
    for scope, identifier in scopes.items():
        try:
            if source == "ga4":
                row = ga4(now, scope, identifier, token)
            elif source == "instagram":
                row = instagram(now)
            else:
                if not token:
                    raise ValueError("missing PostHog read token")
                known_hosts = [item["host"] for item in scopes.values()
                               if item.get("host") and item["project"] == identifier["project"]]
                row = posthog(now, scope, identifier, token, known_hosts)
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
        print(collect(args.source, args.output_dir, json.loads(args.inventory.read_text())))
    except HTTPError as error:
        parser.exit(1, f"{args.source} API returned HTTP {error.code}. Previous snapshot retained.\n")
    except Exception as error:
        parser.exit(1, f"{args.source} collection failed ({type(error).__name__}). Previous snapshot retained.\n")
