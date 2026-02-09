output "namespace" {
  value = kubernetes_namespace.n8n.metadata[0].name
}

output "service_name" {
  value = kubernetes_service.n8n.metadata[0].name
}

output "service_port" {
  value = 80
}
