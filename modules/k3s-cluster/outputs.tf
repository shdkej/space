# =============================================================================
# K3S Cluster Module Outputs
# =============================================================================

output "kubeconfig_path" {
  description = "kubeconfig 파일 경로"
  value       = var.kubeconfig_path
}

output "node_token_path" {
  description = "node-token 파일 경로"
  value       = var.node_token_path
}

output "server_public_ip" {
  description = "K3S Server Public IP"
  value       = var.server_public_ip
}

output "server_private_ip" {
  description = "K3S Server Private IP"
  value       = var.server_private_ip
}

output "agent_public_ips" {
  description = "K3S Agent Public IPs"
  value       = var.agent_public_ips
}
