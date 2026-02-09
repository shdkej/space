# =============================================================================
# Outputs
# =============================================================================

output "cluster_endpoint" {
  description = "DOKS 클러스터 엔드포인트"
  value       = digitalocean_kubernetes_cluster.k8s_cluster.endpoint
}

output "kubeconfig_path" {
  description = "kubeconfig 파일 경로"
  value       = abspath(local_file.kubeconfig.filename)
}

output "loadbalancer_ip" {
  description = "LoadBalancer IP"
  value       = digitalocean_loadbalancer.ingress.ip
}

output "n8n_url" {
  description = "n8n 접속 URL"
  value       = "http://n8n.${var.domain_name}"
}

output "signoz_url" {
  description = "SigNoz 접속 URL"
  value       = "http://signoz.${var.domain_name}"
}

output "domain_name" {
  description = "도메인 이름"
  value       = digitalocean_domain.main.name
}
