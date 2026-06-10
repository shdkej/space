#!/usr/bin/env python3
import argparse
import json
import re
import subprocess
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

CALENDAR_ID = "d4c72556bafa6b2d7dce0b7391b88c2d2279bfba155da4616f59d13b1246eb4c@group.calendar.google.com"
TRIP_START = date(2026, 7, 8)
SCHENGEN_LIMIT = 90
BUDGET_PLANNING_DAYS = 365

ROUTE = [
    {
        "city": "Incheon Airport",
        "country": "South Korea",
        "status": "booked",
        "startDate": "2026-07-07",
        "endDate": "2026-07-08",
        "lodging": "Darakhyu Incheon Airport",
        "source": "official site",
        "amount": 94000,
        "note": "Pre-departure airport stay",
        "schengen": False,
    },
    {
        "city": "Frankfurt",
        "country": "Germany",
        "status": "booked",
        "startDate": "2026-07-08",
        "endDate": "2026-07-09",
        "lodging": "IntercityHotel",
        "source": "HanaTour",
        "amount": 77132,
        "note": "Arrival anchor; 7/9 Frankfurt -> Cologne by DB ICE",
        "transportOut": "2026-07-09 DB ICE: Frankfurt -> Cologne",
        "schengen": True,
        "lat": 50.1109,
        "lng": 8.6821,
    },
    {
        "city": "Cologne",
        "country": "Germany",
        "status": "booked",
        "startDate": "2026-07-09",
        "endDate": "2026-07-11",
        "lodging": "Schiltz Airbnb",
        "source": "7/9 DB ICE from Frankfurt",
        "amount": 330000,
        "note": "Cathedral, city walks; 7/11 Cologne -> Berlin by DB ICE",
        "transportIn": "2026-07-09 DB ICE: Frankfurt -> Cologne",
        "transportOut": "2026-07-11 DB ICE: Cologne -> Berlin",
        "schengen": True,
        "lat": 50.9375,
        "lng": 6.9603,
    },
    {
        "city": "Berlin",
        "country": "Germany",
        "status": "hosted",
        "startDate": "2026-07-11",
        "endDate": "2026-07-14",
        "lodging": "다은언니",
        "source": "7/11 DB ICE from Cologne",
        "note": "Libraries, culture, low-friction base; 7/14 Berlin -> Prague by EC train or FlixBus alt",
        "transportIn": "2026-07-11 DB ICE: Cologne -> Berlin",
        "transportOut": "2026-07-14 EC train: Berlin -> Prague; FlixBus alternative recommended by 다은언니",
        "schengen": True,
        "lat": 52.52,
        "lng": 13.405,
    },
    {
        "city": "Prague",
        "country": "Czechia",
        "status": "booked",
        "startDate": "2026-07-14",
        "endDate": "2026-07-17",
        "lodging": "Central Station Airbnb",
        "source": "7/14 EC train or FlixBus from Berlin",
        "amount": 220000,
        "note": "Old town, cafes, transit hub; 7/17 Prague -> Vienna by RegioJet or OBB",
        "transportIn": "2026-07-14 EC train or FlixBus: Berlin -> Prague",
        "transportOut": "2026-07-17 RegioJet or OBB: Prague -> Vienna",
        "schengen": True,
        "lat": 50.0755,
        "lng": 14.4378,
    },
    {
        "city": "Vienna",
        "country": "Austria",
        "status": "booked",
        "startDate": "2026-07-17",
        "endDate": "2026-07-20",
        "lodging": "Airbnb",
        "source": "7/17 RegioJet or OBB from Prague",
        "amount": 330000,
        "note": "Museums, libraries, slower days; 7/20 Vienna -> Budapest by EuroCity",
        "transportIn": "2026-07-17 RegioJet or OBB: Prague -> Vienna",
        "transportOut": "2026-07-20 EuroCity: Vienna -> Budapest",
        "schengen": True,
        "lat": 48.2082,
        "lng": 16.3738,
    },
    {
        "city": "Budapest",
        "country": "Hungary",
        "status": "booked",
        "startDate": "2026-07-20",
        "endDate": "2026-07-23",
        "lodging": "Airbnb",
        "source": "7/20 EuroCity from Vienna",
        "amount": 300000,
        "note": "Thermal baths, food, Danube; 7/23 Budapest -> Zagreb -> Plitvice by linked FlixBus legs",
        "transportIn": "2026-07-20 EuroCity: Vienna -> Budapest",
        "transportOut": "2026-07-23 FlixBus: Budapest -> Zagreb -> Plitvice",
        "schengen": True,
        "lat": 47.4979,
        "lng": 19.0402,
    },
    {
        "city": "Zagreb",
        "country": "Croatia",
        "status": "transit",
        "startDate": "2026-07-23",
        "endDate": "2026-07-23",
        "source": "7/23 FlixBus transfer checkpoint",
        "note": "Budapest -> Zagreb morning/early leg, then Zagreb -> Plitvice onward bus",
        "transportIn": "2026-07-23 FlixBus: Budapest -> Zagreb",
        "transportOut": "2026-07-23 FlixBus: Zagreb -> Plitvice",
        "schengen": True,
        "lat": 45.815,
        "lng": 15.9819,
    },
    {
        "city": "Plitvice",
        "country": "Croatia",
        "status": "urgent",
        "startDate": "2026-07-23",
        "endDate": "2026-07-24",
        "lodging": "Park entrance B&B / guesthouse",
        "source": "7/23 FlixBus from Zagreb",
        "note": "1 night near national park entrance for early morning entry; book budget B&B or hotel",
        "transportIn": "2026-07-23 FlixBus: Zagreb -> Plitvice",
        "transportOut": "2026-07-24 FlixBus: Plitvice -> Split",
        "schengen": True,
        "lat": 44.8806,
        "lng": 15.6168,
    },
    {
        "city": "Split",
        "country": "Croatia",
        "status": "urgent",
        "startDate": "2026-07-24",
        "endDate": "2026-07-26",
        "lodging": "Split stay TBD",
        "source": "7/24 FlixBus from Plitvice",
        "note": "2 nights; peak season coastal stay, book quickly",
        "transportIn": "2026-07-24 FlixBus: Plitvice -> Split",
        "transportOut": "2026-07-26 Kapetan Luka ferry or bus: Split -> Dubrovnik",
        "schengen": True,
        "lat": 43.5081,
        "lng": 16.4402,
    },
    {
        "city": "Dubrovnik",
        "country": "Croatia",
        "status": "urgent",
        "startDate": "2026-07-26",
        "endDate": "2026-07-28",
        "lodging": "Dubrovnik stay TBD",
        "source": "7/26 ferry or bus from Split",
        "note": "2 nights; reserve peak-season stay and 7/28 Ryanair DBV -> FCO with baggage",
        "transportIn": "2026-07-26 Kapetan Luka ferry or bus: Split -> Dubrovnik",
        "transportOut": "2026-07-28 Ryanair direct: Dubrovnik DBV -> Rome FCO; add baggage",
        "schengen": True,
        "lat": 42.6507,
        "lng": 18.0944,
    },
    {
        "city": "Rome / Naples",
        "country": "Italy",
        "status": "planned",
        "startDate": "2026-07-28",
        "endDate": "2026-08-03",
        "source": "7/28 Ryanair DBV -> FCO",
        "note": "Italy bridge leg; reach Naples for 8/3 overnight ferry to Sicily",
        "transportIn": "2026-07-28 Ryanair direct: Dubrovnik DBV -> Rome FCO; baggage required",
        "transportOut": "2026-08-03 Tirrenia or GNV night ferry cabin: Naples -> Palermo",
        "schengen": True,
        "lat": 41.9028,
        "lng": 12.4964,
    },
    {
        "city": "Palermo / Catania",
        "country": "Italy",
        "status": "planned",
        "startDate": "2026-08-03",
        "endDate": "2026-08-06",
        "source": "8/3 overnight ferry cabin from Naples",
        "note": "Sicily leg; depart Catania CTA to Athens on 8/6",
        "transportIn": "2026-08-03 Tirrenia or GNV night ferry cabin: Naples -> Palermo",
        "transportOut": "2026-08-06 Aegean or Ryanair direct: Catania CTA -> Athens ATH",
        "schengen": True,
        "lat": 38.1157,
        "lng": 13.3615,
    },
    {
        "city": "Athens",
        "country": "Greece",
        "status": "planned",
        "startDate": "2026-08-06",
        "source": "8/6 CTA -> ATH direct flight",
        "note": "Aegean or Ryanair direct from Catania",
        "transportIn": "2026-08-06 Aegean or Ryanair direct: Catania CTA -> Athens ATH",
        "schengen": True,
        "lat": 37.9838,
        "lng": 23.7275,
    },
]

