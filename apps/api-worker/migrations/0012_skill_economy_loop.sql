-- 0012_skill_economy_loop.sql
-- PR #6: Skill Box, Reset Core, skill upgrades, Normal→Advanced and Advanced→Expert synthesis
--
-- This migration adds the Skill Economy tables, including assertions,
-- consumptions, pity tracking, reset operations, and daily purchases.

-- =====================================================================
-- 0. TRANSIENT VALIDATIONS & ITEM CONSUMPTIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS operation_validations (
  operation_id TEXT NOT NULL,
  expected_count INTEGER NOT NULL,
  actual_count INTEGER NOT NULL,
  CHECK (expected_count = actual_count)
);

CREATE TABLE IF NOT EXISTS skill_economy_item_consumptions (
  inventory_item_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  consumption_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- 1. SKILL ECONOMY EVENTS (audit trail)
-- =====================================================================

CREATE TABLE IF NOT EXISTS skill_economy_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'skill_box_draw',
    'reset',
    'upgrade',
    'synthesis_input_consumed',
    'synthesis_result',
    'pity_incremented',
    'pity_triggered',
    'consumable_use',
    'energy_recovery'
  )),
  box_opening_id TEXT,
  learned_skill_id TEXT,
  inventory_item_id TEXT,
  slot_index INTEGER,
  roll_integer INTEGER,
  weight_total INTEGER,
  selected_range TEXT,
  selected_reward_type TEXT,
  selected_skill_definition_id TEXT,
  test_override_used INTEGER NOT NULL DEFAULT 0,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_skill_economy_events_user
  ON skill_economy_events(user_id, created_at);

-- =====================================================================
-- 2. EXPERT SYNTHESIS PITY (per-user, versioned for concurrency)
-- =====================================================================

CREATE TABLE IF NOT EXISTS skill_synthesis_pity (
  user_id TEXT PRIMARY KEY,
  pity_count INTEGER NOT NULL DEFAULT 0 CHECK (pity_count >= 0 AND pity_count <= 5),
  version INTEGER NOT NULL DEFAULT 1,
  last_operation_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =====================================================================
-- 3. SKILL UPGRADE OPERATIONS (idempotency tracking)
-- =====================================================================

CREATE TABLE IF NOT EXISTS skill_upgrade_operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  operation_type TEXT NOT NULL DEFAULT 'upgrade',
  learned_skill_id TEXT NOT NULL,
  from_level INTEGER NOT NULL,
  to_level INTEGER NOT NULL,
  consumed_inventory_item_id TEXT,
  gp_cost INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT,
  result_json TEXT NOT NULL DEFAULT '{}',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'reconciliation_required')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_upgrade_user_idem
  ON skill_upgrade_operations(user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_upgrade_ops_user
  ON skill_upgrade_operations(user_id, created_at);

-- =====================================================================
-- 4. SKILL SYNTHESIS OPERATIONS (idempotency tracking, both N→A and A→E)
-- =====================================================================

CREATE TABLE IF NOT EXISTS skill_synthesis_operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  operation_type TEXT NOT NULL DEFAULT 'synthesis',
  synthesis_type TEXT NOT NULL CHECK (synthesis_type IN ('normal_to_advanced', 'advanced_to_expert')),
  input_item_ids TEXT NOT NULL,
  output_item_id TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  pity_before INTEGER NOT NULL DEFAULT 0,
  pity_after INTEGER NOT NULL DEFAULT 0,
  gp_cost INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT,
  result_json TEXT NOT NULL DEFAULT '{}',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'reconciliation_required')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_synth_user_idem
  ON skill_synthesis_operations(user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_synth_ops_user
  ON skill_synthesis_operations(user_id, created_at);

-- =====================================================================
-- 5. SKILL BOX DAILY PURCHASE LIMIT (database-enforced concurrency)
-- =====================================================================

CREATE TABLE IF NOT EXISTS skill_box_daily_purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  box_product_id TEXT NOT NULL,
  utc_date TEXT NOT NULL,
  purchase_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, box_product_id, utc_date),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_skill_box_daily_user
  ON skill_box_daily_purchases(user_id, utc_date);

-- =====================================================================
-- 6. SEED DATA: Skill Box product + drop table
-- =====================================================================

