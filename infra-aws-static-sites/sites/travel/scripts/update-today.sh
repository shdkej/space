#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
APP_DIR="$ROOT/sites/travel"
TODAY="${1:-$(TZ=Asia/Seoul date +%F)}"
BUCKET="${TRAVEL_S3_BUCKET:-static-travel-aws-shdkej-com}"
DIST_ID="${TRAVEL_CLOUDFRONT_DISTRIBUTION_ID:-E1RZMVOTKJUBLQ}"
OPENCLAW_ENV="${OPENCLAW_ENV:-/home/ubuntu/.config/systemd/user/openclaw-gateway.service.d/override.conf}"

export PATH="/home/ubuntu/.local/bin:/home/ubuntu/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"

load_systemd_env() {
  local key="$1"
  local current="${!key:-}"
  if [[ -n "$current" || ! -r "$OPENCLAW_ENV" ]]; then
    return
  fi

  local value
  value="$(
    sed -nE "s/^Environment=\"${key}=([^\"]*)\"$/\\1/p" "$OPENCLAW_ENV" | tail -n 1
  )"
  if [[ -n "$value" ]]; then
    export "$key=$value"
  fi
}

load_systemd_env GOG_ACCOUNT
load_systemd_env GOG_KEYRING_PASSWORD

echo "[$(date -u +%FT%TZ)] Updating Travel Ledger for $TODAY"

"$APP_DIR/scripts/build-travel-data.py" \
  --date "$TODAY" \
  --merge-existing \
  --output "$APP_DIR/dist/travel-data.json" \
  --state-output "$APP_DIR/data/raw-events-private.json" \
  --geocode-cache "$APP_DIR/data/geocode-cache.json"

aws s3 cp "$APP_DIR/dist/travel-data.json" "s3://$BUCKET/travel-data.json" \
  --cache-control "no-cache, max-age=60"

aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/travel-data.json" >/dev/null

echo "[$(date -u +%FT%TZ)] Updated Travel Ledger for $TODAY"
