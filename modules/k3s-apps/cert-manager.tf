# =============================================================================
# cert-manager (Helm) + Let's Encrypt ClusterIssuer
# =============================================================================

resource "helm_release" "cert_manager" {
  count            = var.enable_cert_manager ? 1 : 0
  name             = "cert-manager"
  repository       = "https://charts.jetstack.io"
  chart            = "cert-manager"
  version          = var.cert_manager_version
  namespace        = "cert-manager"
  create_namespace = true
  wait             = true
  timeout          = 300

  # CRDs 설치
  set {
    name  = "crds.enabled"
    value = "true"
  }

  # ARM64 리소스 제한
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

  # webhook 리소스 제한
  set {
    name  = "webhook.resources.requests.cpu"
    value = "10m"
  }

  set {
    name  = "webhook.resources.requests.memory"
    value = "32Mi"
  }

  set {
    name  = "webhook.resources.limits.cpu"
    value = "50m"
  }

  set {
    name  = "webhook.resources.limits.memory"
    value = "64Mi"
  }

  # cainjector 리소스 제한
  set {
    name  = "cainjector.resources.requests.cpu"
    value = "10m"
  }

  set {
    name  = "cainjector.resources.requests.memory"
    value = "64Mi"
  }

  set {
    name  = "cainjector.resources.limits.cpu"
    value = "50m"
  }

  set {
    name  = "cainjector.resources.limits.memory"
    value = "128Mi"
  }
}

# Let's Encrypt ClusterIssuer (cert-manager 설치 후 생성)
resource "null_resource" "letsencrypt_issuer" {
  depends_on = [helm_release.cert_manager]

  count = var.enable_cert_manager && var.letsencrypt_email != "" ? 1 : 0

  provisioner "local-exec" {
    environment = {
      KUBECONFIG = var.kubeconfig_path
    }
    command = <<-EOT
      kubectl apply -f - <<EOF
      apiVersion: cert-manager.io/v1
      kind: ClusterIssuer
      metadata:
        name: letsencrypt-prod
      spec:
        acme:
          server: https://acme-v02.api.letsencrypt.org/directory
          email: ${var.letsencrypt_email}
          privateKeySecretRef:
            name: letsencrypt-prod
          solvers:
          - http01:
              ingress:
                class: nginx
      EOF
    EOT
  }
}
