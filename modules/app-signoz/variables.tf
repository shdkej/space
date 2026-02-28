# =============================================================================
# SigNoz App Module - 모니터링 플랫폼
# =============================================================================

variable "namespace" {
  description = "SigNoz 배포 네임스페이스"
  type        = string
  default     = "signoz"
}

variable "storage_size" {
  description = "ClickHouse 데이터 PVC 크기"
  type        = string
  default     = "20Gi"
}

variable "clickhouse_version" {
  description = "ClickHouse 이미지 버전"
  type        = string
  default     = "22.3.13"
}

variable "clickhouse_password" {
  description = "ClickHouse 비밀번호"
  type        = string
  sensitive   = true
  default     = "password"
}

# Ingress
variable "ingress_enabled" {
  description = "Ingress 리소스 생성 여부"
  type        = bool
  default     = false
}

variable "ingress_host" {
  description = "Ingress 호스트명 (예: signoz.example.com)"
  type        = string
  default     = ""
}

variable "ingress_tls_enabled" {
  description = "Ingress TLS 활성화 (cert-manager 필요)"
  type        = bool
  default     = false
}

# 리소스 (ClickHouse)
variable "clickhouse_requests_cpu" {
  type    = string
  default = "500m"
}

variable "clickhouse_requests_memory" {
  type    = string
  default = "1Gi"
}

variable "clickhouse_limits_cpu" {
  type    = string
  default = "1000m"
}

variable "clickhouse_limits_memory" {
  type    = string
  default = "2Gi"
}
