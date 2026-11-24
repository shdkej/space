# 이미지 작업대 (파일럿)

이미지 한 장을 브라우저에서 비율 유지 축소 후 PNG/JPEG/WebP로 변환하고 미리보기·다운로드하는 정적 화면입니다. 로그인, 업로드 API, 백엔드, 일괄 작업은 없습니다. 소스와 배포 산출물은 `dist/index.html` 한 파일입니다.

## 실행

`python3 -m http.server 8765 --directory dist` 후 `http://localhost:8765/`에서 엽니다. 의존성 설치나 빌드는 없습니다. `node --test tests/*.test.mjs`로 헤더·계측·설정 변경 상태 테스트를 실행합니다. 파일 선택 → 긴 변 최대 길이(64–4096px)와 형식 선택 → 이미지 변환 → 미리보기 → 결과 다운로드 순서입니다. 변환 조건을 바꾸면 이전 다운로드를 무효화하고 완료 문구를 재변환 안내로 교체합니다. 파일 헤더 읽기 도중 조건을 바꿔도 해당 파일의 선택 상태를 확정하며, 더 최근에 선택한 파일의 상태는 오래된 읽기 결과로 덮어쓰지 않습니다. 좁은 화면에서 완료 후 결과가 화면 밖에 있으면 결과 영역으로 이동하며, 움직임 줄이기 설정에서는 부드러운 스크롤을 사용하지 않습니다.

## 데이터와 제한

파일은 이 탭에서만 읽으며 캔버스로 재인코딩해 출력합니다. 파일을 서버에 업로드하지 않습니다. 선택한 원본의 크기는 1024B 미만에서 B, 1MiB 미만에서 KB, 그 이상에서 MB로 표시합니다. 0B 입력은 `선택한 파일이 비어 있습니다.`와 다른 이미지 선택 안내를 표시하며 기존 `file_too_large` 코드로 거부합니다. 결과 크기 라벨과 입력 12MiB 제한은 그대로 유지합니다. 입력은 PNG/JPEG/WebP, 12MiB 이하, 각 변 10,000px 이하, 2,000만 화소 이하입니다. 출력은 최대 1,200만 화소·64MiB이며 원본보다 확대하지 않습니다. 변환 후 캔버스를 해제하고 이전 출력의 Blob URL을 폐기합니다. JPEG는 투명 영역을 흰색으로 합성합니다. 브라우저가 MIME별 인코딩을 지원하지 않거나 입력이 손상되면 사용자에게 오류를 표시합니다. EXIF 90°/270° 회전 JPEG의 입력 상한은 원본 헤더 치수로 검사하고, 축소 비율과 결과 크기는 브라우저가 회전 적용 후 디코딩한 치수로 계산합니다. 매우 큰 압축 이미지는 디코더 자체가 파일을 열기 전에 메모리를 할당할 수 있어, 기기 자원까지 보장하지는 않습니다. 다운로드 버튼은 브라우저 저장 요청이며 OS 저장 완료 신호가 아닙니다.

## 계측 연결 경계

코드에 허용된 이벤트는 `image_selected`, `transform_started`, `transform_succeeded`, `transform_failed`, `download_requested` 다섯 개뿐입니다. PostHog SDK, 자동 캡처, 페이지뷰, 식별, 세션 재생은 사용하지 않습니다. 사용자가 승인한 기존 US 조직의 Default project(424014)는 이미지 작업대와 모두의정책이 공용으로 사용합니다. 각 앱은 고유한 `app_id`로 이벤트를 구분합니다. 소스에는 토큰 대신 placeholder를 두고 수동 릴리스 workflow가 검증된 repository secret `POSTHOG_MINIAPP_PROJECT_TOKEN`을 배포 산출물에만 삽입합니다. 관리·조회용 개인 토큰은 절대로 브라우저나 GitHub에 넣지 않습니다. 수집 토큰은 게시된 브라우저 JS에서 공개되며 읽기 권한을 주지 않습니다. 이 설정은 계측 수집 자체의 성공 증거가 아닙니다.

전송 속성은 `app_id`, `build_revision`, `traffic_kind`, 합성 QA에서만 `qa_run_id`, 허용된 MIME·숫자 크기/시간·고정 오류 코드와 프로필 비활성화 플래그만 가능합니다. 파일명·이미지·EXIF·자유 텍스트 오류는 전송하지 않습니다. 브라우저 QA는 `?qa=1`로 열어 난수 `qa_run_id`와 `traffic_kind=synthetic`을 씁니다. 사용자 중심 쿼리는 `properties.app_id = 'miniapp-image-tools' AND properties.traffic_kind = 'user' AND properties.traffic_kind != 'synthetic'`을 명시적으로 적용하며 프로젝트 전체 수치를 앱 사용자로 오인하지 않습니다. `?qa=1`은 신뢰된 고객 인증이 아닙니다. PostHog가 처리하는 클라이언트 IP에 관해 무수집을 보장하지 않습니다. 이벤트 요청 성공과 같은 ID의 PostHog 쿼리 수집 결과는 서로 별도로 검증해야 합니다.

