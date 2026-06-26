# V0 Scope (Legacy / Superseded)

> Status: legacy. Replaced by [GBot Canonical V1](./GBOT_CANONICAL_V1.md).

This document is preserved for historical reference only.

## 1. V0 Objective

V0 should prove the Telegram growth loop:

> Claim Agent -> Open Box -> Run Missions -> Share Report -> Invite Users -> Join Crew -> Upgrade with Box or Skill.

V0 should not attempt to prove full autonomous on-chain execution.

## 2. Included Features

### 2.1 Telegram Bot

Included:

- `/start`.
- Referral deep links.
- Open Mini App button.
- Daily report message.
- Share copy generation.
- Basic Crew message.

Not included:

- Full AI chat.
- Bot-to-Bot workflow.
- Complex group moderation.

### 2.2 Mini App

Included screens:

- Agent Home.
- Starter Box opening.
- Inventory.
- Missions.
- Leaderboard.
- Crew.
- Marketplace.

Not included:

- Complex project research pages.
- Full portfolio analytics.
- Advanced strategy builder.

### 2.3 Agent System

Included:

- Free Agent creation.
- Level 1 Agent.
- Energy.
- Basic Skill slots.
- Rule-based task execution.
- Daily Mission runs result.

Not included:

- LLM-controlled task selection.
- Autonomous token swaps.
- External project crawling.

### 2.4 Points

Included:

- Pending Points.
- User Score.
- Basic rank.
- Referral rewards.
- Group pool rewards.

Not included:

- Full Claim Credits redemption.
- Tradable points.
- Project-specific token allocation.

### 2.5 Boxes and Abilities

Included:

- Starter Box.
- Alpha Box.
- Basic Skill cards.
- Inventory.
- Skill use.
- Skill expiry.

Not included:

- Complex crafting.
- Verifiable randomness.
- Multi-box fusion.

### 2.6 Marketplace

Included:

- Fixed-price listing.
- Buy listing.
- Cancel listing.
- Trade history.
- Floor price.
- Basic marketplace fee.

Tradable in V0:

- Unopened Alpha Boxes.
- Transferable Skill cards.

Not tradable in V0:

- Starter Box.
- User Score.
- Pending Points.
- Claim Credits.
- Agent itself.

### 2.7 Admin

Included:

- Create tasks.
- Create boxes.
- Edit drop tables.
- Create abilities.
- View users.
- View points ledger.
- View marketplace trades.

Not included:

- Full project self-serve portal.
- Advanced campaign analytics.

## 3. Deferred Features

Deferred to later:

- TON Connect.
- TON Pay.
- Stars payment.
- Agentic Wallet.
- Claim Credits redemption.
- Project self-serve dashboard.
- Skill rentals.
- Auctions.
- KOL squad system.
- AI strategy engine.

## 4. V0 Success Criteria

Activation:

- More than 60% of Bot starters claim an Agent.
- More than 70% of Agent claimers open Starter Box.

Virality:

- More than 20% of activated users share once.
- At least 15% of new users arrive from referrals or group links.

Retention:

- D1 retention above 15%.
- Daily report open rate above 25%.

Monetization:

- Alpha Box purchase conversion above 2% among activated users.
- Marketplace listing or purchase action from at least 5% of activated users.

## 5. V0 Non-Goals

V0 is not:

- A production trading bot.
- A guaranteed airdrop product.
- A full TON wallet product.
- A general quest platform.
- A financial return promise.

## 6. Engineering Constraint

All points, inventory, and marketplace changes must be recorded as events or ledger entries.

No critical economic state should be stored only as a mutable counter.
