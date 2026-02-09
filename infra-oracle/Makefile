.PHONY: init cluster services all destroy clean validate fmt plan status

# =============================================================================
# 2단계 Apply 자동화
# =============================================================================

# Terraform 초기화
init:
	terraform init

# Terraform 검증
validate:
	terraform validate

# Terraform 포맷팅
fmt:
	terraform fmt -recursive
	terraform fmt -recursive ../modules/

# 1단계: K3S 클러스터만 설치 (OCI 보안 + K3S)
cluster:
	terraform apply \
		-target=oci_core_security_list.k3s \
		-target=null_resource.attach_security_list \
		-target=module.k3s

# 2단계: Helm 컴포넌트 설치 (Ingress + cert-manager + ArgoCD)
services:
	terraform apply

# 전체 설치 (1단계 + 2단계)
all: cluster services

# 계획 확인
plan:
	terraform plan

# 1단계 계획만 확인
plan-cluster:
	terraform plan \
		-target=oci_core_security_list.k3s \
		-target=null_resource.attach_security_list \
		-target=module.k3s

# 전체 삭제
destroy:
	terraform destroy

# 로컬 생성 파일 정리
clean:
	rm -f .kubeconfig .node-token
	rm -rf .terraform .terraform.lock.hcl

# 클러스터 상태 확인
status:
	@echo "=== Nodes ==="
	@KUBECONFIG=.kubeconfig kubectl get nodes -o wide
	@echo ""
	@echo "=== Pods (All Namespaces) ==="
	@KUBECONFIG=.kubeconfig kubectl get pods -A
