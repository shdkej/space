# =============================================================================
# DigitalOcean Kubernetes 변수
# =============================================================================

variable "do_token" {
  description = "DigitalOcean API Token"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "DigitalOcean 리전"
  type        = string
  default     = "sgp1"
}

variable "domain_name" {
  description = "도메인명 (예: example.com)"
  type        = string
}

variable "cluster_name" {
  description = "DOKS 클러스터 이름"
  type        = string
  default     = "my-k8s-cluster"
}

variable "cluster_version" {
  description = "DOKS Kubernetes 버전"
  type        = string
  default     = "1.33.1-do.1"
}

variable "node_size" {
  description = "노드 사이즈"
  type        = string
  default     = "s-1vcpu-2gb"
}

variable "min_nodes" {
  description = "최소 노드 수"
  type        = number
  default     = 1
}

variable "max_nodes" {
  description = "최대 노드 수"
  type        = number
  default     = 5
}

# n8n
variable "n8n_basic_auth_password" {
  description = "n8n Basic Auth 비밀번호"
  type        = string
  sensitive   = true
  default     = ""
}

# SigNoz
variable "signoz_clickhouse_password" {
  description = "SigNoz ClickHouse 비밀번호"
  type        = string
  sensitive   = true
  default     = "password"
}
