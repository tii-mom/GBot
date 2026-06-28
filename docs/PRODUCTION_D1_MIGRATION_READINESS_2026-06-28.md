# Production D1 Migration Readiness 2026-06-28

Status: `BLOCKED`

This document is a readiness-only plan. It does not execute production D1 apply, does not deploy, does not create or modify Cloudflare resources, does not enable any executor, and does not handle private keys, seed phrases, mnemonics, custody material, or user main-wallet credentials.

## 1. Current Remote D1 Status

Environment confirmation captured on 2026-06-28:

- Cloudflare account ID: `ff431aed46e94b0593b8b1ee48842c7a`
- Wrangler config: `apps/api-worker/wrangler.jsonc`
- Wrangler env: `production`
- Production binding: `DB`
- Production D1 database name: `growthbot-staging`
- Production D1 database id: `e33c3b88-0874-4316-ba6e-793f040f3edb`
- Production Worker name: `growthbot-api-prod`
- Production API route: `https://api.gb8.top`

Read-only remote inspection evidence:

- `npx wrangler whoami`
- `npx wrangler d1 info growthbot-staging --env production --config apps/api-worker/wrangler.jsonc`
- `npx wrangler d1 execute DB --remote --env production --config apps/api-worker/wrangler.jsonc --json --command "<read-only SQL>"`

Observed remote migration history from `d1_migrations`:

| id | name | applied_at |
| --- | --- | --- |
| 1 | `0001_initial.sql` | `2026-06-16 08:54:55` |
| 2 | `0002_seed_marketplace_demo.sql` | `2026-06-16 08:54:57` |
| 3 | `0003_admin_config.sql` | `2026-06-17 05:17:16` |
| 4 | `0004_bounty_task_network.sql` | `2026-06-17 17:43:44` |
| 5 | `0005_agent_bot_studio.sql` | `2026-06-17 17:43:45` |

Observed remote schema facts:

- `d1_migrations` table exists.
- `skill_acquisition_rules` does not exist.
- `skill_runtime_versions`, `skill_runtime_executions`, and `task_skill_runtime_usages` do not exist.
- `0017` real-asset persistence tables do not exist.
- `agents` already contains `0006` columns such as `profession`, `experience`, `task_slots`, `daily_run_limit`, `research_score`, and `active_work_run_id`.
- `inventory_items` already contains `0006` / `0011` columns `asset_definition_id`, `box_order_id`, and `skill_definition_id`.
- `agent_work_runs`, `agent_work_steps`, `agent_activity_events`, `box_products`, `box_drop_items`, `box_orders`, `starter_box_grants`, `agent_wallets`, `asset_definitions`, and `work_run_settlements` already exist.
- `box_openings` already has `user_id`, and `trg_box_openings_validation` exists.
- `agent_skill_definitions` exists with `62` rows.
- `agent_skill_operations` exists in the pre-`0012` shape without `updated_at`, while `uq_skill_ops_user_idem` and `idx_skill_ops_agent` also exist.
- `agent_work_runs` does not contain `execution_mode` or `research_brief_result_json`.
- No residual temp tables or migration guard triggers were observed for `0010`, `0012`, or `0013`.

Interpretation:

- Remote history says production is only applied through `0005`.
- Actual schema already contains a subset of `0006`, `0010`, and `0011` outcomes.
- Actual schema does not contain `0012` complete shape, `0013`, `0014`, `0015`, `0016`, or `0017`.
- This is a history/schema divergence, not a clean “apply `0006..0017`” state.

## 2. Missing Migrations

Confirmed missing from remote history:

- `0006_agent_workflow_box_store_wallet.sql`
- `0007_seed_v1_catalog_and_store.sql`
- `0008_v1_rigorous_constraints.sql`
- `0009_v1_constraints_and_reservations.sql`
- `0010_box_openings_owner_constraint.sql`
- `0011_agent_skill_core.sql`
- `0012_skill_economy_loop.sql`
- `0013_skill_catalog_acquisition_v1.sql`
- `0014_skill_runtime_lite_v1.sql`
- `0015_workflow_runtime_settlement_gate.sql`
- `0016_research_brief_runtime_v1.sql`
- `0017_real_asset_agent_persistence_v1.sql`

