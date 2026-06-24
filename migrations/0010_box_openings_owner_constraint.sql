-- 0010_box_openings_owner_constraint.sql
-- Reconstruct box_openings to add owner identity without fabricating business facts.
-- This migration is intentionally fail-fast: every validation occurs before the
-- source table or trigger is changed.

CREATE TABLE migration_0010_assertions (
  assertion_name TEXT PRIMARY KEY,
  is_valid INTEGER NOT NULL CHECK (is_valid = 1),
  reason TEXT NOT NULL
);

INSERT INTO migration_0010_assertions VALUES (
  'no stale temp table',
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'box_openings_temp'
  ) THEN 1 ELSE 0 END,
  '0010 blocked: box_openings_temp already exists; inspect interrupted migration state'
);

INSERT INTO migration_0010_assertions VALUES (
  'opening ids unique',
  CASE WHEN NOT EXISTS (
    SELECT inventory_item_id FROM box_openings GROUP BY inventory_item_id HAVING COUNT(*) > 1
  ) THEN 1 ELSE 0 END,
  '0010 blocked: duplicate box_openings.inventory_item_id'
);

INSERT INTO migration_0010_assertions VALUES (
  'inventory exists',
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM box_openings bo
    LEFT JOIN inventory_items ii ON ii.id = bo.inventory_item_id
    WHERE ii.id IS NULL
  ) THEN 1 ELSE 0 END,
  '0010 blocked: box opening references missing inventory item'
);

INSERT INTO migration_0010_assertions VALUES (
  'inventory owner present',
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM box_openings bo
    JOIN inventory_items ii ON ii.id = bo.inventory_item_id
    WHERE ii.owner_user_id IS NULL OR trim(ii.owner_user_id) = ''
  ) THEN 1 ELSE 0 END,
  '0010 blocked: inventory owner is missing'
);

INSERT INTO migration_0010_assertions VALUES (
  'owner user exists',
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM box_openings bo
    JOIN inventory_items ii ON ii.id = bo.inventory_item_id
    LEFT JOIN users u ON u.id = ii.owner_user_id
    WHERE u.id IS NULL
  ) THEN 1 ELSE 0 END,
  '0010 blocked: inventory owner does not exist in users'
);

INSERT INTO migration_0010_assertions VALUES (
  'opening timestamp present',
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM box_openings WHERE opened_at IS NULL OR trim(opened_at) = ''
  ) THEN 1 ELSE 0 END,
  '0010 blocked: opening timestamp is missing'
);

CREATE TABLE box_openings_temp (
  inventory_item_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO box_openings_temp (inventory_item_id, user_id, opened_at)
SELECT bo.inventory_item_id, ii.owner_user_id, bo.opened_at
FROM box_openings bo
JOIN inventory_items ii ON ii.id = bo.inventory_item_id
JOIN users u ON u.id = ii.owner_user_id;

INSERT INTO migration_0010_assertions VALUES (
  'copy count matches',
  CASE WHEN (SELECT COUNT(*) FROM box_openings_temp) = (SELECT COUNT(*) FROM box_openings)
    THEN 1 ELSE 0 END,
  '0010 blocked: copied row count does not match source'
);

DROP TRIGGER IF EXISTS trg_box_openings_validation;
DROP TABLE box_openings;
ALTER TABLE box_openings_temp RENAME TO box_openings;

CREATE TRIGGER trg_box_openings_validation
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
    THEN RAISE(ABORT, 'Box is not available for opening or owner does not match')
  END;
END;

DROP TABLE migration_0010_assertions;
