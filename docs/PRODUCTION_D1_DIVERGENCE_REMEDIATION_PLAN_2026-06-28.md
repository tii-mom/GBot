# Production D1 History / Schema Divergence Remediation Plan 2026-06-28

Status: `READY_FOR_SEPARATE_APPROVAL`

This document is readiness and planning only.

- No production D1 apply was executed.
- No remote D1 writes were executed.
- No production deploy was executed.
- No Cloudflare resource changes were executed.
- No executor was enabled.
- No signing, broadcasting, custody, private-key handling, seed-phrase handling, mnemonic handling, or user main-wallet control was executed.

## 1. Current Status

Date of live read-only inventory: `2026-06-28`

Repository facts captured during this task:

- Repository: `https://github.com/tii-mom/GBot`
- Local workspace: `/Users/yudeyou/Desktop/GrowthBot`
- `origin/main` base commit at inspection time: `b77eea5de482846eca9f44dcfa86b4e60f026d88`
- Current task branch: `codex/production-d1-divergence-remediation-plan-v1`
- PR `#39` (`docs: add authenticated production smoke report`) was `OPEN` on `2026-06-28`
- PR `#40` (`docs: add production d1 migration readiness plan`) was `OPEN` on `2026-06-28`

Production target confirmed via read-only Wrangler commands:

- Cloudflare account id: `ff431aed46e94b0593b8b1ee48842c7a`
- Worker config: `apps/api-worker/wrangler.jsonc`
- Environment: `production`
- Binding: `DB`
- Production D1 database name: `growthbot-staging`
- Production D1 database id: `e33c3b88-0874-4316-ba6e-793f040f3edb`
- Production route: `https://api.gb8.top`

Direct production migration apply remains `BLOCKED` today because remote history stops at `0005`, while remote schema already contains post-`0005` outcomes from later migrations.

## 2. Remote D1 Inventory Summary

### 2.1 Read-only commands executed

The following commands were executed during this task in read-only mode:

```bash
npx wrangler whoami
npx wrangler d1 info growthbot-staging --env production --config apps/api-worker/wrangler.jsonc
npx wrangler d1 execute DB --remote --env production --config apps/api-worker/wrangler.jsonc --json --command "SELECT id, name, applied_at FROM d1_migrations ORDER BY id;"
npx wrangler d1 execute DB --remote --env production --config apps/api-worker/wrangler.jsonc --json --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
npx wrangler d1 execute DB --remote --env production --config apps/api-worker/wrangler.jsonc --json --command "SELECT * FROM pragma_table_info('agents');"
npx wrangler d1 execute DB --remote --env production --config apps/api-worker/wrangler.jsonc --json --command "SELECT * FROM pragma_table_info('inventory_items');"
npx wrangler d1 execute DB --remote --env production --config apps/api-worker/wrangler.jsonc --json --command "SELECT * FROM pragma_table_info('box_openings');"
npx wrangler d1 execute DB --remote --env production --config apps/api-worker/wrangler.jsonc --json --command "SELECT * FROM pragma_table_info('agent_skill_operations');"
npx wrangler d1 execute DB --remote --env production --config apps/api-worker/wrangler.jsonc --json --command "SELECT * FROM pragma_table_info('agent_work_runs');"
```

### 2.2 Remote migration history

Observed rows in `d1_migrations`:

| id | name | applied_at |
| --- | --- | --- |
| 1 | `0001_initial.sql` | `2026-06-16 08:54:55` |
| 2 | `0002_seed_marketplace_demo.sql` | `2026-06-16 08:54:57` |
| 3 | `0003_admin_config.sql` | `2026-06-17 05:17:16` |
| 4 | `0004_bounty_task_network.sql` | `2026-06-17 17:43:44` |
| 5 | `0005_agent_bot_studio.sql` | `2026-06-17 17:43:45` |

Remote history max is `0005_agent_bot_studio.sql`.

### 2.3 Remote live-data snapshot

Observed live row counts on `2026-06-28`:

