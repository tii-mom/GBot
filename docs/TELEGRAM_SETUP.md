# GrowthBot Telegram Setup

## Bot

- Bot username: `@G2047_bot`
- Staging Mini App URL: `https://app.gb8.top`
- Staging API webhook URL: `https://api.gb8.top/telegram/webhook`

## Secrets Already Configured

These Worker staging secrets have been uploaded to Cloudflare:

- `TELEGRAM_BOT_TOKEN`
- `ADMIN_TOKEN`

## Set Webhook

Run this from a network that can reach `api.telegram.org`:

```bash
set -a
. ./.env
set +a

curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=https://api.gb8.top/telegram/webhook" \
  --data-urlencode 'allowed_updates=["message","callback_query","my_chat_member"]' \
  --data-urlencode "drop_pending_updates=true"
```

Verify:

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

## Bot Menu Button

Set the bot menu button to open the Mini App:

```bash
set -a
. ./.env
set +a

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
```

## Suggested Bot Commands

Use the command menu below so users can discover core actions without chat friction:

- `/start` - 打开 GrowthBot
- `/farm` - 查看任务状态
- `/boxes` - 查看盲盒资产
- `/market` - 查看市场
- `/pool` - 查看战队
- `/help` - 安全说明

The webhook also replies to these commands with a short welcome card and a Web App button.

## Suggested BotFather Setup

In BotFather for `@G2047_bot`:

- Description: `GrowthBot is a Telegram-native Agent network for tasks, boxes, crews, and future reward eligibility.`
- About: `Claim an Agent, run Missions, reveal box assets, join Crews, and build Points for future project eligibility.`
- Commands:
  - `start - 打开 GrowthBot`
  - `farm - 查看任务状态`
  - `boxes - 查看盲盒资产`
  - `market - 查看市场`
  - `pool - 查看战队`
  - `help - 安全说明`

Avoid language that promises fixed tokens, fixed profit, fixed conversion, or risk-free rewards.

## TON API Key Guidance

For V0, `TON_API_KEY` is optional because GrowthBot is off-chain and does not execute real wallet actions.

When TON integration begins:

- Use **testnet first** for Agentic Wallet experiments, automated task execution, wallet deployment, and any transaction-writing feature.
- Use **mainnet read-only** for production discovery features such as balance display, transaction status lookup, or wallet verification.
- Do not enable mainnet automated execution until spend limits, isolated wallet controls, and audit review are complete.

An API key from `@tonapibot` can be used if it is for a TON API provider that supports the endpoints we need. Keep separate keys/environments for testnet and mainnet when possible:

```env
TON_NETWORK=testnet
TON_API_KEY_TESTNET=
TON_API_KEY_MAINNET=
TON_API_KEY=
```

Recommended default for the next phase: `TON_NETWORK=testnet`.
