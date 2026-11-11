# Status Static Site

## 목적

Space Status 대시보드와 UI 재질 테스트 화면을 보관하는 정적 사이트입니다. 운영 화면과 시각 실험 화면은 서로 다른 경로로 분리합니다.

## 경로

- LCML 사무실: `dist/office/index.html` → `https://status.aws.shdkej.com/office/`
- LCML 상태: `office-live.json` — 기존 10분 컬렉터가 같은 버킷에 발행
- 운영 화면: `dist/index.html`
- 실시간 에이전트 상황실: `dist/agents/index.html` → `https://status.aws.shdkej.com/agents/`
- UI 재질 테스트: `dist/ui-material-test.html`
- 상태 수집기: `system-dashboard/collector/` (10분마다 `agents-live.json` 갱신)
- 배포 도메인: `https://status.aws.shdkej.com`

## LCML 사무실

LCML(Less complexity, More Life)은 AI 작업을 4층 사무실로 보여줍니다. 1층 제품실은 지니, 2층 고객실은 고딘, 3층 비즈니스실은 SAM, 4층은 대표실입니다. 사무실 배경 한 장에 4×3 캐릭터 스프라이트와 실제 텍스트 화이트보드를 겹칩니다.

소스는 `dashboard/office/`, 빌드 설정은 `dashboard/vite.office.config.js`입니다. 기존 React/Vite를 재사용하며 Next.js 서버나 별도 인증을 추가하지 않습니다. `dashboard/`에서 `npm run build:office`를 실행하면 `dist/office/`만 갱신합니다. 기본 Status 화면은 `npm run build`로 별도 빌드합니다.

컬렉터의 `office.py`는 OpenClaw 실행 메타데이터, Infinity 원장, 세 저장소 Git 상태와 프로젝트별 PostHog 지표를 읽습니다. 세션 상태와 관측 시각은 분리하며, 기록에 없는 세션·완료 이벤트·고객 지표는 만들지 않습니다. 비밀값·원문 대화·로컬 절대 경로는 공개 JSON에 넣지 않습니다. 세부 수집 설정·명령·테스트는 `system-dashboard/README.md`를 따릅니다.

화면은 30초마다 JSON을 확인하고, 데이터는 10분마다 갱신됩니다. 마지막 관측이 12분을 넘거나 세션 수집이 실패하면 캐릭터와 상태 연출을 멈추고 ‘확인 중’으로 표시합니다. Git·고객 지표의 관측 시각은 따로 표시합니다. AARRR에서 정의·연결되지 않은 단계는 0 대신 미연결 상태를 유지합니다.

배포는 기존 S3/CloudFront 경로를 사용합니다. S3 REST 원점에서 `/office/`가 열리도록 `office/index.html`과 `office/` 키에 같은 HTML을 올립니다. 정적 배포의 삭제 대상에서 `office-live.json`, `agents-live.json`, `metrics-history.json`을 제외해야 합니다. 화면 롤백은 `office/` 정적 자산만 이전 버전으로 복원하며 기존 운영 피드를 삭제하지 않습니다.

실제 렌더 검증은 데스크톱·모바일과 `prefers-reduced-motion`에서 실시합니다. 상태별 동작은 테스트 입력으로 검증하되 배포본에는 가상 사람이나 실측처럼 보이는 샘플 값을 넣지 않습니다.

### 컬렉터 소스 복구

2026-11-11 기준 하위 모듈의 기존 GitHub 원격은 404여서 직접 push하지 못했습니다. 실행 호스트의 컬렉터 소스는 `cb8bc02`로 커밋되어 있으며, 상위 저장소의 gitlink는 원격에서 받을 수 없는 새 커밋으로 바꾸지 않습니다. `patches/lcml-office-collector.patch`에 현재 gitlink `1043559` 이후의 두 커밋을 보존합니다. 첫 커밋 `312c38c`는 이번 작업 전부터 실행 중이던 시계열 수집 변경이고, 두 번째가 LCML입니다.

깨끗한 하위 모듈 checkout에서 현재 배포본을 복구할 때만 다음을 실행합니다. 이미 적용된 실행 호스트에 중복 적용하지 않습니다.

```sh
cd system-dashboard
git switch -c restore/lcml-office 1043559
git am ../patches/lcml-office-collector.patch
PYTHONPATH=collector python3 -m unittest discover -s collector/tests -p test_office.py
```

