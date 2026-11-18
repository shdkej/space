# 모두의정책 3D 탐색 구현·검증 계획

사용자 승인: 2026-11-18 “개선해주고 진행해서 배포해줘”. 앞선 Threads 참고와 Three.js 제안의 실행·기존 공개 사이트 배포를 포함한다.

## 목표와 경계

- 하나의 정교한 정책 물체를 실제 카메라로 회전하고, 10개 정책 조각을 펼치고 선택해 가까이 읽는다.
- 이전의 WebP 위 버튼 방식과 구형 '3D 장식 제거' 기준을 대체한다. 실제 장면의 물성·조명·동작을 검증한다.
- 정책 10개와 기관 44개는 독립 자료다. 발표 당시 연도·단계·출처를 보존하며 담당 관계를 만들어 연결하지 않는다.
- 저장·메모·내보내기·기관 검색·키보드·무JS 출처 링크·birth-grant-map.html을 보존한다.
- 기존 HTML/CSS/JS + Three.js 0.187.0, 로컬 vendor. 기존 AWS 정적 배포 유지. 계정·알림·분석·새 인프라 범위 제외.

## 구현 구조

- `dist/policy-scene.js`: 3D geometry, 카메라·조명·회전·선택·펼침, WebGL 실패/모션감소/화면밖 정지.
- `dist/index.html`, `index.css`: 첫 3D 장면과 HTML 읽기 영역, 반응형·키보드·fallback, 기존 정책/기관 본문.
- `dist/app.js`: 기존 데이터·저장·모달 유지와 scene 선택/저장 상태 연결.
- `scripts/vendor-three.cjs`, `dist/vendor/three/`: 고정 의존성·라이선스를 배포 파일로 복사.
- `scripts/verify-scene.cjs`: 실제 캔버스·회전·선택·펼침·복귀·실패 경로와 모바일 검증.
- 기존 브라우저/라이브 검증에서 폐기한 정적 첫화면 전제만 새 장면 조건으로 교체.

## 실행

- [x] 1. 새 장면 존재·선택 테스트 실패 확인, 기존 기능 보호 지점 확인.
- [x] 2. 3D 렌더와 읽기 영역 통합, 1440px·375px 실제 렌더 비교 후 수정.
- [x] 3. 회전 전후·펼침·정책 선택·복귀·터치/스크롤·WebGL 실패·모션 감소 검증.
- [x] 4. 기존 정책 10·기관 44 상세, 저장·메모·내보내기·오류·무JS 회귀 테스트.
- [x] 5. 독립 역할 교차 검토, README/디자인 기준 갱신, main push 및 Actions 완료 확인.
- [x] 6. 라이브 동작·전체 dist 바이트·모바일·기존 출산 지도 확인, 배포 증거 원격 저장.

## 검토 초점

모바일 세로 스크롤과 회전 충돌, 작은 화면 라벨 겹침, 선택 후 카메라 접근이 모달로 가려짐, WebGL/module 실패로 HTML까지 사라짐, 빠른 연속 선택·복귀의 오래된 콜백을 확인한다. 모션 감소는 즉시 전환하고 장면이 화면 밖이면 렌더를 중지한다.

## 역할 기록

[WORKFLOW:CONTEXT] 이전 진단 /tmp/policycock-3d-context.json; 정책 원장·Space main f0c2802·Threads 21초 참고 영상 확인. Codex 직접 실행이며 OpenClaw 중복 실행을 만들지 않는다.

[WORKFLOW:PLAN] Planner: 실제 회전/접근/펼침, 데이터 보호, 모바일과 무JS를 완료 조건으로 제안. Marketer: 장면 비중 65–75%, 통일된 세라믹 물체와 짧은 HTML 라벨, 설명을 고정 좌표에 유지. Operator: 기존 AWS 유지, vendor self-host, birth-grant-map 보존. Developer: policy-scene 모듈 담당. 동시 실행 슬롯 제한으로 Developer는 선행 검토 역할 종료 후 시작.

[WORKFLOW:DECISION] 전역 3D 보조 규칙보다 이번 제품의 명시적 3D 요구를 우선한다. 따뜻한 밝은 배경과 짙은 녹색 받침은 이번 구현 제안이며 사용자 전체 취향으로 확대하지 않는다. 기존 기술 스택에 Three.js만 추가해 자산 제작/실행 경로를 단순화한다.

[WORKFLOW:EXECUTE] 첫 테스트에서 #policy-scene 부재(0/1)로 RED 확인 후 장면을 추가했다. 기존 정적 정책 링크를 대체하지 않고 진입 장면으로 통합했다. 768px 라벨 겹침을 실제 테스트에서 발견해 1100px 이하를 3열로 수정했고 경계 1100/1101px을 포함해 확인한다.

[WORKFLOW:QA] npm run check와 npm test가 종료 코드 0으로 통과했다. 기존 HTML 기능 19개 묶음과 실제 3D 9개 묶음이며, qa/verification.json과 qa/scene-verification.json에 기록한다. Chrome 소프트웨어 WebGL을 사용했으므로 실기기 FPS 측정으로 해석하지 않는다. 1440px 기본·펼침·선택, 390px 실제 캡처를 직접 살폈다.

[WORKFLOW:REVIEW] 독립 코드 검토의 라벨 행렬·저장 재동기화·라벨 위 드래그·부분 실패 cleanup을 수정했다. 검증기 검토에서 CSS 배경과 조명 변화 혼동, 타일 상승과 카메라 이동 혼동, 모션 감소의 느슨한 기다림을 찾아 단언을 강화한 후 장면 검사 9개 묶음을 다시 실행해 종료 코드 0을 확인했다. 역할별 범위와 한계는 qa/review.json에 남긴다.


[WORKFLOW:DEPLOY] 소스 8fdad908f5c2141875264c29f1b5ce81d630e8c8을 main에 push했다. Actions 44280357668의 policycock 잡과 S3 동기화·CloudFront 무효화가 성공했다. 공개 URL에서 HTML 8개·3D 9개 검사 묶음을 통과했고 dist 17개 파일의 바이트·SHA-256·JS MIME, /·/sources 경로, 출산지원금 지도 보존을 확인했다. 1440px·390px 라이브 캡처를 직접 살폈다. qa/deployment.json 및 live-* 결과가 배포 근거다.
