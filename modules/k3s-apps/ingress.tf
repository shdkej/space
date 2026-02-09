# =============================================================================
# Kubernetes Ingress - 도메인 기반 라우팅 + TLS 자동 발급
# =============================================================================
# domain 변수가 설정되고 해당 앱이 활성화된 경우에만 Ingress 생성.
# cert-manager + Let's Encrypt로 인증서 자동 발급/갱신.
#
#   argocd.{domain}  → ArgoCD Server
#   grafana.{domain} → Grafana
# =============================================================================

resource "kubernetes_ingress_v1" "argocd" {
  count = var.domain != "" && var.enable_argocd ? 1 : 0

  depends_on = [helm_release.argocd, null_resource.letsencrypt_issuer]

  metadata {
    name      = "argocd-ingress"
    namespace = "argocd"
    annotations = {
      "cert-manager.io/cluster-issuer"               = "letsencrypt-prod"
      "nginx.ingress.kubernetes.io/ssl-redirect"      = "true"
      "nginx.ingress.kubernetes.io/backend-protocol"  = "HTTP"
    }
  }

  spec {
    ingress_class_name = "nginx"

    tls {
      hosts       = ["argocd.${var.domain}"]
      secret_name = "argocd-tls"
    }

    rule {
      host = "argocd.${var.domain}"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "argocd-server"
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

resource "kubernetes_ingress_v1" "grafana" {
  count = var.domain != "" && var.enable_monitoring ? 1 : 0

  depends_on = [helm_release.kube_prometheus_stack, null_resource.letsencrypt_issuer]

  metadata {
    name      = "grafana-ingress"
    namespace = "monitoring"
    annotations = {
      "cert-manager.io/cluster-issuer"           = "letsencrypt-prod"
      "nginx.ingress.kubernetes.io/ssl-redirect"  = "true"
    }
  }

  spec {
    ingress_class_name = "nginx"

    tls {
      hosts       = ["grafana.${var.domain}"]
      secret_name = "grafana-tls"
    }

    rule {
      host = "grafana.${var.domain}"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "kube-prometheus-stack-grafana"
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
