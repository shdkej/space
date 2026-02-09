# =============================================================================
# OCI Application Load Balancer - K3S 클러스터 진입점
# =============================================================================
# TCP passthrough로 동작하여 LB에서 인증서 관리 불필요.
# TLS는 Ingress Nginx + cert-manager가 처리.
#
# 아키텍처:
#   Internet → LB:80 (TCP) → ROUND_ROBIN → 3 Nodes:30080 (NodePort)
# =============================================================================

resource "oci_load_balancer_load_balancer" "k3s" {
  compartment_id = data.oci_core_subnet.main.compartment_id
  display_name   = "k3s-lb"
  shape          = "flexible"
  subnet_ids     = [var.subnet_id]
  is_private     = false

  shape_details {
    minimum_bandwidth_in_mbps = 10
    maximum_bandwidth_in_mbps = 10
  }
}

resource "oci_load_balancer_backend_set" "k3s_http" {
  load_balancer_id = oci_load_balancer_load_balancer.k3s.id
  name             = "k3s-http-backend"
  policy           = "ROUND_ROBIN"

  health_checker {
    protocol = "TCP"
    port     = 30080
  }
}

resource "oci_load_balancer_backend" "k3s_nodes" {
  count            = length(local.all_private_ips)
  load_balancer_id = oci_load_balancer_load_balancer.k3s.id
  backendset_name  = oci_load_balancer_backend_set.k3s_http.name
  ip_address       = local.all_private_ips[count.index]
  port             = 30080
}

resource "oci_load_balancer_listener" "k3s_http" {
  load_balancer_id         = oci_load_balancer_load_balancer.k3s.id
  default_backend_set_name = oci_load_balancer_backend_set.k3s_http.name
  name                     = "k3s-http-listener"
  port                     = 80
  protocol                 = "TCP"
}

# =============================================================================
# HTTPS (443) → NodePort 30443 (TCP passthrough, TLS는 Ingress Nginx 처리)
# =============================================================================

resource "oci_load_balancer_backend_set" "k3s_https" {
  load_balancer_id = oci_load_balancer_load_balancer.k3s.id
  name             = "k3s-https-backend"
  policy           = "ROUND_ROBIN"

  health_checker {
    protocol = "TCP"
    port     = 30443
  }
}

resource "oci_load_balancer_backend" "k3s_nodes_https" {
  count            = length(local.all_private_ips)
  load_balancer_id = oci_load_balancer_load_balancer.k3s.id
  backendset_name  = oci_load_balancer_backend_set.k3s_https.name
  ip_address       = local.all_private_ips[count.index]
  port             = 30443
}

resource "oci_load_balancer_listener" "k3s_https" {
  load_balancer_id         = oci_load_balancer_load_balancer.k3s.id
  default_backend_set_name = oci_load_balancer_backend_set.k3s_https.name
  name                     = "k3s-https-listener"
  port                     = 443
  protocol                 = "TCP"
}
