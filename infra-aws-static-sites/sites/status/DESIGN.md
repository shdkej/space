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
| 0 | `.character-stage` | 디자인된 3D 캐릭터 포스터 + parallax stage |
| 10 | `.app-shell.hud-layer` | floating HUD (카드·내비·디테일) |

## Spatial Presence Layer

Sam Samuel 웹의 핵심 공간 문법: **"캐릭터가 공간의 주인이고, UI는 그 위에 떠 있다."** (research-15, research-16 → build-12)

- **`background-layer` (`.character-stage`)**: `position:fixed; inset:0; z-index:0; pointer-events:none`. 투명 — 기존 body 배경이 깊은 환경이고, 그 위에 디자인된 캐릭터 에셋이 무대의 주인공으로 선다.
- **`hud-layer` (`.app-shell.hud-layer`)**: `position:relative; z-index:10`. 기존 글래스 카드는 그대로 두고 z-index 보장만 추가 — 카드의 backdrop-blur 너머로 프레즌스가 은은히 비친다.
- **designed character asset**: `assets/character/status-companion-v1.webp`를 `.depth-mid`에 올린다. 코드로 사람 도형을 조립하지 않고, 먼저 디자인된 캐릭터 포스터를 만든 뒤 웹 stage에 얹는다.
- **spatial layers**: 3겹 `.depth-far`(aura) / `.depth-mid`(character poster) / `.depth-near`(motes)를 유지한다.
- **character-placement**:
  - desktop: 4-card HUD를 좌측 조종석으로 낮추고, 캐릭터는 우측 큰 stage에 배치한다.
  - tablet: 64vh, 우측 stage 유지.
  - mobile (<640px): 중앙 상단 무대에 더 작고 안정적으로 배치, 4-card HUD는 아래쪽에 압축 배치.
- **pointer-response**: pointer/touch 좌표 → `.character-layer` 3겹의 translate/rotate parallax. `requestAnimationFrame`에서 smoothing한다.
- **fallback-chain**: designed poster asset → static poster when reduced motion.
- **`prefers-reduced-motion: reduce`**: parallax를 끄고 static poster 중심으로 남긴다.

### Phase 단계

- **Phase 2a (현재)**: AI 생성 캐릭터 포스터 에셋을 stage에 올리고, pointer parallax와 floating HUD를 연결한다.
- **Phase 2b (다음)**: 캐릭터 방향을 stylescape/프롬프트/포즈 기준으로 더 고정하고 poster 또는 short WebM loop를 교체한다.
- **Phase 3**: Spline / R3F 기반 브랜드 캐릭터 제작 파이프라인으로 승격.

## 검증 기준 (build-12)

- 390px 가로 스크롤 없음 · character poster 표시 · `window.__STATUS_CHARACTER_STAGE__.mode === "asset-poster-parallax"` · HUD z-index 정상(stage 0 / HUD 10) · pointer/touch parallax 반응 · reduced-motion fallback · 4-card overview 유지.
