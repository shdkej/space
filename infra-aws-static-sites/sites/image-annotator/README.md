# Image Dashboard + Clef 사진정리

기존 R2 이미지와 Supabase 태그·주석을 한곳에서 찾고 정리하는 웹앱입니다. 새 사진을 여러 장 올리거나 기존 보관함을 불러와 Cloudflare Clef로 분류합니다.

- 이미지 대시보드: https://images.aws.shdkej.com/
- 사진정리: https://images.aws.shdkej.com/sort/
- 디자인: 웜화이트 바탕, 레몬 옐로 `#FCF9B7` 선택·강조, 올리브 본문 대비와 로컬 Pretendard 폰트를 사용합니다.

## 소스와 데이터 정본

| 구성 | 위치·역할 |
| --- | --- |
| 기존 대시보드 | `dist/index.html`: 목록·지도·주석·기존 업로드 |
| 사진정리 소스 | `sorter/`: React + TypeScript + Vite, 빌드 출력 `dist/sort/` |
| Lambda 코드·테스트·패키징 | 독립 [image-annotator-api](https://github.com/shdkej/image-annotator-api), 로컬 `/home/ubuntu/workspace/services/image-annotator-api` |
| AWS 배포 선언 | `../../image_annotator.tf`, `../../image_sorter.tf`, `../../releases/image-annotator.json` |
| 업로드 Worker | Space `infra-cloudflare-images/worker/index.js` |
| 사진·태그·작업 | 기존 R2 `original/`, Supabase `image_topics`·`image_annotations`, DynamoDB `image-annotator-sorter` |

Space의 이전 `lambda/image_annotator.py`는 독립 서비스로 이전했습니다. 이후 서비스 코드를 그 레거시 경로에 추가하지 않습니다. 기존 `/api/images`, `/api/topics`, `/api/annotations`, `/api/classify` 계약을 유지합니다.

## 사용

1. 대시보드에서 **사진 정리 · Clef**를 열고 파일·폴더를 선택하거나 끌어다 놓습니다. **보관함 불러오기**로 기존 이미지를 추가할 수도 있습니다. 동영상은 제외합니다.
2. **분류하기**는 Clef로 주제·내용 태그를 판단합니다. 기존 분류 사진은 자동 덮어쓰기 없이 남기고 선택한 사진만 재분류합니다.
3. 설정한 확신도 미만이면 **검토 필요**로 남습니다. 사진을 열어 분류를 직접 저장할 수 있습니다. 기존 내용 태그·판단 태그·요약을 보존하며 태그 동시 수정은 조건부 저장 후 재병합합니다.
4. 태그 저장 실패는 AI를 다시 호출하지 않고 **태그 저장 재시도**로 처리합니다. 분류 상태는 새로고침 후에도 남습니다.
5. 폴더·파일명·태그로 찾고, 현재 폴더를 ZIP·CSV로 내보냅니다. 검색어는 내보내기 범위에 적용하지 않습니다.

기존 대시보드의 목록·지도·주석 편집·URL 복사·로컬 캐시는 유지합니다. 기존 업로드 경로 `/browser-upload`는 Decisions 분류를 유지하고, 새 `/browser-store` 경로는 동일한 이미지 저장만 수행한 뒤 사진정리 화면이 Clef를 호출합니다.

## 개인 분류 설정 · 2026-11-11

사용자 요청에 따라 운영 설정의 분류명을 아래 8개로 변경했습니다. 이번 범위는 **분류 설정만 변경**이며 기존 사진·태그·주석을 재분류하지 않습니다. 적용 정본은 운영 `/api/sort/settings`이고, 새 사진 또는 사용자가 선택해 재분류하는 사진부터 적용됩니다. 검토 기준은 기존 80%를 유지했습니다.

| 분류명 | 다시 찾을 자료 |
| --- | --- |
| 인사이트·문장 | 책의 문장, 개념 설명, 생각 메모, 다이어그램 |
| 공간·건축 | 서재·거실·카페·도서관의 구조, 가구 배치, 빛과 동선 |
| 제품·서비스 | 물건의 쓰임, 상품 구성, 앱 UI, 서비스·작업 흐름 |
| 디자인·브랜드 | 표지·패키지·포스터·로고·타이포그래피·시각 표현 |
| 예술·전시 | 회화·조각·설치·공연과 작품 감상 기록 |
| 여행·풍경 | 도시·자연·야경·여행지의 전체 장면 |
| 일상·경험 | 식사·사람·활동 등 생활 장면 |
| 아카이브·자료 | 티켓·안내문·표·문서·증빙·조회용 화면 |

다시 찾을 때의 구분: 전시실 **배치**는 공간, 전시 **작품**은 예술로 봅니다. 노트 **표지**는 디자인, 노트의 **생각**은 인사이트로 봅니다. 제품의 **사용 방식**은 제품·서비스, 제품의 **포장 표현**은 디자인으로 봅니다. 아카이브는 기타 폴더가 아닌 사실·자료를 다시 확인하는 용도입니다. 여행지 건물도 구조·공간 구성이 중심이면 공간, 도시 전체 장면이면 여행으로 봅니다.

이 설명은 수동 판단·운영 가이드입니다. 현재 설정 API는 분류명과 검토 기준만 지원하므로 Clef에는 위 8개 **분류명**이 전달됩니다. 촬영 의도나 사진 밖 맥락을 이해했다고 간주하지 않습니다. 기존 분류 폴더는 사진을 옮기지 않았으므로 함께 표시됩니다.

운영 화면의 설정 저장 200, 새로고침 후 8개 항목 유지, 변경 전후 70장의 작업 데이터·주제 태그·주석 일치, 모바일 설정창과 브라우저 오류 없음을 확인했습니다. 개인 데이터가 포함된 백업과 검증 기록은 gitignored `sorter/outputs/taxonomy-*`에 보관합니다. 복구는 `taxonomy-before-settings.json`의 categories·threshold를 설정 화면에서 다시 저장합니다. 앱 코드·인프라 배포는 변경하지 않았습니다.

## 개발·검증

```bash
cd infra-aws-static-sites/sites/image-annotator/sorter
npm ci
npm test
npm run build
npm run dev
```

로컬 Vite의 `/api`는 운영 API에 연결됩니다. 실제 업로드·분류·수정은 운영 데이터에 반영됩니다. Worker 테스트는 Space 루트에서 `node --test infra-cloudflare-images/tests/browser-store.test.mjs`, 서비스 테스트는 독립 저장소 README를 따릅니다.

## 배포·복구

1. 서비스 테스트 후 source commit을 push하고 `scripts/package.py`로 SHA 기반 ZIP을 만듭니다. 비공개 S3 artifact 버킷에 덮어쓰기 없이 올립니다.
2. Space release JSON을 갱신하고 AWS Terraform plan의 변경 범위를 확인해 적용합니다. Clef 토큰·계정은 `image-annotator/cloudflare-clef` Secrets Manager에만 저장합니다. 기존 OpenAI secret과 Lambda 환경 설정은 유지합니다.
3. 업로드 Worker 변경은 `infra-cloudflare-images`의 기존 Terraform 원격 backend로 배포합니다.
4. 프런트 빌드 후 Space branch를 push하고 아래 workflow를 실행합니다. 기존 dashboard가 main에 없는 상태이므로 현재 서비스 branch를 명시합니다.

```bash
gh workflow run static-site-aws-template.yml --repo shdkej/space \
  --ref codex/clef-image-sorter -f app=image-annotator -f domain_name=images.aws.shdkej.com
```

workflow는 기존 S3 버킷에 `dist/`를 동기화하고 `sort/` 경로용 HTML object를 게시한 뒤 CloudFront 무효화를 기다립니다. 다른 사이트의 배포는 필요하지 않습니다.

5. `/api/health`, `/api/sort/health`의 revision, 업로드·분류·태그 재조회·새로고침·모바일/데스크톱 실제 렌더를 확인합니다. 검증 기록은 [DEPLOYMENT.md](DEPLOYMENT.md)에 남깁니다.

복구는 직전 release JSON/artifact, Worker commit, 정적 파일 snapshot을 재배포합니다. 첫 이전의 Lambda 코드·설정과 S3 파일 snapshot은 독립 서비스의 gitignored `outputs/`에 보관했습니다. 데이터는 코드 복구 과정에서 지우지 않습니다. AWS local Terraform state는 최신 적용 결과를 원래 Space 작업 공간에도 동기화하되, 동시 변경 여부를 먼저 확인합니다.

## 공개 범위와 한계

기존 개인 테스트 보관함과 같은 공개 공유 공간이며 로그인 없이 열람·업로드·분류할 수 있습니다. API 키·계정·Supabase service key는 브라우저로 보내지 않습니다.

1회 1,000장, 장당 20MB, 작업 공간 5,000장입니다. 기존 업로드 API 정책에 따라 최대 1600px WebP로 저장하며 저장 URL로 열람할 수 있습니다. JPEG/PNG/WebP를 지원합니다. 열린 탭이 분류를 진행하며 중단 후 저장된 결과를 이어서 사용할 수 있습니다. ZIP은 브라우저 메모리를 사용하므로 한 번에 128MiB까지입니다.

원격 업로드 응답이 유실되거나 다른 탭에서 같은 파일을 동시에 처음 올리는 경우 R2에 사본이 생길 수 있습니다. 저장 성공 응답 후 등록 실패는 같은 탭에서 재업로드 없이 복구하며, 목록은 hash로 중복을 제외합니다. 모델의 확신도는 정확도 보장이 아니므로 검토 화면과 수동 분류를 제공합니다.
