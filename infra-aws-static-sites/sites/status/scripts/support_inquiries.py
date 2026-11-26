"""Count tagged inbound Gmail conversations locally. Only aggregate counts leave this process."""
import json
from pathlib import Path
import re
import subprocess
import time
from urllib.parse import urlencode

ACCOUNT_FILE = Path.home() / ".local/share/dashboard-analytics/gmail-support-account"
GA4 = "ga4_app_rolling7d_count"
POSTHOG = "posthog_app_calendar_count"
PREFIX = re.compile(r"^\[([^\[\]\r\n]{1,160})\]")
BRIEFING = re.compile(r"\[AI\s+브리핑\]", re.IGNORECASE)
NAME = r"[A-Za-z0-9가-힣][A-Za-z0-9가-힣._ -]{0,99}"
SCOPE = re.compile(rf"(?:project-[0-9]+ / )?(?:(?:app|host):)?({NAME})")
MAX_SCOPES = 512


def current_scopes(kubectl):
    # Use the two series families backing the Grafana customer dashboard's app selector.
    # A five-minute scrape can land just beyond Prometheus's default five-minute lookback.
    query = f'group by (__name__,scope) (last_over_time({{__name__=~"{GA4}|{POSTHOG}"}}[15m]))'
    api = "/api/v1/namespaces/monitoring/services/http:kube-prometheus-stack-prometheus:9090/proxy/api/v1/query?"
    response = subprocess.run([*kubectl, "get", "--raw", api + urlencode({"query": query})],
                              check=True, capture_output=True, timeout=45)
    body = json.loads(response.stdout)
    if body.get("status") != "success" or body.get("warnings") or body["data"].get("resultType") != "vector":
        raise ValueError("Incomplete Grafana app inventory")
    sources = {GA4: set(), POSTHOG: set()}
    for result in body["data"]["result"]:
        metric = result["metric"]
        name, scope = metric["__name__"], metric["scope"]
        if name not in sources or not isinstance(scope, str):
            raise ValueError("Unexpected app inventory row")
        if scope.split(" / ")[-1] == "앱 미지정":
            continue
        match = SCOPE.fullmatch(scope)
        if not match or len(scope) > 160:
            raise ValueError("Unsupported registered app name")
        if match[1].casefold() != "ai 브리핑":
            sources[name].add(scope)
    scopes = sorted(sources[GA4] | sources[POSTHOG])
    if not all(sources.values()) or len(scopes) > MAX_SCOPES:
        raise ValueError("Incomplete Grafana app inventory")
    return scopes


def tag_map(scopes):
    # Multiple projects can reuse an app ID. Only unique short names resolve.
    canonical = {}
    candidates = {}
    for scope in scopes:
        canonical.setdefault(scope.casefold(), set()).add(scope)
        app = scope.split(" / ")[-1]
        short = app.split(":", 1)[-1]
        for tag in (app, short):
            candidates.setdefault(tag.casefold(), set()).add(scope)
        if app.startswith("host:"):
            candidates.setdefault(short.split(".", 1)[0].casefold(), set()).add(scope)
    if any(len(owners) != 1 for owners in canonical.values()):
        raise ValueError("Registered app names differ only by case")
    if "policycock" in scopes:
        candidates.setdefault("모두의정책", set()).add("policycock")
    # Exact dashboard names take precedence over inferred aliases.
    candidates.update(canonical)
    return {tag: next(iter(owners)) for tag, owners in candidates.items()
            if len(owners) == 1 and tag not in {"ai 브리핑", "앱 미지정"}}


def match_page(page, tags, threads):
    messages = page.get("messages")
    if (not isinstance(messages, list) or page.get("has_more") is not False
            or page.get("nextPageToken") or page.get("count") != len(messages)):
        raise ValueError("Incomplete Gmail search")
    for row in messages:
        subject, thread = row.get("subject"), row.get("threadId")
        if not isinstance(subject, str) or not isinstance(thread, str) or not thread:
            raise ValueError("Missing Gmail message metadata")
        match = PREFIX.match(subject)
        if match and not BRIEFING.search(subject):
            scope = tags.get(match[1].casefold())
            if scope is not None:
                threads[scope].add(thread)


def searches(account, end, tags):
    # Strings come exclusively from validated dashboard scopes and known aliases.
    # Bound the query length and share the thread sets across all batches.
    base = (f"after:{end - 7 * 86400} before:{end} "
            f"{{to:{account} deliveredto:{account}}} -in:spam -in:trash -in:drafts -in:sent ")
    terms = []
    for tag in sorted(tags):
        term = f'subject:"{tag}"'
        if terms and sum(map(len, terms)) + len(terms) + len(term) > 1200:
            yield base + "{" + " ".join(terms) + "}"
            terms = []
        terms.append(term)
    if terms:
        yield base + "{" + " ".join(terms) + "}"


def collect_support(kubectl):
    account = ACCOUNT_FILE.read_text().strip()
    if not re.fullmatch(r"[a-zA-Z0-9._+%-]+@[a-zA-Z0-9.-]+", account):
        raise ValueError("Invalid support account setting")
    scopes = current_scopes(kubectl)
    tags = tag_map(scopes)
    end = int(time.time())
    threads = {scope: set() for scope in scopes}
    for query in searches(account, end, tags):
        cmd = [str(Path.home() / ".local/bin/gog"), "--account", account, "--readonly", "--gmail-no-send",
               "--no-input", "--json", "gmail", "messages", "search", query, "--all"]
        result = subprocess.run(cmd, check=True, capture_output=True, timeout=180)
        match_page(json.loads(result.stdout), tags, threads)
    counts = {scope: len(items) for scope, items in threads.items()}
    return {"schemaVersion": 2, "observedAt": end, "scopes": scopes, "counts": counts}
