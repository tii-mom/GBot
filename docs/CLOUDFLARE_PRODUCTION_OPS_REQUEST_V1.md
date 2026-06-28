# Cloudflare Production Ops Request V1

> Status: provisioning phase resolved, custom D1 remediation completed, and production database fully patched. Deployed Worker version is stable at `b2543f9b-2f61-48d2-9454-04ec49e1a95e`.

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

- Status: RESOLVED and REMEDIATED
- Expected name: `growthbot-staging`
- Required Worker binding: `DB`
- Database id: `e33c3b88-0874-4316-ba6e-793f040f3edb`

### Production Worker Target

- Worker name: `growthbot-api-prod`
- Route/domain: `api.gb8.top`
- URL: `https://api.gb8.top`
- Environment: `production`
- Latest successful deployed version: `b2543f9b-2f61-48d2-9454-04ec49e1a95e`

## Current Follow-up Focus

All infrastructure, database schema divergence, and migration history tasks are completed:
- [x] Executed production D1 custom schema remediation.
- [x] Executed production D1 migration history reconciliation.
- [x] Verified D1 post-states (17 migrations recorded).
- [x] Verified authenticated API/Admin/Mini App smoke endpoints.

## Safety Boundary

- No secret or token output.
- No Telegram config mutation.
- No executor enablement.
- No signing or broadcasting occurred.
- No private key, seed phrase, or mnemonic handling.
- No custody.
- No Agent control of a user main wallet.
