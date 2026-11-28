"""Collect public Metrics feeds on k3s, retaining history across publisher moves."""
from datetime import datetime, timezone
from calendar_periods import merge_periods, requested_periods
import json
import os
from pathlib import Path
import runpy
import tempfile
from urllib.request import urlopen

BASE = Path(__file__).resolve().parent
api = runpy.run_path(str(BASE / "collect-analytics.py"))
publisher = runpy.run_path(str(BASE / "refresh-analytics.py"))
OUTPUT = Path("/feeds")


def add_ga4_periods(rows, previous, inventory, now):
    old = {row["scope"]: row for row in previous["rows"]}
    token = None
    for row in rows:
        if row["status"] != "ok":
            continue
        scope = row["scope"]
        cached = old.get(scope, {}).get("periods", {})
        # On Mondays the completed calendar week is the rolling seven-day window.
        same_window = {kind: [] for kind in ("day", "week", "month")}
        for window in requested_periods("ga4", cached, now):
            if (row["periodStart"], row["periodEnd"]) == (window["periodStart"], window["periodEnd"]):
                same_window[window["kind"]].append({key: row[key] for key in
                    ("periodStart", "periodEnd", "timeZone", "observedAt", "values")})
        cached, done = merge_periods("ga4", cached, same_window, now)
        if not done:
            if token is None:
                token = api["ga4_token"]()
            cached, done = api["collect_periods"]("ga4", inventory[scope], token, [], cached, now)
        row.update(periods=cached, periodStatus="ok" if done else "partial")


def collect(source, inventory):
    started = datetime.now(timezone.utc)
    name = f"analytics-{source}.json"
    destination = OUTPUT / name
    if destination.exists():
        previous = json.loads(destination.read_bytes())
    else:
        with urlopen("https://status.aws.shdkej.com/" + name, timeout=20) as response:
            previous = json.load(response)
    if previous["source"] != source:
        raise ValueError("Unexpected previous snapshot")
    with urlopen(f"http://posthog-exporter:9101/analytics-{source}.json", timeout=20) as response:
        data = json.load(response)
    if source == "ga4":
        add_ga4_periods(data["rows"], previous, inventory["ga4"], started)
        # A newly refreshed calendar period can be newer than the hourly total.
        data["observedAt"] = max([data["observedAt"], *(
            point["observedAt"] for row in data["rows"] for group in row.get("periods", {}).values()
            for point in group)], key=lambda value: datetime.fromisoformat(value.replace("Z", "+00:00")))
    feed, complete = publisher["merge"](source, data, previous, inventory, started, hourly_cache=True)
    with tempfile.NamedTemporaryFile(dir=OUTPUT, delete=False, mode="w") as out:
        json.dump(feed, out, allow_nan=False, separators=(",", ":"))
        os.fchmod(out.fileno(), 0o644)
    os.replace(out.name, destination)
    return complete


if __name__ == "__main__":
    inventory = json.loads((BASE / "analytics-inventory.json").read_text())
    ok = True
    for source in publisher["SOURCES"]:
        try:
            complete = collect(source, inventory)
            print(source, "verified" if complete else "partial", flush=True)
            ok = ok and complete
        except Exception as error:
            print(source, "failed", type(error).__name__, flush=True)
            ok = False
    raise SystemExit(0 if ok else 1)
