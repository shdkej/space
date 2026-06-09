#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
APP_DIR="$ROOT/sites/travel"
TODAY="${1:-$(TZ=Asia/Seoul date +%F)}"

"$APP_DIR/scripts/build-travel-data.py" \
  --date "$TODAY" \
  --merge-existing \
  --output "$APP_DIR/dist/travel-data.json"

echo "Updated Travel Ledger for $TODAY"
