# Status Static Site

## 목적

Space Status 대시보드와 UI 재질 테스트 화면을 보관하는 정적 사이트입니다. 운영 화면과 시각 실험 화면은 서로 다른 경로로 분리합니다.

## 경로

- 운영 화면: `dist/index.html`
- 실시간 에이전트 상황실: `dist/agents/index.html` → `https://status.aws.shdkej.com/agents/`
- UI 재질 테스트: `dist/ui-material-test.html`
- 상태 수집기: `system-dashboard/collector/` (10분마다 `agents-live.json` 갱신)
- 배포 도메인: `https://status.aws.shdkej.com`

## Status 홈 재질

운영 Status 홈은 React 18/Vite 화면이며 `@zakisheriff/liquid-glass`의 `GlassCard`를 첫 상태 패널과 세 핵심 경로 카드에 사용합니다. 재질은 유지하되 브랜드 톤은 웜화이트(`#fffdf2`), 레몬(`#FCF9B7`·`#f9df55`), 옅은 하늘색 주변광으로 맞춥니다. 넓은 배경광과 유리의 하이라이트·굴절은 공간감을 보태고, 텍스트와 운영 신호는 짙은 잉크색으로 읽기 쉽게 유지합니다.

- 라이브러리는 작은 수의 큰 패널에만 적용합니다. 상세 목록은 읽기 성능·대비를 위해 일반 CSS 표면을 유지합니다.
- `prefers-reduced-transparency: reduce`에서는 불투명한 웜화이트 표면으로 대체하고, `prefers-reduced-motion: reduce`에서는 배경광 움직임을 끕니다.
- dependency·소스 위치: `dashboard/package.json`, `dashboard/src/main.jsx`, `dashboard/src/styles.css`; 정적 배포물은 `dist/`입니다.

## 상태 수집기 운영

실제 수집기 작업 경로는 `/home/ubuntu/workspace/space/infra-aws-static-sites/sites/status/system-dashboard/collector/`입니다. 10분 주기의 `Status dashboard collector`와 기획·개발·마케팅·디자인·운영 역할별 `Role watcher` 5개가 OpenClaw cron에서 이 경로를 사용합니다. 작업 경로를 바꿀 때는 다섯 watcher 모두의 `cwd`와 실행 인자를 함께 갱신하고, 각 작업을 수동 실행해 최근 상태가 `ok`인지 확인합니다. 비밀값이 든 `.env`는 저장소에 추가하지 않습니다.

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
cd /home/ubuntu/workspace/space/infra-aws-static-sites/sites/status/dashboard
npm install
npm run build
```

`dashboard` 번들은 `npm run build`로 `../dist/`를 갱신합니다. Vite 빌드 뒤 실제 데스크톱·모바일 브라우저 렌더와 라이브 Status 도메인 반영을 확인합니다.

라이브 피드의 `agents`가 비어 있어도 `roleWatchers`의 역할별 관찰을 Agents 메뉴에 표시한다. Loop 메뉴는 `crons` 목록만 표시한다. 크론 수집이 실패하면 카드와 빈 화면에 `확인 필요`·수집기 확인 안내를, 정상적으로 0개면 `등록된 크론 없음`을 보여 구분한다. 크론 목록이 복구되면 각 크론의 설정 상세를 연다.

브라우저에서 `http://localhost:8080/ui-material-test.html`을 열고 390px 모바일과 데스크톱 폭을 확인합니다.

## 검증

Chrome headless로 데스크톱 렌더를 확인했습니다. 모바일에서는 620px 이하에서 세 패널이 세로로 쌓이도록 반응형 전환합니다. 외부 폰트 CDN이 실패해도 시스템 폰트로 화면은 유지됩니다.

## 운영 화면 메뉴

