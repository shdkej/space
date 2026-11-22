#!/usr/bin/env python3
"""Snapshot the official central-agency chart for the policy atlas.

Manual run only: review source/list changes before publishing. The government
chart also lists commissions; this atlas intentionally shows 부·처·청 only.
"""
import json
import re
from collections import Counter
from datetime import datetime
from html import unescape
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://www.org.go.kr/cop/bbs/getInstiChartList.do'
PATTERN = re.compile(r'<a href="javascript:openDetail\(\'중앙행정기관\',\'([0-9]+)\',\'([0-9]+)\'\)" title="([^\"]+) 상세페이지 이동"')
rows = []
for page in range(1, 6):
    with urlopen(f'{SOURCE}?pageIndex={page}', timeout=20) as response:
        html = response.read().decode('utf-8')
    found = PATTERN.findall(html)
    if not found:
        raise RuntimeError(f'Official list page {page} had no matched institutions')
    rows.extend(found)
if len(rows) != 49 or len({org_code for org_code, _, _ in rows}) != 49:
    raise RuntimeError(f'Official registry changed: expected 49 unique entries; found {len(rows)}')

institutions = []
for org_code, chart_id, raw_name in rows:
    name = unescape(raw_name)
    kind = name[-1]
    if kind not in ('부', '처', '청'):
        continue  # 6 commissions are outside the clarified user scope.
    query = urlencode({'codeNum': '중앙행정기관', 'orgCode': org_code, 'chartId': chart_id})
    institutions.append({'id': org_code, 'name': name, 'kind': kind,
                         'url': f'https://www.org.go.kr/cop/bbs/getInstiChartDetail.do?{query}'})
# The registry chart still lists 대검찰청 although the official agency websites
# now identify the replacement agencies. Fail if the chart changes, so this
# human-reviewed correction cannot silently overwrite a newer official list.
names = {i['name'] for i in institutions}
if '대검찰청' not in names or {'공소청', '중대범죄수사청'} & names:
    raise RuntimeError('Agency transition changed in the official chart; review replacement logic')
institutions = [i for i in institutions if i['name'] != '대검찰청']
institutions.extend([
    {'id': 'official:spo', 'name': '공소청', 'kind': '청', 'linkKind': 'official-site',
     'url': 'https://www.spo.go.kr/site/spo/main.do'},
    {'id': 'official:sci', 'name': '중대범죄수사청', 'kind': '청', 'linkKind': 'official-site',
     'url': 'https://www.sci.go.kr/main.do'},
])
counts = Counter(item['kind'] for item in institutions)
if counts != {'부': 19, '처': 6, '청': 19}:
    raise RuntimeError(f'Agency taxonomy changed; review manually: {counts}')

payload = {'checkedAt': datetime.now(ZoneInfo('Asia/Seoul')).strftime('%Y-%m-%d'),
           'source': SOURCE, 'sourceEntries': len(rows),
           'excludedCommissions': 6,
           'registryCorrection': 'Legacy 대검찰청 removed; 공소청 and 중대범죄수사청 linked to their official sites.',
           'institutions': institutions}
(ROOT / 'dist' / 'institutions.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
(ROOT / 'dist' / 'institutions.js').write_text('const INSTITUTION_SNAPSHOT = '+json.dumps(payload, ensure_ascii=False, separators=(',', ':'))+';\n', encoding='utf-8')
print(f"Official snapshot: {len(institutions)} central agencies, {dict(counts)}, 6 commissions excluded; legacy correction applied")
