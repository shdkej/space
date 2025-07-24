# SigNoz를 위한 Namespace 생성
resource "kubernetes_namespace" "signoz" {
  metadata {
    name = "signoz"
  }
}

# SigNoz를 위한 PersistentVolumeClaim (데이터 저장용)
resource "kubernetes_persistent_volume_claim" "signoz_data" {
  metadata {
    name      = "signoz-data"
    namespace = kubernetes_namespace.signoz.metadata[0].name
  }
  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "20Gi"
      }
    }
  }
}

# SigNoz Query Service
resource "kubernetes_deployment" "signoz_query_service" {
  metadata {
    name      = "signoz-query-service"
    namespace = kubernetes_namespace.signoz.metadata[0].name
    labels = {
      app = "signoz-query-service"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "signoz-query-service"
      }
    }

    template {
      metadata {
        labels = {
          app = "signoz-query-service"
        }
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

# SigNoz ClickHouse
resource "kubernetes_deployment" "signoz_clickhouse" {
  metadata {
    name      = "signoz-clickhouse"
    namespace = kubernetes_namespace.signoz.metadata[0].name
    labels = {
      app = "signoz-clickhouse"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "signoz-clickhouse"
      }
    }

    template {
      metadata {
        labels = {
          app = "signoz-clickhouse"
        }
      }

      spec {
        container {
          image = "clickhouse/clickhouse-server:22.3.13"
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
            value = "password"
          }

          volume_mount {
            name       = "signoz-data"
            mount_path = "/var/lib/clickhouse"
          }

          resources {
            limits = {
              cpu    = "1000m"
              memory = "2Gi"
            }
            requests = {
              cpu    = "500m"
              memory = "1Gi"
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

# SigNoz Frontend
resource "kubernetes_deployment" "signoz_frontend" {
  metadata {
    name      = "signoz-frontend"
    namespace = kubernetes_namespace.signoz.metadata[0].name
    labels = {
      app = "signoz-frontend"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "signoz-frontend"
      }
    }

    template {
      metadata {
        labels = {
          app = "signoz-frontend"
        }
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

# SigNoz Query Service
resource "kubernetes_service" "signoz_query_service" {
  metadata {
    name      = "signoz-query-service"
    namespace = kubernetes_namespace.signoz.metadata[0].name
  }
  spec {
    selector = {
      app = "signoz-query-service"
    }
    port {
      port        = 8080
      target_port = 8080
    }
    type = "ClusterIP"
  }
}

# SigNoz ClickHouse Service
resource "kubernetes_service" "signoz_clickhouse" {
  metadata {
    name      = "signoz-clickhouse"
    namespace = kubernetes_namespace.signoz.metadata[0].name
  }
  spec {
    selector = {
      app = "signoz-clickhouse"
    }
    port {
      port        = 9000
      target_port = 9000
    }
    type = "ClusterIP"
  }
}

# SigNoz Frontend Service
resource "kubernetes_service" "signoz_frontend" {
  metadata {
    name      = "signoz-frontend"
    namespace = kubernetes_namespace.signoz.metadata[0].name
  }
  spec {
    selector = {
      app = "signoz-frontend"
    }
    port {
      port        = 3000
      target_port = 3000
    }
    type = "ClusterIP"
  }
}

# SigNoz는 ClusterIP만 사용 (Ingress를 통해 접근) 