- 첫 화면은 현재 확인해야 할 메시지와 `System`·`Agents`·`Loop` 세 가지 핵심 이동 버튼만 보여주며, 데스크톱 기준 페이지 스크롤 없이 바로 상태를 선택할 수 있습니다. 상세 레이어·표면 목록은 하단 메뉴에서 들어갑니다.
- `System`: 운영 레이어 상태와 공개 가능한 실행 흐름 요약만 표시합니다. 역할별 개별 실행 내용은 공개 요약에 포함하지 않습니다.
- `System`·`Agents`·`Monitoring`: 각 항목을 열면 바로 아래에 실제 시계열 그래프가 표시됩니다. 기간 선택은 일간(24시간)·주간(7일)·월간(30일)이며, 수집은 10분 간격입니다. Prometheus 지표는 첫 실행에 보유 구간(최대 31일)을 소급하고, 시스템 레이어·에이전트 상태는 변경 배포 이후부터 쌓입니다. 실제 원천이 없는 지표는 빈 그래프와 필요한 연결을 표시하며 0으로 꾸미지 않습니다.
- 공개 시계열 파일 `metrics-history.json`에는 공개 가능한 숫자 지표와 상태값만 저장하고 31일 뒤 오래된 점을 제거합니다. Grafana/Prometheus가 원천 정본이며 Status는 읽기 전용 그래프 복사본입니다. 정적 사이트 배포는 이 파일을 삭제 대상에서 제외해 다음 배포 뒤에도 이력이 이어집니다. 원문 로그·프롬프트·태스크 상세는 시계열에 넣지 않습니다.
- 2026-11-01 확인 기준으로 CPU·메모리·디스크·네트워크·prober p95·노드 상태, Virtue 세션·7일 재방문율·예외 수·LCP p75는 Prometheus 시계열이 확인됐습니다. 시스템·에이전트 상태 추이는 배포 후부터 쌓여 처음에는 월간 범위가 비어 있을 수 있습니다.
- 아직 실제 시계열이 없는 항목은 비즈니스 지표 8개, 신규 사용자·채널별 유입·캠페인 전환·CTA 클릭률·문의 수, 퍼널 이탈률, 로딩 p95/p99·로그인/결제 성공률·핵심 작업 완료율·INP, 자동 확장 여유, AWS Lambda 수치입니다. 각 그래프에는 임의의 0이나 예시선을 넣지 않고 현재 원천 상태를 표시합니다.
- `Monitoring`: Monitoring Personal의 공통 4개 레이어×8개 지표 카탈로그를 레이어별 접힘 목록으로 표시합니다. 기본은 모두 접힌 상태이며, 레이어 제목은 키보드나 터치로 열고 닫을 수 있습니다. 각 지표를 펼치면 해당 기간 그래프와 준비 상태가 보이고, 별도 Grafana 링크는 원본 대시보드로 이동합니다. 실제 쿼리의 정본은 Prometheus/Grafana이며, Status는 N/A를 0으로 바꾸지 않습니다. 카탈로그 상태 근거는 `monitoring_personal/docs/business-layer-design.md`입니다.
- `Surfaces`: 각 서비스의 상태와 원천 URL을 표시하며, 항목의 외부 링크 아이콘을 누르면 해당 사이트를 새 탭으로 엽니다.
- HTML·body·앱 루트를 동적 뷰포트 높이에 고정해 Safari 주소·도구 막대가 변해도 문서가 더 움직이거나 아래 빈 공간이 드러나지 않게 합니다. 바깥 문서의 스크롤·탄성 이동은 막습니다.
- 상세 메뉴에서는 본문 영역만 내부 스크롤하고 하단 내비게이션은 flex 레이아웃 끝에 고정합니다. 홈 화면도 뷰포트 안에 맞춰 세로 스크롤 없이 고정합니다.
- 상세 모달의 닫기 버튼은 Radix 모달의 접근성·포인터 범위 안인 `Dialog.Content` 내부에 두고, 화면 하단 중앙에 고정합니다. 모바일 터치 영역은 56×56px이며 safe-area를 반영합니다.
- 기본 테마는 흰색 캔버스를 사용하고, 레몬색은 로고·포커스·상태 표시 같은 강조점에만 제한적으로 사용합니다.
- 기본 상태 화면은 따뜻한 레몬빛 주변광 위에 핵심 메시지·세 가지 이동 카드·하단 내비게이션만 반투명 유리 표면으로 표현합니다. `backdrop-filter`는 이 주요 표면과 상세 패널에만 적용하고, 정보 대비를 위해 상세 행·텍스트에는 투명 블러를 반복하지 않습니다. 투명도 감소 환경에서는 불투명한 밝은 표면으로 전환합니다.
- `/agents/`는 기획·개발·마케팅·디자인·운영 5개 역할을 별도 상황실로 표시합니다. 메인 에이전트는 상단 오케스트레이터로, 각 역할은 하단 카드와 최근 관찰·전달 흐름으로 표시합니다. 메인 status 화면의 `Agents` 카드·메뉴에서 상황실로 이동할 수 있고, 상황실의 로고·하단 링크로 홈에 돌아옵니다.
- 첫 화면 상단 메시지는 `status.json`의 접점 상태와 10분 주기 `agents-live.json`의 레이어·산출물·수집기 신호를 우선순위로 조합합니다. 브라우저는 60초마다 두 피드를 다시 읽어 새로고침 없이 문구를 갱신하고, 이상 신호가 있으면 가장 먼저 확인할 대상을 보여줍니다.

## 알려진 한계

이 화면은 실제 제품의 의존성을 판별하는 것이 아니라, 스크린샷에서 관찰한 재질·아이콘·단계 표현을 비교하기 위한 시각 테스트입니다. Radix는 동작 primitive를 제공하고, 글래스 재질·단계선·인덴트의 시각 스타일은 제품에 맞춘 CSS입니다.

에이전트 상황실의 공개 피드는 `agents-live.json`이 제공하는 에이전트 롤업·크론·산출물 범위에 한정됩니다. 에이전트 간 대화 원문이나 비공개 태스크 상세는 공개하지 않으며, 현재 전달선은 실제 공개 가능한 역할 흐름을 표현하는 읽기 전용 시각화입니다.

2026-10-30 변경: CMS의 System·Flow 탭을 제거하고 System 상세에 역할 관찰 상태의 집계만 추가했습니다. 개별 실행 내용과 CMS 원본 스냅샷은 공개 Status 요약으로 복사하지 않습니다. 상세 모달의 닫기 버튼은 하단 중앙에 고정하며, 모바일에서 브라우저 문서는 스크롤되지 않고 상세 목록 영역만 스크롤됩니다. iOS Safari에서 아래 여백이 드러나지 않도록 `html`·`body`·앱 루트를 `100dvh`에 잠그고 `viewport-fit=cover`를 적용하며, 하단 내비게이션은 콘텐츠 스크롤과 분리합니다.
2026-10-30 보완: 상세 모달의 닫기 버튼이 `Dialog.Content` 바깥에 있어 Radix가 모달 외부 요소를 `aria-hidden`·`pointer-events: none`으로 격리하는 문제를 수정했습니다. 버튼을 콘텐츠 내부로 옮기고 패널의 중앙 배치를 transform 없이 유지해 닫기 버튼의 화면 하단 고정을 보존합니다. 모바일 터치 영역은 56×56px입니다.
2026-10-31 보완: 기본 Status 홈에 레몬 주변광과 절제한 반투명 유리 표면을 적용했습니다. 모바일·데스크톱 첫 화면의 메시지와 핵심 이동 경로는 유지하고, `prefers-reduced-transparency` 설정에는 불투명 표면을 제공합니다.