Confirmed functionally missing from remote schema:

- `0013`: `skill_acquisition_rules` table and canonical rule indexes are absent.
- `0014`: `skill_runtime_versions`, `skill_runtime_executions`, `task_skill_runtime_usages`, `uq_active_runtime`, `idx_runtime_versions_def`, `uq_runtime_recovery_once`, `idx_runtime_execution_parent`, and `idx_runtime_usages_execution` are absent.
- `0015`: `agent_work_runs.execution_mode` and `work_step_runtime_executions` are absent.
- `0016`: `agent_work_runs.research_brief_result_json` is absent.
- `0017`: all real-asset persistence tables are absent.

Partial / out-of-order findings:

- `0006` is partially present in schema but absent from history.
- `0010` target schema for `box_openings` is partially present in schema but absent from history.
- `0011` target objects are partially present in schema but absent from history.
- `0012` is not complete: `agent_skill_operations.updated_at` is absent, so `0012` was not fully applied.
- Because history remains at `0005`, any future direct `wrangler d1 migrations apply ... --remote` would attempt to replay migrations whose outcomes already partially exist.

## 3. Backup / Export Plan

No backup/export was executed in this task.

Required pre-apply backup plan for a separately approved window:

1. Confirm operator, approver, timestamp, target account, target DB name/id, and target environment.
2. Capture a schema export:

```bash
npx wrangler d1 export growthbot-staging \
  --remote \
  --env production \
  --config apps/api-worker/wrangler.jsonc \
  --output ops-exports/production-d1/2026-06-28T<UTC>/growthbot-staging-schema.sql \
  --no-data
```

3. Capture a full export:

```bash
npx wrangler d1 export growthbot-staging \
  --remote \
  --env production \
  --config apps/api-worker/wrangler.jsonc \
  --output ops-exports/production-d1/2026-06-28T<UTC>/growthbot-staging-full.sql
```

4. Capture manifest metadata:

- export timestamp
- operator
- approver
- account id
- db name
- db id
- wrangler version
- git commit

5. Compute hashes locally:

```bash
shasum -a 256 ops-exports/production-d1/2026-06-28T<UTC>/growthbot-staging-schema.sql
shasum -a 256 ops-exports/production-d1/2026-06-28T<UTC>/growthbot-staging-full.sql
```

6. Store artifacts in an approval-visible location.

Backup acceptance owner:

- Named production operator performs export.
- Named approver confirms file existence, file size sanity, and SHA-256 capture before any apply.

Restore strategy draft:

- Primary: Cloudflare D1 Time Travel restore to a pre-apply bookmark or timestamp.
- Secondary: use the captured `.sql` exports for reconstruction/reference if time-travel restore is insufficient.

Time-travel command draft:

```bash
npx wrangler d1 time-travel restore growthbot-staging \
  --env production \
  --config apps/api-worker/wrangler.jsonc \
  --timestamp <RFC3339_TIMESTAMP>
```

`NOT EXECUTED.`

## 4. Local Dry-Run Result

Local dry-run executed against disposable SQLite only.

Evidence run:

- Sequential local apply of `apps/api-worker/migrations/*.sql`
- `npm run verify:static-v1`
- `npm run verify:production-migration-clone`
- `npm run verify:production-d1-smoke-readiness-v1`
- `npm run verify:production-runtime-compat-v1`
- `npm run verify:real-asset-db-persistence-v1`

Results:

- `0001` through `0017` apply cleanly in order on a disposable local SQLite database.
- Local integrity check: `ok`
- Local foreign key check: passed
- `0013` created `skill_acquisition_rules`.
- Local canonical skill rules count: `31`
- `0014` created `skill_runtime_versions`, `skill_runtime_executions`, and `task_skill_runtime_usages`.
- Local active runtime versions count: `31`
- `0015` added `agent_work_runs.execution_mode` and created `work_step_runtime_executions`.
- `0016` added `agent_work_runs.research_brief_result_json`.
- `0017` created all expected real-asset persistence tables.

Root/app migration hash confirmation:

