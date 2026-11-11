# LCML Office Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development or superpowers:executing-plans. Owner integrates and verifies deployment.

**Goal:** Ship LCML at Status /office/ using actual ten-minute operational snapshots.
**Architecture:** React/Vite static page in existing dashboard dependency workspace; separate office entry and assets; Python collector module in existing system-dashboard submodule publishes office-live.json through existing ten-minute job.
**Tech Stack:** React 18, Vite 6, CSS, Python, S3/CloudFront.
**Spec:** ../specs/2026-11-11-lcml-office-design.md (user correction overrides any old realtime/auth text).

## Global constraints
- 1F product/genie, 2F customer/Godin, 3F business/SAM, 4F owner. No login.
- Data cadence 600s, stale after 720s; source failures cannot manufacture success. No invented sessions or metrics.
- One isometric background + 4 columns × 3 rows sprite. DOM whiteboard, mobile/desktop, reduced motion.
- Preserve existing routes and unrelated changes. Public outputs exclude transcripts, credentials and absolute local paths.

## Shared JSON contract
`{schemaVersion:1, observedAt:ISO, cadenceSeconds:600, staleAfterSeconds:720, sources:{sessions:{state,observedAt}}, sessions:[{id,agentId,name,floor,state,startedAt,observedAt,parentId,taskLabel}], events:[{id,sessionId,type,occurredAt}], questions:[{id,sessionId,title,askedAt,sourceUrl}], repositories:[{name,branch,sha,dirtyCount,ahead,behind,observedAt,state,url}], projects:[{id,name,observedAt,state,metrics:[{stage,label,value,unit,window,observedAt,state}]}], strategy:{strategy:[],values:[],hypotheses:[],observedAt}, tasks:[{id,title,floor,status}], day:{phase,closedAt,timeZone}, activity:[{id,label,occurredAt,floor}]}`.
Session states: working, blocked, waiting, reporting, ended, unknown. Event types: arrived, departed, reported. Strategy entries `{id,title,detail,state,nextAction,sourceLabel,sourceUrl}`. No fake live demo data. Missing metric values null.

## Review focus
- Repeated/stale snapshots never replay arrivals, disappearance never proves normal departure.
- Multiple projects and absent telemetry remain distinguishable from measured zero.
- Repeated floor clicks and mobile layout do not overlap whiteboards/controls.
- Bad/absent session source freezes animation independently of working metrics source.
- Existing S3 deployment must preserve collector-owned JSON.

### Task 1: Office screen
- [x] Add `dashboard/office/index.html`, `dashboard/office/src/*`, `dashboard/vite.office.config.js`, build script to `dist/office/`.
- [x] Test freshness, event dedupe and state/frame selection with node:test before implementing model.
- [x] Implement floor navigation, central office, wall boards, details, project switch, owner queue, room lighting, source status.
- [x] Use `office/public/assets/office.png` and `office/public/assets/characters.png` supplied by owner; copy via public assets.
- [x] Build and report test evidence; no commit until owner integration.

### Task 2: Collector
- [x] Add `collector/office.py` and `collector/tests/test_office.py` in submodule. Test sanitization, observed state inference, unknown sources and git failures.
- [x] Gather actual session evidence, Infinity tasks/questions, three git repositories, PostHog per-project metrics, documented strategy.
- [x] Integrate office publishing into existing publisher with independent error handling. Preserve output file on failed collection only with its original timestamp.
- [x] Update manifest/README and run collector tests/live read-only validation.

### Task 3: Integration and publication
- [x] Integrate generated assets and validate browser desktop/mobile, frozen state, floor changes, source failures.
- [x] Review actual diff and fix material findings. Update spec/readme/results.
- [ ] Commit scoped changes in submodule/Space, push appropriate branches, deploy via existing AWS pathway and verify live asset/feed URLs.
