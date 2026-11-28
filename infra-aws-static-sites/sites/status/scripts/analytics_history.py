"""Bounded history of actual observations and explicitly dated provider reports."""
from datetime import datetime, timedelta, timezone

METRICS = {
    "posthog": {"events", "pageviews", "sessions"},
    "ga4": {"newUsers", "sessions"},
    "instagram": {"views", "viewers", "reach", "interactions", "profileVisits", "followers"},
}
PERIOD_FIELDS = ("periodStart", "periodEnd", "periodLabel", "timeZone", "method")


def instant(value):
    if not isinstance(value, str):
        raise ValueError("Missing observation timestamp")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Missing observation timezone")
    return parsed.astimezone(timezone.utc)


def history_for(source, candidates, now):
    points = {}
    for item in candidates:
        if not item.get("observedAt") or not item.get("values"):
            continue
        observed = instant(item["observedAt"])
        sampled = instant(item.get("sampleAt", item["observedAt"]))
        if sampled < now - timedelta(days=31):
            continue
        if observed > now + timedelta(minutes=1) or sampled > observed:
            raise ValueError("Invalid history time range")
        values = item["values"]
        if not isinstance(values, dict) or set(values) - METRICS[source]:
            raise ValueError("Unexpected history metrics")
        if any(v is not None and (type(v) is not int or not 0 <= v < 2**53) for v in values.values()):
            raise ValueError("Invalid history value")
        if all(v is None for v in values.values()):
            continue
        previous = points.get(sampled)
        if previous and observed < previous[0]:
            continue
        point = {"observedAt": item["observedAt"], "values": dict(values)}
        if "sampleAt" in item:
            point["sampleAt"] = item["sampleAt"]
        for key in PERIOD_FIELDS:
            if key in item:
                value = item[key]
                if not isinstance(value, str) or len(value) > 180:
                    raise ValueError("Invalid observation metadata")
                point[key] = value
        points[sampled] = (observed, point)

    by_date, recent = {}, []
    for sampled in sorted(points):
        point = points[sampled][1]
        if sampled < now - timedelta(hours=24):
            by_date[sampled.date()] = point
        else:
            recent.append(point)
    return [*by_date.values(), *recent[-144:]]


def canonical_previous(source, previous):
    if source != "posthog":
        return previous
    rows = [{**row, "scope": "blog"} if row["scope"] == "shdkej.com" else row
            for row in previous.get("rows", [])]
    return {**previous, "rows": rows}


def attach_history(source, feed, previous, seed=None, now=None):
    now = now or datetime.now(timezone.utc)
    rows = feed["rows"]
    if seed is not None:
        if seed.get("source") != source or seed.get("schemaVersion") != 1:
            raise ValueError("Seed source mismatch")
        scopes = {row["scope"] for row in rows}
        names = [row["scope"] for row in seed["rows"]]
        if len(set(names)) != len(names) or not set(names).issubset(scopes):
            raise ValueError("Unexpected seed scope")
    seeded = {r["scope"]: r for r in (seed or {}).get("rows", [])}
    old = {r["scope"]: r for r in previous.get("rows", [])}
    merged = []
    for row in rows:
        candidates = []
        for version in (seeded.get(row["scope"], {}), old.get(row["scope"], {}), row):
            candidates.extend(version.get("history", []))
            candidates.append(version)
        merged.append({**row, "history": history_for(source, candidates, now)})
    return {**feed, "rows": merged}
