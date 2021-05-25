resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  type = "A"
  name = "www"
  value = var.value
  proxied = true
}

terraform {
  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
      version = "~> 2.0"
    }
  }
}
