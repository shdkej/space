data "cloudflare_zone" "public" {
  zone_id = var.zone_id
}

# 1. 이미지 저장용 R2 버킷
resource "cloudflare_r2_bucket" "images" {
  account_id = var.account_id
  name       = var.bucket_name
  location   = "APAC"
}

# 2. R2 커스텀 도메인 연결 (조회는 Worker를 거치지 않고 R2 -> CDN 직접 서빙)
resource "cloudflare_r2_custom_domain" "public" {
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.images.name
  domain      = var.public_domain
  zone_id     = var.zone_id
  enabled     = true
  min_tls     = "1.2"
}

# 3. 업로드 Worker (토큰 검증 -> Images 바인딩으로 리사이즈 -> R2 put -> 공개 URL 반환)
resource "cloudflare_workers_script" "uploader" {
  account_id  = var.account_id
  script_name = "openclaw-image-uploader"

  content     = file("${path.module}/worker/index.js")
  main_module = "index.js"

  compatibility_date = "2024-09-23"

  bindings = [
    {
      name        = "BUCKET"
      type        = "r2_bucket"
      bucket_name = cloudflare_r2_bucket.images.name
    },
    {
      name = "IMAGES"
      type = "images"
    },
    {
      name = "UPLOAD_TOKEN"
      type = "secret_text"
      text = var.upload_api_token
    },
    {
      name = "PUBLIC_BASE_URL"
      type = "plain_text"
      text = "https://${var.public_domain}"
    },
    {
      name = "MAX_WIDTH"
      type = "plain_text"
      text = tostring(var.max_width)
    },
    {
      name = "OUTPUT_FORMAT"
      type = "plain_text"
      text = var.output_format
    },
  ]

  observability = {
    enabled = true
  }
}

# 4. 업로드 호스트네임 DNS 레코드 (proxied 여야 Worker route가 트래픽을 받음)
#    실제 오리진은 없고 Worker가 가로채므로 더미 IP(RFC5737)를 proxied로 둔다.
resource "cloudflare_dns_record" "upload" {
  zone_id = var.zone_id
  name    = replace(var.upload_route, "/*", "")
  type    = "A"
  content = "192.0.2.1"
  proxied = true
  ttl     = 1
}

# 5. 업로드 Worker 라우트
resource "cloudflare_workers_route" "uploader" {
  zone_id = var.zone_id
  pattern = var.upload_route
  script  = cloudflare_workers_script.uploader.script_name
}
