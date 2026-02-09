# =============================================================================
# OCI Data Sources - 기존 인스턴스/네트워크 참조
# =============================================================================

# K3S Server 인스턴스
data "oci_core_instance" "server" {
  instance_id = var.server_instance_id
}

# K3S Agent 인스턴스
data "oci_core_instance" "agents" {
  count       = length(var.agent_instance_ids)
  instance_id = var.agent_instance_ids[count.index]
}

# VCN
data "oci_core_vcn" "main" {
  vcn_id = var.vcn_id
}

# Subnet
data "oci_core_subnet" "main" {
  subnet_id = var.subnet_id
}

# Subnet에 연결된 Security List 조회
data "oci_core_security_lists" "existing" {
  compartment_id = data.oci_core_subnet.main.compartment_id
  vcn_id         = var.vcn_id

  filter {
    name   = "id"
    values = data.oci_core_subnet.main.security_list_ids
  }
}

# =============================================================================
# 로컬 변수 - IP 주소 매핑
# =============================================================================
locals {
  server_public_ip  = data.oci_core_instance.server.public_ip
  server_private_ip = data.oci_core_instance.server.private_ip

  agent_public_ips  = [for a in data.oci_core_instance.agents : a.public_ip]
  agent_private_ips = [for a in data.oci_core_instance.agents : a.private_ip]

  all_public_ips  = concat([local.server_public_ip], local.agent_public_ips)
  all_private_ips = concat([local.server_private_ip], local.agent_private_ips)
}
