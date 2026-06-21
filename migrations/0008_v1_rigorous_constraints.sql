-- 0008_v1_rigorous_constraints.sql
-- Enforce GP balance constraints, append-only point ledger, exact-once work run settlement unique indices, and fail-safe triggers.

-- 1. Add failure columns to box_orders
ALTER TABLE box_orders ADD COLUMN failure_code TEXT;
ALTER TABLE box_orders ADD COLUMN failure_message TEXT;
ALTER TABLE box_orders ADD COLUMN fulfillment_attempts INTEGER NOT NULL DEFAULT 0;

-- 2. Add implementation_status to asset_definitions
ALTER TABLE asset_definitions ADD COLUMN implementation_status TEXT NOT NULL DEFAULT 'active';

-- 3. Create user_balance_snapshots table
CREATE TABLE IF NOT EXISTS user_balance_snapshots (
  user_id TEXT PRIMARY KEY,
  pending_points_balance INTEGER NOT NULL DEFAULT 0 CHECK (pending_points_balance >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 4. Create work_run_settlements table
CREATE TABLE IF NOT EXISTS work_run_settlements (
  run_id TEXT PRIMARY KEY,
  status TEXT NOT NULL, -- 'pending', 'reward_applied', 'energy_applied', 'completed', 'failed'
  reward_applied INTEGER NOT NULL DEFAULT 0,
  energy_applied INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES agent_work_runs(id)
);

-- 5. Indexes and constraints
-- Index for user points lookup
CREATE INDEX IF NOT EXISTS idx_point_ledger_user_type_v2 ON point_ledger_events(user_id, point_type);

-- Reward exact-once unique constraint (avoid double-settling tasks)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_settlement ON point_ledger_events(source_id, event_type, point_type);

-- 6. Trigger: prevent update on point_ledger_events (append-only)
CREATE TRIGGER IF NOT EXISTS trg_point_ledger_prevent_update
BEFORE UPDATE ON point_ledger_events
BEGIN
  SELECT RAISE(ABORT, 'point_ledger_events is append-only: UPDATE is forbidden');
END;

-- 7. Trigger: prevent delete on point_ledger_events (append-only)
CREATE TRIGGER IF NOT EXISTS trg_point_ledger_prevent_delete
BEFORE DELETE ON point_ledger_events
BEGIN
  SELECT RAISE(ABORT, 'point_ledger_events is append-only: DELETE is forbidden');
END;

-- 8. Trigger: keep pending_points_balance snapshot in sync
CREATE TRIGGER IF NOT EXISTS trg_point_ledger_sync
AFTER INSERT ON point_ledger_events
WHEN NEW.point_type = 'pending_points'
BEGIN
  INSERT INTO user_balance_snapshots (user_id, pending_points_balance, updated_at)
  VALUES (NEW.user_id, CASE WHEN NEW.amount > 0 THEN NEW.amount ELSE 0 END, CURRENT_TIMESTAMP)
  ON CONFLICT(user_id) DO UPDATE SET
    pending_points_balance = pending_points_balance + NEW.amount,
    updated_at = CURRENT_TIMESTAMP;
END;

-- 9. Backfill historical balance
INSERT OR IGNORE INTO user_balance_snapshots (user_id, pending_points_balance)
SELECT user_id, COALESCE(SUM(amount), 0)
FROM point_ledger_events
WHERE point_type = 'pending_points'
GROUP BY user_id;

-- 10. Trigger: prevent negative remaining supply in box products
CREATE TRIGGER IF NOT EXISTS trg_box_products_stock_check
BEFORE UPDATE OF remaining_supply ON box_products
BEGIN
  SELECT CASE
    WHEN NEW.remaining_supply < 0 THEN RAISE(ABORT, 'Out of stock')
  END;
END;

-- 11. Trigger: prevent drop item issued count from exceeding max supply
CREATE TRIGGER IF NOT EXISTS trg_box_drop_items_supply_check
BEFORE UPDATE OF issued_count ON box_drop_items
BEGIN
  SELECT CASE
    WHEN NEW.max_supply IS NOT NULL AND NEW.issued_count > NEW.max_supply THEN
      RAISE(ABORT, 'Drop item max supply exceeded')
  END;
END;
