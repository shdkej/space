output "namespace" {
  value = kubernetes_namespace.signoz.metadata[0].name
}

output "frontend_service_name" {
  value = kubernetes_service.frontend.metadata[0].name
}

output "frontend_port" {
  value = 3000
}

output "query_service_name" {
  value = kubernetes_service.query_service.metadata[0].name
}
