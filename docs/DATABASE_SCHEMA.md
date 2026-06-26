# Database Schema (Legacy / Superseded)

> Status: legacy. Replaced by [GBot Canonical V1](./GBOT_CANONICAL_V1.md) and the real-asset wallet/economy docs.

This document is preserved for historical reference only.

## Real Asset Agent V1 Schema Direction

No production D1 mutation or historical migration deletion is part of this compatibility PR.

Current legacy tables such as `point_ledger_events`, `user_balance_snapshots.pending_points_balance`, GP-cost columns, box/store records, and historical exports remain compatibility-only. They must not be used as canonical product economics for new work.

Future schema work should add or map to real-asset tables/events for:

- `asset_balances` / `asset_ledger_events` tracking `G`, `TON`, and `AI_CREDIT`.
- isolated `agent_wallets` with wallet policy metadata, pause controls, allowlists, limits, and risk mode.
- `onchain_transaction_intents` and `onchain_transaction_events` for auditable intent-based execution.
- `ai_model_token_products`, `ai_model_token_purchase_intents`, `ai_model_token_purchase_results`, and `ai_credit_usage_events`.
- canonical Skill Card ownership/equipment state referencing the 31-card public catalog.

Work Reports should migrate from GP settlement rows to real-asset intent / transaction / AI Credit evidence. Old verification and GP-era settlement stay temporarily supported until `verify:real-asset-agent-v1` and the later ledger migration fully replace the compatibility path.

## 1. Principles

GrowthBot contains economic state. The database must preserve history.

Rules:

- Use ledger/event rows for points and inventory changes.
- Avoid silent mutable counters for economic state.
- Keep admin actions audited.
- Store Telegram ids separately from internal ids.

## 2. Core Tables

### users

Fields:

- `id`
- `telegram_id`
- `username`
- `first_name`
- `language_code`
- `created_at`
- `last_seen_at`
- `referrer_user_id`
- `entry_source`
- `risk_status`
- `risk_score`

### agents

Fields:

- `id`
- `user_id`
- `name`
- `level`
- `energy`
- `max_energy`
- `auto_run_until`
- `status`
- `created_at`
- `updated_at`

### point_ledger_events

Fields:

- `id`
- `user_id`
- `agent_id`
- `event_type`
- `point_type`
- `amount`
- `project_id`
- `source_id`
- `quality_multiplier`
- `risk_status`
- `metadata_json`
- `created_at`

Point types:

- `pending_points`
- `user_score`
- `claim_credits`
- `energy`

### inventory_items

Fields:

- `id`
- `owner_user_id`
- `item_type`
- `name`
- `rarity`
- `status`
- `transferable`
- `soulbound`
- `expires_at`
- `metadata_json`
- `created_at`
- `updated_at`

Item types:

- `box`
- `ability`
- `ticket`
- `energy_pack`
- `badge`

### boxes

Fields:

- `id`
- `code`
- `name`
- `box_type`
- `transferable_before_open`
- `paid`
- `supply_limit`
- `daily_supply_limit`
- `starts_at`
- `ends_at`
- `status`
- `created_at`

### box_drop_entries

Fields:

- `id`
- `box_id`
- `reward_type`
- `reward_code`
- `rarity`
- `weight`
- `min_amount`
- `max_amount`
- `transferable`
- `expires_in_seconds`
- `metadata_json`

### box_openings

Fields:

- `id`
- `user_id`
- `box_inventory_item_id`
- `box_id`
- `random_seed_hash`
- `rewards_json`
- `created_at`

### abilities

Fields:

- `id`
- `code`
- `name`
- `ability_type`
- `rarity`
- `duration_seconds`
- `uses`
- `stacking_group`
- `max_multiplier`
- `transferable`
- `metadata_json`
- `created_at`

### ability_activations

Fields:

- `id`
- `user_id`
- `agent_id`
- `inventory_item_id`
- `ability_id`
- `task_execution_id`
- `started_at`
- `expires_at`
- `uses_remaining`
- `status`

### tasks

Fields:

- `id`
- `project_id`
- `code`
- `name`
- `description`
- `task_type`
- `energy_cost`
- `base_pending_points`
- `requires_wallet`
- `auto_executable`
- `requires_user_confirmation`
- `risk_level`
- `starts_at`
- `ends_at`
- `daily_limit`
- `total_limit`
- `status`
- `metadata_json`

### task_executions

Fields:

- `id`
- `task_id`
- `user_id`
- `agent_id`
- `status`
- `energy_spent`
- `pending_points_earned`
- `applied_multiplier`
- `ability_ids_json`
- `verification_status`
- `created_at`
- `completed_at`

### projects

Fields:

- `id`
- `code`
- `name`
- `status`
- `telegram_url`
- `website_url`
- `starts_at`
- `ends_at`
- `metadata_json`
- `created_at`

## 3. Virality Tables

### referrals

Fields:

- `id`
- `referrer_user_id`
- `referred_user_id`
- `start_param`
- `status`
- `joined_at`
- `activated_at`
- `rewarded_at`
- `quality_status`

### telegram_groups

Fields:

- `id`
- `telegram_group_id`
- `title`
- `created_by_user_id`
- `created_at`
- `last_seen_at`

### group_pools

Fields:

- `id`
- `telegram_group_id`
- `period`
- `member_count`
- `daily_score`
- `boost_multiplier`
- `rank`
- `status`
- `created_at`

### group_pool_members

Fields:

- `id`
- `group_pool_id`
- `user_id`
- `contribution_score`
- `joined_at`
- `last_contributed_at`

## 4. Marketplace Tables

### marketplace_listings

Fields:

- `id`
- `seller_user_id`
- `inventory_item_id`
- `price`
- `currency`
- `status`
- `expires_at`
- `created_at`
- `cancelled_at`
- `sold_at`

### marketplace_trades

Fields:

- `id`
- `listing_id`
- `seller_user_id`
- `buyer_user_id`
- `inventory_item_id`
- `price`
- `currency`
- `fee_amount`
- `status`
- `created_at`

## 5. Wallet Tables

### wallets

Fields:

- `id`
- `user_id`
- `chain`
- `address`
- `wallet_type`
- `connected_at`
- `last_verified_at`
- `status`

### agentic_wallets

Fields:

- `id`
- `user_id`
- `agent_id`
- `owner_wallet_id`
- `agentic_address`
- `operator_id`
- `daily_spend_limit`
- `per_project_limit`
- `status`
- `created_at`
- `paused_at`

### wallet_action_logs

Fields:

- `id`
- `user_id`
- `agentic_wallet_id`
- `action_type`
- `risk_level`
- `project_id`
- `contract_address`
- `amount`
- `status`
- `tx_hash`
- `metadata_json`
- `created_at`

## 6. Analytics and Audit

### analytics_events

Fields:

- `id`
- `user_id`
- `event_name`
- `session_id`
- `source`
- `properties_json`
- `created_at`

### admin_audit_logs

Fields:

- `id`
- `admin_user_id`
- `action`
- `target_type`
- `target_id`
- `before_json`
- `after_json`
- `created_at`

## 7. Derived Counters

The app may cache:

- User pending point balance.
- User score balance.
- Energy balance.
- Leaderboard rank.
- Marketplace floor.

But cached counters must be rebuildable from source events.
