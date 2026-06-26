# API Contract (Legacy / Superseded)

> Status: legacy. Replaced by [GBot Canonical V1](./GBOT_CANONICAL_V1.md) and the real-asset wallet/economy docs.

This document is preserved for historical reference only.

Legacy field names in the examples below, including `pendingPoints`, `basePendingPoints`, `pending_points`, `priceCurrency`, and `paymentProvider`, are compatibility shapes only.
New implementation should start from [GBot Canonical V1](./GBOT_CANONICAL_V1.md), not from this historical contract.

## Real Asset Agent V1 Compatibility Boundary

Current implementation must expose new canonical response fields where safe while preserving legacy UI fields temporarily:

- `assetBalances`: balances for `G`, `TON`, and `AI_CREDIT`.
- `agentWallet`: isolated Agent Wallet or linked observation profile.
- `walletPolicy`: policy guard contract with `autoPurchaseEnabled`, per-transaction and daily limits, minimum reserve, allowlisted assets/contracts/providers/purchase types, confirmation threshold, admin/user pause controls, risk mode, and status.
- `aiCreditBalance`: AI Credit balance snapshots for future WorkRun consumption.
- `skillCardSummary`: canonical 31-card counts: 12 Normal, 12 Advanced, 7 Expert.
- `purchaseIntentSummary`: counts by intent status.

Canonical wallet scaffold endpoints:

- `GET /agents/:agentId/wallet/policy`
- `PUT /agents/:agentId/wallet/policy`
- `GET /agents/:agentId/wallet/assets`
- `GET /agents/:agentId/wallet/intents`
- `POST /agents/:agentId/wallet/intents/simulate`

These endpoints are policy/simulation scaffolds only. They must not execute live mainnet transactions, store seed phrases, store user main wallet private keys, or allow the Agent to control the user's main wallet.

Admin Risk Console V1 is a review surface for the same canonical model. It may display Agent Wallet policy, global pause state, asset/provider/contract/purchase-type allowlists, simulated onchain intents, AI Model Token purchase intents, policy decisions, and transaction/audit events. In this phase the console must distinguish simulated scaffold data from any future live executor and must not present GP as the active product economy.

Canonical AI Model Token purchase flow:

1. Agent estimates a task needs AI capacity.
2. Agent checks `AI_CREDIT` balance.
3. If insufficient, Agent proposes an `AiModelTokenPurchaseIntent` denominated in `G`.
4. Policy Guard evaluates the intent.
5. A future executor may purchase AI Model Tokens only when the decision allows execution.
6. Purchase result and audit event are recorded.
7. Agent consumes AI Credits during WorkRun.
8. Work Report references intent, purchase, and usage evidence.

`GP`, `pending_points`, and `point_ledger_events` are legacy compatibility paths only. New product APIs should use `G`, `TON`, `AI_CREDIT`, Skill Cards, Agent Wallet policy, and intent/audit evidence. Work Report settlement should migrate from GP settlement to real-asset intent / transaction / AI Credit evidence while old verification remains temporarily supported until `verify:real-asset-agent-v1` replaces GP-era semantics.

## 1. Purpose

This document defines the first API contract for GrowthBot V0.

The API must support:

- Telegram Mini App frontend.
- Telegram Bot service.
- Admin console.
- Future TON integration.

All economic mutations must be idempotent where possible and recorded in ledgers/events.

## 2. Auth

### 2.1 Telegram Mini App Auth

Endpoint:

`POST /auth/telegram`

Request:

```json
{
  "initData": "telegram_init_data",
  "startParam": "ref_123_or_group_456"
}
```

Response:

```json
{
  "accessToken": "jwt",
  "user": {
    "id": "user_123",
    "telegramId": "123456789",
    "username": "alice",
    "languageCode": "en",
    "hasAgent": false
  }
}
```

Notes:

- Server must verify Telegram init data.
- Store referral start param on first valid session.

## 3. User and Agent

### 3.1 Get Current User

`GET /me`

Response:

```json
{
  "user": {
    "id": "user_123",
    "telegramId": "123456789",
    "username": "alice",
    "rankTier": "top_50",
    "riskStatus": "normal"
  },
  "agent": {
    "id": "agent_123",
    "name": "Agent #123",
    "level": 1,
    "energy": 100,
    "maxEnergy": 150,
    "pendingPoints": 420,
    "userScore": 300,
    "autoRunUntil": "2026-06-17T00:00:00Z"
  }
}
```

### 3.2 Claim Free Agent

`POST /agents/claim`

Response:

```json
{
  "agent": {
    "id": "agent_123",
    "level": 1,
    "energy": 100,
    "maxEnergy": 150
  },
  "starterBox": {
    "id": "item_123",
    "boxType": "starter_box"
  }
}
```

Rules:

- One free Agent per Telegram user.
- One Starter Box per user.
- Duplicate calls return existing Agent and unopened Starter Box if available.

## 4. Boxes and Inventory

### 4.1 List Inventory

