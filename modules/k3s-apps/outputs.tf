# =============================================================================
# K8S Apps Module Outputs
# =============================================================================

output "ingress_nginx_status" {
  description = "Ingress Nginx 배포 상태"
  value       = var.enable_ingress_nginx ? helm_release.ingress_nginx[0].status : null
}

output "cert_manager_status" {
  description = "cert-manager 배포 상태"
  value       = var.enable_cert_manager ? helm_release.cert_manager[0].status : null
}

output "argocd_status" {
  description = "ArgoCD 배포 상태"
  value       = var.enable_argocd ? helm_release.argocd[0].status : null
}

output "monitoring_status" {
  description = "kube-prometheus-stack 배포 상태"
  value       = var.enable_monitoring ? helm_release.kube_prometheus_stack[0].status : null
}
