# Netfilter persistence의 nfacct 부팅 의존성

이 절차는 `oracle-arm-2`의 SAM-10 복구를 소유한다. 파일은 Space에서 관리하며
설치 대상은 호스트의 `/usr/local/libexec/`와 systemd drop-in이다. Terraform이나
`common-setup.sh`를 실행하지 않는다. 이 변경은 기존 저장 방화벽 규칙을 보존하고
그 규칙이 참조하는 kube-proxy 패킷 계수 객체 두 개만 부팅 전에 준비한다.

## 확인한 원인

2026-11-27 조사에서 `/var/log/syslog.3.gz`의 11-06 기록을 회수했다.
IPv4 line 81과 IPv6 line 41의 `KUBE-FORWARD` 규칙을 추가할 때 `ENOENT`가 발생해
두 플러그인이 exit 4로 종료했다. `/var/log/syslog.4.gz`에도 같은 과거 실패가 있다.
현재 journal에는 해당 기록이 없어 journal 조회만으로 원인을 판정할 수 없었다.

2026-02-07 저장본은 Kubernetes 동적 규칙과 `nfacct` 참조를 함께 담고 있다.
`ct_state_invalid_dropped_pkts`, `localhost_nps_accepted_pkts` 객체는 kube-proxy가
나중에 만들지만 `netfilter-persistent`는 네트워크 초기화 전에 실행된다.
격리된 빈 network namespace에서 원본 저장본을 복원하면 두 오류가 같은 행에서
exit 4로 재현된다. 객체를 먼저 만든 뒤에는 **원본 그대로** IPv4·IPv6 전체 복원이
성공하며 체인, 기본 정책, 각 체인의 규칙과 순서도 동일하다.

