# n8n을 위한 Namespace 생성
resource "kubernetes_namespace" "n8n" {
  metadata {
    name = "n8n"
  }
}

# n8n을 위한 PersistentVolumeClaim (데이터 저장용)
resource "kubernetes_persistent_volume_claim" "n8n_data" {
  metadata {
    name      = "n8n-data"
    namespace = kubernetes_namespace.n8n.metadata[0].name
  }
  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "10Gi"
      }
    }
  }
}

# n8n Deployment
resource "kubernetes_deployment" "n8n" {
  metadata {
    name      = "n8n"
    namespace = kubernetes_namespace.n8n.metadata[0].name
    labels = {
      app = "n8n"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "n8n"
      }
    }

    template {
      metadata {
        labels = {
          app = "n8n"
        }
      }

              spec {
          security_context {
            run_as_user = 1000
            run_as_group = 1000
            fs_group = 1000
          }
          
                      init_container {
              name  = "init-n8n-permissions"
              image = "busybox:1.35"
              
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
              image = "n8nio/n8n:0.234.0"
              name  = "n8n"

              security_context {
                run_as_user = 1000
                run_as_group = 1000
              }

              port {
                container_port = 5678
              }

          env {
            name  = "N8N_BASIC_AUTH_ACTIVE"
            value = "true"
          }

          env {
            name  = "N8N_BASIC_AUTH_USER"
            value = "admin"
          }

          env {
            name  = "N8N_BASIC_AUTH_PASSWORD"
            value = "admin123"
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
            value = "http://localhost:5678/"
          }

          env {
            name  = "GENERIC_TIMEZONE"
            value = "Asia/Seoul"
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
              cpu    = "500m"
              memory = "512Mi"
            }
            requests = {
              cpu    = "200m"
              memory = "256Mi"
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

# n8n Service
resource "kubernetes_service" "n8n" {
  metadata {
    name      = "n8n"
    namespace = kubernetes_namespace.n8n.metadata[0].name
  }
  spec {
    selector = {
      app = "n8n"
    }
    port {
      port        = 80
      target_port = 5678
    }
    type = "ClusterIP"
  }
}

# n8n은 ClusterIP만 사용 (Ingress를 통해 접근) 