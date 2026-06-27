# Real Asset DB Persistence Plan V1

> Status: planning and local scaffold. This plan does not mutate production D1.

## 1. Purpose

Real Asset Agent V1 needs durable records before any executor can move from simulation into testnet. This plan defines the first DB-backed persistence scaffold for Agent Wallet policy, asset state, intent ledgers, AI Model Token purchase records, AI Credit usage, Work Report evidence, and Admin Risk audit events.

This PR prepares schema, docs, TypeScript row mappings, and verification only. It does not apply a production migration, does not enable a testnet executor, and does not add live chain execution.

## 2. Scope

- Define a local migration scaffold for future Real Asset Agent persistence tables.
- Document table ownership, privacy boundaries, append-only strategy, and rollout gates.
- Add deterministic TypeScript row mappers so future runtime wiring has a typed target.
- Keep the current simulated Admin Risk Console and wallet runtime working.

## 3. Non-goals

- No production D1 mutation.
- No production migration apply.
- No deploy.
- No Cloudflare config changes.
- No Telegram config changes.
- No TON testnet executor.
- No live mainnet executor.
- No chain signing.
- No private keys, seed phrases, mnemonics, custody data, or user main-wallet credentials.
- No Agent control of the user's main wallet.
- No destructive GP / pending_points removal.

## 4. Production Safety Boundary

This plan does not mutate production D1. The migration scaffold is local/planning only in this PR. This runtime DB wiring pass is fallback-first: missing rows or tables must not break the simulated runtime. Production rollout requires a separate explicitly approved PR and an explicit migration apply step. No private keys are stored. No seed phrases are stored. No mnemonics are stored. No user main wallet control is introduced. Amounts are stored as strings / smallest-unit text, not floating point.

Policy Guard, a durable audit log, a transaction status tracker, an Admin review queue, a global pause, and rollback runbook coverage are required before any testnet executor.

## 5. Architecture Overview

The persistence layer is split into mutable policy/snapshot tables and append-only event tables. Policy tables keep the latest user-authorized limits and pause state. Intent and event tables preserve the lifecycle from proposed action through policy decision and post-execution status. Evidence tables connect Work Reports and Admin Risk Console review surfaces to durable records.

The first runtime after this scaffold should write through typed mapper helpers, read back from DB where available, and fall back to current simulated builders only where explicitly safe.
The Admin Review Queue in this phase is simulated-only and audit-only.

## 6. Proposed Tables

1. agent_wallet_policies
2. wallet_asset_snapshots
3. asset_ledger_events
4. onchain_transaction_intents
5. onchain_transaction_events
6. ai_model_token_products
7. ai_model_token_purchase_intents
8. ai_model_token_purchase_results
9. ai_credit_balances
10. ai_credit_usage_events
11. work_report_evidence_events
12. admin_risk_audit_events

## 7. Table-by-table Schema Details

### agent_wallet_policies

- Purpose: Persist policy guard limits and pause controls for one Agent Wallet.
- Primary key: id.
- Foreign keys / relationships: user_id -> users.id, agent_id -> agents.id, wallet_id -> agent_wallets.id when present.
- Important columns: status, risk_mode, auto_purchase_enabled, per_transaction_limit_amount, daily_limit_amount, minimum_reserve_amount, allowlist JSON columns, require_confirmation_above_amount, admin_global_pause, user_paused, metadata_json, created_at, updated_at.
- Indexes: user_id, agent_id, wallet_id, status, updated_at.
- Append-only: no. This is the current policy state; audit changes separately.
- Retention: retain current rows indefinitely and preserve changes via admin_risk_audit_events.
- Privacy/security notes: stores policy only; no private keys, seed phrases, mnemonics, custody data, or user main-wallet credentials.
- Required before testnet executor: yes.
- Shared type mapping: AgentWalletPolicy and AdminRealAssetWalletPolicyRow.

### wallet_asset_snapshots

- Purpose: Store observed balance snapshots for G, TON, and AI_CREDIT by wallet.
- Primary key: id.
- Foreign keys / relationships: user_id -> users.id, agent_id -> agents.id, wallet_id -> agent_wallets.id.
- Important columns: asset_symbol, amount, decimals, source, metadata_json, created_at.
- Indexes: user_id, agent_id, wallet_id, asset_symbol, created_at.
- Append-only: yes; each row is a point-in-time observation.
- Retention: retain for audit and support; consider compaction only after export policy exists.
- Privacy/security notes: stores balances and source metadata only, never signing material.
- Required before testnet executor: yes.
- Shared type mapping: AgentWalletAssetSnapshot and AssetBalance.

### asset_ledger_events

- Purpose: Append-only ledger for deposits, reservations, releases, spends, purchases, usage, refunds, adjustments, and audit events.
- Primary key: id.
- Foreign keys / relationships: user_id -> users.id, agent_id -> agents.id, wallet_id -> agent_wallets.id, related intent/transaction/purchase IDs.
- Important columns: event_type, asset_symbol, amount, decimals, direction, status, related_intent_id, related_transaction_id, related_purchase_intent_id, metadata_json, created_at.
- Indexes: user_id, agent_id, wallet_id, event_type, status, created_at, related_intent_id, related_transaction_id, related_purchase_intent_id.
- Append-only: yes.
- Retention: indefinite economic/audit history.
- Privacy/security notes: stores amount strings and references only; no credentials.
- Required before testnet executor: yes.
- Shared type mapping: AssetLedgerEvent.

