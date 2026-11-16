# 모두의정책 정책 지도

내 삶과 연결된 정책을 찾기 어려운 문제를 위한 정적 랜딩 시제품입니다. 첫 화면에서 정치인 10명의 발표 당시 정책 사례를 먼저 보고 중앙행정기관 44곳의 정보를 선택해 확인합니다. 관심 정책과 메모는 브라우저에 남깁니다.

## 제공 범위

- 민주당 계열 5명·보수 계열 5명의 역사적 정책 사례를 히어로에서 먼저 표시. 클릭하면 정책 요약·단계·발표 당시 소속·원문이 즉시 모달로 열림
- 중앙행정기관 **44곳(19부·6처·19청)**의 명칭·유형·확인일을 선택 즉시 기관 모달에 표시. 공식 기구도/사이트는 모달 안의 보조 링크; 기관 검색·필터 유지
- 실제 Blender 5.3으로 렌더한 불규칙한 별무리 위에 정책 사례 10건의 각기 다른 점·짧은 선·이름 아바타·정책 텍스트를 HTML/SVG로 표시. 아래에는 국민·헌법·입법/행정/사법의 한국형 개략 윤곽과 행정 영역에 부·처·청 44곳의 이름을 배치해 탐색하며 국회·17개 광역의회의 별도 참고 링크 유지
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

- `dist/index.html`, `styles.css`, `galaxy.css`, `app.js`: 은하수 정책 히어로·한국형 개략도·두 모달과 인터랙션. HTML에는 JS 실패를 대비한 정책 사례 10건의 정적 출처 링크가 있으며, `npm test`가 `data.js`와 원문 URL 일치를 검사
- `dist/data.js`: 10개 정책 사례 및 의회 참고 링크
- `dist/institutions.js`, `institutions.json`: 2026-11-16 중앙행정기관 스냅샷(검색·유형 필터, 출처·확인일 표기)
- `dist/sources.html`, `sources.js`: 방문자용 자료 출처
- `dist/assets/`: 자체 호스팅 글꼴·지도·아이콘
- `dist/assets/galaxy.webp`: Blender 5.3으로 렌더한 은하수의 비상호작용 배경. 위치가 고정된 정책 도트·선·받침대는 포함하지 않음
- `scripts/render-galaxy.py`, `scripts/galaxy.blend`: 현재 은하수 배경의 재현 스크립트와 편집 가능한 장면
- `dist/assets/policy-diagram*.webp`, `scripts/render-policy-diagram*.py`, 대응하는 `.blend`: 이전 5×2/2×5 받침대 장면의 재현 자료. 현재 페이지에서 호출하지 않음
- `scripts/render-institution-atlas.py`, `scripts/institution-atlas.blend`, `scripts/convert-atlas.py`: 이전 한국 지형·국회 모형 재현 자료(현재 페이지 미사용)
- `scripts/sync-institutions.py`: 정부 기구도 목록을 수동 확인해 JSON·JS와 `index.html`의 무스크립트용 44개 공식 링크를 함께 갱신. 목록·분류가 바뀌면 자동 실패하여 검토 요구
- `scripts/verify-institution-links.py`, `qa/institution-links.json`: 기관 링크 44개의 HTTP 응답 및 본문 기관명 확인 기록
- `scripts/map-svg.py`: Blender 지형 입력인 `assets/korea.svg`의 기존 SVG 생성기
- `scripts/verify-browser.cjs`, `qa/verification.json`: 재현 가능한 검증과 결과

첫 화면은 Blender가 렌더한 불규칙한 별무리를 배경으로, 서로 다른 열 개의 HTML/SVG 정책 표식이 각각 `점 → 가는 선 → 이름 아바타 → 정책 이름·당시 단계`를 보여줍니다. 버튼을 누르면 즉시 해당 정책 모달이 열립니다. 아래의 한국형 제도 개략도는 넓은 화면에서 국민·헌법·입법·행정·사법을 한 가로줄에 펼치고, 그 아래 부·처·청 44곳을 유형별 3·1·3열의 전폭 명단으로 보여줍니다. 부·처·청 이름을 누르면 별도 기관 모달이 열리며 44곳 모두 검색·필터로 찾을 수 있습니다. 모바일은 은하수 표식을 한 열로 읽고 조직도는 세 갈래 다음에 읽기 쉬운 세로 명단으로 펼칩니다. **별무리의 선은 한 점에서 해당 역사적 사례를 꺼내는 표시일 뿐, 인물 간 관계나 정책↔기관의 담당·집행 관계를 의미하지 않습니다.** 가로로 나란히 놓인 국가기관 범주도 위계·지휘 관계를 뜻하지 않습니다. 미국 그림의 연방·주·지방 위계나 임명·거부권을 한국 사실관계로 옮기지 않습니다. 시각·접근성 기준은 `DESIGN_SYSTEM.md`를 참고하세요.

현재 장면을 재생성할 때는 Windows Blender 5.3을 WSL에서 `blender.exe --background --factory-startup --python "$(wslpath -w scripts/render-galaxy.py)"`로 실행합니다. 스크립트가 편집 가능한 `.blend`와 PNG를 저장하며, 웹용 이미지는 `python3 -c 'from PIL import Image; Image.open("scripts/galaxy.png").convert("RGB").save("dist/assets/galaxy.webp", "WEBP", quality=83, method=6)'`로 변환합니다. PNG와 `.blend1`은 Git에서 제외합니다. 이전 5×2 받침대와 지형 자산을 재현할 때만 각각 `scripts/render-policy-diagram*.py`와 `scripts/render-institution-atlas.py`를 사용합니다.

