# GrowthBot System Architecture

## 1. Architecture Overview

GrowthBot combines Telegram Bot, Telegram Mini App, backend services, task execution, points accounting, marketplace, and TON integrations.

High-level flow:

```text
Telegram Bot
  -> Mini App
  -> GrowthBot Backend
  -> Agent Engine
  -> Points Ledger
  -> Box and Inventory Service
  -> Marketplace Service
  -> TON Integration Layer
  -> Project Task Pool
```

## 2. Main Components

### 2.1 Telegram Bot Service

Responsibilities:

- Handles `/start` and referral deep links.
- Sends onboarding messages.
- Sends daily Agent reports.
- Creates group mining pools.
- Tracks group interactions.
- Sends marketplace and launch-status alerts.
- Opens Mini App through inline buttons.

Data captured:

- Telegram user id.
- Username.
- Language.
- Start parameter.
- Group id, if used in group context.
- Referral source.
- Message interaction events.

### 2.2 Mini App Frontend

Responsibilities:

- Telegram login verification.
- Agent dashboard.
- Box opening animation.
- Inventory and ability management.
- Leaderboards.
- Marketplace.
- Wallet connection.
- Claim Credits.

Recommended first implementation:

- Mobile-first.
- Fast loading.
- Minimal copy.
- No wallet requirement for first session.

### 2.3 Backend API

Responsibilities:

- Auth session verification.
- User profile.
- Agent state.
- Points ledger.
- Box opening.
- Inventory updates.
- Marketplace listings.
- Task execution orchestration.
- Admin configuration.

Important rule:

- All point and inventory changes must be ledger-based, not simple mutable counters.

### 2.4 Agent Engine

Responsibilities:

- Select eligible tasks.
- Consume Energy.
- Apply abilities.
- Produce Pending Points.
- Generate reports.
- Queue on-chain actions when enabled.

MVP Agent should be rule-based.

AI model APIs can be added later for:

- Task prioritization.
- Risk summaries.
- Report generation.
- Project explanations.
- Strategy recommendations.

AI should not directly control fund-moving actions without hard rule checks.

### 2.5 Points Ledger

Point types:

- Pending Points.
- User Score.
- Claim Credits.

Ledger event examples:

- `agent_task_completed`
- `ability_used`
- `box_opened`
- `referral_verified`
- `group_pool_rewarded`
- `risk_settlement_approved`
- `claim_credit_redeemed`

Every event should include:

- User id.
- Agent id.
- Source.
- Amount.
- Related project id.
- Risk status.
- Timestamp.
- Metadata.

### 2.6 Box and Inventory Service

Responsibilities:

- Box sale and minting.
- Randomized opening.
- Drop table management.
- Ability issuance.
- Expiry tracking.
- Transfer restrictions.

Randomness requirement:

- MVP can use server-side randomness with transparent logs.
- Later versions should consider verifiable randomness for high-value boxes.

### 2.7 Marketplace Service

Responsibilities:

- Listings.
- Purchases.
- Rentals.
- Transfers.
- Fees.
- Price history.
- Floor price.
- Volume stats.

Supported MVP mode:

- Fixed-price listings.

Future modes:

- Auctions.
- Bundles.
- Rentals.
- Offers.
- Sweeps.

### 2.8 TON Integration Layer

Responsibilities:

- TON Connect.
- TON Pay.
- Wallet balance checks.
- Transaction creation.
- Transaction status tracking.
- Agentic Wallet deployment and policy setup.
- Approved contract interaction.

Integration stages:

1. Read-only wallet connection.
2. User-confirmed transactions.
3. Agentic Wallet creation.
4. Limited automated execution.

### 2.9 Project Task Pool

Projects define tasks:

- Task name.
- Project id.
- Reward type.
- Reward amount.
- Cost.
- Risk level.
- Start and end time.
- Eligibility.
- Required ability.
- Whether Agent can auto-execute.
- Whether user confirmation is required.

Task types:

- Telegram join.
- Daily check-in.
- Referral.
- Project interaction.
- Badge mint.
- Raffle entry.
- Claim.
- Vote.
- Mini App visit.
- Wallet connect.

## 3. Suggested Database Tables

Initial tables:

- `users`
- `agents`
- `agent_abilities`
- `boxes`
- `box_openings`
- `inventory_items`
- `point_ledger_events`
- `tasks`
- `task_executions`
- `projects`
- `referrals`
- `groups`
- `group_pools`
- `marketplace_listings`
- `marketplace_trades`
- `wallets`
- `agentic_wallets`
- `risk_events`

## 4. Security Principles

- Never store user main wallet private keys.
- Agentic Wallet must be isolated from the main wallet.
- Default budgets must be small.
- High-risk actions require explicit user confirmation.
- All agent actions must be logged.
- Users must be able to pause the Agent.
- Users must be able to withdraw unused funds from Agentic Wallet.
- Contract allowlists should gate auto-execution.

## 5. MVP Technical Recommendation

Start with:

- Telegram Bot.
- Telegram Mini App.
- Backend API.
- PostgreSQL.
- Redis for queues and rate limits.
- Rule-based Agent Engine.
- Off-chain points ledger.
- Basic marketplace.

Add TON Agentic Wallet after the growth loop is validated.
