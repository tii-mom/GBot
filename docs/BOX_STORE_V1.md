# Box Store V1 Specification (Legacy / Superseded)

> Status: legacy. Replaced by [Skill Card System V1](./SKILL_CARD_SYSTEM_V1.md), [G Token Economy V1](./G_TOKEN_ECONOMY_V1.md), and [GBot Canonical V1](./GBOT_CANONICAL_V1.md).

This document is preserved for historical reference only.

The GrowthBot official store allows users to purchase skill blind boxes (box products) using Growth Points (GP).

## Products

| Product | Code | Rarity | Price (GP) | Per-User Limit | Transferable |
|---------|------|--------|-----------|----------------|-------------|
| Starter Box | `starter` | common | 0 (free claim) | 1 | No |
| Worker Box | `worker` | rare | 250 | 5 | Yes |
| Specialist Box | `specialist` | epic | 1200 | 2 | Yes |

## Starter Box Claim Isolation

- **No Store Purchases**: The Starter Box is exclusive to the initial agent claim (`/agents/claim`). It cannot be purchased through the store. The store API returns `starter_box_not_purchasable` if a purchase attempt is made.
- **Visual Only**: The official store interface shows the Starter Box with a claimed/disabled status and does not allow users to trigger a purchase order.
- **One-Time Grant**: A `starter_box_grants` table tracks per-user uniqueness. Opening a Starter Box is idempotent — duplicate opens are rejected.

## Atomic Purchase and Fulfillment

- **Conditional Stock Deduction**: Purchases use a conditional UPDATE to prevent negative stock:
  ```sql
  UPDATE box_products
  SET remaining_supply = remaining_supply - ?
  WHERE id = ? AND remaining_supply >= ?
  ```
  If `meta.changes === 0`, the purchase is rejected with `out_of_stock`.

- **GP Balance Check**: The user's GP balance is computed from `point_ledger_events` before deduction. Insufficient balance returns `insufficient_balance`.

- **Per-User Limit**: Total fulfilled orders for the user+product are checked against `per_user_limit`. Exceeding the limit returns `user_limit_exceeded`.

- **Order Idempotency**: Duplicate requests (same `idempotencyKey`) return the original order without double-charging.

- **Batch Execution**: Order creation, GP deduction (negative ledger entry), and inventory item insertion are executed in a single `db.batch()` call.

## Drop Table Design

### Fixed vs. Weighted Random Rewards

Each box product has a `box_drop_items` table configuring its drop pool:

- **Fixed Rewards** (`guaranteed = 1`): Points (GP) and Energy bonuses that always drop. These use `point_amount` and `energy_amount` fields.
- **Weighted Random Rewards** (`guaranteed = 0`): Ability/tool/equipment items selected by weighted random roll. Each item has a `weight` field. The probability of each item is `weight / totalWeight`.

### Starter Box Drop Example

| Drop | Type | Guaranteed | Weight | Amount |
|------|------|-----------|--------|--------|
| GP Bonus | Points | ✅ | – | 100 GP |
| Energy Bonus | Energy | ✅ | – | 20 Energy |
| Verification Assistant | Ability (random) | ❌ | 30 | – |
| Translation Module | Ability (random) | ❌ | 25 | – |
| Energy Core | Ability (random) | ❌ | 15 | – |
| Auto-run Pass | Ability (random) | ❌ | 15 | – |
| Group Boost Module | Ability (random) | ❌ | 15 | – |

### Active Asset Filtering

Only assets whose definition has `status = 'enabled'` are eligible for drop pools. Items whose `max_supply` has been exhausted (`issued_count >= max_supply`) are also excluded from the random pool.

### Server-Side Execution

- Box opening rewards are generated completely on the server-side.
- The client API returns real probability numbers (e.g., `0.30` for 30%) rather than raw weights.
- `issued_count` is incremented atomically when an ability is dropped.

## Double-Open Protection

Box opening uses a conditional UPDATE to prevent double-opens:
```sql
UPDATE inventory_items
SET status = 'burned', updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND owner_user_id = ? AND status = 'available'
```
If `meta.changes === 0`, the box is already opened/burned and the request is rejected.
