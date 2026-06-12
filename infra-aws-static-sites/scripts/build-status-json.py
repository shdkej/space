#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def bucket_for_domain(domain):
    return "static-" + domain.replace(".", "-")


def state_outputs(root):
    try:
        raw = subprocess.check_output(
            ["terraform", "-chdir=" + str(root), "output", "-json", "app_sites"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return {}
    return json.loads(raw)


def cloudfront_distribution_for_domain(domain):
    query = (
        "DistributionList.Items[?Aliases.Items && "
        f"contains(Aliases.Items, '{domain}')].Id | [0]"
    )
    try:
        distribution_id = subprocess.check_output(
            [
                "aws",
                "cloudfront",
                "list-distributions",
                "--query",
                query,
                "--output",
                "text",
            ],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ""
    return "" if distribution_id in {"", "None"} else distribution_id


def check_url(url, timeout):
    start = time.perf_counter()
    request = Request(url, method="HEAD")
    try:
        with urlopen(request, timeout=timeout) as response:
            status = response.status
    except HTTPError as error:
        status = error.code
    except URLError:
        return "warn", 0

    latency_ms = int((time.perf_counter() - start) * 1000)
    return ("ok" if 200 <= status < 400 else "warn"), latency_ms


def title_case_app(app):
    return " ".join(part.capitalize() for part in app.split("-"))


def build_status(registry, outputs, resolve_aws=False, check=False, timeout=5):
    checks = []
    deployments = []
    apps = []

    for site in registry["sites"]:
        app = site["app"]
        domain = site["domain_name"]
        url = "https://" + domain
        output = outputs.get(app, {})
        hosting = site.get("hosting", "s3 cloudfront")
        static_hosting = hosting == "s3 cloudfront"

        distribution_id = output.get("cloudfront_distribution_id", "")
        if resolve_aws and not distribution_id:
            distribution_id = cloudfront_distribution_for_domain(domain)

        state = "ok"
        latency_ms = 0
        if check:
            state, latency_ms = check_url(url, timeout)

        checks.append(
            {
                "name": site.get("name", title_case_app(app)),
                "url": url,
                "state": state,
                "latencyMs": latency_ms,
                "detail": site.get("detail", ""),
            }
        )
        deployments.append(
            {
                "name": site.get("deployment_name", site.get("name", app).lower()),
                "url": url,
                "bucket": output.get("bucket_name", bucket_for_domain(domain) if static_hosting else ""),
                "distribution": distribution_id or (site.get("distribution", "") if not static_hosting else "unresolved"),
                "hosting": hosting,
                "updatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                "state": state,
            }
        )
        apps.append(
            {
                "name": site.get("name", title_case_app(app)),
                "url": url,
                "kind": site.get("kind", "static"),
            }
        )

    all_ok = all(item["state"] == "ok" for item in checks)
    names = [site.get("name", title_case_app(site["app"])) for site in registry["sites"]]
    label = ", ".join(names[:-1]) + (", and " + names[-1] if len(names) > 1 else names[0])

    return {
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "overall": {
            "state": "ok" if all_ok else "warn",
            "label": f"{label} are the active surfaces",
            "score": 98 if all_ok else 82,
        },
        "checks": checks,
        "deployments": deployments,
        "agents": registry.get("agents", []),
        "apps": apps,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=Path(__file__).resolve().parents[1])
    parser.add_argument("--registry", default=None)
    parser.add_argument("--out", default=None)
    parser.add_argument("--resolve-aws", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--timeout", type=int, default=5)
    args = parser.parse_args()

    root = Path(args.root)
    registry_path = Path(args.registry) if args.registry else root / "sites" / "registry.json"
    out_path = Path(args.out) if args.out else root / "sites" / "status" / "dist" / "status.json"

    registry = load_json(registry_path)
    outputs = state_outputs(root)
    status = build_status(
        registry,
        outputs,
        resolve_aws=args.resolve_aws,
        check=args.check,
        timeout=args.timeout,
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out_path}")


if __name__ == "__main__":
    sys.exit(main())
