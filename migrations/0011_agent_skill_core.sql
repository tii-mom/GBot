-- 0011_agent_skill_core.sql
-- Agent Skill Core: skill definitions, learned skills (slot-based), skill events,
-- idempotent skill operations, and inventory link.

-- =====================================================================
-- 1. AGENT SKILL DEFINITIONS
-- =====================================================================
-- Canonical skill catalog. Three tiers: normal, advanced, expert.
-- 4 core modules (is_core=1) + 40 learnable skills = 44 total.

CREATE TABLE IF NOT EXISTS agent_skill_definitions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('normal', 'advanced', 'expert')),
  category TEXT NOT NULL CHECK (category IN ('research', 'content', 'social', 'verification', 'onchain')),
  is_core INTEGER NOT NULL DEFAULT 0 CHECK (is_core IN (0, 1)),
  max_level INTEGER NOT NULL DEFAULT 5,
  required_agent_level INTEGER NOT NULL DEFAULT 1,
  effect_type TEXT,
  effect_config_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'deprecated', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- 2. AGENT LEARNED SKILLS
-- =====================================================================

CREATE TABLE IF NOT EXISTS agent_learned_skills (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  skill_definition_id TEXT NOT NULL,
  skill_level INTEGER NOT NULL DEFAULT 1 CHECK (skill_level >= 1),
  slot_index INTEGER NOT NULL CHECK (slot_index >= 0),
  locked INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'replaced', 'disabled')),
  source_inventory_item_id TEXT,
  replaced_by_learned_skill_id TEXT,
  replaced_at TEXT,
  learned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (skill_definition_id) REFERENCES agent_skill_definitions(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_active_skill_definition
  ON agent_learned_skills(agent_id, skill_definition_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_active_skill_slot
  ON agent_learned_skills(agent_id, slot_index)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_single_locked_skill
  ON agent_learned_skills(agent_id)
  WHERE locked = 1 AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_learned_skills_agent
  ON agent_learned_skills(agent_id, status);

-- =====================================================================
-- 3. AGENT SKILL OPERATIONS (idempotency tracking)
-- =====================================================================

CREATE TABLE IF NOT EXISTS agent_skill_operations (
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
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_skill_ops_user_idem
  ON agent_skill_operations(user_id, operation_type, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_skill_ops_agent
  ON agent_skill_operations(agent_id, created_at);

-- =====================================================================
-- 4. AGENT SKILL EVENTS (audit trail)
-- =====================================================================

CREATE TABLE IF NOT EXISTS agent_skill_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('learn', 'replace_random', 'lock', 'unlock', 'protect', 'consume_card', 'consume_protection_token', 'replace_skill_executed')),
  skill_definition_id TEXT,
  replaced_skill_definition_id TEXT,
  inventory_item_id TEXT,
  protection_inventory_item_id TEXT,
  slot_index INTEGER,
  operation_id TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_skill_events_agent
  ON agent_skill_events(agent_id, created_at);

-- =====================================================================
-- 5. INVENTORY ITEMS — ADD SKILL DEFINITION LINK
-- =====================================================================

ALTER TABLE inventory_items ADD COLUMN skill_definition_id TEXT;

CREATE INDEX IF NOT EXISTS idx_inventory_skill_def
  ON inventory_items(skill_definition_id);