`iptables-restore --test`는 commit을 하지 않아 이 의존성 오류를 발견하지 못했다.
운영 중에는 객체가 이미 있어 해당 테스트가 통과해도 부팅 복구의 증거가 아니다.
참고: [iptables-restore 매뉴얼](https://manpages.debian.org/bookworm/iptables/iptables-restore.8.en.html),
[Linux nfacct 객체 조회](https://github.com/torvalds/linux/blob/master/net/netfilter/xt_nfacct.c),
[kube-proxy의 객체 준비](https://github.com/kubernetes/kubernetes/blob/v1.34.1/pkg/proxy/util/nfacct/nfacct_linux.go).

## 구성과 실행 경계

- `prepare-netfilter-nfacct.py`: Python 표준 라이브러리의 Netfilter netlink API를 사용한다.
  기본/`--check`는 GET 전용이다. `--ensure`는 저장본에서 발견한 허용 객체만 만들고,
  기존 객체·계수·방화벽 규칙을 바꾸지 않는다. 생성은 exclusive이며 동시 생성도
  재조회로 확인한다. 알 수 없는 이름이나 quota 객체는 실패로 돌려 수동 검토한다.
- `netfilter-persistent-nfacct.conf`: 원래 `ExecStart` 앞에 객체 준비만 추가한다.
  패키지의 플러그인·`ExecStart`·`ExecStop`·서비스 활성화 여부는 유지한다.
- `test_prepare_netfilter_nfacct.py`: 매 사례마다 새로운 network namespace를 만들고
  host namespace와 다름을 확인한다. 실제 restore는 그 안에서만 실행하며,
  modprobe는 `/bin/false`로 지정한다. 호스트 IPv4/IPv6 정책 fingerprint를 전후 대조한다.
  패킷/바이트 카운터와 생성 시각은 변동값이므로 정책 fingerprint에서 제외한다.

저장된 Kubernetes 규칙은 현재 운영 규칙과 다르다. **운영 중 서비스 start/restart,
restore, flush, save 또는 기존 `common-setup.sh`를 실행하지 않는다.** 이 수정은
과거 저장본을 최신 클러스터 정책으로 승인하거나 재저장하는 절차가 아니다.

## 검증과 설치

Space 루트에서 실행한다. 검사에는 root와 network namespace 생성 권한이 필요하다.
테스트는 host 정책을 바꾸지 않으며 임시 namespace는 프로세스 종료 때 소멸한다.

```sh
sudo python3 modules/k3s-cluster/scripts/test_prepare_netfilter_nfacct.py
sudo python3 modules/k3s-cluster/scripts/prepare-netfilter-nfacct.py --check
git diff --check -- modules/k3s-cluster/scripts
```

실제 설치 전에는 대상 두 파일의 존재·기존 내용과 정책 fingerprint를 확인하고,
기존 파일이 있으면 별도로 백업·비교한다. 이번 신규 설치는 다음 두 파일만 추가한다.

```sh
sudo install -d -m 0755 /usr/local/libexec
sudo install -d -m 0755 /etc/systemd/system/netfilter-persistent.service.d
sudo install -m 0755 modules/k3s-cluster/scripts/prepare-netfilter-nfacct.py /usr/local/libexec/prepare-netfilter-nfacct.py
sudo install -m 0644 modules/k3s-cluster/scripts/netfilter-persistent-nfacct.conf /etc/systemd/system/netfilter-persistent.service.d/nfacct.conf
sudo systemctl daemon-reload
sudo python3 /usr/local/libexec/prepare-netfilter-nfacct.py --check
systemctl show netfilter-persistent.service -p ExecStartPre -p ExecStart -p NeedDaemonReload -p ActiveState -p Result
```

설치본과 정본 SHA-256 일치, 저장본의 hash 불변, host 정책 fingerprint 전후 일치를
확인한다. `systemd-analyze verify netfilter-persistent.service`도 실행한다.
서비스를 다시 실행하지 않으므로 기존 failed 상태가 자동으로 active가 되지 않는다.
실패 증거를 보존한 뒤 `systemctl reset-failed netfilter-persistent.service`를 실행하면
과거 failed 표시는 해제되지만 상태는 `inactive`다. 이를 서비스 실행 성공으로
보고하지 않는다. 실제 부팅 전체와 다음 부팅의 service 성공은 별도 검증이다.

## 복구

새로 설치한 두 파일만 제거하고 `systemctl daemon-reload`한다. 기존 파일을 교체한
경우에는 사전 백업을 되돌린다. 서비스 재시작, rules 복원 또는 nfacct 객체 삭제를
롤백에 포함하지 않는다. helper가 만든 객체도 kube-proxy가 사용할 수 있으므로
운영 중 지우지 않는다. 기존 규칙·통신·패킷 계수는 유지된다.

## 2026-11-27 검증 기록

- 수정 전: 분리 namespace에서 원본 IPv4/IPv6 restore가 각각 exit 4로 실패했다.
- 수정 후: 네 가지 격리 회귀가 통과했다. 전체 정책 동등성, 계수가 0보다 큰 기존
  객체의 재실행 보존, `--check` 무쓰기, 미지원 객체 거부를 확인했다.
- host preflight: 필요 2개, 기존 2개, 생성 0개, 누락 0개였다.
- 저장본 SHA-256: v4 `c933cbbe5346c951fdc565a27f688811d532ed25c90d5bbee594412e2f29ea19`,
  v6 `4702237900b1980b953502ae50113bcfa8d32b6411d74fd433f815a42b7f986e`.
- 실제 설치: helper와 drop-in 두 파일을 새로 설치하고 `daemon-reload`했다.
  설치본과 소스 SHA-256, 원래 `ExecStart`/`ExecStop`·enabled 상태 보존을 확인했고
  `systemd-analyze verify`는 exit 0, `NeedDaemonReload=no`였다.
  같은 실행 구간의 IPv4/IPv6 host 정책 fingerprint와 두 저장본 hash가 모두 일치했다.
- 실패 증거를 보존한 뒤 대상 unit만 `reset-failed`했다. 현재 상태는
  **inactive/dead, Result=success**이며 서비스를 실행한 결과는 아니다.
  `ExecMainStatus=4`는 과거 실행 필드로 남아 있으므로 현재 `ActiveState`와 구분한다.
  실제 호스트의 서비스 재실행·재부팅 검증은 수행하지 않았다.
- 설치 영수증: `/var/backups/netfilter-persistent-sam10-20261127/receipt.json`
  (root 전용 디렉터리 0700, 파일 0600). 이전 상태, 변경 파일과 hash, 전후 정책 hash,
  원본 저장본 hash, preflight와 unit 검증 결과를 담으며 방화벽 규칙 원문은 넣지 않았다.
- Context Pack: Knowledge Lab
  `logs/context-packs/2026-11-27-watcher-in-progress-remediation.json`.