### onchain_transaction_intents

- Purpose: Durable pre-execution intent record evaluated by Policy Guard.
- Primary key: id.
- Foreign keys / relationships: user_id -> users.id, agent_id -> agents.id, wallet_id -> agent_wallets.id.
- Important columns: chain, network, asset_symbol, amount, decimals, to_address, contract_address, intent_type, status, policy_decision_json, requires_confirmation, metadata_json, created_at, updated_at.
- Indexes: user_id, agent_id, wallet_id, status, intent_type, created_at.
- Append-only: no for status updates, but status transitions must also produce events/audit records.
- Retention: indefinite.
- Privacy/security notes: stores destination/contract references only; no private material.
- Required before testnet executor: yes.
- Shared type mapping: OnchainTransactionIntent.

### onchain_transaction_events

- Purpose: Post-intent transaction status history, including future tx hashes and explorer references.
- Primary key: id.
- Foreign keys / relationships: intent_id -> onchain_transaction_intents.id, user_id -> users.id, agent_id -> agents.id, wallet_id -> agent_wallets.id.
- Important columns: chain, network, tx_hash, status, explorer_url, raw_event_json, metadata_json, created_at.
- Indexes: user_id, agent_id, wallet_id, intent_id, tx_hash, status, created_at.
- Append-only: yes.
- Retention: indefinite transaction/audit history.
- Privacy/security notes: tx hashes and raw events are public-chain metadata; no credentials.
- Required before testnet executor: yes.
- Shared type mapping: OnchainTransactionEvent.

### ai_model_token_products

- Purpose: Catalog purchasable AI Model Token / AI Credit products denominated in G.
- Primary key: id.
- Foreign keys / relationships: referenced by ai_model_token_purchase_intents.product_id.
- Important columns: provider, model_id, purchase_type, asset_symbol, price_amount, price_decimals, credit_amount, status, metadata_json, created_at, updated_at.
- Indexes: provider, model_id, purchase_type, status.
- Append-only: no; product status and price can change with audit.
- Retention: retain historical product IDs referenced by intents.
- Privacy/security notes: public product metadata only.
- Required before testnet executor: yes for AI purchase execution.
- Shared type mapping: AiModelTokenProduct.

### ai_model_token_purchase_intents

- Purpose: Durable AI Model Token purchase requests evaluated by Policy Guard.
- Primary key: id.
- Foreign keys / relationships: product_id -> ai_model_token_products.id, user_id -> users.id, agent_id -> agents.id, wallet_id -> agent_wallets.id.
- Important columns: provider, model_id, purchase_type, asset_symbol, amount, decimals, status, policy_decision_json, purpose, metadata_json, created_at, updated_at.
- Indexes: user_id, agent_id, wallet_id, product_id, provider, model_id, status, created_at.
- Append-only: no for status updates, but transitions must be auditable.
- Retention: indefinite purchase/audit history.
- Privacy/security notes: spend intent data only; no provider API keys.
- Required before testnet executor: yes for AI purchases.
- Shared type mapping: AiModelTokenPurchaseIntent.

### ai_model_token_purchase_results

- Purpose: Record purchase outcome and granted AI_CREDIT after a purchase intent.
- Primary key: id.
- Foreign keys / relationships: purchase_intent_id -> ai_model_token_purchase_intents.id, related_transaction_event_id -> onchain_transaction_events.id when present.
- Important columns: user_id, agent_id, provider, model_id, status, credit_asset_symbol, credit_amount, credit_decimals, metadata_json, created_at.
- Indexes: purchase_intent_id, user_id, agent_id, provider, model_id, status, created_at.
- Append-only: yes.
- Retention: indefinite purchase/audit history.
- Privacy/security notes: receipt metadata only; no credentials.
- Required before testnet executor: yes for closing purchase loops.
- Shared type mapping: AiModelTokenPurchaseResult.

### ai_credit_balances

- Purpose: Store current AI_CREDIT balance by agent/provider/model.
- Primary key: id.
- Foreign keys / relationships: user_id -> users.id, agent_id -> agents.id.
- Important columns: provider, model_id, asset_symbol, amount, decimals, metadata_json, updated_at.
- Indexes: user_id, agent_id, provider, model_id, asset_symbol, updated_at.
- Append-only: no; current balance table paired with usage events.
- Retention: retain current state; historical changes live in usage and purchase result records.
- Privacy/security notes: balance only; no provider credentials.
- Required before testnet executor: yes for AI credit purchase/usage accounting.
- Shared type mapping: AiCreditBalance.

### ai_credit_usage_events

