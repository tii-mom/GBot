# GP Removal Plan

> Status: Phase 1 migration plan for the canonical reset.

## Summary

`GP` is no longer the canonical product economy.

The new canonical direction is:

- `G` is the real on-chain spending asset.
- `TON` is the gas asset.
- `Skill Cards` are the public capability assets.
- `Agent Wallet` is isolated from the user main wallet.

Legacy GP-era docs and code may remain for historical traceability, but they must stop being treated as product truth.

## What Phase 1 Changes

- Add the new canonical docs.
- Mark legacy GP docs as superseded.
- Update README and doc entry points to the new canon.
- Preserve migrations, backups, and exports.
- Do not deploy.
- Do not touch production D1.
- Do not touch Telegram config.
- Do not implement live chain transaction code.

## V1 Compatibility Contract Update

The implementation convergence pass adds shared real-asset contracts and backend scaffold responses while leaving destructive GP removal for later PRs.

- `GP`, `pending_points`, and `point_ledger_events` remain only as legacy compatibility paths.
- New product contracts use `G`, `TON`, `AI_CREDIT`, isolated Agent Wallet policy, intent status, AI Model Token purchase intents, AI Credit usage, and the canonical 31 Skill Cards.
- Backend compatibility helpers should encapsulate legacy ledger behavior instead of exposing it as current product truth.
- Work Report should migrate from GP settlement to real-asset intent / transaction / AI Credit evidence.
- Existing GP-era verification remains temporary until `verify:real-asset-agent-v1` is the canonical replacement.

## Files Still Referencing GP / pending_points / point_ledger_events

These remain to be migrated in later PRs:

- API worker core and feature modules.
- Mini app runtime and product views.
- Admin console price tables and order views.
- Legacy docs and test scripts.
- Schema and migration files that still encode the old ledger model.

### Reference Matrix

#### GP

- Raw file count: 42
- High-signal entry points: `apps/api-worker/src/index.ts`, `apps/admin/src/main.tsx`, `apps/miniapp/src/apiClient.ts`, `scripts/verify-skill-economy.mjs`
- Why not in this PR: these are runtime, UI, and historical migration references that would require product and compatibility changes outside docs-only scope.
- Recommended follow-up PR slice: PR C `Admin / Miniapp Copy Cleanup` and PR D `Migration / Historical Schema Documentation Only`
- Priority: P1

#### pending_points

- Raw file count: 20
- High-signal entry points: `apps/api-worker/src/index.ts`, `apps/api-worker/src/v1/core.ts`, `apps/api-worker/src/v1/skill-economy.ts`, `apps/miniapp/src/apiClient.ts`
- Why not in this PR: removing or reinterpreting `pending_points` would change settled API and ledger semantics, which belongs in a compatibility-layer PR.
- Recommended follow-up PR slice: PR A `Shared Terminology / API Contract Cleanup` and PR B `Backend Ledger Compatibility Layer`
- Priority: P0

#### point_ledger_events

- Raw file count: 12
- High-signal entry points: `apps/api-worker/src/index.ts`, `apps/api-worker/src/v1/core.ts`, `apps/api-worker/src/v1/skill-economy.ts`, `apps/api-worker/src/v1/store.ts`, `apps/api-worker/src/v1/workflow.ts`
- Why not in this PR: this is the append-only historical ledger model and migration of its meaning needs a backend compatibility pass, not documentation-only cleanup.
- Recommended follow-up PR slice: PR B `Backend Ledger Compatibility Layer` and PR D `Migration / Historical Schema Documentation Only`
- Priority: P0

## Backend Modules For Later PRs

- `apps/api-worker/src/index.ts`
- `apps/api-worker/src/v1/core.ts`
- `apps/api-worker/src/v1/skill-economy.ts`
- `apps/api-worker/src/v1/store.ts`
- `apps/api-worker/src/v1/workflow.ts`
- `apps/api-worker/src/v1/wallet.ts`
- `apps/api-worker/src/v1/skill-runtime-seed.ts`
- `apps/api-worker/src/v1/skill.ts`
- `scripts/verify-skill-catalog.mjs`
- `scripts/verify-work-report.mjs`

## Frontend Views For Later PRs

