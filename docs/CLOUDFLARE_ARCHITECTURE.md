# Cloudflare Architecture

## 1. Platform Decision

GrowthBot frontend and backend will be deployed on Cloudflare.

Recommended platform mapping:

- Mini App frontend: Cloudflare Pages.
- Admin frontend: Cloudflare Pages, same repo or separate Pages project.
- API backend: Cloudflare Workers.
- Telegram Bot webhook: Cloudflare Workers.
- Relational state and ledgers: Cloudflare D1.
- Config, rate limits, short-lived sessions, feature flags: Workers KV.
- Async jobs: Cloudflare Queues.
- Scheduled jobs: Cron Triggers.
- Generated report images and static campaign media: R2.
- Analytics events: D1 for V0, Analytics Engine later.
- AI model routing: AI Gateway later.

## 2. Recommended Project Layout

```text
GrowthBot/
  apps/
    miniapp/          # Telegram Mini App frontend, deployed to Pages
    admin/            # Admin console frontend, deployed to Pages
    api-worker/       # API + Telegram webhook Worker
  packages/
    shared/           # shared types, API schemas, constants
  migrations/         # D1 migrations
  docs/
```

If the team wants faster V0 delivery, `miniapp` and `admin` can start in one frontend app with route separation:

```text
/               Mini App
/admin          Admin Console
```

## 3. Cloudflare Services

### 3.1 Pages

Use Pages for:

- Mini App static build.
- Admin static build.
- Preview deployments per branch.
- Production deploy from Git.

Recommended:

- Mini App Pages project: `growthbot-miniapp`.
- Admin Pages project: `growthbot-admin`.

Alternative:

- One Pages project: `growthbot-web`.

### 3.2 Workers

Use Workers for:

- REST API.
- Telegram webhook.
- Auth verification.
- Economic mutations.
- Queue producers.
- Cron scheduled handlers.

Recommended Worker:

- `growthbot-api`.

Routes:

- `/api/*`
- `/telegram/webhook`
- `/health`

### 3.3 D1

Use D1 for:

- Users.
- Agents.
- Inventory.
- Point ledgers.
- Tasks.
- Marketplace listings/trades.
- Admin audit logs.

D1 is SQLite-compatible and suitable for V0. Since GrowthBot has many ledger writes, keep operations compact and use indexes carefully.

Recommended DBs:

- `growthbot-dev`
- `growthbot-staging`
- `growthbot-prod`

### 3.4 KV

Use KV for:

- Feature flags.
- Runtime config.
- Rate limit counters where eventual consistency is acceptable.
- Telegram bot command cache.
- Short-lived state that does not require strong consistency.

Do not use KV for:

- Points.
- Inventory ownership.
- Marketplace ownership.
- Box opening state.

### 3.5 Queues

Use Queues for:

- Daily report generation.
- Bot notification sends.
- Referral reward settlement.
- Risk scoring jobs.
- Leaderboard recalculation.
- Marketplace alert jobs.

Important:

- Queue delivery is at least once.
- Every queue consumer must be idempotent.
- Use per-message try/catch and explicit ack/retry.

### 3.6 Cron Triggers

Use Cron for:

- Daily Energy refill.
- Daily Agent reports.
- Leaderboard snapshots.
- Pending Points settlement preview.
- Expired listing cleanup.
- Expired ability cleanup.

Cron is UTC-only and can run more than once in rare cases, so jobs must be idempotent.

### 3.7 R2

Use R2 for:

- Shareable report images.
- Box artwork.
- Ability artwork.
- Campaign media.
- Exports/backups.

V0 can use static frontend assets first. R2 becomes more important when report images are generated dynamically.

### 3.8 AI Gateway

Use AI Gateway later for:

- Agent report summaries.
- Task recommendation explanations.
- Project risk summaries.
- Multi-model fallback.
- AI cost and rate control.

V0 should not require AI Gateway.

## 4. Runtime Boundaries

Economic source of truth:

- D1 ledger/events.

Cache:

- KV.

Async side effects:

- Queues.

Media:

- R2.

AI:

- AI Gateway.

Wallet automation:

- Worker orchestrates approved actions.
- TON signing/execution policy must follow wallet security policy.

## 5. Environment Strategy

Environments:

- `dev`: local and internal testing.
- `staging`: closed beta and QA.
- `prod`: public launch.

Each environment needs:

- Separate D1 database.
- Separate KV namespace.
- Separate Queue.
- Separate R2 bucket.
- Separate Telegram Bot token if possible.

## 6. Secrets

Worker secrets:

- `TELEGRAM_BOT_TOKEN`
- `JWT_SECRET`
- `ADMIN_JWT_SECRET`
- `TON_API_KEY`, later
- `AI_GATEWAY_TOKEN`, later
- `OPENAI_API_KEY`, only if AI is enabled

Do not commit secrets.

Use:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
```

## 7. Deployment Commands

Auth check:

```bash
npx wrangler whoami
```

Worker deploy:

```bash
npx wrangler deploy --env staging
npx wrangler deploy --env production
```

Pages deploy:

```bash
npx wrangler pages deploy ./dist --project-name=growthbot-miniapp
```

D1 migration:

```bash
npx wrangler d1 migrations apply growthbot-staging --remote
npx wrangler d1 migrations apply growthbot-prod --remote
```

## 8. Why This Architecture

This architecture keeps V0 fast:

- Pages makes frontend handoff simple.
- Workers gives one edge backend for API and Bot webhook.
- D1 gives relational ledger semantics.
- KV handles cheap config/cache.
- Queues and Cron handle growth operations.
- R2 supports viral report assets.

It also leaves room for later:

- TON Agentic Wallet.
- AI Gateway.
- Higher-volume analytics.
- More project campaigns.

