# Status Static Site

## Agents

`https://status.aws.shdkej.com/#agents`는 Status의 **Agents** 메뉴입니다. 네 층의 기존 AI 사무실을 공통 메뉴 안에서 표시하며, 이전 `/#office`·`/office/`·`/office/index.html`·`/office`와 `/agents/` 주소도 이 메뉴로 연결합니다. 소스·데이터 계약·실행·검증·사무실 단독 배포는 [Office README](dashboard/office/README.md)가 소유합니다. 모바일 전체 보기는 네 층과 층 선택 메뉴를 한 화면에 맞추며, 개별 층의 긴 상세는 스크롤합니다. 수집기 복구 패치는 `patches/lcml-office-collector.patch`입니다. 모니터링 전용 수집 제거와 공유 수집 범위는 아래 운영 절차를 따릅니다.

## 목적

Space Status 대시보드와 UI 재질 테스트 화면을 보관하는 정적 사이트입니다. 운영 화면과 시각 실험 화면은 서로 다른 경로로 분리합니다.

## 홈 — 확인이 필요한 항목 수

2026-11-28 사용자 선택에 따라 고정 점수 98/82를 제거하고 **확인 필요 N건**을 표시합니다. 숫자를 누르면 해당 항목과 이유가 나오며, 각 행에서 Loop·Surfaces·System으로 이동합니다. 현재 화면의 집계는 `dashboard/src/attention.js`가 소유합니다.

- 활성 자동 작업의 최근 오류, 서비스의 비정상 응답, 원본별 수집 실패를 셉니다. 비활성 작업·신규 작업의 실행 전 상태는 오류로 세지 않습니다.
- 같은 원본의 audit 오류와 집계 실패는 한 건입니다. 이 결과를 요약한 L2·L3 레이어 상태는 다시 더하지 않습니다. Notion 미지정 수·Linear backlog 자체도 장애 건수로 세지 않습니다.
- 조회 실패·형식 오류는 정상 0건과 구분합니다. 10분 주기 운영·업무 집계 피드가 2시간 넘게 갱신되지 않으면 피드별 한 건으로 표시하고, 그 피드에 남은 과거 오류를 중복으로 세지 않습니다. 최초 로딩은 `—`이며 요청은 10초 후 실패 처리합니다.
- `status.json`의 서비스 응답은 **최근 정적 배포 때의 HTTP 점검**입니다. 상시 장애 감지나 가동률이 아니며, 이 숫자가 모든 운영 문제를 포괄하지는 않습니다. 운영 피드는 10분 수집, 화면은 1분 재조회입니다.

상태 생성기의 `overall.score`는 제거했습니다. 숫자에는 tabular 숫자·정상 자간을 적용하고, 모바일에서는 설명과 숫자의 열을 명시합니다. 버튼 양쪽에 8px 여백을 두어 왼쪽 라벨·상태 점의 4px 그림자와 오른쪽 숫자가 스크롤 영역 경계에서 잘리지 않게 합니다. 집계 회귀 테스트와 기존 UI 테스트(`dashboard/`의 `npm test`), `npm run build`, 모바일·데스크톱의 숫자/상세 목록/실패 상태 검증 후 기존 Space main AWS 배포를 사용합니다. 수집기·인증·타이머를 변경하지 않습니다. 복구는 해당 UI·생성기 커밋을 revert하고 동일하게 배포합니다.

## KL 반영 맵

하단 **KL 맵** 메뉴와 `/#knowledge`에서 문서별 반영 상태, 승격 대기 목록, 원본 및 Wiki 링크를 확인합니다. 화면을 열면 Infinity의 공개 `data/promotion-index.json`을 직접 읽습니다.

## 경로

- 운영 화면: `dist/index.html`
- 에이전트 화면: Status `/#agents`의 네 층 장면. 이전 요약·상태 이력 화면은 제거했습니다. `/agents/`·`/agents/index.html`·`/agents`는 이 메뉴로 이동하는 작은 HTML만 유지합니다.
- UI 재질 테스트: `dist/ui-material-test.html`
- 상태 수집기: `system-dashboard/collector/` (10분마다 `agents-live.json` 갱신)
- 배포 도메인: `https://status.aws.shdkej.com`

## 상태 수집기 운영

