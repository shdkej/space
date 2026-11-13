# LCML Office Implementation Plan

후속 사용자 수정: 단일 배경과 텍스트 전체 보기는 [층별 공간·전체 보기 계획](2026-11-11-lcml-floor-visuals.md)으로 대체되었습니다. 수집·신선도 계약은 이 문서를 유지합니다.

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
- [x] Commit scoped changes in submodule/Space, push Space branch, preserve inaccessible collector remote changes as a verified recovery patch, deploy via existing AWS pathway and verify live asset/feed URLs.

## Delivery evidence — 2026-11-11

- Live: https://status.aws.shdkej.com/office/ (HTTP 200, no authentication). Existing Status home links to the office.
- UI source commit: `f2ebdd9` on Space `codex/lcml-office`. Existing nine commits on the starting branch were preserved; this task did not merge them into main. Deployment was scoped to Office assets/HTML plus the Status home entry.
- Collector source commit: `cb8bc02`; deployed Python process uses this checkout. Its pre-existing remote returns 404. Parent gitlink remains unchanged; `patches/lcml-office-collector.patch` includes prerequisite `312c38c` and LCML, and was applied to a clean `1043559` checkout. The resulting tree exactly matched `13950ac3e3d0c90959176c9888c9bfdd2c4939e2`.
- Deployed UI revision: `index-BZCH3TZ_.js` / `index-C6y8pAMa.css`. Eight live HTML/JS/CSS/image responses were HTTP 200 and SHA-256 matched local build bytes. CloudFront invalidation: `I733S8QI74V5RCFALSRPNY40P5`.
- Frontend tests: 22/22; Office collector tests: 21/21. Existing collector suite: 71/72; `test_system_rollup` has a pre-existing fixed-date fixture failure reproduced on the original code. No assertion of a fully green legacy suite.
- Chrome verified desktop 1440px/mobile 390px, all floors and rapid navigation, project selection, hypothesis details, reduced motion, image-load fallback and no page errors. Controlled browser inputs verified arrival→report→departure with actor removal/no replay, stale owner count `—`, and four staggered lighting zones. Test inputs were never published.
- Actual systemd timer produced successive public observations at 19:31 and 19:40 UTC; service exited successfully. Live feed uses `Cache-Control: no-store`, cadence 600 seconds, stale boundary 720 seconds. Existing feeds remain protected from static sync deletion.
- KL service registry updated and published in `2ea04cc`: source location, four-layer roles, ten-minute cadence and no authentication. Technical operations and collector recovery instructions are in Status README.
- Remaining data boundaries: AARRR stages without definitions remain unavailable; exporter does not expose PostHog's last successful upstream collection time. Git compares local tracking refs without a remote fetch. No invented sessions or customer values.
