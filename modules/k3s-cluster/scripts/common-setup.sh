#!/bin/bash
set -euo pipefail

# =============================================================================
# 공통 노드 설정: swap off, iptables 해제, 커널 모듈, sysctl, 포트 DNAT
# 모든 K3S 노드(Server + Agent)에서 실행
# =============================================================================

echo ">>> [1/5] Swap 비활성화"
swapoff -a
sed -i '/swap/d' /etc/fstab

echo ">>> [2/5] 커널 모듈 로드"
cat > /etc/modules-load.d/k3s.conf <<EOF
br_netfilter
overlay
EOF
modprobe br_netfilter
modprobe overlay

echo ">>> [3/5] sysctl 네트워크 설정"
cat > /etc/sysctl.d/99-k3s.conf <<EOF
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sysctl --system

echo ">>> [4/5] iptables 기본 정책 ACCEPT로 설정"
# OCI Ubuntu는 기본적으로 iptables에 REJECT 규칙이 있으므로 제거
iptables -P INPUT ACCEPT
iptables -P FORWARD ACCEPT
iptables -P OUTPUT ACCEPT

# 기존 REJECT/DROP 규칙 제거 (INPUT, FORWARD 체인)
iptables -F INPUT 2>/dev/null || true
iptables -F FORWARD 2>/dev/null || true

# iptables-persistent가 있으면 저장, 없으면 설치
if command -v netfilter-persistent &> /dev/null; then
  netfilter-persistent save
elif [ -f /etc/iptables/rules.v4 ]; then
  iptables-save > /etc/iptables/rules.v4
else
  echo ">>> iptables-persistent 설치 중..."
  DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
  netfilter-persistent save
fi

echo ">>> [5/5] 포트 DNAT 설정 (80->30080, 443->30443)"
# 외부에서 80/443으로 들어오는 트래픽을 NodePort로 리다이렉트
# Pod CIDR(10.42.0.0/16)은 제외하여 Pod→외부 통신 보장
iptables -t nat -D PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 30080 2>/dev/null || true
iptables -t nat -D PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 30443 2>/dev/null || true

iptables -t nat -C PREROUTING -p tcp --dport 80 ! -s 10.42.0.0/16 -j REDIRECT --to-port 30080 2>/dev/null || \
  iptables -t nat -A PREROUTING -p tcp --dport 80 ! -s 10.42.0.0/16 -j REDIRECT --to-port 30080

iptables -t nat -C PREROUTING -p tcp --dport 443 ! -s 10.42.0.0/16 -j REDIRECT --to-port 30443 2>/dev/null || \
  iptables -t nat -A PREROUTING -p tcp --dport 443 ! -s 10.42.0.0/16 -j REDIRECT --to-port 30443

# NAT 규칙 저장
if command -v netfilter-persistent &> /dev/null; then
  netfilter-persistent save
else
  iptables-save > /etc/iptables/rules.v4
fi

echo ">>> 공통 설정 완료"
