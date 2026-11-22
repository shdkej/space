# AWS Static Sites

Terraform template for static pages on AWS.

Default targets:

- Status board: `status.aws.shdkej.com`
- Travel Ops board: `travel.aws.shdkej.com`
- Card News Library: `library.aws.shdkej.com`
- 모두의정책 policy map: `policy.minimalcollector.com` ([source and deployment guide](sites/policycock/README.md))
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

The AWS provider constraint is 6.x, matching the existing state and the
6.72.0 provider used on 2026-11-14. Do not initialize this state with 5.x:
it cannot decode the newer state attributes. The canonical local state is
`/home/ubuntu/workspace/space/infra-aws-static-sites/terraform.tfstate`;
isolated checkouts must explicitly use it after initialization.

Review every planned change before applying. On 2026-11-14, even a new-app
target plan included deletion of the legacy `image-annotator` resources
because that module remains in state after its registry hosting changed.
That plan was not applied. Policycock was initialized with the shared module
in an isolated empty state, then its module address was merged into the
canonical state with all existing resource records preserved. See its
deployment guide for the initial creation and state transfer procedure.
Legacy state cleanup is separate from adding or publishing this site.

Static apps live under one path:

```text
infra-aws-static-sites/sites/<app>/dist/
```

The Card News Library also includes `composer.html`: a browser-only,
photo-first editor that keeps uploaded images local, places movable caption
layers on a 1080×1350 canvas, and exports both PNG and reusable layout JSON.

The Infinity dashboard applies cached Archive titles and summary fields before
each polling render. Existing Archive cards therefore retain their rendered
state; only a newly discovered record receives one follow-up update after its
canonical detail is fetched. A completed Intent may appear in the canonical
Archive ledger, a completion comment, and GATES, but the dashboard renders one
Archive card per Intent ID, preferring the canonical ledger record.

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

## Shared PostHog project

The image converter (`miniapp-image-tools`) and 모두의정책 (`policycock`) share the US Default project **424014** and the existing public ingestion key provisioned through `POSTHOG_MINIAPP_PROJECT_TOKEN`. Filter product metrics by `properties.app_id` and `properties.traffic_kind = 'user'`. Synthetic QA uses `?qa=1` and a per-page `qa_run_id`. Query credentials belong outside the browser. The release workflow renders the public key into each app's deployable artifact.

## Policycock launch signup

The independent service source, tests, zip packaging and manual OIDC release workflow live in the private [Policycock signup repository](https://github.com/shdkej/policycock-launch-signup). Its workflow pins a commit of this repository and invokes `scripts/deploy-policycock-signup.py --package <zip>`. The deployment role trusts the service repository's `main` branch. Its ARN and owner/sender address are secrets in that repository.

The CLI deployer owns the Seoul function `policycock-launch-signup`, its Function URL, log group with 14-day retention and the `policycock-launch-registrations` table. The existing execution role is `PolicycockSignupRuntime`. It deploys closed by default. Explicit mode open enables owner-only direct registration. Both modes verify the HTTPS response and CORS without sending email. Re-running the deployer checks the package hash and existing configuration. The shared feedback service and its Terraform table are separate.

Before opening the web form, set the verified URL from the service workflow output as the Space repository variable `POLICYCOCK_SIGNUP_URL`. Set `POLICYCOCK_SIGNUP_ENABLED=true` and redeploy the site only after the service is accepting registrations. Use `EXPECTED_SIGNUP_URL` with the live browser verifier to check the exact endpoint.

Launch registration uses v3 consent and sends the submitted address and receipt only to the verified operator mailbox. The database stores a normalized address hash, receipt, hashed capabilities, state and expiry. Per UTC day the service permits 300 new-registration mail attempts and 25 withdrawal mail attempts. Successful delivery also depends on the shared Seoul SES account quota over the preceding 24 hours. Withdrawal immediately removes the registration, even if operator notification is delayed. Mailbox and trash cleanup are performed manually. Before sending a one-time launch announcement by Gmail, look up the consistently read registration by the SHA-256 of the trimmed lowercase address and match its receipt, registered state and unexpired TTL. The private service README describes ambiguous SES sends, reconciliation, retry and deletion.

### Existing shared feedback implementation

`app-feedback` keeps its existing feedback flow. The new launch-notice route
uses a single DynamoDB item per normalized address with conditional state
transitions; withdrawal atomically deletes the item. The table stores the
address, opaque receipt, and numeric Unix-seconds TTL. Registration defaults
to closed. The requester receives the confirmation link. For registrations
that explicitly accept `launch-notice-v2`, confirmation sends the verified
address and receipt to the private Terraform input
`policycock_signup_owner_email`. Earlier consent versions retain receipt-only
notifications. Keep the designated operator mailbox in private variables.
The dashboard should use the currently confirmed database records when sending
the launch notice. Reconcile the mailbox against current receipts and verify
deletion from the mailbox (including trash) on withdrawal, expiry, or launch.

This v2 path belongs to the shared Lambda. Its Terraform switch is independent of the v3 dedicated service. Do not enable the shared signup route to release the dedicated form.

Run isolated local tests with `python -m venv <private-venv>`, install
`lambda/requirements-test.txt`, then run
`<private-venv>/bin/python -m unittest discover -s lambda -p test_app_feedback.py`.
Tests use Moto and fake SES; they do not access AWS credentials or send mail.

DynamoDB TTL is asynchronous and may delete items **days after** expiration.
The application rejects expired confirmation and replaces expired records on
re-request, but this alone does **not** prove physical removal by the promised
one-year deadline. Do not activate signup until an independently verified
retention/deletion mechanism and a launch-send-and-delete path are ready.
SES and DynamoDB cannot guarantee exactly-once owner notification together:
uncertain sends stay claimed for manual reconciliation rather than automatic
retries. Before any AWS apply, verify the canonical state and private vars,
obtain a least-privilege role, inspect the **whole** plan for out-of-scope
changes and removals, and review on-demand DynamoDB and SES costs. No root
credential is an approved deployment path.
