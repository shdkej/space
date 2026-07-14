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

# git에도 같은 데이터를 남긴다 — Actions의 `s3 sync --delete`가 push 때마다
# git 커밋본으로 S3를 덮으므로, 여기서 커밋하지 않으면 오래된 데이터로 회귀한다.
sync_data_to_git() {
  local repo data_rel="infra-aws-static-sites/sites/travel/dist/travel-data.json"
  repo="$(git -C "$ROOT" rev-parse --show-toplevel)" || return 1
  git -C "$repo" diff --quiet -- "$data_rel" && return 0
  git -C "$repo" add "$data_rel" || return 1
  git -C "$repo" commit -m "chore(travel): travel-data.json $TODAY 동기화" -- "$data_rel" >/dev/null || return 1
  if ! git -C "$repo" push origin master >/dev/null 2>&1; then
    git -C "$repo" pull --rebase --autostash origin master >/dev/null 2>&1 || return 1
    git -C "$repo" push origin master >/dev/null 2>&1 || return 1
  fi
  echo "[$(date -u +%FT%TZ)] Committed travel-data.json to git"
}
sync_data_to_git || echo "[$(date -u +%FT%TZ)] WARN: git sync failed — S3 is fresh but git may lag"

echo "[$(date -u +%FT%TZ)] Updated Travel Ledger for $TODAY"
