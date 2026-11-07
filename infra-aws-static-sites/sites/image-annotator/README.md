# Image Annotator

화면의 기본 색상은 웜화이트와 레몬 옐로 `#FCF9B7`을 사용합니다. 레몬색은 배경 깊이·포커스·선택 상태에만 제한적으로 사용하고, 본문과 저장 버튼은 어두운 올리브 잉크로 대비를 확보합니다.

R2 이미지 보관함에 사진을 추가하고, 사진별 분류와 주석을 다시 찾을 수 있게 보관하는 정적 도구입니다.

## 구조

- `dist/`: AWS S3 + CloudFront 정적 페이지
- 배포 도메인: `images.aws.shdkej.com` (`sites/registry.json`에 등록된 도메인을 사용)
- `../../lambda/image_annotator.py`: 목록·주석·태그 조회 API와 Decisions 분류 API
- `../../supabase/image_annotations.sql`: 주석·분류 테이블 및 태그 축 스키마
- R2 이미지: 기존 `openclaw-images` 버킷의 `img.shdkej.com`

## 동작

1. 보관함의 업로드는 Cloudflare Access로 보호하고, 허용된 이메일만 업로드할 수 있습니다. 일반 열람은 계속 공개입니다.
2. 업로드 Worker가 사진을 최대 1600px WebP로 변환해 R2의 `original/`에 저장합니다. 브라우저에는 업로드·분류 토큰이 없습니다.
3. Worker가 비공개 서버 토큰으로 Lambda를 호출합니다. Lambda는 R2 공개 이미지 URL을 Decisions API(`gpt-6-luna`)에 보내고, 한 번의 요청에서 주제·복수 내용 태그·복수 판단 태그를 분류합니다.
4. Lambda는 주제와 `subject_tags`·`judgment_tags`를 Supabase `image_topics`에 upsert합니다. 내용 태그·판단 태그는 서로 다른 축으로 보관합니다.
5. Decisions 분류가 실패해도 업로드된 이미지는 유지합니다. 화면에서 같은 사진의 분류를 다시 시도할 수 있고, 재시도 API도 소유자 Access로 보호합니다.
6. 정적 페이지가 이미지 키를 기준으로 Supabase 주석·주제·태그를 조회합니다. 사용자가 주석을 저장하면 Lambda가 `image_annotations`를 upsert합니다.
4. 이미지는 원본 비율로 표시하며, 업로드 날짜는 사진 하단에 작은 오버레이로 표시합니다. 주석이 없으면 사진 아래 주석 영역 자체를 만들지 않습니다.
5. 사진과 텍스트만 남기는 무장식 갤러리로 표시하고, 모바일에서는 사진을 화면 너비에 맞춰 여백 없이 보여줍니다. 링크 복사 결과는 토스트로 알립니다.
7. 이미지는 업로드 날짜 기준 최신순으로 `목록`에서 확인하고, `지도`에서는 주제별 클러스터로 자동 배치합니다. 각 사진에 내용 태그와 판단 태그를 나눠 표시하며, 지도에서 `남기기`를 누른 사진은 브라우저에 보존됩니다.
8. 단일 클릭은 220ms 디바운스 뒤 현재 스크롤 위치를 유지한 채 공개 이미지 URL을 클립보드에 복사하고, 두 번 누르거나 키보드 Enter를 누르면 주석 편집 팝업을 엽니다. 더블클릭에서는 단일 클릭 복사가 실행되지 않습니다.
9. 주석 저장·수정은 팝업 안에서 처리하며, 저장에 성공하면 팝업을 자동으로 닫습니다.
10. 이미지 목록과 주석·분류는 `localStorage`에 캐시하고, 백그라운드에서 최신 API 결과로 갱신합니다.
11. 브라우저에는 R2 토큰, 서버 간 분류 토큰, OpenAI API 키, Supabase service role key를 노출하지 않습니다.

## 주제 분류 연결

- `supabase/image_annotations.sql`의 `image_topics` 테이블에 이미지별 주제, 내용 태그, 판단 태그, 신뢰도, 분류 출처를 저장합니다.
- Cloudflare Worker의 `/browser-upload`와 `/browser-reclassify`는 Access 인증 후 Lambda `/api/classify`를 서버 간 토큰으로 호출합니다. 브라우저에서 Lambda 분류 endpoint를 직접 호출할 수 없습니다.
- `image-annotator/openai-api-key`는 AWS Secrets Manager에서 보관합니다. Lambda 역할에는 이 secret의 읽기 권한만 부여합니다.
- 기존 이미지의 주제는 자동 추정으로 덮어쓰지 않고 `분류 대기`로 남깁니다. 실제 이미지를 확인한 분류 결과만 저장합니다.

## 배포 및 설정

1. `supabase/image_annotations.sql`의 추가 태그 열 migration을 Supabase에 적용합니다.
2. Cloudflare Terraform 변수에 단일 소유자 이메일과 서버 간 `archive_proxy_token`을 설정합니다. 같은 토큰을 AWS Terraform의 `image_annotator_proxy_token`에 설정합니다.
3. OpenAI API 키는 AWS Secrets Manager의 `image-annotator/openai-api-key`에 저장합니다. 키는 코드, 정적 페이지, Terraform 변수·상태에 넣지 않습니다.
4. `infra-cloudflare-images`에서 Terraform plan/apply를 실행해 두 Access 정책과 Worker를 반영합니다. 업로드·재분류 권한은 단일 이메일만 허용합니다.
5. `infra-aws-static-sites`에서 Terraform plan/apply를 실행해 Lambda·IAM·CloudFront API origin을 반영합니다.
6. `sites/image-annotator/dist/` 변경을 Space의 static-site 배포 workflow로 배포하고 라이브 업로드를 확인합니다.

이미지는 한 장당 Decision 요청 한 번이며, 업로드는 이미지 파일만 허용하고 20MB 제한을 둡니다. Decisions 분류 결과는 고정된 보관함 태그 목록 중 확률 0.7 이상인 항목만 기록합니다.

## 검증

```bash
python3 -m py_compile ../../lambda/image_annotator.py
terraform -chdir=../.. fmt -check
terraform -chdir=../.. validate
```

코드 검증과 인프라 검증만으로 배포 완료 처리하지 않습니다. Supabase migration, 단일 이메일 Access 허용, 업로드→R2→Decisions→태그 저장, 비로그인 업로드 차단을 라이브에서 확인해야 합니다. 시크릿은 Git에 저장하지 않습니다.
