# DigitalOcean LoadBalancer for Ingress Controller
resource "digitalocean_loadbalancer" "ingress" {
  name   = "ingress-loadbalancer"
  region = "sgp1"

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

  droplet_tag = "my-cluster-tag"
} 