- `apps/miniapp/src/apiClient.ts`
- `apps/miniapp/src/components/HomeView.tsx`
- `apps/miniapp/src/components/StoreView.tsx`
- `apps/miniapp/src/components/InventoryView.tsx`
- `apps/miniapp/src/components/MarketplaceView.tsx`
- `apps/miniapp/src/components/EarnView.tsx`
- `apps/miniapp/src/components/AgentWorkView.tsx`
- `apps/miniapp/src/components/BoxOpeningView.tsx`
- `apps/miniapp/src/components/runtime/index.tsx`
- `apps/miniapp/src/components/runtime/views/WorkspaceView.tsx`
- `apps/miniapp/src/components/runtime/views/NetworkView.tsx`
- `apps/miniapp/src/components/runtime/views/TasksView.tsx`
- `apps/miniapp/src/components/runtime/views/WorkReportDetail.tsx`
- `apps/admin/src/main.tsx`

## Tables And Columns To Deprecate Or Migrate

- `point_ledger_events.point_type`
- `agents.pending_points`
- `task_executions.pending_points_earned`
- `task_executions.base_pending_points`
- `boxes.price_currency` when it is still treated as GP
- `box_orders.currency` when it is still treated as GP
- `box_orders.payment_provider` when it assumes GP balance
- any settlement logic that derives rewards from pending points

## Next PR Sequence

1. Update backend vocabulary, ledgers, and policy guard surfaces to the new `G` / TON contract.
2. Replace GP-era wallet and settlement assumptions with real asset intent and execution records.
3. Update mini app and admin copy to the new canonical economy.
4. Introduce replacement verification that checks the real asset agent contract instead of the GP work-report contract.
5. Add a new health/API verification path for the canonical real-asset model once compatibility layers exist.

## Suggested PR Slices

### PR A: Shared Terminology / API Contract Cleanup

- Scope: `packages/shared/src/index.ts`, `docs/API_CONTRACT.md`, `apps/miniapp/src/apiClient.ts`
- Goal: unify new terminology without breaking compatibility fields.
- Priority: P0

### PR B: Backend Ledger Compatibility Layer

- Scope: `apps/api-worker/src/index.ts`, `apps/api-worker/src/v1/core.ts`, `apps/api-worker/src/v1/skill-economy.ts`, `apps/api-worker/src/v1/store.ts`, `apps/api-worker/src/v1/workflow.ts`
- Goal: encapsulate `point_ledger_events` and `pending_points` semantics behind compatibility code rather than presenting them as product truth.
- Priority: P0

### PR C: Admin / Miniapp Copy Cleanup

- Scope: `apps/admin/src/main.tsx`, `apps/miniapp` related views
- Goal: remove user-visible GP-era narration while preserving necessary compatibility display.
- Priority: P1

### PR D: Migration / Historical Schema Documentation Only

- Scope: `migrations/`
- Goal: document historical schema behavior only; do not modify migrations in this PR.
- Priority: P2

### PR E: Production Deploy Alignment

- Scope: deployment readiness and config review only after compatibility work lands.
- Goal: align deploy sequence with canonical docs and avoid accidental product truth drift.
- Priority: P1

### PR F: Research Brief Native API

- Scope: research brief API behavior and canonical verification surfaces.
- Goal: replace legacy work-report assumptions with native canonical API behavior.
- Priority: P1

### PR G: API Health Endpoint

- Scope: platform health and canonical readiness checks.
- Goal: add a health endpoint that reflects canonical product readiness without exposing legacy semantics as truth.
- Priority: P2

## Suggested Validation

- `npm run typecheck`
- `npm run build`
- `npm run verify:work-report` if the old report remains temporarily supported
- otherwise, add `npm run verify:real-asset-agent-v1` as the replacement


## Real Asset DB Persistence V1 Compatibility Note

The DB persistence scaffold keeps GP / pending_points as legacy compatibility paths only. It does not destructively remove historical migrations or point_ledger_events. New Real Asset Agent persistence should use G, TON, AI_CREDIT, Agent Wallet policy, intent records, Work Report evidence, and Admin Risk audit events. Production D1 is not mutated by the local scaffold, and future rollout requires an explicit approved migration-apply PR.
