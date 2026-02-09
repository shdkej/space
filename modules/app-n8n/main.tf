# =============================================================================
# n8n - 워크플로우 자동화 도구 배포
# =============================================================================

resource "kubernetes_namespace" "n8n" {
  metadata {
    name = var.namespace
  }
}

resource "kubernetes_persistent_volume_claim" "n8n_data" {
  metadata {
    name      = "n8n-data"
    namespace = kubernetes_namespace.n8n.metadata[0].name
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

resource "kubernetes_deployment" "n8n" {
  metadata {
    name      = "n8n"
    namespace = kubernetes_namespace.n8n.metadata[0].name
    labels    = { app = "n8n" }
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "n8n" }
    }

    template {
      metadata {
        labels = { app = "n8n" }
      }

      spec {
        security_context {
          run_as_user  = 1000
          run_as_group = 1000
          fs_group     = 1000
        }

        init_container {
          name    = "init-n8n-permissions"
          image   = "busybox:1.35"
          command = ["sh", "-c", "chown -R 1000:1000 /home/node/.n8n"]

          volume_mount {
            name       = "n8n-data"
            mount_path = "/home/node/.n8n"
          }

          security_context {
            run_as_user = 0
          }
        }

        container {
          image = "n8nio/n8n:${var.image_version}"
          name  = "n8n"

          security_context {
            run_as_user  = 1000
            run_as_group = 1000
          }

          port {
            container_port = 5678
          }

          env {
            name  = "N8N_HOST"
            value = "0.0.0.0"
          }

          env {
            name  = "N8N_PORT"
            value = "5678"
          }

          env {
            name  = "N8N_PROTOCOL"
            value = "http"
          }

          env {
            name  = "WEBHOOK_URL"
            value = var.webhook_url != "" ? var.webhook_url : "http://localhost:5678/"
          }

          env {
            name  = "GENERIC_TIMEZONE"
            value = var.timezone
          }

          env {
            name  = "N8N_USER_FOLDER"
            value = "/home/node/.n8n"
          }

          env {
            name  = "N8N_LOG_LEVEL"
            value = "info"
          }

          env {
            name  = "N8N_DISABLE_UI"
            value = "false"
          }

          volume_mount {
            name       = "n8n-data"
            mount_path = "/home/node/.n8n"
          }

          resources {
            limits = {
              cpu    = var.resources_limits_cpu
              memory = var.resources_limits_memory
            }
            requests = {
              cpu    = var.resources_requests_cpu
              memory = var.resources_requests_memory
            }
          }
        }

        volume {
          name = "n8n-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.n8n_data.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "n8n" {
  metadata {
    name      = "n8n"
    namespace = kubernetes_namespace.n8n.metadata[0].name
  }
  spec {
    selector = { app = "n8n" }
    port {
      port        = 80
      target_port = 5678
    }
    type = "ClusterIP"
  }
}

# Ingress (선택적)
resource "kubernetes_ingress_v1" "n8n" {
  count = var.ingress_enabled ? 1 : 0

  metadata {
    name      = "n8n-ingress"
    namespace = kubernetes_namespace.n8n.metadata[0].name
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
              name = "n8n"
              port {
                number = 80
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
        secret_name = "n8n-tls"
      }
    }
  }
}
