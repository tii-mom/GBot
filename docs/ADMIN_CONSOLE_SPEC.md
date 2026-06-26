# Admin Console Spec (Legacy / Superseded)

> Status: legacy. Replaced by [GBot Canonical V1](./GBOT_CANONICAL_V1.md) and the real-asset admin docs.

This document is preserved for historical reference only.

## 1. Purpose

GrowthBot needs an admin console from the start because operations depend on tasks, boxes, rewards, groups, and risk controls.

Without admin tooling, campaigns cannot be adjusted safely.

## 2. Admin Roles

Suggested roles:

- Owner: full access.
- Growth Admin: tasks, boxes, campaigns, groups.
- Risk Admin: users, restrictions, suspicious activity.
- Support Admin: user lookup and read-only logs.
- Finance Admin: marketplace, payments, fees.

## 3. Required V0 Pages

### 3.1 Dashboard

Metrics:

- Bot starts.
- Agent claims.
- Starter Box opens.
- Daily active users.
- Shares.
- Referrals.
- Group pools.
- Box openings.
- Marketplace volume.
- Suspicious users.

### 3.2 Users

Features:

- Search by Telegram id, username, internal user id.
- View Agent status.
- View points ledger.
- View inventory.
- View referral tree.
- View risk status.
- Restrict user.
- Add internal note.

### 3.3 Tasks

Features:

- Create task.
- Edit task.
- Enable/disable task.
- Set Energy cost.
- Set base Pending Points.
- Set task period.
- Set daily/total limit.
- Set wallet requirement.
- Set auto-executable flag.

### 3.4 Boxes

Features:

- Create box.
- Configure supply.
- Configure sale window.
- Configure transferability.
- Configure drop table.
- Preview expected value.
- Disable box sale/opening.

### 3.5 Abilities

Features:

- Create ability.
- Set rarity.
- Set duration.
- Set uses.
- Set transferability.
- Set stacking group.
- Set max multiplier.
- Disable ability.

### 3.6 Marketplace

Features:

- View listings.
- View trades.
- Cancel suspicious listing.
- Restrict suspicious trader.
- View floor and volume.
- View wash-trade alerts.

### 3.7 Group Pools

Features:

- View group pools.
- View group ranks.
- View group members.
- Disable abusive group.
- Grant Group Box manually if needed.

### 3.8 Risk

Features:

- Suspicious account clusters.
- Referral abuse.
- Marketplace abuse.
- Same-session clusters.
- Point farming anomalies.
- Manual risk status updates.

### 3.9 Campaigns

Features:

- Create project campaign.
- Attach tasks.
- Attach Project Box.
- Set reward pool.
- Monitor campaign performance.

## 4. Audit Requirements

Every admin mutation must record:

- Admin id.
- Action.
- Target.
- Before state.
- After state.
- Timestamp.
- Reason, if risk-related.

## 5. V0 Admin Priority

Build first:

1. Users.
2. Tasks.
3. Boxes.
4. Abilities.
5. Points ledger viewer.
6. Marketplace viewer.
7. Basic dashboard.

Defer:

- Full campaign builder.
- Advanced charting.
- Finance exports.
- Self-serve project portal.