- `users`: `64`
- `agents`: `58`
- `inventory_items`: `79`
- `agent_skill_definitions`: `62`
- `agent_work_runs`: `0`
- `agent_skill_operations`: `0`
- `box_orders`: `0`
- `box_openings`: `0`

Interpretation:

- Production is not empty and should be treated as data-bearing.
- The currently empty `box_openings`, `box_orders`, and `agent_skill_operations` tables reduce the risk of clone-verified table-shape fixes, but they do not justify blind replay of upstream migrations.

### 2.4 Key schema facts

Observed present:

- `agents` already has `0006` columns including `profession`, `experience`, `task_slots`, `daily_run_limit`, `research_score`, and `active_work_run_id`
- `inventory_items` already has `asset_definition_id`, `box_order_id`, and `skill_definition_id`
- `asset_definitions` already has `implementation_status`, `code`, `asset_type`, `duration_seconds`, `max_uses`, `stackable`, `soulbound`, `transferable_v1`, `required_level`, `effect_type`, `effect_value_json`, and `description_v1`
- `agent_work_runs`, `agent_work_steps`, `agent_activity_events`, `box_products`, `box_drop_items`, `box_orders`, `starter_box_grants`, `agent_wallets`, `user_balance_snapshots`, and `work_run_settlements` exist
- `box_openings` already has the post-`0010` shape: `inventory_item_id`, `user_id`, `opened_at DEFAULT CURRENT_TIMESTAMP`
- `trg_box_openings_validation` exists
- `agent_skill_definitions`, `agent_learned_skills`, `agent_skill_events`, and `agent_skill_operations` exist
- `uq_skill_ops_user_idem` and `idx_skill_ops_agent` exist
- seed artifacts from `0007` are present, including `bp_worker`, `bp_specialist`, and `di_starter_fixed_gp`

Observed missing:

- `agent_skill_operations.updated_at`
- `box_orders.request_hash`
- `skill_economy_events` and the other `0012` skill-economy tables
- `skill_acquisition_rules`
- `skill_runtime_versions`, `skill_runtime_executions`, and `task_skill_runtime_usages`
- `agent_work_runs.execution_mode`
- `work_step_runtime_executions`
- `agent_work_runs.research_brief_result_json`
- all `0017` real-asset persistence tables, including `admin_risk_audit_events`

## 3. Migration-by-Migration Status Table

