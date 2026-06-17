# GrowthBot Handoff

## 1. Current Status

GrowthBot is in product and engineering preparation stage.

The concept is locked:

> Wallet is the user's execution account. Agent is the automated worker. Blind boxes are the source of abilities. Marketplace is the liquidity and discovery layer.

The immediate goal is to let frontend begin V0 Mini App/Admin work while backend starts Cloudflare Worker, D1, Bot, and economic core.

## 2. Must-Read Documents

Product:

- [README](../README.md)
- [Product PRD](./PRD.md)
- [MVP User Flow](./MVP_USER_FLOW.md)
- [V0 Scope](./V0_SCOPE.md)

Frontend:

- [Frontend Handoff](./FRONTEND_HANDOFF.md)
- [Screen Data Spec](./SCREEN_DATA_SPEC.md)
- [Bot Copy](./BOT_COPY.md)
- [API Contract](./API_CONTRACT.md)

Backend:

- [Cloudflare Architecture](./CLOUDFLARE_ARCHITECTURE.md)
- [Cloudflare Setup](./CLOUDFLARE_SETUP.md)
- [Backend Blueprint](./BACKEND_BLUEPRINT.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [API Contract](./API_CONTRACT.md)

Operations:

- [Launch Ops Playbook](./LAUNCH_OPS_PLAYBOOK.md)
- [Analytics and Anti-Sybil](./ANALYTICS_AND_ANTISYBIL.md)
- [QA Test Plan](./QA_TEST_PLAN.md)

Economy:

- [Points and Box Rules](./POINTS_AND_BOX_RULES.md)
- [Marketplace Rules](./MARKETPLACE_RULES.md)
- [Wallet Security Policy](./WALLET_SECURITY_POLICY.md)

## 3. Decisions Already Made

- Product name: GrowthBot.
- V0 starts without mandatory wallet connection.
- V0 focuses on Telegram growth loop.
- Cloudflare is the deployment platform for frontend and backend.
- Mini App frontend deploys to Cloudflare Pages.
- Backend API and Telegram Bot webhook deploy to Cloudflare Workers.
- D1 is the V0 relational ledger database.
- KV is cache/config only, not economic source of truth.
- Queues and Cron handle async reports, refills, and cleanup.
- Agentic Wallet is deferred to beta after growth loop validation.

## 4. Frontend Can Start With

Frontend can immediately start:

- Telegram Mini App shell.
- Agent Home.
- Box Opening.
- Inventory.
- Earn.
- Leaderboard.
- Group Pool.
- Marketplace.

Use mock data matching:

- `SCREEN_DATA_SPEC.md`
- `API_CONTRACT.md`

Do not require wallet in first session.

## 5. Backend Can Start With

Backend should start:

- Worker scaffold.
- D1 migrations.
- Telegram auth.
- Agent claim.
- Starter Box.
- Points ledger.
- Farming tasks.
- Bot `/start`.

## 6. Do Not Change Without Product Review

- User Score must remain non-transferable.
- Pending Points must not imply guaranteed token conversion.
- Starter Box should be one per user.
- Main wallet must never be controlled by GrowthBot.
- V0 should not include unrestricted auto-trading.
- Marketplace should not trade User Score or Agent identity in V0.

## 7. Open Decisions

Need founder/product decision:

- First launch language: English only or English + Chinese.
- First currency for paid boxes: TON, Stars, or internal test balance.
- Separate Mini App/Admin Pages projects or one combined frontend.
- Initial Alpha Box price.
- Initial marketplace fee.
- Whether KOL squad leaderboard is in V0.
- Whether paid boxes are enabled in closed beta.

## 8. Recommended Next Step

Start two parallel tracks:

Backend:

1. Create Cloudflare Worker scaffold.
2. Create D1 migrations.
3. Implement auth, Agent claim, Starter Box, farming.

Frontend:

1. Build clickable Mini App prototype from `FRONTEND_HANDOFF.md`.
2. Use mock data from `SCREEN_DATA_SPEC.md`.
3. Align UI states to `API_CONTRACT.md`.
