# 모두의정책 정책 지도

내 삶과 연결된 정책을 찾기 어려운 문제를 위한 정적 참고 시제품입니다. 현재 화면은 정책 사례 10건의 이름과 중앙행정기관 44곳의 범위·유형을 한 장의 인덱스로 보여주고, 기관명 44개는 이어지는 본문에 모두 펼칩니다. 관심 정책과 메모는 브라우저에 남깁니다.

## 제공 범위

- 민주당 계열 5명·보수 계열 5명의 역사적 정책 사례를 히어로에서 먼저 표시. 클릭하면 정책 요약·단계·발표 당시 소속·원문이 즉시 모달로 열림
- 중앙행정기관 **44곳(19부·6처·19청)**의 명칭·유형·확인일을 선택 즉시 기관 모달에 표시. 공식 기구도/사이트는 모달 안의 보조 링크; 기관 검색·필터 유지
- OpenPencil에서 조망면을 먼저 설계한 뒤 큰 한글 표제와 정책 10건·기관 19/6/19 유형을 같은 화면에 구성. 기관명 44곳은 아래에서 읽기 좋은 크기로 펼칩니다. 국민·헌법·입법/행정/사법 구분과 국회·17개 광역의회 링크는 유지합니다. 이전 Blender 장식은 새 화면에서 제외했습니다.
- 발표 당시 소속·연도·공약/발의/시행 구분, 원문·뉴스·관련 법령 검색
- 내 활성 지도: 정책 저장/삭제, 카테고리별 모음, 240자 관심 이유, JSON 내보내기
- 모바일, 키보드 포커스와 모션 감소 지원, 저장소 손상/차단 시 탐색 유지

실제 정책 변경 수집·알림, 로그인·동기화, 결제, 고객 모집, 분석 추적은 없습니다. 정적 기술 검증을 고객 검증이나 시민감시 성과로 해석하지 않습니다.

## 실행 및 개발

`dist/index.html`을 브라우저에서 직접 열어도 탐색할 수 있습니다. 저장 동작을 일관되게 확인하려면 로컬 HTTP 서버를 사용합니다.

```bash
npm start
# http://127.0.0.1:4173
```

런타임 의존성은 없습니다. Python 3는 로컬 서버에 사용합니다. HTML/CSS/JS를 직접 편집하므로 빌드 단계도 없습니다.

- `dist/index.html`, `index.css`, `app.js`: 한 장의 정책·기관 인덱스, 두 대화상자와 인터랙션. CSS는 독립 파일 하나로 소유합니다. HTML에는 JS 실패에 대비한 정책 사례 10건의 정적 출처 링크가 있으며, `npm test`가 URL 일치를 검사합니다.
- `dist/data.js`: 10개 정책 사례 및 의회 참고 링크
- `dist/institutions.js`, `institutions.json`: 2026-11-16 중앙행정기관 스냅샷(검색·유형 필터, 출처·확인일 표기)
- `dist/sources.html`, `sources.js`: 방문자용 자료 출처
- `dist/assets/`: 자체 호스팅 글꼴·파비콘
- `design/openpencil/policycock-editorial-index.svg`: OpenPencil에서 만든 새 1440px 조망 시안. 편집 가능한 `.fig` 저장과 PNG 출력은 도구 메모리 오류로 실패했으므로 SVG만 보존했습니다.
- `qa/editorial-map-{1440,375,375-agencies,375-last-agency}.png`: 새 화면의 실제 데스크톱·모바일 브라우저 렌더 근거
- `design/openpencil/policycock-civic-ledger.fig`, `design/blender/ledger_relief.py`, `ledger-relief.blend`: 이전 Civic Ledger의 제작 이력이며 현재 화면에서 사용하지 않습니다.
- `scripts/render-galaxy.py`, `scripts/galaxy.blend`: 이전 은하수의 보존된 제작 소스. 배포 이미지는 제거됨
- `scripts/render-policy-diagram*.py`, 대응하는 `.blend`: 이전 5×2/2×5 받침대의 보존된 제작 소스. 배포 이미지는 제거됨
- `scripts/render-institution-atlas.py`, `scripts/institution-atlas.blend`, `scripts/convert-atlas.py`: 이전 한국 지형·국회 모형 제작 소스(배포 자산 제거)
- `scripts/sync-institutions.py`: 정부 기구도 목록을 수동 확인해 JSON·JS와 `index.html`의 무스크립트용 44개 공식 링크를 함께 갱신. 목록·분류가 바뀌면 자동 실패하여 검토 요구
- `scripts/verify-institution-links.py`, `qa/institution-links.json`: 기관 링크 44개의 HTTP 응답 및 본문 기관명 확인 기록
- `scripts/map-svg.py`: Blender 지형 입력인 `assets/korea.svg`의 기존 SVG 생성기
- `scripts/verify-browser.cjs`, `qa/verification.json`: 재현 가능한 검증과 결과

