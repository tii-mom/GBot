# Launch Readiness Report 2026-06-27

> Status: executed preflight and online smoke report. Recommendation: NO-GO.

## 1. Release Candidate Commit

- Release candidate commit: `1024da7da9004ead1e321631bd7b83f1f54dca77`
- Branch: `codex/production-apply-smoke-execution-v1`
- PR list summary:
  - PR #28 merged to `main`: launch readiness gate and smoke copy.
  - PR #29 merged to `main`: production D1 migration apply plan, online smoke execution plan, launch readiness report template, and `verify:production-d1-smoke-readiness-v1`.
- Report time: `2026-06-27T14:18:43Z`
- Operator: Codex

## 2. Validation Result Summary

| Command | Result | Notes |
| --- | --- | --- |
| `npm run typecheck` | PASS | All workspaces passed. |
| `npm run build` | PASS | Admin and Mini App production builds completed. |
| `npm run verify:static-v1` | PASS | Migration sync passed; expected negative SQLite constraint checks were part of verifier output. |
| `npm run verify:work-report` | PASS | Work Report contract and UI checks passed. |
| `npm run verify:real-asset-agent-v1` | PASS | 31 canonical skill cards verified. |
| `npm run verify:real-asset-db-persistence-v1` | PASS | 12 Real Asset persistence tables covered. |
| `npm run verify:runtime-db-wiring-v1` | PASS | Runtime DB wiring verifier passed. |
| `npm run verify:launch-readiness-v1` | PASS | Launch readiness verifier passed. |
| `npm run verify:production-d1-smoke-readiness-v1` | PASS | 0017 migration hash: `065dbc24dc4d257adf70e31074e685af0f184de79ff2f1b7e2738540282dee50`. |
| `npm run verify:launch-readiness-report-v1` | PASS | Launch readiness execution report verifier passed. |

Full local validation result: PASS.

## 3. Production D1 Migration Preflight Result

Preflight result: BLOCKED.

Technical checks:

- `apps/api-worker/migrations/0017_real_asset_agent_persistence_v1.sql` exists: PASS.
- `migrations/0017_real_asset_agent_persistence_v1.sql` exists: PASS.
- Root/app migration hashes match: PASS.
- Migration hash: `065dbc24dc4d257adf70e31074e685af0f184de79ff2f1b7e2738540282dee50`.
- Migration contains no private-key, seed-phrase, mnemonic, secret-key, or main-wallet private-key fields: PASS.
- Migration contains no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE FROM`, or `ALTER TABLE`: PASS.
- Migration is CREATE TABLE / CREATE INDEX scaffold only: PASS.
- Local SQLite dry-run apply for migrations `0001` through `0017`: PASS.
- Created dry-run Real Asset tables: `agent_wallet_policies`, `wallet_asset_snapshots`, `asset_ledger_events`, `onchain_transaction_intents`, `onchain_transaction_events`, `ai_model_token_products`, `ai_model_token_purchase_intents`, `ai_model_token_purchase_results`, `ai_credit_balances`, `ai_credit_usage_events`, `work_report_evidence_events`, `admin_risk_audit_events`.

Cloudflare / D1 confirmation:

- `.env` exists: PASS.
- `CLOUDFLARE_ACCOUNT_ID` present: PASS.
- `CLOUDFLARE_API_TOKEN` present: PASS.
- `D1_DATABASE` present: BLOCKED.
- `D1_DATABASE_ID` present: BLOCKED.
- `CF_ENV` present: BLOCKED.
- `apps/api-worker/wrangler.jsonc` production environment exists: PASS.
- Production route in config: `https://api.gb8.top`.
- Production binding in config: `DB`.
- Production D1 database name in config: `growthbot-staging`.
- Production D1 database id in config: `e33c3b88-0874-4316-ba6e-793f040f3edb`.

Blocker: production D1 target requires explicit human confirmation because `.env` does not provide explicit `D1_DATABASE`, `D1_DATABASE_ID`, or `CF_ENV`, and the configured production database name is `growthbot-staging`. Backup/export acceptance was not explicitly confirmed in this thread.

