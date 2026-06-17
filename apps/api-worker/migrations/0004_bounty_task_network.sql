CREATE TABLE IF NOT EXISTS bounty_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  platform TEXT NOT NULL,
  target_url TEXT NOT NULL,
  budget_total INTEGER NOT NULL DEFAULT 0,
  budget_remaining INTEGER NOT NULL DEFAULT 0,
  reward_points INTEGER NOT NULL DEFAULT 0,
  reward_asset_name TEXT,
  reward_access_pass TEXT,
  deadline TEXT,
  verification_rule TEXT,
  submission_type TEXT NOT NULL DEFAULT 'link',
  risk_level TEXT NOT NULL DEFAULT 'low',
  owner_type TEXT NOT NULL,
  owner_name TEXT,
  completed_count INTEGER NOT NULL DEFAULT 0,
  max_completions INTEGER NOT NULL DEFAULT 0,
  paused_reason TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by_admin INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  settlement_mode TEXT NOT NULL DEFAULT 'offchain',
  chain_id INTEGER,
  escrow_contract TEXT,
  escrow_tx_hash TEXT,
  reward_token TEXT,
  reward_token_address TEXT,
  reward_decimals INTEGER,
  oracle_mode TEXT NOT NULL DEFAULT 'format_check',
  dispute_status TEXT NOT NULL DEFAULT 'none'
);

CREATE TABLE IF NOT EXISTS bounty_task_verifications (
  id TEXT PRIMARY KEY,
  bounty_task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  link TEXT NOT NULL,
  submission_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'submitted',
  risk_flagged INTEGER NOT NULL DEFAULT 0,
  feedback TEXT,
  reviewed_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TEXT,
  reward_granted_at TEXT,
  FOREIGN KEY (bounty_task_id) REFERENCES bounty_tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_bounty_task_status ON bounty_tasks(status);
CREATE INDEX IF NOT EXISTS idx_bounty_verif_user ON bounty_task_verifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bounty_verif_task ON bounty_task_verifications(bounty_task_id);
