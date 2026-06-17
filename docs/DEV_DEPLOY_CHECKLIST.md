# GrowthBot Dev Deploy Checklist

## Cloudflare Resources

Created Cloudflare resources:

- Worker staging: `growthbot-api-staging`
- Worker staging URL: `https://growthbot-api-staging.348421501.workers.dev`
- Worker staging custom route: `https://api.gb8.top`
- Pages Mini App: `growthbot-miniapp`
- Pages Mini App staging URL: `https://staging.growthbot-miniapp.pages.dev`
- Pages Mini App custom domain: `https://app.gb8.top`
- Pages 管理后台: `growthbot-admin`
- Pages 管理后台 staging URL: `https://staging.growthbot-admin.pages.dev`
- Pages 管理后台 custom domain: `https://1989.gb8.top`
- D1 dev: `growthbot-dev` (`7f4cb622-f66d-4c46-83b1-1dec14f3df13`)
- D1 staging: `growthbot-staging` (`e33c3b88-0874-4316-ba6e-793f040f3edb`)
- KV dev: `worker-growthbot-kv-dev` (`0d43333cd118451b8e9011311fdd12ba`)
- KV staging: `worker-growthbot-kv-staging` (`83901e31622b4ac79d77bbcc49c661cf`)
- Queue dev: `growthbot-jobs-dev`
- Queue staging: `growthbot-jobs-staging`
- R2 dev: `growthbot-assets-dev`
- R2 staging: `growthbot-assets-staging`

`apps/api-worker/wrangler.jsonc` is configured with the dev and staging IDs above.

## Secrets

Set these Worker secrets:

- `TELEGRAM_BOT_TOKEN`: required for production Telegram Mini App initData verification.
- `ADMIN_TOKEN`: used as the private backend login secret and session signing seed.

Commands:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN --config apps/api-worker/wrangler.jsonc
npx wrangler secret put ADMIN_TOKEN --config apps/api-worker/wrangler.jsonc
```

## D1 Migrations

Local:

```bash
npx wrangler d1 migrations apply growthbot-dev --local --config apps/api-worker/wrangler.jsonc
```

Remote dev/staging:

```bash
npx wrangler d1 migrations apply growthbot-dev --remote --config apps/api-worker/wrangler.jsonc
npx wrangler d1 migrations apply growthbot-staging --remote --env staging --config apps/api-worker/wrangler.jsonc
```

## Deploy Commands

Worker staging:

```bash
npm run deploy:api:staging
```

Pages staging:

```bash
VITE_API_BASE=https://api.gb8.top npm run deploy:miniapp:staging
VITE_API_BASE=https://api.gb8.top npm run deploy:admin:staging
```

## Custom Domain DNS

Cloudflare Pages custom domains have been added for:

- `app.gb8.top` -> `growthbot-miniapp`
- `1989.gb8.top` -> `growthbot-admin`

The Worker route has been added for:

- `api.gb8.top/*` -> `growthbot-api-staging`

If the custom domains remain `pending`, add these proxied CNAME records in the `gb8.top` DNS dashboard:

```text
app.growthbot      CNAME growthbot-miniapp.pages.dev
admin.growthbot    CNAME growthbot-admin.pages.dev
api.growthbot      CNAME growthbot-api-staging.348421501.workers.dev
```

GrowthBot now uses the dedicated `gb8.top` namespace for its public entry points.

## Local Smoke Test

Start services:

```bash
npm run dev:api
npm run dev:miniapp
npm run dev:admin
```

API checks:

```bash
curl http://localhost:8787/health
curl http://localhost:8787/me
curl -X POST http://localhost:8787/agents/claim
curl http://localhost:8787/inventory
curl http://localhost:8787/tasks/available
curl http://localhost:8787/leaderboard
curl http://localhost:8787/marketplace/listings
curl http://localhost:8787/admin/metrics
```

Admin API session and write-through verification:

```bash
npm run verify:admin-api
```

Mini App checks:

- Open `http://localhost:5173/` for API mode.
- Open `http://localhost:5173/?mock=true` for isolated local preview mode.
- Verify claim, open box, farm, leaderboard, group pool, and marketplace views.

管理后台 checks:

- Open `http://localhost:5174/`.
- Verify dashboard, users, tasks, boxes, and risk pages render.
- 管理后台 frontend is still mock-state V0; real 管理后台 API exists for the next integration pass.

## Remote Smoke Test

Use these checks after deployment:

```bash
curl https://api.gb8.top/health
curl https://api.gb8.top/tasks/available
curl https://api.gb8.top/marketplace/listings
npm run smoke:api
npm run verify:admin-api
```

Note: during setup from this workspace, direct `curl` to the `workers.dev` URL timed out, while Wrangler deployment and deployment listing succeeded. If this repeats, verify from another network/browser or use `npx wrangler tail --env staging --config apps/api-worker/wrangler.jsonc` while opening the Pages app.

## Production Safety Defaults

- V0 remains off-chain for user funds.
- TON Agentic Wallet is deferred to beta.
- D1 is the source of truth for points, inventory, tasks, marketplace, and group pools.
- KV is only for operational flags/config, not economic truth.
- Production Telegram auth requires valid `TELEGRAM_BOT_TOKEN` and initData.
- Production 管理后台 API should require a valid login session.
