# Status Static Site

## LCML 사무실

`https://status.aws.shdkej.com/office/`는 네 층의 AI 사무실입니다. 소스·데이터 계약·실행·검증·사무실 단독 배포는 [Office README](dashboard/office/README.md)가 소유합니다. 모바일 전체 보기는 네 층과 층 선택 메뉴를 한 화면에 맞추며, 개별 층의 긴 상세는 스크롤합니다. 수집기 복구 패치는 `patches/lcml-office-collector.patch`이며 운영 수집기 자체는 이번 화면 변경 대상이 아닙니다.

## 목적

Space Status 대시보드와 UI 재질 테스트 화면을 보관하는 정적 사이트입니다. 운영 화면과 시각 실험 화면은 서로 다른 경로로 분리합니다.

## 경로

- 운영 화면: `dist/index.html`
- 실시간 에이전트 상황실: `dist/agents/index.html` → `https://status.aws.shdkej.com/agents/`
- UI 재질 테스트: `dist/ui-material-test.html`
- 상태 수집기: `system-dashboard/collector/` (10분마다 `agents-live.json` 갱신)
- 배포 도메인: `https://status.aws.shdkej.com`

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

라이브 피드의 `agents`가 비어 있어도 `roleWatchers`의 역할별 관찰을 Agents 메뉴에 표시한다. Loop 메뉴는 `crons` 목록만 표시한다. 크론 수집이 실패하면 카드와 빈 화면에 `확인 필요`·수집기 확인 안내를, 정상적으로 0개면 `등록된 크론 없음`을 보여 구분한다. 크론 목록이 복구되면 각 크론의 설정 상세를 연다.

브라우저에서 `http://localhost:8080/ui-material-test.html`을 열고 390px 모바일과 데스크톱 폭을 확인합니다.

## 검증

Chrome headless로 데스크톱 렌더를 확인했습니다. 모바일에서는 620px 이하에서 세 패널이 세로로 쌓이도록 반응형 전환합니다. 외부 폰트 CDN이 실패해도 시스템 폰트로 화면은 유지됩니다.

## 운영 화면 메뉴

- 첫 화면은 현재 확인해야 할 메시지와 `System`·`Agents`·`Loop` 세 가지 핵심 이동 버튼만 보여주며, 데스크톱 기준 페이지 스크롤 없이 바로 상태를 선택할 수 있습니다. 상세 레이어·표면 목록은 하단 메뉴에서 들어갑니다.
- `System`: 운영 레이어 상태와 공개 가능한 실행 흐름 요약만 표시합니다. 역할별 개별 실행 내용은 공개 요약에 포함하지 않습니다.
- `Monitoring`: 4개 레이어에 각각 8개 지표를 묶어 표시합니다. 지표를 펼쳐 24시간·7일·30일 시계열을 확인하며, 원천이 없는 값은 비워 둡니다. 데이터는 `system-dashboard` 수집기의 `metrics-history.json`에서 읽습니다. PostHog 시계열은 exporter가 제공하는 지표만 표시하며, GA4·Instagram은 원천별 공개 시계열이 확인되기 전까지 연결된 것으로 표시하지 않습니다.
- `Surfaces`: 각 서비스의 상태와 원천 URL을 표시하며, 항목의 외부 링크 아이콘을 누르면 해당 사이트를 새 탭으로 엽니다.
- HTML·body·앱 루트를 동적 뷰포트 높이에 고정해 Safari 주소·도구 막대가 변해도 문서가 더 움직이거나 아래 빈 공간이 드러나지 않게 합니다. 바깥 문서의 스크롤·탄성 이동은 막습니다.
- 상세 메뉴에서는 본문 영역만 내부 스크롤하고 하단 내비게이션은 flex 레이아웃 끝에 고정합니다. 홈 화면도 뷰포트 안에 맞춰 세로 스크롤 없이 고정합니다.
- 상세 모달의 닫기 버튼은 Radix 모달의 접근성·포인터 범위 안인 `Dialog.Content` 내부에 둡니다. 크론 상세의 스크롤은 `infra-aws-static-sites/sites/status/dashboard/src/main.jsx`의 `.cron-dialog-scroll`이 맡고, X 버튼은 스크롤 컨테이너 밖에서 화면 하단 중앙에 고정합니다. 모바일 터치 영역은 56×56px이며 safe-area를 반영합니다.
- 기본 테마는 흰색 캔버스를 사용하고, 레몬색은 로고·포커스·상태 표시 같은 강조점에만 제한적으로 사용합니다.
- `/agents/`는 기획·개발·마케팅·디자인·운영 5개 역할을 별도 상황실로 표시합니다. 메인 에이전트는 상단 오케스트레이터로, 각 역할은 하단 카드와 최근 관찰·전달 흐름으로 표시합니다. 메인 status 화면의 `Agents` 카드·메뉴에서 상황실로 이동할 수 있고, 상황실의 로고·하단 링크로 홈에 돌아옵니다.
- 첫 화면 상단 메시지는 `status.json`의 접점 상태와 10분 주기 `agents-live.json`의 레이어·산출물·수집기 신호를 우선순위로 조합합니다. 브라우저는 60초마다 상태·운영·시계열 피드를 다시 읽어 새로고침 없이 표시를 갱신합니다. 이상 신호가 있으면 가장 먼저 확인할 대상을 보여줍니다.

