# Tekton specific monitoring configuration

# ConfigMap for Tekton OpenTelemetry instrumentation
resource "kubernetes_config_map" "tekton_otel_config" {
  metadata {
    name      = "tekton-otel-config"
    namespace = "tekton-pipelines"
  }

  data = {
    "config-observability" = yamlencode({
      _example = "Configuration for observability features"
      metrics.backend-destination = "otel"
      metrics.stackdriver-project-id = ""
      metrics.allow-stackdriver-custom-metrics = "false"
      metrics.otel-collector-address = "http://signoz-otel-collector.${var.namespace}.svc.cluster.local:4317"
      
      logging.zap-logger-config = yamlencode({
        level = "info"
        development = false
        sampling = {
          initial = 100
          thereafter = 100
        }
        outputPaths = ["stdout"]
        errorOutputPaths = ["stderr"]
        encoding = "json"
        encoderConfig = {
          timeKey = "timestamp"
          levelKey = "severity"
          nameKey = "logger"
          callerKey = "caller"
          messageKey = "message"
          stacktraceKey = "stacktrace"
          lineEnding = ""
          levelEncoder = ""
          timeEncoder = "iso8601"
          durationEncoder = ""
          callerEncoder = ""
        }
      })
    })
  }
}

# Service Monitor for Tekton Controller metrics
resource "kubernetes_manifest" "tekton_controller_service_monitor" {
  manifest = {
    apiVersion = "v1"
    kind       = "Service"
    metadata = {
      name      = "tekton-pipelines-controller-metrics"
      namespace = "tekton-pipelines"
      labels = {
        "app.kubernetes.io/component" = "controller"
        "app.kubernetes.io/instance"  = "default"
        "app.kubernetes.io/part-of"   = "tekton-pipelines"
        "pipeline.tekton.dev/release" = "devel"
      }
    }
    spec = {
      ports = [
        {
          name       = "http-metrics"
          port       = 9090
          protocol   = "TCP"
          targetPort = 9090
        }
      ]
      selector = {
        "app.kubernetes.io/component" = "controller"
        "app.kubernetes.io/instance"  = "default"
        "app.kubernetes.io/part-of"   = "tekton-pipelines"
      }
    }
  }
}

# Configure Tekton to send traces to SigNoz
resource "kubernetes_config_map" "tekton_tracing_config" {
  metadata {
    name      = "config-tracing"
    namespace = "tekton-pipelines"
  }

  data = {
    _example = "Configuration for distributed tracing"
    backend = "otel"
    otel-collector-address = "http://signoz-otel-collector.${var.namespace}.svc.cluster.local:4317"
    otel-insecure = "true"
    otel-timeout = "5s"
  }
}

# Update Tekton Dashboard to expose metrics
resource "kubernetes_manifest" "tekton_dashboard_metrics_service" {
  manifest = {
    apiVersion = "v1"
    kind       = "Service"
    metadata = {
      name      = "tekton-dashboard-metrics"
      namespace = "tekton-pipelines"
      labels = {
        "app.kubernetes.io/component" = "dashboard"
        "app.kubernetes.io/instance"  = "default"
        "app.kubernetes.io/part-of"   = "tekton-dashboard"
      }
    }
    spec = {
      ports = [
        {
          name       = "http-metrics"
          port       = 8080
          protocol   = "TCP"
          targetPort = 8080
        }
      ]
      selector = {
        "app.kubernetes.io/component" = "dashboard"
        "app.kubernetes.io/instance"  = "default"
        "app.kubernetes.io/part-of"   = "tekton-dashboard"
      }
    }
  }
}