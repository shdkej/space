#!/usr/bin/env bash
set -euo pipefail

# Run only on the OpenClaw Gateway where MAPBOX_API_KEY is injected from the
# protected store. This intentionally produces a browser-readable *public*
# token file for the domain-restricted Mapbox GL client; it is never tracked.
: "${MAPBOX_API_KEY:?protected Mapbox public-token injection is required}"
target="$(dirname "$0")/../sites/safety-map/dist/runtime-map-config.js"
umask 077
printf 'window.__SAFETY_MAP_CONFIG__={accessToken:%q,allowedOrigin:%q};\n' \
  "$MAPBOX_API_KEY" 'https://safety-map.aws.shdkej.com' > "$target"
