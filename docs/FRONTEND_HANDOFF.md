# Frontend Handoff

## 1. Product Direction

GrowthBot is a Telegram-native auto airdrop farming product.

The UI should make users feel:

- Fast reward.
- Constant progress.
- Ranking pressure.
- Market movement.
- Group competition.

It should not feel like:

- A generic quest board.
- A SaaS dashboard.
- A slow wallet app.

## 2. Required V0 Screens

### 2.1 Agent Home

Purpose:

- Main daily screen.

Must show:

- Agent identity.
- Energy.
- Pending Points.
- Rank tier.
- Distance to next tier.
- Active abilities.
- Main CTA.

Primary CTAs:

- `Start Farming`
- `Open Box`
- `Share Report`

### 2.2 Box Opening

Purpose:

- Reward moment.

Must show:

- Box type.
- Opening animation.
- Reward reveal.
- Rarity feedback.
- Share CTA.

### 2.3 Inventory

Purpose:

- User manages boxes and abilities.

Must show:

- Boxes.
- Abilities.
- Expiry.
- Transferability.
- Use/List buttons.

### 2.4 Earn

Purpose:

- Available tasks.

Must show:

- Task reward.
- Energy cost.
- Time left.
- Auto-executable status.
- Required ability.

### 2.5 Leaderboard

Purpose:

- Launch status and asset discovery.

Must show:

- User rank.
- Points to next tier.
- Top users.
- Group ranking entry.

### 2.6 Group Pool

Purpose:

- Telegram group virality.

Must show:

- Group score.
- Member count.
- Boost multiplier.
- Rank.
- Invite/share CTA.
- Group Box unlock progress.

### 2.7 Marketplace

Purpose:

- Asset discovery and liquidity.

Must show:

- Floor price.
- 24h volume.
- Trending boxes.
- Ability listings.
- Recent trades.
- List item CTA.

### 2.8 Admin

Frontend user-facing team may not own admin, but admin screens are needed.

Required admin pages:

- Dashboard.
- Users.
- Tasks.
- Boxes.
- Abilities.
- Marketplace.
- Risk.

## 3. Visual Direction

Recommended feel:

- Crypto-native.
- High contrast.
- Reward-heavy.
- Dense but readable.
- Strong rarity treatment.
- Clear countdowns and ranks.

Avoid:

- Generic pastel SaaS.
- Long educational blocks.
- Heavy landing page.
- Decorative sections that do not support action.

## 4. Information Hierarchy

Every screen should answer:

1. What did I earn?
2. What am I missing?
3. How do I catch up?
4. What can I share?

## 5. API Dependencies

Frontend depends on:

- [API Contract](./API_CONTRACT.md)
- [Points and Box Rules](./POINTS_AND_BOX_RULES.md)
- [Marketplace Rules](./MARKETPLACE_RULES.md)
- [Bot Copy](./BOT_COPY.md)

## 6. MVP Design Constraint

The first session should not require wallet connection.

Wallet and Agentic Wallet should appear as upgrade paths, not entry blockers.
