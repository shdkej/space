# 모두의정책 — 인터랙티브 정책 공간

발표 당시 정책 사례 10건을 직접 돌려보고 선택하면서 내용과 출처를 읽는 정적 웹 시제품입니다. 중앙행정기관 44곳을 검색하고 관심 정책·메모를 브라우저에 저장합니다.

사용자는 [참고 영상](https://www.threads.com/@bsd_funneldding/post/Dc-GbPOk3Gc) 수준의 그래픽과 체감 상호작용을 원하며 첫 배포 `8fdad908`의 시각 품질을 거부했습니다. 후속 버전은 입체 키캡·표면 인쇄·층별 분해·금속 노브를 가진 graphite 콘솔로 다시 구현했습니다. 기능 검증과 미적 평가를 구분하며 실제 배포 revision은 `qa/deployment.json`으로 확인합니다.

## 사용과 제공 범위

- 정책 공간: 드래그 회전, 조각 펼침·모음, 스튜디오·따뜻한 조명, 정책 선택과 카메라 접근, 전체로 복귀. 정책명은 3D 키 표면에 인쇄하고, 같은 위치의 HTML 버튼으로 키보드 조작합니다. 상세 제목·단계는 별도 HTML로 읽습니다.
- 정책 선택: 장면 옆 요약 → `내용과 출처` → 기존 상세 대화상자. 관심 저장은 장면과 목록에서 같은 브라우저 저장소를 사용합니다.
- 정책 목록: 민주당 계열 5명·보수 계열 5명의 역사적 정책 사례, 발표 당시 소속·연도·공약/발의/시행 구분, 원문·뉴스·법령 검색 링크.
- 기관 탐색: 중앙행정기관 44곳(19부·6처·19청)의 이름·유형·확인일, 검색·필터·상세 대화상자. 국회·17개 광역의회 링크도 유지합니다.
- 내 관심 정책: 저장·삭제, 카테고리별 모음, 240자 메모, JSON 내보내기. 실제 정책 변경 수집·알림·계정·동기화·결제는 제공하지 않습니다.

데스크톱 장면은 5열×2행, 1100px 이하에서는 3열×4행에 10개 정책을 배치합니다. 모바일은 페이지 스크롤을 기본으로 두고 `돌려보기`를 선택할 때만 회전 조작을 켭니다. 모션 감소 설정에서는 카메라 이동과 조각 전환을 즉시 반영합니다. WebGL·모듈 로딩 실패 시 목록 탐색으로 이어지며, JavaScript가 없어도 정책·기관의 원문 링크를 읽을 수 있습니다.

`birth-grant-map.html`은 기존 출산지원금 지도로, 이번 3D 변경에서 수정하지 않습니다.

## 실행과 개발

Node.js와 npm, Python 3가 필요합니다. 검증은 Node.js 26 계열과 설치된 Chrome에서 수행합니다.

```bash
npm ci
npm run vendor
npm start
# http://127.0.0.1:4173
```

HTML·CSS·앱 JavaScript는 `dist/`에서 직접 편집합니다. Three.js 0.187.0은 버전을 고정하며, `npm run vendor`가 esbuild로 엔진을 묶고 OrbitControls·RoomEnvironment·GLTFLoader·라이선스를 `dist/vendor/three/`에 준비합니다. 의존성이나 vendor 스크립트를 바꾼 경우 이 명령을 다시 실행하고 생성 파일도 함께 커밋합니다. 배포 workflow는 npm 설치나 빌드를 실행하지 않습니다.

3D 장면은 ES module과 import map을 사용하므로 HTTP 서버에서 확인합니다. `file://` 직접 열기를 3D 완료 기준으로 사용하지 않습니다. Three.js·글꼴·장면 자산은 같은 출처에서 제공하며 외부 CDN이나 API 키가 필요하지 않습니다.

### 파일 소유권

| 경로 | 역할 |
| --- | --- |
| `dist/index.html`, `index.css` | 첫 장면, 정책·기관 목록, 반응형 화면과 대화상자 |
| `dist/policy-scene.js` | 코드로 만든 3D 물체·재질·조명, 카메라·회전·선택, 필요할 때만 렌더링, 실패 대체 |
| `dist/app.js` | HTML 상세·기관 검색·저장·메모 및 장면 이벤트 연결 |
| `dist/data.js` | 정책 사례 10건·의회 링크 |
| `dist/institutions.json`, `institutions.js` | 중앙행정기관 44곳의 확인된 스냅샷 |
| `dist/sources.html`, `sources.js` | 정책 자료의 출처와 사용 범위 |
| `dist/assets/`, `dist/vendor/three/` | 글꼴·파비콘·GLB 노브, 브라우저용 3D 엔진과 addon·라이선스 |
| `design/console-knob.blend`, `scripts/build-console-knob.py` | 편집 가능한 Blender 노브 원본과 모델·검토 이미지 재생성 |
| `scripts/vendor-three.cjs` | 고정된 npm 패키지에서 vendor 산출물 재생성 |
| `scripts/verify-*.cjs`, `qa/` | 브라우저·장면·라이브 검사와 실제 실행 증거 |
| `scripts/sync-institutions.py` | 기관 JSON·JS 및 무스크립트 HTML 목록 동시 갱신 |

`DESIGN_SYSTEM.md`가 장면·상호작용·접근성 기준을 소유합니다. 새 Blender 노브는 실제 GLB 런타임 자산입니다. 과거 OpenPencil 시안·기타 Blender 정지 이미지 파일은 제작 이력으로 보존합니다. 과거 배포별 설명은 Git 이력과 `qa/deployment.json`의 이전 기록을 참조합니다.

## Blender 자산 재생성

```bash
blender -b --factory-startup --python-exit-code 1 -P scripts/build-console-knob.py
```

Blender 4.0.2 arm64와 Python NumPy, glTF exporter로 검증했습니다. 모델의 editable `.blend`, 배포용 GLB, `qa/console-model.json`, 앞/뒤 소재 검토 이미지를 생성합니다. Cycles CPU 렌더이며 이 환경은 OpenImageDenoiser가 없어 denoising을 끕니다. 스킬의 환경 보고·mesh QA도 실행하고 UV·닫힌 메시·노멀·내보낸 바이트를 확인합니다. 자산 파일 로딩 실패는 `data-model=fallback`으로 남기며 장면 사용은 계속됩니다.

Hallmark와 Blender/OpenPencil 스킬 원본은 Prompt Archive `skills/shared/`가 소유합니다. Hallmark는 audit 보조로 사용하며 OpenPencil은 현재 실행 앱에 문서가 없어 실제 캔버스 작업은 미수행입니다. 공통 레퍼런스·출처는 `DESIGN_SYSTEM.md`를 참고합니다.

## 데이터와 저장

정책 사례 확인일은 2026-11-14, 기관 명단 확인일은 2026-11-16입니다. 정책의 단계·연도·소속은 발표 당시 기록이며 현재 당적·법령 효력·신청 자격을 단정하지 않습니다. 기관 스냅샷의 선정·보정 근거와 원문 열람 제한은 출처 페이지에 남깁니다. 기관 목록 변경은 `scripts/sync-institutions.py`로 갱신하고 `python3 scripts/verify-institution-links.py`로 응답·본문을 확인합니다.

정책과 기관의 담당·집행 관계는 검증 자료가 없어 연결하지 않습니다. 공간의 위치·크기·색은 지리 위치, 정책 중요도, 지지율, 정부 지휘 관계를 나타내지 않습니다.

저장 키는 `modu-policy-map-v1`이며 `{정책ID: {note: 문자열}}`을 localStorage에 둡니다. 데이터는 브라우저·출처별로 분리되고 서버로 전송되지 않습니다. 내보내기에는 정책·출처 URL·메모·내보낸 시각이 포함됩니다. Pretendard는 SIL OFL 1.1, Three.js는 동봉된 MIT 라이선스를 따릅니다.

## 검증

```bash
npm run check
CHROME_PATH=/opt/google/chrome/chrome npm test
# 장면만 다시 확인할 때
CHROME_PATH=/opt/google/chrome/chrome npm run test:scene
# 이미 실행 중인 미리보기 또는 배포 장면 확인
SITE_URL=http://127.0.0.1:4173 npm run test:scene
```

`npm test`는 기존 기능 검사와 장면 검사를 순서대로 실행합니다. 브라우저 실행 경로가 다르면 `CHROME_PATH`를 지정합니다. `verify-browser.cjs`와 `verify-live.cjs`는 기존 브라우저에 연결할 때 `BROWSER_CDP`도 지원합니다.

검사에서는 정책·기관 상세와 링크, 저장·메모·복원·삭제·내보내기, 저장소 오류·두 탭 동기화, 키보드·모션 감소·무스크립트 대체, 320–1440px 레이아웃을 확인합니다. 장면은 실제 캔버스 렌더와 정책 선택·복귀뿐 아니라 회전·펼침·조명·모바일 조작·실패 대체를 확인합니다. 테스트 통과와 별도로 실제 데스크톱·모바일 캡처를 보고 글자 겹침·선택 영역·입체감을 판단합니다.

증거 위치는 `qa/verification.json`, `qa/scene-verification.json`, `qa/live-verification.json`, `qa/deployment.json`, `qa/review.json`입니다. 각 파일의 시각·대상 URL·소스 revision을 확인하며 과거 통과 기록을 이번 변경의 증거로 사용하지 않습니다. 모바일 실기기 FPS·발열·배터리 영향은 아직 측정하지 않았습니다.

## 배포와 복구

소스 정본은 [Space main의 이 디렉터리](https://github.com/shdkej/space/tree/main/infra-aws-static-sites/sites/policycock)이며, 공개 주소는 **https://policycock.aws.shdkej.com/** 입니다. 런타임은 비공개 S3 origin → CloudFront HTTPS → Route53입니다. 기존 standalone `apps/policycock-landing`과 Sites 버전은 초기 보관본으로 수정·배포 출발점이 아닙니다.

1. 위 검사를 통과한 사이트 변경과 `dist/vendor/`를 검토하고 해당 경로만 main에 commit/push합니다.
2. `.github/workflows/static-site-aws-template.yml`의 `policycock` 잡에서 S3 동기화와 CloudFront 무효화 완료를 확인합니다. `dist/` 변경만 배포 대상으로 잡히며, 기존 `birth-grant-map.html`도 함께 보존돼야 합니다.
3. `CHROME_PATH=/opt/google/chrome/chrome node scripts/verify-live.cjs`로 공개 사이트의 기능·자산 바이트·경로를 검증하고, `SITE_URL=https://policycock.aws.shdkej.com npm run test:scene`으로 공개 3D 장면을 확인합니다.
4. 실제 라이브 화면을 살피고 소스 SHA, Actions run, 검증 결과와 남은 한계를 `qa/deployment.json`에 기록합니다. 로컬 HEAD와 원격 main SHA도 대조합니다.

배포는 S3 `static-policycock-aws-shdkej-com`과 CloudFront `E1IR9GXLCMQK6X`를 사용합니다. 자산 캐시는 60초이며 workflow가 전체 경로 무효화를 기다립니다. 이번 화면 변경에는 Terraform apply가 필요하지 않습니다. 인프라 정본과 초기 상태 이전 기록은 `../../README.md`, `qa/{infra-plan,state-transfer}.json`에 있고, 공유 Terraform state는 별도 승인 없이 변경하지 않습니다.

복구할 때는 직전 검증된 버전의 **이 사이트 `dist/`만** 되돌리는 새 커밋을 main에 반영합니다. 이번 변경 직전 기준은 출산지도를 포함한 `02bbf4821a8bbfc2b471e0a95164580fb1e37280`입니다. 이후 추가된 콘텐츠가 있으면 보존 범위를 먼저 비교합니다. force-push나 공유 인프라 복원은 사용하지 않으며, 재배포 뒤 동일한 라이브 검증을 수행합니다. 브라우저 메모는 사이트 복구와 별개입니다.

## 한계와 관련 문서

3D 화면은 정책 발견과 선택을 돕는 표현입니다. 원본 영상의 전체 제작 과정·실제 사용 기술, 사용자 최종 미적 만족, 정책의 현재 효력과 고객 행동 성과는 검증되지 않았습니다. 저사양·WebGL 미지원 환경은 HTML 목록으로 이용하고, 모바일 실기기 성능은 후속 측정이 필요합니다. 외부 기관 페이지의 장애·차단·주소 변경도 별도입니다.

프로젝트 방향·고객 검증 계획은 `/home/ubuntu/workspace/projects/policycock/docs/policy-map-plan.md`, 사용자 피드백 정본은 Knowledge Lab `source/openclaw-system/data/policycock-brief.md`를 따릅니다.

## 사례 열람과 정책알리미 신청

상단 ‘정책 사례’에서 목록으로 이동해 사례의 내용과 원문을 열 수 있습니다. 하단 CTA는 관심 정책·분야의 주요 변경을 알려줄 정책알리미의 출시 안내 1회를 신청하는 경로입니다. 자동 수신 경로를 검증하기 전까지 하단에 이메일 등록 준비 상태를 표시하고 주소 입력과 신청을 받지 않습니다.

접수를 열면 방문자가 본인의 이메일 주소를 입력해 운영자에게 바로 전달하는 데 동의합니다. 확인 메일은 보내지 않습니다. 신규 신청 성공은 운영자 앞으로의 메일을 SES가 수락한 뒤 표시하며, 실제 운영자 메일함 정리는 수동입니다. DynamoDB에는 이메일 원문을 보관하지 않습니다. 최초 신청 브라우저만 개인 철회 링크를 발급받습니다. 다른 브라우저에서 같은 주소를 제출해도 권한이 생기지 않습니다. 링크를 열면 URL에서 비밀을 지우며 버튼을 직접 눌러야 철회됩니다. 운영자 메일 정리 요청이 지연돼도 발송 대상에서 즉시 제외됩니다. 출시 때 운영자가 유효한 신청인지 확인하고 Gmail로 개별 안내를 한 번 보냅니다. 신규 신청 통지는 하루 300회, 철회 통지는 하루 25회까지 발송을 시도합니다. 앱 한도는 한국시간 오전 9시에 초기화되며, 실제 발송에는 서울 리전 SES 계정의 최근 24시간 공유 한도도 적용됩니다.

전용 서비스 배포로 검증한 HTTPS URL을 `POLICYCOCK_SIGNUP_URL`로 설정합니다. `POLICYCOCK_SIGNUP_ENABLED`는 신규 접수 폼 표시를 제어하며 기존 신청 철회에는 URL을 유지해야 합니다. [공용 운영 문서](../../README.md)

이미지 작업대와 공용인 PostHog US Default 프로젝트 **424014**를 사용합니다. 운영 배포에서 기존 수집 키를 주입합니다. 속성은 `app_id=policycock`, `traffic_kind=user|synthetic`, 프로필·위치 보강 비활성 플래그, 합성 요청의 난수 `qa_run_id`로 제한합니다. 이메일·기관·인물·선택한 정책·검색어·메모·링크·철회 토큰은 계측하지 않습니다. 방문자 측 추적 차단 신호를 존중합니다.

PostHog 방문 분석은 별도 선택 동의(`policycock.analytics.consent.v1`)가 있을 때만 전송합니다. 거부·미선택·GPC/DNT 상태에서는 PostHog 호출이 없으며, 하단 `PostHog 분석 설정`에서 철회할 수 있습니다. 이메일 출시 알림 신청 동의와 분리합니다. 브라우저 저장소가 막힌 경우 PostHog 선택은 탭에서만 유지됩니다. 기존 PostHog 프로젝트의 IP 보관 설정은 별도 운영 확인이 필요합니다.

GA4 유입 분석은 **PostHog를 유지한 채 추가할 별도 선택 항목**입니다. `dist/ga4-consent.js`는 `policycock.ga4.consent.v1`을 사용하며 기존 PostHog 동의를 GA4로 승계하지 않습니다. 확인된 `ga4MeasurementId`가 `window.policycockConfig`에 없으면 GA4 선택 UI·Google 태그는 모두 비활성입니다(현재 운영 설정). ID가 있어도 GA4 선택 전·거부·GPC/DNT 상태에서는 태그를 로드하지 않으며, 저장소 접근 실패 시 수집하지 않습니다. 동의 후 고정된 사이트 첫 화면 URL·제목으로 수동 `page_view` 1건만 전송합니다. 원본 쿼리·해시·검색어·관심 정책·메모·이메일·외부 신청 클릭은 GA4 이벤트에 넣지 않고, 검색엔진 referrer는 승인한 도메인 이름으로만 정규화합니다. 탭 간 철회 시 이미 로드된 태그를 내려놓기 위해 해당 탭을 다시 로드합니다. GA4 실제 수집은 **새 Analytics 계정 약관 수락, 속성/스트림·측정 ID 확인, 향상된 측정 비활성화, 사용자·이벤트 2개월 보유 설정, 개인정보처리방침 게시, 네트워크 페이로드와 GA4 수신 검증 전까지 활성화하지 않습니다.** 운영자 표기와 공개 문의처는 사용자 제공 `SAM` / `shdkej@gmail.com`입니다. Search Console 연결은 별도 승인 없이는 변경하지 않습니다.

| 이벤트 | 집계 시점 |
| --- | --- |
| `landing_viewed`, `case_list_viewed` | 랜딩 로드, 목록 제목이 화면에 처음 보일 때 |
| `case_opened`, `case_source_opened` | 사례 상세 열기, 상세 내 자료 링크 선택 |
| `launch_cta_clicked` | 신청 섹션 바로가기 또는 폼 제출 |
| `signup_request_accepted`, `signup_withdrawn`, `signup_cleanup_pending` | 전용 API가 접수 성공(중복 포함), 철회와 정리 통지 수락, 철회와 정리 통지 대기에 응답 |
| `signup_failed` | 요청 처리 오류 또는 유효하지 않은 철회 요청 |

`node scripts/verify-launch.cjs`로 모바일 사례 모달·준비 중 상태·격리한 API 요청과 실패/중복/철회·PostHog 전송 속성을 확인합니다. `node scripts/verify-ga4.cjs`는 **모의 Google 전송**으로 무설정·거부·GPC·탭 간 철회·민감 URL 제거를 확인합니다. 모의 응답은 GA4의 실제 수신 증거가 아닙니다. PostHog 수집은 실제 운영 주소에서 `?qa=1`로 연 뒤 동일한 `qa_run_id`를 프로젝트에서 조회합니다. GA4는 전용 스트림 활성화 후 별도 운영 브라우저와 GA4 실시간 보고서에서 확인해야 합니다.