실제 수집기 작업 경로는 `/home/ubuntu/workspace/space/infra-aws-static-sites/sites/status/system-dashboard/collector/`입니다. `system-dashboard-collector.timer`가 10분마다 System·Agents·Loop·Office 피드를 갱신합니다. 별도 역할 watcher와 기존 DB/액션 처리, Grafana exporter·Prometheus 설정은 이 변경에서 유지합니다. 비밀값이 든 `.env`는 저장소에 추가하지 않습니다.

2026-11-27 사용자 요청으로 Monitoring 메뉴·32개 지표 정의·전용 분석 피드 요청과 렌더 코드를 제거했습니다. 수집기의 15개 수치 시계열과 31일 Prometheus 보강, 추가 제품·비즈니스 조회 및 Apify Threads/content-live 수집도 제거했습니다. 기존 모니터링 묶음의 Prometheus 조회는 주기당 23회에서 **System 노드 목록 1회**로 줄었습니다. GitHub 최근 커밋은 System의 아티팩트 표시에 필요하므로 유지하고 공개 피드의 `monitoring` 대신 `evidence`로 제공합니다. 노드 목록은 등록 여부이며 건강 판정이 아닙니다.

`metrics-history.json`은 System 4개 레이어·Flow·Agents의 **6개 상태 지표**만 31일 보존합니다. 전환 전 원본 역사 파일을 호스트에 사본으로 남기고, 다음 기록부터 제거한 수치 지표를 제외합니다. Office 프로젝트 지표는 `office.prometheus_service`의 묶음 쿼리 1회로 유지합니다. UI는 배포 전후 호환을 위해 이전 `monitoring`의 공유 항목도 잠시 읽을 수 있지만 Monitoring 메뉴나 수치 차트를 다시 노출하지 않습니다.

수집기 원격 `shdkej/system-dashboard`는 현재 Git/API에서 Repository not found/404입니다. 이번 소스·설정·테스트·문서 변경은 기존 `patches/lcml-office-collector.patch`에 간소화와 테스트 호환 패치로 Space main에 보관합니다. 로컬 수집기 변경 커밋은 `532b344`이며 기존 `collect_crons` 최적화 수정은 별도로 보존합니다. 기존 복구 패치의 기준은 `1043559`이고 전체 패치열은 `git am`으로 재현합니다. 이미 Office 패치까지 반영된 운영 checkout에는 간소화(`532b344`)와 뒤따르는 테스트 호환·실행 경로 변경만 `git apply --check` 후 적용합니다. 서브모듈 포인터를 접근 불가능한 새 커밋으로 바꾸거나 새 저장소를 만들지 않습니다.

검증·게시 순서: collector의 `PYTHONPATH=collector python3 -m unittest discover -s collector/tests` → Status `npm ci --ignore-scripts && npm run build` → 복구 패치 재현 검증 → Space main push/Status AWS 배포 → 기존 타이머가 실행 중이지 않을 때 요청 변경 적용 → `python3 collector.py --publish-public-only` → 공개 피드 및 PC·모바일 네 메뉴 확인입니다. 공개 전용 실행은 DB·액션 큐를 처리하지 않습니다. 복구는 UI 커밋 revert, 수집기 간소화 패치(`532b344`) 역적용, 보관한 역사 파일 복원입니다. 다른 에이전트/크론 설정이나 과거 데이터를 전체 reset하지 않습니다.

배포 후 테스트 화면은 `https://status.aws.shdkej.com/ui-material-test.html`에서 확인합니다.

### L2 운영 집계 — ARM 단일 게시자

2026-11-28부터 Notion·Linear 집계는 `oracle-arm-2`의 기존 사용자 `system-dashboard-collector.timer`가 게시합니다. 실제 `Triggers=system-dashboard-collector.service`, 작업 경로는 위 `system-dashboard/collector/`, 진입점은 `/usr/bin/python3 .../collector/collector.py`입니다. 기존 `OnCalendar=*:0/10`, `Persistent=true`와 S3 버킷 `static-status-aws-shdkej-com`을 재사용합니다. SAM-PC의 제거된 수집기는 재설치하지 않습니다.