CATEGORY_RULES = [
    ("transport", ["티머니", "지하철", "버스", "택시", "uber", "bolt", "rail", "train", "항공", "flight", "ferry", "db vertrieb", "deutsche bahn", "bahn", "ice"]),
    ("food", ["찌개", "식당", "restaurant", "food", "김밥", "국밥", "맥도날드", "버거", "분식", "고기"]),
    ("cafe", ["카페", "coffee", "커피", "스타벅스", "투썸", "밀크바", "bakery", "베이커리"]),
    ("groceries", ["마트", "이마트", "홈플러스", "편의점", "cu", "gs25", "세븐", "리테일"]),
    ("stay", ["숙소", "hotel", "hostel", "airbnb", "booking", "agoda", "호텔", "호스텔"]),
    ("gear", ["무신사", "쿠팡", "다이소", "올리브영", "전자", "gear"]),
]

TRAVEL_MERCHANT_WORDS = [
    "airbnb",
    "booking",
    "agoda",
    "hotel",
    "hostel",
    "항공",
    "flight",
    "ferry",
    "rail",
    "train",
    "db vertrieb",
    "deutsche bahn",
    "bahn",
    "jadrolinija",
    "ryanair",
    "ita airways",
]

TRAVEL_PAYMENT_OVERRIDES = [
    {
        "date": "2026-05-29",
        "match": "한국정보통신",
        "merchant": "Incheon Airport · Darakhyu",
        "category": "stay",
        "location": "Incheon Airport",
        "note": "Mapped from 한국정보통신/SK네트웍스 payment",
    },
    {
        "date": "2026-05-29",
        "match": "하나투어",
        "merchant": "Frankfurt · IntercityHotel",
        "category": "stay",
        "location": "Frankfurt",
        "note": "Mapped from 하나투어/온라인 payment",
    },
]

