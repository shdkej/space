#!/bin/bash
set -euo pipefail

# =============================================================================
# K3S Server 설치
# 환경변수: K3S_VERSION (선택), PUBLIC_IP (필수), PRIVATE_IP (필수)
# =============================================================================

PUBLIC_IP="${PUBLIC_IP:?PUBLIC_IP 환경변수가 필요합니다}"
PRIVATE_IP="${PRIVATE_IP:?PRIVATE_IP 환경변수가 필요합니다}"

echo ">>> K3S Server 설치 시작"
echo "    Public IP:  ${PUBLIC_IP}"
echo "    Private IP: ${PRIVATE_IP}"

# K3S 버전 설정
INSTALL_ARGS=""
if [ -n "${K3S_VERSION:-}" ]; then
  export INSTALL_K3S_VERSION="${K3S_VERSION}"
  echo "    Version: ${K3S_VERSION}"
fi

# K3S가 이미 설치되어 있는지 확인
if systemctl is-active --quiet k3s 2>/dev/null; then
  echo ">>> K3S Server가 이미 실행 중입니다. 건너뜁니다."
  exit 0
fi

# K3S Server 설치
# --disable traefik: Nginx Ingress를 대신 사용
# --disable servicelb: Cloud LB 미사용 (NodePort 직접 사용)
# --tls-san: 외부 IP로도 API 접근 가능하도록
# --node-external-ip: 외부 IP 명시
# --flannel-backend=vxlan: 기본 CNI
curl -sfL https://get.k3s.io | sh -s - server \
  --disable traefik \
  --disable servicelb \
  --tls-san "${PUBLIC_IP}" \
  --tls-san "${PRIVATE_IP}" \
  --node-external-ip "${PUBLIC_IP}" \
  --flannel-backend vxlan \
  --write-kubeconfig-mode 644

# 설치 확인
echo ">>> K3S Server 설치 확인 중..."
for i in $(seq 1 30); do
  if kubectl get nodes &>/dev/null; then
    echo ">>> K3S Server 정상 동작 확인"
    kubectl get nodes
    break
  fi
  echo "    대기 중... ($i/30)"
  sleep 5
done

echo ">>> K3S Server 설치 완료"
echo ">>> Node Token: $(cat /var/lib/rancher/k3s/server/node-token)"

# =============================================================================
# HA 전환 가이드 (참고용)
# =============================================================================
# HA 클러스터로 전환하려면:
#
# 1. 첫 번째 Server (이 스크립트를 아래처럼 수정):
#    curl -sfL https://get.k3s.io | sh -s - server \
#      --cluster-init \
#      --disable traefik \
#      --disable servicelb \
#      --tls-san "${PUBLIC_IP}" \
#      --node-external-ip "${PUBLIC_IP}" \
#      --flannel-backend vxlan
#
# 2. 추가 Server:
#    curl -sfL https://get.k3s.io | sh -s - server \
#      --server https://${FIRST_SERVER_IP}:6443 \
#      --token ${NODE_TOKEN} \
#      --disable traefik \
#      --disable servicelb \
#      --tls-san "${PUBLIC_IP}" \
#      --node-external-ip "${PUBLIC_IP}" \
#      --flannel-backend vxlan
#
# etcd 포트(2379-2380)는 이미 Security List에 오픈되어 있습니다.
# =============================================================================