2026-11-16 사용자 교정에 따라, 첫 화면의 목표는 44개 기관명을 축소해 전부 넣는 것이 아니라 정책 10건의 실제 이름과 기관 44곳의 부19·처6·청19 범위를 **한 맵처럼 조망**하는 것입니다. 44개 기관명은 같은 페이지 바로 아래에 모두 펼치고, 모달·검색·필터로 탐색합니다. 정책 분류는 발표 당시 정당 계열이며 현재 당적이나 정책의 이념이 아닙니다. 정책과 기관의 담당·집행 관계는 표시하지 않습니다. 모바일에서는 먼저 10/44 범위를 보고 항목을 한 열씩 읽습니다. 자세한 기준은 `DESIGN_SYSTEM.md`를 참고하세요.

이전 장식 재생성은 Windows Blender 5.3에서 `design/blender/ledger_relief.py`로 가능하지만 새 화면에는 통합하지 않습니다. 시각적 초점을 분산시키는 3D 장식보다 실제 정책명과 기관 유형을 앞세우기 위해서입니다. 과거 은하수/받침대/지형 스크립트도 현재 화면에서 호출하지 않습니다.

## 데이터·외부 의존성

정책 자료 확인일은 2026-11-14입니다. `data.js`의 정당·연도·단계는 발표 당시 자료를 의미하며 현재 당적, 직함, 정책 적용 조건을 나타내지 않습니다. 법령 링크는 검색 진입점입니다. 김경수 회의록과 나경원 국회 법안은 웹 조사 당시 원문 직접 열람 실패를 상세에 표시했습니다. 유승민 자료는 발표 보도이며 공식 원문으로 표기하지 않습니다.

과거 지형 장면은 southkorea/southkorea-maps의 KOSTAT 2013 단순화 행정경계를 사용했지만 현재 화면은 지형을 표시하지 않습니다. 중앙행정기관 명단은 정부조직관리시스템의 기관별 기구도 49개 항목 중 부·처·청을 가져오되, 옛 대검찰청을 제외하고 공식 사이트가 확인된 공소청·중대범죄수사청을 반영해 44곳으로 정리했습니다. 위원회 6곳은 확정 범위 밖입니다. 2026-11-16 확인 기준이며 자동 갱신되지 않습니다. Pretendard v1.3.9는 SIL OFL 1.1이며 라이선스를 자산에 동봉했습니다. 인물 사진은 사용하지 않습니다.

저장 키는 `modu-policy-map-v1`이며 `{정책ID: {note: 문자열}}`만 localStorage에 둡니다. 자동 외부 요청은 없고, 외부 사이트는 링크 클릭 때 열립니다. 내보내기 파일에는 저장 정책, 원문 URL, 관심 메모와 내보낸 시각이 포함됩니다.

## 검증

```bash
npm ci
npm run check
BROWSER_CDP=http://localhost:9222 npm test # Windows Edge/CDP 등 기존 브라우저 이용 시
# 또는 CHROME_PATH=/path/to/chrome npm test
BROWSER_CDP=http://localhost:9222 node scripts/verify-live.cjs # 배포 후 공개 도메인 검증
python3 scripts/verify-institution-links.py
```

`npm test`는 1440×900 첫 화면 정책 10건의 이름과 기관 44곳의 세 유형·전체 명단 진입점, 원장/URL 전수 일치, 320–1440px 아홉 너비의 가로 넘침과 항목 겹침, 두 모달 10+44건, 검색·필터·저장·메모·내보내기·JS 실패 대체를 검사합니다. 375/1440px 캡처는 `qa/editorial-map-*.png`에 남깁니다. 로컬 Chrome 또는 외부 CDP 브라우저가 필요합니다.

Node.js 26, Playwright Core 1.65.1, Windows Edge 157 CDP로 새 화면을 검증했습니다. 테스트가 4187 포트에 임시 HTTP 서버를 띄우고 종료합니다. 설치된 Chrome은 `CHROME_PATH`, 실행 중인 브라우저는 `BROWSER_CDP`로 지정합니다.

