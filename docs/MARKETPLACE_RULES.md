# Marketplace Rules

## 1. Marketplace Purpose

The marketplace makes GrowthBot feel alive.

It should create:

- Price discovery.
- Scarcity.
- Scarcity and price discovery.
- Utility for unwanted abilities.
- A reason to return outside daily Missions.

## 2. V0 Tradable Assets

Tradable:

- Unopened Alpha Boxes.
- Transferable ability cards.

Not tradable:

- Starter Box.
- Free onboarding rewards.
- Agent.
- User Score.
- Pending Points.
- Claim Credits.
- Soulbound badges.
- Referral rewards.

## 3. Listing Rules

V0 listing type:

- Fixed-price listing.

Listing fields:

- Seller.
- Asset id.
- Asset type.
- Price.
- Currency.
- Expiry.
- Status.
- Created at.

Supported V0 currency:

- Off-chain test currency or internal balance for closed test.

Future currencies:

- TON.
- Telegram Stars.
- Claim Credits, if approved.

## 4. Fees

Recommended marketplace fee:

- 2.5% for V0 simulation.
- 2%-5% for production.

Future fee splits:

- Platform fee.
- Project royalty.
- Creator/KOL royalty, if asset originated from a campaign.

## 5. Transfer Rules

Transferable ability cards:

- Can be listed if unused.
- Cannot be listed while active.
- Cannot be listed after expiry.
- Cannot be listed if soulbound.

Unopened boxes:

- Can be listed before opening.
- Opening burns the box and mints contents.

Cooldown:

- V0 optional.
- Production should consider short cooldowns to reduce abuse.

## 6. Marketplace Discovery Surfaces

Required:

- Floor price.
- 24h volume.
- Recent sales.
- Trending boxes.
- Expiring abilities.

V0 implemented:

- Active listing count.
- Floor price.
- 24h volume.
- Floor movement indicator.
- Recent trades ticker.
- Trending assets strip.
- Expiry pressure on each listing card.

V0.2 implemented:

- Market sections: trending, rare, expiring, and floor.
- Listing cards show asset type, floor rank, and expiry minutes.
- Marketplace snapshot refreshes after buy, cancel, and list actions.

Future:

- Whale alerts.
- Top Agent inventory.
- Sweep floor button.
- Price chart.
- Holder leaderboard.

## 7. Rental Feature

Rental is deferred.

Future rental use cases:

- Rent `2x Points Boost` for 24 hours.
- Rent `Launch Sniper Access` during a project window.
- Rent `Group Mining Boost` for a group event.

Rental requires:

- Ability escrow.
- Time-based activation.
- Automatic return or burn.
- Abuse handling.

## 8. Risk Controls

Controls:

- Block suspicious users from listing.
- Delay withdrawal for risky accounts.
- Limit trading before anti-sybil confidence improves.
- Prevent self-trading rewards.
- Track wash trading patterns.

## 9. User Copy

Marketplace copy should emphasize utility and scarcity, not guaranteed profit.

Good:

> This asset can boost Agent Missions for selected tasks.

Avoid:

> Buy this card to earn guaranteed token profit.
