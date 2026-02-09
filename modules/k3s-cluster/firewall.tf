# =============================================================================
# OS 레벨 방화벽 설정 (iptables) - 모든 노드에 적용
# =============================================================================

resource "null_resource" "firewall_server" {
  connection {
    type        = "ssh"
    host        = var.server_public_ip
    user        = var.ssh_user
    private_key = file(var.server_ssh_key_path)
    timeout     = "2m"
  }

  provisioner "file" {
    source      = "${path.module}/scripts/common-setup.sh"
    destination = "/tmp/common-setup.sh"
  }

  provisioner "remote-exec" {
    inline = [
      "chmod +x /tmp/common-setup.sh",
      "sudo /tmp/common-setup.sh",
    ]
  }
}

resource "null_resource" "firewall_agents" {
  count = length(var.agent_public_ips)

  connection {
    type        = "ssh"
    host        = var.agent_public_ips[count.index]
    user        = var.ssh_user
    private_key = file(var.agent_ssh_key_paths[count.index])
    timeout     = "2m"
  }

  provisioner "file" {
    source      = "${path.module}/scripts/common-setup.sh"
    destination = "/tmp/common-setup.sh"
  }

  provisioner "remote-exec" {
    inline = [
      "chmod +x /tmp/common-setup.sh",
      "sudo /tmp/common-setup.sh",
    ]
  }
}
