-- 0009_v1_constraints_and_reservations.sql
-- Add box_openings table and user limit check triggers to prevent race conditions.

-- 1. Create box_openings table
CREATE TABLE IF NOT EXISTS box_openings (
  inventory_item_id TEXT PRIMARY KEY,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger: enforce box_openings reservation validity
CREATE TRIGGER IF NOT EXISTS trg_box_openings_validation
BEFORE INSERT ON box_openings
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM inventory_items
      WHERE id = NEW.inventory_item_id
        AND item_type = 'box'
        AND status = 'available'
    )
    THEN RAISE(ABORT, 'Box is not available for opening')
  END;
END;

-- 2. Trigger: prevent user purchase limit from being exceeded
CREATE TRIGGER IF NOT EXISTS trg_box_orders_user_limit_check
BEFORE UPDATE OF status ON box_orders
WHEN NEW.status = 'fulfilled'
BEGIN
  SELECT CASE
    WHEN (
      SELECT COALESCE(SUM(quantity), 0)
      FROM box_orders
      WHERE user_id = NEW.user_id
        AND box_product_id = NEW.box_product_id
        AND status = 'fulfilled'
        AND id != NEW.id
    ) + NEW.quantity > (
      SELECT per_user_limit
      FROM box_products
      WHERE id = NEW.box_product_id
    ) AND (
      SELECT per_user_limit
      FROM box_products
      WHERE id = NEW.box_product_id
    ) > 0
    THEN RAISE(ABORT, 'User purchase limit exceeded')
  END;
END;