## 알려진 한계

이 화면은 실제 제품의 의존성을 판별하는 것이 아니라, 스크린샷에서 관찰한 재질·아이콘·단계 표현을 비교하기 위한 시각 테스트입니다. Radix는 동작 primitive를 제공하고, 글래스 재질·단계선·인덴트의 시각 스타일은 제품에 맞춘 CSS입니다.

에이전트 상황실의 공개 피드는 `agents-live.json`이 제공하는 에이전트 롤업·크론·산출물 범위에 한정됩니다. 에이전트 간 대화 원문이나 비공개 태스크 상세는 공개하지 않으며, 현재 전달선은 실제 공개 가능한 역할 흐름을 표현하는 읽기 전용 시각화입니다.

2026-10-30 변경: CMS의 System·Flow 탭을 제거하고 System 상세에 역할 관찰 상태의 집계만 추가했습니다. 개별 실행 내용과 CMS 원본 스냅샷은 공개 Status 요약으로 복사하지 않습니다. 상세 모달의 닫기 버튼은 하단 중앙에 고정하며, 모바일에서 브라우저 문서는 스크롤되지 않고 상세 목록 영역만 스크롤됩니다. iOS Safari에서 아래 여백이 드러나지 않도록 `html`·`body`·앱 루트를 `100dvh`에 잠그고 `viewport-fit=cover`를 적용하며, 하단 내비게이션은 콘텐츠 스크롤과 분리합니다.
2026-10-30 보완: 상세 모달의 닫기 버튼이 `Dialog.Content` 바깥에 있어 Radix가 모달 외부 요소를 `aria-hidden`·`pointer-events: none`으로 격리하는 문제를 수정했습니다. 버튼을 콘텐츠 내부로 옮기고 패널의 중앙 배치를 transform 없이 유지해 닫기 버튼의 화면 하단 고정을 보존합니다. 모바일 터치 영역은 56×56px입니다.

2026-11-13: `infra-aws-static-sites/sites/status/dashboard`의 긴 크론 상세는 내부 `.cron-dialog-scroll`만 스크롤하도록 분리했습니다. `Dialog.Content`의 overflow 클리핑이 닫기 버튼에 적용되지 않게 해 X 버튼의 뷰포트 하단 중앙 고정과 Radix 접근성 경계, 모바일 safe-area·터치 영역을 유지합니다.

## 채널별 7일 실측

Status의 기존 Monitoring 지표에서 GA4 속성별 신규 사용자·세션과 PostHog 앱별 제품 세션을 확인합니다. Metrics 지도에서는 기존 유입 확인 지표와 연결해 봅니다. Instagram 피드는 `@minimal_collector`의 계정 집계와 조회 시각을 제공합니다. 기존 PostHog exporter의 공용 프로젝트 424014 전체 세션과 재방문율은 관측 시점 직전 7일 기준입니다. 별도 프로젝트·채널 피드는 완료한 7개 날짜를 표시합니다. 원천에 행이 없으면 측정값 없음으로 표시합니다. 등록된 앱의 이름과 공개 식별자는 `scripts/analytics-inventory.json`에 관리합니다. PostHog는 프로젝트 내 승인된 app_id를 각각 조회하고 app_id가 없는 이벤트는 등록된 호스트별로 구분하고 나머지는 앱 미지정으로 표시합니다. traffic_kind=synthetic 이벤트를 앱별 집계에서 제외합니다.

두 대시보드는 같은 S3 피드를 읽습니다. SAM-PC Windows 작업 스케줄러가 매일 오전 10시 15분(한국 시간)에 WSL Ubuntu 사용자 `sam`의 `refresh-analytics.py`를 실행합니다. 소스와 함께 제공하는 아래 다섯 파일을 `~/.local/share/dashboard-analytics/releases/<Space SHA>/`에 설치하고 검증한 릴리스를 `current` 심볼릭 링크로 지정합니다.

- `refresh-analytics.py`, `collect-analytics.py`, `analytics-inventory.json`
- `read-ga4-insights.mjs`, `read-instagram-insights.mjs`