- Notion 데이터 소스 `68b8485f-29f4-4bed-a0e1-459cf18c69df`의 활성 페이지를 끝까지 순회해 전체 수와 `플랫폼` select가 비어 있는 수를 동시에 계산합니다. 같은 결과를 기존 Notion 요약과 L2 집계에 사용합니다.
- Linear는 연결된 워크스페이스의 접근 가능한 미보관 이슈 중 `state.type == backlog`를 팀 제한 없이 끝까지 순회합니다.
- `marketing-inbox-7d` 원본 조회·집계 설정은 제거했습니다. 이후 같은 날 사용자 요청으로 `kl-summarized`도 아래 source 추가 집계로 교체했습니다.
- `work-counts.json`은 `notion: {total, withoutPlatform, status}`, `linear: {backlog, status}`, UTC `observedAt`만 담습니다. 서비스별 조회 실패는 해당 서비스만 `{status: unavailable}`로 게시하고, 정상 0건은 `status: ok`로 구분합니다. 다른 공개 피드 실패와 독립적으로 게시하며 캐시는 60초입니다.

ARM 인증은 `/home/ubuntu/.config/system-dashboard/notion.env`의 `NOTION_SOCIAL_MEDIA_API_KEY`, 같은 디렉터리 `linear.env`의 `LINEAR_API_KEY`를 읽습니다. 키는 기존 ARM 인증에서 연결하며 파일 권한은 600입니다. 키·페이지/이슈 제목·ID·API 응답 원문은 피드·Git·로그에 넣지 않습니다. manifest는 파일 경로만 소유하므로 systemd의 대화형 셸 환경에 의존하지 않습니다.

소스 변경은 `collector/collector.py`, `collector/manifest.yaml`, `collector/tests/test_work_counts.py`, `system-dashboard/README.md`입니다. 독립 저장소 404 상태에 따른 기존 배포 계약대로 소스 커밋 `8a3fa16`과 타입 검증 보완 `7e30336`을 `patches/lcml-office-collector.patch` 끝에 추가했습니다. 기준 `1043559`부터 전체 `git am` 재현 및 103개 테스트를 통과했습니다. 운영 checkout의 기존 크론 조회 최적화는 보존했습니다. 정적 L2 화면 코드는 이미 해당 피드를 읽으므로 변경하지 않았습니다.

배포·검증은 수집기 테스트 → 서비스가 inactive일 때 변경 파일 백업 및 최신 패치 `git apply --check`/적용 → `--publish-public-only` → 공개 두 피드 검사 → 기존 타이머의 다음 자동 실행 → 운영 `/#system` L2와 공개 집계 대조 순서입니다. 공개 전용 첫 실행은 기존 DB·액션 처리를 건드리지 않습니다. 정기 실행은 원래 서비스 경로를 따릅니다. S3 업로드 성공과 공개 CDN 갱신은 캐시 때문에 시차가 있을 수 있어 두 단계를 따로 검사합니다.

첫 공개 검증: `2026-11-28T01:21:46Z` 관측에서 Notion **219**, 플랫폼 없음 **65**, Linear backlog **0**, 모두 `ok`. 같은 피드의 `agents-live.json`에는 `marketing-inbox-7d`가 없고 `kl-summarized` **19**가 유지됐습니다. 운영 L2에서도 같은 세 숫자를 확인했습니다.

자동 실행 검증: 기존 타이머가 **2026-11-28 01:30:06 UTC**에 실행했고 **01:30:29 UTC**에 exit 0으로 종료했습니다. `work-counts.json.observedAt`은 **01:21:46Z → 01:30:12Z**, `agents-live.json.generatedAt`은 **01:30:25Z**로 갱신됐습니다. 최종 Notion 219·플랫폼 없음 65·Linear backlog 0, kl-summarized 19가 유지됐고 marketing-inbox-7d는 없습니다. 다음 예약은 01:40 UTC입니다.

복구 자료는 ARM `/home/ubuntu/.local/state/openclaw/backups/status-l2-20261128/`에 있습니다. 최신 L2 패치만 역적용하거나 해당 변경 전 파일을 복원한 뒤 공개 전용 실행으로 재게시합니다. 타이머·기존 다른 작업 변경을 전체 reset하지 않습니다. API 권한 밖의 페이지·이슈는 집계되지 않으며, 조회 도중 원본 편집에 대한 트랜잭션 스냅샷은 보장되지 않습니다.

L2 펼침 상세는 **무엇을 수집하는지**를 보여줍니다. Notion은 소셜 미디어 콘텐츠의 **플랫폼 미지정/전체**를 한 행으로 합쳐 `65 / 219건`처럼 표시하고, Linear 미보관 backlog와 Knowledge Lab source 문서의 최근 24시간/7일 추가 건수를 포함한 세 행으로 구성합니다. 값은 현재 피드에서 읽으며 0건과 미수집을 구분합니다. 2026-11-28 사용자 피드백 “노션은 미지정/전체 이렇게 합쳐야하고 디자인 좀 기존에 맞게 해라”에 따라, 중첩 테두리 카드·별도 제목을 제거하고 기존 목록의 `history-item-copy`·`row-state` 글자 크기와 정렬·구분선을 재사용합니다. 콘텐츠 제목·원문 목록은 게시하지 않습니다.