GEOCODE_OVERRIDES = {
    "대한민국, 서울특별시, 아차산로58가길 15, 05049": {"lat": 37.5374, "lng": 127.0832},
    "대한민국, 서울특별시, 구의동 590-7, 05049": {"lat": 37.5387, "lng": 127.0861},
    "대한민국, 경기도, 과천시, 별양동 1-21, 13837": {"lat": 37.4286, "lng": 126.9918},
}

PUBLIC_LOCATION_POINTS = {
    "서울특별시": {"lat": 37.5665, "lng": 126.9780},
    "과천시": {"lat": 37.4292, "lng": 126.9876},
    "경기도": {"lat": 37.4138, "lng": 127.5183},
    "대한민국": {"lat": 36.5, "lng": 127.8},
}


def parse_args():
    parser = argparse.ArgumentParser(description="Build Travel Ops JSON from Google Calendar events.")
    parser.add_argument("--calendar-id", default=CALENDAR_ID)
    parser.add_argument("--from", dest="from_date", default=None)
    parser.add_argument("--to", dest="to_date", default=None)
    parser.add_argument("--date", dest="single_date", default=None, help="Read one local day and merge into existing output.")
    parser.add_argument("--merge-existing", action="store_true")
    parser.add_argument("--output", default="sites/travel/dist/travel-data.json")
    parser.add_argument("--state-output", default="sites/travel/data/raw-events-private.json")
    parser.add_argument("--raw-output", default=None)
    parser.add_argument("--geocode-cache", default="sites/travel/data/geocode-cache.json")
    parser.add_argument("--no-geocode", action="store_true")
    return parser.parse_args()


