# DigitalOcean Kubernetes + n8n Terraform 프로젝트

이 프로젝트는 DigitalOcean Kubernetes 클러스터에 n8n 워크플로우 자동화 도구를 배포하는 Terraform 구성입니다.

## 프로젝트 구조

```
kubernetes/
├── providers.tf      # Terraform 프로바이더 설정
├── variables.tf      # 변수 정의
├── cluster.tf        # DigitalOcean Kubernetes 클러스터
├── n8n.tf           # n8n 애플리케이션 리소스
├── signoz.tf        # SigNoz 모니터링 리소스
├── ingress.tf       # Nginx Ingress Controller
├── loadbalancer.tf  # DigitalOcean LoadBalancer
├── outputs.tf       # 출력값 정의
├── terraform.tfvars # 변수 값 설정
└── README.md        # 이 파일
```

## 파일 설명

### providers.tf

- DigitalOcean 및 Kubernetes 프로바이더 설정
- Terraform 버전 및 프로바이더 버전 관리

### cluster.tf

- DigitalOcean Kubernetes 클러스터 생성
- 노드 풀 설정 (1개 노드, s-1vcpu-2gb)

### n8n.tf

- n8n 네임스페이스 생성
- PersistentVolumeClaim (10GB 스토리지)
- n8n Deployment (최신 이미지 사용)
- ClusterIP 및 LoadBalancer 서비스

### signoz.tf

- SigNoz 네임스페이스 생성
- PersistentVolumeClaim (20GB 스토리지)
- SigNoz Query Service, ClickHouse, Frontend Deployment
- ClusterIP 및 LoadBalancer 서비스

### ingress.tf

- Nginx Ingress Controller 설치
- 경로 기반 라우팅 (`/n8n`, `/signoz`)
- SSL/TLS 지원 준비

### loadbalancer.tf

- DigitalOcean LoadBalancer 설정
- Ingress Controller용 단일 LoadBalancer

### outputs.tf

- 클러스터 엔드포인트
- n8n 접속 URL 및 로그인 정보
- SigNoz Frontend 접속 URL
- ClickHouse 데이터베이스 정보

## 사전 요구사항

1. DigitalOcean API 토큰
2. Terraform 설치
3. kubectl 설치 (선택사항)

## 사용법

### 1. 초기화

```bash
terraform init
```

### 2. 계획 확인

```bash
terraform plan
```

### 3. 인프라 생성

```bash
terraform apply
```

### 4. 애플리케이션 접속

배포 완료 후 다음 명령어로 접속 정보를 확인할 수 있습니다:

```bash
# LoadBalancer IP
terraform output loadbalancer_ip

# n8n 접속 정보
terraform output n8n_service_url
terraform output n8n_credentials

# SigNoz 접속 정보
terraform output signoz_frontend_url
terraform output signoz_clickhouse_credentials
```

### 5. 인프라 삭제

```bash
terraform destroy
```

## 애플리케이션 설정

### n8n 설정

#### 기본 인증 정보

- 사용자명: `admin`
- 비밀번호: `admin123`

#### 환경 변수

- 타임존: `Asia/Seoul`
- 포트: `5678`
- 프로토콜: `http`

#### 리소스 제한

- CPU 요청: 200m, 제한: 500m
- 메모리 요청: 256Mi, 제한: 512Mi

### SigNoz 설정

#### 구성 요소

- **Query Service**: API 서버 (8080 포트)
- **ClickHouse**: 데이터베이스 (9000, 8123 포트)
- **Frontend**: 웹 UI (3000 포트)

#### 리소스 제한

- **Query Service**: CPU 200m-500m, 메모리 256Mi-512Mi
- **ClickHouse**: CPU 500m-1000m, 메모리 1Gi-2Gi
- **Frontend**: CPU 100m-300m, 메모리 128Mi-256Mi

#### 데이터베이스 정보

- 데이터베이스: `signoz_traces`
- 사용자명: `default`
- 비밀번호: `password`

## 주의사항

1. **보안**: 기본 인증 정보는 프로덕션 환경에서 변경해야 합니다.
2. **스토리지**: n8n 10GB, SigNoz 20GB PersistentVolumeClaim이 생성됩니다.
3. **비용**: DigitalOcean LoadBalancer 1개와 노드에 대한 비용이 발생합니다.
4. **백업**: 애플리케이션 데이터는 PersistentVolume에 저장되므로 클러스터 삭제 시 데이터가 손실될 수 있습니다.
5. **리소스**: SigNoz는 ClickHouse 데이터베이스를 사용하므로 충분한 리소스가 필요합니다.
6. **접속**: 모든 서비스는 단일 LoadBalancer IP를 통해 경로로 접근합니다 (`/n8n`, `/signoz`).

## 문제 해결

### LoadBalancer IP 할당 대기

LoadBalancer 서비스의 외부 IP 할당에는 몇 분이 소요될 수 있습니다:

```bash
kubectl get svc -n n8n n8n-loadbalancer
kubectl get svc -n signoz signoz-frontend-loadbalancer
```

### 애플리케이션 로그 확인

```bash
# n8n 로그
kubectl logs -n n8n deployment/n8n

# SigNoz 로그
kubectl logs -n signoz deployment/signoz-query-service
kubectl logs -n signoz deployment/signoz-clickhouse
kubectl logs -n signoz deployment/signoz-frontend
```

### 포드 상태 확인

```bash
kubectl get pods -n n8n
kubectl get pods -n signoz
```
