# Status Design System

`dist/index.html`의 인라인 `<style>` + `dist/assets/spatial-presence.css`에서 쓰는 패턴·토큰.

## SpatialPresence Pattern

컴포넌트: `.character-stage` > `#characterCanvas.character-canvas` + fallback `.character-layer`(`.depth-far`/`.depth-mid`/`.depth-near`) + `.atmosphere`.
기본은 Three.js WebGL 캐릭터이고, CSS layer는 로드 실패 fallback이다.

```
.character-stage            position:fixed; inset:0; z-index:0; pointer-events:none; perspective:1400px
 ├ canvas.character-canvas                           (Three.js 3D 캐릭터 rig)
 ├ .character-layer.depth-far   > .sp-aura            (fallback 방의 빛)
 ├ .character-layer.depth-mid   > .character-presence (fallback 프레즌스)
 ├ .character-layer.depth-near  > .sp-motes           (fallback 전경 빛 입자)
 └ .atmosphere                                        (지평선 글로우)
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

`.depth-far|mid|near`는 fallback 전용이다. WebGL이 준비되면 `.character-stage.is-webgl-ready`가 붙고 CSS fallback layer는 숨는다.

### WebGL 캐릭터

- Three.js module은 `https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js`에서 로드한다.
- 캐릭터는 외부 에셋 없는 procedural mesh rig다: `CapsuleGeometry` body/arms, `SphereGeometry` head, visor bar, core `TorusGeometry`, halo/orbit/motes.
- `window.__STATUS_CHARACTER_STAGE__ = { mode: "three-webgl", ready: true, interactive: true }`를 설정해 검증 가능하게 한다.
- pointer/touch 좌표를 smoothing해 `rig.rotation.x/y`에 반영한다. idle motion은 head/core/halo/orbit/motes만 작게 움직인다.

### 반응형

- 모바일(`max-width:639px`): 캐릭터는 중앙 상단에 작게 두고, 4-card HUD는 하단 48svh 안으로 압축한다. pointer/touch 반응은 유지하되 회전 폭을 줄인다.
- 태블릿(640–1023px): 프레즌스 54vh, aura 축소.

### 접근성

`prefers-reduced-motion: reduce` → CSS transition/transform 강제 해제(`!important`), WebGL idle motion은 줄이고 static pose를 유지한다.

### 성능

- renderer pixel ratio는 모바일 1.25, 데스크탑 1.7로 제한한다.
- pointer 이벤트는 좌표만 갱신하고, smoothing/렌더는 `requestAnimationFrame`에서 처리한다.
- Three.js CDN 로드 실패 시 CSS fallback이 남아 빈 배경이 되지 않는다.

### HUD 통합 규칙

기존 글래스 카드 스타일은 건드리지 않는다. HUD 래퍼(`.app-shell`)에 `.hud-layer`만 추가해 `z-index:10`을 보장하면, 카드의 `backdrop-filter`가 뒤의 프레즌스를 자연스럽게 비춘다.
