# Bot State Machine

## 1. Bot Responsibilities

The Telegram Bot is the growth entry point.

It should:

- Onboard users.
- Open Mini App.
- Send daily reports.
- Handle referral links.
- Create group pool prompts.
- Send marketplace and launch-status alerts.
- Keep heavy work in queues.

## 2. User States

```text
new_user
  -> miniapp_opened
  -> agent_claimed
  -> starter_box_opened
  -> first_farming_completed
  -> returning_user
  -> paid_user
  -> wallet_user
```

## 3. `/start` Flow

Input:

- `/start`
- `/start ref_userId`
- `/start group_poolId`
- `/start box_campaignId`

Actions:

1. Parse start parameter.
2. Create or update user.
3. Record entry source.
4. Send start message.
5. Include Mini App button.

## 4. Referral Flow

When referred user starts:

1. Record referral relation.
2. Do not pay full reward immediately.
3. When referred user claims Agent, pay stage 1.
4. When referred user returns D1, pay stage 2.
5. During settlement, apply quality multiplier.

## 5. Group Pool Flow

When shared in a group:

1. Bot receives group context if added or invoked.
2. Create group record.
3. Create or join group pool.
4. Send group pool message.
5. Mini App link includes group start param.

Group message:

```text
This group started a GrowthBot Mining Pool.
Every verified Agent increases the group boost.
```

## 6. Daily Report Flow

Cron:

1. Enqueue `send_daily_report` jobs.
2. Queue consumer loads user Agent summary.
3. Generate report copy.
4. Send Telegram message.
5. Record analytics event.

Message variants:

- Earned points.
- Energy empty.
- Rank dropped.
- Box expiring.
- Marketplace moved.

## 7. Market Alert Flow

Trigger conditions:

- User near next tier.
- Energy empty.
- Box supply running out.
- Ability expiring.
- Marketplace floor moved.
- Group rank close to reward.

Throttle:

- Avoid spam.
- Max 1-3 alert messages per day per user in V0.

## 8. Webhook Handling

Webhook path:

`/telegram/webhook`

Required:

- Verify secret token if configured.
- Respond quickly.
- Queue slow side effects.
- Never block webhook on long DB or external calls.

## 9. Error Handling

If Bot cannot process:

- Log event.
- Send generic retry message only if useful.
- Do not expose internal errors.

Generic message:

```text
GrowthBot is busy. Try again in a moment.
```
