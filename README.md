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

## TODO
- [ ] apply terraform when *.tf file change
- [ ] sync kubernetes configuration when *.yml file change
- [ ] canary deployment
- [ ] skip deployment
- [ ] sync another repository
