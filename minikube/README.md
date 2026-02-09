# SigNoz on Minikube with Terraform

이 프로젝트는 Terraform을 사용하여 minikube 환경에 SigNoz를 배포합니다.

## 사전 요구사항

- minikube 설치 및 실행
- kubectl 설정
- Terraform 설치
- Helm 3.x

## 사용법

1. minikube 시작:
```bash
minikube start --memory=4096 --cpus=4
```

2. Terraform 초기화:
```bash
terraform init
```

3. 배포 계획 확인:
```bash
terraform plan
```

4. SigNoz 배포:
```bash
terraform apply
```

## 접속 방법

배포 완료 후 다음 방법으로 SigNoz에 접속할 수 있습니다:

### 방법 1: NodePort 사용
```bash
minikube ip
# 출력된 IP로 http://<minikube-ip>:30080 접속
```

### 방법 2: Port Forward 사용
```bash
kubectl port-forward -n signoz svc/signoz-frontend 3301:3301
# http://localhost:3301 접속
```

## 정리

```bash
terraform destroy
```

## 설정 옵션

- `namespace`: SigNoz가 배포될 네임스페이스 (기본값: signoz)
- `signoz_version`: SigNoz 차트 버전 (기본값: 0.48.0)
- `enable_persistence`: 영구 저장소 사용 여부 (기본값: true)
- `clickhouse_storage_size`: ClickHouse 저장소 크기 (기본값: 20Gi)