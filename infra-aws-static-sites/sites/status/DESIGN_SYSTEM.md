# Status Design System

`dist/index.html`의 인라인 `<style>` + `dist/assets/spatial-presence.css`에서 쓰는 패턴·토큰.

## SpatialPresence Pattern

컴포넌트: `.character-stage` > `.character-layer`(`.depth-far`/`.depth-mid`/`.depth-near`) + `.atmosphere`.
기본은 디자인된 캐릭터 poster asset이고, CSS/JS layer가 포인터 parallax를 담당한다.

```
.character-stage            position:fixed; inset:0; z-index:0; pointer-events:none; perspective:1400px
 ├ .character-layer.depth-far   > .sp-aura            (방의 빛)
 ├ .character-layer.depth-mid   > img.character-poster (디자인된 캐릭터 에셋)
 ├ .character-layer.depth-near  > .sp-motes           (전경 빛 입자)
 └ .atmosphere                                        (지평선 글로우)
```

### CSS 토큰 (`:root` 선언)

| 토큰 | 값 | 의미 |
|------|-----|------|
| `--character-z` | `0` | 배경 레이어 z-index |
| `--hud-z` | `10` | HUD 카드 z-index |
| `--hud-bg` | `rgba(244,242,234,0.75)` | HUD 카드 배경(글래스 기준값) |
| `--hud-blur` | `blur(8px)` | HUD backdrop-filter 기준값 |
| `--character-scale-desktop` | `92vh` | 데스크탑 캐릭터 포스터 높이 |
| `--character-scale-tablet` | `64vh` | 태블릿 높이 |
| `--character-scale-mobile` | `44vh` | 모바일 높이 |
| `--parallax-desktop` | `8` | 데스크탑 최대 회전각(deg) |
| `--parallax-mobile` | `3` | 모바일 최대 회전각(deg) |
| `--sp-warm` / `--sp-deep` | `208,178,132` / `150,120,84` | 프레즌스 warm/clay RGB(알파 조합용) |

`.depth-far|mid|near`는 stage의 기본 깊이 레이어다. 캐릭터 에셋은 `.depth-mid`에 들어가며, `.depth-far`와 `.depth-near`는 분위기와 포인터 깊이감을 만든다.

### 캐릭터 에셋

- 현재 에셋은 `dist/assets/character/status-companion-v1.webp`이다.
- 캐릭터는 코드 도형으로 조립하지 않는다. 먼저 stylescape/프롬프트/생성 또는 모델링으로 디자인된 사람 형상의 에셋을 만든 뒤 stage에 올린다.
- `window.__STATUS_CHARACTER_STAGE__ = { mode: "asset-poster-parallax", ready: true, interactive: true }`를 설정해 검증 가능하게 한다.
- pointer/touch 좌표를 smoothing해 `.depth-far|mid|near`의 transform에 반영한다.

### 반응형

- 데스크탑(`min-width:1120px`): HUD grid를 좌측 조종석으로 제한하고, 캐릭터는 우측 stage에서 크게 보이게 둔다.
- 모바일(`max-width:639px`): 캐릭터는 중앙 상단에 작게 두고, 4-card HUD는 하단 48svh 안으로 압축한다. pointer/touch 반응은 유지하되 회전 폭을 줄인다.
- 태블릿(640–1023px): 프레즌스 64vh, aura 축소.

### 접근성

`prefers-reduced-motion: reduce` → CSS transition/transform 강제 해제(`!important`), static poster를 유지한다.

### 성능

- 캐릭터 WebP는 preload한다.
- pointer 이벤트는 좌표만 갱신하고, transform 적용은 `requestAnimationFrame`에서 처리한다.
- 별도 WebGL runtime을 로드하지 않아 CDN 실패·GPU 실패 때 빈 배경이 되지 않는다.

### HUD 통합 규칙

HUD 래퍼(`.app-shell`)에 `.hud-layer`를 추가해 `z-index:10`을 보장한다. 데스크탑에서는 HUD grid 폭을 줄여 우측 stage의 캐릭터가 실제로 보이게 하고, 모바일에서는 기존 4-card one-screen 구조를 유지한다.
