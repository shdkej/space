# Status Dashboard — Design Notes

`https://status.aws.shdkej.com` 의 디자인 의사결정 기록. 구현은 `dist/index.html` + `dist/assets/saem-scene.js`.
스펙: `docs/superpowers/specs/2026-07-05-status-saem-3d-redesign-design.md`

## 디자인 원칙

- **한 화면 (one screen)**: 첫 화면에서 시스템 상태가 스크롤 없이 드러난다. 히어로(전체 온도) + 4카드(System / Surfaces / Agents / Output). Deploy 탭은 Surfaces와 중복이라 Output(산출물 신선도)으로 교체(2026-07-05) — Agents(누가 도는가)↔Output(뭐가 쌓이는가) 쌍.
- **샘(Saem)이 주인공, HUD는 그 위에 뜬다**: 배경의 3D 샘 씬이 무대(主)이고, 상태 카드는 투명 글래스로 그 위에 떠 있다.
- **브랜드 정본 준수**: 캐릭터는 BRAND.md의 샘 — 이끼 조약돌 정령. 과장된 귀여움·큰 눈 금지, 씬 안에 텍스트/로고 렌더 금지.
- **팔레트**: 화이트 크림 `#f5f4f1` + 웜 그레이지 + 올리브 이끼 + 은은한 아침빛. 누런기 억제(2026-07-05 피드백 "너무 누래서 하얗게"), 그림자는 웜 그레이(pure black 금지).

## 레이어 구조 (아래 → 위)

| z | 레이어 | 역할 |
|---|--------|------|
| body | 크림 본 그라데이션 | WebGL 무관 최종 안전망 |
| 0 | `canvas.saem-canvas` (fixed, pointer-events:none) | Three.js 샘 씬 |
| 0 | `.saem-fallback` | CSS 도형 샘 — `body[data-scene="webgl"]`일 때만 숨김 |
| 10 | `.app-shell` | 글래스 HUD (히어로·카드·상세·하단 내비) |

## SaemScene (Three.js)

- Three.js 0.166.1을 `dist/assets/vendor/three.module.min.js`로 **로컬 vendoring** — CDN 런타임 의존 없음 (과거 Three.js 롤백 원인이던 CDN 실패 리스크 제거).
- 샘은 이미지가 아니라 **절차적 지오메트리**로, 정본 이미지(`~/workspace/prompt-archive/assets/saem-character/reference/`)를 기준 삼는다: speckle 질감 조약돌 + 우상단 유기 이끼 패치(작은 clump 22개) + 이끼에서 자라는 새싹 + 담담한 점 눈 2개. 숨쉬기 bob + 느린 좌우 바라보기.
- 수면: 대형 circle 평면 + 동심원 ring 4개가 스케일/페이드로 퍼지는 물결. 가짜 컨택트 섀도(웜 그레이 radial 텍스처).
- 카메라: 사인 드리프트 + 포인터 parallax(lerp 0.05). 데스크탑은 샘을 우측 스테이지에(stage.x 오프셋, lookAt은 원점 고정), 모바일은 히어로와 카드 사이 중앙에.
- **상태 연동** (BRAND.md 상태 문법): `status.json` overall이 ok → 따뜻한 아침빛(`#fff8ee`) + 물결 진행 / warn·bad → 빛 강도·색온도 하강(`#eae6dd`) + 물결 정지(고요한 수면). `window.__SAEM_SCENE__.setMood()`로 전환.

## Fallback 체인

1. WebGL 정상 → 풀 3D 씬 (`body[data-scene="webgl"]`, 캔버스 fade-in).
2. 모듈 로드 실패 / renderer 생성 예외 / context lost → `data-scene` 미설정(또는 해제) → CSS 도형 샘(`.saem-fallback`: 조약돌 div + 이끼 blob + 새싹 + 점 눈 + CSS 물결)이 그대로 남는다. **캐릭터가 사라지는 상태가 구조적으로 없다.**
3. `prefers-reduced-motion: reduce` → 씬 시간 정지(정적 1프레임) + parallax 무시, CSS 애니메이션도 정지.

## HUD 글래스 문법

- 토큰: `--glass: rgba(255,255,255,0.28)` / `--glass-strong: 0.42` / `--glass-border: 0.62` / `--glass-blur: none` — backdrop-blur는 밀키한 불투명감을 만들어 뺐다. 맑은 투명이 최종 상태다.
- 히어로·4카드·상세 타일·리스트 행·하단 내비·아이콘 버튼 전부 같은 토큰 사용. 내비 현재 탭도 불투명 배경 없이 보더+굵은 글자만(2026-07-05 피드백).
- 카드는 상태를 보여준다: 상태 dot + label + 핵심 수치(score, OK/total) + 상태 문구.
- 전환: 카드·내비·홈·뒤로가기 모두 화면 전체로 퍼지는 transition-flash를 쓴다(사용자가 가장 좋아하는 이펙트 — 빼지 말 것). 패널 전환은 transform만 애니메이션(opacity 금지).
- 샘 인터랙션: 탭/클릭 → 스쿼시 움찔 + 눈 깜빡 + 물결 1회. 휠/터치 스크롤 → 속도 비례 갸웃(rotation.x/z) 후 스프링 복귀. reduced-motion에서는 모두 끔.

## 데이터 소스

| 파일 | 생산자 | 케이던스 | 내용 |
|------|--------|----------|------|
| `status.json` | `scripts/build-status-json.py` (배포 시) | 배포마다 | surfaces·deployments·정적 agents(폴백용) |
| `agents-live.json` | `~/workspace/system-dashboard/collector` (systemd timer) | 10분 | `agents`(에이전트 로스터 롤업) + `outputs`(산출물 신선도) + `system`(4레이어 판정 + PDCA·백로그·인텐트 카운트 — CMS system-panel 판정 로직과 동일 유지). 내용·이름·UUID 등 상세는 CMS (스펙: `2026-07-05-status-agents-live-design.md`) |

Agents 패널은 `agents-live.json`이 30분 이내면 라이브 렌더, 아니면 정적 agents + "Live feed silent" 경고 행. **S3 sync 시 `--exclude "agents-live.json"`을 반드시 유지** — 수집기가 올린 파일을 배포가 지우면 안 된다.

## 검증 기준

- 390px·데스크탑 첫 화면 스크롤 없음 · `window.__SAEM_SCENE__.ready === true` + `body[data-scene="webgl"]` · 모듈 차단 시 CSS 샘 표시 · 카드 상태값 표시 · 클릭 → 상세 + 내비 동작 · setMood 무드 전환 · reduced-motion 정지.
- 검증 스크립트: Playwright 헤드리스(chromium `--enable-unsafe-swiftshader`)로 12항목 자동 확인 (2026-07-05 전부 PASS).

## 이력

- 2026-07-05: 샘(Saem) 3D 리디자인. 이전의 Hers-inspired 정적 backdrop(spatial-presence.css)과 미커밋 여행 히어로 변경분은 이 리디자인으로 대체. 브랜드 정본과 어긋난 인물형 `status-companion-v1.webp` 제거.
