# Cloudflare Production Provisioning Inventory V1

> Status: production KV/D1 binding finalized. No deploy, production D1 apply, secret mutation, Telegram mutation, executor enablement, signing, or broadcasting was performed.

## Scope

This inventory records the current repository configuration and read-only Cloudflare resource scan for the production Worker deploy gate.

## Expected Production Target

- Worker name expected: `growthbot-api-prod`
- Production domain expected: `https://api.gb8.top`
- Production route expected: `api.gb8.top`
- Production KV expected: `GROWTHBOT_KV_PROD`
- Production KV binding expected: `KV`
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
- Other namespaces were present but did not clearly match GrowthBot production semantics.

Production KV conclusion:

- Production KV status: CONFIRMED.
- Namespace name: `GROWTHBOT_KV_PROD`.
- Namespace id: `e69eeda286b84f448b69e9cba59dd96b`.
- Binding: `KV`.
- Confirmed by: Codex using user authorization plus Cloudflare resource creation output and read-only cross-check.
- Confirmed at: `2026-06-28T12:00:00+08:00`.
- Confirmation source: user request / Cloudflare resource creation output / Cloudflare read-only cross-check.
- Dev/staging KV is not reused for production.

D1 databases observed:

- `growthbot-dev` / `7f4cb622-f66d-4c46-83b1-1dec14f3df13`
- `growthbot-staging` / `e33c3b88-0874-4316-ba6e-793f040f3edb`
- No clearly named `growthbot-prod` or `growthbot-production` D1 was found.
- Other D1 databases were present but did not clearly match GBot production semantics.

Production D1 conclusion:

- Production D1 status: CONFIRMED.
- Database name: `growthbot-staging`.
- Database id: `e33c3b88-0874-4316-ba6e-793f040f3edb`.
- Binding: `DB`.
- Confirmed by: Codex using repository production config, existing environment isolation docs, verifier checks, Cloudflare read-only D1 list, and production `/health` response.
- Confirmed at: `2026-06-28T12:00:00+08:00`.
- `growthbot-staging` is intentionally confirmed as the production D1 authority for the current GBot deployment despite the historical name.
- Reason: the existing production Worker configuration, launch readiness docs, and Cloudflare environment isolation verifier all point to `growthbot-staging` / `e33c3b88-0874-4316-ba6e-793f040f3edb` as the factual production D1 authority; Cloudflare read-only D1 list confirms it exists; production `/health` reports `env: production` and `d1: true`.

## Missing Items

- Post-deploy smoke evidence for `/admin/real-asset/*`.

## Unsafe Placeholders

- Staging D1 ID: `00000000-0000-4000-8000-000000000001`
- Staging KV ID: `00000000000000000000000000000001`
- Production placeholders: resolved.

## Deploy Allowed

Deploy allowed: YES, after separate explicit production Worker deploy authorization.

Why:

- Production KV is confirmed.
- Production D1 authority is confirmed.
- Production provisioning state is `ready`.
- This inventory does not itself authorize deployment.

## Safety Confirmation

- No deploy was executed.
- No production D1 apply was executed.
- Production KV namespace `GROWTHBOT_KV_PROD` was created as the dedicated production KV namespace.
- No secret or token value was printed or recorded.
- No Telegram config was changed.
- No executor, testnet executor, or live executor was enabled.
- No signing or broadcasting occurred.
- No private key, seed phrase, or mnemonic was handled.
- No custody or user main-wallet control was introduced.