이 상세 화면 변경은 `dashboard/src/{systemLayers.js,main.jsx,styles.css}`가 소유합니다. `dashboard/`에서 `npm test` → `npm run build` → PC·모바일 L2 펼침/접기·키보드·실패 상태 확인 후, 변경한 소스와 `dist/`를 Space main에 게시합니다. 기존 AWS 정적 배포는 운영 JSON을 보존합니다. 수집기·10분 타이머·공개 피드 스키마는 바뀌지 않습니다. 화면 복구는 해당 UI 커밋을 revert하고 같은 배포를 실행합니다.

### Knowledge Lab — source 문서 추가

2026-11-28 사용자 지시 “kl에 source에 추가된 문서 수”, “일별,주별로”, “간단한걸로”를 적용했습니다. L2의 기존 Knowledge Lab 행은 `source 추가 · 최근 24시간 / 7일`과 두 집계 숫자만 표시합니다. KL 맵의 위키 반영 상태와 중복되는 집계나 차트를 추가하지 않습니다.

수집기는 ARM `/home/ubuntu/workspace/knowledge-lab`의 Git HEAD 첫 부모 이력에서 `source/**/*.md`, `source/**/*.mdx` 일반 파일의 추가를 집계합니다. 기간은 관측 시점 직전 24시간·7일이며 커밋 committer UTC 시각을 사용합니다. 기간 내 경로별 한 번만 세고 수정·Git이 인식한 이름 변경·심볼릭 링크·미커밋 파일은 제외합니다. 추가 뒤 삭제된 문서는 기간 내 추가 건수에 남습니다. 따라서 현재 파일 총수나 작성일·수정일 기준 집계와 다릅니다.

`agents-live.json.system.knowledgeSource`는 `{added24h, added7d, status}`만 공개하고, 정상 0건과 `status: unavailable`을 구분합니다. `kl-summarized`의 마케팅 원본 조회와 30/60건 경고 기준을 제거했습니다. 기존 Notion·Linear 피드와 10분 타이머를 재사용합니다. 구현은 collector 코드·manifest·테스트, `dashboard/src/systemLayers.js`이며 수집기 변경은 기존 복구 패치열에 추가합니다. 테스트 → 복구 패치 재현 → 운영 적용·첫 게시 → UI 빌드·기존 AWS 배포 → 공개 피드·모바일/데스크톱 검증 순서입니다. 복구는 이번 패치만 역적용하고 UI 커밋을 revert합니다.

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

사무실과 Status를 함께 빌드하려면:

```bash
cd dashboard
node --test office/test/*.test.*
npm run build:all
```

`build:all`은 기존 Status와 Office Vite 진입점을 빌드합니다. 사무실은 같은 출처의 `/office/?embedded=1` 프레임으로 표시해 장면 CSS와 Status 스타일을 분리합니다. 프레임에는 수집 상태와 층 선택만 남기며 공통 헤더·메뉴·새로고침은 Status가 소유합니다. 사무실을 떠나면 프레임을 해제하므로 별도 화면의 폴링도 중지합니다. 메뉴는 hash 주소를 사용해 직접 링크·새로고침·뒤로/앞으로 이동을 지원합니다.

`agent-dashboard/` 소스·Next.js 의존성·`build-agent-dashboard.sh`·배포된 Next 자산은 제거했습니다. `dashboard/scripts/build-redirects.mjs`가 이전 주소의 이동 HTML을 재생성합니다. 공개 피드와 Agents·Loop·System 화면은 계속 같은 수집기를 사용합니다. Agents는 `office-live.json`의 등록 인원·실행 세션·판단 대기를 보여줍니다.

## 검증

Chrome headless로 데스크톱 렌더를 확인했습니다. 모바일에서는 620px 이하에서 세 패널이 세로로 쌓이도록 반응형 전환합니다. 외부 폰트 CDN이 실패해도 시스템 폰트로 화면은 유지됩니다.

## 운영 화면 메뉴

공통 푸터에는 `Space status`만 표시합니다. 2026-11-28 사용자 요청으로 읽기 전용 안내 문구를 제거했습니다.

