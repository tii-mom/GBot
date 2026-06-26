# Points and Box Rules (Legacy / Superseded)

> Status: legacy. Replaced by [G Token Economy V1](./G_TOKEN_ECONOMY_V1.md), [Skill Card System V1](./SKILL_CARD_SYSTEM_V1.md), and [GBot Canonical V1](./GBOT_CANONICAL_V1.md).

This document is preserved for historical reference only.

## V0.3 Public Product Language

GrowthBot is positioned publicly as a Telegram-native Agent network. Users claim a free Agent, reveal Mission assets from boxes, run Missions, join Crews, and build GP for future project reward eligibility.

User-facing points brand:

- `GP` means Growth Points.
- Chinese product copy should use `成长积分 GP`.
- GP is an off-chain platform point, not a token.
- GP has no fixed token conversion rate and does not guarantee profit.
- GP can be earned, spent, or used as future activity/reward eligibility weight inside GrowthBot.

Public asset categories:

- `Profession`: Agent identity, such as Alpha Scout, Mission Runner, Crew Captain, Wallet Operator, Market Scout, and Project Hunter.
- `Skill`: Mission utility, such as Alpha Radar, Crew Boost, Task Reroll, and Energy Recovery.
- `Permit`: limited Mission access, such as 1-Day Mission Permit, 7-Day Agent Pass, and Wallet Task Permit.
- `Access`: project eligibility assets, such as Project Access Pass, Testnet Mission Slot, Partner Quest Pass, and Allowlist Weight.
- `Boost`: temporary modifiers for GP, Crew progress, or Mission routing.

Box tiers:

- `Starter Box`: free activation box. Best for first Mission setup and starter Skills.
- `Alpha Box`: market and campaign box. Best for Alpha Scout, Alpha Radar, Wallet Task Permit, and other scarce Mission assets.
- `Crew Box`: Telegram Crew unlock box. Best for Crew Captain, Crew Boost, and invite-driven assets.
- `Project Box`: partner campaign box. Best for Project Hunter, Project Access Pass, and Partner Quest Pass.

V0.3 remains off-chain. Agentic Wallet is presented only as an upgrade path for user-approved, isolated Wallet Missions with pause controls and limits.

## 1. Principles

The rules should be simple enough for users to understand and strict enough to resist abuse.

User-facing:

- Run Missions to earn GP.
- Use Agent Action Power.
- Open boxes.
- Upgrade Agent.
- Join Crews.
- Climb ranks.

Internal:

- Track every reward source.
- Delay final settlement.
- Apply anti-sybil checks.
- Avoid fixed token conversion promises.

## 2. Point Types

### 2.1 Growth Points (GP)

Growth Points, displayed as GP, are off-chain platform points earned by Agent activity.

Sources:

- Daily Missions.
- Box rewards.
- Skill boosts.
- Referral rewards.
- Group pool rewards.
- Project campaign rewards.

GP can be reduced or rejected during settlement if abuse is detected.

### 2.2 User Score

User Score is the user's long-term contribution rank.

Properties:

- Non-transferable.
- Anti-sybil adjusted.
- Used for rankings.
- Used for future allocation weight.

### 2.3 Claim Credits

Claim Credits are settled redemption units.

V0 status:

- Display as "Coming soon" or "Settlement preview".

Future uses:

- Project airdrop pools.
- Launch allocation.
- Whitelist redemption.
- Raffle entries.

## 3. Agent Action Power

Agent Action Power is consumed when the Agent performs higher-cost tasks.

Product guidance:

- Do not make Action Power the first-session blocker.
- Basic bounty discovery and link submission should stay low-friction.
- Use Action Power for anti-abuse pacing, high-value task scans, and advanced Agent actions.

V0 default:

- New Agent starts with 100 Energy.
- Daily free refill: 50 Energy.
- Max base Energy: 150.

Energy costs:

- Basic daily task: 10 Energy.
- Referral verification task: 0 Energy.
- Group pool contribution: 15 Energy.
- Project task: 20-50 Energy.
- Boosted task: base cost plus Skill cost.

Energy sources:

- Daily refill.
- Starter Box.
- Alpha Box.
- Invite reward.
- Group pool reward.
- Purchased pack, later.

## 4. Skill Rules

Skill fields:

- Name.
- Rarity.
- Type.
- Duration.
- Uses.
- Transferable.
- Stackable.
- Expiry.
- Applicable task types.

Skill types:

- GP multiplier.
- Action Power refill.
- Auto-run duration.
- Project access.
- Group boost.
- Rank protection.
- Raffle access.

Stacking rule:

- Only one points multiplier can apply to a single task in V0.
- Group boosts and personal boosts can stack.
- Max V0 multiplier cap: 3x.

