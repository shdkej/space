#!/usr/bin/env python3
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

NOTION_VERSION = "2022-06-28"
DEFAULT_DATABASE_ID = "4f25c20d753e404ca82747b8f4ad2659"
TRIP_START = "2026-07-08"

CATEGORY_LABELS = {
    "stay": "숙소",
    "gear": "준비물·장비",
    "medical": "의료·보험",
    "transport": "교통",
    "food": "외식",
    "groceries": "장보기",
    "visa": "비자",
    "flight": "항공",
    "ticket": "입장권",
    "activity": "체험",
    "snack": "간식·물",
    "mistake": "멍청비용",
    "other": "기타",
}


def parse_args():
    parser = argparse.ArgumentParser(description="Append new travel dashboard expenses to the Notion expense DB.")
    parser.add_argument("--input", default="sites/travel/dist/travel-data.json")
    parser.add_argument("--database-id", default=os.environ.get("NOTION_TRAVEL_EXPENSE_DATABASE_ID", DEFAULT_DATABASE_ID))
    parser.add_argument("--from-date", default=TRIP_START)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def notion_token():
    token = os.environ.get("NOTION_API_TOKEN") or os.environ.get("NOTION_KIMNOZ_TRAVEL_API_KEY")
    if not token:
        raise SystemExit("NOTION_API_TOKEN or NOTION_KIMNOZ_TRAVEL_API_KEY is required")
    return token


def notion_request(method, path, token, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        f"https://api.notion.com/v1/{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            if response.status == 204:
                return {}
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Notion API {method} {path} failed: {error.code} {detail}") from error


def existing_keys(database_id, token):
    keys = set()
    cursor = None
    while True:
        payload = {"page_size": 100}
        if cursor:
            payload["start_cursor"] = cursor
        data = notion_request("POST", f"databases/{database_id}/query", token, payload)
        for page in data.get("results", []):
            props = page.get("properties", {})
            date_value = (props.get("날짜", {}).get("date") or {}).get("start")
            amount_value = props.get("금액", {}).get("number")
            if date_value and amount_value is not None:
                keys.add((date_value, int(amount_value)))
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
    return keys


def text_value(value):
    if not value:
        return []
    return [{"type": "text", "text": {"content": str(value)[:2000]}}]


def expense_payload(database_id, expense):
    category = CATEGORY_LABELS.get(expense.get("category"), expense.get("category") or "기타")
    location = expense.get("country") or expense.get("location") or ""
    note_parts = []
    if expense.get("time"):
        note_parts.append(f"시간 {expense['time']}")
    if expense.get("note"):
        note_parts.append(str(expense["note"]))
    if expense.get("id"):
        note_parts.append(f"dashboard:{expense['id']}")

    return {
        "parent": {"database_id": database_id},
        "properties": {
            "항목": {"title": text_value(expense.get("merchant") or "미확인 비용")},
            "날짜": {"date": {"start": expense["date"]}},
            "금액": {"number": int(expense["amount"])},
            "카테고리": {"select": {"name": category}},
            "국가/구간": {"rich_text": text_value(location)},
            "국가별도시": {"rich_text": text_value(location)},
            "결제수단": {"select": {"name": "미확인"}},
            "통화": {"select": {"name": "KRW"}},
            "메모": {"rich_text": text_value(" · ".join(note_parts))},
        },
    }


def main():
    args = parse_args()
    token = notion_token()
    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    expenses = data.get("travelExpenses") or data.get("expenses") or []
    candidates = [
        expense
        for expense in expenses
        if expense.get("travel") is not False
        and expense.get("date")
        and expense.get("date") >= args.from_date
        and int(expense.get("amount") or 0) > 0
    ]

    seen = existing_keys(args.database_id, token)
    new_rows = [expense for expense in candidates if (expense["date"], int(expense["amount"])) not in seen]

    for expense in new_rows:
        if args.dry_run:
            print(f"DRY RUN add {expense['date']} {expense['amount']} {expense.get('merchant')}")
            continue
        notion_request("POST", "pages", token, expense_payload(args.database_id, expense))
        time.sleep(0.35)

    print(f"Notion travel expenses: {len(candidates)} candidates, {len(new_rows)} added, {len(candidates) - len(new_rows)} already present")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)
