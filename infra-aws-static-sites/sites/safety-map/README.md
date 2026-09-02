# Night Ledger / Safety Map MVP

Self-contained static prototype for travel planning context. It is intentionally **not** a real-time crime map, emergency tool, or a promise that a place is safe.

## Scope and safety boundary

- Rome is the P0 card. The exact fixture city list is Rome, Palermo, Catania, Naples, Istanbul, Cairo, Barcelona, Paris, London, and New York.
- All content is fixture data dated `2026-09-02`; it makes no live-data claim.
- `CONTEXT READY` means a linked official source is available, not that risk is low.
- `SOURCE CHECK` means the traveller should open the linked source before travel.
- `NO LIVE FEED` explicitly means the MVP has no current incident feed.
- The report form is local-only. It rejects common location/contact patterns and instructs people not to submit personal data, exact locations, photos, or live whereabouts. It is not a reporting channel.
- Advertising is visually and structurally separate from the decision content.
- The P0 map is an interactive **gray/no-data** surface with synthetic labels `Zone A`, `Zone B`, and `Zone C`. Its optional orange dashed lines are a separately toggled fixture layer, off by default; labels and lines do not correspond to actual geography, roads, incidents, or safety ratings.

## Fixture sources

Every source used in the UI is linked from `app.js`: UK FCDO (Italian cities), GoTürkiye, Egypt tourism portal, Spain.info, France Diplomacy, Visit London, and NYC Tourism. They are discovery links, not interpreted safety scores.

## Local preview and smoke test

```bash
cd sites/safety-map
python3 -m http.server 8080
# visit http://localhost:8080
node test-smoke.js
```

No build, deployment, registry, Terraform, analytics, or user-data collection is included.