- 첫 화면은 현재 확인해야 할 메시지와 `System`·`Agents`·`Loop` 세 가지 핵심 이동 버튼만 보여주며, 데스크톱 기준 페이지 스크롤 없이 바로 상태를 선택할 수 있습니다. 상세 레이어·표면 목록은 하단 메뉴에서 들어갑니다.
- `System`: 삶(데일리 리뷰), 업/시스템(크론·백로그·인프라), 워크플로우(Prompt Archive의 기획·개발·마케팅·운영 파일 줄 수), 아티팩트(지정한 저장소 5개의 최근 커밋 시각)를 표시합니다. 삶의 상태 시계열은 `system.layer.l1`에서 읽습니다. L2와 L4를 펼치면 현재 관측값을 볼 수 있습니다. L3는 Prompt Archive의 `.agent/workflows/{planner,developer,marketer,operator}.md` 변경 시 Git 이력으로 생성하는 `data/workflow-line-counts.json`을 읽습니다. 그래프는 한국 시간으로 최근 14일·12주(월요일 시작)·12개월의 기간 말 파일 줄 수를 표시합니다. 현재 기간에는 조회한 시점의 값을 표시하고, 변경 없는 기간은 직전 파일 상태를 이어갑니다. 생성 전이나 삭제된 파일은 결측으로 표시합니다. L4의 Infinity·OpenClaw Backups·Knowledge Lab은 운영 피드의 `evidence.github`에서, Agent Wiki·shdkej.github.io는 System 화면에서 10분마다 GitHub 공개 API의 기본 브랜치 최근 커밋에서 확인합니다. L4 그래프는 공통 가로 날짜축(한국 시간)에 저장소별 마지막 커밋을 점 하나로 표시합니다. 일간·주간·월간 선택은 L1·L3에 적용되며, L4는 다섯 저장소를 함께 비교합니다. 시각을 확인할 수 없는 저장소는 행에 미확인으로 표시합니다.
- `Surfaces`: 정사각형 타일에 서비스의 기능을 나타내는 선형 아이콘과 서비스 이름을 표시합니다. 오른쪽 위의 상태 점과 문구에서 운영 상태를 확인합니다. 타일을 누르면 서비스가 새 탭에서 열리고, URL이 없는 항목은 상태 상세가 열립니다.
- HTML·body·앱 루트를 동적 뷰포트 높이에 고정해 Safari 주소·도구 막대가 변해도 문서가 더 움직이거나 아래 빈 공간이 드러나지 않게 합니다. 바깥 문서의 스크롤·탄성 이동은 막습니다.
- 상세 메뉴에서는 본문 영역만 내부 스크롤하고 하단 내비게이션은 flex 레이아웃 끝에 고정합니다. 홈 화면도 뷰포트 안에 맞춰 세로 스크롤 없이 고정합니다.
- 상세 모달의 닫기 버튼은 Radix 모달의 접근성·포인터 범위 안인 `Dialog.Content` 내부에 둡니다. 크론 상세의 스크롤은 `infra-aws-static-sites/sites/status/dashboard/src/main.jsx`의 `.cron-dialog-scroll`이 맡고, X 버튼은 스크롤 컨테이너 밖에서 화면 하단 중앙에 고정합니다. 모바일 터치 영역은 56×56px이며 safe-area를 반영합니다.
- 기본 테마는 흰색 캔버스를 사용하고, 레몬색은 로고·포커스·상태 표시 같은 강조점에만 제한적으로 사용합니다.
- `Agents`: 네 층 장면·층 이동·화이트보드·사람 상세를 표시합니다. 사무실 메뉴를 Agents로 바꾸고 예전 Agents 요약·상태 이력 화면을 제거했습니다. 홈 Agents 버튼도 이 화면으로 연결하며 오래된 에이전트 수를 대신 표시하지 않습니다.
- 첫 화면 상단 메시지는 `status.json`의 접점 상태와 10분 주기 `agents-live.json`의 레이어·산출물·수집기 신호를 우선순위로 조합합니다. 브라우저는 60초마다 상태·운영·시계열 피드를 다시 읽어 새로고침 없이 표시를 갱신합니다. 이상 신호가 있으면 가장 먼저 확인할 대상을 보여줍니다.

## 알려진 한계

