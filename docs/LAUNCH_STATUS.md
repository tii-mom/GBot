# GrowthBot Launch Status

Last updated: 2026-06-16

## Public URLs

- Mini App: `https://app.gb8.top`
- 管理后台: `https://1989.gb8.top`
- API: `https://api.gb8.top`
- Telegram bot: `@G2047_bot`

## Verified

- Cloudflare Pages custom domains are active for Mini App and 管理后台.
- Cloudflare Worker custom domain is enabled for `api.gb8.top`.
- D1 staging migrations are applied.
- Worker staging deploy succeeds.
- Mini App production deploy succeeds.
- 管理后台 production deploy succeeds.
- `npm run typecheck` passes.
- `npm run build` passes.
- `npm run smoke:api` passes against `https://api.gb8.top`.
- Telegram webhook is configured for `https://api.gb8.top/telegram/webhook`.
- Telegram menu button opens `https://app.gb8.top/`.
- Browser smoke test opens Mini App custom domain.
- Browser smoke test opens 管理后台 custom domain.
- 管理后台 is real-API-first and uses account-password login for protected operations.
- 管理后台 clearly displays `接口回退预览` when Worker API access fails and local preview state is used.
- Mini App first-session flow reaches `Claim Free Agent`.
- Claim Agent flow works in the live Mini App.
- Starter Box opening flow works in the live Mini App.
- Earn screen renders task cards in the live Mini App.
- Mini App has API timeout fallback so users are not stuck on loading if API/network fails.
- Sharing links point to `@G2047_bot`.
- Mini App has a 启动快照 with countdown, remaining box supply, rare drop ticker, group unlock progress, and market trend data.
- Box pools now cover Starter, Alpha、战队和项目盒 in V0.
- Marketplace displays floor, volume, floor movement, active listings, recent trades, trending assets, and listing expiry pressure.
- Inventory ability cards show utility and transferability.

## Fixed During Staging

- Pages custom domains initially returned `Deployment Not Found` because only branch deployments existed. Production Pages deployments were added.
- Worker API custom domain initially conflicted with a manually created CNAME. The CNAME was removed and Worker custom domain deployment succeeded.
- D1 seed was not idempotent and could return 500 after partial seed state. Seed inserts now use `INSERT OR IGNORE`.
- Mini App API fallback could hang on network stalls. API requests now time out and fall back locally.
- 管理后台 originally used local-only state. It now tries real 管理后台 API first and falls back locally with visible status.

## Pending Before Public Launch

- Verify bot start opens the Mini App on a real Telegram client.
- Run one full Telegram Mini App session with real `initData`.
- Verify 管理后台 protected operations from a network/browser that can reach `api.gb8.top`.
- Confirm support contact and launch campaign calendar.
- Verify `/fomo/snapshot` on production after deploy.
- Run real-client share test for Box Report and Group Pool invite links.

See `docs/GO_LIVE_CHECKLIST.md` for the final operator checklist.
See `docs/OPS_SUPPORT_RUNBOOK.md` for support and incident response.

## Telegram Configuration

在以下目录运行 `/Users/yudeyou/Desktop/GrowthBot`:

```bash
node scripts/configure-telegram.mjs
```

This sets:

- Webhook: `https://api.gb8.top/telegram/webhook`
- Menu button: `https://app.gb8.top`

If the command times out from the local network, retry from another network that can reach `api.telegram.org`.

## Soft Launch Gate

GrowthBot is ready for internal soft-launch testing after one real Telegram client session is verified.

Do not run public KOL-scale traffic until:

- Telegram real-client flow passes.
- 管理后台 pause/risk controls are verified.
- Support responses are ready.
- Bot copy has been reviewed for no guaranteed token/profit language.
