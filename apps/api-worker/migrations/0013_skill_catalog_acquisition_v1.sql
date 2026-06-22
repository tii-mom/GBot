-- migrations/0013_skill_catalog_acquisition_v1.sql
-- PR #7: Skill Catalog & Acquisition Rules V1
-- Establishes canonical 31-skill catalog, skill_acquisition_rules table,
-- pool audit columns on skill_economy_events, and seeds all acquisition rules.
--
-- Pool Config Version : 1
-- Canonical skills    : 31  (24 released + 7 advanced_unlock)
-- Released normal     : 12
-- Released advanced   : 12
-- Expert adv_unlock   : 7
-- Core (internal)     : 4
-- Legacy internal     : 21  (existing defs not in formal catalog)
-- New defs created    : 12  (automation + business + gaps)
-- Total rules seeded  : 56
--
-- This file MUST be byte-identical to:
--   apps/api-worker/migrations/0013_skill_catalog_acquisition_v1.sql

-- ================================================================
-- PART 1: New skill definitions
-- 12 new canonical skills for Automation & Business categories,
-- plus Research/Content gaps not covered by existing 40 defs.
-- category uses existing CHECK values (research/content/…);
-- catalog_category is stored in skill_acquisition_rules.
-- ================================================================

INSERT OR IGNORE INTO agent_skill_definitions
  (id, code, name, description, tier, category, is_core,
   max_level, required_agent_level, effect_type, effect_config_json, status)
VALUES
  -- ── Research ───────────────────────────────────────────────
  ('sd_res_user_market_research',
   'skill_res_user_market_research',
   'User & Market Research',
   'Deep user behaviour analysis and market-segment research for product decisions.',
   'advanced', 'research', 0, 5, 5,
   'research', '{"depthBonus":2,"sourceBonus":2,"summaryBonus":1}', 'enabled'),

  ('sd_exp_deep_research',
   'skill_exp_deep_research',
   'Deep Research',
   'Expert-level autonomous multi-source deep research with full synthesis and validation.',
   'expert', 'research', 0, 5, 10,
   'research', '{"depthBonus":3,"sourceBonus":3,"summaryBonus":3}', 'enabled'),

  -- ── Content ────────────────────────────────────────────────
  ('sd_con_structured_writing',
   'skill_con_structured_writing',
   'Structured Writing',
   'Produces structured reports, briefs, and formatted written deliverables.',
   'normal', 'content', 0, 5, 1,
   'content', '{"modes":["structured","report","brief"],"summaryBonus":1}', 'enabled'),

  ('sd_con_technical_documentation',
   'skill_con_technical_documentation',
   'Technical Documentation',
   'Writes technical documentation, API references, integration guides, and specifications.',
   'advanced', 'content', 0, 5, 5,
   'content', '{"modes":["technical","spec","api","guide"],"summaryBonus":2}', 'enabled'),

  -- ── Automation ─────────────────────────────────────────────
  ('sd_aut_task_decomposition',
   'skill_aut_task_decomposition',
   'Task Decomposition',
   'Breaks complex objectives into ordered, executable sub-tasks with dependency mapping.',
   'normal', 'research', 0, 5, 1,
   'task_sorting', '{"depthBonus":1,"summaryBonus":1}', 'enabled'),

  ('sd_aut_tool_selection',
   'skill_aut_tool_selection',
   'Tool Selection',
   'Evaluates and selects optimal tools, APIs, and resources for a given task.',
   'normal', 'research', 0, 5, 1,
   'task_discovery', '{"depthBonus":1,"sourceBonus":1}', 'enabled'),

  ('sd_aut_progress_tracking',
   'skill_aut_progress_tracking',
   'Progress Tracking',
   'Monitors task execution state and reports progress milestones in real time.',
   'normal', 'research', 0, 5, 1,
   'task_sorting', '{"depthBonus":1,"summaryBonus":1}', 'enabled'),

  ('sd_aut_workflow_planning',
   'skill_aut_workflow_planning',
   'Workflow Planning',
   'Designs and coordinates multi-step automation workflows with branching logic.',
   'advanced', 'research', 0, 5, 5,
   'task_sorting', '{"depthBonus":2,"summaryBonus":2}', 'enabled'),

  -- ── Business & Collaboration ────────────────────────────────
  ('sd_biz_budget_management',
   'skill_biz_budget_management',
   'Budget Management',
   'Tracks, plans, and optimises task and project budgets across GP and time.',
   'normal', 'research', 0, 5, 1,
   'research', '{"depthBonus":1,"summaryBonus":1}', 'enabled'),

  ('sd_biz_task_profit_analysis',
   'skill_biz_task_profit_analysis',
   'Task Profit Analysis',
   'Analyses task profitability, cost structure, and return on effort.',
   'advanced', 'research', 0, 5, 5,
   'research', '{"depthBonus":2,"summaryBonus":2}', 'enabled'),

  ('sd_biz_client_delivery_management',
   'skill_biz_client_delivery_management',
   'Client Delivery Management',
   'Manages client deliverables, timelines, quality checks, and handoffs.',
   'advanced', 'research', 0, 5, 5,
   'research', '{"depthBonus":2,"summaryBonus":2}', 'enabled'),

  ('sd_biz_agent_service_procurement',
   'skill_biz_agent_service_procurement',
   'Agent Service Procurement',
   'Procures, coordinates, and evaluates agent-to-agent service contracts.',
   'expert', 'research', 0, 5, 10,
   'research', '{"depthBonus":3,"summaryBonus":3}', 'enabled');

