"""Count tagged inbound Gmail conversations locally. Only aggregate counts leave this process."""
import json
from pathlib import Path
import re
import subprocess
import time

APPS = {"모두의정책": "policycock", "virtue": "Virtue"}
PREFIX = re.compile(r"^\[(모두의정책|virtue)\]", re.IGNORECASE | re.ASCII)
ACCOUNT_FILE = Path.home() / ".local/share/dashboard-analytics/gmail-support-account"


def count_threads(page):
    messages = page.get("messages")
    if (not isinstance(messages, list) or page.get("has_more") is not False
            or page.get("nextPageToken") or page.get("count") != len(messages)):
        raise ValueError("Incomplete Gmail search")
    threads = {scope: set() for scope in APPS.values()}
    for row in messages:
        subject, thread = row.get("subject"), row.get("threadId")
        if not isinstance(subject, str) or not isinstance(thread, str) or not thread:
            raise ValueError("Missing Gmail message metadata")
        match = PREFIX.match(subject)
        if match:
            threads[APPS[match[1].lower()]].add(thread)
    return {scope: len(items) for scope, items in threads.items()}


def collect_support():
    account = ACCOUNT_FILE.read_text().strip()
    if not re.fullmatch(r"[a-zA-Z0-9._+%-]+@[a-zA-Z0-9.-]+", account):
        raise ValueError("Invalid support account setting")
    end = int(time.time())
    query = (f"after:{end - 7 * 86400} before:{end} "
             f"{{to:{account} deliveredto:{account}}} -in:spam -in:trash -in:drafts -in:sent "
             "{subject:모두의정책 subject:virtue}")
    # Read-only keychain wrapper. No bodies, attachments, or raw output in the logs.
    cmd = [str(Path.home() / ".local/bin/gog"), "--account", account, "--readonly", "--gmail-no-send",
           "--no-input", "--json", "gmail", "messages", "search", query, "--all"]
    result = subprocess.run(cmd, check=True, capture_output=True, timeout=180)
    counts = count_threads(json.loads(result.stdout))
    return {"schemaVersion": 1, "observedAt": end, "counts": counts}