이 화면은 실제 제품의 의존성을 판별하는 것이 아니라, 스크린샷에서 관찰한 재질·아이콘·단계 표현을 비교하기 위한 시각 테스트입니다. Radix는 동작 primitive를 제공하고, 글래스 재질·단계선·인덴트의 시각 스타일은 제품에 맞춘 CSS입니다.

Status의 운영 피드는 `agents-live.json`, Agents 장면은 `office-live.json`을 사용합니다. 공개 데이터는 등록 인원·실행 세션·태스크·판단 대기·크론·산출물의 요약 범위입니다. 에이전트 간 대화 원문이나 비공개 태스크 상세는 공개하지 않으며, 표시 내용은 공개 가능한 읽기 전용 요약입니다.

2026-10-30 변경: CMS의 System·Flow 탭을 제거하고 System 상세에 역할 관찰 상태의 집계만 추가했습니다. 개별 실행 내용과 CMS 원본 스냅샷은 공개 Status 요약으로 복사하지 않습니다. 상세 모달의 닫기 버튼은 하단 중앙에 고정하며, 모바일에서 브라우저 문서는 스크롤되지 않고 상세 목록 영역만 스크롤됩니다. iOS Safari에서 아래 여백이 드러나지 않도록 `html`·`body`·앱 루트를 `100dvh`에 잠그고 `viewport-fit=cover`를 적용하며, 하단 내비게이션은 콘텐츠 스크롤과 분리합니다.
2026-10-30 보완: 상세 모달의 닫기 버튼이 `Dialog.Content` 바깥에 있어 Radix가 모달 외부 요소를 `aria-hidden`·`pointer-events: none`으로 격리하는 문제를 수정했습니다. 버튼을 콘텐츠 내부로 옮기고 패널의 중앙 배치를 transform 없이 유지해 닫기 버튼의 화면 하단 고정을 보존합니다. 모바일 터치 영역은 56×56px입니다.

2026-11-13: `infra-aws-static-sites/sites/status/dashboard`의 긴 크론 상세는 내부 `.cron-dialog-scroll`만 스크롤하도록 분리했습니다. `Dialog.Content`의 overflow 클리핑이 닫기 버튼에 적용되지 않게 해 X 버튼의 뷰포트 하단 중앙 고정과 Radix 접근성 경계, 모바일 safe-area·터치 영역을 유지합니다.

## 채널별 집계 기간

아래 analytics 수집 스크립트는 Status Monitoring 전용 Python 수집기와 별개입니다. Status 화면은 더 이상 GA4·PostHog 분석 피드를 요청하지 않습니다. 기존 Metrics 연동 계약과 Grafana의 Instagram 관측값 공급에 걸친 공유 예약 작업은 유지합니다. Instagram 피드는 `@minimal_collector`의 계정 집계와 조회 시각을 제공합니다. 기존 PostHog exporter의 공용 프로젝트 424014 전체 세션과 재방문율은 관측 시점 직전 7일 기준입니다. GA4와 앱별 PostHog 피드는 기존 최근 7일 집계와 달력 기준 일·주·월 집계를 함께 제공합니다. 원천에 행이 없으면 측정값 없음으로 표시합니다. 등록된 앱의 이름과 공개 식별자는 `scripts/analytics-inventory.json`에 관리합니다. PostHog는 프로젝트 내 승인된 app_id를 각각 조회하고 app_id가 없는 이벤트는 등록된 호스트별로 구분하고 나머지는 앱 미지정으로 표시합니다. 명시적 app_id가 등록 목록 밖이면 공개 집계에서 제외합니다. traffic_kind=synthetic 이벤트도 제외합니다. Virtue 호스트 범위에는 AWS·Oracle 도메인이 함께 들어갑니다.

기존 exporter의 세션·재방문·프론트엔드 예외·Web Vitals 쿼리는 프로젝트 전체를 조회하며 서비스 라벨은 `virtue`입니다. 대시보드는 이 범례를 ‘PostHog 공용 프로젝트 전체’로 표시합니다. 앱 분석 그래프 하단 숫자는 마지막 완료 구간의 값입니다. 제품 세션 행에서 앱별 수신 이벤트 추세를 함께 확인할 수 있습니다. PostHog 세션은 고유 `$session_id` 수입니다. 수신 이벤트가 있는데 식별한 세션이 0이면 범례에 ‘세션 ID 없음’을 표시합니다. 2026-11-23 한국 시간 기준 원본 대조에서 Policycock의 이벤트 80건 모두 app_id가 있었고 세션 ID는 없었습니다. 11월 17~23일 일간 집계는 6개 범주 모두 PostHog 원본과 일치했습니다.

