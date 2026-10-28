# Status Static Site

## 목적

Space Status 대시보드와 UI 재질 테스트 화면을 보관하는 정적 사이트입니다. 운영 화면과 시각 실험 화면은 서로 다른 경로로 분리합니다.

## 경로

- 운영 화면: `dist/index.html`
- 실시간 에이전트 상황실: `dist/agents/index.html` → `https://status.aws.shdkej.com/agents/`
- UI 재질 테스트: `dist/ui-material-test.html`
- 배포 도메인: `https://status.aws.shdkej.com`

배포 후 테스트 화면은 `https://status.aws.shdkej.com/ui-material-test.html`에서 확인합니다.

## UI 재질 테스트 범위

`ui-material-test.html`은 `ui-material-test/`의 React 소스를 Vite로 번들한 결과입니다. 실제로 다음 라이브러리를 사용합니다.

- React 18 + Vite: 컴포넌트 구조와 빌드
- Radix UI Tabs/Tooltip: 접근 가능한 탭·툴팁 primitive
- Lucide React: 선형 SVG 아이콘
- clsx: 상태별 클래스 조합

- 반투명 표면: `rgba()` + `backdrop-filter: blur()` + 내부 하이라이트
- 아이콘 버튼: `lucide-react` 아이콘과 Radix Tooltip
- 중앙 실행 목록: React 배열 데이터 + 상태 클래스 + CSS 연결선 + 단계별 `padding-left`
- 결과 표면: 읽기 안정성을 위한 낮은 투명도 테이블과 결과 입력 영역

## 로컬 확인

```bash
cd /home/ubuntu/workspace/space/infra-aws-static-sites/sites/status
python3 -m http.server 8080 --directory dist
```

에이전트 상황실을 다시 빌드하려면:

```bash
cd /home/ubuntu/workspace/space/infra-aws-static-sites/sites/status
scripts/build-agent-dashboard.sh
```

상황실은 Next.js static export, React, Framer Motion, Radix Tooltip, Lucide React를 사용하며 `dist/agents/`에 정적 결과를 생성합니다. 브라우저에서 `agents-live.json`을 60초마다 읽어 5개 역할 카드와 선택한 에이전트의 최근 활동·확인한 근거·다음 전달 방향을 갱신합니다. 공개 피드의 `roleWatchers`에는 기획·개발·마케팅·디자인·운영 와처의 상태·최근 확인 시각·활동 요약·확인한 근거가 들어갑니다. 수집기 감사 로그와 크론 실행 이력은 피드에 남지만 상황실에는 직접 노출하지 않습니다. 피드가 없거나 오래된 경우 마지막 안전 상태와 수집 대기 문구를 유지합니다.

소스를 수정하고 번들하려면:

```bash
cd /home/ubuntu/workspace/space/infra-aws-static-sites/sites/status/ui-material-test
npm install
npm run build
```

브라우저에서 `http://localhost:8080/ui-material-test.html`을 열고 390px 모바일과 데스크톱 폭을 확인합니다.

## 검증

Chrome headless로 데스크톱 렌더를 확인했습니다. 모바일에서는 620px 이하에서 세 패널이 세로로 쌓이도록 반응형 전환합니다. 외부 폰트 CDN이 실패해도 시스템 폰트로 화면은 유지됩니다.

## 운영 화면 메뉴

- 첫 화면은 현재 확인해야 할 메시지와 `System`·`Agents`·`Loop` 세 가지 핵심 이동 버튼만 보여주며, 데스크톱 기준 페이지 스크롤 없이 바로 상태를 선택할 수 있습니다. 상세 레이어·표면 목록은 하단 메뉴에서 들어갑니다.
- `System`: 삶·실행·흐름·증거의 운영 레이어 상태를 표시합니다.
- `Monitoring`: 서비스 응답, PostHog 제품 지표, 비즈니스·콘텐츠 원천, Prometheus 노드, GitHub·Notion 갱신 상태처럼 관측 가능한 신호를 표시합니다. System 레이어와 같은 목록을 재사용하지 않습니다.
- `Surfaces`: 각 서비스의 상태와 원천 URL을 표시하며, 항목의 외부 링크 아이콘을 누르면 해당 사이트를 새 탭으로 엽니다.
- 화면은 브라우저 본문 흐름을 사용하며, 내용이 실제로 화면을 넘을 때만 세로 스크롤이 생깁니다. 불필요한 내부 스크롤 컨테이너는 사용하지 않습니다.
- 홈 화면은 `100svh` 높이와 `overflow: hidden`으로 고정해 브라우저 스크롤을 허용하지 않습니다. 상세 메뉴로 들어가면 상세 화면만 일반 본문 흐름으로 돌아갑니다.
- 기본 테마는 흰색 캔버스를 사용하고, 레몬색은 로고·포커스·상태 표시 같은 강조점에만 제한적으로 사용합니다.
- `/agents/`는 기획·개발·마케팅·디자인·운영 5개 역할을 별도 상황실로 표시합니다. 메인 에이전트는 상단 오케스트레이터로, 각 역할은 하단 카드와 최근 관찰·전달 흐름으로 표시합니다. 메인 status 화면의 `Agents` 카드·메뉴에서 상황실로 이동할 수 있고, 상황실의 로고·하단 링크로 홈에 돌아옵니다.
- 첫 화면 상단 메시지는 `status.json`의 접점 상태와 10분 주기 `agents-live.json`의 레이어·산출물·수집기 신호를 우선순위로 조합합니다. 브라우저는 60초마다 두 피드를 다시 읽어 새로고침 없이 문구를 갱신하고, 이상 신호가 있으면 가장 먼저 확인할 대상을 보여줍니다.

## 알려진 한계

이 화면은 실제 제품의 의존성을 판별하는 것이 아니라, 스크린샷에서 관찰한 재질·아이콘·단계 표현을 비교하기 위한 시각 테스트입니다. Radix는 동작 primitive를 제공하고, 글래스 재질·단계선·인덴트의 시각 스타일은 제품에 맞춘 CSS입니다.

에이전트 상황실의 공개 피드는 `agents-live.json`이 제공하는 에이전트 롤업·크론·산출물 범위에 한정됩니다. 에이전트 간 대화 원문이나 비공개 태스크 상세는 공개하지 않으며, 현재 전달선은 실제 공개 가능한 역할 흐름을 표현하는 읽기 전용 시각화입니다.
