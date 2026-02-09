resource "kubernetes_ingress_v1" "signoz" {
  metadata {
    name      = "signoz-ingress"
    namespace = var.namespace
    annotations = {
      "kubernetes.io/ingress.class"                = "nginx"
      "nginx.ingress.kubernetes.io/rewrite-target" = "/"
    }
  }

  spec {
    rule {
      host = var.signoz_host
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "signoz-frontend"
              port {
                number = 3301
              }
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.signoz]
}