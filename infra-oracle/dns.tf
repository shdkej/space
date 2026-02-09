# =============================================================================
# OCI DNS - oracle.shdkej.com A 레코드 관리
# =============================================================================
# DNS 존은 OCI 콘솔에서 이미 생성됨.
# Cloudflare(부모 도메인)에서 NS 위임 설정 완료 상태.
# =============================================================================

data "oci_dns_zones" "main" {
  compartment_id = data.oci_core_subnet.main.compartment_id
  name           = var.domain
}

# Root 도메인 → LB IP
resource "oci_dns_rrset" "root" {
  zone_name_or_id = data.oci_dns_zones.main.zones[0].id
  domain          = var.domain
  rtype           = "A"

  items {
    domain = var.domain
    rtype  = "A"
    rdata  = oci_load_balancer_load_balancer.k3s.ip_address_details[0].ip_address
    ttl    = 300
  }
}

# Wildcard → LB IP (argocd.oracle.shdkej.com 등 서브도메인용)
resource "oci_dns_rrset" "wildcard" {
  zone_name_or_id = data.oci_dns_zones.main.zones[0].id
  domain          = "*.${var.domain}"
  rtype           = "A"

  items {
    domain = "*.${var.domain}"
    rtype  = "A"
    rdata  = oci_load_balancer_load_balancer.k3s.ip_address_details[0].ip_address
    ttl    = 300
  }
}