-- ================================================================
-- PART 2: skill_acquisition_rules table
-- Single authoritative source for pool membership and release control.
-- catalog_category exposes the 7 product categories via API without
-- altering the existing category CHECK on agent_skill_definitions.
-- ================================================================

CREATE TABLE IF NOT EXISTS skill_acquisition_rules (
  skill_definition_id           TEXT    PRIMARY KEY,
  catalog_category              TEXT    NOT NULL DEFAULT 'other',
  release_status                TEXT    NOT NULL DEFAULT 'internal'
    CHECK (release_status IN (
      'draft', 'internal', 'released', 'advanced_unlock',
      'limited', 'deprecated', 'disabled'
    )),
  release_batch                 INTEGER NOT NULL DEFAULT 1,
  available_in_skill_box        INTEGER NOT NULL DEFAULT 0
    CHECK (available_in_skill_box IN (0, 1)),
  available_in_normal_synthesis INTEGER NOT NULL DEFAULT 0
    CHECK (available_in_normal_synthesis IN (0, 1)),
  available_in_expert_synthesis INTEGER NOT NULL DEFAULT 0
    CHECK (available_in_expert_synthesis IN (0, 1)),
  available_in_reset_pool       INTEGER NOT NULL DEFAULT 0
    CHECK (available_in_reset_pool IN (0, 1)),
  available_as_task_reward      INTEGER NOT NULL DEFAULT 0
    CHECK (available_as_task_reward IN (0, 1)),
  available_in_market           INTEGER NOT NULL DEFAULT 0
    CHECK (available_in_market IN (0, 1)),
  available_for_direct_grant    INTEGER NOT NULL DEFAULT 0
    CHECK (available_for_direct_grant IN (0, 1)),
  drop_weight                   INTEGER NOT NULL DEFAULT 1
    CHECK (drop_weight >= 0),
  synthesis_weight              INTEGER NOT NULL DEFAULT 1
    CHECK (synthesis_weight >= 0),
  required_achievement_code     TEXT,
  available_from                TEXT,
  available_until               TEXT,
  config_version                INTEGER NOT NULL DEFAULT 1,
  created_at                    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (skill_definition_id)
    REFERENCES agent_skill_definitions(id)
);

-- Query indexes for pool selection
CREATE INDEX IF NOT EXISTS idx_skill_acquisition_box_pool
  ON skill_acquisition_rules(available_in_skill_box, release_status);

CREATE INDEX IF NOT EXISTS idx_skill_acquisition_normal_synth
  ON skill_acquisition_rules(available_in_normal_synthesis, release_status);

CREATE INDEX IF NOT EXISTS idx_skill_acquisition_expert_synth
  ON skill_acquisition_rules(available_in_expert_synthesis, release_status);

CREATE INDEX IF NOT EXISTS idx_skill_acquisition_reset_pool
  ON skill_acquisition_rules(available_in_reset_pool, release_status);

CREATE INDEX IF NOT EXISTS idx_skill_acquisition_release_status
  ON skill_acquisition_rules(release_status);

-- ================================================================
-- PART 3: Pool audit columns on skill_economy_events
-- Tracks which pool code and version was used for every random draw.
-- ================================================================

ALTER TABLE skill_economy_events ADD COLUMN pool_code    TEXT;
ALTER TABLE skill_economy_events ADD COLUMN pool_version INTEGER;

-- ================================================================
-- PART 4: Seed all 56 acquisition rules
-- ================================================================

