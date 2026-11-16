#!/usr/bin/env python3
"""Check every official institution link and record bounded source evidence."""
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

root = Path(__file__).resolve().parents[1]
snapshot = json.loads((root / 'dist' / 'institutions.json').read_text(encoding='utf-8'))

def verify(item):
    try:
        with urlopen(Request(item['url'], headers={'User-Agent': 'Mozilla/5.0'}), timeout=20) as response:
            body = response.read(250_000).decode('utf-8', 'replace')
            return {'id': item['id'], 'name': item['name'], 'status': response.status,
                    'nameInPage': item['name'] in body, 'finalUrl': response.url}
    except Exception as exc:
        return {'id': item['id'], 'name': item['name'], 'status': None,
                'nameInPage': False, 'error': type(exc).__name__}

with ThreadPoolExecutor(max_workers=5) as executor:
    checks = list(executor.map(verify, snapshot['institutions']))
passed = len(checks) == 44 and all(c['status'] == 200 and c['nameInPage'] for c in checks)
result = {'verifiedAt': datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),
          'snapshotCheckedAt': snapshot['checkedAt'], 'status': 'passed' if passed else 'failed',
          'checks': checks}
(root / 'qa' / 'institution-links.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f"Institution links: {sum(c['status'] == 200 for c in checks)}/{len(checks)} HTTP 200, "
      f"{sum(c['nameInPage'] for c in checks)}/{len(checks)} name matches")
if not passed:
    raise SystemExit(1)
