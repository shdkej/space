"""Publish aggregate counts for the System L2 card."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
from urllib.parse import unquote, urlencode
from urllib.request import Request, urlopen

DATA_SOURCE = "68b8485f-29f4-4bed-a0e1-459cf18c69df"
LINEAR_QUERY = """
query Backlog($after: String) {
  issues(first: 100, after: $after, filter: {state: {type: {eq: "backlog"}}}) {
    nodes { id }
    pageInfo { hasNextPage endCursor }
  }
}
"""


def credential(name):
    if os.environ.get(name):
        return os.environ[name]
    with (Path.home() / ".env").open() as lines:
        for line in lines:
            key, _, value = line.strip().partition("=")
            if key == name and value:
                return value.strip().strip("\"'")
    raise ValueError("Missing credential")


def request(url, headers, payload=None):
    body = None if payload is None else json.dumps(payload).encode()
    with urlopen(Request(url, body, {**headers, "Content-Type": "application/json"}), timeout=25) as response:
        return json.load(response)


def next_cursor(more, cursor, seen):
    if more is False:
        return None
    if more is not True or not cursor or cursor in seen:
        raise ValueError("Invalid pagination")
    seen.add(cursor)
    return cursor


def notion_counts():
    headers = {"Authorization": "Bearer " + credential("NOTION_API_KEY"), "Notion-Version": "2025-09-03"}
    source = "https://api.notion.com/v1/data_sources/" + DATA_SOURCE
    platform = request(source, headers)["properties"]["플랫폼"]
    if platform["type"] != "select":
        raise ValueError("Unexpected platform property")
    url = source + "/query?" + urlencode({"filter_properties": unquote(platform["id"])})
    payload = {"page_size": 100}
    total = missing = 0
    seen = set()
    while True:
        page = request(url, headers, payload)
        for row in page["results"]:
            prop = row["properties"]["플랫폼"]
            if prop["type"] != "select":
                raise ValueError("Invalid platform value")
            total += 1
            missing += prop["select"] is None
        cursor = next_cursor(page["has_more"], page["next_cursor"], seen)
        if cursor is None:
            return {"total": total, "withoutPlatform": missing}
        payload["start_cursor"] = cursor


def linear_counts():
    headers = {"Authorization": credential("LINEAR_API_KEY")}
    seen = set()
    cursor = None
    count = 0
    while True:
        result = request("https://api.linear.app/graphql", headers,
                         {"query": LINEAR_QUERY, "variables": {"after": cursor}})
        if result.get("errors"):
            raise ValueError("Linear query failed")
        issues = result["data"]["issues"]
        count += len(issues["nodes"])
        info = issues["pageInfo"]
        cursor = next_cursor(info["hasNextPage"], info["endCursor"], seen)
        if cursor is None:
            return {"backlog": count}


def publish_work_counts(client, bucket, log):
    from botocore.exceptions import ClientError

    key = "work-counts.json"
    try:
        etag = client.head_object(Bucket=bucket, Key=key)["ETag"]
        condition = {"IfMatch": etag}
    except ClientError as error:
        if error.response["Error"]["Code"] not in {"NoSuchKey", "404"}:
            raise
        condition = {"IfNoneMatch": "*"}
    report = {}
    for name, collect in (("notion", notion_counts), ("linear", linear_counts)):
        try:
            report[name] = {**collect(), "status": "ok"}
        except Exception as error:
            log(f"{name} counts unavailable ({type(error).__name__})")
            report[name] = {"status": "unavailable"}
    report["observedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    body = json.dumps(report, separators=(",", ":")).encode()
    put = client.put_object(Bucket=bucket, Key=key, Body=body, ContentType="application/json",
                            CacheControl="public,max-age=60", **condition)
    stored = client.get_object(Bucket=bucket, Key=key, IfMatch=put["ETag"])
    if stored["Body"].read() != body:
        raise RuntimeError("Work counts verification failed")
    return all(report[name]["status"] == "ok" for name in ("notion", "linear"))