def run_gog(calendar_id, start, end):
    cmd = [
        "gog",
        "calendar",
        "events",
        calendar_id,
        "--from",
        start,
        "--to",
        end,
        "--max",
        "250",
        "--all-pages",
        "--json",
        "--no-input",
    ]
    result = subprocess.run(cmd, check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def parse_dt(value):
    if not value:
        return None
    if "T" not in value:
        return datetime.fromisoformat(value + "T00:00:00+09:00")
    return datetime.fromisoformat(value)


def amount_event(summary):
    return re.match(r"^\s*([0-9,]+)\s*-\s*(.*?)\s*/\s*(.*?)\s*$", summary or "")


def category_for(text):
    lowered = (text or "").lower()
    for category, words in CATEGORY_RULES:
        if any(word.lower() in lowered for word in words):
            return category
    return "other"


def is_travel_expense(merchant, category, location):
    text = f"{merchant or ''} {location or ''}".lower()
    if category in {"stay"}:
        return True
    if any(word in text for word in TRAVEL_MERCHANT_WORDS):
        return True
    if location and "대한민국" not in location:
        return True
    return False


def travel_payment_override(day, merchant):
    lowered = (merchant or "").lower()
    for override in TRAVEL_PAYMENT_OVERRIDES:
        if override["date"] == day and override["match"].lower() in lowered:
            return override
    return None


def clean_location(location):
    if not location:
        return None
    parts = [part.strip() for part in location.splitlines() if part.strip()]
    deduped = []
    for part in parts:
        if not deduped or deduped[-1] != part:
            deduped.append(part)
    return ", ".join(deduped)


def public_location_label(location):
    if not location:
        return None
    parts = [part.strip() for part in location.split(",") if part.strip()]
    if not parts:
        return None
    if parts[0] == "대한민국":
        for part in parts[1:]:
            if part.endswith(("시", "군", "구")):
                return part
        return parts[1] if len(parts) > 1 else "대한민국"
    return ", ".join(parts[:2])


def public_location_point(location, point=None):
    label = public_location_label(location)
    if not label:
        return None
    if label in PUBLIC_LOCATION_POINTS:
        return PUBLIC_LOCATION_POINTS[label]
    return point


def load_geocode_cache(path):
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_geocode_cache(path, cache):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def geocode_location(location, cache, enabled=True):
    if not location:
        return None
    if location in GEOCODE_OVERRIDES:
        return GEOCODE_OVERRIDES[location]
    if location in cache:
        return cache[location]
    if not enabled:
        return None

    query = urllib.parse.urlencode({"q": location, "format": "json", "limit": 1})
    request = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/search?{query}",
        headers={"User-Agent": "travel-atlas/1.0 (personal static dashboard)"},
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            results = json.loads(response.read().decode("utf-8"))
        time.sleep(1)
        if not results:
            cache[location] = None
            return None
        point = {"lat": float(results[0]["lat"]), "lng": float(results[0]["lon"])}
        cache[location] = point
        return point
    except Exception:
        return None


def split_reflection(description):
    if not description:
        return {}
    fields = {}
    current = None
    for raw_line in description.splitlines():
        line = raw_line.strip()
        match = re.match(r"^(원래 의도|실제로 한 일|변경 이유|이어갈 것|버릴 것|의도|첫 손잡이|변경 허용 조건)\s*:\s*(.*)$", line)
        if match:
            current = match.group(1)
            fields[current] = match.group(2).strip()
        elif current and line:
            fields[current] += " " + line
    return fields


def load_existing(path):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def merge_events(existing, fresh_events, start, end):
    if not existing:
        return fresh_events
    fresh_ids = {event.get("id") for event in fresh_events}
    start_dt = parse_dt(start)
    end_dt = parse_dt(end)
    kept = []
    for event in existing.get("rawEvents", []):
        event_dt = parse_dt(event.get("startLocal"))
        if event.get("id") in fresh_ids:
            continue
        if event_dt and start_dt <= event_dt < end_dt:
            continue
        kept.append(event)
    return kept + fresh_events


def schengen_summary(today):
    if today < TRIP_START:
        used = 0
    else:
        used = min(SCHENGEN_LIMIT, (today - TRIP_START).days + 1)
    return {
        "entryDate": TRIP_START.isoformat(),
        "asOf": today.isoformat(),
        "limitDays": SCHENGEN_LIMIT,
        "usedDays": used,
        "remainingDays": max(0, SCHENGEN_LIMIT - used),
        "window": "180 days",
        "status": "pre-trip" if used == 0 else "active",
    }


def build(events, geocode_cache=None, geocode_enabled=True):
    geocode_cache = geocode_cache if geocode_cache is not None else {}
    raw_events = sorted(events, key=lambda event: event.get("startLocal") or "")
    expenses = []
    reflections = []
    sleep_logs = []
    accommodations = []
    locations = Counter()
    daily_total = defaultdict(int)

    for event in raw_events:
        summary = event.get("summary") or ""
        start = event.get("startLocal")
        start_dt = parse_dt(start)
        day = start_dt.date().isoformat() if start_dt else (start or "")[:10]
        location = clean_location(event.get("location"))
        if location:
            locations[location] += 1

        match = amount_event(summary)
        if match:
            amount = int(match.group(1).replace(",", ""))
            merchant = match.group(2).strip()
            override = travel_payment_override(day, merchant)
            display_merchant = override.get("merchant") if override else merchant
            display_location = override.get("location") if override else public_location_label(location)
            category = override.get("category") if override else category_for(merchant)
            travel = True if override else is_travel_expense(merchant, category, location)
            expenses.append({
                "id": event.get("id"),
                "date": day,
                "time": start_dt.strftime("%H:%M") if start_dt else "",
                "amount": amount,
                "merchant": display_merchant,
                "category": category,
                "location": display_location,
                "travel": travel,
            })
            if category == "stay":
                accommodations.append({
                    "name": display_merchant,
                    "city": display_location or "Location pending",
                    "status": "paid",
                    "checkIn": None,
                    "checkOut": None,
                    "amount": amount,
                    "note": override.get("note") if override else "Calendar payment record; add dates later when booking details are logged",
                })
            if travel:
                daily_total[day] += amount
            continue

        if summary.strip().startswith("{"):
            try:
                payload = json.loads(summary)
                sleep_logs.append({
                    "date": day,
                    "sleepHours": float(payload.get("수면", 0) or 0),
                    "recharge": float(payload.get("재충전%", 0) or 0),
                    "balance": payload.get("잔고"),
                })
            except json.JSONDecodeError:
                pass

        fields = split_reflection(event.get("description"))
        if fields:
            reflections.append({
                "id": event.get("id"),
                "date": day,
                "title": summary,
                "intent": fields.get("원래 의도") or fields.get("의도"),
                "did": fields.get("실제로 한 일"),
                "why": fields.get("변경 이유"),
                "carry": fields.get("이어갈 것") or fields.get("첫 손잡이"),
                "drop": fields.get("버릴 것"),
            })

    travel_expenses = [expense for expense in expenses if expense["travel"]]

    category_totals = defaultdict(int)
    travel_category_totals = defaultdict(int)
    for expense in travel_expenses:
        category_totals[expense["category"]] += expense["amount"]
    for expense in travel_expenses:
        travel_category_totals[expense["category"]] += expense["amount"]

    latest_location = next((clean_location(event.get("location")) for event in reversed(raw_events) if event.get("location")), None)
    latest_location = latest_location or "Frankfurt, Germany"
    travel_spend = sum(expense["amount"] for expense in travel_expenses)
    total_spend = travel_spend
    latest_day = raw_events[-1].get("startLocal", "")[:10] if raw_events else date.today().isoformat()
    today = date.fromisoformat(latest_day)
    travel_dates = [date.fromisoformat(expense["date"]) for expense in travel_expenses if expense.get("date")]
    first_travel_date = min(travel_dates).isoformat() if travel_dates else None
    days_since_first_travel_expense = ((today - min(travel_dates)).days + 1) if travel_dates else 0
    reserve_burn = round(travel_spend / days_since_first_travel_expense) if days_since_first_travel_expense else 0
    places = []
    public_locations = Counter()
    original_by_label = {}
    for name, count in locations.items():
        label = public_location_label(name) or name
        public_locations[label] += count
        original_by_label.setdefault(label, name)
    for label, count in public_locations.most_common(20):
        original = original_by_label.get(label, label)
        point = geocode_location(original, geocode_cache, enabled=geocode_enabled)
        public_point = public_location_point(original, point)
        item = {"name": label, "count": count}
        if public_point:
            item.update(public_point)
        places.append(item)

    planned_stays = [
        {
            "name": stop.get("lodging") or f"{stop['city']} stay",
            "city": stop["city"],
            "country": stop["country"],
            "status": stop.get("status", "planned"),
            "checkIn": stop.get("startDate"),
            "checkOut": stop.get("endDate"),
            "amount": stop.get("amount"),
            "source": stop.get("source"),
            "note": stop.get("note"),
        }
        for stop in ROUTE
        if stop.get("lodging")
    ]
    booked_costs = [
        {
            "id": f"manual-stay-{stop['city'].lower().replace(' ', '-')}",
            "date": stop.get("startDate"),
            "time": "",
            "amount": stop.get("amount"),
            "merchant": f"{stop['city']} · {stop.get('lodging')}",
            "category": "stay",
            "location": stop["city"],
            "travel": True,
            "source": stop.get("source"),
        }
        for stop in ROUTE
        if stop.get("amount")
    ]

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "calendar": {"id": CALENDAR_ID, "name": "회고"},
        "launch": "2026-07-08",
        "budget": {
            "targetMinKrw": 30000000,
            "targetMaxKrw": 40000000,
            "loggedKrw": total_spend,
            "travelLoggedKrw": travel_spend,
            "remainingMinKrw": max(0, 30000000 - travel_spend),
            "remainingMaxKrw": max(0, 40000000 - travel_spend),
            "reservedPctMin": round((travel_spend / 30000000) * 100, 1),
            "dailyBudgetMinKrw": round(30000000 / BUDGET_PLANNING_DAYS),
            "dailyBudgetMaxKrw": round(40000000 / BUDGET_PLANNING_DAYS),
            "reserveBurnKrw": reserve_burn,
            "firstTravelExpenseDate": first_travel_date,
            "planningDays": BUDGET_PLANNING_DAYS,
            "mode": "travel",
        },
        "current": {
            "date": latest_day,
            "location": public_location_label(latest_location) or latest_location,
            "mapQuery": public_location_label(latest_location) or latest_location,
        },
        "categoryTotals": dict(sorted(category_totals.items(), key=lambda item: item[1], reverse=True)),
        "travelCategoryTotals": dict(sorted(travel_category_totals.items(), key=lambda item: item[1], reverse=True)),
        "dailyTotals": [{"date": day, "amount": amount} for day, amount in sorted(daily_total.items())],
        "bookedCosts": booked_costs,
        "travelExpenses": sorted(travel_expenses, key=lambda item: (item["date"], item["time"]), reverse=True),
        "expenses": sorted(travel_expenses, key=lambda item: (item["date"], item["time"]), reverse=True),
        "locations": places,
        "map": {
            "points": [place for place in places if place.get("lat") and place.get("lng")],
            "routePoints": [{"name": f"{stop['city']}, {stop['country']}", "lat": stop["lat"], "lng": stop["lng"]} for stop in ROUTE if stop.get("lat") and stop.get("lng")],
        },
        "accommodations": accommodations or [
            {
                "name": "숙소 데이터 대기",
                "city": "첫 도시 확정 후",
                "status": "empty",
                "checkIn": None,
                "checkOut": None,
                "note": "회고 캘린더에 숙소/호텔/Airbnb/Booking 키워드가 들어오면 자동 분류 가능",
            }
        ],
        "plannedAccommodations": planned_stays,
        "route": ROUTE,
        "schengen": schengen_summary(today),
        "sleep": sleep_logs[-14:],
        "reflections": reflections[-12:],
    }


