# Cloudflare Production Provisioning Inventory V1

> Status: provisioning inventory only. No deploy, production D1 apply, Cloudflare mutation, secret mutation, Telegram mutation, executor enablement, signing, or broadcasting was performed.

## Scope

This inventory records the current repository configuration and read-only Cloudflare resource scan for the production Worker deploy gate.

## Expected Production Target

- Worker name expected: `growthbot-api-prod`
- Production domain expected: `https://api.gb8.top`
- Production route expected: `api.gb8.top`
- Production KV expected: `GROWTHBOT_KV_PROD`
- Production KV binding expected: `KV`
- Production D1 expected: unresolved; must be explicitly confirmed by ops as a production GBot D1 target.
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
- KV binding `KV`: `00000000000000000000000000000002`
- Queue: `growthbot-jobs-prod`
- R2 bucket: `growthbot-assets-prod`
- `RESOURCE_PROVISIONING_STATE`: `placeholder`

## Read-only Cloudflare Resource Scan

Cloudflare account was readable through `wrangler whoami`; no token or secret values are recorded here.

KV namespaces observed:

- `worker-growthbot-kv-dev` / `0d43333cd118451b8e9011311fdd12ba`
- `worker-growthbot-kv-staging` / `83901e31622b4ac79d77bbcc49c661cf`
- `growthbot-api-KV_preview` / `6f701299583a4a37b9af5eb3b7cbe9c9`
- Other namespaces were present but did not clearly match GrowthBot production semantics.

Production KV conclusion:

- `GROWTHBOT_KV_PROD` was not found.
- `growthbot-kv-prod` was not found.
- `growthbot-prod-kv` was not found.
- Dev/staging KV must not be reused for production.
- Unknown or unrelated KV namespaces must not be used.

D1 databases observed:

- `growthbot-dev` / `7f4cb622-f66d-4c46-83b1-1dec14f3df13`
- `growthbot-staging` / `e33c3b88-0874-4316-ba6e-793f040f3edb`
- No clearly named `growthbot-prod` or `growthbot-production` D1 was found.
- Other D1 databases were present but did not clearly match GBot production semantics.

Production D1 conclusion:

- The repository currently points production at `growthbot-staging`.
- Existing docs also mention this as historical/factual D1 authority, but the production deploy gate requires explicit ops confirmation before treating it as a production target.
- A clearly named production GBot D1 target was not found in the read-only scan.

## Missing Items

- Dedicated production KV namespace `GROWTHBOT_KV_PROD`.
- Explicit production D1 target confirmation.
- `RESOURCE_PROVISIONING_STATE=ready` after resources are confirmed.
- Post-deploy smoke evidence for `/admin/real-asset/*`.

## Unsafe Placeholders

- Staging D1 ID: `00000000-0000-4000-8000-000000000001`
- Staging KV ID: `00000000000000000000000000000001`
- Production KV ID: `00000000000000000000000000000002`
- Production `RESOURCE_PROVISIONING_STATE`: `placeholder`

## Deploy Allowed

Deploy allowed: NO.

Why:

- Production KV is unresolved.
- Production D1 target is unresolved / naming-ambiguous.
- Production provisioning state is still `placeholder`.
- Deploy readiness must remain blocked until ops supplies the production KV and confirms the production D1 target.

## Safety Confirmation

- No deploy was executed.
- No production D1 apply was executed.
- No Cloudflare resource was created or mutated.
- No secret or token value was printed or recorded.
- No Telegram config was changed.
- No executor, testnet executor, or live executor was enabled.
- No signing or broadcasting occurred.
- No private key, seed phrase, or mnemonic was handled.
- No custody or user main-wallet control was introduced.
