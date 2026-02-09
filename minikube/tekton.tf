resource "kubernetes_namespace" "tekton-pipelines" {
  metadata {
    name = "tekton-pipelines"
  }
}

resource "kubernetes_manifest" "tekton_pipelines" {
  manifest = {
    apiVersion = "v1"
    kind       = "ConfigMap"
    metadata = {
      name      = "tekton-install"
      namespace = kubernetes_namespace.tekton-pipelines.metadata[0].name
    }
    data = {
      install = "kubectl apply --filename https://storage.googleapis.com/tekton-releases/pipeline/latest/release.yaml"
    }
  }
}

resource "null_resource" "install_tekton_pipelines" {
  provisioner "local-exec" {
    command = "kubectl apply --filename https://storage.googleapis.com/tekton-releases/pipeline/latest/release.yaml"
  }

  depends_on = [kubernetes_namespace.tekton-pipelines]
}

resource "null_resource" "install_tekton_dashboard" {
  provisioner "local-exec" {
    command = "kubectl apply --filename https://storage.googleapis.com/tekton-releases/dashboard/latest/release.yaml"
  }

  depends_on = [null_resource.install_tekton_pipelines]
}

resource "kubernetes_service" "tekton_dashboard_nodeport" {
  metadata {
    name      = "tekton-dashboard-nodeport"
    namespace = "tekton-pipelines"
  }

  spec {
    type = "NodePort"
    
    port {
      port        = 9097
      target_port = 9097
      node_port   = 30097
    }

    selector = {
      "app.kubernetes.io/component" = "dashboard"
      "app.kubernetes.io/instance"  = "default"
      "app.kubernetes.io/name"      = "dashboard"
      "app.kubernetes.io/part-of"   = "tekton-dashboard"
    }
  }

  depends_on = [null_resource.install_tekton_dashboard]
}