def main():
    args = parse_args()
    today = date.today()
    if args.single_date:
        start_day = date.fromisoformat(args.single_date)
        end_day = start_day + timedelta(days=1)
    else:
        start_day = date.fromisoformat(args.from_date) if args.from_date else today - timedelta(days=30)
        end_day = date.fromisoformat(args.to_date) if args.to_date else today + timedelta(days=2)

    start = start_day.isoformat()
    end = end_day.isoformat()
    payload = run_gog(args.calendar_id, start, end)
    fresh_events = payload.get("events", [])

    output = Path(args.output)
    state_output = Path(args.state_output)
    existing = load_existing(state_output) if args.merge_existing and state_output.exists() else (load_existing(output) if args.merge_existing else None)
    events = merge_events(existing, fresh_events, start, end)
    geocode_cache_path = Path(args.geocode_cache)
    geocode_cache = load_geocode_cache(geocode_cache_path)
    data = build(events, geocode_cache=geocode_cache, geocode_enabled=not args.no_geocode)

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    state_output.parent.mkdir(parents=True, exist_ok=True)
    state_output.write_text(json.dumps({"rawEvents": events}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    save_geocode_cache(geocode_cache_path, geocode_cache)

    if args.raw_output:
        raw_path = Path(args.raw_output)
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        raw_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
