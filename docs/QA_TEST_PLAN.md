# QA Test Plan

## 1. Goal

QA must protect the economic loop:

- Users cannot claim duplicate rewards.
- Boxes produce valid rewards.
- Abilities apply correctly.
- Marketplace ownership is correct.
- Points ledger remains consistent.
- Abuse controls work.

## 2. Critical Test Flows

### 2.1 New User

Test:

- Start Bot.
- Open Mini App.
- Authenticate.
- Claim Agent.
- Receive Starter Box.
- Open Starter Box.
- Start farming.
- See points and rank.

Expected:

- One Agent only.
- One Starter Box only.
- Ledger events created.

### 2.2 Duplicate Claim

Test:

- Call claim Agent twice.
- Refresh page.
- Reopen Mini App.

Expected:

- No duplicate Agent.
- No duplicate Starter Box.
- Existing state returned.

### 2.3 Box Opening

Test:

- Open box.
- Reopen same box.
- Open expired box.
- Open non-owned box.

Expected:

- Box burns once.
- Rewards credited once.
- Invalid opens rejected.

### 2.4 Ability Use

Test:

- Use valid ability.
- Use expired ability.
- Use non-applicable ability.
- Stack two multipliers.

Expected:

- V0 stacking cap enforced.
- Uses decrement correctly.
- Expiry enforced.

### 2.5 Farming

Test:

- Run task with enough Energy.
- Run task without enough Energy.
- Run task outside active window.
- Run task above daily limit.

Expected:

- Energy deducted only for valid completion.
- Points credited only once.
- Ledger events match agent state.

### 2.6 Referral

Test:

- New user joins from referral.
- Same user opens referral twice.
- Self-referral.
- Low-quality invite does not return.

Expected:

- Referral reward staged.
- Self-referral blocked.
- Full reward not paid immediately.

### 2.7 Group Pool

Test:

- User joins group pool.
- Multiple users join.
- Same user joins twice.
- Group boost applies.

Expected:

- Member counted once.
- Group score updates.
- Boost applies within cap.

### 2.8 Marketplace

Test:

- List transferable item.
- Try listing soulbound item.
- Buy listing.
- Cancel listing.
- Buy cancelled listing.
- Seller tries buying own listing.

Expected:

- Ownership transfers once.
- Fees recorded.
- Invalid trades blocked.

### 2.9 Admin

Test:

- Create task.
- Disable task.
- Edit box drop table.
- Restrict user.

Expected:

- Audit log created.
- Disabled task unavailable.
- Restricted user blocked from economic actions.

## 3. Ledger Consistency Checks

Automated checks:

- User point balance equals ledger sum.
- Inventory owner matches trade history.
- Box opening count equals burned boxes.
- Marketplace trades have buyer, seller, fee, and item transfer.
- Energy balance never below zero.

## 4. Load Tests

Minimum V0 tests:

- 1,000 concurrent Mini App sessions.
- 500 simultaneous box openings.
- 500 simultaneous farming runs.
- 100 simultaneous marketplace purchases.

## 5. Security Tests

Test:

- Forged Telegram init data.
- Replayed API request.
- Unauthorized inventory access.
- Listing another user's item.
- Admin API without admin auth.

Expected:

- All blocked.
- Suspicious attempts logged.

## 6. Release Gate

Do not launch until:

- Critical flows pass.
- Ledger checks pass.
- Admin can pause boxes and tasks.
- Bot copy has no guaranteed-return language.
- Support team can look up user state.