- `0013` SHA-256: `632f8b823403714377c9597b306c80d0b6148329e6de5f660f383b580b8975d5`
- `0014` SHA-256: `eed7d3cd671fec3381c5639e02a252e24bd590506ee0c1fc6a2f936615eb5d16`
- `0017` SHA-256: `065dbc24dc4d257adf70e31074e685af0f184de79ff2f1b7e2738540282dee50`

Conclusion:

- Local migration chain is healthy.
- Production is blocked not because the migration files are bad, but because remote production history/schema state is not a safe direct apply target.

## 5. Risk Review

Required review scope:

- `DROP TABLE`
- `DROP COLUMN`
- `TRUNCATE`
- destructive `DELETE`
- unsafe `ALTER`
- private key / seed phrase / mnemonic / custody / main wallet private key terms

Findings:

- `0010_box_openings_owner_constraint.sql` contains `DROP TABLE box_openings` as part of a guarded table rebuild.
- `0012_skill_economy_loop.sql` contains `DROP TABLE agent_skill_operations` as part of a guarded table rebuild.
- `0013_skill_catalog_acquisition_v1.sql` adds columns to `skill_economy_events` via `ALTER TABLE`.
- `0015_workflow_runtime_settlement_gate.sql` adds `execution_mode` to `agent_work_runs` via `ALTER TABLE`.
- `0016_research_brief_runtime_v1.sql` adds `research_brief_result_json` to `agent_work_runs` via `ALTER TABLE`.
- `0017_real_asset_agent_persistence_v1.sql` is additive-only and does not contain `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or destructive `DELETE`.
- No migration introduces plaintext private-key, seed-phrase, mnemonic, custody-secret, or main-wallet-private-key columns.
- `0014_skill_runtime_lite_v1.sql` includes many safety instructions explicitly prohibiting signing, broadcasting, custody, and main-wallet control; these are policy strings, not stored secrets.

Risk decision:

- Because remote production schema already contains partial post-`0005` structures, replaying `0010` and `0012` is unsafe without a remediation plan.
- Because `0010` and `0012` include destructive rebuild steps, current production state must be treated as `BLOCKED`.

## 6. Exact Apply Command Draft

Target:

- Database name: `growthbot-staging`
- Database id: `e33c3b88-0874-4316-ba6e-793f040f3edb`
- Binding: `DB`
- Environment: `production`
- Config: `apps/api-worker/wrangler.jsonc`

Naive direct apply command draft:

```bash
npx wrangler d1 migrations apply DB \
  --remote \
  --env production \
  --config apps/api-worker/wrangler.jsonc
```

`NOT EXECUTED.`

Why this cannot be approved yet:

- It would try to replay migrations from `0006` onward because `d1_migrations` stops at `0005`.
- Production schema already contains partial `0006`, `0010`, and `0011` outcomes.
- `0010` and `0012` contain destructive rebuild logic and are not safe to replay blindly on a diverged schema.

Required remediation before any future apply:

1. Produce a separate divergence-remediation plan.
2. Decide whether to:
   - reconcile `d1_migrations` history to match already-present schema, or
   - create a one-off remediation migration path for this exact production shape.
3. Dry-run that remediation path against a production-shaped clone.
4. Re-run backup/export and approval steps.
5. Only after remediation, decide the exact remaining migration range.

Expected objects after a hypothetical fully remediated apply:

Created tables:

- `skill_acquisition_rules`
- `skill_runtime_versions`
- `skill_runtime_executions`
- `task_skill_runtime_usages`
- `work_step_runtime_executions`
- `agent_wallet_policies`
- `wallet_asset_snapshots`
- `asset_ledger_events`
- `onchain_transaction_intents`
- `onchain_transaction_events`
- `ai_model_token_products`
- `ai_model_token_purchase_intents`
- `ai_model_token_purchase_results`
- `ai_credit_balances`
- `ai_credit_usage_events`
- `work_report_evidence_events`
- `admin_risk_audit_events`

Expected indexes:

- `idx_skill_acquisition_box_pool`
- `idx_skill_acquisition_normal_synth`
- `idx_skill_acquisition_expert_synth`
- `idx_skill_acquisition_reset_pool`
- `idx_skill_acquisition_release_status`
- `uq_active_runtime`
- `idx_runtime_versions_def`
- `uq_runtime_recovery_once`
- `idx_runtime_execution_parent`
- `idx_runtime_usages_execution`
- `idx_work_step_runtime_executions_run`
- `idx_work_step_runtime_executions_step`
- `idx_work_step_runtime_executions_runtime`
- all `0017` real-asset persistence indexes defined in `apps/api-worker/migrations/0017_real_asset_agent_persistence_v1.sql`

Post-apply verification command drafts:

```bash
npx wrangler d1 execute DB \
  --remote \
  --env production \
  --config apps/api-worker/wrangler.jsonc \
  --json \
  --command "SELECT id, name, applied_at FROM d1_migrations ORDER BY id;"
