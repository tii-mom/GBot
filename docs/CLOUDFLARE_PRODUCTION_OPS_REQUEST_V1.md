# Cloudflare Production Ops Request V1

> Status: production KV/D1 provisioning resolved. This document does not authorize deploy, production D1 apply, secret mutation, Telegram mutation, executor enablement, signing, or broadcasting.

## Required Ops Inputs

### Production Queue

- Expected name: `growthbot-jobs-prod`
- Status: OPEN
- Required Worker binding: `JOBS`
- Purpose: production API Worker queue producer/consumer binding.
- Current blocker: authorized production Worker deploy failed because this Queue does not exist in Cloudflare.
- Requirement: must be a dedicated production Queue and must not reuse dev/staging queues.

Do not:

- Do not reuse `growthbot-jobs-dev`.
- Do not reuse `growthbot-jobs-staging`.
- Do not guess or silently rename the production queue binding.

### Production KV Namespace

- Expected name: `GROWTHBOT_KV_PROD`
- Status: RESOLVED
- Required Worker binding: `KV`
- Namespace id: `e69eeda286b84f448b69e9cba59dd96b`
- Purpose: production API Worker session/cache/runtime support.
- Requirement: must be a dedicated production KV namespace.

Do not:

- Do not reuse `worker-growthbot-kv-dev`.
- Do not reuse `worker-growthbot-kv-staging`.
- Do not use `growthbot-api-KV_preview`.
- Do not use unknown or unrelated namespaces.
- Do not guess the namespace ID.

### Production D1 Database

- Status: RESOLVED
- Expected name: `growthbot-staging`
- Required Worker binding: `DB`
- Database id: `e33c3b88-0874-4316-ba6e-793f040f3edb`
- Production authority confirmation: confirmed for current GBot production deployment.

Historical naming note:

- `growthbot-staging` is intentionally confirmed as the production D1 authority for the current GBot deployment despite the historical name.
- Reason: existing production Worker config, environment isolation docs, verifier checks, Cloudflare D1 list, and production `/health` all point to this D1 as the current production authority.

### Production Worker Target

- Worker name: `growthbot-api-prod`
- Route/domain: `api.gb8.top`
- URL: `https://api.gb8.top`
- Environment: `production`

### Isolation Confirmation

Ops must confirm:

- Dev, staging, and production KV namespaces are isolated.
- Dev, staging, and production D1 targets are isolated or explicitly documented if a historical production authority is intentionally reused.
- Production Worker uses only production-approved resources.
- Production deploy is not attempted until the production KV and D1 target are confirmed.

## Required Follow-up After Ops Provides Values

1. Provision `growthbot-jobs-prod`.
2. Run `npm run verify:cloudflare-deploy-ready`.
3. Open a separate authorized deploy task before any production Worker deploy.
4. Run post-deploy API/Admin/Mini App/Telegram smoke only after authorized deploy.
5. Keep production D1 apply separate and manually approved if needed.

## Current Launch Status

- Production KV: resolved.
- Production D1: resolved.
- Production Worker deploy: attempted but blocked by missing production Queue.
- Production D1 apply: not authorized and not executed.
- Launch recommendation: NO-GO / DEPLOYMENT_BLOCKED.

## Safety Boundary

- No deploy.
- No production D1 apply.
- No queue name guessing or dev/staging queue reuse.
- No KV ID guessing.
- No dev/staging KV reuse for production.
- No secret or token output.
- No executor enablement.
- No signing or broadcasting.
- No private key, seed phrase, or mnemonic handling.
- No custody.
- No Agent control of a user main wallet.