## 데이터·외부 의존성

정책 자료 확인일은 2026-11-14입니다. `data.js`의 정당·연도·단계는 발표 당시 자료를 의미하며 현재 당적, 직함, 정책 적용 조건을 나타내지 않습니다. 법령 링크는 검색 진입점입니다. 김경수 회의록과 나경원 국회 법안은 웹 조사 당시 원문 직접 열람 실패를 상세에 표시했습니다. 유승민 자료는 발표 보도이며 공식 원문으로 표기하지 않습니다.

지형은 southkorea/southkorea-maps의 KOSTAT 2013 단순화 행정경계를 Blender 장면으로 가공했습니다. 현재 행정구역·선거구·실제 기관 주소를 뜻하지 않는 개략 표현입니다. 중앙행정기관 명단은 정부조직관리시스템의 기관별 기구도 49개 항목 중 부·처·청을 가져오되, 옛 대검찰청을 제외하고 공식 사이트가 확인된 공소청·중대범죄수사청을 반영해 44곳으로 정리했습니다. 위원회 6곳은 사용자가 확정한 범위 밖입니다. 2026-11-16 확인 기준이며 자동 갱신되지 않습니다. Pretendard v1.3.9는 SIL OFL 1.1이며 라이선스를 자산에 동봉했습니다. 사진은 사용하지 않고 인물 이름 배지를 동일 크기로 제공합니다.

저장 키는 `modu-policy-map-v1`이며 `{정책ID: {note: 문자열}}`만 localStorage에 둡니다. 자동 외부 요청은 없고, 외부 사이트는 링크 클릭 때 열립니다. 내보내기 파일에는 저장 정책, 원문 URL, 관심 메모와 내보낸 시각이 포함됩니다.

## 검증

```bash
npm ci
npm run check
CHROME_PATH=/opt/google/chrome/chrome npm test
python3 scripts/verify-institution-links.py
```

`npm test`는 은하수 표식 10개 각각의 점·리드·아바타·텍스트, 한국형 개략도의 세 갈래와 후속 전폭 기관 영역, 320/375/414/768/901/1024/1100/1200/1280/1320/1321/1440px의 선 끝점·라벨 충돌·클릭 중심·가로 넘침을 검사합니다. 정적·동적 기관 제목 계층과 모바일 시각·DOM 순서도 확인합니다. 두 모달 내용·포커스·Escape·저장, 기관 검색/필터·마지막 기관 키보드 접근, JavaScript/이미지 실패 시 정적 링크 대체와 낮은 모바일 화면도 확인하고 `qa/viewport-*.png`를 갱신합니다. Chromium에 필요한 시스템 라이브러리와 `CHROME_PATH`가 필요합니다.

Node.js 26, Playwright Core 1.65.1, 로컬 Chrome으로 검증했습니다. 테스트가 4187 포트에 임시 HTTP 서버를 띄우고 종료합니다. 브라우저는 설치된 Chrome을 사용하며 다른 환경에서는 `CHROME_PATH`를 지정합니다.

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

### 복구

후속 화면 변경은 이전의 검증된 커밋에서 이 사이트 `dist/`만 복원하고 새 커밋을 main에 push하여 재배포합니다. 신규 배포의 긴급 비공개 전환은 해당 CloudFront 배포의 비활성화를 검토하며, 다른 사이트나 공유 인프라는 변경하지 않습니다. 초기 Terraform 적용 전 state 백업은 소유 실행 환경에 권한 0600으로 보관했습니다. state 백업을 무조건 되돌리면 실제 AWS 리소스와 어긋나므로, 리소스 제거가 필요하면 해당 모듈의 별도 plan을 검토합니다. 브라우저 메모는 사이트 복구와 별개이며 내보내기로 보관합니다.

## 연결 문서와 한계

제품 방향·1/2차 고객 검증·3분 IR·수익 실험은 `/home/ubuntu/workspace/projects/policycock/docs/policy-map-plan.md`가 소유합니다. 원래 사업계획은 Knowledge Lab의 `source/openclaw-system/data/policycock-brief.md`에 보존합니다.

정책 사례를 첫 장면에 우선 표시하고 부·처·청을 같은 장면에서 탐색합니다. 광역의회는 아래 참고 링크에 유지하며 기초의회 전체와 6개 중앙행정위원회는 포함하지 않습니다. 정책별 중앙행정기관의 담당·집행 관계는 검증 자료가 없어 표시하지 않습니다. 링크된 기관의 장애·차단·페이지 변경은 별도이며, 이 시제품은 외부 링크의 지속 가용성이나 법령의 현재 효력을 보증하지 않습니다. 저장은 브라우저·출처별로 분리되고, 다른 기기와 동기화되지 않습니다.

외부 링크 검사: 38개 중 34개 HTTP 2xx. 충남은 응답 본문에서 웹방화벽 차단을 확인했고, 국회는 400, 현행 전북 의회는 416, 시도지사협의회 PDF는 timeout으로 남았습니다. 전체 결과는 `qa/links.json`입니다. HTTP 성공은 본문 정확성이나 최신 정책 효력 검증과 다릅니다.
