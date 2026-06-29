# Launch Operations Playbook (Legacy / Superseded)

> Status: legacy. Replaced by [GBot Canonical V1](./GBOT_CANONICAL_V1.md).

This document is preserved for historical reference only.

## 1. Launch Goal

V0 launch should validate:

- Users claim Agents.
- Users open boxes.
- Users share reports.
- Groups create mining pools.
- Users understand marketplace value.

Do not launch V0 as a final airdrop product.

## 2. Pre-Launch Checklist

Product:

- Bot start flow tested.
- Mini App first session tested.
- Starter Box rewards configured.
- Alpha Box configured.
- Daily tasks configured.
- Leaderboard active.
- Group pool active.
- Marketplace enabled or hidden intentionally.

Operations:

- Admin users created.
- Support responses prepared.
- Risk dashboard checked.
- Box drop table reviewed.
- Bot copy reviewed.
- Launch campaign calendar ready.

Legal and safety:

- No guaranteed profit language.
- No fixed token conversion language.
- Blind box rarity shown for paid boxes.
- Wallet warnings ready, if wallet is enabled.

## 3. Soft Launch Plan

Stage 1: Internal

- 20-50 internal testers.
- Test all flows.
- Reset economy if needed.

Stage 2: Private Crypto Groups

- 3-5 Telegram groups.
- 500-2,000 users total.
- Focus on group pools and report sharing.

Stage 3: KOL Squads

- 5-10 KOLs.
- Each KOL gets campaign link.
- Track activated users, not clicks only.

Stage 4: Public Launch

- Limited Alpha Box supply.
- Daily group pool contest.
- Public leaderboard.
- Marketplace event.

## 4. Daily Operations

Morning:

- Check DAU and activation funnel.
- Check suspicious clusters.
- Configure daily tasks.
- Configure box supply.
- Prepare Bot push.

During day:

- Monitor group pools.
- Monitor box openings.
- Monitor marketplace floor.
- Watch support tickets.
- Disable abusive tasks or users.

Evening:

- Send daily Agent report.
- Publish group leaderboard.
- Announce next pool countdown.
- Review retention and referral quality.

## 5. Campaign Types

Daily Drop Pool:

- Daily limited rewards.
- Users run Missions and compete.

Group Mining Race:

- Groups compete for Group Box unlocks.

Alpha Box Drop:

- Limited box sale window.
- Marketplace trading enabled.

Project Launch Pool:

- One ecosystem project gets task pool and Project Box.

KOL Squad Battle:

- KOLs compete by activated users and quality score.

## 6. Key Launch Metrics

Daily:

- Bot starts.
- Agent claims.
- Starter Box opens.
- First Mission completed.
- Shares.
- Referrals.
- Group pools created.
- D1 retention.
- Box purchase conversion.
- Marketplace volume.
- Risk rejects.

Weekly:

- Viral coefficient.
- Valid user cost.
- Group-driven user share.
- Marketplace repeat users.
- Retention by acquisition source.
- Top KOL quality.

## 7. Incident Response

If box rewards are wrong:

- Pause box openings.
- Snapshot affected openings.
- Decide compensation.
- Publish short notice.

If points exploit appears:

- Pause affected task.
- Flag users.
- Recalculate ledger.
- Announce settlement adjustment if needed.

If marketplace abuse appears:

- Hide suspicious volume.
- Freeze suspicious listings.
- Restrict accounts.

If wallet issue appears:

- Pause all automated wallet actions.
- Notify users.
- Keep withdrawal path open where possible.

If Telegram ingestion issue / flood / webhook spam appears:

- Set environment variable `TELEGRAM_INGESTION_ENABLED=0` in Cloudflare Dashboard and redeploy to trigger instant ingestion kill switch.
- Admin review console will show telemetry, but no database persistence or signal generation will run.
- Keep webhook secret rotation ready in case of token leakage.

