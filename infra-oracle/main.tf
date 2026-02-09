# =============================================================================
# Oracle Cloud - K3S 클러스터 구성
# OCI 전용 리소스 + 클라우드 비종속 모듈 호출
# =============================================================================

# Phase 1: K3S 클러스터 설치
module "k3s" {
  source = "../modules/k3s-cluster"

  depends_on = [
    oci_core_security_list.k3s,
    oci_core_subnet.main,
  ]

  server_public_ip  = local.server_public_ip
  server_private_ip = local.server_private_ip
  agent_public_ips  = local.agent_public_ips
  agent_private_ips = local.agent_private_ips

  server_ssh_key_path = var.server_ssh_key_path
  agent_ssh_key_paths = var.agent_ssh_key_paths
  ssh_user             = var.ssh_user
  k3s_version          = var.k3s_version

  kubeconfig_path = abspath("${path.module}/${var.kubeconfig_path}")
  node_token_path = abspath("${path.module}/.node-token")
}

# Phase 2: Helm 앱 배포 (2단계 apply)
module "apps" {
  source = "../modules/k3s-apps"

  depends_on = [module.k3s]

  kubeconfig_path       = module.k3s.kubeconfig_path
  ingress_nginx_version = var.ingress_nginx_version
  cert_manager_version  = var.cert_manager_version
  argocd_version        = var.argocd_version
  letsencrypt_email     = var.letsencrypt_email
  domain                = var.domain

  kube_prometheus_stack_version = var.kube_prometheus_stack_version

  argocd_apps_repo_url = "https://github.com/shdkej/space.git"
}