Windows 예약 작업은 기존 사용자 로그온 세션에서 다음 명령을 실행합니다. 필요한 Python 패키지는 전용 `python/` 디렉터리의 boto3와 그 의존성입니다. PC를 켜고 사용자가 로그인한 뒤 놓친 예약을 보충 실행하도록 설정합니다.

```text
wsl.exe -d Ubuntu -u sam --exec /usr/bin/env PYTHONPATH=/home/sam/.local/share/dashboard-analytics/python /usr/bin/python3 /home/sam/.local/share/dashboard-analytics/current/refresh-analytics.py
```

예약 실행은 PostHog를 읽기 전용 API로, GA4 4개 속성과 Instagram을 로그인된 한국어 Egolite에서 읽습니다. 코드는 PostHog 토큰 파일과 AWS 자격 파일을 필요한 키만 읽고 브라우저의 원문 출력을 운영 로그에 기록하지 않습니다. 수집기는 이전 S3 객체의 ETag로 조건부 게시한 뒤 같은 버전을 다시 읽어 본문을 검증합니다. 다른 실행이 진행 중이면 중복 실행을 건너뜁니다. 일부 속성만 실패하면 그 행의 직전 값·관측 시각을 유지하며 실패 상태를 붙입니다. 한 원천이 모두 실패하면 해당 S3 객체를 보존하고 나머지 원천을 계속 처리합니다. 부분 실패와 전체 실패는 종료 코드 1이며 원천별 결과를 표준 출력에서 확인할 수 있습니다. 브라우저 로그인이 만료되면 해당 사이트에 다시 로그인한 후 예약 작업을 재실행합니다.

수동 원천 점검용 수집 명령은 고정된 원천에만 접속합니다. GA4는 읽기 권한의 `GA4_ACCESS_TOKEN` 또는 Google Application Default Credentials(Python google-auth 및 requests 필요), PostHog는 projects query 읽기 권한의 `POSTHOG_ACCESS_TOKEN` 또는 `POSTHOG_PERSONAL_API_KEY` 및 선택적인 `POSTHOG_HOST`, Instagram은 프로페셔널 계정의 Insights 권한을 가진 `INSTAGRAM_ACCESS_TOKEN`과 선택적인 `INSTAGRAM_ACCOUNT_ID`를 실행 환경에서 사용합니다. Instagram 응답 username을 확인한 뒤 계정 전체의 집계만 발행합니다. 토큰을 명령행 인수로 전달하지 마세요.

동일한 운영 출력 디렉터리에서 다음처럼 원천별로 실행합니다. `STATE_DIR`은 수집기 전용으로 지정한 디렉터리입니다. 다른 호스트에서 인계할 경우 기존 **해당 피드만** 먼저 내려받고, 마지막 성공값을 보존합니다. 같은 원천의 게시자는 한 번에 하나만 실행합니다.

```bash
source_name=ga4  # posthog, instagram도 같은 방식
key="analytics-${source_name}.json"
python3 scripts/collect-analytics.py "$source_name" --output-dir "$STATE_DIR" &&
  aws s3 cp "$STATE_DIR/$key" "s3://static-status-aws-shdkej-com/$key" \
    --content-type application/json --cache-control 'public,max-age=60'
```

정적 사이트 배포는 수집기 소유 객체를 제외하며 Status 버킷의 다른 파일을 삭제하지 않습니다. 집계 파일의 rows에는 승인된 범위 이름, 집계 기간·시간대, 조회 시각, 숫자와 수집 상태만 포함합니다. 최신 수집 전체가 실패하면 종료 코드 1을 반환하고 이전 파일을 유지합니다. 일부 앱이 실패하면 해당 앱의 마지막 성공 시각·값과 실패 상태를 함께 내보냅니다. 게시 후 해당 HTTPS 피드의 scope·기간·관측 시각·값을 원천과 대조하고, Status Monitoring과 Metrics 지도에서 동일한지 확인합니다.

브라우저 권한을 사용하는 경우 로그인된 Egolite의 한국어 Instagram Insights에서 `ego-browser nodejs < scripts/read-instagram-insights.mjs`로 공개 가능한 숫자만 추출합니다. 내보낸 JSON을 검증한 후 같은 Instagram 객체에 게시합니다. GA4 API 권한이 없는 속성은 해당 속성의 GA4 홈에서 ‘지난 7일’ 날짜와 ‘새 사용자 수’·‘세션수’를 확인해 같은 GA4 피드의 해당 행에 원천, 기간, 조회 시각과 함께 반영합니다. 화면 새로고침은 마지막으로 게시된 피드를 읽습니다.
