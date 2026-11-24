#!/usr/bin/env python3
"""Refresh the three public aggregate objects shared by Status and Metrics."""
import argparse
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

from analytics_history import attach_history

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
        if set(row) - {"history", "scope", "values", "status", "observedAt", "method", "timeZone",
                       "periodStart", "periodEnd", "periodLabel"}:
            raise ValueError("Unexpected public field")
        merged.append({k: v for k, v in row.items() if k != "history"})
        successful += 1
    if not successful:
        raise ValueError("No new observations")
    feed = {"schemaVersion": 1, "source": source, "observedAt": result["observedAt"], "rows": merged}
    return attach_history(source, feed, previous), successful == len(rows)


def refresh(client, source, inventory, seed=None, seed_only=False):
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
    if seed_only:
        if not previous:
            raise ValueError("A current feed is required to seed its history")
        result, complete = attach_history(source, previous, previous, seed), True
        if result == previous:
            return True
    else:
        result, complete = merge(source, collect(source, previous), previous, inventory, started)
        if seed is not None:
            result = attach_history(source, result, previous, seed)
    body = json.dumps(result, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()
    put = client.put_object(Bucket=BUCKET, Key=key, Body=body, ContentType="application/json",
                            CacheControl="public,max-age=60", **condition)
    # Read back the exact revision, including a conditional check against other publishers.
    stored = client.get_object(Bucket=BUCKET, Key=key, IfMatch=put["ETag"])
    if stored["Body"].read() != body:
        raise RuntimeError("S3 verification failed")
    return complete


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--history-seed-dir", type=Path)
    parser.add_argument("--seed-only", action="store_true", help="Import verified history without recollecting current observations")
    args = parser.parse_args()
    if args.seed_only and not args.history_seed_dir:
        parser.error("--seed-only requires --history-seed-dir")
    state = Path.home() / ".local/state/dashboard-analytics"
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (state / "refresh.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            log("Skipped overlapping run")
            return 1 if args.seed_only else 0
        inventory = json.loads((BASE / "analytics-inventory.json").read_text())
        client = s3_client()
        success = True
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
                complete = refresh(client, source, inventory, seed, args.seed_only)
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
