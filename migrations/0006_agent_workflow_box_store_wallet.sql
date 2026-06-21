-- 0006_agent_workflow_box_store_wallet.sql
-- Agent workflow state machine + official box store + agentic wallet observation mode
--
-- This migration is ADDITIVE ONLY. It does not modify or drop any existing
-- production table semantics. All new columns on existing tables are added via
-- ALTER ... ADD COLUMN with safe defaults so old rows and old code keep working.
-- The Cloudflare Worker also runs an idempotent self-heal routine
-- (ensureV1Data) at request time so a database without this migration applied
-- still functions.

-- =====================================================================
-- 1. AGENTS CORE ATTRIBUTE EXPANSION (Work Package A)
-- =====================================================================
-- Free Scout Agent formalisation: profession, status, experience, task
-- slots, daily run limits, capability scores and active run pointer.

ALTER TABLE agents ADD COLUMN profession TEXT NOT NULL DEFAULT 'scout';
ALTER TABLE agents ADD COLUMN experience INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN task_slots INTEGER NOT NULL DEFAULT 1;
ALTER TABLE agents ADD COLUMN daily_run_limit INTEGER NOT NULL DEFAULT 3;
ALTER TABLE agents ADD COLUMN daily_run_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN daily_run_date TEXT;
ALTER TABLE agents ADD COLUMN research_score INTEGER NOT NULL DEFAULT 20;
ALTER TABLE agents ADD COLUMN content_score INTEGER NOT NULL DEFAULT 20;
ALTER TABLE agents ADD COLUMN social_score INTEGER NOT NULL DEFAULT 10;
ALTER TABLE agents ADD COLUMN verification_score INTEGER NOT NULL DEFAULT 10;
ALTER TABLE agents ADD COLUMN onchain_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN risk_score INTEGER NOT NULL DEFAULT 30;
ALTER TABLE agents ADD COLUMN active_work_run_id TEXT;

-- =====================================================================
-- 2. INVENTORY ITEM -> ASSET DEFINITION LINK (Work Package D)
-- =====================================================================
-- Link existing user-owned inventory items back to the canonical asset
-- definition that produced them. Nullable so legacy rows remain valid.

ALTER TABLE inventory_items ADD COLUMN asset_definition_id TEXT;
ALTER TABLE inventory_items ADD COLUMN box_order_id TEXT;
CREATE INDEX IF NOT EXISTS idx_inventory_asset_def ON inventory_items(asset_definition_id);
CREATE INDEX IF NOT EXISTS idx_inventory_owner_type_status ON inventory_items(owner_user_id, item_type, status);

-- =====================================================================
-- 3. AGENT WORK RUNS / STEPS / ACTIVITY EVENTS (Work Package B)
-- =====================================================================

CREATE TABLE IF NOT EXISTS agent_work_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  task_kind TEXT NOT NULL DEFAULT 'basic',
  status TEXT NOT NULL DEFAULT 'discovered',
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0,
  estimated_reward INTEGER NOT NULL DEFAULT 0,
  estimated_energy INTEGER NOT NULL DEFAULT 0,
  actual_reward INTEGER NOT NULL DEFAULT 0,
  actual_energy INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  requires_user_action INTEGER NOT NULL DEFAULT 0,
  settled INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  failed_reason TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Idempotency: one work run per (user, idempotency_key). Unique index allows
-- multiple NULLs but enforces uniqueness on real keys.
CREATE UNIQUE INDEX IF NOT EXISTS uq_work_runs_user_idem ON agent_work_runs(user_id, idempotency_key);

