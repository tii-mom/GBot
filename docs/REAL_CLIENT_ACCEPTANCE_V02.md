# GrowthBot V0.2 Real Client Acceptance

Last updated: 2026-06-16

Use this checklist on a real Telegram mobile client before inviting more testers.

## 1. Entry

- Open `@G2047_bot`.
- Tap `Open GrowthBot`.
- Confirm Mini App opens at `https://app.gb8.top`.
- Confirm the app does not show `API fallback active`.
- Confirm Home loads within 3 seconds on mobile data and Wi-Fi.

## 2. First Session Flow

- Claim Free Agent.
- Confirm Starter Box appears or box opening overlay opens.
- Open Starter Box.
- Confirm reward reveal shows points, energy, ability rarity, and ability utility.
- Tap Share Result once.
- Confirm Telegram share sheet opens and the URL includes `start=box_report`.
- Close share sheet and return to GrowthBot without losing state.

## 3. Earn Flow

- Go to Earn.
- Run `Daily Check-in` or another low-energy no-wallet task.
- Confirm Pending Points and Energy update.
- Confirm wallet-required task stays locked and does not block V0 farming.
- Confirm no copy promises guaranteed token, guaranteed profit, fixed conversion, risk-free, or automatic profit.

## 4. Viral Loop

- On Home, tap Share Report.
- Confirm Telegram share sheet opens and URL includes `start=ref_`.
- Go to Group Pool.
- Join the default test pool.
- Tap Invite Group Members.
- Confirm Telegram share sheet opens and URL includes `start=group_`.
- Ask one tester to open one shared link and confirm GrowthBot opens from the bot.

## 5. Marketplace

- Open Marketplace.
- Confirm visible market stats: floor, 24h volume, floor move, live listings.
- Confirm market sections render: trending, rare, expiring, floor.
- Confirm listing cards show price, rarity, seller, expiry, asset type, market section, and floor rank.
- If the test user has enough Pending Points, buy a low-priced listing.
- Confirm inventory updates after purchase.
- If the user owns a transferable box or ability, list it and cancel listing once.

## 6. Admin Launch Operations

- Open `https://admin.gb8.top`.
- Log in to Admin from a trusted device only.
- Confirm overview metrics load from API.
- Open `启动运营看板`.
- Confirm Active Listings, Personal Shares, Box Reports, Group Invites render.
- Confirm Rare Drop Monitor, Share Surface Checklist, and Box Supply Status render.
- After sharing from mobile, refresh Admin and confirm share event counts increase.

## 7. Pass / Fail Gate

Internal soft launch may continue only if:

- At least 5 testers complete Claim -> Open Box -> Earn.
- At least 3 testers successfully use a share link.
- Admin launch operations shows share events after tester sharing.
- No critical mobile layout overlap appears on iPhone and Android.
- Boxes and Tasks pause controls still work.
