# =============================================================================
# OCI 인증
# =============================================================================
variable "tenancy_ocid" {
  description = "OCI Tenancy OCID"
  type        = string
}

variable "user_ocid" {
  description = "OCI User OCID"
  type        = string
}

variable "oci_fingerprint" {
  description = "OCI API Key Fingerprint"
  type        = string
}

variable "oci_private_key_path" {
  description = "OCI API Private Key 경로"
  type        = string
  default     = "~/.oci/oci_api_key.pem"
}

variable "oci_region" {
  description = "OCI Region"
  type        = string
  default     = "ap-chuncheon-1"
}

# =============================================================================
# 인스턴스 OCID
# =============================================================================
variable "server_instance_id" {
  description = "K3S Server 인스턴스 OCID"
  type        = string
}

variable "agent_instance_ids" {
  description = "K3S Agent 인스턴스 OCID 목록"
  type        = list(string)
}

# =============================================================================
# 네트워크
# =============================================================================
variable "vcn_id" {
  description = "VCN OCID"
  type        = string
}

variable "subnet_id" {
  description = "Subnet OCID"
  type        = string
}

# =============================================================================
# SSH
# =============================================================================
variable "server_ssh_key_path" {
  description = "Server SSH Private Key 경로"
  type        = string
}

variable "agent_ssh_key_paths" {
  description = "Agent SSH Private Key 경로 목록 (agent_instance_ids와 같은 순서)"
  type        = list(string)
}

variable "ssh_user" {
  description = "SSH 접속 사용자"
  type        = string
  default     = "ubuntu"
}

# =============================================================================
# K3S
# =============================================================================
variable "k3s_version" {
  description = "K3S 설치 버전 (빈 값이면 최신)"
  type        = string
  default     = ""
}

# =============================================================================
# Helm Chart 버전
# =============================================================================
variable "ingress_nginx_version" {
  description = "Ingress Nginx Helm Chart 버전"
  type        = string
  default     = "4.14.3"
}

variable "cert_manager_version" {
  description = "cert-manager Helm Chart 버전"
  type        = string
  default     = "1.19.3"
}

variable "argocd_version" {
  description = "ArgoCD Helm Chart 버전"
  type        = string
  default     = "9.4.1"
}

variable "kube_prometheus_stack_version" {
  description = "kube-prometheus-stack Helm Chart 버전"
  type        = string
  default     = "82.1.1"
}

variable "loki_version" {
  description = "Loki Helm Chart 버전"
  type        = string
  default     = "6.24.0"
}

variable "promtail_version" {
  description = "Promtail Helm Chart 버전"
  type        = string
  default     = "6.16.6"
}

variable "blackbox_exporter_version" {
  description = "Blackbox Exporter Helm Chart 버전"
  type        = string
  default     = "9.1.0"
}

# =============================================================================
# Let's Encrypt
# =============================================================================
variable "letsencrypt_email" {
  description = "Let's Encrypt 인증서 발급용 이메일"
  type        = string
  default     = ""
}

# =============================================================================
# 도메인
# =============================================================================
variable "domain" {
  description = "OCI DNS에 등록된 도메인"
  type        = string
}

# =============================================================================
# Kubeconfig
# =============================================================================
variable "kubeconfig_path" {
  description = "kubeconfig 저장 경로"
  type        = string
  default     = ".kubeconfig"
}
