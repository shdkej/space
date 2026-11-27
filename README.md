# SPACE

어떤 클라우드이든지 상관 없이 인프라와 배포 선언을 관리합니다. **Space는 배포 저장소입니다.** 정적 사이트를 제외한 서비스 코드는 Space에 두지 않습니다.

## 배포 유형과 소유 경계

| 유형 | 구현·소스 저장소 | Space가 소유하는 것 | 배포 경로 |
| --- | --- | --- | --- |
| 정적 사이트 | `space/infra-aws-static-sites/sites/<app>/` | S3·CloudFront·Route53 Terraform, 사이트 레지스트리, `dist/` 업로드 | `sites/<app>/dist/` → GitHub Actions → S3/CloudFront |
| Lambda | `/home/ubuntu/workspace/services/<service>/`의 독립 Git 저장소 | IAM, Lambda/API Gateway/Function URL, CloudFront 연결 Terraform | 서비스 저장소에서 테스트·패키징 → Space Terraform이 버전된 artifact를 배포 |
| Next.js | `/home/ubuntu/workspace/apps/<app>/`의 독립 Git 저장소 | 이미지 참조, Kubernetes Deployment/Service/Ingress, Argo CD 선언 | 앱 저장소에서 이미지 build/push → Space GitOps 변경 → Argo CD sync |

`space/infra-aws-static-sites/lambda/`, `space/apps/`에 남아 있는 코드와 앱은 레거시 배치입니다. 새 Lambda·Next.js를 추가하거나 기존 항목을 실질적으로 수정할 때는 코드·테스트·패키지 잠금·Dockerfile·서비스 README를 독립 저장소로 먼저 구성하고, Space에는 배포 선언만 남깁니다. 이 분리와 이전 준비는 배포 작업을 맡은 SAM의 완료 책임입니다.

## 1. 정적 사이트 — Space 안에서 완료

정적 사이트의 정본은 [`infra-aws-static-sites/README.md`](infra-aws-static-sites/README.md)입니다. 기본 흐름은 다음과 같습니다.

1. `infra-aws-static-sites/sites/registry.json`에 앱·도메인·SPA 여부를 등록합니다.
2. `infra-aws-static-sites/`에서 `terraform init` → `terraform plan` → 승인된 `terraform apply`로 S3/CloudFront/Route53을 만듭니다.
3. `infra-aws-static-sites/sites/<app>/dist/`에 배포할 정적 파일을 둡니다.
4. `main`/`master` push로 GitHub Actions가 변경된 `dist/`를 S3에 동기화하고 CloudFront를 무효화합니다. 수동 배포가 필요하면 정본 README의 `aws s3 sync`와 invalidation 절차를 따릅니다.

## 2. Lambda — 독립 서비스 코드, Space는 인프라 배포

새 Lambda의 시작 위치는 `/home/ubuntu/workspace/services/<service>/`입니다. 서비스 저장소에는 handler, 의존성 정의, 테스트, artifact 생성 명령, README를 둡니다. 빌드 결과는 immutable version/S3 object 같은 배포 가능한 artifact로 만들고, Space Terraform은 그 artifact의 버전을 입력으로 받아 IAM과 Lambda endpoint를 갱신합니다.

간단한 순서는 `서비스 저장소에서 test/package` → `artifact publish` → `Space에서 terraform plan` → 승인된 `terraform apply` → Function URL/API Gateway와 CloudFront 경로의 실제 호출 검증입니다. 서비스 코드나 비밀값을 `infra-aws-static-sites/`에 복사하거나 Terraform 상태에 넣지 않습니다.

## 3. Next.js — 독립 앱 코드, Space는 GitOps 배포

새 Next.js 앱의 시작 위치는 `/home/ubuntu/workspace/apps/<app>/`입니다. 앱 저장소는 `package.json`, lockfile, `next.config.*`, Dockerfile, 테스트, health endpoint, README를 소유합니다. 이미지 태그는 immutable하게 만들고 레지스트리에 push합니다.

