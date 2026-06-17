# GrowthBot Go-Live Checklist

Last updated: 2026-06-16

## Current Launch Decision

GrowthBot is ready for internal soft-launch testing after one real Telegram client session is verified.

GrowthBot is not yet cleared for public KOL-scale launch.

## Production URLs

- Mini App: `https://app.gb8.top`
- 管理后台: `https://1989.gb8.top`
- API Worker: `https://api.gb8.top`
- Telegram bot: `@G2047_bot`

## Final Telegram Setup

在以下目录运行 `/Users/yudeyou/Desktop/GrowthBot`:

```bash
node scripts/configure-telegram.mjs
```

Expected success output includes:

- `info.url` equals `https://api.gb8.top/telegram/webhook`
- `info.pending_update_count` is a number
- `info.last_error_message` is `null`

Current configured target:

- Webhook: `https://api.gb8.top/telegram/webhook`
- Menu: `https://app.gb8.top/`

If the script cannot reach Telegram from the current machine, run these commands from another network:

```bash
set -a
. ./.env
set +a

curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=https://api.gb8.top/telegram/webhook" \
  --data-urlencode 'allowed_updates=["message","callback_query","my_chat_member"]' \
  --data-urlencode "drop_pending_updates=true"

curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setChatMenuButton" \
  -H "content-type: application/json" \
  -d '{
    "menu_button": {
      "type": "web_app",
      "text": "Open GrowthBot",
      "web_app": {
        "url": "https://app.gb8.top"
      }
    }
  }'

curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

## Internal Soft-Launch Test

Run the API smoke test first:

```bash
npm run smoke:api
```

Run this on a real Telegram client:

1. Open `@G2047_bot`.
2. Tap the GrowthBot menu button.
3. Confirm Mini App opens at `app.gb8.top`.
4. Claim Free Agent.
5. Open Starter Box.
6. Go to Missions.
7. Run a low-energy task.
8. Check Inventory, Leaderboard, Pool, and Marketplace render.
9. Confirm the Home screen shows countdown, remaining Alpha Boxes, rare drop ticker, and Crew Box unlock progress.
10. Confirm Marketplace shows trending assets, floor movement, recent trades, and expiry pressure.
11. Confirm Marketplace sections show trending, rare, expiring, and floor lists.
12. Use Share Report, Box Report, and Crew invite once from Telegram.
13. Open 管理后台 and verify metrics/users/tasks/启动运营 are visible.
14. Use 管理后台 token only on trusted devices.

## Operational Gates

Required before internal soft launch:

- Telegram webhook configured.
- Telegram menu button configured.
- One real Telegram Mini App session tested.
- 管理后台 reachable.
- 暂停盲盒 and 暂停任务 controls verified.
- Support contact prepared.

Required before public launch:

- At least 20 internal testers complete the first-session flow.
- At least 5 internal testers complete a share loop from Telegram and bring one new tester each.
- 启动运营 shows nonzero share events after tester sharing.
- No fixed token/profit/fixed conversion copy in bot, Mini App, 管理后台, or campaign posts.
- Support responses ready.
- Launch calendar prepared.
- Abuse/risk review owner assigned.
- D1 backup/export plan confirmed.

Use `docs/OPS_SUPPORT_RUNBOOK.md` for support replies, incident response, and backup commands.

## Emergency Controls

管理后台:

- `暂停盲盒`: stops box-opening economy mutations.
- `暂停任务`: stops Mission mutations and hides active tasks.

If 管理后台 UI cannot reach the API, use API directly from a trusted network:

```bash
set -a
. ./.env
set +a

ADMIN_SESSION_TOKEN="$(
  curl -s "https://api.gb8.top/admin/login" \
    -H "content-type: application/json" \
    -d "{\"username\":\"${ADMIN_LOGIN_USER:-yudeyou0118}\",\"password\":\"${ADMIN_TOKEN}\"}" \
  | node -e 'let data="";process.stdin.on("data",c=>data+=c);process.stdin.on("end",()=>console.log(JSON.parse(data).accessToken||""))'
)"

curl "https://api.gb8.top/admin/controls/boxes" \
  -H "content-type: application/json" \
  -H "x-admin-token: ${ADMIN_SESSION_TOKEN}" \
  -d '{"paused":true}'

curl "https://api.gb8.top/admin/controls/tasks" \
  -H "content-type: application/json" \
  -H "x-admin-token: ${ADMIN_SESSION_TOKEN}" \
  -d '{"paused":true}'
```

Restore only after verifying the incident is contained:

```bash
curl "https://api.gb8.top/admin/controls/boxes" \
  -H "content-type: application/json" \
  -H "x-admin-token: ${ADMIN_SESSION_TOKEN}" \
  -d '{"paused":false}'

curl "https://api.gb8.top/admin/controls/tasks" \
  -H "content-type: application/json" \
  -H "x-admin-token: ${ADMIN_SESSION_TOKEN}" \
  -d '{"paused":false}'
```

## Known Constraints

- V0 is off-chain for user funds.
- TON Agentic Wallet execution is deferred.
- 主网自动钱包执行 is not enabled.
- 管理后台 token is stored locally in browser storage after entry; use trusted machines only.
- `?mock=true` preview remains available for demos and frontend fallback.