```

```bash
npx wrangler d1 execute DB \
  --remote \
  --env production \
  --config apps/api-worker/wrangler.jsonc \
  --json \
  --command "SELECT COUNT(*) AS canonical_rules FROM skill_acquisition_rules WHERE is_canonical=1; SELECT COUNT(*) AS runtime_versions FROM skill_runtime_versions; SELECT COUNT(*) AS active_runtime_versions FROM skill_runtime_versions WHERE runtime_status='active';"
```

```bash
npx wrangler d1 execute DB \
  --remote \
  --env production \
  --config apps/api-worker/wrangler.jsonc \
  --json \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('agent_wallet_policies','wallet_asset_snapshots','asset_ledger_events','onchain_transaction_intents','onchain_transaction_events','ai_model_token_products','ai_model_token_purchase_intents','ai_model_token_purchase_results','ai_credit_balances','ai_credit_usage_events','work_report_evidence_events','admin_risk_audit_events');"
```

`NOT EXECUTED.`

Rollback / restore plan draft:

- Prefer Cloudflare D1 Time Travel restore to pre-apply timestamp/bookmark.
- Preserve full export and schema export before apply.
- If smoke fails, stop all further rollout, capture evidence, and restore only under separate approval.

`NOT EXECUTED.`

## 7. Post-Apply Smoke Plan

After separate approval and a future successful apply, run:

API:

- `GET /health` -> expect `200`
- `GET /me` without Telegram `initData` -> expect `401 telegram_auth_required`
- `GET /me` with valid Telegram `initData` -> expect authenticated success

Admin real-asset surface:

- `/admin/real-asset/*` without admin token -> expect `401 admin_auth_required`
- `/admin/real-asset/*` with valid admin token -> expect authenticated success

Skill domain:

- skill catalog endpoints
- skill economy endpoints
- skill runtime status endpoint

Core product domain:

- inventory
- tasks
- work runs
- reports

UI surfaces:

- Mini App
- Admin UI
- Telegram Mini App entry flow

Safety confirmation:

- executor remains disabled
- no signing
- no broadcasting
- no custody
- no main-wallet control

## 8. Approval Checklist

Before any future apply:

- [ ] Separate approval explicitly authorizes production D1 mutation.
- [ ] Named operator and named approver are assigned.
- [ ] Production account id, db name, db id, binding, env, and config path are re-confirmed.
- [ ] Full export and schema export are completed and hashed.
- [ ] Time-travel restore point/bookmark strategy is confirmed.
- [ ] Divergence-remediation plan is written and approved.
- [ ] Production-shaped clone passes the remediation dry-run.
- [ ] Exact post-remediation migration range is re-derived.
- [ ] Post-apply smoke operator is ready for API, Admin UI, Mini App, and Telegram Mini App.

## 9. Go / No-Go For Apply

Decision: `BLOCKED`

Reasons:

- Current remote D1 is not in a clean pre-`0013` state.
- `d1_migrations` history stops at `0005`, but production schema already includes a subset of `0006`, `0010`, and `0011`.
- `0012` is incomplete relative to its final schema shape.
- `0013`, `0014`, `0015`, `0016`, and `0017` are still missing.
- The unapplied range contains destructive rebuild migrations (`0010`, `0012`) that are unsafe to replay on a diverged schema.

Apply recommendation:

- Do not run production D1 apply.
- First produce and approve a separate history/schema divergence remediation plan.