`GET /inventory`

Response:

```json
{
  "items": [
    {
      "id": "item_123",
      "type": "box",
      "name": "Starter Box",
      "rarity": "common",
      "transferable": false,
      "expiresAt": null,
      "status": "available"
    }
  ]
}
```

### 4.2 Open Box

`POST /boxes/{inventoryItemId}/open`

Response:

```json
{
  "openingId": "opening_123",
  "box": {
    "id": "item_123",
    "name": "Starter Box"
  },
  "rewards": [
    {
      "type": "pending_points",
      "amount": 300
    },
    {
      "type": "energy",
      "amount": 50
    },
    {
      "type": "ability",
      "itemId": "item_456",
      "name": "24h Auto Farmer",
      "rarity": "common"
    }
  ],
  "agent": {
    "energy": 150,
    "pendingPoints": 300
  }
}
```

Rules:

- Opening burns the box item.
- Rewards create ledger events.
- Paid/high-value boxes should eventually use verifiable randomness.

## 5. Farming and Tasks

### 5.1 List Available Tasks

`GET /tasks/available`

Response:

```json
{
  "tasks": [
    {
      "id": "task_daily_checkin",
      "name": "Daily Check-in",
      "energyCost": 10,
      "basePendingPoints": 100,
      "projectId": null,
      "requiresWallet": false,
      "autoExecutable": true,
      "endsAt": null
    }
  ]
}
```

### 5.2 Run Farming

`POST /agents/{agentId}/farm`

Request:

```json
{
  "taskIds": ["task_daily_checkin", "task_visit_pool"],
  "abilityItemIds": ["item_456"]
}
```

Response:

```json
{
  "runId": "run_123",
  "completedTasks": 2,
  "energySpent": 30,
  "pendingPointsEarned": 420,
  "appliedMultiplier": 1.2,
  "agent": {
    "energy": 120,
    "pendingPoints": 720,
    "rankTier": "top_50"
  }
}
```

Rules:

- Check task eligibility.
- Check Energy balance.
- Apply ability stacking rules.
- Emit point ledger and task execution events.

## 6. Leaderboard

### 6.1 Get Leaderboard

`GET /leaderboard?scope=global&period=daily`

Response:

```json
{
  "scope": "global",
  "period": "daily",
  "currentUser": {
    "rank": 4821,
    "rankTier": "top_20",
    "pointsToNextTier": 680
  },
  "rows": [
    {
      "rank": 1,
      "displayName": "alpha_user",
      "score": 98200
    }
  ]
}
```

## 7. Group Pool

### 7.1 Join or Create Group Pool

`POST /groups/pools/join`

Request:

```json
{
  "telegramGroupId": "-100123456789",
  "startParam": "group_abc"
}
```

Response:

```json
{
  "pool": {
    "id": "pool_123",
    "telegramGroupId": "-100123456789",
    "memberCount": 12,
    "dailyScore": 14200,
    "rank": 81,
    "boostMultiplier": 1.1
  }
}
```

## 8. Marketplace

### 8.1 List Marketplace Items

`GET /marketplace/listings`

Query:

- `assetType`
- `rarity`
- `sort`
- `page`

Response:

```json
{
  "stats": {
    "floorPrice": "12.5",
    "volume24h": "842.0",
    "currency": "POINT_TEST"
  },
  "listings": [
    {
      "id": "listing_123",
      "assetItemId": "item_789",
      "name": "Alpha Box",
      "rarity": "rare",
      "price": "12.5",
      "currency": "POINT_TEST",
      "seller": "alice",
      "expiresAt": "2026-06-17T00:00:00Z"
    }
  ]
}
```

### 8.2 Create Listing

`POST /marketplace/listings`

Request:

```json
{
  "inventoryItemId": "item_789",
  "price": "12.5",
  "currency": "POINT_TEST",
  "expiresAt": "2026-06-17T00:00:00Z"
}
```

### 8.3 Buy Listing

`POST /marketplace/listings/{listingId}/buy`

Response:

```json
{
  "tradeId": "trade_123",
  "item": {
    "id": "item_789",
    "ownerUserId": "user_buyer"
  },
  "fee": "0.3125"
}
```

## 9. Admin API

Admin endpoints should be protected by admin auth and audit logs.

Required:

- `POST /admin/tasks`
- `POST /admin/boxes`
- `POST /admin/abilities`
- `GET /admin/users`
- `GET /admin/ledger`
- `GET /admin/marketplace/trades`
- `POST /admin/users/{id}/risk-status`

## 10. Error Format

```json
{
  "error": {
    "code": "insufficient_energy",
    "message": "Your Agent does not have enough Energy.",
    "details": {
      "required": 30,
      "available": 10
    }
  }
}
```

Common error codes:

- `unauthorized`
- `agent_already_claimed`
- `box_already_opened`
- `insufficient_energy`
- `task_not_available`
- `ability_not_applicable`
- `item_not_transferable`
- `listing_not_available`
- `risk_restricted`
