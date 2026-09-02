# Night Ledger / Safety Map MVP

Self-contained static prototype for travel planning context. It is intentionally **not** a real-time crime map, emergency tool, or a promise that a place is safe.

## Scope and safety boundary

- Rome is the P0 card. The exact fixture city list is Rome, Palermo, Catania, Naples, Istanbul, Cairo, Barcelona, Paris, London, and New York.
- All content is fixture data dated `2026-09-02`; it makes no live-data claim.
- `SOURCE CONTEXT` means a linked official source is available, not that risk is low; the traveller should open it before travel.
- `NO LIVE FEED` explicitly means the MVP has no current incident feed.
- The report form is local-only. It rejects common location/contact patterns and instructs people not to submit personal data, exact locations, photos, or live whereabouts. It is not a reporting channel.
- Advertising is visually and structurally separate from the decision content.
- The P0 map shows real Rome place and road geometry for orientation only. It never presents a safety rating, route recommendation, incident feed, or street-level safety status; the safety layer stays neutral **no-data** unless independently verified data exists.

## Protected Mapbox client delivery

The client token value is never committed, logged, put in Terraform, or copied into application source. The protected deployment setting is injected only on the Gateway deployment host, which generates the ignored `dist/runtime-map-config.js` artifact. The static-site workflow preserves that artifact when syncing later source updates. Mapbox GL reads it at browser runtime; as with every browser map, the domain-restricted **public** token is observable by the browser and must be restricted to `https://safety-map.aws.shdkej.com` in Mapbox. No server/private Mapbox token is used.

## Fixture sources

Every source used in the UI is linked from `app.js`: UK FCDO (Italian cities), GoTürkiye, Egypt tourism portal, Spain.info, France Diplomacy, Visit London, and NYC Tourism. They are discovery links, not interpreted safety scores.

## Local preview and smoke test

```bash
cd sites/safety-map
python3 -m http.server 8080
# visit http://localhost:8080
node test-smoke.js
```

No analytics or user-data collection is included. The separate protected deployment step is required before the real Mapbox place/road surface is available.