2026-11-14 확인: 320/375/414/768/1440px 렌더·가로 넘침·지도 상세 겹침, 5+5 정책과 18개 의회 링크, 10개 정책 상세, 저장·메모·새로고침 복원·삭제·JSON 다운로드, 손상/차단된 저장소, 메모 입력 직후 새로고침 보존, 두 탭 저장 병합, 의회 핀 클릭 대상, 메모 HTML 비실행, 키보드·모션 감소, 출처 페이지, JS 오류와 자동 외부 요청 없음. 캡처는 `qa/viewport-*.png`, 구조화 결과는 `qa/verification.json`입니다.

## 소스 정본과 Space 배포

2026-11-14 사용자가 Space 정적 배포를 요청했습니다. 이후 소스와 정적 산출물의 정본은 **Space main의 `infra-aws-static-sites/sites/policycock/`**입니다.

- URL: `https://policycock.aws.shdkej.com/`
- 등록: `../registry.json`의 `policycock` 항목, SPA fallback 없음
- 런타임: 비공개 S3 origin → CloudFront HTTPS → Route53
- 저장소: `static-policycock-aws-shdkej-com`, 리전 `ap-northeast-2`
- 배포: Space main의 `dist/` 변경 push → `Deploy static site to AWS` GitHub Actions → S3 sync 및 CloudFront invalidation
- 이전 `/home/ubuntu/workspace/apps/policycock-landing/`와 Sites 버전 1(`5850090`)은 최초 시제품 보관본입니다. 수정·재배포 출발점으로 사용하지 않습니다. Sites 프로덕션 배포는 하지 않습니다.

초기 인프라는 기존 `modules/static-site-aws` 모듈로 만듭니다. 2026-11-14 공유 상태의 AWS provider는 6.72.0인데 소스 선언은 5.x여서 상태 해석에 실패했습니다. 루트와 공용 모듈의 선언을 실제 상태와 같은 6.x로 맞췄습니다. 또한 공유 루트의 target plan에 이전 image-annotator 리소스 12개 삭제가 포함되어 그 계획은 적용하지 않았습니다.

초기 생성은 이 앱 하나만 포함한 임시 Terraform 루트·빈 상태에서 수행합니다. 모듈 주소는 `module.app_static_sites["policycock"]`, 도메인은 registry 값, AWS 리전은 `ap-northeast-2`, 인증서는 `us-east-1`, 태그는 `{app="policycock", project="space", stack="aws-static-sites"}`, `spa_fallback=false`입니다. plan에서 이 주소 아래 12개 생성 외 변경·삭제가 없는지 확인합니다. 적용 후 `terraform state mv -state=<초기 상태> -state-out=<Space 상태> 'module.app_static_sites["policycock"]' 'module.app_static_sites["policycock"]'`로 Space 상태에 합치며, 기존 리소스 기록이 그대로인지 비교합니다. 임시 루트는 후속 관리 정본이 아닙니다.

Terraform state 정본은 `/home/ubuntu/workspace/space/infra-aws-static-sites/terraform.tfstate`입니다. 이 경로에는 다른 사이트도 있으므로 전체 apply 대신 plan 범위를 검토해야 합니다. 기존 image-annotator 상태 정리는 이번 배포 범위 밖입니다. 자격증명·tfvars·state·plan 파일은 커밋하지 않습니다.

