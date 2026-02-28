# =============================================================================
# K3S Cluster Module - 클라우드 비종속 변수
# 어떤 클라우드든 IP + SSH 키만 넘기면 K3S 클러스터가 구성됩니다.
# =============================================================================

variable "server_public_ip" {
  description = "K3S Server Public IP"
  type        = string
}

variable "server_private_ip" {
  description = "K3S Server Private IP"
  type        = string
}

variable "agent_public_ips" {
  description = "K3S Agent Public IP 목록"
  type        = list(string)
}

variable "agent_private_ips" {
  description = "K3S Agent Private IP 목록"
  type        = list(string)
}

variable "server_ssh_key_path" {
  description = "Server SSH Private Key 경로"
  type        = string
}

variable "agent_ssh_key_paths" {
  description = "Agent SSH Private Key 경로 목록 (agent_public_ips와 같은 순서)"
  type        = list(string)
}

variable "ssh_user" {
  description = "SSH 접속 사용자"
  type        = string
  default     = "ubuntu"
}

variable "k3s_version" {
  description = "K3S 설치 버전 (빈 값이면 최신)"
  type        = string
  default     = ""
}

variable "kubeconfig_path" {
  description = "kubeconfig 저장 절대 경로"
  type        = string
}

variable "node_token_path" {
  description = "node-token 저장 절대 경로"
  type        = string
}
