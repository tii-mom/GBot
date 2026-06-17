# Analytics and Anti-Sybil

## 1. Analytics Goal

GrowthBot must measure two things from day one:

- Growth loop performance.
- User quality.

Without this, points and airdrop allocation will be easy to farm by low-quality accounts.

## 2. Core Events

### Acquisition

- `bot_started`
- `referral_link_opened`
- `group_link_opened`
- `mini_app_opened`

Properties:

- user id.
- referrer id.
- group id.
- campaign id.
- language.
- entry source.

### Activation

- `agent_claimed`
- `starter_box_opened`
- `first_farming_started`
- `first_farming_completed`

### Engagement

- `daily_report_opened`
- `task_started`
- `task_completed`
- `energy_spent`
- `ability_used`
- `inventory_viewed`
- `leaderboard_viewed`

### Virality

- `share_clicked`
- `share_completed`
- `invite_joined`
- `invite_activated`
- `group_pool_created`
- `group_pool_joined`
- `group_pool_rewarded`

### Economy

- `box_purchased`
- `box_opened`
- `marketplace_listing_created`
- `marketplace_listing_cancelled`
- `marketplace_item_purchased`
- `marketplace_fee_charged`

### Wallet

- `wallet_connect_started`
- `wallet_connected`
- `transaction_requested`
- `transaction_confirmed`
- `agentic_wallet_started`
- `agentic_wallet_activated`
- `agent_paused`
- `agent_withdrawal_requested`

## 3. Key Metrics

Activation:

- Bot start to Agent claim.
- Agent claim to Starter Box open.
- Starter Box open to first farming completion.

Virality:

- Share rate.
- Invite conversion.
- Activated invites per user.
- Group pool creation rate.
- New users per group pool.

Retention:

- D1 retention.
- D7 retention.
- Daily report open rate.
- Farming completion frequency.

Economy:

- Box purchase conversion.
- Average boxes opened per user.
- Marketplace listing rate.
- Marketplace purchase rate.
- Marketplace volume.

Quality:

- Verified referral rate.
- Suspicious account rate.
- Pending Points settlement approval rate.
- Fraud cluster count.

## 4. Anti-Sybil Signals

Pre-wallet signals:

- Telegram account age proxy, if available.
- Username and profile completeness.
- Language consistency.
- Session behavior.
- Referral graph.
- Group behavior.
- Time-to-action patterns.
- Device/session fingerprint, where allowed.

Post-wallet signals:

- Wallet uniqueness.
- Wallet age.
- On-chain activity.
- Funding source clustering.
- Reused transaction patterns.
- Connected wallet risk.

Behavior signals:

- Too many accounts from one referral source.
- Identical task timing.
- No daily retention.
- No group or social diversity.
- Repeated self-referral patterns.
- Marketplace wash trading.

## 5. Quality Multipliers

Pending Points should not become User Score at a fixed 1:1 ratio.

Suggested settlement:

```text
settled_score = pending_points * quality_multiplier
```

Quality multiplier examples:

- High quality: 0.8-1.2
- Normal: 0.5-0.8
- Low confidence: 0.1-0.5
- Fraud: 0

Inputs:

- Retention.
- Referral quality.
- Wallet quality.
- Task diversity.
- Group behavior.
- Marketplace behavior.

## 6. Referral Abuse Controls

Referral rewards should be staged:

- Small reward when invite joins.
- More reward when invite claims Agent.
- Larger reward when invite returns next day.
- Final reward only if invite passes quality checks.

Avoid paying full referral rewards immediately.

## 7. Marketplace Abuse Controls

Track:

- Self-trading.
- Circular trades.
- Price manipulation.
- Rapid buy-sell loops.
- Shared device or session between buyer and seller.
- Suspicious volume without farming activity.

Actions:

- Hide suspicious volume from trending.
- Delay settlement rewards.
- Restrict listings.
- Flag account for review.

## 8. Dashboards

Required internal dashboards:

- Acquisition funnel.
- Activation funnel.
- Viral coefficient.
- Retention cohorts.
- Box revenue.
- Marketplace volume.
- Top referrers.
- Suspicious clusters.
- Pending Points liability.
- Settlement approval rate.

