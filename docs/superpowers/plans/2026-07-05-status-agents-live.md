# Status Agents 라이브 피드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. 스펙: `docs/superpowers/specs/2026-07-05-status-agents-live-design.md`

**Goal:** Status 페이지 Agents 섹션에 실제 OpenClaw 크론 상태를 10분 케이던스로 띄운다.

**Architecture:** collector가 스냅샷 push 후 public-safe 서브셋을 S3 `agents-live.json`으로 업로드, status 페이지가 same-origin fetch + 30분 신선도 판정 + 정적 폴백.

**Tech Stack:** Python(collector, pytest), Vanilla JS(status page), aws cli.

## Global Constraints

- 스펙의 payload 스키마·state 매핑 그대로. cron UUID·agent_id 미발행.
- 발행 실패는 스냅샷 push를 막지 않는다.
- `public_publish` 설정 부재 시 기존 동작 무변경.

### Task 1: collector 발행 스텝 (repo: ~/workspace/system-dashboard)

**Files:** Modify `collector/collector.py`, `collector/manifest.yaml`; Test `collector/tests/test_collector.py`

- [ ] `public_agents_payload(crons)` 순수 함수 + `publish_public(cfg, crons, run)` 추가 (aws s3 cp stdin)
- [ ] main(): push 성공 후 publish, 실패는 로그만
- [ ] 테스트: state 매핑(operational/degraded/down/maintenance), 필드 화이트리스트(id/agent_id 부재), 설정 부재 시 no-op, 발행 예외 격리
- [ ] `python3 -m pytest collector/tests -q` PASS → 커밋

### Task 2: status 페이지 소비 (repo: ~/workspace/space)

**Files:** Modify `infra-aws-static-sites/sites/status/dist/index.html`

- [ ] `loadAgentsLive()`: fetch `./agents-live.json`, 30분 신선도 판정 → `{live, agents, ageMinutes}` 반환
- [ ] buildModel에 라이브 agents 주입(카드 수치 + agents 패널 rows: schedule·last run·errors 뱃지), 폴백 시 경고 행
- [ ] Playwright: 라이브 목킹(page.route로 JSON 응답) / 차단 폴백 / 기존 12항목 회귀 → 커밋

### Task 3: 실발행·배포·검증

- [ ] `systemctl --user start system-dashboard-collector.service` 1회 실행 → `curl https://status.aws.shdkej.com/agents-live.json` 200 + generatedAt 최신
- [ ] status dist S3 sync + invalidation → 라이브 페이지에서 실제 크론 렌더 확인
- [ ] DESIGN.md 데이터 소스 절 갱신 → 커밋
