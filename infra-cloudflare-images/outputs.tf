output "bucket_name" {
  description = "생성된 R2 버킷 이름"
  value       = cloudflare_r2_bucket.images.name
}

output "public_base_url" {
  description = "이미지 공개 조회 베이스 URL"
  value       = "https://${var.public_domain}"
}

output "upload_endpoint" {
  description = "OpenClaw가 이미지를 POST 할 업로드 엔드포인트"
  value       = "https://${replace(var.upload_route, "/*", "")}"
}
