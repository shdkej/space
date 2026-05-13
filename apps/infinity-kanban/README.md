# infinity-kanban

Infinity Intent/Gate 상태를 칸반으로 시각화하는 경량 대시보드.

## 구성
- `configmap.yaml` — `index.html` (정적 HTML + JS, 외부 빌드 단계 없음)
- `deployment.yaml` — `nginx:alpine` 1 replica, ConfigMap을 `/usr/share/nginx/html/index.html`로 마운트
- `service.yaml` — ClusterIP, 80 포트
- `ingress.yaml` — `infinity.oracle.shdkej.com`, cert-manager TLS

## 동작
브라우저가 GitHub raw URL에서 `INTENTS.md`, `GATES.md` 를 직접 fetch 하여 칸반으로 렌더링.
서버 측 캐시/빌드 없음. 새로 푸시한 변경은 GitHub raw 캐시(수 분) 후 반영.

## 배포
`argocd/apps/infinity-kanban.yaml` ArgoCD Application이 본 디렉터리를 가리킨다.
ArgoCD auto sync (prune + selfHeal) 활성화.

## 변경 시
`index.html` 만 수정 → 본 디렉터리의 ConfigMap 갱신 → ArgoCD 가 자동 sync.
Deployment 가 ConfigMap 변경을 자동 감지하지 못할 수 있으므로 필요 시
`kubectl rollout restart deployment/infinity-kanban -n default` 로 강제 재시작.