| Migration | History recorded? | Observed remote schema state | Status | Replay / remediation note |
| --- | --- | --- | --- | --- |
| `0001_initial.sql` | Yes | Core base tables exist | Aligned | No remediation needed |
| `0002_seed_marketplace_demo.sql` | Yes | Base seed data path is recorded | Aligned | No remediation needed |
| `0003_admin_config.sql` | Yes | Admin config objects exist | Aligned | No remediation needed |
| `0004_bounty_task_network.sql` | Yes | Bounty/task tables exist | Aligned | No remediation needed |
| `0005_agent_bot_studio.sql` | Yes | Agent bot studio base objects exist | Aligned | No remediation needed |
| `0006_agent_workflow_box_store_wallet.sql` | No | `agents` columns, workflow tables, box/store tables, wallet table, and `inventory_items.asset_definition_id` / `box_order_id` are already present | Schema present, history missing | Direct replay is unsafe because `ALTER TABLE ... ADD COLUMN` would hit existing columns before later statements |
| `0007_seed_v1_catalog_and_store.sql` | No | Seed outcomes are already present, including `bp_worker`, `bp_specialist`, and starter drop rows | Seed-present, history missing | The inserts are idempotent, but they should not be replayed as part of a naive `0006..latest` production apply |
| `0008_v1_rigorous_constraints.sql` | No | `box_orders.failure_code`, `failure_message`, `fulfillment_attempts`, `asset_definitions.implementation_status`, `user_balance_snapshots`, and `work_run_settlements` are present | Schema present, history missing | Likely mark-only after clone verification |
| `0009_v1_constraints_and_reservations.sql` | No | `box_openings` and `trg_box_openings_validation` exist, but current table shape is already post-`0010` | Superseded target present, history missing | Do not assume a clean `0009` lineage; reconcile via exact-schema validation |
| `0010_box_openings_owner_constraint.sql` | No | `box_openings.user_id` and `opened_at DEFAULT CURRENT_TIMESTAMP` are already present; live row count is `0` | Target schema present, history missing | Upstream migration contains `DROP TABLE box_openings`; do not replay blindly |
| `0011_agent_skill_core.sql` | No | Skill core tables exist; `agent_skill_definitions` has `62` rows; `inventory_items.skill_definition_id` exists | Schema present, history missing | Direct replay is unsafe because `ALTER TABLE inventory_items ADD COLUMN skill_definition_id` would duplicate |
| `0012_skill_economy_loop.sql` | No | `skill_economy_events`, `skill_box_daily_purchases`, `agent_skill_reset_operations`, and other `0012` tables are absent; `box_orders.request_hash` absent; `agent_skill_operations.updated_at` absent | Incomplete / missing | Upstream migration contains guarded rebuild logic and `DROP TABLE agent_skill_operations`; requires a custom guarded patch |
| `0013_skill_catalog_acquisition_v1.sql` | No | `skill_acquisition_rules` absent; canonical `31`-rule set absent; `pool_code` and `pool_version` absent because `skill_economy_events` is absent | Missing | Add after the `0012` equivalent state exists |
| `0014_skill_runtime_lite_v1.sql` | No | `skill_runtime_versions`, `skill_runtime_executions`, and `task_skill_runtime_usages` absent | Missing | Additive, but only after divergence remediation is dry-run on a clone |
| `0015_workflow_runtime_settlement_gate.sql` | No | `agent_work_runs.execution_mode` absent; `work_step_runtime_executions` absent | Missing | Additive after clone validation |
| `0016_research_brief_runtime_v1.sql` | No | `agent_work_runs.research_brief_result_json` absent | Missing | Additive after clone validation |
| `0017_real_asset_agent_persistence_v1.sql` | No | All persistence tables are absent: `agent_wallet_policies`, `wallet_asset_snapshots`, `asset_ledger_events`, `onchain_transaction_intents`, `onchain_transaction_events`, `ai_model_token_products`, `ai_model_token_purchase_intents`, `ai_model_token_purchase_results`, `ai_credit_balances`, `ai_credit_usage_events`, `work_report_evidence_events`, and `admin_risk_audit_events` | Missing | Additive, but only after history/schema divergence is remediated |

## 4. Divergence Explanation

Production is in a split-brain state:

- Remote `d1_migrations` says production is only applied through `0005`.
- Actual production schema already contains material outcomes from `0006`, `0007`, `0008`, `0009`, `0010`, and `0011`.
- Actual production schema is still missing `0012` through `0017`, with `0012` specifically left in a pre-final shape.

The most plausible explanation is an out-of-band or interrupted migration/application path where schema changes landed without the matching durable history rows being recorded through `d1_migrations`.

Operational consequence:

- A naive `wrangler d1 migrations apply DB --remote --env production ...` will attempt to start again at `0006`.
- That replay path is not equivalent to a no-op because several migrations contain duplicate-column risk or destructive table-rebuild logic.

## 5. Why Direct Apply Is Unsafe

Direct apply is unsafe for four separate reasons:

1. `0006` and `0011` contain `ALTER TABLE ... ADD COLUMN` statements for columns that already exist in production.
2. `0010` contains a guarded rebuild with `DROP TABLE box_openings`.
3. `0012` contains a guarded rebuild with `DROP TABLE agent_skill_operations`.
4. History-only reconciliation is also unsafe because production is still functionally missing `0012` through `0017`.

Naive direct apply command draft:

```bash
npx wrangler d1 migrations apply DB \
  --remote \
  --env production \
  --config apps/api-worker/wrangler.jsonc
```

`NOT EXECUTED.`

This command must remain blocked until a separate remediation path has been dry-run against a production-shaped clone and explicitly approved.

