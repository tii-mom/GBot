# GrowthBot Ops Support Runbook (Legacy / Superseded)

> Status: legacy. Replaced by [GBot Canonical V1](./GBOT_CANONICAL_V1.md) and the new wallet/economy docs.

This document is preserved for historical reference only.

Real Asset Agent support language must use `G`, `TON`, `AI Credits`, Skill Cards, isolated Agent Wallet, policy limits, allowlists, pause controls, and audit evidence. `GP`, `pending_points`, and `point_ledger_events` are legacy support/debug terms only and must not be presented as current spendable economics. Support must also avoid any copy that promises guaranteed profit, guaranteed yield, guaranteed airdrop, fixed return, or risk-free outcomes.

Admin Risk Console V1 can be used to review simulated Agent Wallet policy, allowlists, intent states, AI Model Token purchase intents, evidence sections, and audit events. Operators must treat it as review-only in this phase: no live execution, no main wallet control, and no seed phrase or private-key handling. The console should show whether it is using the API snapshot or fallback mock data so operators do not confuse preview data with backend state.

Admin Review Queue items are simulated-only and fallback-first. Missing DB rows/tables must not block support review, and no review action may sign, broadcast, or create custody behavior.

Policy Guard remains the approval gate before any future executor can act.

Last updated: 2026-06-18

## Support Positioning

GrowthBot V1 is an off-chain Agent task network with Points, rank, skill packs, skill cards, bounty tasks, and future reward eligibility.

Support must not promise:

- Do not promise guaranteed token rewards.
- Do not promise guaranteed profit.
- Do not promise fixed airdrop conversion.
- Do not promise risk-free outcomes.
- Do not promise automatic trading profit.

Use these terms instead:

- Pending Points / 积分
- User Score / 用户分数
- allocation weight / 分配权重
- future reward eligibility / 未来奖励资格
- project-specific redemption / 项目方兑换规则
- Agent skill cards / Agent 技能卡

## Common User Replies

### What is GrowthBot?

```text
GrowthBot lets your Telegram Agent discover approved tasks, organize the steps, help you submit verification links, earn Points, learn skill cards, and increase future reward eligibility. V1 does not require wallet funds.
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

### Why was my bounty task rejected?

```text
Most rejected bounty submissions are caused by an invalid link format, duplicate link, expired task, or a task that requires manual review. Please submit the direct public link requested by the task, such as an X post URL, Telegram link, Discord invite, or form receipt link.
```

### Why is my bounty task under review?

```text
Some bounty tasks enter manual review when the reward is higher, the task is marked high-risk, or the link needs extra checks. Your Points or skill card reward is only issued after the review passes.
```

### Why can't I trade this skill card?

```text
Only unlearned and transferable skill cards can be listed. Starter assets, learned/equipped cards, bound access rights, Agent identity, and Points cannot be traded.
```

### Is my custom model API Key safe?

```text
Agent Studio is only available to approved users. API Keys are encrypted on the backend and the app only shows the last four characters. Model output is used only for task guidance and cannot directly issue rewards, change Points, approve tasks, or trigger wallet actions.
```

### What does the Admin Risk Console review?

```text
It reviews simulated Agent Wallet policy, allowlists, purchase intents, policy decisions, and evidence. It does not execute live chain actions, does not control the main wallet, and does not store seed phrases or private keys.
```

### My custom model failed.

```text
If your model provider fails, times out, or is disabled, GrowthBot falls back to the platform Agent guide. Your Points, rewards, and task status are not changed by a model failure.
```

### My invite did not count.

```text
Invite attribution is based on the Telegram start link and activation steps. Ask the invited user to open GrowthBot from the shared link, claim an Agent, and open the Starter Skill Pack. If it still does not appear, share both Telegram usernames and approximate time.
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
- Check Admin growth funnel and bounty verification queue.
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
- Run `npm run backup:launch` during active launch windows.
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
npx wrangler d1 execute growthbot-staging --remote --env staging --config apps/api-worker/wrangler.jsonc --command "SELECT * FROM bounty_tasks ORDER BY created_at DESC LIMIT 5000;"
npx wrangler d1 execute growthbot-staging --remote --env staging --config apps/api-worker/wrangler.jsonc --command "SELECT * FROM bounty_task_verifications ORDER BY created_at DESC LIMIT 5000;"
npx wrangler d1 execute growthbot-staging --remote --env staging --config apps/api-worker/wrangler.jsonc --command "SELECT * FROM admin_config_audit_logs ORDER BY created_at DESC LIMIT 5000;"
npx wrangler d1 execute growthbot-staging --remote --env staging --config apps/api-worker/wrangler.jsonc --command "SELECT * FROM analytics_events ORDER BY created_at DESC LIMIT 10000;"
```

Or run the bundled launch snapshot helper:

```bash
npm run backup:launch
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


## Real Asset DB Persistence V1 Support Boundary

Real Asset DB Persistence V1 is local scaffold / planning only. It does not mutate production D1 and does not deploy any production migration. Future production rollout requires an explicit approved migration-apply PR.

Support should explain that Work Report evidence and Admin Risk Console audit will persist through `work_report_evidence_events` and `admin_risk_audit_events` in a future runtime wiring PR. No private keys, seed phrases, mnemonics, custody data, or user main-wallet credentials are stored. No Agent control of the user main wallet is introduced. Testnet executor remains blocked until DB-backed policy persistence, durable intent ledger, durable audit log, tx status tracker, Admin review queue, global pause, and rollback runbook coverage exist.
