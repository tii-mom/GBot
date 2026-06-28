# Cloudflare Production Ops Request V1

> Status: provisioning phase resolved and archived. Production KV/D1/Queue/R2 are now present, and authorized production Worker deploy has succeeded. This document still does not authorize production D1 apply, secret mutation, Telegram mutation, executor enablement, signing, or broadcasting.

## Provisioning Outcome

### Production Queue

- Expected name: `growthbot-jobs-prod`
- Status: RESOLVED
- Required Worker binding: `JOBS`
- Queue id: `caa823d0b09e4191980b0898f320ce4e`

### Production R2 Bucket

- Expected name: `growthbot-assets-prod`
- Status: RESOLVED
- Required Worker binding: `ASSETS`

### Production KV Namespace

- Expected name: `GROWTHBOT_KV_PROD`
- Status: RESOLVED
- Required Worker binding: `KV`
- Namespace id: `e69eeda286b84f448b69e9cba59dd96b`

### Production D1 Database

- Status: RESOLVED for Worker binding
- Expected name: `growthbot-staging`
- Required Worker binding: `DB`
- Database id: `e33c3b88-0874-4316-ba6e-793f040f3edb`
- Historical naming note: `growthbot-staging` is intentionally confirmed as the current production D1 authority.

### Production Worker Target

- Worker name: `growthbot-api-prod`
- Route/domain: `api.gb8.top`
- URL: `https://api.gb8.top`
- Environment: `production`
- Latest successful deployed version: `a0190651-44b0-4deb-8ebf-ca26619cc4e1`

## Current Follow-up Focus

Cloudflare provisioning is no longer the active blocker. Remaining launch work is now:

1. Authenticated Admin smoke.
2. Telegram-authenticated Mini App smoke.
3. Production D1 migration authorization decision.
4. Authenticated skill/runtime surface validation while remote D1 still lacks migration `0013` / `skill_acquisition_rules`.

## Safety Boundary

- No production D1 apply.
- No secret or token output.
- No Telegram config mutation.
- No executor enablement.
- No signing or broadcasting.
- No private key, seed phrase, or mnemonic handling.
- No custody.
- No Agent control of a user main wallet.
