-- 0010_box_openings_owner_constraint.sql
-- Reconstruct box_openings table to add user_id for owner validation.

-- 1. Drop old trigger if it exists
DROP TRIGGER IF EXISTS trg_box_openings_validation;

-- 2. Create temporary table to hold migrated rows
CREATE TABLE IF NOT EXISTS box_openings_temp (
  inventory_item_id TEXT PRIMARY KEY,
  user_id TEXT,
  opened_at TEXT
);

-- 3. Backfill from old box_openings, linking user_id from owner_user_id in inventory_items
INSERT OR IGNORE INTO box_openings_temp (inventory_item_id, user_id, opened_at)
SELECT bo.inventory_item_id, ii.owner_user_id, bo.opened_at
FROM box_openings bo
LEFT JOIN inventory_items ii ON ii.id = bo.inventory_item_id;

-- 4. Recreate box_openings with NOT NULL constraints
DROP TABLE IF EXISTS box_openings;

CREATE TABLE box_openings (
  inventory_item_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Restore backfilled rows
INSERT OR IGNORE INTO box_openings (inventory_item_id, user_id, opened_at)
SELECT inventory_item_id, COALESCE(user_id, 'unknown_migrated'), COALESCE(opened_at, CURRENT_TIMESTAMP)
FROM box_openings_temp;

DROP TABLE IF EXISTS box_openings_temp;

-- 6. Recreate trigger validating user ownership, item type, and availability status
CREATE TRIGGER IF NOT EXISTS trg_box_openings_validation
BEFORE INSERT ON box_openings
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM inventory_items
      WHERE id = NEW.inventory_item_id
        AND owner_user_id = NEW.user_id
        AND item_type = 'box'
        AND status = 'available'
    )
    THEN RAISE(ABORT, 'Box is not available for opening')
  END;
END;
