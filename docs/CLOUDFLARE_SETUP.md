# Cloudflare Setup

## 1. Required Cloudflare Resources

Create these resources before production development:

### Workers

- `growthbot-api-dev`
- `growthbot-api-staging`
- `growthbot-api-prod`

### Pages

Option A, separate:

- `growthbot-miniapp`
- `growthbot-admin`

Option B, combined:

- `growthbot-web`

### D1

- `growthbot-dev`
- `growthbot-staging`
- `growthbot-prod`

### KV

- `GROWTHBOT_KV_DEV`
- `GROWTHBOT_KV_STAGING`
- `GROWTHBOT_KV_PROD`

### Queues

- `growthbot-jobs-dev`
- `growthbot-jobs-staging`
- `growthbot-jobs-prod`

Optional dead letter queues:

- `growthbot-jobs-dlq-dev`
- `growthbot-jobs-dlq-staging`
- `growthbot-jobs-dlq-prod`

### R2

- `growthbot-assets-dev`
- `growthbot-assets-staging`
- `growthbot-assets-prod`

## 2. Suggested Wrangler Config

Worker `wrangler.jsonc` should include:

```jsonc
{
  "name": "growthbot-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-06-16",
  "triggers": {
    "crons": ["0 0 * * *", "0 12 * * *"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "growthbot-dev",
      "database_id": "replace-with-dev-id"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "replace-with-dev-kv-id"
    }
  ],
  "queues": {
    "producers": [
      {
        "binding": "JOBS",
        "queue": "growthbot-jobs-dev"
      }
    ],
    "consumers": [
      {
        "queue": "growthbot-jobs-dev",
        "max_batch_size": 10,
        "max_batch_timeout": 5
      }
    ]
  },
  "r2_buckets": [
    {
      "binding": "ASSETS",
      "bucket_name": "growthbot-assets-dev"
    }
  ],
  "vars": {
    "APP_ENV": "dev",
    "MINIAPP_ORIGIN": "http://localhost:5173",
    "ADMIN_ORIGIN": "http://localhost:5174"
  }
}
```

Use environment blocks for staging and production.

## 3. Secrets Checklist

Set per environment:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN --env staging
npx wrangler secret put JWT_SECRET --env staging
npx wrangler secret put ADMIN_JWT_SECRET --env staging
```

Later:

```bash
npx wrangler secret put TON_API_KEY --env staging
npx wrangler secret put AI_GATEWAY_TOKEN --env staging
```

## 4. Local Development

Recommended:

```bash
npm install
npx wrangler dev --persist-to=./.wrangler/state
```

Use local D1 migrations:

```bash
npx wrangler d1 migrations apply growthbot-dev --local
```

## 5. Telegram Webhook

Production webhook URL:

```text
https://api.growthbot.example/telegram/webhook
```

Set webhook:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://api.growthbot.example/telegram/webhook"
```

Recommended:

- Use a random secret path or Telegram secret token header.
- Verify webhook signature/secret before processing.

## 6. Pages Deployment

Mini App:

```bash
npm run build
npx wrangler pages deploy ./dist --project-name=growthbot-miniapp
```

Admin:

```bash
npm run build
npx wrangler pages deploy ./dist --project-name=growthbot-admin
```

Git integration is preferred for production.

## 7. Production Readiness

Before production:

- `npx wrangler whoami` succeeds.
- D1 migrations applied to prod.
- Secrets set in prod.
- Telegram webhook set to prod Worker.
- Admin auth enabled.
- Box/task pause switches tested.
- Queue consumer idempotency tested.
- Cron jobs tested through scheduled endpoint.
- Rollback plan documented.

