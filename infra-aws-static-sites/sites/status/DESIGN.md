# Status Dashboard — Design Notes

`https://status.aws.shdkej.com` 의 디자인 의사결정 기록. 구현은 `dist/index.html` + `dist/assets/mascot-ambient.jpg`.
스펙: `docs/superpowers/specs/2026-07-05-status-saem-3d-redesign-design.md`

## 디자인 원칙

- **미니멀 · 균형 · 순환**: status의 첫 화면은 운영 목록이나 점수판이 아니라 `현재 판정 / 신호 균형 / 다음 루프`를 먼저 보여준다.
  - 미니멀: 첫 판단은 대표 점수가 아니라 `주의 필요` 같은 상태 문장으로 시작한다. 점수는 보조 근거다.
  - 균형: Surfaces·Agents·Output·System layers의 관계를 함께 읽어, 무엇이 정상이고 무엇이 늦었는지 한 줄로 보여준다.
  - 순환: 완료 상태도 "끝"으로 닫지 않고 snapshot 신선도, agent feed 신선도, 다음 수집 주기를 함께 표시한다.
- **한 화면 (one screen)**: 첫 화면에서 시스템 상태가 스크롤 없이 드러난다. 히어로(현재 판정) + 3 reading rows(Now / Balance / Loop) + 상세 탭(System / Surfaces / Agents / Output). Deploy 탭은 Surfaces와 중복이라 Output(산출물 신선도)으로 교체(2026-07-05) — Agents(누가 도는가)↔Output(뭐가 쌓이는가) 쌍.
- **상태 문장이 주인공, 마스코트는 공간 객체**: 사용자가 지정한 백색·골드 홀로그램 마스코트 이미지는 배경의 공간감과 브랜드 기억을 만들지만, 운영 판단보다 앞서지 않는다.
- **마스코트 정본 준수**: `dist/assets/mascot-ambient.jpg`의 빛나는 휴머노이드 마스코트를 사용한다. 이미지 위 텍스트·로고를 별도로 렌더하지 않는다.
- **팔레트**: 맑은 수면 베이스 `#eef8f5` + 에메랄드 키컬러 `#4f9d8a` + 깊은 물빛 `#1f6566` + 웜 그레이지 조약돌. 정상은 흰색·민트 베일, 확인 필요는 앰버 베일, 중단은 차콜 베일을 상태 영역에만 제한적으로 사용한다. 점수·서비스 수보다 상태와 데이터 신선도가 우선한다.

## 레이어 구조 (아래 → 위)

| z | 레이어 | 역할 |
|---|--------|------|
| body | 크림 본 그라데이션 | WebGL 무관 최종 안전망 |
| body | `assets/emerald-water-background.jpg` | 2026-07-26 사용자가 지정한 실제 물결 사진 배경 |
| 0 | `assets/mascot-ambient.jpg` | 사용자가 지정한 홀로그램 마스코트 공간 레이어 |
| 0 | `.saem-canvas` / `.saem-fallback` | 기존 Saem 씬 롤백용 DOM — 공개 화면에서는 비활성화 |
| 10 | `.app-shell` | 글래스 HUD (히어로·카드·상세·하단 내비) |

## Mascot Scene (image layer)

- `assets/mascot-ambient.jpg`를 body 배경으로 사용하고, 백색·골드 veil과 글래스 HUD를 위에 얹는다.
- 기존 `saem-scene.js`는 공개 렌더 경로에서 호출하지 않는다. 상태 데이터 계약과 상세 탭은 그대로 유지한다.
- `status.json`의 overall 상태는 텍스트·상태 카드·상세 패널에만 반영한다.

## Fallback 체인

1. 이미지 레이어 정상 → 마스코트 배경 + 백색·골드 veil.
2. 이미지 로드 실패 → 본문 그라데이션과 글래스 HUD가 유지되어 상태 정보가 사라지지 않는다.
3. `prefers-reduced-motion: reduce` → HUD 전환 애니메이션만 정지.

## HUD 글래스 문법

- 토큰: `--glass: rgba(247,255,252,0.30)` / `--glass-strong: 0.44` / `--glass-border: rgba(170,226,211,0.58)` / `--glass-blur: none` — backdrop-blur는 밀키한 불투명감을 만들어 뺐다. 다만 dense data 영역에서는 투명 장식보다 읽기 안정성을 우선한다.
- 히어로·reading rows·상세 타일·리스트 행·하단 내비·아이콘 버튼은 같은 토큰을 계승하되, 경고 상태에서는 상태 영역의 대비를 올린다.
- 첫 화면 행은 판단을 보여준다: 상태 dot + label + 운영 문장 + 보조 메타. `Now`는 가장 먼저 볼 문제, `Balance`는 Services/Agents/Outputs의 관계, `Loop`는 snapshot·agent feed 신선도와 다음 확인을 담당한다. 상세 탭은 System / Surfaces / Agents / Output 구조를 유지하되 `Needs attention / Healthy / Evidence` 순서로 묶는다.
- 전환: 카드·내비·홈·뒤로가기 모두 화면 전체로 퍼지는 transition-flash를 쓴다(사용자가 가장 좋아하는 이펙트 — 빼지 말 것). 패널 전환은 transform만 애니메이션(opacity 금지).
- 샘 인터랙션: 탭/클릭 → 스쿼시 움찔 + 눈 깜빡 + 물결 1회. 휠/터치 스크롤 → 속도 비례 갸웃(rotation.x/z) 후 스프링 복귀. reduced-motion에서는 모두 끔.