Grafana 고객 레이어(`/d/layer-customer`)와 제품 레이어(`/d/layer-product`)의 기존 지표에서도 이 인벤토리를 사용합니다. 고객 레이어에서 GA4 신규 사용자·세션과 PostHog 이탈·재방문율을, 제품 레이어에서 PostHog 세션·예외·Web Vitals를 앱별로 비교할 수 있습니다. GA4 피드에 추가된 속성은 다음 exporter 수집 때 표시됩니다.

공개 분석 피드 세 파일은 매일 10:15 KST에 k3s의 `monitoring/public-analytics` CronJob이 만듭니다. PostHog와 GA4 최근 7일 합계, Instagram `@minimal_collector`의 다섯 지표는 기존 exporter의 내부 캐시를 사용합니다. GA4 달력 구간은 필요한 구간만 Data API에서 보강합니다. 월요일에는 직전 달력 주간과 같은 7일 합계를 재사용합니다. GA4는 속성 시간대, Instagram은 UTC 기준의 완료된 기간과 실제 관측 시각을 검증합니다. 초기 이력은 기존 공개 피드에서 이어받고 원천별 파일을 원자적으로 교체합니다. CronJob은 달력 보강용 GA4 자격만 사용합니다. Instagram 조회 자격은 exporter가 사용합니다.

`metrics.oracle.shdkej.com/public-analytics/` 아래에서 세 공개 JSON의 정확한 경로만 제공합니다. Space의 `Publish k3s analytics feeds` 워크플로가 기존 AWS 배포 역할로 매일 10:30 및 12:30 KST에 세 파일을 `static-status-aws-shdkej-com` 버킷에 조건부 게시하고 같은 버전을 다시 읽어 검증합니다. 수동 실행도 가능합니다. 소비자 주소는 `https://status.aws.shdkej.com/analytics-{posthog,ga4,instagram}.json`입니다. 운영 배포 정의는 `argocd/apps/public-analytics.yaml`과 `scripts/kustomization.yaml`에 있습니다.

SAM-PC의 기존 10:15 예약 작업은 로그인된 Egolite에서 `@every.policy`의 조회수·조회한 사람 수만 읽고 `monitoring/ga4-session-engagement`의 비공개 `instagram.json`으로 전달합니다. 실패하면 마지막 성공 관측을 보존합니다. 예약 명령은 기존 `~/.local/share/dashboard-analytics/current/refresh-analytics.py`를 사용합니다. 이전 실행 파일과 같은 디렉터리 구성을 유지합니다.

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

Grafana 고객 문의 수는 클러스터의 exporter가 기존 계정 인증과 읽기 전용 모드로 `gog`를 실행해 매시간 갱신합니다. 등록 앱 이름으로 시작하는 최근 7일의 수신 대화를 앱별로 한 번 집계합니다. 공개 Space 예약 작업은 Gmail을 조회하지 않습니다. 이전 수집기를 수동으로 대조할 때만 `refresh-analytics.py --support-only`를 사용합니다. 이 명령은 로컬 `~/.local/share/dashboard-analytics/gmail-support-account`의 계정으로 비공개 ConfigMap을 갱신하며 운영 exporter는 그 값을 읽지 않습니다.

Grafana 전용 유입·참여 지표는 클러스터의 exporter가 GA4 Data API와 Meta Insights API를 직접 읽습니다. `@every.policy`는 로컬이 전송한 비공개 관측을 사용합니다.

공유 analytics 피드의 앱별 실측은 일·주·월 집계를 제공합니다. 제거한 Status 메뉴에서는 표시하지 않습니다. 각 점은 한국 시간 기준 완료된 하루, 월요일~일요일 한 주, 또는 달력 한 달의 원천 집계입니다. 최근 7일·4주·2개월을 표시합니다. Metrics의 기존 연결은 최근 7일을 유지하며 GA4·PostHog 연결에서 집계 기간을 선택할 수 있습니다. Instagram은 최근 7일 계정 집계를 사용합니다. 피드는 최근 31일의 실제 관측을 보존합니다. 과거 보고서로 보강한 점에는 집계 종료 시각과 조회 시각을 각각 기록합니다. 기존 운영 피드에 검증된 원천 이력을 추가할 때는 `refresh-analytics.py --history-seed-dir DIR --seed-only`를 실행합니다. 최신 집계값과 조회 시각은 이 작업으로 바뀌지 않습니다.

