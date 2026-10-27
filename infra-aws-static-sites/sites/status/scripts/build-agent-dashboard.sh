#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/agent-dashboard"
npm ci
npm run build
rm -rf "$ROOT/dist/agents"
mkdir -p "$ROOT/dist/agents"
cp -R out/. "$ROOT/dist/agents/"
echo "Built $ROOT/dist/agents"