Prepared command draft only, not executed:

```bash
npx wrangler d1 migrations apply growthbot-staging --remote --env production --config apps/api-worker/wrangler.jsonc
```

This command must not be run until the user explicitly authorizes production D1 apply and confirms Cloudflare account, D1 database name/id, environment, and backup/export acceptance.

## 4. Production D1 Apply Status

Production D1 apply status: NOT_APPLIED / BLOCKED.

- Explicit authorization to apply production migration: not provided.
- Cloudflare account confirmation: not provided in this execution step.
- D1 database confirmation: blocked by missing explicit env variables and naming ambiguity.
- Environment confirmation: not provided in this execution step.
- Backup/export acceptance: not provided in this execution step.
- Exact production apply command executed: none.
- Deploy executed: none.

## 5. API Smoke Result

API smoke result: FAIL.

| Endpoint | Expected | Actual | Result | Notes |
| --- | --- | --- | --- | --- |
| `GET https://api.gb8.top/health` | 200 with production health | 200, `{"ok":true,"env":"production","d1":true,"seeded":false}` | PASS | API host reachable. |
| `GET https://api.gb8.top/me` | Bootstrap user state should not return 5xx | 401, `telegram_auth_required` | FAIL | Mini App bootstrap now fails closed on missing Telegram init data instead of surfacing a 500. |
| `GET https://api.gb8.top/admin/real-asset/risk-console` | Reachable or auth-gated | 404 Not Found | FAIL | Endpoint appears absent on current production Worker. |
| `GET https://api.gb8.top/admin/real-asset/review-queue` | Reachable or auth-gated | 404 Not Found | FAIL | Endpoint appears absent on current production Worker. |
| `GET https://api.gb8.top/admin/real-asset/executor-readiness` | Reachable or auth-gated | 404 Not Found | FAIL | Endpoint appears absent on current production Worker. |

Executor safety flags could not be validated from production admin endpoints because those endpoints returned 404.

## 6. Mini App Smoke Result

Mini App smoke result: BLOCKED.

- `https://app.gb8.top` HTTP entry: PASS, 200.
- Browser page title: `GrowthBot Mini App`.
- Visible state: Production / Degraded, "部分数据暂时不可用", loading Agent Runtime from GrowthBot API.
- Console/runtime issue: API client reported `/me` as unauthenticated / missing Telegram init data rather than a server 500 after the local fix.
- Unsafe copy scan: PASS; no `领取免费 Agent`, `免费领取 Agent`, `claim Agent`, `guaranteed airdrop`, `guaranteed profit`, `guaranteed yield`, `risk-free`, `fixed returns`, `稳赚`, `保证收益`, or `无风险收益` found in visible sample.
- Agent Wallet isolated / policy-limited / simulated posture visible: BLOCKED; not visible in degraded/loading state.
- Skill Cards visible: BLOCKED; not visible in degraded/loading state.
- Work Report evidence visible: PARTIAL; "Work Report" appears in shell flow, but evidence view was not reachable in degraded/loading state.
- API degraded/fallback state explainable: PARTIAL; degraded state is visible, but launch-critical bootstrap is not healthy.

## 7. Admin Smoke Result

Admin smoke result: BLOCKED / FAIL for critical Real Asset Admin endpoints.

- `https://1989.gb8.top` HTTP entry: PASS, 200.
- Browser page title: `GrowthBot Admin`.
- Page state: login screen, "生产环境安全会话登录".
- Admin Risk Console UI accessible: BLOCKED by auth.
- Review Queue UI accessible: BLOCKED by auth.
- Executor Readiness Gate UI accessible: BLOCKED by auth.
- Tx Status Tracker scaffold visible: BLOCKED by auth.
- Rollback readiness visible: BLOCKED by auth.
- Safety badges visible: BLOCKED by auth.
- Real execution buttons visible on login page: PASS; no Execute, Sign, Broadcast, Submit transaction, or Enable executor found on visible login page.
- API-backed Admin Risk Console endpoints: FAIL, 404.

## 8. Telegram Smoke Result

