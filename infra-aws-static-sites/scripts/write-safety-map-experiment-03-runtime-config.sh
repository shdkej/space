#!/usr/bin/env bash
set -euo pipefail

# This runs only on the protected Gateway host. MAPBOX_API_KEY is injected by
# the host and is never written to tracked files, logs, or command output.
: "${MAPBOX_API_KEY:?protected Mapbox public-token injection is required}"
case "$MAPBOX_API_KEY" in
  pk.*) ;;
  *) echo "protected Mapbox value is not a public client token" >&2; exit 1 ;;
esac

target="$(dirname "$0")/../sites/safety-map-experiment-03/dist/runtime-map-config.js"
umask 077
TARGET="$target" node <<'NODE'
const fs = require('node:fs');
const token = process.env.MAPBOX_API_KEY;
const destination = process.env.TARGET;
fs.writeFileSync(destination, `window.SAFETY_MAP_E03_CONFIG=${JSON.stringify({accessToken: token, allowedOrigin: 'https://safety-map-experiment-03.aws.shdkej.com'})};\n`, {mode: 0o600});
NODE