2026-11-24 이력 보강에서는 기준일마다 직전 7일을 원천에서 다시 조회했습니다. PostHog 6개 범주와 GA4 blog·afzma는 최근 30일에 대해 매일, GA4 policycock·purple-place-bb6ce는 10월 27일~11월 23일의 4개 주간에 대해 조회했습니다. GA4 주간 구간은 속성의 대한민국 시간대를 확인했습니다. 11월 17~23일 마지막 구간은 현재 공개 피드와 일치합니다. 390px 및 1440px 운영 화면에서 세 지표의 일·주·월 선택에 따라 실측점 수가 변하는 것을 확인했습니다. 수집기 릴리스 `5e2f8fc` 설치 후 예약 작업을 다시 실행해 최신 관측과 기존 이력을 함께 유지하는 것도 확인했습니다.

Grafana용 exporter는 GA4 속성별 최근 완료 7일의 참여시간·세션수·채널별 세션을 조회합니다. Instagram 계정 지표는 UTC 최근 완료 7일 기준입니다. 공개 인스타그램 피드의 조회한 사람과 Grafana의 API 도달 계정 수는 각 원천의 명칭을 따릅니다.

전환 전 코드·설정·전체 역사 파일은 `/home/ubuntu/.local/state/openclaw/backups/status-monitoring-removal-20261127/`에 보존했습니다. 운영 checkout의 `collect_crons` 최적화와 함께 실행한 87개 테스트도 통과했습니다. 테스트는 기존 CLI와 Gateway RPC 두 읽기 전용 목록 조회를 모두 지원합니다.

System의 노드 목록은 `evidence.kubectl`과 `evidence.kubeconfig`를 명시하여 systemd와 수동 실행에서 같은 클러스터를 읽습니다. 환경 PATH에 kubectl이 없어도 Office와 동일한 실행 파일·설정을 사용합니다.

## 2026-11-27 메뉴 통합 배포·복구

- 소스 정본은 Space의 이 디렉터리입니다. 새 대시보드·서비스·수집기를 만들지 않습니다.
- `npm run build:all` → 기존 Office 테스트 → 실제 브라우저에서 사무실 네 층·메뉴 복귀·이전 주소·피드 오류 확인 → main push → Status 배포 workflow → 같은 라이브 확인 순서입니다.
- Status S3 동기화는 삭제 옵션 없이 공개 피드를 보존합니다. 별도 상황실을 폐기하는 단계에서만 `agents/_next/*`, `agents/404*`, `agents/index.txt`를 제거합니다. `agents/`와 `agents/index.html`의 이동 HTML은 남깁니다. 소스와 과거 자산은 이전 Git 커밋에 보존됩니다.
- 복구는 이 통합 변경의 Git revert 후 기존 정적 배포입니다. 새 cleanup 단계도 같이 되돌려야 과거 상황실 자산을 다시 게시할 수 있습니다. Office·Agents·시계열 공개 JSON과 수집기·예약 작업은 이번 변경의 수정 대상이 아닙니다.

## 2026-11-28 Agents 메뉴 통합

기존 Agents 요약·상태 이력 화면과 명단 폴백 코드를 제거하고, 사무실을 단일 **Agents** 메뉴로 바꿨습니다. 홈 버튼·iframe 접근성 제목·문서 제목·이전 주소 안내도 맞췄습니다. 기본 주소는 `/#agents`이며 `/#office`는 방문 기록을 늘리지 않고 이 주소로 정규화합니다. `/agents/`, `/agents/index.html`, `/agents`, `/agents.html`, `/office/`, `/office/index.html`, `/office`, `/office.html`도 같은 화면으로 연결됩니다. 내부 장면·자산·피드 경로는 `/office/?embedded=1`과 `/office-live.json`을 재사용합니다.

검증은 `npm test` → `npm run build:all` → 모바일·데스크톱에서 단일 Agents 메뉴, 네 층과 층 상세, 홈 이동, 새로고침, 뒤로/앞으로, 이전 주소 이동, 피드 실패 확인 → Space main push·AWS 배포 → 같은 운영 주소 재확인 순서입니다. 기존 자동 수집·공개 피드는 유지하며, Agents를 떠나면 프레임과 해당 폴링이 해제됩니다. 복구는 이번 UI·이동 HTML 변경을 revert하고 동일 빌드·배포를 실행합니다.
