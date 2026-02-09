# =============================================================================
# VCN Security List - K3S 클러스터 필수 포트
# =============================================================================

resource "oci_core_security_list" "k3s" {
  compartment_id = data.oci_core_subnet.main.compartment_id
  vcn_id         = var.vcn_id
  display_name   = "k3s-security-list"

  # --- Egress: 모든 트래픽 허용 ---
  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
    description = "Allow all outbound traffic"
  }

  # --- Ingress: SSH ---
  ingress_security_rules {
    protocol    = "6" # TCP
    source      = "0.0.0.0/0"
    description = "SSH"
    tcp_options {
      min = 22
      max = 22
    }
  }

  # --- Ingress: K3S API Server ---
  ingress_security_rules {
    protocol    = "6"
    source      = "0.0.0.0/0"
    description = "K3S API Server"
    tcp_options {
      min = 6443
      max = 6443
    }
  }

  # --- Ingress: Kubelet ---
  ingress_security_rules {
    protocol    = "6"
    source      = data.oci_core_vcn.main.cidr_block
    description = "Kubelet metrics"
    tcp_options {
      min = 10250
      max = 10250
    }
  }

  # --- Ingress: Flannel VXLAN ---
  ingress_security_rules {
    protocol    = "17" # UDP
    source      = data.oci_core_vcn.main.cidr_block
    description = "Flannel VXLAN"
    udp_options {
      min = 8472
      max = 8472
    }
  }

  # --- Ingress: etcd (HA 전환 대비) ---
  ingress_security_rules {
    protocol    = "6"
    source      = data.oci_core_vcn.main.cidr_block
    description = "etcd client + peer (HA 대비)"
    tcp_options {
      min = 2379
      max = 2380
    }
  }

  # --- Ingress: HTTP ---
  ingress_security_rules {
    protocol    = "6"
    source      = "0.0.0.0/0"
    description = "HTTP"
    tcp_options {
      min = 80
      max = 80
    }
  }

  # --- Ingress: HTTPS ---
  ingress_security_rules {
    protocol    = "6"
    source      = "0.0.0.0/0"
    description = "HTTPS"
    tcp_options {
      min = 443
      max = 443
    }
  }

  # --- Ingress: NodePort 범위 (Ingress Nginx 포함) ---
  ingress_security_rules {
    protocol    = "6"
    source      = "0.0.0.0/0"
    description = "NodePort range (30000-32767)"
    tcp_options {
      min = 30000
      max = 32767
    }
  }

  # --- Ingress: ICMP ---
  ingress_security_rules {
    protocol    = "1" # ICMP
    source      = "0.0.0.0/0"
    description = "ICMP (ping)"
  }
}

# Subnet에 Security List 연결 (기존 + K3S Security List)
# 기존 서브넷을 import하여 관리: terraform import oci_core_subnet.main <subnet_ocid>
resource "oci_core_subnet" "main" {
  compartment_id    = data.oci_core_subnet.main.compartment_id
  vcn_id            = var.vcn_id
  cidr_block        = data.oci_core_subnet.main.cidr_block
  display_name      = data.oci_core_subnet.main.display_name
  dns_label         = data.oci_core_subnet.main.dns_label
  route_table_id    = data.oci_core_subnet.main.route_table_id
  dhcp_options_id   = data.oci_core_subnet.main.dhcp_options_id

  security_list_ids = distinct(concat(
    data.oci_core_subnet.main.security_list_ids,
    [oci_core_security_list.k3s.id]
  ))

  lifecycle {
    ignore_changes = [
      defined_tags,
      freeform_tags,
    ]
  }
}