## 6. Options A / B / C

| Option | Summary | Data loss risk | Downtime | Backup / export required | Rollback | DROP / rebuild exposure | Beta-launch fit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Option A | Fresh production D1 replacement: create a clean D1, apply `0001..latest`, migrate data, switch binding | Medium to high if export/import mapping is wrong | Medium | Mandatory | Strongest rollback if binding can switch back cleanly | Avoids replaying old rebuilds on the dirty DB, but still requires data migration | Good only if current production data is disposable or easy to rehydrate |
| Option B | Custom idempotent remediation migration: preserve the current DB, patch only the missing / incomplete objects, and reconcile history after clone verification | Low if the clone-verified patch is truly additive or zero-row guarded | Low to medium | Mandatory | Good with time-travel restore and fresh export | Can avoid replaying `0010`; may still require a narrowly scoped zero-row rebuild for `0012` shape correction | Best fit if existing production data matters |
| Option C | Manual history reconciliation first, then targeted schema patches | Low direct data-loss risk, high operational error risk | Low | Mandatory | Weak if history is marked incorrectly | High risk of masking missing schema with false history | Poor fit; too easy to create a misleadingly "green" migration state |

### Option A: Fresh production D1 replacement

Pros:

- Cleanest final migration lineage
- Easiest long-term mental model
- Rollback can be a binding switch if the old DB is kept intact

Cons:

- Requires export/import mapping for all live production records
- Increases operator effort and change-surface size
- Risks silent data omission during migration to the fresh DB

Use this only if operators explicitly confirm that current production data is disposable, low-value, or intentionally replaceable before beta launch.

### Option B: Custom idempotent remediation migration

Pros:

- Preserves the current production database and user-linked data
- Avoids blind replay of `0010` and `0012`
- Keeps the remediation surface narrowly focused on the exact divergence observed on `2026-06-28`

Cons:

- Requires careful clone-first engineering
- Requires exact post-state verification before history backfill
- Still needs a controlled answer for the unfinished `0012` shape

This is the safest default when production already contains real user and inventory records.

### Option C: Manual history reconciliation plus targeted patches

Pros:

- Smallest apparent change set
- Minimal immediate schema churn

Cons:

- Highest chance of writing misleading history
- Future operators may trust a history table that no longer reflects reality
- If history is corrected before missing objects are patched, later apply/debug work becomes harder, not easier

This is not recommended as the primary path.

## 7. Recommended Option

Recommended option: `Option B`

Reasoning:

- Production is not empty: `64` users, `58` agents, and `79` inventory items are already present.
- The divergence is concentrated in history drift plus missing additive objects after partial `0006` / `0010` / `0011` outcomes.
- `0010` does not need to be replayed because the target schema is already present.
- `0012` is the only migration that likely needs a custom table-shape fix, and the relevant live table currently has `0` rows, which makes a clone-verified guarded rebuild materially safer than a blind upstream replay.

Recommended execution stance:

- Treat `0010` as mark-only after exact-schema validation.
- Treat `0012` as a custom guarded patch, not as an upstream replay.
- Apply `0013`, `0014`, `0015`, `0016`, and `0017` only after the `0012` equivalent state is proven on a production-shaped clone.
- Reconcile `d1_migrations` only after the schema post-state matches the intended target.

Fallback:

- If operators decide current production data is disposable before beta launch, re-open Option A and compare its operator risk against the cost of a custom remediation patch.

## 8. Exact Command Drafts

### 8.1 Backup / export commands

Draft only:

```bash
mkdir -p ops-exports/production-d1/2026-06-28T<UTC>
```

```bash
npx wrangler d1 export growthbot-staging \
  --remote \
  --env production \
  --config apps/api-worker/wrangler.jsonc \
  --output ops-exports/production-d1/2026-06-28T<UTC>/growthbot-staging-schema.sql \
  --no-data
```

