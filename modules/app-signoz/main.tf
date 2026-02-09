# =============================================================================
# SigNoz - 모니터링 플랫폼 배포
# Query Service + ClickHouse + Frontend
# =============================================================================

resource "kubernetes_namespace" "signoz" {
  metadata {
    name = var.namespace
  }
}

resource "kubernetes_persistent_volume_claim" "signoz_data" {
  metadata {
    name      = "signoz-data"
    namespace = kubernetes_namespace.signoz.metadata[0].name
  }
  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = var.storage_size
      }
    }
  }
}

# --- ClickHouse ---
resource "kubernetes_deployment" "clickhouse" {
  metadata {
    name      = "signoz-clickhouse"
    namespace = kubernetes_namespace.signoz.metadata[0].name
    labels    = { app = "signoz-clickhouse" }
  }

  spec {
    replicas = 1
    selector {
      match_labels = { app = "signoz-clickhouse" }
    }

    template {
      metadata {
        labels = { app = "signoz-clickhouse" }
      }

      spec {
        container {
          image = "clickhouse/clickhouse-server:${var.clickhouse_version}"
          name  = "clickhouse"

          port {
            container_port = 9000
          }
          port {
            container_port = 8123
          }

          env {
            name  = "CLICKHOUSE_DB"
            value = "signoz_traces"
          }
          env {
            name  = "CLICKHOUSE_USER"
            value = "default"
          }
          env {
            name  = "CLICKHOUSE_PASSWORD"
            value = var.clickhouse_password
          }

          volume_mount {
            name       = "signoz-data"
            mount_path = "/var/lib/clickhouse"
          }

          resources {
            limits = {
              cpu    = var.clickhouse_limits_cpu
              memory = var.clickhouse_limits_memory
            }
            requests = {
              cpu    = var.clickhouse_requests_cpu
              memory = var.clickhouse_requests_memory
            }
          }
        }

        volume {
          name = "signoz-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.signoz_data.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "clickhouse" {
  metadata {
    name      = "signoz-clickhouse"
    namespace = kubernetes_namespace.signoz.metadata[0].name
  }
  spec {
    selector = { app = "signoz-clickhouse" }
    port {
      port        = 9000
      target_port = 9000
    }
    type = "ClusterIP"
  }
}

# --- Query Service ---
resource "kubernetes_deployment" "query_service" {
  metadata {
    name      = "signoz-query-service"
    namespace = kubernetes_namespace.signoz.metadata[0].name
    labels    = { app = "signoz-query-service" }
  }

  spec {
    replicas = 1
    selector {
      match_labels = { app = "signoz-query-service" }
    }

    template {
      metadata {
        labels = { app = "signoz-query-service" }
      }

      spec {
        container {
          image = "signoz/query-service:latest"
          name  = "query-service"

          port {
            container_port = 8080
          }

          env {
            name  = "SIGNOZ_QUERY_SERVICE_PORT"
            value = "8080"
          }
          env {
            name  = "SIGNOZ_QUERY_SERVICE_HOST"
            value = "0.0.0.0"
          }
          env {
            name  = "SIGNOZ_QUERY_SERVICE_STORAGE"
            value = "clickhouse"
          }
          env {
            name  = "SIGNOZ_QUERY_SERVICE_CLICKHOUSE_URL"
            value = "http://signoz-clickhouse:9000"
          }

          resources {
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
            requests = {
              cpu    = "200m"
              memory = "256Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "query_service" {
  metadata {
    name      = "signoz-query-service"
    namespace = kubernetes_namespace.signoz.metadata[0].name
  }
  spec {
    selector = { app = "signoz-query-service" }
    port {
      port        = 8080
      target_port = 8080
    }
    type = "ClusterIP"
  }
}

# --- Frontend ---
resource "kubernetes_deployment" "frontend" {
  metadata {
    name      = "signoz-frontend"
    namespace = kubernetes_namespace.signoz.metadata[0].name
    labels    = { app = "signoz-frontend" }
  }

  spec {
    replicas = 1
    selector {
      match_labels = { app = "signoz-frontend" }
    }

    template {
      metadata {
        labels = { app = "signoz-frontend" }
      }

      spec {
        container {
          image = "signoz/frontend:latest"
          name  = "frontend"

          port {
            container_port = 3000
          }

          env {
            name  = "REACT_APP_API_BASE_URL"
            value = "http://signoz-query-service:8080"
          }

          resources {
            limits = {
              cpu    = "300m"
              memory = "256Mi"
            }
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "frontend" {
  metadata {
    name      = "signoz-frontend"
    namespace = kubernetes_namespace.signoz.metadata[0].name
  }
  spec {
    selector = { app = "signoz-frontend" }
    port {
      port        = 3000
      target_port = 3000
    }
    type = "ClusterIP"
  }
}

# Ingress (선택적)
resource "kubernetes_ingress_v1" "signoz" {
  count = var.ingress_enabled ? 1 : 0

  metadata {
    name      = "signoz-ingress"
    namespace = kubernetes_namespace.signoz.metadata[0].name
    annotations = merge(
      {
        "kubernetes.io/ingress.class"                    = "nginx"
        "nginx.ingress.kubernetes.io/ssl-redirect"       = tostring(var.ingress_tls_enabled)
      },
      var.ingress_tls_enabled ? { "cert-manager.io/cluster-issuer" = "letsencrypt-prod" } : {}
    )
  }

  spec {
    rule {
      host = var.ingress_host
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "signoz-frontend"
              port {
                number = 3000
              }
            }
          }
        }
      }
    }

    dynamic "tls" {
      for_each = var.ingress_tls_enabled ? [1] : []
      content {
        hosts       = [var.ingress_host]
        secret_name = "signoz-tls"
      }
    }
  }
}
