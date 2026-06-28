# Launch Readiness Report 2026-06-27

> Status: authorized production Worker deploy executed and unauthenticated online smoke rerun. Recommendation: NO-GO for full launch; CONDITIONAL GO only for authenticated follow-up smoke.

## 1. Release Candidate Commit

- Production runtime compatibility branch: `codex/production-r2-blocker-fix-v1`
- Base merge commit before runtime compatibility patch: `0aed3435bf6984c5bfcaf6fb0920467274c219a6`
- Latest authorized production Worker version: `a0190651-44b0-4deb-8ebf-ca26619cc4e1`
- Report update time: `2026-06-28T15:50:00+08:00`
- Operator: Codex

## 2. Validation Result Summary

| Command | Result | Notes |
| --- | --- | --- |
| `npm run typecheck` | PASS | All workspaces passed. |
| `npm run build` | PASS | Admin and Mini App production builds completed. |
| `npm run verify:launch-readiness-v1` | PASS | Launch readiness verifier passed. |
| `npm run verify:launch-readiness-report-v1` | PASS | Launch readiness execution report verifier passed. |
| `npm run verify:production-d1-smoke-readiness-v1` | PASS | 0017 migration hash unchanged. |
| `npm run verify:cloudflare-environment-isolation` | PASS | Production resource isolation remained intact. |
| `npm run verify:cloudflare-deploy-ready` | PASS | Production Worker deploy preflight passed. |
| `npm run verify:production-runtime-compat-v1` | PASS | Partial-production-schema runtime compatibility guard passed. |

Full local validation result: PASS.

## 3. Production D1 Migration Preflight Result

Preflight result: BLOCKED.

Technical checks:

- `apps/api-worker/migrations/0017_real_asset_agent_persistence_v1.sql` exists: PASS.
- `migrations/0017_real_asset_agent_persistence_v1.sql` exists: PASS.
- Root/app migration hashes match: PASS.
- Migration hash: `065dbc24dc4d257adf70e31074e685af0f184de79ff2f1b7e2738540282dee50`.
- Migration contains no private-key, seed-phrase, mnemonic, secret-key, or main-wallet private-key fields: PASS.
- Migration contains no destructive DDL/DML: PASS.
- Local SQLite dry-run apply for migrations `0001` through `0017`: PASS.

Cloudflare / D1 confirmation:

- `.env` exists: PASS.
- `CLOUDFLARE_ACCOUNT_ID` present: PASS.
- `CLOUDFLARE_API_TOKEN` present: PASS.
- Production D1 authority in config: `growthbot-staging` / `e33c3b88-0874-4316-ba6e-793f040f3edb`.
- Remote `d1_migrations` still record only `0001` through `0005`.
- Remote `skill_acquisition_rules` table existence: FAIL, count `0`.

Blocker: production D1 apply still requires explicit human confirmation because the production authority uses the historically named `growthbot-staging` database and no apply authorization / backup-export acceptance was granted in this thread.

Prepared command draft only, not executed:

```bash
npx wrangler d1 migrations apply growthbot-staging --remote --env production --config apps/api-worker/wrangler.jsonc
```

This command must not be run until the user explicitly authorizes production D1 apply and confirms Cloudflare account, D1 database name/id, environment, and backup/export acceptance.

## 4. Production D1 Apply Status

Production D1 apply status: NOT_APPLIED / BLOCKED.

- Explicit authorization to apply production migration: not provided.
- Exact production apply command executed: none.
- Backup/export acceptance: not provided.

## 4.1 Production Worker Deploy Preflight

Deploy preflight result: PASS.

Checks:

- Cloudflare auth available: PASS.
- Worker deploy script exists: PASS.
- Production route configured: PASS, `api.gb8.top`.
- Production Worker environment configured: PASS, `growthbot-api-prod`.
- Production `RESOURCE_PROVISIONING_STATE`: `ready`.
- Production KV namespace: CONFIRMED, `GROWTHBOT_KV_PROD` / `e69eeda286b84f448b69e9cba59dd96b`.
- Production Queue: CONFIRMED, `growthbot-jobs-prod` / `caa823d0b09e4191980b0898f320ce4e`.
- Production R2 bucket: CONFIRMED, `growthbot-assets-prod`.
- Production D1 authority: CONFIRMED, `growthbot-staging` / `e33c3b88-0874-4316-ba6e-793f040f3edb`.
- Real Asset Admin routes mounted in Worker entry: PASS.
- No executor-enable flags in deploy config: PASS.

Interpretation:

- Authorized production Worker deploy could proceed safely without D1 apply or config mutation.
- Remaining risk shifted from provisioning/deploy surface to production runtime schema compatibility.

## 4.2 Production Worker Deploy Execution

Deploy execution result: PASS.

- Exact command executed: `npm run deploy:api:prod`
- Deploy target Worker/environment: `growthbot-api-prod` / `production`
- Deploy target route/domain: `https://api.gb8.top`
- Deployed Worker version: `a0190651-44b0-4deb-8ebf-ca26619cc4e1`
- D1 apply executed during deploy: NO
- Cloudflare config mutation performed: NO
- Executor enablement performed: NO

## 5. API Smoke Result

API smoke result: PASS for unauthenticated critical surfaces.

