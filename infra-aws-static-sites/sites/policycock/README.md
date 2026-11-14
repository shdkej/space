# 모두의정책 정책 지도

내 삶과 연결된 정책을 찾기 어렵고, 발표 뒤의 변화를 지속해서 확인하기 어려운 문제를 위한 정적 랜딩 시제품입니다. 국회·17개 광역의회와 정치인 10명의 정책 사례를 탐색하고 관심 정책·메모를 브라우저에 남깁니다.

## 제공 범위

- SVG 입체 한국 지도와 국회 일러스트, 국회·17개 광역의회 공식 링크
- 민주당 계열 5명·보수 계열 5명의 역사적 정책 사례, 동일한 정보 밀도와 크기
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

- `dist/index.html`, `styles.css`, `app.js`: 화면과 인터랙션
- `dist/data.js`: 10개 정책 사례 및 의회 공식 링크
- `dist/sources.html`, `sources.js`: 방문자용 자료 출처
- `dist/assets/`: 자체 호스팅 글꼴·지도·아이콘
- `scripts/map-svg.py`: 출처 GeoJSON에서 지도 SVG 생성. 재생성한 SVG는 index.html에도 반영해야 함
- `scripts/verify-browser.cjs`, `qa/verification.json`: 재현 가능한 검증과 결과

## 데이터·외부 의존성

정책 자료 확인일은 2026-11-14입니다. `data.js`의 정당·연도·단계는 발표 당시 자료를 의미하며 현재 당적, 직함, 정책 적용 조건을 나타내지 않습니다. 법령 링크는 검색 진입점입니다. 김경수 회의록과 나경원 국회 법안은 웹 조사 당시 원문 직접 열람 실패를 상세에 표시했습니다. 유승민 자료는 발표 보도이며 공식 원문으로 표기하지 않습니다.

지도는 southkorea/southkorea-maps의 KOSTAT 2013 단순화 행정경계를 가공했습니다. 현재 행정구역·선거구·정당별 지지도가 아닌 지리적 개략 표현입니다. 의회 좌표도 위치 안내용입니다. 상세 출처는 `dist/sources.html`에 있습니다. Pretendard v1.3.9는 SIL OFL 1.1이며 라이선스를 자산에 동봉했습니다. 사진은 사용하지 않고 인물 이름 배지를 동일 크기로 제공합니다.

저장 키는 `modu-policy-map-v1`이며 `{정책ID: {note: 문자열}}`만 localStorage에 둡니다. 자동 외부 요청은 없고, 외부 사이트는 링크 클릭 때 열립니다. 내보내기 파일에는 저장 정책, 원문 URL, 관심 메모와 내보낸 시각이 포함됩니다.

## 검증

```bash
npm ci
npm run check
CHROME_PATH=/opt/google/chrome/chrome npm test
```

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

검증 순서는 `npm run check` → `npm test` → registry 및 Terraform plan의 변경 범위 확인 → 승인된 초기 인프라 반영 → main push → Actions 성공 → `node scripts/verify-live.cjs`입니다. 이번 요청은 초기 인프라 반영과 정적 배포를 포함한 사용자 승인입니다. 실제 완료 증거는 `qa/deployment.json`에 기록합니다.

### 복구

후속 화면 변경은 이전의 검증된 커밋에서 이 사이트 `dist/`만 복원하고 새 커밋을 main에 push하여 재배포합니다. 신규 배포의 긴급 비공개 전환은 해당 CloudFront 배포의 비활성화를 검토하며, 다른 사이트나 공유 인프라는 변경하지 않습니다. 초기 Terraform 적용 전 state 백업은 소유 실행 환경에 권한 0600으로 보관했습니다. state 백업을 무조건 되돌리면 실제 AWS 리소스와 어긋나므로, 리소스 제거가 필요하면 해당 모듈의 별도 plan을 검토합니다. 브라우저 메모는 사이트 복구와 별개이며 내보내기로 보관합니다.

## 연결 문서와 한계

제품 방향·1/2차 고객 검증·3분 IR·수익 실험은 `/home/ubuntu/workspace/projects/policycock/docs/policy-map-plan.md`가 소유합니다. 원래 사업계획은 Knowledge Lab의 `source/openclaw-system/data/policycock-brief.md`에 보존합니다.

광역의회만 연결하며 기초의회 전체를 수집하지 않습니다. 링크된 기관의 장애·차단·페이지 변경은 별도이며, 이 시제품은 외부 링크의 지속 가용성이나 법령의 현재 효력을 보증하지 않습니다. 저장은 브라우저·출처별로 분리되고, 다른 기기와 동기화되지 않습니다.

외부 링크 검사: 38개 중 34개 HTTP 2xx. 충남은 응답 본문에서 웹방화벽 차단을 확인했고, 국회는 400, 현행 전북 의회는 416, 시도지사협의회 PDF는 timeout으로 남았습니다. 전체 결과는 `qa/links.json`입니다. HTTP 성공은 본문 정확성이나 최신 정책 효력 검증과 다릅니다.