-- ── 4-A: 4 Core Modules — permanently locked out of ALL pools ──

INSERT OR IGNORE INTO skill_acquisition_rules
  (skill_definition_id, catalog_category, release_status, release_batch,
   available_in_skill_box, available_in_normal_synthesis, available_in_expert_synthesis,
   available_in_reset_pool, available_as_task_reward, available_in_market,
   available_for_direct_grant, drop_weight, synthesis_weight, config_version)
VALUES
  ('sd_core_task_scanner',        'core','internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_core_task_planner',        'core','internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_core_basic_writer',        'core','internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_core_submission_assistant','core','internal',1, 0,0,0,0,0,0,0, 0,0,1);

-- ── 4-B: 12 Released Normal canonical skills ────────────────────
-- box=1 | reset=1 | task_reward=1 | direct_grant=1 | market=0
-- normal_synthesis=0 | expert_synthesis=0

INSERT OR IGNORE INTO skill_acquisition_rules
  (skill_definition_id, catalog_category, release_status, release_batch,
   available_in_skill_box, available_in_normal_synthesis, available_in_expert_synthesis,
   available_in_reset_pool, available_as_task_reward, available_in_market,
   available_for_direct_grant, drop_weight, synthesis_weight, config_version)
VALUES
  -- Research (2)
  ('sd_res_project_research',    'research',    'released',1, 1,0,0,1,1,0,1, 1,0,1),
  ('sd_res_information_summary', 'research',    'released',1, 1,0,0,1,1,0,1, 1,0,1),
  -- Content (2)
  ('sd_con_social_copywriter',   'content',     'released',1, 1,0,0,1,1,0,1, 1,0,1),
  ('sd_con_structured_writing',  'content',     'released',1, 1,0,0,1,1,0,1, 1,0,1),
  -- Verification (2)
  ('sd_ver_submission_checker',  'verification','released',1, 1,0,0,1,1,0,1, 1,0,1),
  ('sd_ver_evidence_organizer',  'verification','released',1, 1,0,0,1,1,0,1, 1,0,1),
  -- Onchain (1)
  ('sd_onc_transaction_reader',  'onchain',     'released',1, 1,0,0,1,1,0,1, 1,0,1),
  -- Social (1)
  ('sd_soc_telegram_promoter',   'social',      'released',1, 1,0,0,1,1,0,1, 1,0,1),
  -- Automation (3)
  ('sd_aut_task_decomposition',  'automation',  'released',1, 1,0,0,1,1,0,1, 1,0,1),
  ('sd_aut_tool_selection',      'automation',  'released',1, 1,0,0,1,1,0,1, 1,0,1),
  ('sd_aut_progress_tracking',   'automation',  'released',1, 1,0,0,1,1,0,1, 1,0,1),
  -- Business (1)
  ('sd_biz_budget_management',   'business',    'released',1, 1,0,0,1,1,0,1, 1,0,1);

-- ── 4-C: 12 Released Advanced canonical skills ──────────────────
-- box=1 | reset=1 | task_reward=1 | direct_grant=1 | market=0
-- normal_synthesis=1 (output target) | expert_synthesis=0

INSERT OR IGNORE INTO skill_acquisition_rules
  (skill_definition_id, catalog_category, release_status, release_batch,
   available_in_skill_box, available_in_normal_synthesis, available_in_expert_synthesis,
   available_in_reset_pool, available_as_task_reward, available_in_market,
   available_for_direct_grant, drop_weight, synthesis_weight, config_version)
VALUES
  -- Research (2)
  ('sd_res_competitive_intelligence',   'research',    'released',1, 1,1,0,1,1,0,1, 1,1,1),
  ('sd_res_user_market_research',       'research',    'released',1, 1,1,0,1,1,0,1, 1,1,1),
  -- Content (2)
  ('sd_con_technical_documentation',    'content',     'released',1, 1,1,0,1,1,0,1, 1,1,1),
  ('sd_con_content_strategist',         'content',     'released',1, 1,1,0,1,1,0,1, 1,1,1),
  -- Verification (1)
  ('sd_ver_advanced_verification',      'verification','released',1, 1,1,0,1,1,0,1, 1,1,1),
  -- Onchain (2)
  ('sd_onc_ton_chain_analyst',          'onchain',     'released',1, 1,1,0,1,1,0,1, 1,1,1),
  ('sd_onc_smart_contract_reader',      'onchain',     'released',1, 1,1,0,1,1,0,1, 1,1,1),
  -- Social (2)
  ('sd_soc_viral_pattern_analysis',     'social',      'released',1, 1,1,0,1,1,0,1, 1,1,1),
  ('sd_soc_audience_targeting',         'social',      'released',1, 1,1,0,1,1,0,1, 1,1,1),
  -- Automation (1)
  ('sd_aut_workflow_planning',          'automation',  'released',1, 1,1,0,1,1,0,1, 1,1,1),
  -- Business (2)
  ('sd_biz_task_profit_analysis',       'business',    'released',1, 1,1,0,1,1,0,1, 1,1,1),
  ('sd_biz_client_delivery_management', 'business',    'released',1, 1,1,0,1,1,0,1, 1,1,1);

