# Status Design System

`dist/index.html`의 인라인 `<style>` + `dist/assets/saem-scene.js`에서 쓰는 패턴·토큰.

## SaemScene Pattern

컴포넌트: `canvas.saem-canvas`(Three.js) + `.saem-fallback`(CSS 도형 샘) + `.app-shell`(글래스 HUD).

```
body background        실제 물결 사진 `assets/emerald-water-background.jpg` + 가독성용 light veil
canvas.saem-canvas     position:fixed; inset:0; z-index:0; pointer-events:none
                       transparent WebGL, body[data-scene="webgl"]일 때만 opacity 1 (fade-in)
.saem-fallback         CSS 조약돌+이끼+새싹+점눈+물결 — webgl 성공 시에만 display:none
.app-shell             z-index:10, 글래스 HUD
```

### JS 계약

- `initSaemScene({ canvas, mood })` (ES module, `assets/saem-scene.js`)
  - 성공: `body.dataset.scene = "webgl"` 설정, `window.__SAEM_SCENE__ = { ready:true, setMood }` 반환.
  - 실패(renderer 예외 등): 아무것도 만지지 않고 `null` — CSS 샘이 그대로 남는다.
  - `webglcontextlost` → `data-scene` 해제 → CSS 샘 복귀.
- `setMood("ok" | "warn" | "bad")`: ok = 에메랄드 아침빛 `#d5fff4`·intensity 2.4·물결 진행 / 그 외 = 고요한 물빛 `#d9e8e2`·1.1·물결 정지.
- 로더는 `index.html`의 `startSaemScene()` — dynamic `import()`라 모듈 로드 실패도 페이지를 죽이지 않는다.

### 씬 토큰 (saem-scene.js 상수)

| 상수 | 값 | 의미 |
|------|-----|------|
| `CREAM` | `#eef8f5` | fog·WebGL 안전 톤. 실제 배경은 CSS 사진 레이어 |
| `STONE` | speckle CanvasTexture (`#d9d2c6` 바탕) | 조약돌 |
| `MOSS` / `SPROUT` | `#4f9d8a` 계열 3색 / `#4f9d8a` | 이끼(우상단 유기 패치) / 새싹 — 물빛 키컬러와 연결 |
| `EYE` | `#3d3a33` | 점 눈 |
| `WATER` | `#d7f1e9` | 수면 |
| `MORNING` / `DUSK` | `#d5fff4` / `#d9e8e2` | ok / warn·bad 빛 |

### 반응형 (layout())

| 폭 | saem scale | stage 위치 | camera z |
|----|-----------|-----------|----------|
| ≥1120px | 0.66 | x 1.7 (우측 스테이지) | 5.2 |
| 740–1119px | 0.6 | x 1.25 | 5.6 |
| <740px | 0.5 | 중앙, y 0.62 (히어로와 카드 사이) | 7.2 |

카메라 lookAt은 항상 원점 고정 — stage 오프셋이 화면상 위치를 만든다 (stage를 lookAt하면 오프셋이 상쇄되므로 금지).

## HUD 글래스 토큰 (`:root`)

| 토큰 | 값 |
|------|-----|
| `--glass` | `rgba(247,255,252,0.30)` |
| `--glass-strong` | `rgba(247,255,252,0.44)` (hover) |
| `--glass-border` | `rgba(170,226,211,0.58)` |
| `--glass-blur` | `none` — blur는 밀키한 불투명감을 만들어 제거(2026-07-05 피드백 "투명한 버전이 남아야") |
| `--shadow-soft` | `0 12px 34px rgba(48,97,92,0.13)` |
| `--ok` / `--warn` / `--bad` | `#4f9d8a` / `#d9a84e` / `#c96f5f` |
| `--photo-veil` | `rgba(238,248,245,0.28)` — 사진 위 가독성 안전 톤 |

히어로·philosophy cards·상세 타일·리스트 행·하단 내비·아이콘 버튼이 모두 이 토큰만 쓴다. 새 표면을 추가할 때 개별 rgba를 만들지 말 것.

### First-screen cards

첫 화면 카드는 3개만 둔다.

- `Now`: 지금 볼 것 하나. overall score와 가장 약한 신호를 System 상세로 연결한다.
- `Balance`: 현재 기울어진 관계. Agents와 Output의 관계를 한 줄로 보여주고 Agents 상세로 연결한다.
- `Loop`: 다음 확인점. 완료 상태도 다음 수집·재확인으로 이어지게 하고 Output 상세로 연결한다.

Surfaces는 첫 화면 카드에서 빠지지만 하단 상세 내비에는 유지한다. 첫 화면은 운영 목록이 아니라 `미니멀 · 균형 · 순환`의 판단 손잡이다.

### 전환 문법

- 카드 클릭: `.is-active` → cardPulse(0.48s) + `#transitionFlash` 확산 + `body[data-mode="detail"]`로 overview blur-out(12px)/scale-down.
- 상세 ↔ 탭: `.detail-panel.is-current` + pageIn(0.42s). 하단 내비는 detail 모드에서만 표시.

### 접근성 / 성능

- `prefers-reduced-motion: reduce`: CSS 전면 정지 + 씬 elapsed 시간 동결(정적 프레임) + parallax 무시.
- pixelRatio 상한 2, `powerPreference: "low-power"`, 포인터 좌표는 저장만 하고 transform은 rAF에서 적용.
- 외부 CDN 런타임 없음 — three.js는 `assets/vendor/` 로컬.
