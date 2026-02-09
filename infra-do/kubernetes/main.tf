# =============================================================================
# DigitalOcean K8s - 모듈 기반 앱 배포
# =============================================================================

# 기본 K8s 앱 (Ingress Nginx + cert-manager, ArgoCD 비활성화)
module "k8s_apps" {
  source = "../../modules/k3s-apps"

  depends_on = [digitalocean_kubernetes_cluster.k8s_cluster]

  kubeconfig_path = abspath(local_file.kubeconfig.filename)

  enable_ingress_nginx = true
  enable_cert_manager  = true
  enable_argocd        = false
}

# n8n - 워크플로우 자동화
module "n8n" {
  source = "../../modules/app-n8n"

  depends_on = [module.k8s_apps]

  image_version       = "1.70.2"
  basic_auth_password = var.n8n_basic_auth_password
  webhook_url         = "http://n8n.${var.domain_name}/"

  ingress_enabled = true
  ingress_host    = "n8n.${var.domain_name}"
}

# SigNoz - 모니터링
module "signoz" {
  source = "../../modules/app-signoz"

  depends_on = [module.k8s_apps]

  clickhouse_password = var.signoz_clickhouse_password

  ingress_enabled = true
  ingress_host    = "signoz.${var.domain_name}"
}
