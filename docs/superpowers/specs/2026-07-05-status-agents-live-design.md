# Status Agents 섹션 — 실제 에이전트(크론) 라이브 피드

날짜: 2026-07-05
상태: 사용자 설계 승인 완료 (A안: 수집기 S3 발행)
대상: `~/workspace/system-dashboard/collector/` (발행) + `infra-aws-static-sites/sites/status/dist/` (소비)

## 배경 / 문제

- Status 페이지 Agents 섹션은 `status.json`의 손으로 관리하는 정적 agents 6개를 보여준다 — "실제" 에이전트 상태가 아니다.
- 실제 에이전트 = OpenClaw 크론. 이미 `system-dashboard/collector`(systemd user timer, 10분)가 `openclaw cron list --json`으로 수집해 Supabase 스냅샷으로 push하고, CMS System 탭이 렌더한다.
- 사용자 선택: 공개 페이지에는 CMS 내용 중 **크론(=실제 에이전트)만** 올린다. L1 4지표·PDCA·L4 신선도는 비공개 유지.

## 결정 (A안)

수집기가 스냅샷 push 후 **public-safe 크론 서브셋을 status S3 버킷에 `agents-live.json`으로 업로드**한다. Status 페이지는 same-origin 정적 파일을 fetch한다. CMS API 공개(C안)·GitHub Actions 재빌드(B안)는 기각 — 인증 노출/케이던스 문제.

## 발행 (collector)

- `manifest.yaml`에 설정 추가 (없으면 스텝 전체가 꺼져 기존 동작 무변경):
  ```yaml
  public_publish:
    bucket: static-status-aws-shdkej-com
    key: agents-live.json
  ```
- 발행 payload (public-safe 필드만):
  ```json
  {
    "generatedAt": "2026-07-05T04:30:00Z",
    "agents": [
      { "name": "...", "state": "ok|warn|bad", "enabled": true,
        "schedule": "0 8 * * *", "tz": "Asia/Seoul",
        "lastRunAt": "ISO|null", "nextRunAt": "ISO|null",
        "lastStatus": "success", "consecutiveErrors": 0 }
    ]
  }
  ```
  - state 매핑: collector status `operational→ok`, `degraded→warn`, `down→bad`, `maintenance(비활성)→warn` + `enabled:false`.
  - 내부 식별자(cron UUID, agent_id)는 **발행하지 않는다**.
- 업로드: `aws s3 cp - s3://.../agents-live.json --cache-control max-age=60 --content-type application/json` (subprocess). CloudFront invalidation은 하지 않는다 — max-age 60이면 최대 1분 지연으로 충분.
- 실패 격리: 발행 실패는 스냅샷 push·액션 처리에 영향 없이 `errors`처럼 stdout 로그만 남긴다.

## 소비 (status 페이지)

- Agents 탭 진입 데이터: `./agents-live.json` fetch (`cache: no-store`).
- **신선 판정**: `generatedAt`이 30분 이내 → 라이브 렌더.
  - 요약 타일: `OK n/m` · `Loops m` · `Feed x분 전`.
  - 행: 상태 dot + 이름 + (detail 줄에) `schedule tz · last run 상대시간` + meta 뱃지 `errors n` 또는 `paused`(비활성) 또는 `ok`.
- **폴백**: 파일 없음/파싱 실패/30분 초과 → 기존 status.json agents 렌더 + 목록 위에 경고 행 "Live feed silent — 수집기 마지막 신호 N시간 전(또는 없음)". 죽은 침묵을 침묵으로 두지 않는다.
- 홈 Agents 카드: 라이브 데이터가 있으면 `okAgents/total`을 라이브 기준으로 갱신.

## 검증 기준

- collector 단위 테스트: public payload 변환(state 매핑, 필드 화이트리스트, UUID 미포함) + 발행 실패 격리.
- 실제 1회 실행(`--dry-run` 아님)으로 S3 객체 생성 확인, `curl https://status.aws.shdkej.com/agents-live.json` 200.
- 페이지: 라이브 경로(정상 JSON) / 폴백 경로(fetch 차단) Playwright 확인, 기존 12항목 회귀 PASS.
- systemd 타이머 재시작 후 다음 사이클에서 파일 갱신 확인.

## 두 레포에 걸친 변경

- `~/workspace/system-dashboard`: collector.py + manifest.yaml + tests (별도 커밋).
- `~/workspace/space`: status index.html + 문서 (별도 커밋). 배포는 S3 sync + invalidation.
