# =============================================================================
# ArgoCD (Helm) - 경량 설정
# =============================================================================

resource "helm_release" "argocd" {
  count            = var.enable_argocd ? 1 : 0
  name             = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  version          = var.argocd_version
  namespace        = "argocd"
  create_namespace = true
  wait             = true
  timeout          = 900

  # --insecure 모드 (TLS termination은 Ingress에서 처리)
  set {
    name  = "configs.params.server\\.insecure"
    value = "true"
  }

  # Dex 비활성화 (리소스 절약)
  set {
    name  = "dex.enabled"
    value = "false"
  }

  # Server 리소스 제한
  set {
    name  = "server.resources.requests.cpu"
    value = "25m"
  }

  set {
    name  = "server.resources.requests.memory"
    value = "64Mi"
  }

  set {
    name  = "server.resources.limits.cpu"
    value = "200m"
  }

  set {
    name  = "server.resources.limits.memory"
    value = "256Mi"
  }

  # Repo Server 리소스 제한
  set {
    name  = "repoServer.resources.requests.cpu"
    value = "25m"
  }

  set {
    name  = "repoServer.resources.requests.memory"
    value = "64Mi"
  }

  set {
    name  = "repoServer.resources.limits.cpu"
    value = "200m"
  }

  set {
    name  = "repoServer.resources.limits.memory"
    value = "256Mi"
  }

  # Application Controller 리소스 제한
  set {
    name  = "controller.resources.requests.cpu"
    value = "50m"
  }

  set {
    name  = "controller.resources.requests.memory"
    value = "128Mi"
  }

  set {
    name  = "controller.resources.limits.cpu"
    value = "300m"
  }

  set {
    name  = "controller.resources.limits.memory"
    value = "512Mi"
  }

  # Redis 리소스 제한
  set {
    name  = "redis.resources.requests.cpu"
    value = "10m"
  }

  set {
    name  = "redis.resources.requests.memory"
    value = "32Mi"
  }

  set {
    name  = "redis.resources.limits.cpu"
    value = "100m"
  }

  set {
    name  = "redis.resources.limits.memory"
    value = "128Mi"
  }

  # Replica 수 최소화
  set {
    name  = "server.replicas"
    value = "1"
  }

  set {
    name  = "repoServer.replicas"
    value = "1"
  }
}

# =============================================================================
# ArgoCD App of Apps - GitHub URL만으로 앱 배포
# =============================================================================
# argocd/apps/ 디렉토리의 Application YAML을 자동 감지하여 배포.
# 새 앱 추가: argocd/apps/{앱이름}.yaml 파일 추가 + git push → 자동 배포.
# =============================================================================

resource "kubernetes_manifest" "argocd_root_app" {
  count = var.enable_argocd && var.argocd_apps_repo_url != "" ? 1 : 0

  depends_on = [helm_release.argocd]

  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "Application"
    metadata = {
      name      = "root"
      namespace = "argocd"
    }
    spec = {
      project = "default"
      source = {
        repoURL        = var.argocd_apps_repo_url
        targetRevision = var.argocd_apps_target_revision
        path           = var.argocd_apps_path
      }
      destination = {
        server = "https://kubernetes.default.svc"
      }
      syncPolicy = {
        automated = {
          prune    = true
          selfHeal = true
        }
      }
    }
  }
}
