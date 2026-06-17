# Backend Blueprint

## 1. Backend Responsibility

The GrowthBot backend owns all economic state.

Frontend must never calculate final rewards, ownership, rank, or marketplace settlement.

Backend responsibilities:

- Telegram auth verification.
- User and Agent lifecycle.
- Points ledger.
- Energy accounting.
- Box opening.
- Ability activation.
- Task execution.
- Referral and group pool accounting.
- Marketplace settlement.
- Admin operations.
- Queue and cron jobs.
- Future TON integration.

## 2. Recommended Stack

Runtime:

- Cloudflare Workers.

Framework:

- Hono or lightweight router.

Validation:

- Zod or Valibot.

Database:

- Cloudflare D1.

Cache/config:

- Workers KV.

Async:

- Cloudflare Queues.

Language:

- TypeScript.

## 3. Module Boundaries

Suggested modules:

```text
src/
  index.ts
  env.ts
  router.ts
  auth/
    telegram.ts
    jwt.ts
    admin.ts
  users/
  agents/
  points/
  energy/
  boxes/
  abilities/
  tasks/
  referrals/
  groups/
  leaderboard/
  marketplace/
  admin/
  bot/
  jobs/
  wallet/
  shared/
```

## 4. Economic Mutation Pattern

Every mutation should follow:

1. Validate auth.
2. Validate request.
3. Load current state.
4. Check eligibility.
5. Write ledger/event rows.
6. Update cached or derived counters.
7. Emit analytics event.
8. Return updated state.

Example:

```text
Open Box
  -> verify owner
  -> verify unopened
  -> select rewards
  -> mark box burned
  -> create inventory items
  -> create point ledger events
  -> update agent energy cache
  -> create box_opening record
```

## 5. Idempotency

Required for:

- Agent claim.
- Box opening.
- Farming run.
- Marketplace purchase.
- Referral reward.
- Queue jobs.
- Cron jobs.

Recommended:

- Accept optional `Idempotency-Key` for mutating frontend requests.
- Use unique constraints where possible.
- Queue jobs must include stable `jobId`.

## 6. Telegram Auth

Mini App auth:

- Verify Telegram `initData`.
- Create or load user.
- Issue short-lived JWT.
- Record entry source.

Bot webhook:

- Verify Telegram secret token if configured.
- Parse update.
- Record Bot events.
- Respond quickly.
- Use Queue for slow actions.

## 7. Queue Jobs

Job types:

- `send_daily_report`
- `send_bot_message`
- `settle_referral_reward`
- `recalculate_leaderboard`
- `expire_listing`
- `expire_ability`
- `risk_score_user`
- `generate_report_image`

Queue consumer rules:

- Per-message try/catch.
- Explicit ack/retry.
- Idempotent processing.
- Dead letter handling later.

## 8. Cron Jobs

Cron jobs:

- Daily Energy refill.
- Daily report enqueue.
- Leaderboard snapshot.
- Expire listings.
- Expire abilities.
- Risk settlement preview.

Since Cron can run more than once, jobs must be idempotent by date key.

## 9. Admin Safety

Admin mutations must:

- Require admin role.
- Write audit log.
- Validate dangerous operations.
- Support pause switches for boxes/tasks/marketplace.

Important pause switches:

- Pause all box openings.
- Pause specific box.
- Pause all tasks.
- Pause marketplace purchases.
- Pause wallet automation.

## 10. Future TON Layer

Do not couple V0 economic logic directly to TON.

Use a wallet module boundary:

```text
wallet/
  connect.ts
  transactions.ts
  agentic-policy.ts
  action-log.ts
```

V0 can stub wallet states:

- Not connected.
- Connected.
- Agentic Wallet pending.
- Agentic Wallet active.

## 11. Testing Priorities

Backend tests must cover:

- Duplicate Agent claim.
- Duplicate box open.
- Energy cannot go negative.
- Ability stacking cap.
- Marketplace ownership transfer.
- Referral staged rewards.
- Group member counted once.
- Admin audit logs.
- Auth rejection.

