# Production D1 Migration Apply Plan V1

> Status: production pre-apply plan only. This PR does not execute production migration apply.

## 1. Purpose

Define the manual, evidence-based plan for applying the Real Asset Agent persistence migration to production D1 after an explicitly approved production change window.

This document turns readiness checks into an operator plan. It does not deploy, does not run `wrangler d1 migrations apply`, and does not mutate production D1.

## 2. Scope

- Confirm the production D1 target before any apply.
- Confirm root migrations and app migrations are synchronized.
- Require backup/export evidence before apply.
- Require a dry-run or local apply check before production apply.
- Require manual approval before production apply.
- Require online smoke execution after apply.
- Define stop conditions and evidence collection.

## 3. Non-goals

- No production migration apply in this PR.
- No deploy.
- No Cloudflare config changes.
- No Telegram config changes.
- No executor enablement.
- No testnet executor enablement.
- No live executor enablement.
- No signing.
- No broadcasting.
- No private keys, seed phrases, or mnemonics.
- No custody behavior.
- No Agent control of a user's main wallet.

## 4. Preconditions

- PR #28 is merged to `main`.
- The release candidate commit is recorded in the launch readiness report.
- `npm run typecheck`, `npm run build`, and all readiness verifiers pass.
- Production operator has Cloudflare account access and can confirm account, database, and environment out of band.
- Admin access for `https://1989.gb8.top` is available for post-apply checks.
- Online smoke operator has access to Mini App, Admin, API, and Telegram Bot surfaces.

## 5. Migration Files Included

- `apps/api-worker/migrations/0017_real_asset_agent_persistence_v1.sql`
- `migrations/0017_real_asset_agent_persistence_v1.sql`

These files must remain content-identical. Production apply must use the app worker migration path, while root migration sync exists for CI/static verification and repository-level migration drift detection.

## 6. Root Migration Sync Check

Before apply, confirm both migration files exist and have the same hash.

Root migration sync must exist because CI/static verification requires root migrations and app migrations to stay synchronized. Production apply must also confirm both sides are identical so the reviewed SQL is the SQL being applied.

Required evidence:

- Hash for `apps/api-worker/migrations/0017_real_asset_agent_persistence_v1.sql`.
- Hash for `migrations/0017_real_asset_agent_persistence_v1.sql`.
- `npm run verify:static-v1` result.
- `npm run verify:production-d1-smoke-readiness-v1` result.

## 7. Cloudflare D1 Target Confirmation

Before any production apply, the operator must confirm:

- Cloudflare account name / ID.
- Worker config path: `apps/api-worker/wrangler.jsonc`.
- Environment: `production`.
- Binding: `DB`.
- Production route: `https://api.gb8.top`.
- Configured production D1 database name and ID match the intended target.
- No staging, dev, or placeholder database is being selected accidentally.

The current repository config must be treated as an input to verify, not as sufficient approval by itself.

## 8. Backup / Export Requirement

Production D1 backup/export is required before apply.

Minimum evidence:

- Export command or Cloudflare backup method used.
- Export timestamp.
- Output location.
- Operator.
- Confirmation that export completed successfully.
- Confirmation that the export covers critical operational tables and Real Asset Agent tables after they exist.

If backup/export fails, stop the change.

## 9. Dry-run / Local Apply Requirement

Before production apply, run a dry-run or local apply against a disposable/local D1 target using the same migration order.

Required checks:

- Migration order includes `0017_real_asset_agent_persistence_v1.sql` after `0016_research_brief_runtime_v1.sql`.
- SQL applies cleanly on an empty/local schema path.
- SQL applies cleanly on a clone or representative schema when available.
- No destructive SQL is introduced.
- No credential columns are introduced for private keys, seed phrases, mnemonics, custody secrets, or user main-wallet credentials.

## 10. Production Apply Manual Approval Step

Production apply requires explicit human approval in the launch readiness report before execution.

Approval must include:

- Release candidate commit.
- Migration file hashes.
- Cloudflare account/database/environment confirmation.
- Backup/export evidence.
- Dry-run/local apply evidence.
- Named operator and approver.
- Scheduled change window.

This PR does not execute production migration apply. A human operator must make the final production apply decision.

## 11. Post-apply Verification

After apply, run online smoke using `docs/ONLINE_SMOKE_TEST_V1.md`.

Post-apply checks must confirm:

- Mini App opens at `https://app.gb8.top`.
- Admin opens at `https://1989.gb8.top`.
- API health and admin Real Asset endpoints are reachable at `https://api.gb8.top`.
- Telegram Bot `@G2047_bot` can open the Mini App.
- Admin Risk Console, Review Queue, and Executor Readiness Gate do not misdisplay executor enabled.
- `executorEnabled`, `testnetExecutorEnabled`, and `liveExecutorEnabled` remain false.
- No signing, broadcasting, custody, private-key handling, seed phrase handling, mnemonic handling, or user main-wallet control appears.

## 12. Rollback / Mitigation Plan

Because D1 schema rollback can be risky, rollback must be mitigation-first:

- Stop launch if smoke fails.
- Preserve backup/export artifacts.
- Capture failing endpoint responses and screenshots.
- Keep executor disabled.
- Keep Admin Review Queue and Risk Console as review gates.
- Disable affected UI entry points only through already approved operational controls.
- Escalate to engineering before any rollback SQL.

Rollback SQL must be separately reviewed and approved. Do not improvise destructive production SQL.

## 13. Stop Conditions

Stop immediately if:

- Production D1 target cannot be confirmed.
- Migration order cannot be confirmed.
- Root and app migration hashes differ.
- Backup/export is missing or failed.
- Dry-run/local apply fails.
- Manual approval is missing.
- Any command would deploy.
- Any command would modify Cloudflare config.
- Any command would modify Telegram config.
- Any step requires enabling executor, testnet executor, or live executor.
- Any step requires signing or broadcasting.
- Any step requires private key, seed phrase, or mnemonic handling.
- Any step introduces custody or user main wallet control.
- Admin Review Queue or Risk Console is bypassed.
- Online smoke returns `FAIL` or unresolved `BLOCKED`.

## 14. Responsible Operator Checklist

| Item | Status | Evidence | Operator | Time |
| --- | --- | --- | --- | --- |
| Release candidate commit recorded | TODO |  |  |  |
| Migration hashes match | TODO |  |  |  |
| Cloudflare account confirmed | TODO |  |  |  |
| Production D1 database confirmed | TODO |  |  |  |
| Environment confirmed as production | TODO |  |  |  |
| Backup/export completed | TODO |  |  |  |
| Dry-run/local apply completed | TODO |  |  |  |
| Manual approval recorded | TODO |  |  |  |
| Production apply completed by human operator | TODO |  |  |  |
| Online smoke completed | TODO |  |  |  |
| Smoke report archived | TODO |  |  |  |

## 15. Evidence Collection Checklist

- Release candidate commit.
- PR link.
- Migration hashes.
- Cloudflare account/database/environment confirmation.
- Backup/export location.
- Dry-run/local apply output.
- Production apply approval note.
- Online smoke report.
- Admin screenshots for Risk Console, Review Queue, and Executor Readiness Gate.
- API responses showing `executorEnabled: false`, `testnetExecutorEnabled: false`, `liveExecutorEnabled: false`, and `liveExecution: false`.
- Mini App screenshots showing isolated / simulated / policy-limited Agent Wallet posture.
- Telegram Bot screenshot or recording showing Mini App open flow.