## 데이터 소스

| 파일 | 생산자 | 케이던스 | 내용 |
|------|--------|----------|------|
| `status.json` | `scripts/build-status-json.py` (배포 시) | 배포마다 | surfaces·deployments·정적 agents(폴백용) |
| `agents-live.json` | `~/workspace/system-dashboard/collector` (systemd timer) | 10분 | `agents`(에이전트 로스터 롤업) + `outputs`(산출물 신선도) + `system`(4레이어 판정 + PDCA·백로그·인텐트 카운트 — CMS system-panel 판정 로직과 동일 유지). 레이어가 ok가 아니면 `reason`(판정 근거 한 줄, 크론 이름 등 비공개 상세는 제외)을 함께 낸다. 내용·이름·UUID 등 상세는 CMS (스펙: `2026-07-05-status-agents-live-design.md`) |

Agents 패널은 `agents-live.json`이 30분 이내면 라이브 렌더, 아니면 정적 agents + "Live feed silent" 경고 행. **S3 sync 시 `--exclude "agents-live.json"`을 반드시 유지** — 수집기가 올린 파일을 배포가 지우면 안 된다.

## 검증 기준

- 390px·데스크탑 첫 화면 스크롤 없음 · 마스코트 이미지 레이어 표시 · 이미지 로드 실패 시 그라데이션 fallback · 카드 상태값 표시 · 클릭 → 상세 + 내비 동작 · reduced-motion 정지.
- 검증 스크립트: Playwright 헤드리스(chromium `--enable-unsafe-swiftshader`)로 12항목 자동 확인 (2026-07-05 전부 PASS).

## 이력

- 2026-08-11: 운영 신뢰성 보강. Score 98보다 현재 판정과 데이터 신선도를 우선 표시하고, `Generated=fresh` 고정 표시를 snapshot age 기반 fresh/aging/stale 판정으로 교체. 상세 화면은 `Needs attention / Healthy / Evidence` 그룹으로 재구성.
- 2026-08-09: Spatial Type 전환. 첫 화면을 카드 벽이 아닌 텍스트 우선의 읽기 흐름으로 바꾸고, Now/Balance/Loop를 번호·상태·다음 행동의 짧은 행으로 노출. 기존 status.json 데이터 계약과 상세 탭은 유지.

- 2026-08-01: 제품 디자인 철학을 `미니멀 · 균형 · 순환`으로 고정하고 status 첫 화면을 Now / Balance / Loop 중심으로 재구성. 기존 상세 탭과 데이터 계약은 유지.
- 2026-08-01: 사용자가 지정한 마스코트 이미지로 공간 레이어를 교체. 기존 Saem 절차적 씬은 롤백용 DOM/파일로 남기고 공개 화면에서는 비활성화.
- 2026-07-26: 사용자가 보낸 실제 물결 사진을 status 배경으로 적용. `assets/emerald-water-background.jpg`를 추가하고, WebGL 씬을 투명 렌더링으로 바꿔 사진 위에 샘·수면·반짝임이 얹히게 조정.
- 2026-07-26: 물결 사진 기반 에메랄드 키컬러 적용. CMS 작업은 유지하고 status 정적 사이트에 별도 반영: `dist/index.html`의 HUD/배경/전환 플래시, `dist/assets/saem-scene.js`의 수면·조명·mote·이끼 색을 에메랄드 수면 계열로 갱신.
- 2026-07-10: System 탭 판정 근거 모달 — warn/bad 행 클릭 시 이유(reason)를 모달로 표시. reason은 수집기가 레이어별로 내려주고(크론은 개수만, 백로그·산출물 이름은 기존 public 범위), Overall·Backlog 행은 프론트가 이미 받은 데이터로 조립.
- 2026-07-05: 샘(Saem) 3D 리디자인. 이전의 Hers-inspired 정적 backdrop(spatial-presence.css)과 미커밋 여행 히어로 변경분은 이 리디자인으로 대체. 브랜드 정본과 어긋난 인물형 `status-companion-v1.webp` 제거.
