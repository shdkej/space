# Status Design System

`dist/index.html`의 인라인 `<style>` + `dist/assets/mascot-ambient.jpg`에서 쓰는 패턴·토큰.

## Mascot image pattern

컴포넌트: `assets/mascot-ambient.jpg`(사용자 마스코트 공간 레이어) + `.app-shell`(글래스 HUD).

```
body background        `assets/mascot-ambient.jpg` + 백색/골드 가독성용 veil
canvas.saem-canvas     기존 Saem 씬의 롤백용 DOM. 공개 화면에서는 비활성화
.saem-fallback         기존 CSS 샘 fallback. 공개 화면에서는 비활성화
.app-shell             z-index:10, 글래스 HUD
```

### 렌더 계약

- `index.html`의 body background가 `assets/mascot-ambient.jpg`를 사용한다.
- 이미지가 없어도 본문 그라데이션과 HUD가 남아 상태 정보가 유지된다.
- `status.json`의 상태값은 기존 hero/cards/detail 렌더 계약으로만 전달한다.

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
| `--ok` / `--warn` / `--bad` | `#4f9d8a` / `#d7b56b` / `#c96f5f` |
| `--photo-veil` | `rgba(238,248,245,0.28)` — 사진 위 가독성 안전 톤 |

히어로·philosophy cards·상세 타일·리스트 행·하단 내비·아이콘 버튼이 모두 이 토큰만 쓴다. 새 표면을 추가할 때 개별 rgba를 만들지 말 것.

### First-screen cards

첫 화면 카드는 3개만 둔다.

- `Now`: 지금 볼 것 하나. overall score와 가장 약한 신호를 System 상세로 연결한다.
- `Balance`: 현재 기울어진 관계. Agents와 Output의 관계를 한 줄로 보여주고 Agents 상세로 연결한다.
- `Loop`: 다음 확인점. 완료 상태도 다음 수집·재확인으로 이어지게 하고 Output 상세로 연결한다.

Surfaces는 첫 화면 카드에서 빠지지만 하단 상세 내비에는 유지한다. 첫 화면은 운영 목록이 아니라 `미니멀 · 균형 · 순환`의 판단 손잡이다.

### Spatial Type surface (2026-08-09)

- 첫 화면의 주인공은 패널이 아니라 상태 문장이다. hero는 좌측 기준선과 큰 타입으로 현재 상태와 다음 읽을 방향을 먼저 전달한다.
- Now/Balance/Loop는 독립적인 유리 카드가 아니라 상단 규칙선 아래의 세 개 읽기 행으로 표현한다. 각 행은 번호성 라벨, 핵심 수치, 다음 행동을 가진다.
- 모바일에서는 세 행을 세로 목록으로 접어 가로 스크롤과 텍스트 겹침을 금지한다. 데스크톱에서는 세 열을 유지하되 각 열 사이에 얇은 구분선만 둔다.
- 객체는 필요할 때 호출한다. 상세 탭·리스트·근거 모달의 데이터 계약과 접근성 이름은 유지한다.

### 전환 문법

- 카드 클릭: `.is-active` → cardPulse(0.48s) + `#transitionFlash` 확산 + `body[data-mode="detail"]`로 overview blur-out(12px)/scale-down.
- 상세 ↔ 탭: `.detail-panel.is-current` + pageIn(0.42s). 하단 내비는 detail 모드에서만 표시.

### 접근성 / 성능

- `prefers-reduced-motion: reduce`: CSS 전면 정지 + 씬 elapsed 시간 동결(정적 프레임) + parallax 무시.
- pixelRatio 상한 2, `powerPreference: "low-power"`, 포인터 좌표는 저장만 하고 transform은 rAF에서 적용.
- 외부 CDN 런타임 없음 — three.js는 `assets/vendor/` 로컬.
