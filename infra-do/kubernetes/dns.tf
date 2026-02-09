# =============================================================================
# DigitalOcean DNS
# =============================================================================

resource "digitalocean_domain" "main" {
  name = var.domain_name
}

resource "digitalocean_record" "n8n" {
  domain = digitalocean_domain.main.name
  type   = "A"
  name   = "n8n"
  value  = digitalocean_loadbalancer.ingress.ip
  ttl    = 300
}

resource "digitalocean_record" "signoz" {
  domain = digitalocean_domain.main.name
  type   = "A"
  name   = "signoz"
  value  = digitalocean_loadbalancer.ingress.ip
  ttl    = 300
}

resource "digitalocean_record" "root" {
  domain = digitalocean_domain.main.name
  type   = "A"
  name   = "@"
  value  = digitalocean_loadbalancer.ingress.ip
  ttl    = 300
}

resource "digitalocean_record" "www" {
  domain = digitalocean_domain.main.name
  type   = "CNAME"
  name   = "www"
  value  = "@"
  ttl    = 300
}