Expiry:

- Temporary abilities should expire.
- Expiry creates urgency and marketplace activity.

V0.2 Skill metadata:

- `effect`: Short user-facing utility label.
- `sourceBox`: Which box minted the Skill.
- `usesRemaining`: Number of available activations.
- `tradableLabel`: `Market ready` or `Account-bound`.

V1.1 lifecycle:

- `available`: unequipped and usable. If transferable and not soulbound, it can be listed.
- `active`: equipped by the Agent. It cannot be listed while equipped.
- `cooling_down`: unequipped but locked for 24 hours. It cannot be listed or equipped until cooldown ends.
- `listed`: active marketplace listing.
- `burned` / `expired`: removed from normal use.

Starter skill cards:

- Permanently soulbound.
- May be used for baseline Agent training.
- Never become marketplace assets, even after unequip.

Transferable skill cards:

- Can be equipped by the Agent.
- Can be unequipped by the owner.
- Enter a 24-hour cooldown after unequip.
- Recover marketplace eligibility after cooldown if not soulbound.

## 5. Starter Box

Purpose:

- Activation and habit formation.

Rules:

- Free.
- One per user.
- Non-transferable.
- Must be opened before using marketplace.

Guaranteed contents:

- 100-500 Pending Points.
- 30-80 Energy.
- One basic Skill.

Example drop table:

- 45%: `24h Auto Run Missionser`
- 25%: `1.2x Points Boost`
- 20%: `50 Energy Pack`
- 10%: `Group Boost Starter`

## 6. Alpha Box

Purpose:

- Monetization and market activity.

Rules:

- Paid or campaign-run Missionsed.
- Transferable before opening.
- Opened contents may be transferable or non-transferable depending on type.
- Limited daily supply.

Example drop table:

- 40% Common Skill.
- 30% Rare Skill.
- 18% Energy or auto-run pass.
- 10% Project ticket.
- 2% Epic Skill.

Possible contents:

- `2x Points Boost`
- `7-Day Auto Run Missionser`
- `Launch Sniper Access`
- `High-Yield Scanner`
- `Group Mining Boost`
- `Rank Shield`

V0 implementation:

- `Starter Box`: 300 Pending Points, 50 Energy, `24h Auto Run Missionser`.
- `Alpha Box`: 800 Pending Points, `Launch Sniper Access`.
- `Crew Box`: 1200 Pending Points, 35 Energy, `Group Rally Boost`.
- `Project Box`: 2400 Pending Points, `Project Allowlist Ticket`.

The V0 UI displays remaining supply and recent rare drops as launch signals. These signals are for launch engagement and eligibility weight only; they must not be described as fixed token value.

V0.2 launch urgency surfaces:

- Home command center shows `boxSupply` for Starter / launch urgency / Group / Project.
- Opening modal shows Skill utility in the reward card.
- Admin Launch Ops monitors rare drops and supply status.

## 7. Project Box

Purpose:

- Project-specific growth and launch access.

Rules:

- Issued by project campaign.
- May require task completion or purchase.
- Contains project-specific points or access rights.

Possible contents:

- Project Pending Points.
- Project boost.
- Genesis badge.
- Launch ticket.
- Whitelist raffle ticket.

## 8. Crew Box

Purpose:

- Telegram group virality.

Unlock examples:

- 5 group members claim Agent.
- 20 group members contribute Energy.
- Group reaches Top 100 daily rank.

Rewards:

- Group boost.
- Energy.
- Alpha Box fragments.

Current V0 unlock target:

- 15 active Agents in the group unlock the daily Crew Box surface.
- The Mini App share message should say how many more Agents are needed.
- Project tickets.

## 9. Rank Tiers

V0 rank tiers:

- Top 1%.
- Top 5%.
- Top 10%.
- Top 20%.
- Top 50%.
- Unranked.

Ranking basis:

- User Score, not raw Pending Points.

Bot should show distance to next tier.

## 10. Settlement

V0 can display settlement as preview.

Future settlement:

```text
Pending Points
  -> anti-sybil checks
  -> project eligibility checks
  -> quality multiplier
  -> User Score and Claim Credits
```

Quality factors:

- Account age.
- Referral quality.
- Daily activity.
- Wallet connection.
- Group behavior.
- Task diversity.
- Suspicious pattern score.

## 11. Language Policy

Allowed language:

- "points"
- "airdrop chance"
- "allocation weight"
- "future reward eligibility"
- "project-specific redemption"

Avoid language:

- "fixed profit"
- "fixed token"
- "fixed conversion"
- "risk-free Mission running"
- "automatic profit"
