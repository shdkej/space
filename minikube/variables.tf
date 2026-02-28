variable "namespace" {
  description = "Kubernetes namespace for SigNoz deployment"
  type        = string
  default     = "signoz"
}

variable "signoz_version" {
  description = "SigNoz chart version"
  type        = string
  default     = "0.48.0"
}

variable "enable_persistence" {
  description = "Enable persistent storage for SigNoz"
  type        = bool
  default     = true
}

variable "storage_class" {
  description = "Storage class for persistent volumes"
  type        = string
  default     = "standard"
}

variable "clickhouse_storage_size" {
  description = "Storage size for ClickHouse"
  type        = string
  default     = "20Gi"
}

variable "frontend_service_type" {
  description = "Service type for SigNoz frontend (NodePort for minikube)"
  type        = string
  default     = "NodePort"
}

variable "enable_ingress" {
  description = "Enable Ingress for SigNoz"
  type        = bool
  default     = true
}

variable "signoz_host" {
  description = "Host domain for SigNoz Ingress"
  type        = string
  default     = "signoz.local"
}

variable "enable_k8s_monitoring" {
  description = "Enable Kubernetes monitoring in SigNoz"
  type        = bool
  default     = true
}

variable "enable_tekton_monitoring" {
  description = "Enable Tekton monitoring in SigNoz"
  type        = bool
  default     = true
}