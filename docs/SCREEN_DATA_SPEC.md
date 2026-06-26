# Screen Data Spec (Legacy / Superseded)

> Status: legacy. Replaced by [GBot Canonical V1](./GBOT_CANONICAL_V1.md) and the new real-asset product docs.

This document is preserved for historical reference only.

## 1. Purpose

This document tells frontend what data each screen needs.

Frontend can start with mock data matching these shapes, then connect to API later.

## 2. Shared UI State

Global app state:

```ts
type AppState = {
  user: User | null;
  agent: Agent | null;
  unreadAlerts: number;
  featureFlags: Record<string, boolean>;
};
```

## 3. Agent Home

API:

- `GET /me`
- `GET /leaderboard?scope=global&period=daily`
- `GET /inventory?active=true`

Required data:

- Agent name.
- Agent level.
- Energy and max Energy.
- Pending Points.
- Rank tier.
- Points to next tier.
- Active abilities.
- Today's available tasks count.
- Main recommendation.

States:

- No Agent.
- Agent active.
- Energy empty.
- Auto-run active.
- Restricted user.

## 4. Box Opening

API:

- `GET /inventory?type=box`
- `POST /boxes/{inventoryItemId}/open`

Required data:

- Box name.
- Box rarity.
- Transferable status.
- Rewards after open.
- Reward rarity.
- Updated Agent state.

States:

- Box available.
- Opening.
- Open success.
- Box already opened.
- Box expired.
- Not owner.

## 5. Inventory

API:

- `GET /inventory`
- `POST /abilities/{inventoryItemId}/activate`
- `POST /marketplace/listings`

Required data:

- Item id.
- Item type.
- Name.
- Rarity.
- Expiry.
- Transferable.
- Status.
- Uses remaining.
- Active/listable flags.

Filters:

- All.
- Boxes.
- Abilities.
- Tickets.
- Expiring.
- Transferable.

## 6. Missions

API:

- `GET /tasks/available`
- `POST /agents/{agentId}/farm`

Required data:

- Task name.
- Energy cost.
- Base reward.
- Time left.
- Project name.
- Required Skill.
- Auto-executable.
- Wallet requirement.

States:

- Enough Energy.
- Insufficient Energy.
- Requires Skill.
- Requires wallet.
- Task ended.

## 7. Leaderboard

API:

- `GET /leaderboard?scope=global&period=daily`
- `GET /leaderboard?scope=group&period=daily`

Required data:

- Current user rank.
- Current user tier.
- Points to next tier.
- Top rows.
- Period.
- Scope.

States:

- Global.
- Group.
- Friends, later.

## 8. Crew

API:

- `POST /groups/pools/join`
- `GET /groups/pools/{poolId}`

Required data:

- Group name.
- Member count.
- Daily score.
- Rank.
- Boost multiplier.
- Crew Box unlock progress.
- Top contributors.
- Share link.

States:

- No pool.
- Joined pool.
- Pool locked.
- Crew Box unlocked.

## 9. Marketplace

API:

- `GET /marketplace/listings`
- `POST /marketplace/listings`
- `POST /marketplace/listings/{listingId}/buy`
- `POST /marketplace/listings/{listingId}/cancel`

Required data:

- Floor price.
- 24h volume.
- Listing rows.
- Recent trades.
- User listable items.
- Fee estimate.

States:

- Empty market.
- Listing active.
- Purchase success.
- Listing unavailable.
- Restricted user.

## 10. Admin Screens

Admin should use separate auth.

Required pages:

- Dashboard.
- Users.
- Tasks.
- Boxes.
- Abilities.
- Marketplace.
- Risk.

Frontend should not expose admin routes inside Mini App navigation.
