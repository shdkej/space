#!/usr/bin/env python3
"""Refresh the three public aggregate objects shared by Status and Metrics."""
import argparse
import configparser
from datetime import datetime, timedelta, timezone
import fcntl
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

from analytics_history import attach_history
from support_inquiries import collect_support
from calendar_periods import TIME_ZONES, merge_periods, requested_periods, validate_session_events

BASE = Path(__file__).resolve().parent
BUCKET = "static-status-aws-shdkej-com"
BROWSER = Path("/mnt/c/Users/msi/.local/share/ego/active_version_dir/ego-browser.exe")
SOURCES = ("posthog", "ga4", "instagram")


def log(line):
    print(datetime.now(timezone.utc).isoformat(timespec="seconds"), line, flush=True)


def aws_credentials(path):
    # Some legacy credential files have unrelated free-form lines. Read only
    # named keys inside the default section, never execute or log file contents.
    wanted = {"aws_access_key_id", "aws_secret_access_key", "aws_session_token"}
    try:
        config = configparser.RawConfigParser()
        config.read(path)
        data = {k: config.get("default", k) for k in wanted if config.has_option("default", k)}
    except configparser.Error:
        data, section = {}, None
        with path.open() as lines:
            for line in lines:
                line = line.strip()
                if line.startswith("[") and line.endswith("]"):
                    section = line[1:-1]
                elif section == "default" and "=" in line:
                    k, v = (part.strip() for part in line.split("=", 1))
                    if k in wanted:
                        data[k] = v
    if not data.get("aws_access_key_id") or not data.get("aws_secret_access_key"):
        raise ValueError("Missing AWS credentials")
    return data


def s3_client():
    import boto3
    from botocore.config import Config
    credentials = aws_credentials(Path.home() / ".aws/credentials")
    # Prevent the SDK from re-parsing unrelated legacy credential/config entries.
    os.environ["AWS_SHARED_CREDENTIALS_FILE"] = os.devnull
    os.environ["AWS_CONFIG_FILE"] = os.devnull
    return boto3.client("s3", region_name="ap-northeast-2", **credentials,
                        config=Config(connect_timeout=8, read_timeout=10,
                                      retries={"total_max_attempts": 3, "mode": "standard"}))


def kubectl_command():
    kubectl = shutil.which("kubectl") or str(Path.home() / ".local/bin/kubectl")
    local_config = Path.home() / ".local/share/dashboard-analytics/kubeconfig"
    command = [kubectl, "--request-timeout=20s"]
    if not os.environ.get("KUBECONFIG") and local_config.exists():
        command.extend(["--kubeconfig", str(local_config)])
    return command


