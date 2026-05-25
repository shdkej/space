variable "cloudflare_api_token" {
  description = "Cloudflare API Token. (권한: Workers Scripts:Edit, Workers R2 Storage:Edit, Zone:Read, DNS:Edit). 환경변수 CLOUDFLARE_API_TOKEN 사용 시 빈 문자열로 둔다."
  type        = string
  sensitive   = true
  default     = ""
}

variable "account_id" {
  description = "Cloudflare Account ID"
  type        = string
}

variable "zone_id" {
  description = "공개 도메인이 속한 Zone ID (예: shdkej.com zone)"
  type        = string
}

variable "bucket_name" {
  description = "R2 버킷 이름"
  type        = string
  default     = "openclaw-images"
}

variable "public_domain" {
  description = "이미지 조회용 공개 커스텀 도메인 (R2에 연결). 예: img.shdkej.com"
  type        = string
}

variable "upload_route" {
  description = "업로드 Worker를 노출할 라우트 패턴. 예: upload.shdkej.com/*"
  type        = string
}

variable "upload_api_token" {
  description = "OpenClaw가 업로드 시 Authorization: Bearer 헤더로 보낼 시크릿 토큰"
  type        = string
  sensitive   = true
}

variable "max_width" {
  description = "리사이즈 최대 가로 픽셀 (이보다 크면 축소, 작으면 원본 유지)"
  type        = number
  default     = 1600
}

variable "output_format" {
  description = "저장 이미지 포맷 (image/webp 권장, image/avif, image/jpeg 가능)"
  type        = string
  default     = "image/webp"
}
