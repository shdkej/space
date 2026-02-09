# =============================================================================
# K3S Agent 설치
# =============================================================================

resource "null_resource" "k3s_agents" {
  count      = length(var.agent_public_ips)
  depends_on = [null_resource.k3s_token, null_resource.firewall_agents]

  connection {
    type        = "ssh"
    host        = var.agent_public_ips[count.index]
    user        = var.ssh_user
    private_key = file(var.agent_ssh_key_paths[count.index])
    timeout     = "5m"
  }

  provisioner "file" {
    source      = "${path.module}/scripts/install-agent.sh"
    destination = "/tmp/install-agent.sh"
  }

  provisioner "remote-exec" {
    inline = [
      "chmod +x /tmp/install-agent.sh",
      "sudo K3S_VERSION='${var.k3s_version}' SERVER_IP='${var.server_private_ip}' NODE_TOKEN='${trimspace(data.local_file.k3s_token.content)}' /tmp/install-agent.sh",
    ]
  }
}
