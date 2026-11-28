"""Collect public Metrics feeds on k3s, retaining history across publisher moves."""
from datetime import datetime, timezone
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
    with tempfile.TemporaryDirectory() as tmp:
        if source == "posthog":
            with urlopen("http://posthog-exporter:9101/analytics-posthog.json", timeout=20) as response:
                data = json.load(response)
        else:
            staging = Path(tmp)
            (staging / name).write_text(json.dumps(previous))
            path = api["collect"](source, staging, inventory, calendar=True)
            data = json.loads(path.read_bytes())
        feed, complete = publisher["merge"](source, data, previous, inventory, started)
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