검증 순서는 `npm run check` → `npm test` → registry 및 Terraform plan의 변경 범위 확인 → 승인된 초기 인프라 반영 → main push → Actions 성공 → `node scripts/verify-live.cjs`입니다. 이번 요청은 초기 인프라 반영과 정적 배포를 포함한 사용자 승인입니다. 실제 완료 증거는 `qa/deployment.json`에 기록합니다. 초기 배포: 2026-11-14 소스 `456588f`의 [Actions 배포](https://github.com/shdkej/space/actions/runs/43566210780)가 성공했고, 라이브 375/1440px 렌더·선택·저장·메모 복원·삭제·내보내기·출처 화면과 정적 파일 10개의 SHA-256 일치를 확인했습니다. 신규 관리 리소스 12개를 생성했으며 기존 state의 리소스 기록 256개는 변하지 않았습니다. 상태 이전 시 공유 루트의 기존 output 값은 보존했고 Actions는 AWS에서 리소스를 직접 조회합니다.

2026-11-15 Urban Glass 리디자인: 소스 `f3f9e23`의 [정적 배포](https://github.com/shdkej/space/actions/runs/43717886447)가 성공했습니다. 로컬 320/375/414/768/1440px 렌더·기능 테스트와 라이브 375/1440px 렌더·저장/복원·출처 확인을 통과했고, 새 SVG를 포함한 정적 파일 11개의 라이브 바이트가 로컬과 일치했습니다. 실행 결과는 `qa/verification.json`, `qa/live-verification.json`, `qa/live-assets.json`, `qa/deployment.json`에 기록합니다. 도시 모형은 상징적 배경이며 실제 의회 위치나 실시간 정책 상태를 뜻하지 않습니다.

2026-11-16 Blender Institution Atlas: 소스 `eed96c0`의 [정적 배포](https://github.com/shdkej/space/actions/runs/43779796329)에서 `policycock` 잡과 CloudFront 무효화가 성공했습니다. 국회·중앙행정기관 44곳의 한 장면, 검색·필터·정적 링크 대체를 로컬 320–1440px 및 라이브 375/1440px에서 확인했습니다. `dist/` 정적 파일 13개의 라이브 SHA-256이 로컬과 일치하고 옛 `urban-glass.svg`는 제거(403)됐습니다. 기관 링크 44건은 2026-11-16 당시 HTTP 200 및 본문 기관명 일치였습니다. `qa/{verification,live-verification,live-assets,institution-links,deployment}.json`에 증거를 남겼습니다. 이는 공식 기관 정보의 장기적 최신성이나 사용자의 디자인 만족도를 보증하지 않습니다.

2026-11-16 Policy-first Atlas: 소스 `e1316dc`의 [정적 배포](https://github.com/shdkej/space/actions/runs/43782796135)에서 `policycock` 잡과 CloudFront 무효화가 성공했습니다. 첫 장면의 정책 10건과 기관 44곳, 인물·기관 모달, 검색과 저장을 로컬 **29개 검사** 및 라이브 **11개 검사**로 확인했습니다. 320/375/414/768/1440px과 낮은 모바일 높이에서 모달의 닫기·내부 동작에 접근했고, 라이브 `dist/` 13개 파일 및 루트·확장자 없는 출처 페이지의 바이트 일치를 확인했습니다. `qa/{verification,live-verification,live-assets,deployment,review}.json`이 이번 버전의 검증 기록입니다. 네 역할·교차 검토와 독립 Red 검토도 기록했습니다. 특정 정책의 중앙행정기관 담당 관계는 확인되지 않아 연결하지 않았으며, 사용자의 최종 시각적 취향과 고객 성과는 별도 판정입니다.

2026-11-16 Blender Policy Diagram: 소스 `5a00819`의 [정적 배포](https://github.com/shdkej/space/actions/runs/43786928136)에서 `policycock` 잡과 CloudFront 무효화가 성공했습니다. 데스크톱 5×2·모바일 2×5 받침대를 실제 Blender로 제작하고, HTML 정책 10건·기관 44곳의 선택과 모달을 유지했습니다. 로컬 **32개**, 라이브 **11개** 브라우저 검사를 통과했고, `dist/` **15개 파일**과 루트·확장자 없는 출처 경로의 라이브 바이트가 일치했습니다. 독립 Red 검토는 화면 정렬 두 차례 FAIL 후 수정본의 로컬 캡처·소스 기준 PASS였고, 별도 브라우저 실행은 환경 문제로 못 했습니다. 부모의 로컬·라이브 브라우저 검증은 각각 독립적으로 수행했습니다. `qa/{verification,live-verification,live-assets,deployment,review}.json`을 참조합니다. 정책 사례와 기관 사이에 확인되지 않은 소관·집행 관계를 표시하지 않으며, 사용자의 최종 디자인 취향과 고객 성과는 미검증입니다.

2026-11-16 은하수·한국형 기관 개략도 재구성: 소스 `d64c417`의 [정적 배포](https://github.com/shdkej/space/actions/runs/43799147546)에서 `policycock` 잡과 CloudFront 무효화가 성공했습니다. Blender에서 새 별무리를 렌더하고 각 정책의 점→선→아바타·이름·정책을 HTML/SVG의 개별 클릭 대상으로 구성했습니다. 히어로 아래에는 한국의 국민·헌법·입법/행정/사법 큰 윤곽과 행정 영역의 기관 44곳을 배치했습니다. 로컬 **36개**와 라이브 **11개** 브라우저 검사를 통과했고 `dist/` **17개 파일** 및 루트·확장자 없는 출처 경로의 라이브 바이트가 일치합니다. 독립 Red 검토자는 로컬 다섯 화면 폭·모달·무JS 대체를 직접 확인해 출시 차단 결함을 발견하지 못했습니다. `qa/{verification,live-verification,live-assets,deployment,review}.json`에 검증 근거를 남겼습니다. 사용자의 최종 미적 만족과 정책의 현재 효력은 이 기술 검증으로 확인되지 않습니다.

2026-11-16 세 디자인 지침을 반영한 추가 재구성: 소스 `90d96de`의 정적 배포 run `43815041302`에서 `policycock` 잡과 CloudFront 무효화가 성공했습니다. 불규칙한 열 정책 표식과 국민·헌법→세 갈래→전폭 기관 44곳의 연속 윤곽을 강화하고, 모바일에서 세 갈래가 기관 목록보다 앞서도록 DOM·시각·키보드 순서를 맞췄습니다. 정적/동적 기관 제목 계층과 901–1321px 표식 겹침도 수정했습니다. 로컬 **43개** 및 라이브 **11개** 브라우저 검사, `dist/` **17개 파일**과 루트·확장자 없는 출처 경로의 라이브 바이트 일치, 독립 시각 Red 및 최종 코드 검토 PASS를 기록했습니다. 다만 Hallmark의 엄격한 소스 검사는 기존 410 FAIL/280 REFLEX에서 이번 렌더 423 FAIL/305 REFLEX로 **미해결**이며, 프로젝트 `DESIGN.md`가 없고 기존 약 2MB 글꼴·외부 원문 링크의 장기 가용성은 추가 과제입니다. 기술 검증이 사용자 취향 최종 승인이나 고객 성과를 의미하지 않습니다. 증거는 `qa/{verification,live-verification,live-assets,deployment,review}.json`입니다.

2026-11-16 가로형 제도 개략도: 소스 `f7d09d7`의 정적 배포 run `43840258584`에서 `policycock` S3 배포·CloudFront 무효화가 성공했습니다. 데스크톱의 국민·헌법과 입법·행정·사법은 가로 한 줄에서 시각적으로 구분되고, 기관 44곳은 아래 3·1·3열로 펼쳐집니다. 모바일은 세 갈래 다음에 읽기 쉬운 한 열 명단을 유지합니다. 로컬 **48개**(16개 화면 폭), 라이브 **12개** 검사와 `dist/` **17개 파일** 및 루트·확장자 없는 출처 경로의 바이트 일치를 확인하고 375/1440px 라이브 화면을 직접 살폈습니다. 독립 최종 검토는 로컬 코드·화면을 PASS로 판정했으며, Hallmark 엄격 검사는 이전과 동일한 **423 FAIL/305 REFLEX**로 여전히 미해결입니다. 증거는 `qa/{verification,live-verification,live-assets,deployment,review}.json`에 있습니다.

2026-11-16 가로형 정책 히어로: 소스 `2b5cac9`의 정적 배포 run `43845272094`에서 `policycock` S3 배포·CloudFront 무효화가 성공했습니다. 701px 이상에서 왼쪽 민주당 계열 5건·오른쪽 보수 계열 5건으로 나뉘며, 좁은 화면은 민주당 다음 보수 계열을 읽습니다. 화면 분류는 발표 당시 소속 계열을 위한 탐색 배치이지 정책 이념이나 현재 당적의 판정이 아닙니다. 로컬 **48개**(16개 폭, 정책 10건 각각의 클릭 중심)와 라이브 **12개** 검사를 통과하고 `dist/` **17개 파일** 및 `/`, `/sources` 바이트 일치를 확인했습니다. 독립 Red 검토 PASS 뒤 지적된 클릭 검사 범위를 10건 전부로 확대·재실행했으며, 375/1440px 라이브 화면을 직접 확인했습니다. Hallmark 엄격 검사 **418 FAIL/297 REFLEX**는 여전히 미해결이고 렌더 티어는 `puppeteer-core` 부재로 실행되지 않았습니다. 증거는 `qa/{verification,live-verification,live-assets,deployment,review}.json`입니다.

2026-11-16 Civic Ledger 전면 재구성: 소스 `188a2553029e4e2dca816384a19fd9127d060571`의 배포 run `43860956016`에서 `policycock` S3 동기화와 CloudFront 무효화가 성공했습니다. OpenPencil 편집 원본과 Blender 재현 소스·장식을 포함하며, 과거 은하수·지형의 공개 에셋 여섯 개는 제거했습니다. 로컬 **20개 검사 묶음**과 라이브 **7개 묶음**을 통과했고 정책 10건·기관 44곳의 상세·출처, 모바일 마지막 기관의 키보드 접근, 무스크립트 경로를 확인했습니다. 13개 `dist/` 파일 및 `/`, `/sources`의 라이브 바이트가 일치하며 제거 파일 6개는 403입니다. 독립 Red의 수정 후 로컬 조건부 승인과 오너의 라이브 화면 검증은 별개입니다. `qa/{verification,live-verification,live-assets,deployment}.json`을 근거로 보되, 고객의 미적 만족과 정책의 현재 효력은 미확인입니다.

최종 라이브 모바일 화면에서 상단의 기관 바로가기가 기존 스타일에 가려진 것을 발견해 `d9b1c2faf6a73c5c950369a5ac22fa32882fb455`에서 복구했습니다. 이 **직전 공개 배포**는 run `43862045462`이며 S3·CloudFront 성공, 모바일 바로가기 실제 노출과 키보드 경로, 로컬 20·라이브 7개 묶음, 13개 파일과 두 경로의 바이트 일치를 확인했습니다.

2026-11-16 한 장의 정책·기관 인덱스: 소스 `7ad02f36338f4f91fc1133f6abaaca1f4e96098d`의 run `43870900083`에서 `policycock` 배포 잡의 S3 동기화와 CloudFront 무효화가 성공했습니다. 로컬 브라우저 20개·공개 도메인 8개 검사 묶음, 정책 10건·기관 44곳의 상세, 모바일 첫 화면 10/44 범위·명단 바로가기와 마지막 기관 포커스, 무JS 링크를 확인했습니다. `dist/` 11개 파일과 `/`·`/sources`의 라이브 바이트가 일치하고 구형 CSS·장식 3개는 403입니다. 실제 1440/375px 라이브 화면을 살폈고, 독립 Red 검토는 검증기 결함을 수정한 2차 검토에서 PASS였습니다. 증거는 `qa/{verification,live-verification,live-assets,deployment,review}.json`입니다. 이는 사용자의 미적 최종 승인이나 정책의 현재 효력을 뜻하지 않습니다.

### 복구

후속 화면 변경은 이전의 검증된 커밋에서 이 사이트 `dist/`만 복원하고 새 커밋을 main에 push하여 재배포합니다. 신규 배포의 긴급 비공개 전환은 해당 CloudFront 배포의 비활성화를 검토하며, 다른 사이트나 공유 인프라는 변경하지 않습니다. 초기 Terraform 적용 전 state 백업은 소유 실행 환경에 권한 0600으로 보관했습니다. state 백업을 무조건 되돌리면 실제 AWS 리소스와 어긋나므로, 리소스 제거가 필요하면 해당 모듈의 별도 plan을 검토합니다. 브라우저 메모는 사이트 복구와 별개이며 내보내기로 보관합니다.

## 연결 문서와 한계

제품 방향·1/2차 고객 검증·3분 IR·수익 실험은 `/home/ubuntu/workspace/projects/policycock/docs/policy-map-plan.md`가 소유합니다. 원래 사업계획은 Knowledge Lab의 `source/openclaw-system/data/policycock-brief.md`에 보존합니다.

정책 사례를 첫 장면에 우선 표시하고 부·처·청을 같은 장면에서 탐색합니다. 광역의회는 아래 참고 링크에 유지하며 기초의회 전체와 6개 중앙행정위원회는 포함하지 않습니다. 정책별 중앙행정기관의 담당·집행 관계는 검증 자료가 없어 표시하지 않습니다. 링크된 기관의 장애·차단·페이지 변경은 별도이며, 이 시제품은 외부 링크의 지속 가용성이나 법령의 현재 효력을 보증하지 않습니다. 저장은 브라우저·출처별로 분리되고, 다른 기기와 동기화되지 않습니다.

외부 링크 검사: 38개 중 34개 HTTP 2xx. 충남은 응답 본문에서 웹방화벽 차단을 확인했고, 국회는 400, 현행 전북 의회는 416, 시도지사협의회 PDF는 timeout으로 남았습니다. 전체 결과는 `qa/links.json`입니다. HTTP 성공은 본문 정확성이나 최신 정책 효력 검증과 다릅니다.
