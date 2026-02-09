resource "kubernetes_namespace" "signoz" {
  metadata {
    name = var.namespace
  }
}

resource "helm_release" "signoz" {
  name       = "signoz"
  repository = "https://charts.signoz.io"
  chart      = "signoz"
  version    = var.signoz_version
  namespace  = kubernetes_namespace.signoz.metadata[0].name

  values = [
    yamlencode({
      frontend = {
        service = {
          type = var.frontend_service_type
          nodePort = 30080
        }
      }
      
      clickhouse = {
        persistence = {
          enabled = var.enable_persistence
          size = var.clickhouse_storage_size
          storageClass = var.storage_class
        }
      }
      
      queryService = {
        persistence = {
          enabled = var.enable_persistence
          storageClass = var.storage_class
        }
      }
      
      alertmanager = {
        persistence = {
          enabled = var.enable_persistence
          storageClass = var.storage_class
        }
      }
    })
  ]

  depends_on = [kubernetes_namespace.signoz]
}