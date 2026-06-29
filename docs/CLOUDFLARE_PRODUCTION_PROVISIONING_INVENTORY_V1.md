# Cloudflare Production Provisioning Inventory V1

> Status: production KV/D1/Queue/R2 bindings finalized, production Worker deploy succeeded, and production D1 custom remediation completed. No secret mutation, Telegram mutation, executor enablement, signing, or broadcasting was performed.

## Scope

This inventory records the repository configuration, Cloudflare resource confirmation, production Worker deploy state, and D1 database remediation state.

## Expected Production Target

- Worker name expected: `growthbot-api-prod`
- Production domain expected: `https://api.gb8.top`
- Production route expected: `api.gb8.top`
- Production KV expected: `GROWTHBOT_KV_PROD`
- Production KV binding expected: `KV`
- Production Queue expected: `growthbot-jobs-prod`
- Production Queue binding expected: `JOBS`
- Production R2 expected: `growthbot-assets-prod`
- Production R2 binding expected: `ASSETS`
- Production D1 expected: `growthbot-staging` / `e33c3b88-0874-4316-ba6e-793f040f3edb`
- Production D1 binding expected: `DB`

## Current Wrangler Configuration

Config file:

- `apps/api-worker/wrangler.jsonc`

Top-level/default:

- Worker name: `growthbot-api`
- D1 binding `DB`: `growthbot-dev` / `7f4cb622-f66d-4c46-83b1-1dec14f3df13`
- KV binding `KV`: `0d43333cd118451b8e9011311fdd12ba`
- Queue: `growthbot-jobs-dev`
- R2 bucket: `growthbot-assets-dev`

Staging:

- Worker name: `growthbot-api-staging`
- Route: `staging-api.gb8.top`
- D1 binding `DB`: `growthbot-staging-isolated` / `00000000-0000-4000-8000-000000000001`
- KV binding `KV`: `00000000000000000000000000000001`
- Queue: `growthbot-jobs-staging`
- R2 bucket: `growthbot-assets-staging`
- `RESOURCE_PROVISIONING_STATE`: `placeholder`

Production:

- Worker name: `growthbot-api-prod`
- Route: `api.gb8.top`
- D1 binding `DB`: `growthbot-staging` / `e33c3b88-0874-4316-ba6e-793f040f3edb`
- KV binding `KV`: `e69eeda286b84f448b69e9cba59dd96b`
- Queue: `growthbot-jobs-prod`
- R2 bucket: `growthbot-assets-prod`
- `RESOURCE_PROVISIONING_STATE`: `ready`

## Read-only Cloudflare Resource Scan

Cloudflare account was readable through `wrangler whoami`; no token or secret values are recorded here.

KV namespaces observed:

- `worker-growthbot-kv-dev` / `0d43333cd118451b8e9011311fdd12ba`
- `worker-growthbot-kv-staging` / `83901e31622b4ac79d77bbcc49c661cf`
- `GROWTHBOT_KV_PROD` / `e69eeda286b84f448b69e9cba59dd96b`
- `growthbot-api-KV_preview` / `6f701299583a4a37b9af5eb3b7cbe9c9`

Production KV conclusion:

- Production KV status: CONFIRMED.
- Namespace name: `GROWTHBOT_KV_PROD`.
- Namespace id: `e69eeda286b84f448b69e9cba59dd96b`.
- Binding: `KV`.
- Dev/staging KV is not reused for production.

D1 databases observed:

- `growthbot-dev` / `7f4cb622-f66d-4c46-83b1-1dec14f3df13`
- `growthbot-staging` / `e33c3b88-0874-4316-ba6e-793f040f3edb`

Production D1 conclusion:

- Production D1 status: CONFIRMED.
- Database name: `growthbot-staging`.
- Database id: `e33c3b88-0874-4316-ba6e-793f040f3edb`.
- Binding: `DB`.
- `growthbot-staging` is confirmed as the production D1 authority for the current GBot deployment.

Queues observed:

- `growthbot-jobs-dev`
- `growthbot-jobs-prod`
- `growthbot-jobs-staging`

Production Queue conclusion:

- Production Queue status: CONFIRMED.
- Expected queue name: `growthbot-jobs-prod`.
- Binding: `JOBS`.
- Queue id: `caa823d0b09e4191980b0898f320ce4e`.

R2 buckets observed:

- `growthbot-assets-dev`
- `growthbot-assets-prod`
- `growthbot-assets-staging`

Production R2 conclusion:

- Production R2 status: CONFIRMED.
- Expected bucket name: `growthbot-assets-prod`.
- Binding: `ASSETS`.

## Deploy & Remediation State

- Production Worker deploy status: SUCCEEDED.
- Deployed Worker version: `b2543f9b-2f61-48d2-9454-04ec49e1a95e`
- Route active: `https://api.gb8.top`
- Production D1 Custom Remediation: **COMPLETED**
  - Schema remediation applied successfully.
  - History remediation applied successfully.
  - Remote migration max id: 17.
  - Active runtime specifications seeded: 31.

## Online Smoke Evidence

- `GET /health`: `200`
- `GET /me` without Telegram init data: `401 telegram_auth_required`
- `GET /admin/real-asset/risk-console` without admin auth: `401 admin_auth_required`
- `GET /admin/real-asset/review-queue` without admin auth: `401 admin_auth_required`
- `GET /admin/real-asset/executor-readiness` without admin auth: `401 admin_auth_required`

## Technical Gaps Status

- [x] Production D1 `d1_migrations` history mismatch resolved.
- [x] Production D1 `skill_acquisition_rules` created and fully seeded.
- [x] All 0012 to 0017 schema and index objects present.

## Safety Confirmation

- No Cloudflare config mutation with guessed IDs was performed.
- No Telegram config was changed.
- No executor, testnet executor, or live executor was enabled.
- No signing or broadcasting occurred.
- No private key, seed phrase, or mnemonic was handled.
- No custody or user main-wallet control was introduced.
