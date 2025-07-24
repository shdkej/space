resource "digitalocean_kubernetes_cluster" "k8s_cluster" {
    name = "my-k8s-cluster"
    region = "sgp1"
    version = "1.33.1-do.1"

    node_pool {
        name = "default-node-pool"
        size = "s-1vcpu-2gb"
        node_count = 1
        auto_scale = true
        min_nodes = 1
        max_nodes = 5
    }

    tags = ["my-cluster-tag"]
} 