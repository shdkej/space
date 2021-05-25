terraform {
  required_providers {
    digitalocean = {
      source = "digitalocean/digitalocean"
      version = "~> 1.22"
    }
  }
}

resource "digitalocean_vpc" "default" {
  name = "kubernetes-vpc"
  region = "sgp1"
}

resource "digitalocean_droplet" "master" {
  image = "ubuntu-18-04-x64"
  name = "kmaster"
  size = "s-1vcpu-2gb"
  region = "sgp1"
  ssh_keys = [var.fingerprint]
  private_networking = true
  monitoring = false
  vpc_uuid = digitalocean_vpc.default.id
}

resource "null_resource" "k3s-master-provisioner" {
  depends_on = [digitalocean_droplet.node, local_file.private_ip]
  triggers = {
    public_ip = digitalocean_droplet.master.ipv4_address
    timestamp = digitalocean_droplet.master.ipv4_address
  }

  connection {
    host = digitalocean_droplet.master.ipv4_address
    type = "ssh"
    user = "root"
    private_key = file("~/.ssh/do")
  }

  provisioner "file" {
    source = "~/.ssh/do"
    destination = "/root/.ssh/do"
  }

  provisioner "file" {
    source = "k3s-setup/nodes"
    destination = "/root/nodes"
  }

  provisioner "remote-exec" {
    inline = [
      "sudo apt-get update && sudo apt install -y git ansible",
      "rm -rf kubernetes-test",
      "git clone https://github.com/shdkej/kubernetes-test",
      "chmod 400 /root/.ssh/do",
      "ansible-playbook -c local -i 127.0.0.1, kubernetes-test/k3s-setup/master-playbook.yml",
      "ANSIBLE_HOST_KEY_CHECKING=False ansible-playbook -i nodes -u root --private-key ~/.ssh/do -e ansible_python_interpreter=/usr/bin/python3 kubernetes-test/k3s-setup/node-playbook.yml",
    ]
  }
}

output "node-ip" {
  value = digitalocean_droplet.master.ipv4_address
}
