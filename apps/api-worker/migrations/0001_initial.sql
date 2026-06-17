CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  language_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT,
  referrer_user_id TEXT,
  entry_source TEXT,
  risk_status TEXT NOT NULL DEFAULT 'normal',
  risk_score INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  energy INTEGER NOT NULL DEFAULT 100,
  max_energy INTEGER NOT NULL DEFAULT 150,
  auto_run_until TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS point_ledger_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT,
  event_type TEXT NOT NULL,
  point_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  project_id TEXT,
  source_id TEXT,
  quality_multiplier REAL,
  risk_status TEXT NOT NULL DEFAULT 'normal',
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_point_ledger_user_type ON point_ledger_events(user_id, point_type);

CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'common',
  status TEXT NOT NULL DEFAULT 'available',
  transferable INTEGER NOT NULL DEFAULT 0,
  soulbound INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_owner_status ON inventory_items(owner_user_id, status);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL,
  energy_cost INTEGER NOT NULL DEFAULT 0,
  base_pending_points INTEGER NOT NULL DEFAULT 0,
  requires_wallet INTEGER NOT NULL DEFAULT 0,
  auto_executable INTEGER NOT NULL DEFAULT 1,
  requires_user_confirmation INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  starts_at TEXT,
  ends_at TEXT,
  daily_limit INTEGER,
  total_limit INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS task_executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  energy_spent INTEGER NOT NULL DEFAULT 0,
  pending_points_earned INTEGER NOT NULL DEFAULT 0,
  applied_multiplier REAL NOT NULL DEFAULT 1,
  ability_ids_json TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id TEXT PRIMARY KEY,
  seller_user_id TEXT NOT NULL,
  inventory_item_id TEXT NOT NULL,
  price TEXT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TEXT,
  sold_at TEXT
);

CREATE TABLE IF NOT EXISTS marketplace_trades (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  seller_user_id TEXT NOT NULL,
  buyer_user_id TEXT NOT NULL,
  inventory_item_id TEXT NOT NULL,
  price TEXT NOT NULL,
  currency TEXT NOT NULL,
  fee_amount TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'settled',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_pools (
  id TEXT PRIMARY KEY,
  telegram_group_id TEXT NOT NULL UNIQUE,
  title TEXT,
  member_count INTEGER NOT NULL DEFAULT 0,
  daily_score INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL DEFAULT 999,
  boost_multiplier REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_pool_members (
  pool_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (pool_id, user_id),
  FOREIGN KEY (pool_id) REFERENCES group_pools(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_active ON marketplace_listings(status, created_at);
CREATE INDEX IF NOT EXISTS idx_task_executions_user ON task_executions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_group_pool_members_user ON group_pool_members(user_id);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  event_name TEXT NOT NULL,
  session_id TEXT,
  source TEXT,
  properties_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
