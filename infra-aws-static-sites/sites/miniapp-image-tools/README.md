# 이미지 작업대 (파일럿)

이미지 한 장을 브라우저에서 비율 유지 축소 후 PNG/JPEG/WebP로 변환하고 미리보기·다운로드하는 정적 화면입니다. 로그인, 업로드 API, 백엔드, 일괄 작업은 없습니다. 소스와 배포 산출물은 `dist/index.html` 한 파일입니다.

## 실행

`python3 -m http.server 8765 --directory dist` 후 `http://localhost:8765/`에서 엽니다. 의존성 설치나 빌드는 없습니다. `node --test tests/header.test.mjs`로 PNG/JPEG/WebP 헤더 파서의 경계 테스트를 실행합니다. 파일 선택 → 긴 변 최대 길이(64–4096px)와 형식 선택 → 이미지 변환 → 미리보기 → 결과 다운로드 순서입니다. 변환 조건을 바꾸면 이전 다운로드를 무효화합니다.

## 데이터와 제한

파일은 이 탭에서만 읽으며 캔버스로 재인코딩해 출력합니다. 파일을 서버에 업로드하지 않습니다. 입력은 PNG/JPEG/WebP, 12MiB 이하, 각 변 10,000px 이하, 2,000만 화소 이하입니다. 출력은 최대 1,200만 화소·64MiB이며 원본보다 확대하지 않습니다. 변환 후 캔버스를 해제하고 이전 출력의 Blob URL을 폐기합니다. JPEG는 투명 영역을 흰색으로 합성합니다. 브라우저가 MIME별 인코딩을 지원하지 않거나 입력이 손상되면 사용자에게 오류를 표시합니다. EXIF 회전된 JPEG는 헤더와 디코더 치수가 다를 경우 안전하게 거부합니다(현재 미지원). 매우 큰 압축 이미지는 디코더 자체가 파일을 열기 전에 메모리를 할당할 수 있어, 기기 자원까지 보장하지는 않습니다. 다운로드 버튼은 브라우저 저장 요청이며 OS 저장 완료 신호가 아닙니다.

## 계측 연결 경계

코드에 허용된 이벤트는 `image_selected`, `transform_started`, `transform_succeeded`, `transform_failed`, `download_requested` 다섯 개뿐입니다. PostHog SDK, 자동 캡처, 세션 재생은 사용하지 않습니다. 실제 PostHog 프로젝트·리전·브라우저용 공개 project key를 인증된 계정에서 확인하기 전에는 수집을 꺼둡니다. 따라서 현재 출고 파일은 네트워크 수집을 하지 않으며 이벤트 수집 성공이라고 판단하지 않습니다. 연결하려면 실제 프로젝트가 검증된 별도 승인 설정에서 앱 스크립트보다 먼저 `window.__IMAGE_TOOLS_ANALYTICS__={host:'https://us.i.posthog.com',key:'phc_…'}`를 제공해야 합니다. 유럽 프로젝트라면 `https://eu.i.posthog.com`을 사용합니다. 관리용 개인 토큰은 절대로 넣지 않습니다. 프로젝트 검증 전 임의 키를 붙이거나 Virtue 프로젝트 키를 재사용하지 않습니다.

전송 속성은 `app_id`, `build_revision`, `traffic_kind`, 합성 QA에서만 `qa_run_id`, 허용된 MIME·숫자 크기/시간·고정 오류 코드만 가능합니다. 파일명·이미지·EXIF·자유 텍스트 오류는 전송하지 않습니다. 브라우저 QA는 `?qa=1`로 열어 난수 `qa_run_id`와 `traffic_kind=synthetic`을 쓰며 실제 사용자 지표에서 제외합니다. 이벤트 요청 성공과 같은 ID의 PostHog 쿼리 수집 결과는 서로 별도로 검증해야 합니다.

## 검사와 배포

데스크톱/모바일 브라우저에서 정상, 투명 PNG→JPEG, 손상 이미지, 입력 상한, 반복 선택과 변환, 다운로드 파일의 MIME·픽셀 크기·열기를 확인합니다. 개발자 도구 Network에서 외부 요청과 payload를 확인하고 이미지나 파일명이 나가지 않는지 확인합니다. 코드 정적 점검은 인코딩 결과의 `Blob.type` 검사와 UI 오류 경로를 포함합니다.

새 앱 등록은 `../registry.json`과 AWS Terraform 전체 plan 검토가 필요합니다. 이 앱 폴더의 main push는 인프라를 만들지 않습니다. 기존 인증과 비용/권한 경계가 확인되기 전에는 registry 등록·Terraform apply·Actions 수동 배포를 하지 않습니다. 운영 리소스가 생성된 후에만 기존 정적 사이트 workflow가 `dist/`를 게시할 수 있습니다. 복구는 이전 Space commit의 이 앱 `dist/`만 재배포하며 다른 사이트·state는 되돌리지 않습니다.

기획·완료 기준: Knowledge Lab `source/openclaw-system/docs/projects/MINIAPP_IMAGE_TOOLS_PILOT.md`. 이 문서는 소스와 검증 방법을 소유하며, 배포 또는 실제 PostHog 조회를 완료했다고 주장하지 않습니다.