원격이 복구되면 하위 모듈 소스를 정상 push하고 gitlink를 갱신한 뒤 이 복구 패치를 제거합니다. 전체 수집기 테스트에는 기존 `test_system_rollup`의 날짜 고정 fixture 실패 1건이 있으며 수정 전에도 재현됩니다.

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
- `Monitoring`: 서비스 접점, PostHog 제품 지표, 비즈니스 지표, 콘텐츠 지표, 인프라 노드, GitHub 저장소의 6개 관측 신호를 표시합니다. Notion 콘텐츠와 에이전트 피드는 이 메뉴에 포함하지 않습니다.
- `Surfaces`: 각 서비스의 상태와 원천 URL을 표시하며, 항목의 외부 링크 아이콘을 누르면 해당 사이트를 새 탭으로 엽니다.
- HTML·body·앱 루트를 동적 뷰포트 높이에 고정해 Safari 주소·도구 막대가 변해도 문서가 더 움직이거나 아래 빈 공간이 드러나지 않게 합니다. 바깥 문서의 스크롤·탄성 이동은 막습니다.
- 상세 메뉴에서는 본문 영역만 내부 스크롤하고 하단 내비게이션은 flex 레이아웃 끝에 고정합니다. 홈 화면도 뷰포트 안에 맞춰 세로 스크롤 없이 고정합니다.
- 상세 모달의 닫기 버튼은 Radix 모달의 접근성·포인터 범위 안인 `Dialog.Content` 내부에 두고, 화면 하단 중앙에 고정합니다. 모바일 터치 영역은 56×56px이며 safe-area를 반영합니다.
- 기본 테마는 흰색 캔버스를 사용하고, 레몬색은 로고·포커스·상태 표시 같은 강조점에만 제한적으로 사용합니다.
- `/agents/`는 기획·개발·마케팅·디자인·운영 5개 역할을 별도 상황실로 표시합니다. 메인 에이전트는 상단 오케스트레이터로, 각 역할은 하단 카드와 최근 관찰·전달 흐름으로 표시합니다. 메인 status 화면의 `Agents` 카드·메뉴에서 상황실로 이동할 수 있고, 상황실의 로고·하단 링크로 홈에 돌아옵니다.
- 첫 화면 상단 메시지는 `status.json`의 접점 상태와 10분 주기 `agents-live.json`의 레이어·산출물·수집기 신호를 우선순위로 조합합니다. 브라우저는 60초마다 두 피드를 다시 읽어 새로고침 없이 문구를 갱신하고, 이상 신호가 있으면 가장 먼저 확인할 대상을 보여줍니다.

## 알려진 한계

이 화면은 실제 제품의 의존성을 판별하는 것이 아니라, 스크린샷에서 관찰한 재질·아이콘·단계 표현을 비교하기 위한 시각 테스트입니다. Radix는 동작 primitive를 제공하고, 글래스 재질·단계선·인덴트의 시각 스타일은 제품에 맞춘 CSS입니다.

에이전트 상황실의 공개 피드는 `agents-live.json`이 제공하는 에이전트 롤업·크론·산출물 범위에 한정됩니다. 에이전트 간 대화 원문이나 비공개 태스크 상세는 공개하지 않으며, 현재 전달선은 실제 공개 가능한 역할 흐름을 표현하는 읽기 전용 시각화입니다.

2026-10-30 변경: CMS의 System·Flow 탭을 제거하고 System 상세에 역할 관찰 상태의 집계만 추가했습니다. 개별 실행 내용과 CMS 원본 스냅샷은 공개 Status 요약으로 복사하지 않습니다. 상세 모달의 닫기 버튼은 하단 중앙에 고정하며, 모바일에서 브라우저 문서는 스크롤되지 않고 상세 목록 영역만 스크롤됩니다. iOS Safari에서 아래 여백이 드러나지 않도록 `html`·`body`·앱 루트를 `100dvh`에 잠그고 `viewport-fit=cover`를 적용하며, 하단 내비게이션은 콘텐츠 스크롤과 분리합니다.
2026-10-30 보완: 상세 모달의 닫기 버튼이 `Dialog.Content` 바깥에 있어 Radix가 모달 외부 요소를 `aria-hidden`·`pointer-events: none`으로 격리하는 문제를 수정했습니다. 버튼을 콘텐츠 내부로 옮기고 패널의 중앙 배치를 transform 없이 유지해 닫기 버튼의 화면 하단 고정을 보존합니다. 모바일 터치 영역은 56×56px입니다.