```bash
npx wrangler d1 export growthbot-staging \
  --remote \
  --env production \
  --config apps/api-worker/wrangler.jsonc \
  --output ops-exports/production-d1/2026-06-28T<UTC>/growthbot-staging-full.sql
```

```bash
shasum -a 256 ops-exports/production-d1/2026-06-28T<UTC>/growthbot-staging-schema.sql
shasum -a 256 ops-exports/production-d1/2026-06-28T<UTC>/growthbot-staging-full.sql
git rev-parse HEAD
```

Time-travel restore draft:

```bash
npx wrangler d1 time-travel restore growthbot-staging \
  --env production \
  --config apps/api-worker/wrangler.jsonc \
  --timestamp <RFC3339_TIMESTAMP>
```

`NOT EXECUTED.`

### 8.2 Read-only verification commands

These are safe to run again before approval:

```bash
npx wrangler whoami
npx wrangler d1 info growthbot-staging --env production --config apps/api-worker/wrangler.jsonc
```

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
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

```bash
npx wrangler d1 execute DB \
  --remote \
  --env production \
  --config apps/api-worker/wrangler.jsonc \
  --json \
  --command "SELECT * FROM pragma_table_info('agents'); SELECT * FROM pragma_table_info('inventory_items'); SELECT * FROM pragma_table_info('box_openings'); SELECT * FROM pragma_table_info('agent_skill_operations'); SELECT * FROM pragma_table_info('agent_work_runs');"
```

```bash
npx wrangler d1 execute DB \
  --remote \
  --env production \
  --config apps/api-worker/wrangler.jsonc \
  --json \
  --command "SELECT COUNT(*) AS users_count FROM users; SELECT COUNT(*) AS agents_count FROM agents; SELECT COUNT(*) AS inventory_items_count FROM inventory_items;"
```

### 8.3 Remediation execution drafts

Draft only. These files do not exist yet in this task and were not executed.

Build a production-shaped local clone from the approved export:

```bash
sqlite3 ops-exports/production-d1/2026-06-28T<UTC>/growthbot-staging-clone.sqlite < ops-exports/production-d1/2026-06-28T<UTC>/growthbot-staging-full.sql
```

Run clone preflight:

```bash
npm run preflight:production-migrations -- \
  --db ops-exports/production-d1/2026-06-28T<UTC>/growthbot-staging-clone.sqlite \
  --expected-max 5 \
  --environment production-clone
```

Future remediation apply drafts:

```bash
npx wrangler d1 execute DB \
  --remote \
  --env production \
  --config apps/api-worker/wrangler.jsonc \
  --file ops/remediation/production-d1-remediation-schema-v1.sql
```

```bash
npx wrangler d1 execute DB \
  --remote \
  --env production \
  --config apps/api-worker/wrangler.jsonc \
  --file ops/remediation/production-d1-remediation-history-v1.sql
```

`NOT EXECUTED.`

## 9. Approval Checklist

- [ ] Confirm Cloudflare account id is `ff431aed46e94b0593b8b1ee48842c7a`
- [ ] Confirm production D1 database name is `growthbot-staging`
- [ ] Confirm production D1 database id is `e33c3b88-0874-4316-ba6e-793f040f3edb`
- [ ] Confirm worker config path is `apps/api-worker/wrangler.jsonc`
- [ ] Confirm environment is `production`
- [ ] Confirm named operator and named approver
- [ ] Confirm full export and schema export both exist and have SHA-256 hashes recorded
- [ ] Confirm a maintenance window exists
- [ ] Confirm rollback path exists before any mutation
- [ ] Confirm executor flags remain disabled before, during, and after remediation
- [ ] Confirm no signing, broadcasting, custody, or user main-wallet control is involved
- [ ] Confirm remediation SQL has passed on a production-shaped clone
- [ ] Confirm post-remediation smoke operator is ready for API, Mini App, Admin UI, and Telegram entry flow

## 10. Exact Remediation Steps

Draft only. Not executed.

