# Cloudflare Production Ops Request V1

> Status: ops request only. This document does not authorize deploy, production D1 apply, Cloudflare mutation, secret mutation, Telegram mutation, executor enablement, signing, or broadcasting.

## Required Ops Inputs

### Production KV Namespace

- Expected name: `GROWTHBOT_KV_PROD`
- Required Worker binding: `KV`
- Purpose: production API Worker session/cache/runtime support.
- Requirement: must be a dedicated production KV namespace.

Do not:

- Do not reuse `worker-growthbot-kv-dev`.
- Do not reuse `worker-growthbot-kv-staging`.
- Do not use `growthbot-api-KV_preview`.
- Do not use unknown or unrelated namespaces.
- Do not guess the namespace ID.

### Production D1 Database

- Expected name: to be confirmed by ops as the production GBot D1 database.
- Required Worker binding: `DB`
- Required fields:
  - database name
  - database ID
  - confirmation that the target is production
  - confirmation that it is not dev/staging unless explicitly approved as the production authority

Current ambiguity:

- Repository production config currently points to `growthbot-staging` / `e33c3b88-0874-4316-ba6e-793f040f3edb`.
- This must not be treated as deploy-ready production D1 without explicit ops confirmation.

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

1. Update `apps/api-worker/wrangler.jsonc` production bindings with confirmed production IDs only.
2. Set `RESOURCE_PROVISIONING_STATE` to `ready` only after resource confirmation.
3. Run `npm run verify:cloudflare-deploy-ready`.
4. Keep `npm run verify:cloudflare-deploy-ready` BLOCKED if production KV or production D1 remains unresolved.
5. Open a separate authorized deploy task before any production Worker deploy.

## Current Launch Status

- Production KV: unresolved.
- Production D1: unresolved / requires explicit ops confirmation.
- Production Worker deploy: blocked.
- Production D1 apply: not authorized and not executed.
- Launch recommendation: NO-GO.

## Safety Boundary

- No deploy.
- No production D1 apply.
- No KV ID guessing.
- No dev/staging KV reuse for production.
- No secret or token output.
- No executor enablement.
- No signing or broadcasting.
- No private key, seed phrase, or mnemonic handling.
- No custody.
- No Agent control of a user main wallet.
