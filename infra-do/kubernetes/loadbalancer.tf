# =============================================================================
# DigitalOcean LoadBalancer → Ingress Nginx NodePort
# =============================================================================

resource "digitalocean_loadbalancer" "ingress" {
  name   = "ingress-loadbalancer"
  region = var.region

  forwarding_rule {
    entry_port     = 80
    entry_protocol = "http"
    target_port     = 30080
    target_protocol = "http"
  }

  healthcheck {
    port     = 80
    protocol = "http"
    path     = "/"
  }

  droplet_tag = "${var.cluster_name}-tag"
}
