# Infinity dashboard

## Purpose

Shows the live Infinity intent registry and its execution evidence at
`https://infinity.aws.shdkej.com`.

## Data and behavior

- `dist/index.html` reads `INTENTS.md`, task details, Context Packs, traces, and
  artifacts from the `shdkej/infinity` repository's `main` branch.
- The evidence view keeps execution-trace rows and Context Pack rows together.
  This includes the `zg` preflight receipt, selected Agent Wiki paths, and the
  selected section's heading, line range, and short excerpt (`locator`). Older
  Context Packs still render their legacy exact-match receipt. A `no-match` is
  shown explicitly and does not stop the Intent.
- Context Pack data is read from `intents/context/<intent-id>.json`; an absent or
  older pack is rendered as unavailable rather than inferred.

## Development and verification

There is no build step. Validate the inline JavaScript after edits:

```sh
awk '/<script>/{n++; next} n == 2 && /<\/script>/{exit} n == 2 {print}' dist/index.html | node -e 'let s=""; process.stdin.on("data", c => s += c).on("end", () => new Function(s))'
```

Pushes that change `dist/` trigger the Space static-site workflow. Verify the
live page by opening an Intent with a v3 Context Pack and confirming the
`zg 선검사` and `zg 선택 결과` rows in **조회한 경로 · Context Map**. A current
locator must display `섹션`, `L<start>–<end>`, and `발췌` for each selected
document section.

## Limit

The dashboard is a read-only view of GitHub-hosted Infinity data. A card can
only show fields that its Context Pack and trace actually record.