- Purpose: Append-only record of AI_CREDIT consumed during WorkRuns and Work Reports.
- Primary key: id.
- Foreign keys / relationships: user_id -> users.id, agent_id -> agents.id, work_run_id -> agent_work_runs.id, work_report_id future report ID.
- Important columns: provider, model_id, asset_symbol, amount, decimals, purpose, metadata_json, created_at.
- Indexes: user_id, agent_id, work_run_id, work_report_id, provider, model_id, created_at.
- Append-only: yes.
- Retention: indefinite evidence/accounting history.
- Privacy/security notes: usage amounts and evidence refs only.
- Required before testnet executor: yes for evidence-first accounting.
- Shared type mapping: AiCreditUsageEvent.

### work_report_evidence_events

- Purpose: Durable evidence rows that Work Reports can reference for policy, purchase, transaction, usage, and skill-card evidence.
- Primary key: id.
- Foreign keys / relationships: user_id -> users.id, agent_id -> agents.id, work_run_id -> agent_work_runs.id, related intent/transaction/purchase IDs.
- Important columns: evidence_type, status, title, summary, related_intent_id, related_transaction_id, related_purchase_intent_id, asset_symbol, amount, decimals, provider, model_id, skill_card_codes_json, metadata_json, created_at.
- Indexes: user_id, agent_id, work_run_id, work_report_id, evidence_type, status, related_intent_id, related_transaction_id, related_purchase_intent_id, created_at.
- Append-only: yes.
- Retention: indefinite Work Report evidence history.
- Privacy/security notes: evidence metadata only; no secrets or credentials.
- Required before testnet executor: yes for evidence-first rollout.
- Shared type mapping: RealAssetEvidence and Work Report evidence drafts.

### admin_risk_audit_events

- Purpose: Durable Admin Risk Console audit trail for policy, review, and safety decisions.
- Primary key: id.
- Foreign keys / relationships: target_type/target_id may point to agents, wallets, policies, intents, or config records.
- Important columns: event_type, actor, target_type, target_id, summary, status, metadata_json, created_at.
- Indexes: event_type, actor, target_type, target_id, status, created_at.
- Append-only: yes.
- Retention: indefinite admin audit history.
- Privacy/security notes: operator/action metadata only; no private keys, seed phrases, or main-wallet credentials.
- Required before testnet executor: yes.
- Shared type mapping: AdminRealAssetAuditEvent.

## 8. Data Ownership and Privacy Notes

Users own their main wallet and keep root control. Agent Wallet records are isolated operational profiles and policy envelopes. The DB must never store private keys, seed phrases, mnemonics, custody secrets, or user main-wallet credentials. Provider API keys are also outside this schema. Balance and transaction metadata should be treated as sensitive operational data even when derived from public-chain facts.

## 9. Append-only Ledger/Event Strategy

Asset ledger events, wallet snapshots, transaction events, purchase results, AI Credit usage, Work Report evidence, and admin audit events are append-only. Intent and policy rows may update status/current state, but every meaningful transition must emit an append-only event or audit record before executor rollout.

## 10. Legacy GP / pending_points Compatibility Strategy

GP, pending_points, and point_ledger_events remain legacy compatibility paths only. This scaffold does not destructively remove historical tables or compatibility fields. New Real Asset Agent persistence uses G, TON, AI_CREDIT, Agent Wallet policy, intent records, and evidence events as the canonical data path.

## 11. Local Migration Scaffold Plan

The migration file in this PR is local scaffold / planning only and is not applied to production. It uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS, stores amounts as TEXT strings, and avoids destructive statements against historical tables.

## 12. TypeScript Mapping Plan

The mapper scaffold converts shared types into row shapes and back without DB writes. JSON fields parse with safe fallbacks. Amount strings remain strings and are never converted to floating point. Optional context parameters provide DB-only fields such as user_id, wallet_id, chain, network, source, direction, and status where the shared type lacks them.

## 13. Verification Plan

- npm run typecheck
- npm run build
- npm run verify:work-report
- npm run verify:real-asset-agent-v1
- npm run verify:real-asset-db-persistence-v1

The DB persistence verifier checks required docs, migration tables, mapper functions, safety phrases, prohibited terms, and destructive SQL statements.

## 14. Rollback Strategy

Because this PR does not apply production migrations, rollback is removing the scaffold PR from the branch. Future production rollout must include a rollback runbook, backup/export step, migration dry run, and explicit decision point before apply.

## 15. Future Production Rollout Checklist

- Approve a separate production migration PR.
- Run local and staging migration validation.
- Export production D1 backup before apply.
- Confirm no prohibited credential columns exist.
- Confirm Policy Guard writes durable policy and intent records.
- Confirm audit and transaction status tracking are durable.
- Confirm Admin global pause and rollback runbook are operational.
- Confirm Work Report evidence reads durable records.

## 16. Future Testnet Executor Prerequisites

Testnet executor remains blocked until DB-backed policy persistence exists, durable intent ledger exists, durable audit log exists, tx status tracker exists, Admin review queue exists, global pause exists, and rollback runbook exists. The executor must not start from simulated-only state.

## 17. Open Questions

- Which production migration window and approval process will be used?
- What retention/export policy should apply to snapshots after long-running usage?
- How will Admin review queue assignment and escalation be modeled?
- Which provider/model catalog source will seed ai_model_token_products?
- What staging dataset should validate Work Report evidence reads before production rollout?