CREATE TABLE IF NOT EXISTS agent_work_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  input_summary TEXT,
  output_summary TEXT,
  tool_name TEXT,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  approved_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES agent_work_runs(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_work_steps_run_order ON agent_work_steps(run_id, step_order);

CREATE TABLE IF NOT EXISTS agent_activity_events (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  run_id TEXT,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  metadata_json TEXT,
  visibility TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_work_runs_agent ON agent_work_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_work_runs_user_status ON agent_work_runs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_work_runs_task ON agent_work_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_work_steps_run ON agent_work_steps(run_id, step_order);
CREATE INDEX IF NOT EXISTS idx_activity_agent ON agent_activity_events(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_run ON agent_activity_events(run_id, created_at);

-- =====================================================================
-- 4. BOX PRODUCTS / DROP ITEMS / ORDERS (Work Packages E + F)
-- =====================================================================

CREATE TABLE IF NOT EXISTS box_products (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  box_type TEXT NOT NULL DEFAULT 'standard',
  rarity TEXT NOT NULL DEFAULT 'common',
  price_amount INTEGER NOT NULL DEFAULT 0,
  price_currency TEXT NOT NULL DEFAULT 'GP',
  total_supply INTEGER NOT NULL DEFAULT 0,
  remaining_supply INTEGER NOT NULL DEFAULT 0,
  per_user_limit INTEGER NOT NULL DEFAULT 0,
  sale_start_at TEXT,
  sale_end_at TEXT,
  transferable INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_box_products_code ON box_products(code);
CREATE INDEX IF NOT EXISTS idx_box_products_status ON box_products(status);

CREATE TABLE IF NOT EXISTS box_drop_items (
  id TEXT PRIMARY KEY,
  box_product_id TEXT NOT NULL,
  asset_definition_id TEXT,
  asset_name TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 0,
  guaranteed INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 1,
  max_quantity INTEGER NOT NULL DEFAULT 1,
  rarity TEXT NOT NULL DEFAULT 'common',
  max_supply INTEGER,
  issued_count INTEGER NOT NULL DEFAULT 0,
  point_amount INTEGER NOT NULL DEFAULT 0,
  energy_amount INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (box_product_id) REFERENCES box_products(id)
);

CREATE INDEX IF NOT EXISTS idx_box_drop_items_box ON box_drop_items(box_product_id);

CREATE TABLE IF NOT EXISTS box_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  box_product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  total_price INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GP',
  payment_provider TEXT NOT NULL DEFAULT 'gp_balance',
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  idempotency_key TEXT NOT NULL,
  fulfilled_inventory_item_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT,
  fulfilled_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (box_product_id) REFERENCES box_products(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_box_orders_user_idem ON box_orders(user_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_box_orders_user ON box_orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_box_orders_product ON box_orders(box_product_id, status);

-- Starter Box one-time grant tracking. A user may receive the free Starter
-- Box product grant at most once (distinct from opening inventory boxes).
CREATE TABLE IF NOT EXISTS starter_box_grants (
  user_id TEXT PRIMARY KEY,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  order_id TEXT
);

-- =====================================================================
-- 5. AGENTIC WALLET (OBSERVATION MODE) (Work Package G)
-- =====================================================================
-- Level 0 observation wallet. IMPORTANT: this table MUST NEVER store a
-- private key, seed phrase, or any signing material. Only a public address
-- plus permission/limit policy metadata.

CREATE TABLE IF NOT EXISTS agent_wallets (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'ton',
  network TEXT NOT NULL DEFAULT 'testnet',
  address TEXT,
  label TEXT,
  wallet_type TEXT NOT NULL DEFAULT 'observation',
  permission_level INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  spending_limit_daily INTEGER NOT NULL DEFAULT 0,
  spending_used_today INTEGER NOT NULL DEFAULT 0,
  spending_reset_date TEXT,
  transaction_limit INTEGER NOT NULL DEFAULT 0,
  allowed_actions_json TEXT NOT NULL DEFAULT '[]',
  allowed_contracts_json TEXT NOT NULL DEFAULT '[]',
  withdrawal_address TEXT,
  last_activity_at TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- One wallet per agent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_wallets_agent ON agent_wallets(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_wallets_user ON agent_wallets(user_id);

-- =====================================================================
-- 6. ASSET DEFINITIONS EXPANSION (Work Package D)
-- =====================================================================
-- The legacy asset_definitions table (created by ensureAdminConfigData) is
-- narrow. We add canonical v1 columns so the official catalogue carries
-- effect_type / duration / soulbound / transferable / required_level. All
-- nullable with defaults so legacy seed rows keep working.

ALTER TABLE asset_definitions ADD COLUMN asset_type TEXT;
ALTER TABLE asset_definitions ADD COLUMN duration_seconds INTEGER;
ALTER TABLE asset_definitions ADD COLUMN max_uses INTEGER;
ALTER TABLE asset_definitions ADD COLUMN stackable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE asset_definitions ADD COLUMN soulbound INTEGER NOT NULL DEFAULT 0;
ALTER TABLE asset_definitions ADD COLUMN transferable_v1 INTEGER;
ALTER TABLE asset_definitions ADD COLUMN required_level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE asset_definitions ADD COLUMN effect_type TEXT;
ALTER TABLE asset_definitions ADD COLUMN effect_value_json TEXT;
ALTER TABLE asset_definitions ADD COLUMN description_v1 TEXT;

-- Guarantee the canonical code uniqueness used for the four soulbound
-- default abilities idempotency check. Existing asset_definitions already
-- has a UNIQUE(key) so we add an internal_id stable column + UNIQUE on code.
ALTER TABLE asset_definitions ADD COLUMN code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_definitions_code ON asset_definitions(code);
