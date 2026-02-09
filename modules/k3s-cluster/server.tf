# =============================================================================
# K3S Server 설치
# =============================================================================

resource "null_resource" "k3s_server" {
  depends_on = [null_resource.firewall_server]

  connection {
    type        = "ssh"
    host        = var.server_public_ip
    user        = var.ssh_user
    private_key = file(var.server_ssh_key_path)
    timeout     = "5m"
  }

  provisioner "file" {
    source      = "${path.module}/scripts/install-server.sh"
    destination = "/tmp/install-server.sh"
  }

  provisioner "remote-exec" {
    inline = [
      "chmod +x /tmp/install-server.sh",
      "sudo K3S_VERSION='${var.k3s_version}' PUBLIC_IP='${var.server_public_ip}' PRIVATE_IP='${var.server_private_ip}' /tmp/install-server.sh",
    ]
  }
}

# K3S Server에서 토큰 추출
resource "null_resource" "k3s_token" {
  depends_on = [null_resource.k3s_server]

  triggers = {
    server_id = null_resource.k3s_server.id
  }

  provisioner "local-exec" {
    command = <<-EOT
      ssh-keyscan -H ${var.server_public_ip} >> ~/.ssh/known_hosts 2>/dev/null || true
      ssh -i ${var.server_ssh_key_path} \
        ${var.ssh_user}@${var.server_public_ip} \
        'sudo cat /var/lib/rancher/k3s/server/node-token' > ${var.node_token_path}
    EOT
  }
}

# K3S Server에서 kubeconfig 추출
resource "null_resource" "kubeconfig" {
  depends_on = [null_resource.k3s_server]

  triggers = {
    server_id = null_resource.k3s_server.id
  }

  provisioner "local-exec" {
    command = <<-EOT
      ssh-keyscan -H ${var.server_public_ip} >> ~/.ssh/known_hosts 2>/dev/null || true
      ssh -i ${var.server_ssh_key_path} \
        ${var.ssh_user}@${var.server_public_ip} \
        'sudo cat /etc/rancher/k3s/k3s.yaml' | \
        sed "s/127.0.0.1/${var.server_public_ip}/g" > ${var.kubeconfig_path}
      chmod 600 ${var.kubeconfig_path}
    EOT
  }
}

# 토큰 값을 data source로 읽기
data "local_file" "k3s_token" {
  depends_on = [null_resource.k3s_token]
  filename   = var.node_token_path
}