1. Freeze the change window: no deploy, no config edits, no executor enablement.
2. Capture fresh schema and full exports, plus SHA-256 hashes.
3. Build a local production-shaped clone from the fresh export.
4. Run clone preflight and compare clone schema against the `2026-06-28` inventory in this document.
5. Author a custom remediation SQL path with strict guards:
   - `0006` / `0007` / `0008` / `0009` / `0010` / `0011`: validate exact target state; do not replay upstream files on production.
   - `0010`: mark-only after verifying `box_openings` already matches the target shape.
   - `0012`: create missing skill-economy tables and columns, and only perform a controlled `agent_skill_operations` shape correction if the zero-row or copy-count guard passes on the clone.
   - `0013`: create `skill_acquisition_rules`, seed the `31` canonical rules, and add supporting indexes only if missing.
   - `0014`: create runtime tables and indexes, then seed active runtime versions.
   - `0015`: add `agent_work_runs.execution_mode` and create `work_step_runtime_executions`.
   - `0016`: add `agent_work_runs.research_brief_result_json`.
   - `0017`: create all additive real-asset persistence tables and indexes.
6. Dry-run the full remediation path on the clone until the post-state is clean and repeatable.
7. Immediately before maintenance, take a second fresh production export.
8. Execute the approved schema-remediation SQL against production.
9. Run post-remediation read-only SQL verification.
10. Insert or reconcile `d1_migrations` rows only after the schema post-state exactly matches the intended target.
11. Run online smoke.
12. If any check fails, stop launch work and execute the rollback plan.

## 11. Post-remediation Smoke Plan

Post-remediation smoke plan:

- `GET /health` -> expect `200`
- `GET /me` with valid Telegram signed `initData` -> expect `200`
- `GET /tasks/available` -> expect `200`
- `GET /inventory` -> expect `200`
- Admin real-asset endpoints with valid `ADMIN_TOKEN` -> expect `200`
- Skill catalog endpoints -> expect canonical catalog plus acquisition-rule-backed behavior
- Skill economy endpoints -> expect `0012` / `0013` objects present and healthy
- Review queue -> must no longer surface `persistenceError=admin_risk_audit_events_missing`
- Executor readiness -> `executorEnabled`, `testnetExecutorEnabled`, and `liveExecutorEnabled` remain `false`
- Mini App -> loads and renders authenticated runtime views
- Admin UI -> loads review queue and real-asset admin surfaces without persistence-missing errors
- Telegram Mini App entry flow -> opens successfully through the bot

Smoke command drafts:

```bash
curl -i https://api.gb8.top/health
curl -i -H "X-Telegram-Init-Data: $TELEGRAM_INIT_DATA" https://api.gb8.top/me
curl -i -H "X-Telegram-Init-Data: $TELEGRAM_INIT_DATA" https://api.gb8.top/tasks/available
curl -i -H "X-Telegram-Init-Data: $TELEGRAM_INIT_DATA" https://api.gb8.top/inventory
curl -i -H "Authorization: Bearer $ADMIN_TOKEN" https://api.gb8.top/admin/real-asset/review-queue
```

`NOT EXECUTED.`

## 12. Rollback Plan

Rollback plan:

1. Stop the launch and report `NO-GO`.
2. Preserve the failing outputs, timestamps, and operator notes.
3. Keep executors disabled.
4. Restore production D1 from the approved time-travel point or fresh export baseline.
5. Re-run the read-only inventory to confirm the restore state.
6. If Option A was used instead of Option B, switch the binding back to the previous production D1 and keep the fresh replacement dark.
7. Re-run `/health`, `/me`, `/tasks/available`, `/inventory`, admin real-asset smoke, Mini App, and Admin UI checks.

`NOT EXECUTED.`

## 13. Final Recommendation

Final recommendation: `READY_FOR_SEPARATE_APPROVAL`

Meaning:

- This remediation plan is complete enough to support a separately approved production change window.
- Production D1 apply itself remains blocked until clone-first remediation SQL is written, reviewed, and explicitly approved.
- The safest default path is `Option B`, with `Option A` kept as a fallback only if production data is formally declared disposable.

