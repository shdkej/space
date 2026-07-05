# Status 대시보드 리디자인 — 샘(Saem) 3D 모션 배경 + 투명 글래스 HUD

날짜: 2026-07-05
대상: `infra-aws-static-sites/sites/status/dist/` (index.html, assets/)
상태: 사용자 설계 승인 완료, 구현 전

## 배경 / 문제

- 커밋 버전(HEAD)에는 spatial-presence 배경 레이어(정적 Hers 이미지 + 포인터 parallax)가 있었으나, 미커밋 수정에서 배경 레이어·CSS 링크·parallax JS가 전부 제거되어 흰 화면 위에 불투명한 흰 알약 버튼만 남았다.
- 히어로가 Status가 아닌 여행 대시보드 콘텐츠("World trip dashboard")로 바뀌어 있다.
- 카드의 상태값(score, OK 카운트, 상태 dot)이 `display:none`으로 전부 숨겨져 있어 Status 대시보드인데 상태가 안 보인다.
- 기존 캐릭터 에셋(`status-companion-v1.webp`, 미래풍 인물)은 브랜드 정본과 어긋난다. 정본은 BRAND.md의 **샘(Saem) — 이끼 패치가 올라간 조약돌 정령**.
- 과거 Three.js 배경을 넣었다가 CDN/GPU 실패 시 빈 화면 문제로 롤백한 이력이 있다(`c269c98` → `a1870f3`).

## 목표 (사용자 요구)

1. 첫 화면은 스크롤 없이 한눈에(one-screen), 버튼 클릭 시 이펙트와 함께 상세로 전환.
2. 첫 화면 배경은 **3D 모션 그래픽이 주인공**, 버튼은 그 위에 투명하게 떠 있음.
3. 상세 화면은 하단 내비로 메뉴 이동, 상세의 버튼·타일도 홈과 같은 투명 문법 + 가독성.

## 결정 사항

- **배경 기술**: Three.js WebGL 재도전. 단, CDN 의존 제거 — three.js를 `dist/assets/vendor/`에 로컬 번들.
- **캐릭터**: 샘(Saem)을 이미지가 아니라 **Three.js 절차적 지오메트리로 직접 모델링**. 이미지 에셋 의존 없음. `status-companion-v1.webp`는 제거.
- **히어로**: Status 콘텐츠 복원(전체 score, surfaces OK 카운트, updated 시각). 여행 콘텐츠 제거.
- **팔레트**: Quiet Note / 브랜드 유지 — 크림 #F0EEE9, 웜 그레이지, 올리브 이끼, 앰버 포인트. 그림자는 웜 그레이(pure black 금지).

## 레이어 구조 (아래 → 위)

| z | 레이어 | 내용 |
|---|--------|------|
| body | 크림 본 그라데이션 | WebGL 무관 최종 안전망 |
| 0 | Three.js 캔버스 (`position:fixed; pointer-events:none`) | 샘 3D 씬 |
| 10 | HUD (`.app-shell`) | 히어로 + 4카드 + 상세 + 하단 내비 |

## 3D 씬 구성

- **샘 본체**: 부드럽게 눌린 매트 그레이지 구체(조약돌), 위에 올리브 이끼 캡 + 새싹 1개, 점 눈 2개. 아주 느린 숨쉬기 bob.
- **샘터(泉) 수면**: 샘 옆 수면 위 동심원 물결이 잔잔히 퍼짐 — 모션의 중심.
- **공간**: 좌상단 아침빛, 빛 입자 약간, 카메라 느린 드리프트 + 포인터 parallax(rAF smoothing).
- **상태 연동** (BRAND.md 상태 문법 그대로): `status.json` overall이
  - ok → 따뜻한 아침빛 + 잔잔한 물결
  - warn/down → 빛이 가라앉고 물결이 멈춘 고요한 수면
- **브랜드 금지선**: 과장된 귀여움 금지, 큰 눈 금지, 텍스트/로고를 씬 안에 그리지 않음.

## HUD / 투명 글래스 문법

- **4카드**: `rgba(255,255,255,≈0.3)` + backdrop-blur + 1px 흰 보더. 숨겨진 상태값 복원 — 카드마다 label, 핵심 수치(score, OK/total), 상태 dot 표시. 글자는 진한 잉크색으로 가독성 확보.
- **클릭 이펙트**: 기존 cardPulse + transition-flash + overview blur-out 전환 유지, 타이밍 다듬기.
- **상세 화면**: 하단 플로팅 내비(Home + System/Surfaces/Agents/Deploy) 유지. summary 타일·리스트 행·내비 버튼 전부 카드와 동일한 투명 글래스 문법으로 통일.
- **one-screen**: 첫 화면 `100svh`, `overflow:hidden` 유지. 390px 폭에서 가로 스크롤 없음.

## Fallback 체인

1. WebGL 정상 → 풀 3D 씬.
2. WebGL 실패(생성 예외/컨텍스트 로스) → 캔버스 제거, CSS 도형 샘(둥근 div + 이끼 blob + 점 눈) + 크림 그라데이션. 캐릭터는 절대 사라지지 않는다.
3. `prefers-reduced-motion: reduce` → 애니메이션 정지(정적 씬 또는 CSS 샘), parallax 끔.

## 검증 기준

- 390px·데스크탑에서 첫 화면 스크롤 없음.
- Three.js 씬 렌더 + 물결 애니메이션 동작, 포인터 parallax 반응.
- WebGL 강제 실패 시 CSS 샘 fallback 표시(빈 배경 금지).
- 카드에 상태값 표시, 클릭 → 펄스 + 상세 전환, 하단 내비로 탭 이동.
- `status.json` overall 상태에 따라 씬 무드 변화.
- reduced-motion에서 애니메이션 정지.

## 후속 문서 갱신

구현 완료 시 `sites/status/DESIGN.md`, `DESIGN_SYSTEM.md`를 이 스펙 기준으로 갱신하고, 미커밋 여행 히어로 변경분은 이 리디자인으로 대체됨을 기록한다.
