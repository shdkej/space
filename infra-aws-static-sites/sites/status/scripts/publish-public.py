"""Copy verified public k3s snapshots to their existing S3 keys."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import json
from urllib.request import urlopen

BUCKET = "static-status-aws-shdkej-com"
SOURCES = ("posthog", "ga4", "instagram")


def publish(client, source, scopes):
    key = f"analytics-{source}.json"
    with urlopen("https://metrics.oracle.shdkej.com/public-analytics/" + key, timeout=25) as response:
        data = response.read(2_000_001)
    if len(data) > 2_000_000:
        raise ValueError("Unexpected feed size")
    feed = json.loads(data)
    if set(feed) != {"schemaVersion", "source", "rows", "observedAt"} or feed["schemaVersion"] != 1 or feed["source"] != source:
        raise ValueError("Invalid feed")
    rows = feed["rows"]
    if len(rows) != len(scopes) or {row["scope"] for row in rows} != scopes:
        raise ValueError("Invalid scopes")
    observed = datetime.fromisoformat(feed["observedAt"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    if not now - timedelta(hours=12) <= observed <= now + timedelta(minutes=1):
        raise ValueError("Feed is stale")
    stored = client.get_object(Bucket=BUCKET, Key=key)
    old = stored["Body"].read()
    previous = json.loads(old)
    if previous == feed:
        return
    if observed <= datetime.fromisoformat(previous["observedAt"].replace("Z", "+00:00")):
        raise ValueError("Newer or conflicting feed already published")
    put = client.put_object(Bucket=BUCKET, Key=key, Body=data, IfMatch=stored["ETag"],
                            ContentType="application/json", CacheControl="public,max-age=60")
    if client.get_object(Bucket=BUCKET, Key=key, IfMatch=put["ETag"])["Body"].read() != data:
        raise RuntimeError("Published snapshot verification failed")


if __name__ == "__main__":
    import boto3
    client = boto3.client("s3", region_name="ap-northeast-2")
    inventory = json.loads(Path(__file__).with_name("analytics-inventory.json").read_text())
    ok = True
    for source in SOURCES:
        try:
            scopes = {"minimal_collector"} if source == "instagram" else set(inventory[source])
            publish(client, source, scopes)
            print(source, "verified")
        except Exception as error:
            print(source, "failed", type(error).__name__)
            ok = False
    raise SystemExit(0 if ok else 1)
