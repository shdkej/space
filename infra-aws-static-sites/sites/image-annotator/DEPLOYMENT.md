# Clef 사진정리 배포 검증 · 2026-11-11

운영 주소: https://images.aws.shdkej.com/sort/ . 기존 https://images.aws.shdkej.com/ 에서 `사진 정리 · Clef` 링크로 진입합니다. 사용자 요청에 따라 Space의 기존 S3·CloudFront·Lambda·R2·Supabase 경로에 통합했습니다.

## 배포 식별자

| 대상 | 확인된 값 |
| --- | --- |
| Lambda source / main | `a5e0da8d154c26e141e6be70ac61bc73d5953420` · `shdkej/image-annotator-api` |
| Lambda 코드 SHA256 (Base64) | `ZssgX0ataFskeoZbq5GTA3xWOhmJ4K1aI034988WVkw=` |
| Space 화면·인프라 source | `23ba51d0e6fecd63d6b15fcb8e0eae551bbec99d` · `codex/clef-image-sorter` |
| 프런트 배포 | [GitHub Actions 43101811549 성공](https://github.com/shdkej/space/actions/runs/43101811549) |
| Worker | `cloudflare_workers_script.uploader` 코드 1개 업데이트 완료 |
| AWS | 초기 7개 리소스 추가, 기존 Lambda 1개 업데이트. 삭제 0개 |

기존 대시보드 커밋이 main에 없으므로 이번 source branch에서 배포했습니다. 무관한 기존 branch 변경을 main에 병합하지 않았습니다. 후속 문서 commit은 운영 코드 revision을 바꾸지 않습니다.

## 확인한 동작

- 서버 회귀 29개, 프런트 14개, Worker 2개 통과. TypeScript 검사·Vite build, Python compile, 양쪽 Terraform validate, git diff 검사 통과.
- 목록 페이지 분할·빈 페이지 이어 읽기·중복 등록 복구·동시 분류 lease·동시 태그 수정 재병합·낮은 확신도 검토·저장만 재시도는 자동 테스트로 확인했습니다.
- 기존 보관함 71개 항목 중 정지 이미지 70장을 가져왔고 동영상 1개를 제외했습니다. 다시 가져오기에서는 0장을 추가했습니다. 기존 분류를 보존합니다.
- 실제 기존 사진 1장을 브라우저에서 선택해 Clef로 재분류했습니다. `@cf/cloudflare/clef`, `done`, `문서·화면`, 확신도 `0.8476`으로 저장되었으며 기존 내용 태그·판단 태그·요약 보존을 API 재조회로 확인했습니다.
- 합성 PNG 두 개(동일 내용)를 한 번에 선택해 원격 업로드가 정확히 1회 발생하고 등록이 201로 완료되는 것을 확인했습니다.
- 그 사진의 ZIP은 WebP 1개가 `미분류/` 폴더에 들어갔고 CSV는 헤더+사진 1행을 포함했습니다. 수동 분류는 기존 `/api/topics`에서 재조회했으며 새로고침 후 `manual` 상태가 유지됐습니다.
- 테스트 사진은 기존 soft-delete API로 `deleted/`에 이동하고 테스트용 태그·작업 상태·hash를 정리했습니다. 기존 사진은 삭제하지 않았고 최종 작업 사진 수는 70장입니다.
- 데스크톱·모바일 실제 렌더, 기존 대시보드 링크, 설정창, 새로고침을 확인했습니다. 브라우저 런타임 오류는 없었습니다.
- 운영 HTML과 로컬 빌드 파일이 일치합니다. `/api/health`, `/api/sort/health`, 사진 목록은 200이며 실제 Lambda 코드 해시·SOURCE_REVISION은 release JSON과 일치합니다. Lambda 상태 `Active / Successful`입니다.
- 서비스 및 Space source의 로컬·원격 SHA 일치를 표준 `verify-completion.sh`로 확인했습니다. AWS local state는 원본 Space state가 변경되지 않았음을 확인한 뒤 동기화했습니다.

## 증거와 남은 범위

로컬 브라우저 검증 JSON·스크린샷·ZIP·CSV는 `sorter/outputs/`에 있으며 Git에서 제외합니다. 이미지·파일명·개인 데이터가 포함된 원본 증거를 공개 저장소에 올리지 않습니다. 이전 Lambda 설정(비밀 포함)·ZIP과 정적 파일 복구 snapshot은 독립 서비스 `outputs/`에 보관합니다.

1,000장 실부하·5,000장 전체 보관함의 성능 시험은 하지 않았습니다. 한도·페이지 분할·경쟁 상황은 자동 테스트로 검증했고 라이브 검증은 기존 70장과 합성 업로드로 제한했습니다. 분류 실행은 열린 브라우저 탭이 담당하며 ZIP 128MiB 한도와 원격 업로드 응답 유실 시 중복 가능성은 [README](README.md)에 설명했습니다.

이전 Sites/Vinext·D1 앱은 운영에서 사용하지 않습니다. 운영 코드·배포·복구 경로의 정본은 이 디렉터리 README와 독립 서비스 README입니다. Knowledge Lab 서비스 레지스트리에는 사용자 변경 요청과 최종 정본 연결을 로컬 반영했습니다.
