output "signoz_namespace" {
  description = "The namespace where SigNoz is deployed"
  value       = kubernetes_namespace.signoz.metadata[0].name
}

output "signoz_frontend_url" {
  description = "URL to access SigNoz frontend via NodePort"
  value       = "http://$(minikube ip):30080"
}

output "signoz_ingress_url" {
  description = "URL to access SigNoz frontend via Ingress"
  value       = var.enable_ingress ? "http://${var.signoz_host}" : "Ingress disabled"
}

output "tekton_dashboard_url" {
  description = "URL to access Tekton Dashboard via NodePort"
  value       = "http://$(minikube ip):30097"
}

output "access_instructions" {
  description = "Instructions to access SigNoz and Tekton"
  value = <<EOT
To access SigNoz:

Option 1 - NodePort:
1. Get minikube IP: minikube ip
2. Access SigNoz at: http://$(minikube ip):30080

Option 2 - Ingress (if enabled):
1. Enable ingress addon: minikube addons enable ingress
2. Add to /etc/hosts: echo "$(minikube ip) ${var.signoz_host}" | sudo tee -a /etc/hosts
3. Access SigNoz at: http://${var.signoz_host}

Option 3 - Port Forward:
kubectl port-forward -n ${kubernetes_namespace.signoz.metadata[0].name} svc/signoz-frontend 3301:3301
Then access at: http://localhost:3301

To access Tekton Dashboard:
1. Access at: http://$(minikube ip):30097
2. Or use: minikube service tekton-dashboard-nodeport -n tekton-pipelines
EOT
}