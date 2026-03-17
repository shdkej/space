# SPACE


어떤 클라우드이든지 상관 없이 내 인프라를 구축한다.

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

## Usage
just commit and push.
nothing to do.

## Deployment
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
