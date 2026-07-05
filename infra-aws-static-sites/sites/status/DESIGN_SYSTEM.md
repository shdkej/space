# Status Design System

`dist/index.html`의 인라인 `<style>` + `dist/assets/saem-scene.js`에서 쓰는 패턴·토큰.

## SaemScene Pattern

컴포넌트: `canvas.saem-canvas`(Three.js) + `.saem-fallback`(CSS 도형 샘) + `.app-shell`(글래스 HUD).

```
canvas.saem-canvas     position:fixed; inset:0; z-index:0; pointer-events:none
                       body[data-scene="webgl"]일 때만 opacity 1 (fade-in)
.saem-fallback         CSS 조약돌+이끼+새싹+점눈+물결 — webgl 성공 시에만 display:none
.app-shell             z-index:10, 글래스 HUD
```

### JS 계약

- `initSaemScene({ canvas, mood })` (ES module, `assets/saem-scene.js`)
  - 성공: `body.dataset.scene = "webgl"` 설정, `window.__SAEM_SCENE__ = { ready:true, setMood }` 반환.
  - 실패(renderer 예외 등): 아무것도 만지지 않고 `null` — CSS 샘이 그대로 남는다.
  - `webglcontextlost` → `data-scene` 해제 → CSS 샘 복귀.
- `setMood("ok" | "warn" | "bad")`: ok = 아침빛 `#fff8ee`·intensity 2.4·물결 진행 / 그 외 = `#eae6dd`·1.1·물결 정지.
- 로더는 `index.html`의 `startSaemScene()` — dynamic `import()`라 모듈 로드 실패도 페이지를 죽이지 않는다.

### 씬 토큰 (saem-scene.js 상수)

| 상수 | 값 | 의미 |
|------|-----|------|
| `CREAM` | `#f5f4f1` | 배경·fog |
| `STONE` | speckle CanvasTexture (`#d9d2c6` 바탕) | 조약돌 |
| `MOSS` / `SPROUT` | `#87975f` 계열 3색 / `#7fa054` | 이끼(우상단 유기 패치) / 새싹 |
| `EYE` | `#3d3a33` | 점 눈 |
| `WATER` | `#f1efea` | 수면 |
| `MORNING` / `DUSK` | `#fff8ee` / `#eae6dd` | ok / warn·bad 빛 |

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
| `--glass` | `rgba(255,255,255,0.3)` |
| `--glass-strong` | `rgba(255,255,255,0.46)` (hover) |
| `--glass-border` | `rgba(255,255,255,0.62)` |
| `--glass-blur` | `blur(16px) saturate(1.05)` |
| `--shadow-soft` | `0 12px 34px rgba(112,92,72,0.14)` |
| `--ok` / `--warn` / `--bad` | `#8ba97c` / `#d9a84e` / `#c96f5f` |

히어로·카드·상세 타일·리스트 행·하단 내비·아이콘 버튼이 모두 이 토큰만 쓴다. 새 표면을 추가할 때 개별 rgba를 만들지 말 것.

### 전환 문법

- 카드 클릭: `.is-active` → cardPulse(0.48s) + `#transitionFlash` 확산 + `body[data-mode="detail"]`로 overview blur-out(12px)/scale-down.
- 상세 ↔ 탭: `.detail-panel.is-current` + pageIn(0.42s). 하단 내비는 detail 모드에서만 표시.

### 접근성 / 성능

- `prefers-reduced-motion: reduce`: CSS 전면 정지 + 씬 elapsed 시간 동결(정적 프레임) + parallax 무시.
- pixelRatio 상한 2, `powerPreference: "low-power"`, 포인터 좌표는 저장만 하고 transform은 rAF에서 적용.
- 외부 CDN 런타임 없음 — three.js는 `assets/vendor/` 로컬.
