# =============================================================================
# K8S Apps Module - Helm 차트 배포 변수
# 클라우드 비종속: K3S, DOKS, EKS 등 어떤 K8s에서든 사용 가능
# =============================================================================

variable "kubeconfig_path" {
  description = "kubeconfig 파일 절대 경로"
  type        = string
}

# 컴포넌트 활성화 플래그
variable "enable_ingress_nginx" {
  description = "Ingress Nginx 설치 여부"
  type        = bool
  default     = true
}

variable "enable_cert_manager" {
  description = "cert-manager 설치 여부"
  type        = bool
  default     = true
}

variable "enable_argocd" {
  description = "ArgoCD 설치 여부"
  type        = bool
  default     = true
}

variable "enable_monitoring" {
  description = "kube-prometheus-stack 설치 여부"
  type        = bool
  default     = true
}

# Helm Chart 버전
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
  default     = "81.5.0"
}

# =============================================================================
# ArgoCD App of Apps
# =============================================================================
variable "argocd_apps_repo_url" {
  description = "ArgoCD App of Apps - Git 레포 URL (빈 값이면 root app 미생성)"
  type        = string
  default     = ""
}

variable "argocd_apps_path" {
  description = "ArgoCD App of Apps - 앱 매니페스트 경로"
  type        = string
  default     = "argocd/apps"
}

variable "argocd_apps_target_revision" {
  description = "ArgoCD App of Apps - Git 브랜치/태그"
  type        = string
  default     = "HEAD"
}

# 도메인 (설정 시 Ingress 리소스 자동 생성)
variable "domain" {
  description = "도메인 (빈 값이면 Ingress 미생성)"
  type        = string
  default     = ""
}

# Let's Encrypt
variable "letsencrypt_email" {
  description = "Let's Encrypt 인증서 발급용 이메일"
  type        = string
  default     = ""
}
