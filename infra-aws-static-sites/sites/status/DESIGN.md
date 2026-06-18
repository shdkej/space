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
| 0 | `.character-stage` | WebGL 3D 캐릭터 스테이지 + CSS fallback |
| 10 | `.app-shell.hud-layer` | floating HUD (카드·내비·디테일) |

## Spatial Presence Layer

Sam Samuel 웹의 핵심 공간 문법: **"캐릭터가 공간의 주인이고, UI는 그 위에 떠 있다."** (research-15, research-16 → build-12)

- **`background-layer` (`.character-stage`)**: `position:fixed; inset:0; z-index:0; pointer-events:none`. 투명 — 기존 body 배경이 깊은 환경이고, 그 위에 Three.js 캐릭터가 뜬다.
- **`hud-layer` (`.app-shell.hud-layer`)**: `position:relative; z-index:10`. 기존 글래스 카드는 그대로 두고 z-index 보장만 추가 — 카드의 backdrop-blur 너머로 프레즌스가 은은히 비친다.
- **real 3D character**: `<canvas id="characterCanvas">`에 Three.js humanoid mesh rig를 렌더한다. 머리/헤어캡/목/어깨/몸통/팔/손/다리/코어 링/halo/orbit/motes는 실제 3D geometry이며 포인터 좌표에 따라 rig가 회전한다.
- **CSS fallback layers**: WebGL 로드 전 또는 실패 시 3겹 `.depth-far`(aura) / `.depth-mid`(presence) / `.depth-near`(motes)를 유지한다.
- **character-placement**:
  - desktop: 우측 자유 배치, 뷰포트 78% 높이, perspective + aura로 미래지향적
  - tablet: 54vh, 우측 8%, 차분하게
  - mobile (<640px): 중앙 상단 무대에 더 작고 안정적으로 배치, 4-card HUD는 아래쪽에 압축 배치
- **pointer-response**: pointer/touch 좌표 → `rig.rotation.x/y`, orbit/motes 회전. `requestAnimationFrame`에서 smoothing한다.
- **fallback-chain**: Three.js WebGL rig → CSS placeholder presence.
- **`prefers-reduced-motion: reduce`**: idle motion을 줄이고 static 3D pose 중심으로 남긴다.

### Phase 단계

- **Phase 1b (현재)**: Three.js procedural character rig. 외부 에셋 없이 실제 WebGL 캐릭터, 포인터 반응, idle motion, CSS fallback까지 동작.
- **Phase 2 (별도 intent)**: AI 생성 캐릭터 스타일을 geometry/material 또는 texture/poster로 구체화한다.
- **Phase 3**: Spline / R3F 기반 브랜드 캐릭터 제작 파이프라인으로 승격.

## 검증 기준 (build-12)

- 390px 가로 스크롤 없음 · WebGL canvas 표시 · `window.__STATUS_CHARACTER_STAGE__.mode === "three-webgl"` · HUD z-index 정상(stage 0 / HUD 10) · pointer/touch 반응 · reduced-motion fallback · 4-card overview 유지.
