resource "digitalocean_droplet" "node" {
  image = "ubuntu-18-04-x64"
  name = "node-${count.index + 1}"
  size = "s-1vcpu-2gb"
  region = "sgp1"
  count = 2
  ssh_keys = [var.fingerprint]
  private_networking = true
  monitoring = false
  vpc_uuid = digitalocean_vpc.default.id
}

resource "local_file" "private_ip" {
  content = join("\n", digitalocean_droplet.node.*.ipv4_address_private)
  filename = "k3s-setup/nodes"
}
