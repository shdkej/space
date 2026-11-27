# Virtue 정적 웹 게시

덕행 기록 웹앱의 AWS 배포 산출물입니다. 소스 정본은 `shdkej/virtue-rebirth-app`의
`apps/web`이며, 이 디렉터리의 `dist/`는 그 정적 export 결과입니다. 기존 빌드의 해시 자산은
열려 있는 탭과 복구를 위해 보존합니다. 컴파일된 JS를 직접 수정하지 않습니다.

운영 주소: https://virtue.aws.shdkej.com. 로컬 기록은 브라우저에 저장하고 AI 채점은 기존
`https://score.virtue.aws.shdkej.com/score`를 호출합니다. 정적 웹에서 Next 서버의 `/api/score`와
`/ingest` rewrite는 사용하지 않습니다. 초기 소스 문서의 Oracle 서버 주소는 이 배포 경로가 아닙니다.

2026-11-27 PMF 계측: 갱신된 이용 분석 동의를 받은 브라우저만 30일 익명 ID로 첫 이용과
후속 덕행 저장을 연결합니다. 기존 첫 방문 동의는 승계하지 않습니다. SDK 자동 수집은 닫고
동의된 최소 이벤트만 직접 보냅니다. 메모·사진·점수·실제 사용자 ID는 분석 속성에 없습니다.
익명 ID 만료·철회·저장소 삭제·기기 차이 때문에 실제 사람 수나 전체 방문자 수와 다를 수 있습니다.

빌드·테스트·설정의 정본은 [Virtue Web README](https://github.com/shdkej/virtue-rebirth-app/blob/master/apps/web/README.md)입니다.
`NEXT_OUTPUT=export` 빌드와 프로토콜/브라우저 검증을 통과한 `out/` 파일을 이 `dist/`에 복사합니다.
Space main push 후 `Deploy static site to AWS`의 virtue 배포·CloudFront 무효화 성공을 확인하고,
소스의 `LIVE_BASE=https://virtue.aws.shdkej.com node scripts/verify-pmf.cjs`로 라이브 UI를 검사합니다.
검사 중 수집 요청은 가로채므로 운영 코호트에 시험 데이터를 섞지 않습니다.

Grafana는 기존 `layer-business`에서 첫 완료율·재사용률과 분자/분모·관찰 중·과거 미측정을
표시합니다. 집계 정본은 [Monitoring PMF 계약](https://github.com/shdkej/monitoring_personal/blob/master/docs/DEPLOYMENT.md#pmf-계측과-코호트)입니다.
복구는 해당 소스/정적 산출물 변경의 revert와 동일 배포 경로를 사용합니다.
