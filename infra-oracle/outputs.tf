# =============================================================================
# Outputs
# =============================================================================

output "server_public_ip" {
  description = "K3S Server Public IP"
  value       = local.server_public_ip
}

output "server_private_ip" {
  description = "K3S Server Private IP"
  value       = local.server_private_ip
}

output "agent_public_ips" {
  description = "K3S Agent Public IPs"
  value       = local.agent_public_ips
}

output "agent_private_ips" {
  description = "K3S Agent Private IPs"
  value       = local.agent_private_ips
}

output "kubeconfig_path" {
  description = "kubeconfig 파일 경로"
  value       = module.k3s.kubeconfig_path
}

output "kubeconfig_export" {
  description = "KUBECONFIG 환경변수 설정 명령"
  value       = "export KUBECONFIG=${module.k3s.kubeconfig_path}"
}

output "argocd_url" {
  description = "ArgoCD 접속 URL"
  value       = "https://${local.server_public_ip}:30443"
}

output "argocd_password_command" {
  description = "ArgoCD 초기 비밀번호 확인 명령"
  value       = "kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"
}

output "ingress_http_url" {
  description = "Ingress HTTP URL"
  value       = "http://${local.server_public_ip}:30080"
}

output "ingress_https_url" {
  description = "Ingress HTTPS URL"
  value       = "https://${local.server_public_ip}:30443"
}

output "grafana_url" {
  description = "Grafana 접속 URL"
  value       = "http://${local.server_public_ip}:30090"
}

output "grafana_password_command" {
  description = "Grafana admin 비밀번호 확인 명령"
  value       = "kubectl -n monitoring get secret kube-prometheus-stack-grafana -o jsonpath='{.data.admin-password}' | base64 -d"
}

output "security_list_id" {
  description = "K3S Security List OCID"
  value       = oci_core_security_list.k3s.id
}

# =============================================================================
# Load Balancer
# =============================================================================

output "lb_public_ip" {
  description = "Load Balancer Public IP"
  value       = oci_load_balancer_load_balancer.k3s.ip_address_details[0].ip_address
}

output "lb_url" {
  description = "Load Balancer HTTP URL"
  value       = "http://${oci_load_balancer_load_balancer.k3s.ip_address_details[0].ip_address}"
}

# =============================================================================
# Domain
# =============================================================================

output "domain" {
  description = "도메인"
  value       = var.domain
}

output "domain_url" {
  description = "도메인 HTTPS URL"
  value       = "https://${var.domain}"
}

output "domain_wildcard" {
  description = "와일드카드 서브도메인 사용 가능"
  value       = "*.${var.domain}"
}
