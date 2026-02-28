# =============================================================================
# n8n App Module - 워크플로우 자동화 도구
# =============================================================================

variable "namespace" {
  description = "n8n 배포 네임스페이스"
  type        = string
  default     = "n8n"
}

variable "image_version" {
  description = "n8n 컨테이너 이미지 버전"
  type        = string
  default     = "1.70.2"
}

variable "storage_size" {
  description = "n8n 데이터 PVC 크기"
  type        = string
  default     = "10Gi"
}

variable "basic_auth_user" {
  description = "n8n Basic Auth 사용자"
  type        = string
  default     = "admin"
}

variable "basic_auth_password" {
  description = "n8n Basic Auth 비밀번호"
  type        = string
  sensitive   = true
  default     = ""
}

variable "timezone" {
  description = "n8n 타임존"
  type        = string
  default     = "Asia/Seoul"
}

variable "webhook_url" {
  description = "n8n Webhook URL (외부 접근 URL)"
  type        = string
  default     = ""
}

# Ingress
variable "ingress_enabled" {
  description = "Ingress 리소스 생성 여부"
  type        = bool
  default     = false
}

variable "ingress_host" {
  description = "Ingress 호스트명 (예: n8n.example.com)"
  type        = string
  default     = ""
}

variable "ingress_tls_enabled" {
  description = "Ingress TLS 활성화 (cert-manager 필요)"
  type        = bool
  default     = false
}

# 리소스
variable "resources_requests_cpu" {
  type    = string
  default = "200m"
}

variable "resources_requests_memory" {
  type    = string
  default = "256Mi"
}

variable "resources_limits_cpu" {
  type    = string
  default = "500m"
}

variable "resources_limits_memory" {
  type    = string
  default = "512Mi"
}
