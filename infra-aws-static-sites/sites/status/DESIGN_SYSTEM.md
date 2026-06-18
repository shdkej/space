# Status Design System

`dist/index.html`의 인라인 `<style>` + `dist/assets/spatial-presence.css`에서 쓰는 패턴·토큰.

## SpatialPresence Pattern

컴포넌트: `.character-stage` > `.character-layer`(`.depth-far`/`.depth-mid`/`.depth-near`) > `.sp-aura` / `.character-presence` / `.sp-motes` + `.atmosphere`.
CSS-only가 기반이고 JS pointer parallax는 옵션(없어도 정적으로 성립).

```
.character-stage            position:fixed; inset:0; z-index:0; pointer-events:none; perspective:1400px
 ├ .character-layer.depth-far   > .sp-aura            (방의 빛 / 분위기)
 ├ .character-layer.depth-mid   > .character-presence (프레즌스 — Phase2엔 <picture> poster)
 ├ .character-layer.depth-near  > .sp-motes           (전경 빛 입자)
 └ .atmosphere                                        (지평선 글로우, 정적)
```

### CSS 토큰 (`:root` 선언)

| 토큰 | 값 | 의미 |
|------|-----|------|
| `--character-z` | `0` | 배경 레이어 z-index |
| `--hud-z` | `10` | HUD 카드 z-index |
| `--hud-bg` | `rgba(244,242,234,0.75)` | HUD 카드 배경(글래스 기준값) |
| `--hud-blur` | `blur(8px)` | HUD backdrop-filter 기준값 |
| `--character-scale-desktop` | `78vh` | 데스크탑 프레즌스 높이 |
| `--character-scale-tablet` | `54vh` | 태블릿 높이 |
| `--character-scale-mobile` | `30vh` | 모바일 높이 |
| `--parallax-desktop` | `8` | 데스크탑 최대 회전각(deg) |
| `--parallax-mobile` | `3` | 모바일 최대 회전각(deg) |
| `--sp-warm` / `--sp-deep` | `208,178,132` / `150,120,84` | 프레즌스 warm/clay RGB(알파 조합용) |

`.depth-far|mid|near`는 각각 `--depth-factor: 0.28 | 0.6 | 1.0`. JS가 `getComputedStyle`로 읽어 시차 배율로 쓴다.

### 반응형

- 모바일(`max-width:639px`): `perspective:none`, 프레즌스 하단 중앙 고정, `sp-motes` 숨김, `--parallax-desktop`을 `--parallax-mobile`로 축소. JS는 `innerWidth<640`이면 parallax를 아예 걸지 않는다.
- 태블릿(640–1023px): 프레즌스 54vh, aura 축소.

### 접근성

`prefers-reduced-motion: reduce` → `.character-layer` transition/transform 강제 해제(`!important`), video 숨김, JS는 early-return. static presence만 남는다.

### 성능

- `will-change: transform` on `.character-layer`.
- parallax는 `requestAnimationFrame` throttle, 포인터 좌표만 갱신.
- Phase 2 캐릭터 이미지 도입 시 `poster.webp` preload(`fetchpriority=high`)로 LCP 보호.

### HUD 통합 규칙

기존 글래스 카드 스타일은 건드리지 않는다. HUD 래퍼(`.app-shell`)에 `.hud-layer`만 추가해 `z-index:10`을 보장하면, 카드의 `backdrop-filter`가 뒤의 프레즌스를 자연스럽게 비춘다.
