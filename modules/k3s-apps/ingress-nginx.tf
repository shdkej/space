# =============================================================================
# Ingress Nginx Controller (Helm)
# NodePort 모드 - Cloud LB 없이 직접 노출
# =============================================================================

resource "helm_release" "ingress_nginx" {
  count            = var.enable_ingress_nginx ? 1 : 0
  name             = "ingress-nginx"
  repository       = "https://kubernetes.github.io/ingress-nginx"
  chart            = "ingress-nginx"
  version          = var.ingress_nginx_version
  namespace        = "ingress-nginx"
  create_namespace = true
  wait             = true
  timeout          = 300

  # NodePort 모드로 설정 (Cloud LB 미사용)
  set {
    name  = "controller.service.type"
    value = "NodePort"
  }

  set {
    name  = "controller.service.nodePorts.http"
    value = "30080"
  }

  set {
    name  = "controller.service.nodePorts.https"
    value = "30443"
  }

  # ARM64 리소스 제한
  set {
    name  = "controller.resources.requests.cpu"
    value = "50m"
  }

  set {
    name  = "controller.resources.requests.memory"
    value = "90Mi"
  }

  set {
    name  = "controller.resources.limits.cpu"
    value = "200m"
  }

  set {
    name  = "controller.resources.limits.memory"
    value = "256Mi"
  }

  # Admission webhook 비활성화 (리소스 절약)
  set {
    name  = "controller.admissionWebhooks.enabled"
    value = "false"
  }
}
