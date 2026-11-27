# Argo CD 운영

Space의 Kubernetes 배포 선언은 `apps/`, `helm_chart_base/`에 있고,
`argocd/apps/*.yaml`은 이를 연결하는 Application 정본입니다.
`modules/k3s-apps/argocd.tf`는 Helm 기반 Argo CD와 root Application을 소유합니다.
Monitoring의 설정은 별도 `monitoring_personal` 저장소가 소유합니다.

## Git checkout과 예제 경계

GitOps manifest는 정적 사이트의 `system-dashboard` Git submodule을 사용하지 않습니다.
repo-server는 `argocd-cmd-params-cm`의 `reposerver.enable.git.submodule: "false"`를
`ARGOCD_GIT_MODULES_ENABLED`로 읽습니다. Terraform의
`configs.params.reposerver\\.enable\\.git\\.submodule`이 이 값을 유지합니다.
비공개 submodule의 인증을 Argo CD에 추가하거나 저장소 공개 범위를 바꾸지 않습니다.
이 값은 repo-server 전체에 적용되므로 새 앱이 submodule을 요구하면 먼저 이 계약을 재검토합니다.

`apps/_template.yaml.example`은 복사 출발점입니다. `.example` 확장자가 없는 이전
`_template.yaml`은 `my-app`이라는 앱을 실제 배포하므로 사용하지 않습니다.
현재 Helm 공용 경로는 `helm_chart_base/`이며 `base/`는 존재하지 않습니다.

## 비교 오류 복구 순서

1. 현재 Application spec·sync policy와 해당 ConfigMap key의 존재 여부/값을 보관하고
   진행 중인 `.operation`이 없는지 확인합니다. Secret이나 전체 Pod spec을 보고서에 넣지 않습니다.
2. root를 먼저, 이어서 Space를 참조하는 자식 앱들의
   `spec.syncPolicy.automated.enabled`를 임시 `false`로 설정합니다. 원래
   `prune`·`selfHeal`과 enabled 필드의 부재 여부는 보존합니다.
   정상 `monitoring-config`는 이 조치 대상이 아닙니다.
3. 위 ConfigMap key만 `"false"`로 patch하고 repo-server Deployment만 재시작합니다.
   기존 자격증명·다른 Helm 설정·애플리케이션 워크로드는 수정하지 않습니다.
4. rollout 완료 후 각 앱을 hard refresh하여 `ComparisonError` 해소와 새 revision을 확인합니다.
   manifest diff와 prune 목록을 확인한 뒤에만 자동 동기화를 복원합니다.
5. `.example` 변경을 반영할 때 `my-app`의 resources·finalizers·진행 중 operation이 비어 있고
   연결된 workload/PVC가 없는지 다시 확인합니다. 예상 prune은 이 빈 Application 1개입니다.
   실제 workload 삭제가 나타나면 적용하지 않고 차이를 조사합니다.
6. 자식 앱부터 원래 sync policy로 복원하고 root를 마지막에 복원합니다.
   원래 enabled가 없었다면 임시 필드를 제거합니다. 모든 유효 앱의 `Synced/Healthy`,
   기존 Deployment의 Ready와 실제 서비스 응답을 확인합니다.

명령의 기준 kubeconfig는 운영 호스트의 `/etc/rancher/k3s/k3s.yaml`입니다.
적용 전 `kubectl patch --dry-run=server`로 단일 key 변경과 임시 정책을 검증합니다.
소스 검증은 `terraform fmt -check modules/k3s-apps/argocd.tf`, Application YAML 파싱,
원격 source path 존재 여부, `helm template` 출력과 live 선언 비교로 수행합니다.
광범위한 Terraform apply/Helm upgrade는 이 단일 설정 복구에 필요하지 않습니다.

복구 도중 실패하면 root/자식 자동 sync를 보류한 채 기존 ConfigMap key를 복원하고
repo-server를 다시 시작합니다. comparison의 예상 상태를 확인한 뒤 원래 sync policy를
복원합니다. 예제 앱 제거의 복구는 Git의 이전 예제 파일 또는 저장한 Application manifest로
가능하지만, 존재하지 않는 `base/` 참조 오류도 돌아온다는 점을 구분합니다.

## 오래된 종료 Pod 정리

`ContainerStatusUnknown`이라는 컨테이너 표시만으로 실행 중 Pod를 삭제하지 않습니다.
API의 Pod phase가 `Failed`이고 reason이 `Evicted`인 항목만 후보로 삼고, namespace/name/UID,
생성 시각, reason, 소유 ReplicaSet/Deployment, 대체 Pod Ready를 먼저 기록합니다.
현재 node pressure가 해소되고 소유 Deployment의 desired/ready/available이 일치해야 합니다.

삭제는 검토된 이름 목록의 Pod API 객체만 대상으로 하며 UID와 resourceVersion을 재검사합니다.
전체 namespace, ReplicaSet, Deployment, Job, PVC, PV, hostPath 데이터는 삭제하지 않습니다.
종료 Pod의 과거 실행 상태는 재생성할 수 없으므로 기록을 먼저 보존하고 범위가 승인됐을 때만
진행합니다. 정리 후 Failed Pod 수, Ready Deployment, 서비스 응답을 재확인합니다.
Pod 기록 정리는 디스크 압력 원인 개선과 별개이며 디스크 여유 문제를 해결했다고 보고하지 않습니다.

## 2026-11-27 SAM-14 조사 기준값

- Space 참조 6개 앱은 private `system-dashboard` submodule 인증 실패로 `Unknown/Healthy`.
  `monitoring-config`는 `Synced/Healthy`였습니다.
- 예제 `my-app`은 없는 `base/`를 참조하며 관리 리소스·finalizer가 없었습니다.
- Failed Pod 20개는 모두 `Evicted`; 7개는 8~9월, CMS의 나머지 13개는 10월 잔존 기록입니다.
  소유 Deployment는 모두 Ready였고 현재 세 노드의 Disk/Memory/PID pressure는 False였습니다.
- 위 기록은 적용 전 조사입니다. 소스 commit, 실제 적용·검증 결과와 남은 한계는 실행 기록에
  구분해서 남기며 이 조사만으로 복구 완료를 선언하지 않습니다.

공식 근거: [submodule 설정](https://argo-cd.readthedocs.io/en/stable/user-guide/private-repositories/#git-submodules),
[auto-sync enabled](https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/).