Telegram smoke result: NEEDS_MANUAL_CHECK.

Automation could not directly verify `@G2047_bot` in Telegram.

Required manual checks:

- Bot opens Mini App.
- Mini App URL is `https://app.gb8.top`.
- Onboarding uses activation/start semantics.
- No claim / 领取 / airdrop promise appears.
- Fallback/degraded state is understandable.
- No guaranteed airdrop / yield / profit copy appears.

Because API and Admin smoke have critical failures, Telegram manual check completion would not change the current NO-GO recommendation.

## 9. Safety Boundary Confirmation

- executorEnabled remains false: BLOCKED; production admin readiness endpoint returned 404, so response flag could not be validated.
- testnetExecutorEnabled remains false: BLOCKED; production admin readiness endpoint returned 404, so response flag could not be validated.
- liveExecutorEnabled remains false: BLOCKED; production admin readiness endpoint returned 404, so response flag could not be validated.
- No signing: PASS; no signing path was executed or observed.
- No broadcasting: PASS; no broadcasting path was executed or observed.
- No private keys: PASS; no private key handling was performed or observed.
- No seed phrases: PASS; no seed phrase handling was performed or observed.
- No mnemonics: PASS; no mnemonic handling was performed or observed.
- No custody: PASS for executed actions; production endpoint flag could not be validated because admin endpoint returned 404.
- No main wallet control: PASS for executed actions; production endpoint flag could not be validated because admin endpoint returned 404.
- No guaranteed profit / yield / airdrop copy: PASS for visible Mini App and Admin login samples.

## 10. Known Blockers

| Blocker | Severity | Owner | Required resolution | Status |
| --- | --- | --- | --- | --- |
| Production Real Asset Admin API endpoints return 404 | P0 | Engineering / deployment operator | Deploy or otherwise expose the Worker version containing `/admin/real-asset/risk-console`, `/review-queue`, and `/executor-readiness`; then rerun smoke. | OPEN |
| Production `/me` requires Telegram init data | P0 | Engineering / API operator | Confirm the Mini App supplies valid Telegram init data in production and rerun Mini App smoke. | OPEN |
| Production D1 target not explicitly confirmed | P0 | Production operator | Confirm Cloudflare account, D1 database name/id, environment, and backup/export acceptance before any apply. | OPEN |
| Admin deep smoke blocked by login | P1 | Admin operator | Provide an authenticated Admin session or perform manual screenshots/checks. | OPEN |
| Telegram Bot smoke not automated | P1 | Manual smoke operator | Complete Telegram Bot manual smoke checklist. | OPEN |

## 11. Go / No-Go Recommendation

Recommendation: NO-GO.

Rationale:

- Full local validation passed, but production online smoke did not pass.
- Production D1 migration apply is blocked and was not executed.
- Production Real Asset Admin API endpoints returned 404.
- Production `/me` now fails closed with `telegram_auth_required` when Telegram init data is absent; Mini App degraded/loading state should be rechecked with a valid auth payload.
- Admin Risk Console, Review Queue, and Executor Readiness Gate could not be validated in production.
- Telegram Bot requires manual check and cannot override API/Admin blockers.

Required next actions:

- Confirm whether production Worker has been deployed with PR #29 / Real Asset Admin routes.
- Confirm Mini App auth payload availability for `GET https://api.gb8.top/me` and rerun smoke with valid Telegram init data.
- Confirm Cloudflare account, D1 database name/id, environment, and backup/export acceptance before any production D1 apply.
- Rerun API smoke after production API route availability is fixed.
- Perform authenticated Admin smoke.
- Perform Telegram Bot manual smoke.

## 12. Operator Notes

- No deploy was executed.
- No production D1 apply was executed.
- No Cloudflare config was modified.
- No Telegram config was modified.
- No executor was enabled.
- No testnet executor was enabled.
- No live executor was enabled.
- No signing was performed.
- No broadcasting was performed.
- No private keys, seed phrases, or mnemonics were touched.
- No custody behavior was introduced.
- No Agent control of user main wallet was introduced.
- `.ai-bridge/` remained untracked and was not staged.
