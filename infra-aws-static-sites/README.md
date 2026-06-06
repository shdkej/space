# AWS Static Sites

Terraform template for static pages on AWS.

Default targets:

- Status board: `status.aws.shdkej.com`
- Travel Ops board: `travel.aws.shdkej.com`
- Card News Library: `card-news.aws.shdkej.com`
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
- Additional app subdomains through `app_sites`

## Usage

```bash
cd infra-aws-static-sites
cp terraform.tfvars.example terraform.tfvars

terraform init
terraform plan
terraform apply
```

Deploy the status board:

```bash
aws s3 sync status-dist/ s3://static-status-aws-shdkej-com --delete
aws cloudfront create-invalidation --distribution-id <status_distribution_id> --paths "/*"
```

Deploy the travel ops board:

```bash
aws s3 sync travel-dist/ s3://static-travel-aws-shdkej-com --delete
aws cloudfront create-invalidation --distribution-id <travel_distribution_id> --paths "/*"
```

GitHub Actions automatically deploys changed app directories on pushes to
`main` or `master`:

- `app=status` uploads `infra-aws-static-sites/status-dist/`
- `app=travel` uploads `infra-aws-static-sites/travel-dist/`
- `app=card-news` uploads `infra-aws-static-sites/card-news-dist/`
- `app=<new-app>` uploads `infra-aws-static-sites/<new-app>-dist/`

The workflow derives the S3 bucket from the domain name, then finds the
CloudFront distribution by the domain alias. It does not assume a top-level
`dist/` folder unless `build_dir` is explicitly provided through manual
dispatch.

Adding a new app has two steps:

1. Add the domain to `app_sites` and run Terraform.

```hcl
app_sites = {
  status = {
    domain_name = "status.aws.shdkej.com"
  }
  travel = {
    domain_name = "travel.aws.shdkej.com"
  }
  notes = {
    domain_name = "notes.aws.shdkej.com"
  }
}
```

2. Add static files under `infra-aws-static-sites/notes-dist/`, then push.
   The workflow detects `notes-dist` and deploys
   `notes.aws.shdkej.com`.

For a custom directory or custom domain, set `build_dir` or `domain_name` in
the workflow dispatch inputs.

For Lambda/API integration, put API Gateway or Lambda Function URL behind CloudFront by adding an entry to `api_origins`.
