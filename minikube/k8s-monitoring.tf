# Kubernetes monitoring configuration for SigNoz

# Service Account for SigNoz collector to access Kubernetes API
resource "kubernetes_service_account" "signoz_k8s_collector" {
  metadata {
    name      = "signoz-k8s-collector"
    namespace = var.namespace
  }
}

# ClusterRole with permissions to read Kubernetes resources
resource "kubernetes_cluster_role" "signoz_k8s_collector" {
  metadata {
    name = "signoz-k8s-collector"
  }

  rule {
    api_groups = [""]
    resources = [
      "nodes",
      "nodes/metrics",
      "services",
      "endpoints",
      "pods",
      "events",
      "namespaces",
      "persistentvolumes",
      "persistentvolumeclaims"
    ]
    verbs = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["apps"]
    resources = [
      "deployments",
      "daemonsets",
      "replicasets",
      "statefulsets"
    ]
    verbs = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["batch"]
    resources = [
      "jobs",
      "cronjobs"
    ]
    verbs = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["tekton.dev"]
    resources = [
      "pipelines",
      "pipelineruns",
      "tasks",
      "taskruns",
      "customruns"
    ]
    verbs = ["get", "list", "watch"]
  }

  rule {
    non_resource_urls = ["/metrics"]
    verbs = ["get"]
  }
}

# ClusterRoleBinding to bind the service account to the cluster role
resource "kubernetes_cluster_role_binding" "signoz_k8s_collector" {
  metadata {
    name = "signoz-k8s-collector"
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.signoz_k8s_collector.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.signoz_k8s_collector.metadata[0].name
    namespace = var.namespace
  }
}

# ConfigMap for OpenTelemetry collector configuration
resource "kubernetes_config_map" "otel_k8s_config" {
  metadata {
    name      = "otel-k8s-config"
    namespace = var.namespace
  }

  data = {
    "otel-collector-config.yaml" = yamlencode({
      receivers = {
        # Kubernetes cluster receiver
        k8s_cluster = {
          collection_interval = "10s"
          node_conditions_to_report = [
            "Ready", "MemoryPressure", "DiskPressure", "PIDPressure"
          ]
          allocatable_types_to_report = [
            "cpu", "memory", "storage"
          ]
        }

        # Kubernetes events receiver
        k8s_events = {}

        # Kubelet stats receiver
        kubeletstats = {
          collection_interval = "20s"
          auth_type = "serviceAccount"
          endpoint = "https://$${env:K8S_NODE_IP}:10250"
          insecure_skip_verify = true
          metric_groups = [
            "node", "pod", "container"
          ]
        }

        # Prometheus receiver for scraping metrics
        prometheus = {
          config = {
            scrape_configs = [
              {
                job_name = "tekton-controller"
                kubernetes_sd_configs = [
                  {
                    role = "endpoints"
                    namespaces = {
                      names = ["tekton-pipelines"]
                    }
                  }
                ]
                relabel_configs = [
                  {
                    source_labels = ["__meta_kubernetes_service_name"]
                    action = "keep"
                    regex = "tekton-pipelines-controller"
                  }
                ]
              }
              {
                job_name = "kubernetes-nodes-kubelet"
                kubernetes_sd_configs = [
                  {
                    role = "node"
                  }
                ]
                relabel_configs = [
                  {
                    action = "labelmap"
                    regex = "__meta_kubernetes_node_label_(.+)"
                  }
                ]
              }
            ]
          }
        }
      }

      processors = {
        batch = {}
        memory_limiter = {
          limit_mib = 512
        }
        # Add Kubernetes attributes
        k8sattributes = {
          auth_type = "serviceAccount"
          passthrough = false
          extract = {
            metadata = [
              "k8s.pod.name",
              "k8s.pod.uid", 
              "k8s.deployment.name",
              "k8s.namespace.name",
              "k8s.node.name",
              "k8s.pod.start_time"
            ]
          }
        }
      }

      exporters = {
        # Export to SigNoz
        otlp = {
          endpoint = "http://signoz-otel-collector.${var.namespace}.svc.cluster.local:4317"
          tls = {
            insecure = true
          }
        }
      }

      service = {
        pipelines = {
          metrics = {
            receivers = [
              "k8s_cluster",
              "kubeletstats", 
              "prometheus"
            ]
            processors = [
              "memory_limiter",
              "k8sattributes",
              "batch"
            ]
            exporters = ["otlp"]
          }
          logs = {
            receivers = ["k8s_events"]
            processors = [
              "memory_limiter", 
              "k8sattributes",
              "batch"
            ]
            exporters = ["otlp"]
          }
        }
      }
    })
  }

  depends_on = [kubernetes_service_account.signoz_k8s_collector]
}

# DaemonSet to collect metrics from all nodes
resource "kubernetes_daemon_set" "otel_k8s_collector" {
  metadata {
    name      = "otel-k8s-collector"
    namespace = var.namespace
    labels = {
      app = "otel-k8s-collector"
    }
  }

  spec {
    selector {
      match_labels = {
        app = "otel-k8s-collector"
      }
    }

    template {
      metadata {
        labels = {
          app = "otel-k8s-collector"
        }
      }

      spec {
        service_account_name = kubernetes_service_account.signoz_k8s_collector.metadata[0].name
        host_network = true
        host_pid = true

        container {
          name  = "otel-collector"
          image = "otel/opentelemetry-collector-contrib:latest"

          command = [
            "/otelcol-contrib",
            "--config=/etc/otel-collector-config/otel-collector-config.yaml"
          ]

          env {
            name = "K8S_NODE_IP"
            value_from {
              field_ref {
                field_path = "status.hostIP"
              }
            }
          }

          env {
            name = "K8S_NODE_NAME"
            value_from {
              field_ref {
                field_path = "spec.nodeName"
              }
            }
          }

          volume_mount {
            name       = "otel-collector-config-vol"
            mount_path = "/etc/otel-collector-config"
          }

          volume_mount {
            name       = "proc"
            mount_path = "/host/proc"
            read_only  = true
          }

          volume_mount {
            name       = "sys"
            mount_path = "/host/sys"
            read_only  = true
          }

          resources {
            limits = {
              memory = "512Mi"
              cpu    = "200m"
            }
            requests = {
              memory = "256Mi"
              cpu    = "100m"
            }
          }
        }

        volume {
          name = "otel-collector-config-vol"
          config_map {
            name = kubernetes_config_map.otel_k8s_config.metadata[0].name
          }
        }

        volume {
          name = "proc"
          host_path {
            path = "/proc"
          }
        }

        volume {
          name = "sys"
          host_path {
            path = "/sys"
          }
        }

        toleration {
          operator = "Exists"
        }
      }
    }
  }

  depends_on = [
    kubernetes_config_map.otel_k8s_config,
    kubernetes_cluster_role_binding.signoz_k8s_collector
  ]
}