INSERT OR IGNORE INTO box_products (id, code, name, description, box_type, rarity, price_amount, price_currency, total_supply, remaining_supply, per_user_limit, transferable, status, metadata_json)
VALUES ('bp_skill_box', 'skill_box', 'Skill Box', 'Contains skill cards, cores, tokens and recovery items. Use cards to learn or upgrade agent skills. Probability breakdown available in the store.', 'skill_box', 'rare', 200, 'GP', 500000, 500000, 10, 1, 'active', '{"dropConfigVersion":1,"rewardTypeWeights":{"normal_skill":630000,"advanced_skill":150000,"reset_core":90000,"protection_token":60000,"energy_recovery":50000,"gp_small":20000}}');

INSERT OR IGNORE INTO box_drop_items (id, box_product_id, asset_definition_id, asset_name, weight, guaranteed, min_quantity, max_quantity, rarity, point_amount, energy_amount, metadata_json) VALUES
('di_skill_normal', 'bp_skill_box', NULL, 'Normal Skill Card', 630000, 0, 1, 1, 'common', 0, 0, '{"rewardType":"normal_skill","dropConfigVersion":1}'),
('di_skill_advanced', 'bp_skill_box', NULL, 'Advanced Skill Card', 150000, 0, 1, 1, 'rare', 0, 0, '{"rewardType":"advanced_skill","dropConfigVersion":1}'),
('di_skill_reset_core', 'bp_skill_box', NULL, 'Reset Core', 90000, 0, 1, 1, 'rare', 0, 0, '{"rewardType":"reset_core","dropConfigVersion":1}'),
('di_skill_protection_token', 'bp_skill_box', NULL, 'Skill Protection Token', 60000, 0, 1, 1, 'rare', 0, 0, '{"rewardType":"protection_token","dropConfigVersion":1}'),
('di_skill_energy_recovery', 'bp_skill_box', NULL, 'Energy Recovery', 50000, 0, 1, 1, 'common', 0, 0, '{"rewardType":"energy_recovery","dropConfigVersion":1}'),
('di_skill_gp_small', 'bp_skill_box', NULL, 'GP Small', 20000, 0, 1, 1, 'common', 50, 0, '{"rewardType":"gp_small","dropConfigVersion":1,"pointAmount":50}');

-- =====================================================================
-- 7. RECREATE AGENT SKILL OPERATIONS (to add updated_at, maintaining PR #5 compatibility)
-- =====================================================================

PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS agent_skill_operations_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('learn', 'replace', 'lock', 'unlock', 'protect_learn')),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT,
  learned_skill_id TEXT,
  replaced_learned_skill_id TEXT,
  consumed_inventory_item_id TEXT,
  consumed_protection_item_id TEXT,
  result_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

INSERT INTO agent_skill_operations_new (
  id,
  user_id,
  agent_id,
  operation_type,
  idempotency_key,
  request_hash,
  learned_skill_id,
  replaced_learned_skill_id,
  consumed_inventory_item_id,
  consumed_protection_item_id,
  result_json,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  user_id,
  agent_id,
  operation_type,
  idempotency_key,
  request_hash,
  learned_skill_id,
  replaced_learned_skill_id,
  consumed_inventory_item_id,
  consumed_protection_item_id,
  result_json,
  status,
  created_at,
  CURRENT_TIMESTAMP
FROM agent_skill_operations;

DROP TABLE agent_skill_operations;
ALTER TABLE agent_skill_operations_new RENAME TO agent_skill_operations;

CREATE UNIQUE INDEX IF NOT EXISTS uq_skill_ops_user_idem
  ON agent_skill_operations(user_id, operation_type, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_skill_ops_agent
  ON agent_skill_operations(agent_id, created_at);

PRAGMA foreign_keys=ON;

-- =====================================================================
-- 8. RESET OPERATIONS & ORDER EXTENSIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS agent_skill_reset_operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  operation_type TEXT NOT NULL DEFAULT 'reset' CHECK (operation_type = 'reset'),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT,
  learned_skill_id TEXT,
  replaced_learned_skill_id TEXT,
  consumed_inventory_item_id TEXT,
  consumed_protection_item_id TEXT,
  result_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'reconciliation_required')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reset_ops_user_idem
  ON agent_skill_reset_operations(user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_reset_ops_agent
  ON agent_skill_reset_operations(agent_id, created_at);

ALTER TABLE box_orders ADD COLUMN request_hash TEXT;

