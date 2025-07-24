# Nginx Ingress Controller Namespace
resource "kubernetes_namespace" "ingress_nginx" {
  metadata {
    name = "ingress-nginx"
  }
}

# Nginx Ingress Controller Service Account
resource "kubernetes_service_account" "ingress_nginx" {
  metadata {
    name      = "ingress-nginx"
    namespace = kubernetes_namespace.ingress_nginx.metadata[0].name
  }
}

# Nginx Ingress Controller ClusterRole
resource "kubernetes_cluster_role" "ingress_nginx" {
  metadata {
    name = "ingress-nginx"
  }

  rule {
    api_groups = [""]
    resources  = ["configmaps", "endpoints", "namespaces", "secrets"]
    verbs      = ["list", "watch"]
  }

  rule {
    api_groups = [""]
    resources  = ["nodes", "pods", "services"]
    verbs      = ["get", "list", "watch"]
  }


  rule {
    api_groups = [""]
    resources  = ["events"]
    verbs      = ["create", "patch"]
  }

  rule {
    api_groups = ["coordination.k8s.io"]
    resources  = ["leases"]
    verbs      = ["list", "watch", "get", "update", "create"]
  }

  rule {
    api_groups = ["discovery.k8s.io"]
    resources  = ["endpointslices"]
    verbs      = ["list", "watch", "get"]
  }

  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["ingresses", "ingressclasses"]
    verbs      = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["ingresses/status"]
    verbs      = ["update"]
  }

  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["ingresses"]
    verbs      = ["patch"]
  }
}

# Nginx Ingress Controller ClusterRoleBinding
resource "kubernetes_cluster_role_binding" "ingress_nginx" {
  metadata {
    name = "ingress-nginx"
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "ingress-nginx"
  }

  subject {
    kind      = "ServiceAccount"
    name      = "ingress-nginx"
    namespace = kubernetes_namespace.ingress_nginx.metadata[0].name
  }
}

# Nginx Ingress Controller ConfigMap
resource "kubernetes_config_map" "ingress_nginx" {
  metadata {
    name      = "ingress-nginx-controller"
    namespace = kubernetes_namespace.ingress_nginx.metadata[0].name
  }

  data = {
    "use-proxy-protocol" = "false"
    "proxy-real-ip-cidr" = "0.0.0.0/0"
    "use-forwarded-headers" = "true"
  }
}

# Nginx Ingress Controller Deployment
resource "kubernetes_deployment" "ingress_nginx" {
  metadata {
    name      = "ingress-nginx-controller"
    namespace = kubernetes_namespace.ingress_nginx.metadata[0].name
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "ingress-nginx"
      }
    }

    template {
      metadata {
        labels = {
          app = "ingress-nginx"
        }
      }

      spec {
        service_account_name = "ingress-nginx"

        container {
          name  = "controller"
          image = "registry.k8s.io/ingress-nginx/controller:v1.8.1"

          args = [
            "/nginx-ingress-controller",
            "--publish-service=$(POD_NAMESPACE)/ingress-nginx-controller",
            "--election-id=ingress-nginx-leader",
            "--controller-class=k8s.io/ingress-nginx",
            "--ingress-class=nginx",
            "--configmap=$(POD_NAMESPACE)/ingress-nginx-controller"
          ]

          env {
            name = "POD_NAME"
            value_from {
              field_ref {
                field_path = "metadata.name"
              }
            }
          }

          env {
            name = "POD_NAMESPACE"
            value_from {
              field_ref {
                field_path = "metadata.namespace"
              }
            }
          }

          port {
            container_port = 80
            name           = "http"
          }

          port {
            container_port = 443
            name           = "https"
          }

          liveness_probe {
            http_get {
              path = "/healthz"
              port = 10254
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/healthz"
              port = 10254
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }

          resources {
            limits = {
              cpu    = "100m"
              memory = "128Mi"
            }
            requests = {
              cpu    = "50m"
              memory = "64Mi"
            }
          }
        }
      }
    }
  }
}

# Nginx Ingress Controller Service
resource "kubernetes_service" "ingress_nginx" {
  metadata {
    name      = "ingress-nginx-controller"
    namespace = kubernetes_namespace.ingress_nginx.metadata[0].name
  }

  spec {
    type = "NodePort"

    port {
      name        = "http"
      port        = 80
      target_port = 80
      node_port   = 30080
    }

    port {
      name        = "https"
      port        = 443
      target_port = 443
      node_port   = 30443
    }

    selector = {
      app = "ingress-nginx"
    }
  }
}

# Ingress for n8n
resource "kubernetes_ingress_v1" "n8n" {
  metadata {
    name      = "n8n-ingress"
    namespace = kubernetes_namespace.n8n.metadata[0].name
    annotations = {
      "kubernetes.io/ingress.class" = "nginx"
      "nginx.ingress.kubernetes.io/rewrite-target" = "/"
      "nginx.ingress.kubernetes.io/ssl-redirect" = "false"
      # "cert-manager.io/cluster-issuer" = "letsencrypt-prod"  # SSL 비활성화
    }
  }

  spec {
    rule {
      host = "n8n.${digitalocean_domain.main.name}"
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
  }
}

# Ingress for SigNoz
resource "kubernetes_ingress_v1" "signoz" {
  metadata {
    name      = "signoz-ingress"
    namespace = kubernetes_namespace.signoz.metadata[0].name
    annotations = {
      "kubernetes.io/ingress.class" = "nginx"
      "nginx.ingress.kubernetes.io/rewrite-target" = "/"
      "nginx.ingress.kubernetes.io/ssl-redirect" = "false"
      # "cert-manager.io/cluster-issuer" = "letsencrypt-prod"  # SSL 비활성화
    }
  }

  spec {
    rule {
      host = "signoz.${digitalocean_domain.main.name}"
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
  }
} 