-- 0017_real_asset_agent_persistence_v1.sql
-- Local scaffold / planning only for Real Asset Agent persistence V1.
-- Not applied to production in this PR.
-- No signing credentials, recovery phrases, custody data, or user main-wallet credentials are stored.
-- Amounts are stored as TEXT / smallest-unit strings, not floating point.

CREATE TABLE IF NOT EXISTS agent_wallet_policies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  wallet_id TEXT,
  status TEXT NOT NULL,
  risk_mode TEXT NOT NULL,
  auto_purchase_enabled INTEGER NOT NULL DEFAULT 0,
  per_transaction_limit_amount TEXT NOT NULL,
  per_transaction_limit_asset TEXT NOT NULL,
  daily_limit_amount TEXT NOT NULL,
  daily_limit_asset TEXT NOT NULL,
  minimum_reserve_amount TEXT NOT NULL,
  minimum_reserve_asset TEXT NOT NULL,
  allowed_assets_json TEXT NOT NULL,
  allowed_contracts_json TEXT NOT NULL,
  allowed_providers_json TEXT NOT NULL,
  allowed_purchase_types_json TEXT NOT NULL,
  require_confirmation_above_amount TEXT,
  require_confirmation_above_asset TEXT,
  admin_global_pause INTEGER NOT NULL DEFAULT 0,
  user_paused INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_wallet_policies_user_id ON agent_wallet_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_wallet_policies_agent_id ON agent_wallet_policies(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_wallet_policies_wallet_id ON agent_wallet_policies(wallet_id);
CREATE INDEX IF NOT EXISTS idx_agent_wallet_policies_status ON agent_wallet_policies(status);
CREATE INDEX IF NOT EXISTS idx_agent_wallet_policies_updated_at ON agent_wallet_policies(updated_at);

CREATE TABLE IF NOT EXISTS wallet_asset_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  asset_symbol TEXT NOT NULL,
  amount TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  source TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wallet_asset_snapshots_user_id ON wallet_asset_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_asset_snapshots_agent_id ON wallet_asset_snapshots(agent_id);
CREATE INDEX IF NOT EXISTS idx_wallet_asset_snapshots_wallet_id ON wallet_asset_snapshots(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_asset_snapshots_asset_symbol ON wallet_asset_snapshots(asset_symbol);
CREATE INDEX IF NOT EXISTS idx_wallet_asset_snapshots_created_at ON wallet_asset_snapshots(created_at);

CREATE TABLE IF NOT EXISTS asset_ledger_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  wallet_id TEXT,
  event_type TEXT NOT NULL,
  asset_symbol TEXT NOT NULL,
  amount TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  direction TEXT NOT NULL,
  related_intent_id TEXT,
  related_transaction_id TEXT,
  related_purchase_intent_id TEXT,
  status TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_asset_ledger_events_user_id ON asset_ledger_events(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_ledger_events_agent_id ON asset_ledger_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_asset_ledger_events_wallet_id ON asset_ledger_events(wallet_id);
CREATE INDEX IF NOT EXISTS idx_asset_ledger_events_event_type ON asset_ledger_events(event_type);
CREATE INDEX IF NOT EXISTS idx_asset_ledger_events_status ON asset_ledger_events(status);
CREATE INDEX IF NOT EXISTS idx_asset_ledger_events_created_at ON asset_ledger_events(created_at);
CREATE INDEX IF NOT EXISTS idx_asset_ledger_events_related_intent_id ON asset_ledger_events(related_intent_id);
CREATE INDEX IF NOT EXISTS idx_asset_ledger_events_related_transaction_id ON asset_ledger_events(related_transaction_id);
CREATE INDEX IF NOT EXISTS idx_asset_ledger_events_related_purchase_intent_id ON asset_ledger_events(related_purchase_intent_id);

CREATE TABLE IF NOT EXISTS onchain_transaction_intents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  wallet_id TEXT,
  chain TEXT NOT NULL,
  network TEXT NOT NULL,
  asset_symbol TEXT NOT NULL,
  amount TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  to_address TEXT,
  contract_address TEXT,
  intent_type TEXT NOT NULL,
  status TEXT NOT NULL,
  policy_decision_json TEXT NOT NULL,
  requires_confirmation INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_onchain_transaction_intents_user_id ON onchain_transaction_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_onchain_transaction_intents_agent_id ON onchain_transaction_intents(agent_id);
CREATE INDEX IF NOT EXISTS idx_onchain_transaction_intents_wallet_id ON onchain_transaction_intents(wallet_id);
CREATE INDEX IF NOT EXISTS idx_onchain_transaction_intents_status ON onchain_transaction_intents(status);
CREATE INDEX IF NOT EXISTS idx_onchain_transaction_intents_intent_type ON onchain_transaction_intents(intent_type);
CREATE INDEX IF NOT EXISTS idx_onchain_transaction_intents_created_at ON onchain_transaction_intents(created_at);

CREATE TABLE IF NOT EXISTS onchain_transaction_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  wallet_id TEXT,
  intent_id TEXT NOT NULL,
  chain TEXT NOT NULL,
  network TEXT NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL,
  explorer_url TEXT,
  raw_event_json TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_onchain_transaction_events_user_id ON onchain_transaction_events(user_id);
CREATE INDEX IF NOT EXISTS idx_onchain_transaction_events_agent_id ON onchain_transaction_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_onchain_transaction_events_wallet_id ON onchain_transaction_events(wallet_id);
CREATE INDEX IF NOT EXISTS idx_onchain_transaction_events_intent_id ON onchain_transaction_events(intent_id);
CREATE INDEX IF NOT EXISTS idx_onchain_transaction_events_tx_hash ON onchain_transaction_events(tx_hash);
CREATE INDEX IF NOT EXISTS idx_onchain_transaction_events_status ON onchain_transaction_events(status);
CREATE INDEX IF NOT EXISTS idx_onchain_transaction_events_created_at ON onchain_transaction_events(created_at);

CREATE TABLE IF NOT EXISTS ai_model_token_products (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  purchase_type TEXT NOT NULL,
  asset_symbol TEXT NOT NULL,
  price_amount TEXT NOT NULL,
  price_decimals INTEGER NOT NULL,
  credit_amount TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_products_provider ON ai_model_token_products(provider);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_products_model_id ON ai_model_token_products(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_products_purchase_type ON ai_model_token_products(purchase_type);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_products_status ON ai_model_token_products(status);

CREATE TABLE IF NOT EXISTS ai_model_token_purchase_intents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  wallet_id TEXT,
  product_id TEXT,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  purchase_type TEXT NOT NULL,
  asset_symbol TEXT NOT NULL,
  amount TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  status TEXT NOT NULL,
  policy_decision_json TEXT NOT NULL,
  purpose TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_purchase_intents_user_id ON ai_model_token_purchase_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_purchase_intents_agent_id ON ai_model_token_purchase_intents(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_purchase_intents_wallet_id ON ai_model_token_purchase_intents(wallet_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_purchase_intents_product_id ON ai_model_token_purchase_intents(product_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_purchase_intents_provider ON ai_model_token_purchase_intents(provider);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_purchase_intents_model_id ON ai_model_token_purchase_intents(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_purchase_intents_status ON ai_model_token_purchase_intents(status);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_purchase_intents_created_at ON ai_model_token_purchase_intents(created_at);

CREATE TABLE IF NOT EXISTS ai_model_token_purchase_results (
  id TEXT PRIMARY KEY,
  purchase_intent_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  status TEXT NOT NULL,
  credit_asset_symbol TEXT NOT NULL,
  credit_amount TEXT NOT NULL,
  credit_decimals INTEGER NOT NULL,
  related_transaction_event_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_purchase_results_purchase_intent_id ON ai_model_token_purchase_results(purchase_intent_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_purchase_results_user_id ON ai_model_token_purchase_results(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_purchase_results_agent_id ON ai_model_token_purchase_results(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_purchase_results_provider ON ai_model_token_purchase_results(provider);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_purchase_results_model_id ON ai_model_token_purchase_results(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_purchase_results_status ON ai_model_token_purchase_results(status);
CREATE INDEX IF NOT EXISTS idx_ai_model_token_purchase_results_created_at ON ai_model_token_purchase_results(created_at);

CREATE TABLE IF NOT EXISTS ai_credit_balances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_id TEXT,
  asset_symbol TEXT NOT NULL DEFAULT 'AI_CREDIT',
  amount TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  metadata_json TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_credit_balances_user_id ON ai_credit_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_balances_agent_id ON ai_credit_balances(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_balances_provider ON ai_credit_balances(provider);
CREATE INDEX IF NOT EXISTS idx_ai_credit_balances_model_id ON ai_credit_balances(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_balances_asset_symbol ON ai_credit_balances(asset_symbol);
CREATE INDEX IF NOT EXISTS idx_ai_credit_balances_updated_at ON ai_credit_balances(updated_at);

CREATE TABLE IF NOT EXISTS ai_credit_usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  work_run_id TEXT,
  work_report_id TEXT,
  provider TEXT NOT NULL,
  model_id TEXT,
  asset_symbol TEXT NOT NULL DEFAULT 'AI_CREDIT',
  amount TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  purpose TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_credit_usage_events_user_id ON ai_credit_usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_usage_events_agent_id ON ai_credit_usage_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_usage_events_work_run_id ON ai_credit_usage_events(work_run_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_usage_events_work_report_id ON ai_credit_usage_events(work_report_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_usage_events_provider ON ai_credit_usage_events(provider);
CREATE INDEX IF NOT EXISTS idx_ai_credit_usage_events_model_id ON ai_credit_usage_events(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_usage_events_created_at ON ai_credit_usage_events(created_at);

CREATE TABLE IF NOT EXISTS work_report_evidence_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  work_run_id TEXT,
  work_report_id TEXT,
  evidence_type TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  related_intent_id TEXT,
  related_transaction_id TEXT,
  related_purchase_intent_id TEXT,
  asset_symbol TEXT,
  amount TEXT,
  decimals INTEGER,
  provider TEXT,
  model_id TEXT,
  skill_card_codes_json TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_work_report_evidence_events_user_id ON work_report_evidence_events(user_id);
CREATE INDEX IF NOT EXISTS idx_work_report_evidence_events_agent_id ON work_report_evidence_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_work_report_evidence_events_work_run_id ON work_report_evidence_events(work_run_id);
CREATE INDEX IF NOT EXISTS idx_work_report_evidence_events_work_report_id ON work_report_evidence_events(work_report_id);
CREATE INDEX IF NOT EXISTS idx_work_report_evidence_events_evidence_type ON work_report_evidence_events(evidence_type);
CREATE INDEX IF NOT EXISTS idx_work_report_evidence_events_status ON work_report_evidence_events(status);
CREATE INDEX IF NOT EXISTS idx_work_report_evidence_events_related_intent_id ON work_report_evidence_events(related_intent_id);
CREATE INDEX IF NOT EXISTS idx_work_report_evidence_events_related_transaction_id ON work_report_evidence_events(related_transaction_id);
CREATE INDEX IF NOT EXISTS idx_work_report_evidence_events_related_purchase_intent_id ON work_report_evidence_events(related_purchase_intent_id);
CREATE INDEX IF NOT EXISTS idx_work_report_evidence_events_created_at ON work_report_evidence_events(created_at);

CREATE TABLE IF NOT EXISTS admin_risk_audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_risk_audit_events_event_type ON admin_risk_audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_risk_audit_events_actor ON admin_risk_audit_events(actor);
CREATE INDEX IF NOT EXISTS idx_admin_risk_audit_events_target_type ON admin_risk_audit_events(target_type);
CREATE INDEX IF NOT EXISTS idx_admin_risk_audit_events_target_id ON admin_risk_audit_events(target_id);
CREATE INDEX IF NOT EXISTS idx_admin_risk_audit_events_status ON admin_risk_audit_events(status);
CREATE INDEX IF NOT EXISTS idx_admin_risk_audit_events_created_at ON admin_risk_audit_events(created_at);
