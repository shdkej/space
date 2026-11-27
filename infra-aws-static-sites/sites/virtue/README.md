# Virtue 정적 웹 게시

덕행 기록 웹앱의 AWS 배포 산출물입니다. 소스 정본은 `shdkej/virtue-rebirth-app`의
`apps/web`이며, 이 디렉터리의 `dist/`는 그 정적 export 결과입니다. 기존 빌드의 해시 자산은
열려 있는 탭과 복구를 위해 보존합니다. 컴파일된 JS를 직접 수정하지 않습니다.

운영 주소: https://virtue.minimalcollector.com. 로컬 기록은 브라우저에 저장하고 AI 채점은 기존
`https://score.virtue.aws.shdkej.com/score`를 호출합니다. 정적 웹에서 Next 서버의 `/api/score`와
`/ingest` rewrite는 사용하지 않습니다. 초기 소스 문서의 Oracle 서버 주소는 이 배포 경로가 아닙니다.

기존 `virtue.aws.shdkej.com`에서 덕행·설정·분석 선택이 남은 브라우저와 저장소를 확인할 수 없는 브라우저는 기존 주소에서 계속 사용할 수 있습니다. 새 방문은 경로·쿼리·해시를 유지해 대표 주소로 이동합니다. 두 주소의 로컬 기록은 별개입니다.

대표 주소의 Cloudflare DNS 전용 CNAME은 기존 Virtue CloudFront 배포를 가리킵니다. ACM 갱신용 검증 CNAME을 유지합니다. 다음 공유 Terraform 적용 전 `module.app_static_sites["virtue"].aws_acm_certificate.site`가 배포에 연결된 두 도메인용 인증서를 추적하는지 확인하고 필요하면 해당 인증서를 import한 뒤 계획을 검토합니다.

2026-11-27 PMF 계측: 갱신된 이용 분석 동의를 받은 브라우저만 30일 익명 ID로 첫 이용과
후속 덕행 저장을 연결합니다. 기존 첫 방문 동의는 승계하지 않습니다. SDK 자동 수집은 닫고
동의된 최소 이벤트만 직접 보냅니다. 메모·사진·점수·실제 사용자 ID는 분석 속성에 없습니다.
익명 ID 만료·철회·저장소 삭제·기기 차이 때문에 실제 사람 수나 전체 방문자 수와 다를 수 있습니다.

빌드·테스트·설정의 정본은 [Virtue Web README](https://github.com/shdkej/virtue-rebirth-app/blob/master/apps/web/README.md)입니다.
`NEXT_OUTPUT=export` 빌드와 프로토콜/브라우저 검증을 통과한 `out/` 파일을 이 `dist/`에 복사합니다.
Space main push 후 `Deploy static site to AWS`의 virtue 배포·CloudFront 무효화 성공을 확인하고,
소스의 `LIVE_BASE=https://virtue.minimalcollector.com node scripts/verify-pmf.cjs`로 라이브 UI를 검사합니다.
검사 중 수집 요청은 가로채므로 운영 코호트에 시험 데이터를 섞지 않습니다.

PWA 게시 후 대표 주소에서 `/manifest.webmanifest`의 JSON과 `/sw.js`의 JavaScript 본문,
아이콘 PNG의 크기, 루트 범위의 서비스 워커 등록을 확인합니다. CDN이 누락된 객체에도
HTML을 돌려줄 수 있어 HTTP 상태 코드만으로 설치 가능 여부를 판단할 수 없습니다.
Chromium에서 설치 후 실행하고 오프라인 실행과 연결 복구를 확인합니다.
iPhone 설치 경로는 Safari의 공유 → 홈 화면에 추가입니다.
서비스 워커는 오프라인 페이지 안내만 제공합니다. 이미 설치된 워커를 철회할 때는
같은 `/sw.js` 경로에 등록 해제용 워커를 먼저 게시해 기존 설치에도 업데이트가 전달되도록 합니다.

Grafana는 기존 `layer-business`에서 첫 완료율·재사용률과 분자/분모·관찰 중·과거 미측정을
표시합니다. 집계 정본은 [Monitoring PMF 계약](https://github.com/shdkej/monitoring_personal/blob/master/docs/DEPLOYMENT.md#pmf-계측과-코호트)입니다.
복구는 해당 소스/정적 산출물 변경의 revert와 동일 배포 경로를 사용합니다.