## 검사와 배포

데스크톱/모바일 브라우저에서 정상, 투명 PNG→JPEG, 손상 이미지, 입력 상한, 반복 선택과 변환, 다운로드 파일의 MIME·픽셀 크기·열기를 확인합니다. 개발자 도구 Network에서 외부 요청과 payload를 확인하고 이미지나 파일명이 나가지 않는지 확인합니다. 코드 정적 점검은 인코딩 결과의 `Blob.type` 검사와 UI 오류 경로를 포함합니다.

이 앱은 독립 CloudFront alias가 아닌 기존 `images.aws.shdkej.com/tools/image-converter/` 하위 경로로 게시합니다. `../registry.json`에 새 alias를 등록하거나 Terraform/IAM을 변경하지 않습니다. 범용 정적 사이트 workflow는 이 앱을 자동 배포하지 않습니다. 이미지 도메인의 전체 사이트 `--delete` 동기화에서는 `tools/image-converter/` 정확한 trailing-slash object와 `tools/image-converter/*` 하위 object를 모두 제외해 전용 배포 결과를 보존합니다(다른 도메인의 동기화에는 이 제외 규칙을 적용하지 않습니다). 이미지 도메인의 범용 배포 job과 전용 수동 workflow는 동일한 concurrency group에서 실행을 직렬화하며 대기 중 실행은 `queue: max`로 유지합니다. 수동 `.github/workflows/miniapp-image-converter-release.yml`만 기존 OIDC 배포 역할과 이미지 사이트 bucket/distribution을 검증한 뒤 이 하위 경로의 두 HTML object만 올리고 해당 두 경로만 무효화합니다. `mode=preflight`(기본)는 두 정확한 키의 HEAD/GET 본문·길이·해시와 배포 전 복원 메타데이터를 읽고, Git의 고정 직전 소스 `80966e76`(r2-t05)와 기존 프로젝트 secret으로 직전 두 객체의 동일 본문 SHA-256 `0c4f03f1…4533b`를 재구성·대조합니다. 현재 버킷의 버전 ID는 제공되지 않으므로 버전 복원에 의존하지 않습니다. `mode=rehearse`는 동일 본문을 두 키에 재기록한 뒤 본문/헤더를 읽어 검증하고 두 경로만 무효화합니다. 실제 `mode=release`는 검증된 두 원본을 임시 러너에 보유하고, 각 새 본문/헤더와 CDN 경로를 확인하며 실패 시 두 키 모두 직전 본문으로 되돌리고 무효화합니다. 러너 강제 종료로 trap이 실행되지 않으면 같은 전용 workflow를 배포 커밋 ref의 `mode=restore`로 별도 재실행해 고정 직전 소스를 재구성한 뒤 두 키의 본문/헤더 읽기와 무효화를 확인합니다. restore는 두 객체가 직전 본문 또는 이 릴리스의 본문인 경우에만 진행하므로 부분 쓰기는 복구하지만 알 수 없는 제3자 본문은 덮어쓰지 않습니다. 기존 secret이 변경되어 직전 소스 SHA와 다르면 복원을 중단하며 임의 파일로 대체하지 않습니다. `mode=release`를 반복 실행할 때 원본 SHA가 더는 일치하지 않으면 쓰기 전에 중단합니다. 다른 앱·버킷 전체 동기화나 신규 권한은 이 경로에 포함되지 않습니다. 실행 증거는 `qa/release-checkpoint.md`를 참고하세요. 공유 프로젝트 승인은 실제 이벤트 수집·사용자 지표 검증을 대체하지 않습니다.

기획·완료 기준: Knowledge Lab `source/openclaw-system/docs/projects/MINIAPP_IMAGE_TOOLS_PILOT.md`.
내구성 점검: 격리된 Moto S3에서 실제 AWS CLI `sync --delete` 필터로 두 전용 키의 생존과 다른 stale key 삭제를 확인했습니다. 범용 workflow의 중첩 index 업로드에서도 이 경로를 건너뜁니다. GitHub Actions concurrency 문서의 `matrix` 컨텍스트와 `queue: max`를 확인했으나, 구버전 actionlint는 `queue`를 아직 인식하지 못합니다. 2026-11-18 당시의 점검은 라이브 재배포를 포함하지 않았습니다. 이후 배포·브라우저 검증 범위는 `qa/release-checkpoint.md`를 참고하며, 실제 PostHog 조회와 계측 완료는 주장하지 않습니다.