| Endpoint | Expected | Actual | Result | Notes |
| --- | --- | --- | --- | --- |
| `GET https://api.gb8.top/health` | 200 with production health | 200, `{"ok":true,"env":"production","d1":true,"seeded":false}` | PASS | Health recovered after compatibility deploy. |
| `GET https://api.gb8.top/me` | No 5xx without Telegram init data | 401, `telegram_auth_required` | PASS | Auth precondition is explicit again. |
| `GET https://api.gb8.top/admin/real-asset/risk-console` | Reachable or auth-gated | 401, `admin_auth_required` | PASS | Route is mounted and no longer 404. |
| `GET https://api.gb8.top/admin/real-asset/review-queue` | Reachable or auth-gated | 401, `admin_auth_required` | PASS | Route is mounted and no longer 404. |
| `GET https://api.gb8.top/admin/real-asset/executor-readiness` | Reachable or auth-gated | 401, `admin_auth_required` | PASS | Route is mounted and no longer 404. |
| `GET https://api.gb8.top/admin/real-asset/tx-status-tracker` | Reachable or auth-gated | 401, `admin_auth_required` | PASS | Route is mounted and no longer 404. |
| `GET https://api.gb8.top/admin/real-asset/rollback-readiness` | Reachable or auth-gated | 401, `admin_auth_required` | PASS | Route is mounted and no longer 404. |

## 6. Mini App Smoke Result

Mini App smoke result: PARTIAL / BLOCKED_ON_AUTHENTICATED_FOLLOWUP.

- `https://app.gb8.top` HTTP entry was previously reachable.
- Production API bootstrap blocker is reduced from 500 to the explicit auth precondition `telegram_auth_required`.
- Authenticated Mini App path with valid Telegram init data was not rerun in this execution step.
- Skill/runtime authenticated surfaces may still encounter compatibility gating because remote D1 still lacks migration `0013` / `skill_acquisition_rules`.

## 7. Admin Smoke Result

Admin smoke result: PARTIAL / AUTH-GATED.

- `https://1989.gb8.top` remains reachable.
- Unauthenticated Real Asset Admin API surfaces are now confirmed mounted and auth-gated with `401 admin_auth_required`.
- Authenticated Admin session smoke was not performed in this execution step.
- Executor readiness response body was not inspected under auth, so field-level confirmation still requires authenticated smoke.

## 8. Telegram Smoke Result

Telegram smoke result: NEEDS_MANUAL_CHECK.

Automation could not directly verify `@G2047_bot` in Telegram.

Required manual checks:

- Bot opens Mini App.
- Mini App URL is `https://app.gb8.top`.
- Onboarding uses activation/start semantics.
- No claim / 领取 / airdrop promise appears.
- Valid Telegram init data reaches `GET /me`.

## 9. Safety Boundary Confirmation

- executorEnabled remains false: NOT VERIFIED via authenticated admin payload in this step, but no executor enablement action was performed.
- testnetExecutorEnabled remains false: NOT VERIFIED via authenticated admin payload in this step, but no executor enablement action was performed.
- liveExecutorEnabled remains false: NOT VERIFIED via authenticated admin payload in this step, but no executor enablement action was performed.
- No signing: PASS.
- No broadcasting: PASS.
- No private keys: PASS.
- No seed phrases: PASS.
- No mnemonics: PASS.
- No custody: PASS for executed actions.
- No main wallet control: PASS for executed actions.

## 10. Known Blockers

| Blocker | Severity | Owner | Required resolution | Status |
| --- | --- | --- | --- | --- |
| Production D1 target not explicitly approved for apply | P0 | Production operator | Confirm Cloudflare account, D1 database name/id, environment, and backup/export acceptance before any apply. | OPEN |
| Remote D1 lacks `skill_acquisition_rules` / migration `0013` | P0 | Engineering / production operator | Either keep runtime compatibility mode for unauthenticated surfaces only, or explicitly authorize and apply production D1 migrations before authenticated skill-catalog/runtime smoke. | OPEN |
| Authenticated Admin deep smoke not completed | P1 | Admin operator | Provide an authenticated Admin session or perform manual admin screenshots/checks. | OPEN |
| Authenticated Mini App / Telegram smoke not completed | P1 | Mini App / manual smoke operator | Complete Telegram-authenticated Mini App smoke and bot launch verification. | OPEN |

## 11. Go / No-Go Recommendation

Recommendation: NO-GO for full launch. CONDITIONAL GO FOR AUTHENTICATED SMOKE.

Rationale:

- Production Worker deploy succeeded.
- `/health` is back to `200`.
- `/me` is back to `401 telegram_auth_required` instead of `500`.
- Production Real Asset Admin endpoints are now mounted and auth-gated with `401` instead of `404`.
- Production D1 apply remains blocked and was not executed.
- Remote production D1 still lacks `skill_acquisition_rules`, so authenticated skill-catalog/runtime surfaces may still require migration `0013` or continued compatibility handling.
- Authenticated Admin, Mini App, and Telegram smoke have not been completed, so this is not a full launch-ready state.

Required next actions:

- Complete authenticated Admin smoke against `/admin/real-asset/*`.
- Complete Telegram-authenticated Mini App smoke for `GET /me`.
- Decide whether to keep partial-schema runtime compatibility as an interim state or explicitly authorize production D1 apply.
- If production D1 apply is desired, confirm account/D1/environment/backup acceptance first.

## 12. Operator Notes

- Authorized production Worker deploy executed successfully via `npm run deploy:api:prod`.
- Latest deployed Worker version: `a0190651-44b0-4deb-8ebf-ca26619cc4e1`.
- No production D1 apply was executed.
- No Cloudflare config was mutated with guessed IDs.
- No Telegram config was modified.
- No executor was enabled.
- No signing or broadcasting was performed.
- No private keys, seed phrases, or mnemonics were touched.
- `.ai-bridge/` was not staged or committed.
