# Cloudflare Environment Isolation Execution V1

Status: Draft configuration only. No Cloudflare resource, DNS, secret, Telegram, D1 or deployment mutation is included.

## Authority

Production keeps the factual D1 authority `growthbot-staging` (`e33c3b88-0874-4316-ba6e-793f040f3edb`). No data copy is required for the production side. A new isolated staging D1 must be provisioned before deployment.

## Target separation

- Production: `growthbot-api-prod`, `api.gb8.top`, factual production D1, dedicated production KV, `growthbot-jobs-prod`, `growthbot-assets-prod`, production-only Pages, bot and secrets.
- Staging: `growthbot-api-staging`, `staging-api.gb8.top`, new staging D1, dedicated staging KV, `growthbot-jobs-staging`, `growthbot-assets-staging`, staging-only Pages, bot and secrets.

The repository config intentionally contains non-live placeholder IDs for resources that do not yet exist. `RESOURCE_PROVISIONING_STATE=placeholder` is a deployment stop condition, not an instruction to create resources.

## Mandatory execution gates

1. Obtain explicit production change approval and a maintenance window.
2. Confirm Zone, DNS, custom-domain ownership and absence of route collision.
3. Create the isolated staging D1/KV/Queue/R2 and dedicated production KV/Queue/R2 through an approved infrastructure change.
4. Replace placeholder IDs, remove the placeholder state, and rerun `npm run verify:cloudflare-environment-isolation`.
5. Rotate and separate Worker, Pages and Telegram secrets; never compare or expose plaintext.
6. Configure production deployment with an explicit environment and protected manual approval.
7. Prove production test endpoints and Fake Provider paths reject requests.
8. Build production frontends only with `https://api.gb8.top`; build staging only with `https://staging-api.gb8.top`.
9. Run smoke tests in isolated staging before any production deployment.

## Prohibited in this PR

No resource creation, DNS change, deploy, remote migration apply, D1 write, secret mutation, webhook/menu mutation, queue/KV/R2 write, or production Gateway enablement.
