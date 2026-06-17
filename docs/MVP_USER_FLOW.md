# MVP User Flow

## 1. Design Goal

The MVP must make users feel three things within the first minute:

- I got something for free.
- My Agent can work for me.
- I can get ahead by sharing or upgrading.

The first session should avoid wallet connection unless the user voluntarily upgrades.

## 2. First Session Flow

### Step 1: Start Bot

Entry points:

- Direct Bot link.
- Referral deep link.
- Group shared report.
- Group mining pool link.
- Box campaign link.

Bot message:

> Your GrowthBot Agent is ready for Missions, boxes, Crews, and future reward eligibility.

Primary button:

- `Claim Free Agent`

Secondary buttons:

- `Today's Drop Pool`
- `How It Works`

Data captured:

- Telegram user id.
- Start parameter.
- Referral source.
- Language.
- Entry context.

### Step 2: Claim Free Agent

Mini App opens.

User sees:

- Agent avatar placeholder.
- Agent name.
- Level 1.
- 100 starting Energy.
- 0 Pending Points.
- Rank: Unranked.

User taps:

- `Activate Agent`

Result:

- Agent is created.
- User receives one Starter Box.
- User gets a starter Mission utility asset.

### Step 3: Open Starter Box

User opens the Starter Box immediately.

Starter Box should always produce:

- Some Energy.
- Some Pending Points or point boost.
- One visible ability or ticket.

Example result:

- `+300 Pending Points`
- `+50 Energy`
- `Mission Runner`

After opening, show:

- `Use Now`
- `Share Result`
- `Start Missions`

### Step 4: Start Missions

Agent starts free tasks.

MVP tasks can be simulated or rule-based:

- Daily check-in.
- Visit project page.
- Join official Telegram channel.
- Join group mining pool.
- Invite user.
- Open box.

User sees a progress state:

> Agent is running 3 available Missions.

After completion:

> Agent earned 420 Pending Points.

### Step 5: Progress Screen

Show:

- Current Pending Points.
- Current rank percentile.
- Distance to next rank tier.
- Today's remaining free tasks.
- A box or boost recommendation.

Example:

> You are 680 points away from Top 20%.

Primary buttons:

- `Share Report for Boost`
- `Join Group Pool`
- `Open Alpha Box`

### Step 6: Share Report

User can share:

- Daily report.
- Starter Box result.
- Rank challenge.
- Group mining pool link.

Share copy:

> My GrowthBot Agent earned 420 Points in its first Mission run. Claim yours before today's pool ends.

When a friend joins:

- Referrer gets Pending Points.
- Referrer gets Energy.
- Friend gets Starter Box.
- Both may get group or referral multiplier if applicable.

### Step 7: Group Mining Pool

If user shares into a group:

- Bot creates or joins a group pool.
- Group gets a Pool ID.
- Group members contribute points.
- Group ranking appears.

Group pool message:

> This group started a mining pool. Every new Agent increases the pool boost.

Group pool rewards:

- Group Boost.
- Energy.
- Group Box unlock progress.
- Rank visibility.

## 3. Returning User Flow

Daily Bot report:

> Your Agent earned 1,260 Pending Points since your last report.

Daily actions:

- Claim report.
- Spend Energy.
- Open available box.
- Join expiring project pool.
- Share to boost.
- Check marketplace.

## 4. Paid Upgrade Flow

Upgrade prompts should be based on missed opportunity, not generic payment.

Examples:

- `Your Agent ran out of Energy. Add Energy to continue Missions.`
- `Top 10% users average 3.2 assets. Open an Alpha Box to upgrade your Mission setup.`
- `This project pool requires Launch Sniper Access.`

Paid options:

- Alpha Box.
- Energy pack.
- Auto-run pass.
- Pro subscription.
- Agentic Wallet activation, later phase.

## 5. Agentic Wallet Upgrade Flow

This should not be required in the first session.

When introduced:

1. User sees higher-yield on-chain task pool.
2. User taps `Unlock On-Chain Farming`.
3. User connects TON wallet.
4. User pays activation fee or deposits budget.
5. Agentic Wallet is created or configured.
6. Agent can execute approved low-risk actions.

Copy:

> Unlock Wallet Missions with an isolated Agent Wallet. Your main wallet stays in your control.

## 6. MVP Screens

Required screens:

- Agent Home.
- Box Opening.
- Inventory.
- Earn.
- Leaderboard.
- Group Pool.
- Share Report.
- Marketplace.

Optional in MVP:

- Wallet.
- Claim Credits.
- Project detail.
