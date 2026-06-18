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
SCHENGEN_RULE_SOURCE = "https://home-affairs.ec.europa.eu/policies/schengen/border-crossing/short-stay-calculator_en"

ROUTE = [
    {
        "city": "Incheon Airport",
        "country": "South Korea",
        "status": "booked",
        "startDate": "2026-07-07",
        "endDate": "2026-07-08",
        "lodging": "Darakhyu Incheon Airport",
        "source": "official site",
        "note": "Pre-departure airport stay",
        "arrivalTransfer": {
            "title": "인천공항 T1 -> 다락휴",
            "route": "제1여객터미널 일반구역 -> 교통센터 1층 다락휴",
            "duration": "공항 내부 도보 이동",
            "statusNote": "다락휴 T1은 출국장 안이 아니라 일반구역 교통센터 1층에 있음.",
            "nextCheck": "전날 체크인 시간과 다음날 항공편 터미널 동선을 한 번 더 맞춘다.",
            "steps": [
                "제1여객터미널에서 교통센터 표지를 따라 이동한다.",
                "다락휴는 교통센터 1층 일반구역에 있으므로 보안검색 전 접근 가능하다.",
            ],
            "sourceName": "다락휴 공식 위치 안내",
            "sourceUrl": "https://www.walkerhill.com/darakhyu/t1/en/about/Map.jsp",
        },
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
        "note": "Arrival anchor; 7/9 Frankfurt -> Cologne by DB ICE",
        "transportOut": "2026-07-09 DB ICE: 프랑크푸르트 -> 쾰른",
        "arrivalTransfer": {
            "title": "프랑크푸르트 공항 -> IntercityHotel",
            "route": "Frankfurt Airport Regional Station -> Frankfurt Hbf -> IntercityHotel Hauptbahnhof Sud",
            "duration": "S-Bahn 약 12분 + 중앙역 남쪽 도보",
            "statusNote": "공항 Regional Station에서 S8/S9로 Frankfurt Hbf까지 이동 가능.",
            "nextCheck": "도착 항공편 시간 기준으로 S-Bahn 막차/지연 시 택시 대안을 같이 본다.",
            "steps": [
                "공항 Regional Station에서 S8 또는 S9를 타고 Frankfurt Hauptbahnhof로 간다.",
                "Frankfurt Hbf에서 내려 중앙역 남쪽 출구 방향으로 호텔까지 짧게 걷는다.",
            ],
            "sourceName": "DB / Frankfurt Airport / H Rewards",
            "sourceUrl": "https://www.bahnhof.de/en/frankfurt-main-hbf/journey-to-frankfurt-airport",
        },
        "transportOutPayment": {
            "status": "paid",
            "amount": 71351,
            "paidDate": "2026-06-09",
            "merchant": "DB Vertrieb GmbH",
            "note": "Actual rail payment logged in the travel ledger.",
        },
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
        "transportIn": "2026-07-09 DB ICE: 프랑크푸르트 -> 쾰른",
        "transportOut": "2026-07-11 DB ICE: 쾰른 -> 베를린",
        "arrivalTransfer": {
            "title": "프랑크푸르트 -> 쾰른",
            "route": "Frankfurt Main Hbf -> Koeln Hbf",
            "duration": "DB ICE 약 1시간대 구간, 실제 예매편 기준 재확인 필요",
            "statusNote": "2026-06-09 DB 결제 71,351원은 프랑크푸르트 -> 쾰른 철도 이동으로 기록됨.",
            "nextCheck": "DB 앱/메일에서 열차번호, 좌석, 출발역을 확정해 상세에 붙인다.",
            "steps": [
                "Frankfurt Main Hbf에서 DB ICE 탑승.",
                "Koeln Hbf 도착 후 숙소 체크인 동선을 별도 확인한다.",
            ],
            "sourceName": "DB 결제 기록 / 여행 원장",
            "sourceUrl": "https://int.bahn.de/en",
        },
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
        "transportIn": "2026-07-11 DB ICE: 쾰른 -> 베를린",
        "transportOut": "2026-07-14 EC 열차 또는 FlixBus: 베를린 -> 프라하",
        "arrivalTransfer": {
            "title": "쾰른 -> 베를린",
            "route": "Koeln Hbf -> Berlin Hbf",
            "duration": "직행 열차 약 4시간 50분 전후",
            "statusNote": "2026-06-13 DB 결제 113,702원은 쾰른 -> 베를린 철도 이동으로 보정됨.",
            "nextCheck": "DB 앱/메일에서 7/11 실제 열차번호, 좌석, 도착 시간을 확정해 붙인다.",
            "steps": [
                "Koeln Hbf에서 Berlin Hbf행 장거리 열차를 탄다.",
                "Berlin Hbf 도착 후 S-Bahn/U-Bahn 또는 택시로 숙소/만남 장소 이동.",
            ],
            "sourceName": "DB 결제 기록 / 여행 원장",
            "sourceUrl": "https://www.omio.com/trains/cologne/berlin",
        },
        "transportInPayment": {
            "status": "paid",
            "amount": 113702,
            "paidDate": "2026-06-13",
            "merchant": "DB Vertrieb GmbH",
            "note": "User corrected this DB payment as Cologne -> Berlin.",
        },
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
        "transportIn": "2026-07-14 EC 열차 또는 FlixBus: 베를린 -> 프라하",
        "transportOut": "2026-07-17 RegioJet 또는 OBB: 프라하 -> 빈",
        "arrivalTransfer": {
            "title": "베를린 -> 프라하",
            "route": "Berlin Hbf -> Praha hl.n.",
            "duration": "직행 열차 약 4시간 20분",
            "statusNote": "2026-06-13 DB 결제 85,261원은 베를린 -> 프라하 철도 이동으로 보정됨.",
            "nextCheck": "DB 앱/메일에서 7/14 실제 열차번호, 좌석, 출발역을 확정해 붙인다.",
            "steps": [
                "Berlin Hbf에서 Praha hl.n.행 직행 열차를 우선 후보로 본다.",
                "가격이나 시간대가 나쁘면 FlixBus 대안을 비교한다.",
            ],
            "sourceName": "DB 결제 기록 / 여행 원장",
            "sourceUrl": "https://int.bahn.de/en/destinations/berlin/prague",
        },
        "transportInPayment": {
            "status": "paid",
            "amount": 85261,
            "paidDate": "2026-06-13",
            "merchant": "DB Vertrieb GmbH",
            "note": "User corrected this DB payment as Berlin -> Prague.",
        },
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
        "transportIn": "2026-07-17 RegioJet 또는 OBB: 프라하 -> 빈",
        "transportOut": "2026-07-20 Railjet 또는 EuroCity: 빈 -> 부다페스트",
        "arrivalTransfer": {
            "title": "프라하 -> 빈",
            "route": "Praha hl.n. -> Wien Hbf",
            "duration": "RegioJet/철도 약 3시간 56분 전후",
            "statusNote": "RegioJet/Rail Europe 기준 프라하-빈 철도 구간은 약 4시간으로 잡을 수 있음.",
            "nextCheck": "RegioJet과 OBB 가격, 수하물/좌석 조건을 비교해 예매 후보를 고른다.",
            "steps": [
                "Praha hl.n.에서 Wien Hbf행 직행 열차를 우선 확인한다.",
                "도착 후 Wien Hbf 기준 숙소 이동 수단을 붙인다.",
            ],
            "sourceName": "Rail Europe RegioJet route reference",
            "sourceUrl": "https://www.raileurope.com/en-us/trains/regiojet",
        },
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
        "transportIn": "2026-07-20 Railjet 또는 EuroCity: 빈 -> 부다페스트",
        "transportOut": "2026-07-23 FlixBus: 부다페스트 -> 자그레브 -> 플리트비체",
        "arrivalTransfer": {
            "title": "빈 -> 부다페스트",
            "route": "Wien Hbf -> Budapest Keleti",
            "duration": "Railjet/EuroCity 약 2시간 24분-2시간 55분",
            "statusNote": "OBB는 빈과 부다페스트 사이 Railjet/EuroCity가 정기 운행된다고 안내.",
            "nextCheck": "Budapest Keleti 도착 기준 숙소 위치와 야간 이동 여부를 함께 본다.",
            "steps": [
                "Wien Hbf에서 Budapest Keleti행 Railjet 또는 EuroCity 탑승.",
                "Budapest Keleti 도착 후 지하철/택시로 숙소 이동.",
            ],
            "sourceName": "OBB Hungary / Austrian Railways",
            "sourceUrl": "https://www.oebb.at/en/tickets-kundenkarten/oesterreich-europa/sparschiene/sparschiene-europa/ungarn",
        },
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
        "transportIn": "2026-07-23 FlixBus: 부다페스트 -> 자그레브",
        "transportOut": "2026-07-23 FlixBus: 자그레브 -> 플리트비체",
        "arrivalTransfer": {
            "title": "부다페스트 -> 자그레브",
            "route": "Budapest bus station -> Zagreb bus station",
            "duration": "FlixBus 최단 약 4시간 15분",
            "statusNote": "부다페스트-자그레브 버스 구간은 FlixBus 기준 약 4시간대.",
            "nextCheck": "같은 날 자그레브->플리트비체 환승 시간이 충분한지 먼저 본다.",
            "steps": [
                "부다페스트에서 자그레브행 FlixBus 탑승.",
                "자그레브 버스 터미널에서 플리트비체행 버스로 환승.",
            ],
            "sourceName": "FlixBus Budapest-Zagreb",
            "sourceUrl": "https://www.flixbus.com/bus-routes/bus-budapest-zagreb",
        },
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
        "transportIn": "2026-07-23 FlixBus: 자그레브 -> 플리트비체",
        "transportOut": "2026-07-24 FlixBus 또는 버스: 플리트비체 -> 스플리트",
        "arrivalTransfer": {
            "title": "자그레브 -> 플리트비체",
            "route": "Zagreb bus station -> Plitvice Lakes",
            "duration": "FlixBus 최단 약 1시간 50분",
            "statusNote": "자그레브-플리트비체 버스는 FlixBus 기준 약 1시간 50분.",
            "nextCheck": "플리트비체 하차 지점이 Entrance 1/2 중 어디인지 숙소 위치와 맞춘다.",
            "steps": [
                "자그레브에서 Plitvice Lakes행 버스를 탄다.",
                "도착 후 숙소가 입구에서 도보/셔틀 가능한지 확인한다.",
            ],
            "sourceName": "FlixBus Zagreb-Plitvice",
            "sourceUrl": "https://www.flixbus.com/bus-routes/bus-zagreb-plitvice-lakes-plitvicka-jezera",
        },
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
        "transportIn": "2026-07-24 FlixBus 또는 버스: 플리트비체 -> 스플리트",
        "transportOut": "2026-07-26 Kapetan Luka 또는 TP Line 페리: 스플리트 -> 두브로브니크",
        "arrivalTransfer": {
            "title": "플리트비체 -> 스플리트",
            "route": "Plitvice Lakes -> Split",
            "duration": "직행/환승 버스 시간표 확인 필요",
            "statusNote": "FlixBus는 Plitvice Lakes에서 Split을 도달 가능 목적지로 표시함.",
            "nextCheck": "7/24 실제 직행 여부, 자그레브/자다르 환승 여부, 숙소 체크인 가능 시간을 함께 본다.",
            "steps": [
                "Plitvice Lakes 출발 버스 시간표에서 Split 도착편을 확인한다.",
                "직행이 없거나 시간이 나쁘면 Zagreb/Zadar 환승안을 비교한다.",
            ],
            "sourceName": "FlixBus Plitvice destination list",
            "sourceUrl": "https://www.flixbus.com/bus/plitvice-lakes-plitvicka-jezera",
        },
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
        "transportIn": "2026-07-26 Kapetan Luka 또는 TP Line 페리: 스플리트 -> 두브로브니크",
        "transportOut": "2026-07-28 Ryanair 직항: 두브로브니크 DBV -> 로마 FCO, 수하물 추가 필요",
        "arrivalTransfer": {
            "title": "스플리트 -> 두브로브니크",
            "route": "Split ferry port -> Dubrovnik ferry port",
            "duration": "고속선 약 4시간 30분-5시간 10분",
            "statusNote": "Split-Dubrovnik 페리는 4-10월 매일 운항 후보가 있고 Kapetan Luka-Krilo/TP Line이 주요 후보.",
            "nextCheck": "7/26 운항편, 바람/결항 리스크, 숙소까지 항구 이동을 같이 본다.",
            "steps": [
                "Split 항구에서 Dubrovnik행 고속선 탑승.",
                "Dubrovnik 항구 도착 후 숙소 위치에 따라 버스/택시 이동.",
            ],
            "sourceName": "Ferryhopper Split-Dubrovnik",
            "sourceUrl": "https://www.ferryhopper.com/en/ferry-routes/direct/split-dubrovnik",
        },
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
        "transportIn": "2026-07-28 Ryanair 직항: 두브로브니크 DBV -> 로마 FCO, 수하물 필요",
        "transportOut": "2026-08-03 Tirrenia 또는 GNV 야간페리: 나폴리 -> 팔레르모",
        "arrivalTransfer": {
            "title": "두브로브니크 -> 로마 / 나폴리",
            "route": "Dubrovnik DBV -> Rome FCO -> Napoli Centrale",
            "duration": "DBV-FCO 직항 약 1시간 20분 + 공항-나폴리 철도 약 3시간대",
            "statusNote": "DBV-FCO 직항은 약 1시간 20분, Fiumicino-나폴리 철도는 약 3시간대 후보.",
            "nextCheck": "Ryanair 수하물 포함가, FCO 도착 후 당일 나폴리 이동 여부를 확정한다.",
            "steps": [
                "Dubrovnik 공항에서 Rome Fiumicino행 직항 탑승.",
                "FCO 도착 후 Roma Termini 환승 또는 직행편으로 Napoli Centrale 이동.",
            ],
            "sourceName": "Skyscanner / ItaliaRail",
            "sourceUrl": "https://www.skyscanner.com/routes/dbv/fco/dubrovnik-to-rome-fiumicino.html",
        },
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
        "transportIn": "2026-08-03 Tirrenia 또는 GNV 야간페리: 나폴리 -> 팔레르모",
        "transportOut": "2026-08-06 Aegean 또는 Ryanair 직항: 카타니아 CTA -> 아테네 ATH",
        "arrivalTransfer": {
            "title": "나폴리 -> 팔레르모 / 카타니아",
            "route": "Naples port -> Palermo port -> Catania",
            "duration": "야간페리 약 8시간 30분-12시간, 팔레르모-카타니아 이동 별도",
            "statusNote": "나폴리-팔레르모 페리는 Tirrenia/GNV/Grimaldi 후보가 있고 야간 이동 가능.",
            "nextCheck": "선실 포함가, 도착항-카타니아 이동, 8/6 항공편과의 여유 시간을 확인한다.",
            "steps": [
                "Naples 항구에서 Palermo행 야간페리 탑승.",
                "Palermo 도착 후 Catania 이동편을 별도로 연결한다.",
            ],
            "sourceName": "Tirrenia / Ferryhopper",
            "sourceUrl": "https://en.tirrenia.it/ferry-sicily/naples-palermo/",
        },
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
        "transportIn": "2026-08-06 Aegean 또는 Ryanair 직항: 카타니아 CTA -> 아테네 ATH",
        "arrivalTransfer": {
            "title": "카타니아 -> 아테네",
            "route": "Catania CTA -> Athens ATH",
            "duration": "직항 약 1시간 35분",
            "statusNote": "Catania-Athens 직항은 Aegean/Ryanair 후보가 있고 약 1시간 35분으로 잡힘.",
            "nextCheck": "8/6 실제 운항 요일, 수하물 포함가, 아테네 도착 후 숙소 이동을 확정한다.",
            "steps": [
                "Catania Fontanarossa 공항에서 Athens행 직항 탑승.",
                "Athens ATH 도착 후 시내/숙소 이동 수단을 붙인다.",
            ],
            "sourceName": "FlightsFrom / FlightConnections",
            "sourceUrl": "https://www.flightsfrom.com/CTA-ATH",
        },
        "schengen": True,
        "lat": 37.9838,
        "lng": 23.7275,
    },
]

