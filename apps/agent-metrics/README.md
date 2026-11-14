# 에이전트 지표 지도 운영

운영 URL: `https://metrics.oracle.shdkej.com/`. 4개 조직층 × 각 8칸에서 기준·목적·측정 정의를 편집하고, 자연어 AI 제안과 연결한 데이터의 실측을 봅니다.

소스·테스트·Dockerfile·개발 방법은 비공개 독립 저장소 `shdkej/agent-metrics`와 `/home/ubuntu/workspace/apps/agent-metrics/README.md`가 소유합니다. Space는 이 폴더의 Deployment/Service/Ingress와 `argocd/apps/agent-metrics.yaml`만 소유합니다. 미게시 Sites 초안이나 Space 내부 소스 복사본은 배포에 사용하지 않습니다.

## 배포와 확인

1. 소스 테스트·브라우저 검증 후 main push. GitHub Actions가 source SHA의 arm64 이미지를 GHCR와 비공개 OCI artifact로 함께 만듭니다.
2. 이미지 빌드 성공과 SHA를 확인하고 소스의 `scripts/import-image.sh <Actions run ID> <source SHA>`를 실행합니다. 현재 클러스터에는 비공개 GHCR pull 자격증명이 없으므로, 인증된 Actions artifact의 **동일 이미지**를 oracle-arm-1의 containerd에 가져옵니다. 임시 importer Pod는 종료 후 삭제합니다. `IfNotPresent`이므로 노드 이미지가 제거되면 재가져오기가 필요합니다. 새로 빌드하거나 소스·이미지를 공개하지 않습니다.
3. `deployment.yaml`의 두 이미지 참조를 갱신합니다. 세 앱 manifest와 Argo Application을 `kubectl apply --dry-run=server`로 확인하고 Space main에 push합니다.
4. Argo sync가 정상이라면 해당 revision까지 기다립니다. 2026-11-14 현재 다른 비공개 서브모듈 system-dashboard의 인증 오류로 Space repo의 manifest 생성이 막혀 있습니다. 같은 원격 manifest만 대상으로 직접 apply하며 전역 Argo 설정은 바꾸지 않습니다.
5. rollout Ready, 실행 imageID, HTTPS 인증, `/api/health`의 source revision, 실제 브라우저 저장·재열기·AI 제안·수치 조회를 확인합니다. Pod 교체 후 SQLite 값 보존도 확인합니다.

첫 배포는 사용자의 “배포는 space에서 참고해서” 지시에 포함됩니다. 이후 배포도 해당 요청의 승인 범위를 확인합니다.

## 인증·데이터·복구

- `agent-metrics-basic-auth/auth`는 기존 Reel Room Basic Auth 해시를 복사한 별도 Secret입니다. 앱 서버에서 검증하고 nginx는 TLS·프록시를 담당합니다. nginx Basic Auth를 중복 설정하면 Authorization 헤더를 지우므로 이 앱의 Ingress에는 auth-type을 두지 않습니다. 미인증 화면·데이터 API는 401이며 `/api/health`는 상태·소스 revision만 공개합니다. 사용자명별 지도·연결·관측을 분리합니다. 기존 Reel Room Secret은 수정하지 않습니다. 비밀번호 변경은 두 앱의 별도 Secret에 각각 반영해야 합니다.
- `agent-metrics-env`에는 `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_WORKERS_AI_API_TOKEN`, `DATA_ENCRYPTION_KEY`만 보관합니다. 실제 값은 Git·브라우저·로그에 넣지 않습니다.
- 데이터는 oracle-arm-1 `/var/lib/agent-metrics`에 영구 저장합니다. Pod의 `/data`에 마운트하고 Node uid1000으로 실행합니다. 단일 Pod/Recreate 방식입니다.
- 백업은 SQLite `.backup`으로 일관된 DB를 만들고 암호화 키 Secret을 별도로 보존합니다. 실행 중인 SQLite 파일만 복사하지 않습니다. 자동 백업·장애 복제는 아직 없습니다.
- 되돌릴 때 직전 검증 image SHA의 OCI artifact를 가져온 후 Deployment의 이미지 두 곳을 되돌립니다. 데이터 볼륨과 Secret은 보존합니다. 최초 배포에는 이전 앱 revision이 없으므로 필요 시 replicas0으로 서비스만 중단합니다.
- 실제 Instagram 조회는 사용자가 프로페셔널 계정 ID·Insights 권한 토큰을 연결해야 합니다. 이번 배포에서는 실계정 조회를 검증하지 않았습니다. 수치는 버튼으로 조회하며 예약 수집은 없습니다.

## 검증 기록

초기 소스: `b19582f` (정확한 전체 SHA는 deployment.yaml). 테스트 16개, 실제 AI 응답, 320/390/768/1440px 화면, 수동 0·공개 JSON 실측·연결 중 초안 보존·동시 저장 충돌 복구를 사전 확인했습니다. 라이브 결과는 배포 후 아래에 추가합니다.
