# Implementation Tasks

## 1. Workstream Order

Recommended order:

1. Backend scaffold and D1 migrations.
2. Telegram auth and Bot start flow.
3. Agent claim and Starter Box.
4. Points ledger, Energy, and farming.
5. Mini App mock-to-real API integration.
6. Group pool and referrals.
7. Marketplace V0.
8. Admin V0.
9. Analytics and anti-sybil.
10. Cloudflare staging deployment.

Frontend can start after tasks 1-3 API shapes are stable, using mock data from `SCREEN_DATA_SPEC.md`.

## 2. Backend Tasks

### B1: Worker Scaffold

- Create `apps/api-worker`.
- Add TypeScript.
- Add router.
- Add `/health`.
- Add wrangler config.
- Add D1/KV/Queue/R2 bindings.

### B2: D1 Migrations

- Create core tables from `DATABASE_SCHEMA.md`.
- Add indexes.
- Add local migration command.
- Add staging migration command.

### B3: Telegram Auth

- Verify Mini App init data.
- Create/load user.
- Issue JWT.
- Store start param.

### B4: Agent Claim

- Implement `POST /agents/claim`.
- Enforce one Agent per user.
- Issue Starter Box.
- Add ledger/audit events.

### B5: Inventory and Box Opening

- Implement inventory list.
- Implement box opening.
- Implement Starter Box drop table.
- Burn box.
- Credit rewards.

### B6: Points, Energy, Farming

- Implement available tasks.
- Implement farming run.
- Consume Energy.
- Apply abilities.
- Emit point ledger.

### B7: Leaderboard

- Build simple global ranking.
- Return current user rank/tier.
- Add points-to-next-tier.

### B8: Referral

- Parse referral start params.
- Record referral.
- Stage rewards.
- Block self-referral.

### B9: Group Pool

- Create/join group pool.
- Track members.
- Calculate group score and boost.

### B10: Marketplace

- List marketplace items.
- Create listing.
- Buy listing.
- Cancel listing.
- Transfer ownership.
- Record fees.

### B11: Admin API

- Admin auth.
- User search.
- Task CRUD.
- Box CRUD.
- Ability CRUD.
- Ledger viewer.
- Marketplace viewer.
- Audit logs.

### B12: Queue and Cron

- Add queue producer/consumer.
- Add daily report job.
- Add energy refill job.
- Add expiry cleanup job.

## 3. Bot Tasks

### T1: Webhook Endpoint

- Implement `/telegram/webhook`.
- Verify secret token.
- Parse `/start`.
- Send start message.

### T2: Mini App Buttons

- Add claim Agent button.
- Add report share button.
- Add group pool button.

### T3: Daily Reports

- Generate report text.
- Send report message.
- Add throttling.

### T4: Group Pool Messages

- Detect group context.
- Send group pool prompt.
- Link to Mini App with group param.

## 4. Frontend Tasks

Frontend owner should use:

- `FRONTEND_HANDOFF.md`
- `SCREEN_DATA_SPEC.md`
- `API_CONTRACT.md`
- `BOT_COPY.md`

Tasks:

- Mini App shell.
- Agent Home.
- Box Opening.
- Inventory.
- Earn.
- Leaderboard.
- Group Pool.
- Marketplace.
- API client.
- Telegram init data auth.
- Loading/error/empty states.

## 5. Admin Tasks

- Admin login.
- Dashboard.
- Users.
- Tasks.
- Boxes.
- Abilities.
- Marketplace.
- Risk.
- Audit log display.

## 6. QA Tasks

- Implement test cases from `QA_TEST_PLAN.md`.
- Add ledger consistency checks.
- Add duplicate claim/open tests.
- Add marketplace transfer tests.
- Add referral abuse tests.

## 7. Deployment Tasks

- Create Cloudflare resources.
- Configure wrangler.
- Apply D1 migrations.
- Set Worker secrets.
- Deploy Worker staging.
- Deploy Pages staging.
- Set Telegram staging webhook.
- Run smoke tests.