SCHENGEN_PROJECTION_SEGMENTS = [
    {
        "label": "1차 쉥겐",
        "startDate": "2026-07-08",
        "endDate": "2026-07-29",
        "schengen": True,
        "countries": ["Germany", "Czechia", "Austria", "Hungary", "Croatia"],
        "note": "크로아티아 포함. 출입국일을 모두 체류일로 보는 보수 계산.",
    },
    {
        "label": "터키·이집트 브레이크",
        "startDate": "2026-07-29",
        "endDate": "2026-09-01",
        "schengen": False,
        "countries": ["Turkey", "Egypt"],
        "note": "쉥겐 카운트 정지 구간.",
    },
    {
        "label": "2차 쉥겐",
        "startDate": "2026-09-01",
        "endDate": "2026-10-23",
        "schengen": True,
        "countries": ["Italy", "Switzerland", "Spain", "France"],
        "excludedDays": 5,
        "excludedLabel": "Morocco side trip",
        "note": "모로코 4박 5일은 비쉥겐으로 제외.",
    },
    {
        "label": "런던 브레이크",
        "startDate": "2026-10-23",
        "endDate": "2026-10-27",
        "schengen": False,
        "countries": ["United Kingdom"],
        "note": "파리 이후 영국 체류로 쉥겐 카운트 정지.",
    },
    {
        "label": "3차 쉥겐",
        "startDate": "2026-10-27",
        "endDate": "2026-11-02",
        "schengen": True,
        "countries": ["Denmark", "Iceland"],
        "note": "레이캬비크 출국일까지 보수적으로 포함.",
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

MANUAL_TRAVEL_EXPENSES = [
    {
        "id": "manual-shopping-2026-05-10-travel-prep",
        "date": "2026-05-10",
        "time": "",
        "amount": 70200,
        "merchant": "Travel prep · 손톱깎이/수건/빨랫줄",
        "category": "gear",
        "location": "여행 준비",
        "travel": True,
        "source": "telegram:433493318/message/10729",
    },
    {
        "id": "manual-shopping-2026-05-10-coupang",
        "date": "2026-05-10",
        "time": "",
        "amount": 24100,
        "merchant": "쿠팡 · 여행 준비",
        "category": "gear",
        "location": "여행 준비",
        "travel": True,
        "source": "telegram:433493318/message/10729",
    },
    {
        "id": "manual-shopping-2026-05-19-coupang",
        "date": "2026-05-19",
        "time": "",
        "amount": 45190,
        "merchant": "쿠팡 · 여행 준비",
        "category": "gear",
        "location": "여행 준비",
        "travel": True,
        "source": "telegram:433493318/message/10729",
    },
    {
        "id": "manual-shopping-2026-05-27-nua-clothes",
        "date": "2026-05-27",
        "time": "",
        "amount": 442940,
        "merchant": "누아옷",
        "category": "gear",
        "location": "여행 준비",
        "travel": True,
        "source": "telegram:433493318/message/10729",
    },
    {
        "id": "manual-shopping-2026-05-30-muji",
        "date": "2026-05-30",
        "time": "",
        "amount": 28400,
        "merchant": "무인양품",
        "category": "gear",
        "location": "여행 준비",
        "travel": True,
        "source": "telegram:433493318/message/10729",
    },
    {
        "id": "manual-shopping-2026-06-07-international-license",
        "date": "2026-06-07",
        "time": "",
        "amount": 25600,
        "merchant": "국제면허증 2건",
        "category": "gear",
        "location": "여행 준비",
        "travel": True,
        "source": "telegram:433493318/message/10729",
    },
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
    {
        "date": "2026-06-13",
        "match": "DB Vertrieb GmbH",
        "amount": 113702,
        "merchant": "DB · Cologne → Berlin",
        "category": "transport",
        "location": "Cologne → Berlin",
        "note": "User corrected this payment as Cologne -> Berlin.",
    },
    {
        "date": "2026-06-13",
        "match": "DB Vertrieb GmbH",
        "amount": 85261,
        "merchant": "DB · Berlin → Prague",
        "category": "transport",
        "location": "Berlin → Prague",
        "note": "User corrected this payment as Berlin -> Prague.",
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


def travel_payment_override(day, merchant, amount=None):
    lowered = (merchant or "").lower()
    for override in TRAVEL_PAYMENT_OVERRIDES:
        if override["date"] != day or override["match"].lower() not in lowered:
            continue
        if "amount" in override and amount != override["amount"]:
            continue
        if override["date"] == day and override["match"].lower() in lowered:
            return override
    return None


def normalize_match_text(value):
    return re.sub(r"[^0-9a-z가-힣]+", "", (value or "").lower())


def mapped_amount_for_stop(stop, travel_expenses):
    if stop.get("amount"):
        return stop.get("amount")
    if not stop.get("lodging"):
        return None

    city_key = normalize_match_text(stop.get("city"))
    lodging_key = normalize_match_text(stop.get("lodging"))
    for expense in travel_expenses:
        if expense.get("category") != "stay":
            continue
        merchant_key = normalize_match_text(expense.get("merchant"))
        location_key = normalize_match_text(expense.get("location"))
        if city_key and city_key in location_key:
            return expense.get("amount")
        if lodging_key and lodging_key in merchant_key:
            return expense.get("amount")
    return None


def route_with_mapped_amounts(travel_expenses):
    route = []
    for stop in ROUTE:
        item = dict(stop)
        journey_payment = item.get("transportInPayment") or item.get("transportOutPayment")
        if journey_payment and journey_payment.get("amount"):
            item["journeyAmount"] = journey_payment.get("amount")
            item["journeyPayment"] = journey_payment
        mapped_amount = mapped_amount_for_stop(item, travel_expenses)
        if mapped_amount:
            item["amount"] = mapped_amount
        route.append(item)
    return route


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


def inclusive_days(start_iso, end_iso):
    start = date.fromisoformat(start_iso)
    end = date.fromisoformat(end_iso)
    return max(0, (end - start).days + 1)


def schengen_projection():
    segments = []
    total = 0
    for segment in SCHENGEN_PROJECTION_SEGMENTS:
        if segment.get("schengen"):
            calendar_days = inclusive_days(segment["startDate"], segment["endDate"])
        else:
            calendar_days = max(0, (date.fromisoformat(segment["endDate"]) - date.fromisoformat(segment["startDate"])).days)
        excluded = int(segment.get("excludedDays") or 0)
        schengen_days = max(0, calendar_days - excluded) if segment.get("schengen") else 0
        total += schengen_days
        segments.append({
            **segment,
            "calendarDays": calendar_days,
            "schengenDays": schengen_days,
        })
    return {
        "label": "예상 전체 일정",
        "rule": "90 days in any rolling 180-day period; entry and exit days are counted.",
        "source": SCHENGEN_RULE_SOURCE,
        "limitDays": SCHENGEN_LIMIT,
        "projectedUsedDays": total,
        "projectedRemainingDays": max(0, SCHENGEN_LIMIT - total),
        "riskBand": "comfortable" if total <= 80 else "tight" if total <= SCHENGEN_LIMIT else "over",
        "segments": segments,
        "note": "EU 90/180 rolling 기준(입국일·출국일 포함) 추정치. 실제 입출국일/항공권 확정 시 재계산한다.",
    }


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
        "projection": schengen_projection(),
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
            override = travel_payment_override(day, merchant, amount)
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

    expenses.extend(dict(expense) for expense in MANUAL_TRAVEL_EXPENSES)
    travel_expenses = [expense for expense in expenses if expense["travel"]]
    route = route_with_mapped_amounts(travel_expenses)

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
        for stop in route
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
        for stop in route
        if stop.get("amount")
    ] + [dict(expense) for expense in MANUAL_TRAVEL_EXPENSES]

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
            "routePoints": [{"name": f"{stop['city']}, {stop['country']}", "lat": stop["lat"], "lng": stop["lng"]} for stop in route if stop.get("lat") and stop.get("lng")],
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
        "route": route,
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
