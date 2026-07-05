# Status 샘(Saem) 3D 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** status.aws.shdkej.com 첫 화면을 "샘(Saem) 3D 모션 배경 + 투명 글래스 HUD" 구조로 재구축한다.

**Architecture:** 정적 사이트(`dist/`)에 로컬 번들 Three.js 모듈로 절차적 샘 씬을 렌더하고(z:0, pointer-events:none), 그 위에 투명 글래스 HUD(z:10)를 띄운다. CSS 도형 샘이 DOM에 상시 존재하고 WebGL 초기화 성공 시에만 숨겨져 fallback이 구조적으로 보장된다.

**Tech Stack:** Vanilla HTML/CSS/JS, Three.js 0.166.1 (ES module, 로컬 vendored), Pretendard.

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-07-05-status-saem-3d-redesign-design.md`
- 팔레트: 크림 `#F0EEE9`, 웜 그레이지, 올리브 이끼, 앰버 포인트. 그림자 웜 그레이 (pure black 금지).
- 브랜드 금지선: 과장된 귀여움·큰 눈 금지, 씬 안에 텍스트/로고 렌더 금지.
- 첫 화면 `100svh` one-screen, 390px 가로 스크롤 없음.
- 외부 CDN 런타임 의존 금지 (Pretendard 폰트 CSS는 기존 유지).
- `prefers-reduced-motion: reduce` → 애니메이션·parallax 정지.

---

### Task 1: three.js 로컬 vendoring + 씬 파일 골격

**Files:**
- Create: `infra-aws-static-sites/sites/status/dist/assets/vendor/three.module.min.js` (스크래치패드에 다운로드된 0.166.1 복사)
- Create: `infra-aws-static-sites/sites/status/dist/assets/saem-scene.js`
- Delete: `infra-aws-static-sites/sites/status/dist/assets/character/status-companion-v1.webp`, `status-hers-realistic-bg.png`, `status-wellness-glass-bg.png`, `spatial-presence.css` (구 에셋 정리)

**Interfaces:**
- Produces: `saem-scene.js`가 ES module로 `initSaemScene({ canvas, mood })`를 export. 성공 시 `document.body.dataset.scene = "webgl"` 설정 + `window.__SAEM_SCENE__ = { ready:true, setMood(mood) }`. 실패 시 아무것도 설정하지 않음(→ CSS 샘 유지).
- `setMood(mood)`: `"ok" | "warn" | "bad"` — 빛 강도·색온도·물결 진폭 전환.

**Steps:**
- [ ] scratchpad의 `three.module.min.js`를 `dist/assets/vendor/`로 복사
- [ ] 구 에셋 4개 삭제 (`git rm`)
- [ ] `saem-scene.js` 골격 작성: renderer 생성 try/catch, 실패 시 조용히 return

### Task 2: 샘 3D 씬 구현 (`saem-scene.js`)

**Files:**
- Modify: `infra-aws-static-sites/sites/status/dist/assets/saem-scene.js`

**씬 구성 (스펙 그대로):**
- 조약돌: `SphereGeometry` scale(1, 0.78, 0.92) + `MeshStandardMaterial`(matte greige `#cfc4b6`, roughness 0.95)
- 이끼 캡: 작은 squashed sphere 클러스터(올리브 `#8a9a6b`) 머리 위, 새싹: 가는 cylinder + 잎 2장(작은 flattened sphere)
- 점 눈 2개: 아주 작은 dark-warm-gray sphere (`#4a4238`)
- 수면: 큰 `CircleGeometry` 평면 + 동심원 물결 shader 없이 — ring geometry 3~4개가 스케일/페이드로 퍼지는 애니메이션 (단순 유지)
- 빛: 좌상단 `DirectionalLight`(따뜻한 아침빛 `#fff2df`) + `AmbientLight`(크림), 배경 `scene.background = #f0eee9` + `Fog`
- 빛 입자: `Points` 20~30개, 느린 부유
- 카메라: 느린 사인 드리프트 + 포인터 parallax (rAF smoothing, lerp 0.06)
- `setMood`: ok=빛 1.0·물결 진행 / warn·bad=빛 0.55·색온도 하강·물결 정지(고요한 수면)
- `prefers-reduced-motion` → rAF 루프에서 시간 정지(정적 1프레임 유지), parallax 무시
- resize 핸들러, `pixelRatio` 상한 2

**Steps:**
- [ ] 지오메트리·라이트·수면 링 애니메이션·parallax·mood 구현
- [ ] 로컬 서버(`python3 -m http.server`)로 렌더 확인

### Task 3: index.html 재구축 — Status 히어로 + 투명 글래스 HUD + CSS 샘 fallback

**Files:**
- Modify: `infra-aws-static-sites/sites/status/dist/index.html`

**변경:**
- 여행 콘텐츠(TRAVEL_DATA_URL, loadTravelSnapshot, World trip 카피) 제거 → Status 히어로: kicker "Space status", 타이틀에 overall 상태 문구, 메타에 score·surfaces OK·updated
- `<canvas id="saemCanvas">`(z:0) + CSS 샘 fallback DOM(`.saem-fallback`: 둥근 div 조약돌 + 이끼 blob + 점 눈 2개, `body[data-scene="webgl"]`일 때 숨김)
- 4카드: 알약 → 투명 글래스 카드 (`rgba(255,255,255,0.3)` + blur + 1px 흰 보더), `display:none` 처리된 상태값 복원 — label, 핵심 수치, 상태 dot, sub 카피
- 히어로 패널도 투명 글래스로 (현재 0.78 불투명 → ~0.35)
- 상세: summary 타일·리스트 행·하단 내비·아이콘 버튼 전부 동일 글래스 토큰으로 통일 (`--glass-panel`, `--glass-border` CSS 변수 신설)
- 클릭 이펙트: cardPulse + flash + blur-out 유지, 카드 클릭 시 씬 mood는 유지(상세 진입해도 배경은 계속 살아있음)
- `render(data)`에서 `initSaemScene` 호출 + overall state를 `setMood`로 전달
- module script 로드: `<script type="module">` 안에서 `import { initSaemScene } from "./assets/saem-scene.js"` — import 실패 시 CSS 샘 유지

**Steps:**
- [ ] HTML/CSS/JS 수정
- [ ] 로컬 서버에서 데스크탑·390px 확인 (가로 스크롤, one-screen, 카드 상태값, 전환)

### Task 4: 검증

- [ ] 브라우저 검증: 씬 렌더 + 물결 모션 + parallax
- [ ] WebGL 강제 실패 테스트(모듈 경로를 잠시 깨거나 devtools로 컨텍스트 차단) → CSS 샘 표시 확인
- [ ] `status.json`의 overall.state를 warn으로 바꿔 mood 전환 확인 후 원복
- [ ] 390px 가로 스크롤 없음 + 첫 화면 스크롤 없음
- [ ] reduced-motion 에뮬레이션 → 정지 확인

### Task 5: 문서 갱신 + 커밋

**Files:**
- Modify: `infra-aws-static-sites/sites/status/DESIGN.md`, `DESIGN_SYSTEM.md`

- [ ] DESIGN.md: 레이어 구조·씬 문법·fallback 체인을 이번 구조로 교체 (여행 히어로 변경분이 이 리디자인으로 대체됨을 기록)
- [ ] DESIGN_SYSTEM.md: SpatialPresence 패턴 → SaemScene 패턴으로 교체, 글래스 토큰 표 갱신
- [ ] `git add` 후 커밋: `feat(status): 샘(Saem) 3D 모션 배경 + 투명 글래스 HUD 리디자인`
