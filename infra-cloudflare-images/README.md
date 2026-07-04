# Cloudflare 이미지 저장소 (OpenClaw 업로드용)

OpenClaw가 사진을 보내면 Cloudflare Worker가 리사이즈해서 R2에 저장하고, 공개 URL을 돌려준다.

## 구조

```
업로드:  OpenClaw → POST https://upload.<도메인> (Bearer 토큰)
                     └─ Worker: 토큰검증 → Images 바인딩 리사이즈 → R2 put → URL 반환
조회:    https://img.<도메인>/<key>   (R2 커스텀 도메인, CDN 캐싱 / Worker 미경유)
```

- **리사이즈**: Worker의 `IMAGES` 바인딩 사용. wasm을 Worker CPU에서 돌리는 게 아니라 Cloudflare 인프라가 변환을 처리해 안정적이다. **업로드 시 1회만** 변환하므로 변환 과금이 미미하고, 조회는 R2 정적 서빙이라 변환 비용 0.
- **인증**: 업로드는 `Authorization: Bearer <UPLOAD_TOKEN>`. 소프트 삭제는 별도 `Authorization: Bearer <DELETE_TOKEN>`. 조회는 공개.
- **공개**: R2 커스텀 도메인으로 CDN 캐싱.

## 사전 준비

1. **R2 활성화**: Cloudflare 대시보드에서 R2를 한 번 활성화(결제 정보 등록, 무료 등급 존재).
2. **Images 활성화**: Workers의 Images 바인딩을 쓰려면 Cloudflare Images가 활성화돼 있어야 한다(변환 1000건/월 무료 등급).
3. **API Token 발급**: 권한 — `Account / Workers Scripts:Edit`, `Account / Workers R2 Storage:Edit`, `Zone / Workers Routes:Edit`, `Zone / DNS:Edit`, `Zone / Zone:Read`.
4. **도메인이 Cloudflare Zone에 존재**해야 한다 (예: `shdkej.com`).

## 사용법

```bash
cd infra-cloudflare-images

cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars 편집: account_id, zone_id, public_domain, upload_route, upload_api_token

export CLOUDFLARE_API_TOKEN=<발급한_토큰>   # 또는 tfvars의 cloudflare_api_token

# 원격 state는 Oracle Object Storage(S3 호환) 사용.
# backend.hcl 에 OCI Customer Secret Key 를 넣는다(access_key/secret_key). 커밋 안 됨.
# Oracle은 AWS SDK 의 aws-chunked 인코딩을 거부하므로 아래 환경변수가 필요하다.
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required

terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

> **Oracle backend 주의**
> - `backend.hcl` 의 키는 **OCI Customer Secret Key** 여야 한다(OCI 콘솔 → User settings → Customer Secret Keys). DO Spaces/AWS 키가 아니다.
> - 위 `AWS_*_CHECKSUM_*` 환경변수 없이 apply 하면 리소스는 만들어지지만 state 저장이 `501 NotImplemented: AWS chunked encoding not supported` 로 실패한다. (`versions.tf` 의 `skip_s3_checksum=true` 만으론 부족.)

`account_id` / `zone_id` 확인:

```bash
# Token 인증 기준
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/zones | \
  python3 -c 'import sys,json;[print(z["name"], z["id"], z["account"]["id"]) for z in json.load(sys.stdin)["result"]]'
```

업로드 토큰 생성:

```bash
openssl rand -hex 32
```

## 저장된 이미지 다시 가져오기

업로드 Worker는 같은 Bearer 토큰으로 저장소 조회도 제공한다.

랜덤 이미지 1장:

```bash
curl https://upload.shdkej.com/random \
  -H "Authorization: Bearer $UPLOAD_TOKEN"
# → {"url":"https://img.shdkej.com/original/2026/06/22/<uuid>.webp","key":"..."}
```

최근 이미지 목록:

```bash
curl "https://upload.shdkej.com/list?limit=100" \
  -H "Authorization: Bearer $UPLOAD_TOKEN"
```

카드뉴스 첫 페이지처럼 “보관함에서 임의의 원본 사진”이 필요할 때는 `/random`을 우선 사용한다.
`/random`은 기본으로 `original/`만 본다. 가공 산출물 목록이 필요할 때만 `?kind=derived` 또는 `?prefix=derived/`를 쓴다.

원본 이미지를 휴지통으로 이동(소프트 삭제):

```bash
curl -X DELETE "https://upload.shdkej.com/object?key=original/YYYY/MM/DD/<uuid>.webp" \
  -H "Authorization: Bearer $DELETE_TOKEN"
# → {"ok":true,"key":"original/...","deletedKey":"deleted/original/..."}
```

## OpenClaw에서 업로드하는 법

raw 이미지 본문:

```bash
curl -X POST "https://upload.shdkej.com?kind=original" \
  -H "Authorization: Bearer $UPLOAD_TOKEN" \
  -H "Content-Type: image/jpeg" \
  --data-binary @photo.jpg
# → {"url":"https://img.shdkej.com/original/2026/05/25/<uuid>.webp","key":"..."}
```

multipart 폼:

```bash
curl -X POST "https://upload.shdkej.com?kind=original" \
  -H "Authorization: Bearer $UPLOAD_TOKEN" \
  -F "file=@photo.jpg"
```

카드뉴스, 썸네일, 재렌더 결과처럼 한 번 가공된 이미지는 기본값인 `derived/`에 저장한다. 명시하려면 `?kind=derived`를 붙인다.

응답의 `url`을 OpenClaw가 받아서 관리하면 된다.

## 비용 메모

- **R2 저장**: 10GB/월 무료, 이후 $0.015/GB. 조회(Class B) 요청 무료 등급 넉넉.
- **R2 egress**: 무료 (R2의 핵심 장점).
- **Images 변환**: 업로드당 1회만 발생. 1000 unique transformations/월 무료.
- **Workers**: 업로드 요청에만 과금. 무료 10만 req/일.

조회 트래픽이 아무리 많아도 변환·egress 비용이 안 붙는 구조라 비용이 거의 고정된다.

## 주의 / 향후

- `IMAGES` 바인딩의 `transform`/`output` API는 Cloudflare Images 활성화가 전제다. 만약 Images를 켜고 싶지 않으면 `worker/index.js`의 `resizeImage`를 wasm(`@cf/photon`)으로 교체할 수 있으나, 큰 이미지에서 Worker CPU 제한 이슈가 있을 수 있다(현재 구조가 이를 회피).
- `cloudflare_workers_route` 는 DNS 레코드를 만들지 않는다. 업로드 호스트네임(`upload.*`)이 **proxied DNS 레코드**로 zone에 존재해야 Worker가 트래픽을 받는다(`main.tf` 의 `cloudflare_dns_record.upload` 더미 A 레코드). `img.*` 조회 도메인은 R2 custom domain 이 DNS 를 자동 생성한다.
- 상태(state)는 기본 로컬 저장이며 `terraform.tfvars`/`*.tfstate`는 repo `.gitignore`로 무시된다. 팀 공유가 필요하면 `versions.tf`의 backend 블록을 활성화한다.
