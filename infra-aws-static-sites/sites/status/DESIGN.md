# Status Dashboard — Design Notes

`https://status.aws.shdkej.com` 의 디자인 의사결정 기록. 구현은 `dist/index.html` + `dist/assets/spatial-presence.css`.

## 디자인 원칙

- **한 화면 (one screen control layer)**: 첫 화면에서 시스템 상태가 한눈에 드러난다. 스크롤 없이 4개 카드(System / Surfaces / Agents / Deploy)로 전체 온도를 본다.
- **공간이 주인공, HUD는 그 위에 뜬다**: 배경의 3D/공간 레이어가 무대(主)이고, 상태 카드는 그 위에 떠 있는 반투명 글래스 HUD다.
- **Quiet Note 팔레트**: 따뜻한 본(bone) 배경 + 저채도 단일 악센트(clay/amber). 과채도 금지.
- **모바일은 작고 안정적, 데스크탑은 크고 미래지향적**.

## 레이어 구조 (아래 → 위)

| z | 레이어 | 역할 |
|---|--------|------|
| body bg | 웰니스 글래스 사진 + 본 그라데이션 | 깊은 환경 |
| -1 | `body::before` | 그리드 + 노이즈 텍스처 |
| 0 | `.character-stage` | 공간/캐릭터 프레즌스 (parallax) |
| 10 | `.app-shell.hud-layer` | floating HUD (카드·내비·디테일) |

## Spatial Presence Layer

Sam Samuel 웹의 핵심 공간 문법: **"캐릭터가 공간의 주인이고, UI는 그 위에 떠 있다."** (research-15, research-16 → build-12)

- **`background-layer` (`.character-stage`)**: `position:fixed; inset:0; z-index:0; pointer-events:none`. 투명 — 기존 body 배경이 깊은 환경이고, 그 위에 프레즌스가 뜬다. 데스크탑은 `perspective:1400px`로 실제 3D 깊이를 만든다.
- **`hud-layer` (`.app-shell.hud-layer`)**: `position:relative; z-index:10`. 기존 글래스 카드는 그대로 두고 z-index 보장만 추가 — 카드의 backdrop-blur 너머로 프레즌스가 은은히 비친다.
- **depth layers (parallax)**: 3겹 — `.depth-far`(aura, 0.28) / `.depth-mid`(presence, 0.6) / `.depth-near`(motes, 1.0). depth-factor가 클수록 포인터에 크게 반응 → 시차(parallax) 깊이.
- **character-placement**:
  - desktop: 우측 자유 배치, 뷰포트 78% 높이, perspective + aura로 미래지향적
  - tablet: 54vh, 우측 8%, 차분하게
  - mobile (<640px): 하단 중앙 고정, 30vh, **parallax 없음** (작고 안정적)
- **pointer-response**: 마우스 이동 → `rotateX/rotateY + translate3d` (최대 ±8°, `requestAnimationFrame` throttle). 모바일은 비활성.
- **fallback-chain**: video → poster still(WebP) → **placeholder presence(현 Phase 1, AI 에셋 준비 전)**.
- **`prefers-reduced-motion: reduce`**: JS parallax 및 video 정지, static presence만.

### Phase 단계

- **Phase 1 (build-12, 현재)**: AI 캐릭터 에셋 없이 CSS 그라데이션 `placeholder presence`(aura + 인물형 컬럼 + 빛 모트). 토큰·스테이지·parallax·반응형·접근성 전부 동작.
- **Phase 2 (별도 intent)**: AI 생성 still(`assets/character/poster.webp`)을 `.depth-mid`에 `<picture>`로 삽입 + LCP preload. CSS/JS 변경 불필요(에셋 교체만).
- **Phase 3**: Spline / R3F 실시간 캐릭터 (research-16 Option B/C).

## 검증 기준 (build-12)

- 390px 가로 스크롤 없음 · 배경 프레즌스 표시 · HUD z-index 정상(stage 0 / HUD 10) · pointer parallax 동작 · reduced-motion fallback · 4-card overview 유지.
