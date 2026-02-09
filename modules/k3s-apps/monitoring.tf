# =============================================================================
# kube-prometheus-stack (Helm) - 경량 모니터링
# Prometheus + Grafana + node-exporter + kube-state-metrics
# =============================================================================

resource "helm_release" "kube_prometheus_stack" {
  count            = var.enable_monitoring ? 1 : 0
  name             = "kube-prometheus-stack"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "kube-prometheus-stack"
  version          = var.kube_prometheus_stack_version
  namespace        = "monitoring"
  create_namespace = true
  wait             = true
  timeout          = 600

  # CRD 자동 업그레이드 (v68.4.0+)
  set {
    name  = "crds.enabled"
    value = "true"
  }

  # Alertmanager
  set {
    name  = "alertmanager.enabled"
    value = "true"
  }

  # Prometheus 설정
  set {
    name  = "prometheus.prometheusSpec.retention"
    value = "3d"
  }

  set {
    name  = "prometheus.prometheusSpec.resources.requests.cpu"
    value = "100m"
  }

  set {
    name  = "prometheus.prometheusSpec.resources.requests.memory"
    value = "256Mi"
  }

  set {
    name  = "prometheus.prometheusSpec.resources.limits.cpu"
    value = "500m"
  }

  set {
    name  = "prometheus.prometheusSpec.resources.limits.memory"
    value = "512Mi"
  }

  # 스토리지 (emptyDir - PVC 없이)
  set {
    name  = "prometheus.prometheusSpec.storageSpec.emptyDir.medium"
    value = ""
  }

  # scrape interval
  set {
    name  = "prometheus.prometheusSpec.scrapeInterval"
    value = "30s"
  }

  # Grafana 설정
  set {
    name  = "grafana.resources.requests.cpu"
    value = "25m"
  }

  set {
    name  = "grafana.resources.requests.memory"
    value = "64Mi"
  }

  set {
    name  = "grafana.resources.limits.cpu"
    value = "200m"
  }

  set {
    name  = "grafana.resources.limits.memory"
    value = "256Mi"
  }

  # Grafana NodePort (30090)
  set {
    name  = "grafana.service.type"
    value = "NodePort"
  }

  set {
    name  = "grafana.service.nodePort"
    value = "30090"
  }

  # node-exporter 리소스 제한
  set {
    name  = "prometheus-node-exporter.resources.requests.cpu"
    value = "10m"
  }

  set {
    name  = "prometheus-node-exporter.resources.requests.memory"
    value = "32Mi"
  }

  set {
    name  = "prometheus-node-exporter.resources.limits.cpu"
    value = "100m"
  }

  set {
    name  = "prometheus-node-exporter.resources.limits.memory"
    value = "64Mi"
  }

  # kube-state-metrics 리소스 제한
  set {
    name  = "kube-state-metrics.resources.requests.cpu"
    value = "10m"
  }

  set {
    name  = "kube-state-metrics.resources.requests.memory"
    value = "32Mi"
  }

  set {
    name  = "kube-state-metrics.resources.limits.cpu"
    value = "100m"
  }

  set {
    name  = "kube-state-metrics.resources.limits.memory"
    value = "128Mi"
  }

  # Prometheus Operator 리소스 제한
  set {
    name  = "prometheusOperator.resources.requests.cpu"
    value = "25m"
  }

  set {
    name  = "prometheusOperator.resources.requests.memory"
    value = "64Mi"
  }

  set {
    name  = "prometheusOperator.resources.limits.cpu"
    value = "200m"
  }

  set {
    name  = "prometheusOperator.resources.limits.memory"
    value = "256Mi"
  }
}
