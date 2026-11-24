"""Completed, non-overlapping calendar reporting windows for Status graphs."""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

COUNTS = {"day": 7, "week": 4, "month": 2}
TIME_ZONES = {"posthog": "Asia/Seoul", "ga4": "Asia/Seoul"}
KEYS = {"posthog": {"events", "pageviews", "sessions"}, "ga4": {"newUsers", "sessions"}}


def calendar_windows(today):
    """The end date in the wire format is inclusive."""
    week = today - timedelta(days=today.weekday())
    month = today.replace(day=1)
    windows = []
    for kind, count in COUNTS.items():
        end = {"day": today, "week": week, "month": month}[kind]
        group = []
        for _ in range(count):
            last = end - timedelta(days=1)
            start = last.replace(day=1) if kind == "month" else end - timedelta(days=7 if kind == "week" else 1)
            group.append({"kind": kind, "periodStart": start.isoformat(), "periodEnd": last.isoformat()})
            end = start
        windows.extend(reversed(group))
    return windows


def as_key(kind, point):
    return kind, point["periodStart"], point["periodEnd"]


def index_periods(source, periods, windows, now):
    expected = {as_key(w["kind"], w) for w in windows}
    points = {}
    if not isinstance(periods, dict) or set(periods) - COUNTS.keys():
        raise ValueError("Unexpected calendar resolution")
    for kind, group in periods.items():
        for point in group:
            key = as_key(kind, point)
            if key not in expected:  # Discard buckets older than the current retention window.
                continue
            if set(point) != {"periodStart", "periodEnd", "observedAt", "timeZone", "values"}:
                raise ValueError("Unexpected calendar fields")
            if point["timeZone"] != TIME_ZONES[source] or set(point["values"]) != KEYS[source]:
                raise ValueError("Unexpected calendar source definition")
            observed = datetime.fromisoformat(point["observedAt"].replace("Z", "+00:00"))
            if (observed.tzinfo is None or observed > now + timedelta(minutes=1) or
                    observed.astimezone(ZoneInfo(point["timeZone"])).date() <= date.fromisoformat(point["periodEnd"])):
                raise ValueError("Invalid calendar observation time")
            for value in point["values"].values():
                if value is None and source == "ga4":
                    continue
                if type(value) is not int or not 0 <= value < 2**53:
                    raise ValueError("Invalid calendar count")
            points[key] = point
    return points


def requested_periods(source, old, now):
    today = now.astimezone(ZoneInfo(TIME_ZONES[source])).date()
    windows = calendar_windows(today)
    points = index_periods(source, old, windows, now)
    needed = []
    for window in windows:
        point = points.get(as_key(window["kind"], window))
        if point:
            # Revisit late-arriving data during the first three days after a bucket closes.
            recent = (today - date.fromisoformat(window["periodEnd"])).days <= 3
            observed = datetime.fromisoformat(point["observedAt"].replace("Z", "+00:00"))
            if not recent or now - observed < timedelta(hours=18):
                continue
        needed.append(window)
    return needed


def merge_periods(source, old, new, now):
    windows = calendar_windows(now.astimezone(ZoneInfo(TIME_ZONES[source])).date())
    points = index_periods(source, old, windows, now)
    for key, point in index_periods(source, new, windows, now).items():
        earlier = points.get(key)
        if not earlier or datetime.fromisoformat(point["observedAt"]) >= datetime.fromisoformat(earlier["observedAt"]):
            points[key] = point
    result = {kind: [] for kind in COUNTS}
    for window in windows:
        key = as_key(window["kind"], window)
        if key in points:
            result[window["kind"]].append(points[key])
    return result, not requested_periods(source, result, now)
