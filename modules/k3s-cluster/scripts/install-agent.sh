#!/bin/bash
set -euo pipefail

# =============================================================================
# K3S Agent 설치
# 환경변수: K3S_VERSION (선택), SERVER_IP (필수), NODE_TOKEN (필수)
# =============================================================================

SERVER_IP="${SERVER_IP:?SERVER_IP 환경변수가 필요합니다}"
NODE_TOKEN="${NODE_TOKEN:?NODE_TOKEN 환경변수가 필요합니다}"

echo ">>> K3S Agent 설치 시작"
echo "    Server IP: ${SERVER_IP}"

# K3S 버전 설정
if [ -n "${K3S_VERSION:-}" ]; then
  export INSTALL_K3S_VERSION="${K3S_VERSION}"
  echo "    Version: ${K3S_VERSION}"
fi

# K3S Agent가 이미 설치되어 있는지 확인
if systemctl is-active --quiet k3s-agent 2>/dev/null; then
  echo ">>> K3S Agent가 이미 실행 중입니다. 건너뜁니다."
  exit 0
fi

# K3S Agent 설치
curl -sfL https://get.k3s.io | K3S_URL="https://${SERVER_IP}:6443" K3S_TOKEN="${NODE_TOKEN}" sh -

# 설치 확인
echo ">>> K3S Agent 설치 확인 중..."
for i in $(seq 1 20); do
  if systemctl is-active --quiet k3s-agent; then
    echo ">>> K3S Agent 정상 동작 확인"
    break
  fi
  echo "    대기 중... ($i/20)"
  sleep 5
done

echo ">>> K3S Agent 설치 완료"