def collect(source, previous, legacy_private=False):
    if source == "posthog":
        command = kubectl_command()
        endpoint = "/api/v1/namespaces/monitoring/services/http:posthog-exporter:metrics/proxy/analytics-posthog.json"
        result = subprocess.run([*command, "get", "--raw", endpoint], check=True,
                                capture_output=True, timeout=30)
        return json.loads(result.stdout)
    script = BASE / f"read-{source}-insights.mjs"
    # On Windows builds Ego writes console.log to stderr. Never expose browser
    # output; the only accepted result is the structured public aggregate.
    code = script.read_bytes()
    if source == "ga4":
        inventory = json.loads((BASE / "analytics-inventory.json").read_text())["ga4"]
        now = datetime.now(timezone.utc)
        old = {r["scope"]: r.get("periods", {}) for r in previous.get("rows", [])}
        plan = {scope: requested_periods(source, old.get(scope, {}), now) for scope in inventory}
        code = ("const requestedCalendarPeriods = " + json.dumps(plan) + ";\n").encode() + code
        if legacy_private:
            code = b"const collectPrivateEngagement = true;\n" + code
    if source == "instagram" and legacy_private:
        code = b"const collectPrivateInstagram = true;\n" + code
    result = subprocess.run([str(BROWSER), "nodejs"], input=code, check=True,
                            timeout=800 if source == "ga4" else 150,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return json.loads(result.stdout.decode("utf-8-sig").strip())


FIELDS = {
    "posthog": {"sessions", "pageviews", "events"},
    "ga4": {"newUsers", "sessions"},
    "instagram": {"views", "viewers", "interactions", "profileVisits", "followers"},
}


def merge(source, result, previous, inventory, started):
    expected = {"minimal_collector"} if source == "instagram" else set(inventory[source])
    if result.get("source") != source or result.get("schemaVersion") != 1:
        raise ValueError("Wrong source")
    rows = result["rows"]
    if len(rows) != len(expected) or {r["scope"] for r in rows} != expected:
        raise ValueError("Wrong scopes")
    old = {row["scope"]: row for row in previous.get("rows", [])}
    successful = 0
    calendar_complete = True
    merged = []
    for row in rows:
        scope = row["scope"]
        if row.get("status") == "unavailable":
            if source == "posthog":
                raise ValueError("Incomplete exporter snapshot")
            merged.append({**old.get(scope, {"scope": scope}), "status": "unavailable"})
            continue
        if row.get("status") != "ok" or set(row["values"]) != FIELDS[source]:
            raise ValueError("Unexpected metrics")
        if any(type(v) is not int or not 0 <= v < 2**53 for v in row["values"].values()):
            raise ValueError("Invalid metric")
        at = datetime.fromisoformat(row["observedAt"].replace("Z", "+00:00"))
        earliest = started
        allowed_fields = {"history", "periods", "periodStatus", "scope", "values", "status", "observedAt",
                          "method", "timeZone", "periodStart", "periodEnd", "periodLabel"}
        if source == "posthog":
            earliest = started - timedelta(minutes=45)
            allowed_fields.add("eventsWithSessionId")
            validate_session_events(row)
            prior_observation = old.get(scope, {}).get("observedAt")
            if prior_observation:
                earliest = max(earliest, datetime.fromisoformat(prior_observation.replace("Z", "+00:00")))
            today = started.astimezone(timezone.utc).date()
            if (row["timeZone"] != "UTC" or row["periodStart"] != (today - timedelta(days=7)).isoformat()
                    or row["periodEnd"] != (today - timedelta(days=1)).isoformat()
                    or row["observedAt"] != result["observedAt"]):
                raise ValueError("Unexpected exporter snapshot period")
        if at < earliest or at.timestamp() > datetime.now(timezone.utc).timestamp() + 60:
            raise ValueError("Stale observation")
        if set(row) - allowed_fields:
            raise ValueError("Unexpected public field")
        measurement = {k: v for k, v in row.items() if k not in {"history", "periods", "periodStatus"}}
        if source in TIME_ZONES:
            periods, done = merge_periods(source, old.get(scope, {}).get("periods", {}),
                                          row.get("periods", {}), datetime.now(timezone.utc))
            if source == "posthog" and (not done or any(
                sample.get("eventsWithSessionId") is None or sample["observedAt"] != row["observedAt"]
                for group in periods.values() for sample in group
            )):
                raise ValueError("Incomplete exporter snapshot")
            measurement.update(periods=periods, periodStatus="ok" if done else "partial")
            calendar_complete = calendar_complete and done
        merged.append(measurement)
        successful += 1
    if not successful:
        raise ValueError("No new observations")
    feed = {"schemaVersion": 1, "source": source, "observedAt": result["observedAt"], "rows": merged}
    return attach_history(source, feed, previous), successful == len(rows) and calendar_complete


def split_engagement(result):
    """Remove optional private measurements before validating the public GA4 feed."""
    rows = []
    complete = True
    for row in result["rows"]:
        seconds = row.pop("avgSessionEngagementSeconds", None)
        channels = row.pop("channelSessions", None)
        acquisition = row.pop("instagramAcquisition", {})
        sessions = row.get("values", {}).get("sessions")
        private = {"scope": row["scope"], "observedAt": row.get("observedAt", result["observedAt"]),
                   "status": "unavailable"}
        private["instagramAcquisition"] = {
            key: acquisition[key] for key in ("sessions", "newUsers")
            if isinstance(acquisition, dict) and type(acquisition.get(key)) is int
            and 0 <= acquisition[key] <= row.get("values", {}).get(key, 2**53 - 1)
        }
        if len(private["instagramAcquisition"]) != 2:
            complete = False
        if row.get("status") == "ok":
            private["sessions"] = sessions
            if (isinstance(channels, dict) and len(channels) <= 32
                    and all(isinstance(k, str) and 0 < len(k) <= 48 and type(v) is int
                            and 0 <= v < 2**53 for k, v in channels.items())
                    and sum(channels.values()) == sessions):
                private["channelSessions"] = channels
            else:
                complete = False
            if sessions == 0:
                private["status"] = "no_sessions"
            elif type(seconds) is int and 0 <= seconds < 2**53:
                private.update(status="ok", seconds=seconds)
        if private["status"] == "unavailable":
            complete = False
        rows.append(private)
    return {"schemaVersion": 1, "rows": rows}, complete


def publish_engagement(report, key="report.json"):
    name = "ga4-session-engagement"
    manager = "space-analytics-instagram" if key == "instagram.json" else "space-analytics"
    publish_private(name, key, report, manager)


def publish_private(name, key, report, manager):
    payload = json.dumps(report, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    manifest = {"apiVersion": "v1", "kind": "ConfigMap", "metadata": {"name": name, "namespace": "monitoring"},
                "data": {key: payload}}
    cmd = [*kubectl_command(), "-n", "monitoring"]
    subprocess.run([*cmd, "apply", "--server-side", f"--field-manager={manager}", "-f", "-"],
                   input=json.dumps(manifest).encode(), check=True, capture_output=True, timeout=30)
    stored = subprocess.run([*cmd, "get", "configmap", name, "-o", "json"],
                            check=True, capture_output=True, timeout=30)
    if json.loads(stored.stdout)["data"][key] != payload:
        raise RuntimeError("Private analytics snapshot verification failed")


def private_instagram(collected, started):
    """Allowlist two account snapshots and strip all other browser data."""
    rows = collected.pop("privateAccounts")
    if sorted(r.get("scope") for r in rows) != ["every.policy", "minimal_collector"]:
        raise ValueError("Unexpected Instagram accounts")
    report = {"schemaVersion": 1, "source": "instagram", "rows": []}
    for row in rows:
        scope = row["scope"]
        if row.get("status") == "unavailable":
            report["rows"].append({"scope": scope, "status": "unavailable"})
            continue
        at = datetime.fromisoformat(row["observedAt"].replace("Z", "+00:00"))
        values = row["values"]
        if (row.get("status") != "ok" or at < started or at > datetime.now(timezone.utc) + timedelta(minutes=1)
                or set(values) - {"views", "reach", "viewers"} or "views" not in values
                or not all(type(v) is int and 0 <= v < 2**53 for v in values.values())):
            raise ValueError("Invalid Instagram measurement")
        report["rows"].append({"scope": scope, "status": "ok", "observedAt": row["observedAt"], "values": values})
    return report


def refresh(client, source, inventory, seed=None, seed_only=False, legacy_private=False):
    from botocore.exceptions import ClientError
    started = datetime.now(timezone.utc)
    key = f"analytics-{source}.json"
    try:
        stored = client.get_object(Bucket=BUCKET, Key=key)
        condition = {"IfMatch": stored["ETag"]}
        previous = json.loads(stored["Body"].read())
    except ClientError as error:
        if error.response["Error"]["Code"] not in {"NoSuchKey", "404"}:
            raise
        condition, previous = {"IfNoneMatch": "*"}, {}
    engagement = None
    if seed_only:
        if not previous:
            raise ValueError("A current feed is required to seed its history")
        result, complete = attach_history(source, previous, previous, seed), True
        if source in TIME_ZONES and seed:
            seed_rows = {r["scope"]: r for r in seed["rows"]}
            for row in result["rows"]:
                supplied = seed_rows.get(row["scope"], {}).get("periods")
                if supplied is not None:
                    row["periods"], done = merge_periods(source, row.get("periods", {}), supplied,
                                                        datetime.now(timezone.utc))
                    row["periodStatus"] = "ok" if done else "partial"
        if result == previous:
            return True
    else:
        collected = collect(source, previous, legacy_private)
        if legacy_private and source == "ga4":
            engagement, engagement_complete = split_engagement(collected)
        if legacy_private and source == "instagram":
            publish_engagement(private_instagram(collected, started), "instagram.json")
        result, complete = merge(source, collected, previous, inventory, started)
        if seed is not None:
            result = attach_history(source, result, previous, seed)
    body = json.dumps(result, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()
    put = client.put_object(Bucket=BUCKET, Key=key, Body=body, ContentType="application/json",
                            CacheControl="public,max-age=60", **condition)
    # Read back the exact revision, including a conditional check against other publishers.
    stored = client.get_object(Bucket=BUCKET, Key=key, IfMatch=put["ETag"])
    if stored["Body"].read() != body:
        raise RuntimeError("S3 verification failed")
    if engagement is not None:
        # The public feed has been published and read back, independently of Kubernetes.
        try:
            publish_engagement(engagement)
        except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
            log(f"private GA4 engagement publish failed ({type(error).__name__})")
            return False
        if not engagement_complete:
            log("private GA4 engagement, channel or Instagram breakdown partially available")
            return False
    return complete


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--history-seed-dir", type=Path)
    parser.add_argument("--seed-only", action="store_true", help="Import verified history without recollecting current observations")
    parser.add_argument("--legacy-private", action="store_true", help="Also refresh pre-exporter private browser snapshots for rollback")
    parser.add_argument("--support-only", action="store_true", help="Manually refresh the legacy support snapshot for comparison")
    args = parser.parse_args()
    if args.support_only and (args.seed_only or args.history_seed_dir or args.legacy_private):
        parser.error("--support-only is independent of public feed options")
    if args.seed_only and not args.history_seed_dir:
        parser.error("--seed-only requires --history-seed-dir")
    state = Path.home() / ".local/state/dashboard-analytics"
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (state / "refresh.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            log("Skipped overlapping run")
            return 1 if args.seed_only or args.support_only else 0
        if args.support_only:
            try:
                publish_private("customer-support-counts", "report.json", collect_support(kubectl_command()), "customer-support-counts")
                log("customer support counts verified")
                return 0
            except Exception as error:
                log(f"customer support counts failed ({type(error).__name__})")
                return 1
        success = True
        inventory = json.loads((BASE / "analytics-inventory.json").read_text())
        client = s3_client()
        sources = SOURCES
        if args.seed_only:
            sources = [s for s in SOURCES if (args.history_seed_dir / f"analytics-{s}.json").is_file()]
            if not sources:
                raise ValueError("No seed feeds")
        for source in sources:
            try:
                seed = None
                if args.history_seed_dir:
                    path = args.history_seed_dir / f"analytics-{source}.json"
                    if path.is_file():
                        seed = json.loads(path.read_text())
                complete = refresh(client, source, inventory, seed, args.seed_only, args.legacy_private)
                log(f"{source} {'verified' if complete else 'partially updated; prior rows retained'}")
                success = success and complete
            except Exception as error:
                log(f"{source} failed ({type(error).__name__})")
                success = False
        return 0 if success else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        log(f"Initialization failed ({type(error).__name__})")
        sys.exit(1)
