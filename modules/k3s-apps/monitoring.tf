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
  set {
    name  = "alertmanager.alertmanagerSpec.externalUrl"
    value = var.domain != "" ? "https://alertmanager.${var.domain}" : ""
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

  # Grafana 플러그인 설치
  set {
    name  = "grafana.plugins[0]"
    value = "blackcowmoo-googleanalytics-datasource"
  }

  # Grafana 환경변수 - GA4 datasource 크레덴셜 (Secret에서 주입)
  set {
    name  = "grafana.envFromSecret"
    value = "grafana-ga4-credentials"
  }

  # Grafana sidecar - annotation 기반 대시보드 폴더 분류
  # kube-prometheus 기본 대시보드 → 내장 폴더 구조 (Kubernetes / ...)
  # 커스텀 대시보드 → grafana_folder annotation 값 기준 분류
  set {
    name  = "grafana.sidecar.dashboards.folderAnnotation"
    value = "grafana_folder"
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

  # ==========================================================================
  # 기본 알림/대시보드 최소화
  # - 기본 알림 규칙은 생성하지 않음 (커스텀 규칙만 사용)
  # - 기본 Grafana 대시보드 비활성화
  # ==========================================================================
  set {
    name  = "defaultRules.create"
    value = "false"
  }

  # Reduce dashboard noise: disable kube-prometheus default dashboard bundle
  set {
    name  = "grafana.defaultDashboardsEnabled"
    value = "false"
  }

  # 기본 규칙에 라벨 추가 (추후 defaultRules를 다시 켤 때 구분 용도)
  set {
    name  = "defaultRules.labels.rule_source"
    value = "kube-prometheus-default"
  }

  # k3s 단일 노드 환경에서 불필요한 기본 규칙 비활성화
  set {
    name  = "defaultRules.rules.etcd"
    value = "false"
  }

  set {
    name  = "defaultRules.rules.kubeSchedulerAlerting"
    value = "false"
  }

  set {
    name  = "defaultRules.rules.kubeSchedulerRecording"
    value = "false"
  }

  set {
    name  = "defaultRules.rules.kubeProxy"
    value = "false"
  }

  set {
    name  = "defaultRules.rules.kubeControllerManager"
    value = "false"
  }
}

# =============================================================================
# YACE (Yet Another CloudWatch Exporter)
# AWS CloudWatch 메트릭을 Prometheus 형식으로 수집
# config.yml은 monitoring_personal 레포에서 ConfigMap으로 관리
# =============================================================================

resource "helm_release" "yace" {
  count      = var.enable_monitoring ? 1 : 0
  name       = "yace"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus-yet-another-cloudwatch-exporter"
  namespace  = "monitoring"
  wait       = true
  timeout    = 300

  # AWS 크레덴셜 (Secret에서 주입)
  set {
    name  = "aws.secret.name"
    value = "yace-aws-credentials"
  }

  set {
    name  = "aws.secret.includesSessionToken"
    value = "false"
  }

  # chart 자체 ConfigMap 비활성화 (monitoring_personal 레포의 ConfigMap 사용)
  set {
    name  = "configMap.enabled"
    value = "false"
  }

  # 리소스 제한
  set {
    name  = "resources.requests.cpu"
    value = "25m"
  }

  set {
    name  = "resources.requests.memory"
    value = "64Mi"
  }

  set {
    name  = "resources.limits.cpu"
    value = "100m"
  }

  set {
    name  = "resources.limits.memory"
    value = "128Mi"
  }

  # Prometheus ServiceMonitor
  set {
    name  = "serviceMonitor.enabled"
    value = "true"
  }

  set {
    name  = "serviceMonitor.interval"
    value = "5m"
  }

  set {
    name  = "serviceMonitor.labels.release"
    value = "kube-prometheus-stack"
  }

  depends_on = [helm_release.kube_prometheus_stack]
}
