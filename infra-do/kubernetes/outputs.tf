
output "k8s_cluster_endpoint" {
    value = digitalocean_kubernetes_cluster.k8s_cluster.endpoint
}

output "loadbalancer_ip" {
    value = digitalocean_loadbalancer.ingress.ip
    description = "LoadBalancer IP 주소"
}

output "n8n_service_url" {
    value = "https://n8n.${digitalocean_domain.main.name}"
    description = "n8n 접속 URL (HTTPS)"
}

output "n8n_credentials" {
    value = {
        username = "admin"
        password = "admin123"
    }
    description = "n8n 로그인 정보"
    sensitive = true
}

output "signoz_frontend_url" {
    value = "https://signoz.${digitalocean_domain.main.name}"
    description = "SigNoz Frontend 접속 URL (HTTPS)"
}

output "signoz_clickhouse_credentials" {
    value = {
        database = "signoz_traces"
        username = "default"
        password = "password"
    }
    description = "SigNoz ClickHouse 데이터베이스 정보"
    sensitive = true
}

output "domain_name" {
    value = digitalocean_domain.main.name
    description = "도메인 이름"
}