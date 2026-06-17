# GrowthBot Ops Support Runbook

Last updated: 2026-06-16

## Support Positioning

GrowthBot V0 is a points, rank, box, and task-farming product.

Support must not promise:

- Guaranteed token rewards.
- Guaranteed profit.
- Fixed airdrop conversion.
- Risk-free outcomes.
- Automatic trading profit.

Use these terms instead:

- Pending Points
- User Score
- allocation weight
- future reward eligibility
- project-specific redemption
- airdrop chance

## Common User Replies

### What is GrowthBot?

```text
GrowthBot lets your Telegram Agent complete approved tasks, farm Pending Points, open boxes, and increase future reward eligibility. V0 does not require wallet funds.
```

### Are points tokens?

```text
No. Points are not tokens and do not have a fixed conversion. They may be used for future reward eligibility, allocation weight, or project-specific redemption rules.
```

### Is profit guaranteed?

```text
No. GrowthBot does not guarantee token rewards, profit, or fixed redemption. Points and boxes are participation mechanics.
```

### Do I need to connect a wallet?

```text
No wallet is required for V0 farming. Wallet-enabled Agent tasks are experimental and will only be introduced with clear user limits and safety controls.
```

### My Agent stopped farming.

```text
Check Energy, task availability, and whether tasks are paused. If Energy is empty, open boxes or wait for the next configured refill event.
```

### I opened a box but did not see rewards.

```text
Ask the user for Telegram username, approximate time, and box name. Check Admin users and inventory state. If needed, pause boxes before investigating.
```

### I cannot open the Mini App.

```text
Ask the user to update Telegram, reopen @G2047_bot, and tap Open GrowthBot again. If multiple users report it, check Cloudflare Pages and API status.
```

## Daily Ops Checklist

Morning:

- Run `npm run smoke:api`.
- Check Admin metrics.
- Check risk flags.
- Confirm boxes and tasks are not paused unless intentionally paused.
- Review Telegram group reports.

During launch window:

- Watch support messages every 15 minutes.
- Check Agent claims and box opens.
- Watch marketplace listing/trade anomalies.
- Pause boxes if reward reports look inconsistent.
- Pause tasks if point velocity looks abnormal.

Evening:

- Export D1 snapshot or run backup procedure.
- Record DAU, agent claims, box opens, farming runs, shares, group pools, and risk flags.
- Prepare next-day task and box plan.

## Incident Response

### Box Reward Incident

1. Pause boxes in Admin.
2. Record time window and affected users.
3. Query opened boxes and ledger events.
4. Decide whether to compensate or revert.
5. Publish short user notice.
6. Restore boxes only after verification.

### Farming Exploit

1. Pause tasks in Admin.
2. Identify abnormal users by point velocity.
3. Restrict suspicious users.
4. Compare agent energy, task executions, and point ledger.
5. Restore tasks only after exploit path is closed.

### API or Mini App Outage

1. Check Cloudflare Worker and Pages status.
2. Run `npm run smoke:api`.
3. Check recent deployment IDs.
4. If frontend is broken but API is healthy, use Pages rollback in Cloudflare.
5. If API is broken, pause boxes/tasks if mutations may be unsafe.

### Admin Token Exposure

1. Rotate `ADMIN_TOKEN` locally and in Cloudflare secrets.
2. Treat all existing admin sessions as untrusted until the secret is rotated.
3. Redeploy Worker if needed.
4. Remove old sessions from trusted browsers.
5. Review Admin actions around exposure time.

## Backup and Export

Run from `/Users/yudeyou/Desktop/GrowthBot`.

List tables:

```bash
npx wrangler d1 execute growthbot-staging --remote --env staging --config apps/api-worker/wrangler.jsonc --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Export critical operational tables to JSON-like command output:

```bash
npx wrangler d1 execute growthbot-staging --remote --env staging --config apps/api-worker/wrangler.jsonc --command "SELECT * FROM users ORDER BY created_at DESC LIMIT 1000;"
npx wrangler d1 execute growthbot-staging --remote --env staging --config apps/api-worker/wrangler.jsonc --command "SELECT * FROM agents ORDER BY created_at DESC LIMIT 1000;"
npx wrangler d1 execute growthbot-staging --remote --env staging --config apps/api-worker/wrangler.jsonc --command "SELECT * FROM point_ledger_events ORDER BY created_at DESC LIMIT 5000;"
npx wrangler d1 execute growthbot-staging --remote --env staging --config apps/api-worker/wrangler.jsonc --command "SELECT * FROM inventory_items ORDER BY created_at DESC LIMIT 5000;"
npx wrangler d1 execute growthbot-staging --remote --env staging --config apps/api-worker/wrangler.jsonc --command "SELECT * FROM marketplace_trades ORDER BY created_at DESC LIMIT 5000;"
```

Minimum launch-day backup cadence:

- Before opening tester traffic.
- After first 50 users.
- After first 500 users.
- End of day.

## Manual Emergency API Commands

Pause boxes:

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
```

Pause tasks:

```bash
curl "https://api.gb8.top/admin/controls/tasks" \
  -H "content-type: application/json" \
  -H "x-admin-token: ${ADMIN_SESSION_TOKEN}" \
  -d '{"paused":true}'
```

Restore boxes/tasks:

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

## Soft Launch Owner Checklist

- One owner watches Admin.
- One owner watches Telegram support.
- One owner can run Cloudflare rollback.
- One owner can pause boxes/tasks.
- One owner records metrics.

No public announcement until the owner list is filled.
