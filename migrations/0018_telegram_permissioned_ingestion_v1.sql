-- Migration: 0018_telegram_permissioned_ingestion_v1.sql
-- Description: Schema migrations for Telegram authorized sources, ingestion events, opportunity signals, and Policy Guard audit records.

-- 1. Telegram Authorized Sources
CREATE TABLE telegram_authorized_sources (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('group', 'channel', 'user_submission', 'bot_mention', 'public_link')),
  telegram_chat_id_hash TEXT,
  telegram_chat_title_preview TEXT,
  permission_scope TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('pending', 'authorized', 'revoked', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX idx_telegram_sources_owner ON telegram_authorized_sources(owner_user_id);
CREATE INDEX idx_telegram_sources_agent ON telegram_authorized_sources(agent_id);
CREATE INDEX idx_telegram_sources_status ON telegram_authorized_sources(status);
CREATE INDEX idx_telegram_sources_chat_hash ON telegram_authorized_sources(telegram_chat_id_hash);

-- 2. Telegram Ingestion Events
CREATE TABLE telegram_ingestion_events (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('mention', 'command', 'submission', 'public_signal')),
  telegram_update_id_hash TEXT,
  message_ref_hash TEXT,
  content_preview TEXT,
  content_hash TEXT,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  status TEXT NOT NULL CHECK (status IN ('received', 'filtered', 'converted_to_signal', 'rejected')),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_telegram_events_source ON telegram_ingestion_events(source_id);
CREATE INDEX idx_telegram_events_agent ON telegram_ingestion_events(agent_id);
CREATE INDEX idx_telegram_events_status ON telegram_ingestion_events(status);
CREATE INDEX idx_telegram_events_created ON telegram_ingestion_events(created_at);
CREATE INDEX idx_telegram_events_update_hash ON telegram_ingestion_events(telegram_update_id_hash);

-- 3. Telegram Opportunity Signals
CREATE TABLE telegram_opportunity_signals (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  source_event_id TEXT,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('bounty', 'announcement', 'risk_link', 'project_update', 'guild_task')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_url TEXT,
  confidence_level TEXT NOT NULL CHECK (confidence_level IN ('low', 'medium', 'high')),
  estimated_ai_credit_cost INTEGER NOT NULL DEFAULT 0,
  required_skills TEXT NOT NULL DEFAULT '[]',
  risk_flags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('candidate', 'ignored', 'pending_user', 'converted_to_work_run')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_telegram_signals_agent ON telegram_opportunity_signals(agent_id);
CREATE INDEX idx_telegram_signals_event ON telegram_opportunity_signals(source_event_id);
CREATE INDEX idx_telegram_signals_status ON telegram_opportunity_signals(status);
CREATE INDEX idx_telegram_signals_created ON telegram_opportunity_signals(created_at);

-- 4. Policy Guard External Action Events
CREATE TABLE policy_guard_external_action_events (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  action_type TEXT NOT NULL,
  intent_id TEXT,
  policy_decision TEXT NOT NULL CHECK (policy_decision IN ('allow', 'deny', 'require_user', 'admin_pause')),
  reason TEXT NOT NULL,
  budget_snapshot TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_policy_external_agent ON policy_guard_external_action_events(agent_id);
CREATE INDEX idx_policy_external_decision ON policy_guard_external_action_events(policy_decision);
CREATE INDEX idx_policy_external_created ON policy_guard_external_action_events(created_at);
CREATE INDEX idx_policy_external_intent ON policy_guard_external_action_events(intent_id);
