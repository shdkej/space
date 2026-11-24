#!/usr/bin/env python3
"""Refresh the three public aggregate objects shared by Status and Metrics."""
import configparser
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

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


def posthog_token():
    if os.environ.get("POSTHOG_ACCESS_TOKEN"):
        return os.environ["POSTHOG_ACCESS_TOKEN"]
    with (Path.home() / ".env").open() as lines:
        for line in lines:
            match = re.fullmatch(r"\s*(?:export\s+)?POSTHOG_ACCESS_TOKEN\s*=\s*(.*?)\s*", line)
            if match and match[1]:
                return match[1].strip("'\"")
    raise ValueError("Missing PostHog read credential")


def collect(source, previous):
    if source == "posthog":
        with tempfile.TemporaryDirectory() as tmp:
            feed = Path(tmp) / "analytics-posthog.json"
            feed.write_text(json.dumps(previous))
            env = dict(os.environ, POSTHOG_ACCESS_TOKEN=posthog_token())
            env.pop("POSTHOG_PERSONAL_API_KEY", None)
            subprocess.run([sys.executable, str(BASE / "collect-analytics.py"), source,
                            "--output-dir", tmp], env=env, check=True, timeout=220,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return json.loads(feed.read_text())
    script = BASE / f"read-{source}-insights.mjs"
    # On Windows builds Ego writes console.log to stderr. Never expose browser
    # output; the only accepted result is the structured public aggregate.
    with script.open("rb") as code:
        result = subprocess.run([str(BROWSER), "nodejs"], stdin=code, check=True, timeout=250,
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
    merged = []
    for row in rows:
        scope = row["scope"]
        if row.get("status") == "unavailable":
            merged.append({**old.get(scope, {"scope": scope}), "status": "unavailable"})
            continue
        if row.get("status") != "ok" or set(row["values"]) != FIELDS[source]:
            raise ValueError("Unexpected metrics")
        if any(type(v) is not int or not 0 <= v < 2**53 for v in row["values"].values()):
            raise ValueError("Invalid metric")
        at = datetime.fromisoformat(row["observedAt"].replace("Z", "+00:00"))
        if at < started or at.timestamp() > datetime.now(timezone.utc).timestamp() + 60:
            raise ValueError("Stale observation")
        if set(row) - {"scope", "values", "status", "observedAt", "method", "timeZone",
                       "periodStart", "periodEnd", "periodLabel"}:
            raise ValueError("Unexpected public field")
        merged.append(row)
        successful += 1
    if not successful:
        raise ValueError("No new observations")
    return ({"schemaVersion": 1, "source": source, "observedAt": result["observedAt"],
             "rows": merged}, successful == len(rows))


def refresh(client, source, inventory):
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
    result, complete = merge(source, collect(source, previous), previous, inventory, started)
    body = json.dumps(result, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()
    put = client.put_object(Bucket=BUCKET, Key=key, Body=body, ContentType="application/json",
                            CacheControl="public,max-age=60", **condition)
    # Read back the exact revision, including a conditional check against other publishers.
    stored = client.get_object(Bucket=BUCKET, Key=key, IfMatch=put["ETag"])
    if stored["Body"].read() != body:
        raise RuntimeError("S3 verification failed")
    return complete


def main():
    state = Path.home() / ".local/state/dashboard-analytics"
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (state / "refresh.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            log("Skipped overlapping run")
            return 0
        inventory = json.loads((BASE / "analytics-inventory.json").read_text())
        client = s3_client()
        success = True
        for source in SOURCES:
            try:
                complete = refresh(client, source, inventory)
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