그 다음 Space에는 앱 이미지 태그를 참조하는 `Deployment`, `Service`, `Ingress`와 Argo CD 애플리케이션 선언만 추가합니다. 흐름은 `앱 저장소에서 test/build/image push` → `Space manifest의 image tag 변경` → `main` push → Argo CD sync → health endpoint와 실제 URL 확인입니다. 클러스터가 Space 저장소를 clone해 앱을 빌드하는 방식은 새 앱에 사용하지 않습니다.

## 배포 공통 완료 기준

- 구현 저장소와 Space 저장소에서 변경을 각각 commit/push하고 원격 반영을 확인합니다.
- 비밀값은 코드·Terraform·문서에 넣지 않고 대상 플랫폼의 secret store를 통해 주입합니다.
- 배포 전 plan/build/test, 배포 후 health/URL 검증, 실패 시 직전 artifact/image 태그로의 롤백 경로를 남깁니다.

## Monitoring — Space는 기반과 GitOps 연결, Monitoring 저장소는 설정 정본

`modules/k3s-apps/monitoring.tf`는 `kube-prometheus-stack` 기반의 Prometheus, Grafana,
Prometheus Operator와 Grafana dashboard sidecar를 제공합니다. `argocd/apps/monitoring-config.yaml`은
`monitoring_personal` 저장소를 Argo CD 애플리케이션 `monitoring-config`에 연결하고 자동 sync,
prune, self-heal을 적용합니다.

exporter, `ServiceMonitor`, alert/rule, Grafana datasource/dashboard ConfigMap의 소스 정본은
`monitoring_personal`입니다. 변경 흐름은 `monitoring_personal`에서 Kustomize·테스트 검증과
commit/push → Argo CD의 새 revision `Synced/Healthy` → Kubernetes 리소스와 Prometheus 쿼리 →
Grafana sidecar reload 및 실제 패널 확인입니다. Docker/Compose는 이 운영 경로에 사용하지 않습니다.