-- ── 4-D: 7 Expert advanced_unlock ───────────────────────────────
-- box=0 | normal_synthesis=0 | expert_synthesis=1
-- reset=1 | task_reward=1 | market=0 | direct_grant=1

INSERT OR IGNORE INTO skill_acquisition_rules
  (skill_definition_id, catalog_category, release_status, release_batch,
   available_in_skill_box, available_in_normal_synthesis, available_in_expert_synthesis,
   available_in_reset_pool, available_as_task_reward, available_in_market,
   available_for_direct_grant, drop_weight, synthesis_weight, config_version)
VALUES
  ('sd_exp_deep_research',              'research',    'advanced_unlock',2, 0,0,1,1,1,0,1, 0,1,1),
  ('sd_exp_multilingual_director',      'content',     'advanced_unlock',2, 0,0,1,1,1,0,1, 0,1,1),
  ('sd_exp_chief_verification_officer', 'verification','advanced_unlock',2, 0,0,1,1,1,0,1, 0,1,1),
  ('sd_exp_onchain_intelligence',       'onchain',     'advanced_unlock',2, 0,0,1,1,1,0,1, 0,1,1),
  ('sd_exp_master_growth_strategist',   'social',      'advanced_unlock',2, 0,0,1,1,1,0,1, 0,1,1),
  ('sd_exp_task_orchestration',         'automation',  'advanced_unlock',2, 0,0,1,1,1,0,1, 0,1,1),
  ('sd_biz_agent_service_procurement',  'business',    'advanced_unlock',2, 0,0,1,1,1,0,1, 0,1,1);

-- ── 4-E: 21 Internal existing skills ────────────────────────────
-- All pools disabled. Existing user assets (cards / learned skills)
-- are NOT deleted and remain fully usable. Acquisition rules only
-- control NEW asset generation.

INSERT OR IGNORE INTO skill_acquisition_rules
  (skill_definition_id, catalog_category, release_status, release_batch,
   available_in_skill_box, available_in_normal_synthesis, available_in_expert_synthesis,
   available_in_reset_pool, available_as_task_reward, available_in_market,
   available_for_direct_grant, drop_weight, synthesis_weight, config_version)
VALUES
  -- Research internal (3)
  ('sd_res_opportunity_scanner',       'research',    'internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_res_deep_research',             'research',    'internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_res_high_yield_scanner',        'research',    'internal',1, 0,0,0,0,0,0,0, 0,0,1),
  -- Content internal (4)
  ('sd_con_translation',               'content',     'internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_con_short_form_writer',         'content',     'internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_con_growth_copywriter',         'content',     'internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_con_multilingual_campaign',     'content',     'internal',1, 0,0,0,0,0,0,0, 0,0,1),
  -- Social internal (3)
  ('sd_soc_x_engagement',              'social',      'internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_soc_community_observer',        'social',      'internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_soc_community_growth',          'social',      'internal',1, 0,0,0,0,0,0,0, 0,0,1),
  -- Verification internal (3)
  ('sd_ver_risk_analyzer',             'verification','internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_ver_fraud_signal_detection',    'verification','internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_ver_basic_risk_check',          'verification','internal',1, 0,0,0,0,0,0,0, 0,0,1),
  -- Onchain internal (3)
  ('sd_onc_wallet_observer',           'onchain',     'internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_onc_token_research',            'onchain',     'internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_onc_onchain_risk_review',       'onchain',     'internal',1, 0,0,0,0,0,0,0, 0,0,1),
  -- Expert internal (5)
  ('sd_exp_research_director',         'research',    'internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_exp_alpha_opportunity_hunter',  'research',    'internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_exp_contract_risk_expert',      'verification','internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_exp_adaptive_learning',         'research',    'internal',1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_exp_perfect_memory',            'research',    'internal',1, 0,0,0,0,0,0,0, 0,0,1);
