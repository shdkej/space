# =============================================================================
# DigitalOcean Managed Kubernetes (DOKS)
# =============================================================================

resource "digitalocean_kubernetes_cluster" "k8s_cluster" {
  name    = var.cluster_name
  region  = var.region
  version = var.cluster_version

  node_pool {
    name       = "default-node-pool"
    size       = var.node_size
    node_count = var.min_nodes
    auto_scale = true
    min_nodes  = var.min_nodes
    max_nodes  = var.max_nodes
  }

  tags = ["${var.cluster_name}-tag"]
}

# kubeconfig 로컬 저장
resource "local_file" "kubeconfig" {
  content         = digitalocean_kubernetes_cluster.k8s_cluster.kube_config[0].raw_config
  filename        = "${path.module}/.kubeconfig"
  file_permission = "0600"
}