시스템 레이어의 OpenClaw 에러 로그 수는 Monitoring 저장소의 기존 dispatcher exporter가
`oracle-arm-2`의 `/home/ubuntu/.openclaw/logs`를 읽기 전용으로 집계합니다. 최근 24시간
ERROR·FATAL 건수만 Prometheus로 수집하며, 원문을 전송하지 않습니다. 소스·배포·검증·복구 계약은
[Monitoring DEPLOYMENT.md](https://github.com/shdkej/monitoring_personal/blob/master/docs/DEPLOYMENT.md#openclaw-에러-로그-수)가 소유합니다.


## cloud
- digitalocean
- ~~aws free tier (expired)~~
- cloudflare (dns)
- oracle

## service
use exist component. for more configuration. add in specific directory.
- monitoring
- logging
- vault (secret)
- wiki (every resource come to here)
- chaos
- istio
- argocd

## 기존 Kubernetes 사용법
first deploy
```
cp base <service>
vi <service>/values.yml
git add .
git commit -am "feat: add service"
git push
```
default deployment is canary.
when you want to deploy directly, comment `skip`

automatically sync with repository

## Node 설정

### oracle-amd-1
- taint: `workload=lightweight:NoSchedule`
- 가벼운 앱만 명시적으로 배포
- 배포 시 아래 설정 추가:
```yaml
tolerations:
  - key: "workload"
    operator: "Equal"
    value: "lightweight"
    effect: "NoSchedule"
nodeSelector:
  kubernetes.io/hostname: oracle-amd-1
```

### oracle-arm-1, oracle-arm-2
- 기본 워크로드 노드 (별도 taint 없음)
- oracle-arm-2: control-plane

## TODO
- [ ] apply terraform when *.tf file change
- [ ] sync kubernetes configuration when *.yml file change
- [ ] canary deployment
- [ ] skip deployment
- [ ] sync another repository

### S3 사용량·요금 및 OpenClaw 에러 내용

Monitoring의 YACE ConfigMap이 5개 사용 리전의 S3 일간 저장량·객체 수와 us-east-1의
AWS/Billing S3 예상 월 누적 요금을 수집합니다. 신규 유료 S3 요청 메트릭은 활성화하지 않습니다.
OpenClaw 상세는 기존 exporter의 내부 JSON API를 Grafana Infinity 4.1.8 플러그인으로 읽습니다.
플러그인 선언은 `modules/k3s-apps/monitoring.tf`이며 수집·패널·복구 정본은
[Monitoring DEPLOYMENT.md](https://github.com/shdkej/monitoring_personal/blob/master/docs/DEPLOYMENT.md)입니다.
현재 운영의 다른 Helm 설정을 바꾸지 않도록 Grafana ConfigMap `plugins`에 해당 플러그인만
추가했습니다. 운영 중인 Grafana에는 관리자 플러그인 설치 API로 즉시 로드하고 datasource를
reload해 재시작 없이 반영했습니다. 이후 재시작과 Helm apply도 위 선언으로 동일 플러그인을 유지합니다.

### 시장 검색 추이

비즈니스 레이어의 ARPPU 패널은 네이버 데이터랩의 5개 주제별 최근 완료 52주 검색 추이로
교체했습니다. 소스는 Monitoring의 `posthog-exporter/market-trends.js`이며 기존 exporter와
Infinity 내부 datasource를 재사용합니다. 인증은 `monitoring/market-trends-naver` Secret으로
주입합니다. 새 대시보드·외부 엔드포인트·플러그인은 만들지 않습니다. Kustomize·테스트 →
Argo CD revision·exporter rollout → JSON/Grafana 실제 차트 순으로 검증합니다. 수집 주기·
누락값·복구·2027-06-30 레거시 API 종료 대응은
[Monitoring 운영 계약](https://github.com/shdkej/monitoring_personal/blob/master/docs/DEPLOYMENT.md#시장-검색-추이)이 정본입니다.

네이버 인증정보의 수집·표시 경계, 실제 누출 대조 범위와 남은 공통 보안 설정은
[Monitoring 인증정보 보호 계약](https://github.com/shdkej/monitoring_personal/blob/master/docs/DEPLOYMENT.md#인증정보-보호와-점검-범위)을 따릅니다.

### 시계열 보관·기간 집계

현재 Space의 `modules/k3s-apps/monitoring.tf`와 live Prometheus는 보관 3일·emptyDir입니다.
장기 주간·월간 추이 보관을 제공하지 않으며 Pod 교체 전에 기존 기록 보존을 확인해야 합니다.
PostHog의 완료 일간 7개·주간 4개·월간 2개는 과거 원천을 다시 조회한 집계이며, Prometheus에
그 기간 전체가 보관됐다는 뜻은 아닙니다. 현재 패널의 집계 기간·미연결 항목·실제 검증 방법은
[Monitoring 기간 수집 계약](https://github.com/shdkej/monitoring_personal/blob/master/docs/DEPLOYMENT.md#시계열-보관과-기간-집계)이 정본입니다.
2026-11-27 점검에서는 보관·스토리지·수집·대시보드 설정을 변경하지 않았습니다.

### 노드 헬스체크 표시

시스템 레이어의 기존 6번 패널은 노드별 수집 상태 타일을 표시합니다. Monitoring의
`layer-system.json`이 정본이며 기존 `monitoring-config` Argo CD와 Grafana sidecar로 반영합니다.
노드 이름·정상/실패/미수집 판정과 데스크톱·모바일 검증 기준은
[Monitoring 노드 헬스체크 계약](https://github.com/shdkej/monitoring_personal/blob/master/docs/DEPLOYMENT.md#노드-헬스체크-표시)을 따릅니다.
Prometheus의 AMD 이전과 스토리지 확장은 사용자 요청으로 보류했습니다. 이 표시 변경은
Helm·수집기·노드 배치·보관 기간을 바꾸지 않습니다.
