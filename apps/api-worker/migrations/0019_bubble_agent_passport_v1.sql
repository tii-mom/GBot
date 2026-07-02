CREATE TABLE IF NOT EXISTS bubble_agent_passports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  inventory_item_id TEXT,
  display_no TEXT NOT NULL,
  series TEXT,
  rarity TEXT,
  status TEXT NOT NULL DEFAULT 'unminted',
  owner_state TEXT NOT NULL DEFAULT 'app_asset',
  chain TEXT NOT NULL DEFAULT 'TON',
  token_id TEXT,
  wallet_address TEXT,
  request_count INTEGER NOT NULL DEFAULT 0,
  last_requested_at TEXT,
  minted_at TEXT,
  last_indexed_at TEXT,
  failure_reason TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bubble_passports_user_display ON bubble_agent_passports(user_id, display_no);
CREATE INDEX IF NOT EXISTS idx_bubble_passports_status ON bubble_agent_passports(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_bubble_passports_agent ON bubble_agent_passports(agent_id);

CREATE TABLE IF NOT EXISTS bubble_agent_passport_events (
  id TEXT PRIMARY KEY,
  passport_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  display_no TEXT NOT NULL,
  event_type TEXT NOT NULL,
  before_status TEXT,
  after_status TEXT NOT NULL,
  owner_state TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'TON',
  token_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (passport_id) REFERENCES bubble_agent_passports(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_bubble_passport_events_passport ON bubble_agent_passport_events(passport_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bubble_passport_events_display ON bubble_agent_passport_events(display_no, created_at);
