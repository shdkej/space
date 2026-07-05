# AWS Static Sites

Terraform template for static pages on AWS.

Default targets:

- Status board: `status.aws.shdkej.com`
- Travel Ops board: `travel.aws.shdkej.com`
- Card News Library: `library.aws.shdkej.com`
- S3 region: `ap-northeast-2`
- ACM certificate region for CloudFront: `us-east-1`
- DNS: Route53 hosted zone `aws.shdkej.com`

## What It Creates

- Private S3 bucket
- CloudFront distribution
- CloudFront Origin Access Control (OAC)
- ACM DNS-validated certificate in `us-east-1`
- Route53 `A` and `AAAA` alias records
- Optional SPA fallback
- Optional `/api/*` style origin routing for API Gateway or Lambda Function URL
- Additional app subdomains through `sites/registry.json`

## Usage

```bash
cd infra-aws-static-sites
cp terraform.tfvars.example terraform.tfvars

terraform init
terraform plan
terraform apply
```

Static apps live under one path:

```text
infra-aws-static-sites/sites/<app>/dist/
```

The app registry lives at:

```text
infra-aws-static-sites/sites/registry.json
```

That registry is the source for Terraform app creation and the Status page's
`status.json` feed. Add new static pages there so they are not forgotten by
the Status board.

Deploy the status board manually:

```bash
python3 scripts/build-status-json.py --resolve-aws --check
# agents-live.json은 system-dashboard 수집기가 올리는 라이브 피드 — 배포가 지우면 안 된다
aws s3 sync sites/status/dist/ s3://static-status-aws-shdkej-com --delete \
  --exclude "agents-live.json"
aws cloudfront create-invalidation --distribution-id <status_distribution_id> --paths "/*"
```

Deploy the travel ops board:

```bash
aws s3 sync sites/travel/dist/ s3://static-travel-aws-shdkej-com --delete
aws cloudfront create-invalidation --distribution-id <travel_distribution_id> --paths "/*"
```

GitHub Actions automatically deploys changed app directories on pushes to
`main` or `master`:

- `app=status` uploads `infra-aws-static-sites/sites/status/dist/`
- `app=travel` uploads `infra-aws-static-sites/sites/travel/dist/`
- `app=library` uploads `infra-aws-static-sites/sites/library/dist/`
- `app=<new-app>` uploads `infra-aws-static-sites/sites/<new-app>/dist/`

The workflow derives the S3 bucket from the domain name, then finds the
CloudFront distribution by the domain alias. It does not assume a top-level
`dist/` folder unless `build_dir` is explicitly provided through manual
dispatch. When `app=status` deploys, the workflow rebuilds
`sites/status/dist/status.json` from `sites/registry.json`.

Adding a new app has two steps:

1. Add the app to `sites/registry.json` and run Terraform.

```json
{
  "app": "notes",
  "name": "Notes",
  "domain_name": "notes.aws.shdkej.com",
  "kind": "archive",
  "detail": "Static notes archive",
  "deployment_name": "notes",
  "spa_fallback": true
}
```

2. Add static files under `infra-aws-static-sites/sites/notes/dist/`, then push.
   The workflow detects `sites/notes/dist` and deploys
   `notes.aws.shdkej.com`.

Changing `sites/registry.json` also triggers a Status deploy, so the Status
page automatically picks up the new app launcher/check entry after the new
CloudFront distribution exists.

For a custom directory or custom domain, set `build_dir` or `domain_name` in
the workflow dispatch inputs.

For Lambda/API integration, put API Gateway or Lambda Function URL behind CloudFront by adding an entry to `api_origins`.
