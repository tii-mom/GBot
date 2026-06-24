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
-- Legacy internal     : 27  (existing defs not in formal catalog)
-- New defs created    : 18  (automation + business + gaps)
-- Total rules seeded  : 62
--
-- This file MUST be byte-identical to:
--   apps/api-worker/migrations/0013_skill_catalog_acquisition_v1.sql

-- ================================================================
-- PART 0: Original 44 skill definitions seed (for fresh migrations)
-- ================================================================

-- INSERT OR IGNORE is safe only when an existing canonical row is semantically
-- identical. These temporary guards turn silent ID/code conflicts into an
-- explicit migration failure before any canonical manifest is accepted.
CREATE TRIGGER migration_0013_definition_conflict
BEFORE INSERT ON agent_skill_definitions
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM agent_skill_definitions d
    WHERE d.id = NEW.id AND NOT (
      d.code IS NEW.code AND d.tier IS NEW.tier AND d.category IS NEW.category
      AND d.is_core IS NEW.is_core AND d.max_level IS NEW.max_level
      AND d.required_agent_level IS NEW.required_agent_level
      AND d.effect_type IS NEW.effect_type
      AND d.effect_config_json IS NEW.effect_config_json
      AND d.status IS NEW.status
    )
  ) THEN RAISE(ROLLBACK, '0013 blocked: canonical definition ID has different semantics') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM agent_skill_definitions d WHERE d.code = NEW.code AND d.id <> NEW.id
  ) THEN RAISE(ROLLBACK, '0013 blocked: canonical definition key belongs to another ID') END;
END;

INSERT INTO agent_skill_definitions
  (id, code, name, description, tier, category, is_core,
   max_level, required_agent_level, effect_type, effect_config_json, status)
VALUES
  -- --- 4 CORE MODULES ---
  ('sd_core_task_scanner', 'core_task_scanner', 'Task Scanner', 'Scans executable tasks and judges risk.', 'normal', 'research', 1, 1, 1, 'task_discovery', '{"depthBonus":1,"sourceBonus":1}', 'enabled'),
  ('sd_core_task_planner', 'core_task_planner', 'Task Planner', 'Splits tasks into ordered steps.', 'normal', 'research', 1, 1, 1, 'task_sorting', '{"depthBonus":1,"summaryBonus":1}', 'enabled'),
  ('sd_core_basic_writer', 'core_basic_writer', 'Basic Writer', 'Drafts simple copy, summaries, translations.', 'normal', 'content', 1, 1, 1, 'content', '{"modes":["basic"],"languages":["en"]}', 'enabled'),
  ('sd_core_submission_assistant', 'core_submission_assistant', 'Submission Assistant', 'Builds submission summaries and organises proof.', 'normal', 'verification', 1, 1, 1, 'verification_reputation', '{"verificationBonus":1}', 'enabled'),

  -- --- NORMAL TIER ---
  ('sd_res_project_research', 'skill_res_project_research', 'Project Research', 'Improves project context gathering.', 'normal', 'research', 0, 5, 1, 'growth_propagation', '{"depthBonus":1,"sourceBonus":1}', 'enabled'),
  ('sd_res_opportunity_scanner', 'skill_res_opportunity_scanner', 'Opportunity Scanner', 'Scans for high-value bounty opportunities.', 'normal', 'research', 0, 5, 1, 'task_discovery', '{"depthBonus":1,"sourceBonus":1}', 'enabled'),
  ('sd_res_information_summary', 'skill_res_information_summary', 'Information Summary', 'Concise summaries of research findings.', 'normal', 'research', 0, 5, 1, 'research', '{"summaryBonus":1}', 'enabled'),
  ('sd_con_social_copywriter', 'skill_con_social_copywriter', 'Social Copywriter', 'Generates social copy for promotions.', 'normal', 'content', 0, 5, 1, 'content', '{"modes":["social_post"],"languages":["en"]}', 'enabled'),
  ('sd_con_translation', 'skill_con_translation', 'Translation', 'Multilingual translation for campaign tasks.', 'normal', 'content', 0, 5, 1, 'content', '{"modes":["translation"],"languages":["en","zh","ja","ko"]}', 'enabled'),
  ('sd_con_short_form_writer', 'skill_con_short_form_writer', 'Short-form Writer', 'Short-form content for social platforms.', 'normal', 'content', 0, 5, 1, 'content', '{"modes":["short_form"],"summaryBonus":1}', 'enabled'),
  ('sd_soc_telegram_promoter', 'skill_soc_telegram_promoter', 'Telegram Promoter', 'Telegram community growth content.', 'normal', 'social', 0, 5, 1, 'content', '{"channels":["telegram"],"targetingBonus":1}', 'enabled'),
  ('sd_soc_x_engagement', 'skill_soc_x_engagement', 'X Engagement', 'Drafts X/Twitter replies and threads.', 'normal', 'social', 0, 5, 1, 'content', '{"channels":["twitter"],"targetingBonus":1}', 'enabled'),
  ('sd_soc_community_observer', 'skill_soc_community_observer', 'Community Observer', 'Monitors community health signals.', 'normal', 'social', 0, 5, 1, 'growth_propagation', '{"channels":["telegram","discord"],"targetingBonus":1}', 'enabled'),
  ('sd_ver_submission_checker', 'skill_ver_submission_checker', 'Submission Checker', 'Verifies submission format compliance.', 'normal', 'verification', 0, 5, 1, 'verification_reputation', '{"verificationBonus":1,"riskChecks":["format"]}', 'enabled'),
  ('sd_ver_evidence_organizer', 'skill_ver_evidence_organizer', 'Evidence Organizer', 'Organises proof and links for submissions.', 'normal', 'verification', 0, 5, 1, 'verification_reputation', '{"verificationBonus":1,"riskChecks":["evidence"]}', 'enabled'),
  ('sd_ver_basic_risk_check', 'skill_ver_basic_risk_check', 'Basic Risk Check', 'Basic risk assessment for tasks.', 'normal', 'verification', 0, 5, 1, 'risk', '{"riskChecks":["basic_risk"]}', 'enabled'),
  ('sd_onc_wallet_observer', 'skill_onc_wallet_observer', 'Wallet Observer', 'Read-only wallet info observation.', 'normal', 'onchain', 0, 5, 1, 'trading_prep', '{"readBonus":1}', 'enabled'),
  ('sd_onc_transaction_reader', 'skill_onc_transaction_reader', 'Transaction Reader', 'Reads public transaction data.', 'normal', 'onchain', 0, 5, 1, 'trading_prep', '{"readBonus":1}', 'enabled'),
  ('sd_onc_token_research', 'skill_onc_token_research', 'Token Research', 'Research token metadata and holders.', 'normal', 'onchain', 0, 5, 1, 'trading_prep', '{"readBonus":1,"contractBonus":1}', 'enabled'),

  -- --- ADVANCED TIER ---
  ('sd_res_deep_research', 'skill_res_deep_research', 'Deep Research', 'Deep multi-source research capability.', 'advanced', 'research', 0, 5, 5, 'research', '{"depthBonus":2,"sourceBonus":2,"summaryBonus":1}', 'enabled'),
  ('sd_res_high_yield_scanner', 'skill_res_high_yield_scanner', 'High-Yield Scanner', 'Surfaces higher-value tasks.', 'advanced', 'research', 0, 5, 5, 'task_discovery', '{"depthBonus":2,"sourceBonus":2}', 'enabled'),
  ('sd_res_competitive_intelligence', 'skill_res_competitive_intelligence', 'Competitive Intelligence', 'Competitor activity analysis.', 'advanced', 'research', 0, 5, 5, 'research', '{"depthBonus":2,"sourceBonus":2,"summaryBonus":1}', 'enabled'),
  ('sd_con_growth_copywriter', 'skill_con_growth_copywriter', 'Growth Copywriter', 'High-conversion growth copy.', 'advanced', 'content', 0, 5, 5, 'content', '{"modes":["growth","social_post"],"languages":["en","zh"]}', 'enabled'),
  ('sd_con_multilingual_campaign', 'skill_con_multilingual_campaign', 'Multilingual Campaign', 'Multi-language campaign content.', 'advanced', 'content', 0, 5, 5, 'content', '{"modes":["campaign","translation"],"languages":["en","zh","ja","ko","ru","es"]}', 'enabled'),
  ('sd_con_content_strategist', 'skill_con_content_strategist', 'Content Strategist', 'Strategic content planning.', 'advanced', 'content', 0, 5, 5, 'content', '{"modes":["strategy","long_form","short_form"],"summaryBonus":2}', 'enabled'),
  ('sd_soc_community_growth', 'skill_soc_community_growth', 'Community Growth', 'Accelerates community growth campaigns.', 'advanced', 'social', 0, 5, 5, 'growth_propagation', '{"channels":["telegram","discord"],"targetingBonus":2}', 'enabled'),
  ('sd_soc_viral_pattern_analysis', 'skill_soc_viral_pattern_analysis', 'Viral Pattern Analysis', 'Identifies viral content patterns.', 'advanced', 'social', 0, 5, 5, 'research', '{"channels":["twitter","telegram"],"targetingBonus":2}', 'enabled'),
  ('sd_soc_audience_targeting', 'skill_soc_audience_targeting', 'Audience Targeting', 'Refines audience targeting parameters.', 'advanced', 'social', 0, 5, 5, 'research', '{"channels":["twitter","telegram","discord"],"targetingBonus":2}', 'enabled'),
  ('sd_ver_risk_analyzer', 'skill_ver_risk_analyzer', 'Risk Analyzer', 'Evaluates task and contract risk.', 'advanced', 'verification', 0, 5, 5, 'risk', '{"verificationBonus":2,"riskChecks":["basic_risk","contract_risk","reputation_risk"]}', 'enabled'),
  ('sd_ver_advanced_verification', 'skill_ver_advanced_verification', 'Advanced Verification', 'Multi-rule verification checks.', 'advanced', 'verification', 0, 5, 5, 'verification_reputation', '{"verificationBonus":2,"riskChecks":["format","evidence","consistency"]}', 'enabled'),
  ('sd_ver_fraud_signal_detection', 'skill_ver_fraud_signal_detection', 'Fraud Signal Detection', 'Detects suspicious submission patterns.', 'advanced', 'verification', 0, 5, 5, 'risk', '{"verificationBonus":1,"riskChecks":["fraud","sybil"]}', 'enabled'),
  ('sd_onc_smart_contract_reader', 'skill_onc_smart_contract_reader', 'Smart Contract Reader', 'Reads and summarises contract calls.', 'advanced', 'onchain', 0, 5, 5, 'trading_prep', '{"readBonus":2,"contractBonus":1}', 'enabled'),
  ('sd_onc_ton_chain_analyst', 'skill_onc_ton_chain_analyst', 'TON Chain Analyst', 'TON blockchain data analysis.', 'advanced', 'onchain', 0, 5, 5, 'trading_prep', '{"readBonus":2,"contractBonus":2}', 'enabled'),
  ('sd_onc_onchain_risk_review', 'skill_onc_onchain_risk_review', 'Onchain Risk Review', 'Flags risky onchain interactions.', 'advanced', 'onchain', 0, 5, 5, 'risk', '{"readBonus":1,"contractBonus":2,"riskChecks":["contract_risk"]}', 'enabled'),

  -- --- EXPERT TIER ---
  ('sd_exp_research_director', 'skill_exp_research_director', 'Autonomous Research Director', 'Directs multi-source autonomous research.', 'expert', 'research', 0, 5, 10, 'research', '{"depthBonus":3,"sourceBonus":3,"summaryBonus":2}', 'enabled'),
  ('sd_exp_alpha_opportunity_hunter', 'skill_exp_alpha_opportunity_hunter', 'Alpha Opportunity Hunter', 'Hunts alpha-generating opportunities.', 'expert', 'research', 0, 5, 10, 'task_discovery', '{"depthBonus":3,"sourceBonus":3}', 'enabled'),
  ('sd_exp_master_growth_strategist', 'skill_exp_master_growth_strategist', 'Master Growth Strategist', 'Orchestrates multi-channel growth strategies.', 'expert', 'social', 0, 5, 10, 'growth_propagation', '{"channels":["telegram","twitter","discord"],"targetingBonus":3}', 'enabled'),
  ('sd_exp_multilingual_director', 'skill_exp_multilingual_director', 'Multilingual Campaign Director', 'Directs global multilingual campaigns.', 'expert', 'content', 0, 5, 10, 'content', '{"modes":["campaign","strategy","translation","long_form","short_form"],"languages":["en","zh","ja","ko","ru","es","fr","de","pt"],"summaryBonus":3}', 'enabled'),
  ('sd_exp_chief_verification_officer', 'skill_exp_chief_verification_officer', 'Chief Verification Officer', 'Enterprise-grade verification and audit.', 'expert', 'verification', 0, 5, 10, 'verification_reputation', '{"verificationBonus":3,"riskChecks":["format","evidence","consistency","fraud","sybil","contract_risk","reputation_risk"]}', 'enabled'),
  ('sd_exp_onchain_intelligence', 'skill_exp_onchain_intelligence', 'Onchain Intelligence Expert', 'Deep onchain data intelligence.', 'expert', 'onchain', 0, 5, 10, 'trading_prep', '{"readBonus":3,"contractBonus":3}', 'enabled'),
  ('sd_exp_contract_risk_expert', 'skill_exp_contract_risk_expert', 'Contract Risk Expert', 'Deep contract-level risk analysis.', 'expert', 'verification', 0, 5, 10, 'risk', '{"verificationBonus":2,"contractBonus":3,"riskChecks":["contract_risk","fraud"]}', 'enabled'),
  ('sd_exp_task_orchestration', 'skill_exp_task_orchestration', 'Task Orchestration Expert', 'Optimizes multi-task orchestration.', 'expert', 'research', 0, 5, 10, 'task_sorting', '{"depthBonus":2,"sourceBonus":2,"summaryBonus":3}', 'enabled'),
  ('sd_exp_adaptive_learning', 'skill_exp_adaptive_learning', 'Adaptive Learning', 'Adapts to new task types dynamically.', 'expert', 'research', 0, 5, 10, 'research', '{"depthBonus":2,"sourceBonus":2,"summaryBonus":2}', 'enabled'),
  ('sd_exp_perfect_memory', 'skill_exp_perfect_memory', 'Perfect Memory', 'Perfect context retention across runs.', 'expert', 'research', 0, 5, 10, 'research', '{"depthBonus":1,"sourceBonus":1,"summaryBonus":3}', 'enabled')
ON CONFLICT(id) DO NOTHING;

-- ================================================================
-- PART 1: New incompatible skill definitions (18 definitions)
-- ================================================================

INSERT INTO agent_skill_definitions
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

  ('sd_con_long_form_writing',
   'skill_con_long_form_writing',
   'Long-form Writing',
   'Writes comprehensive articles, blogs, and strategic long-form materials.',
   'advanced', 'content', 0, 5, 5,
   'content', '{"modes":["long_form","article"],"summaryBonus":2}', 'enabled'),

  -- ── Verification ───────────────────────────────────────────
  ('sd_ver_source_verification',
   'skill_ver_source_verification',
   'Source Verification',
   'Verifies source credibility, formats, and link authenticity.',
   'normal', 'verification', 0, 5, 1,
   'verification_reputation', '{"verificationBonus":1,"riskChecks":["source"]}', 'enabled'),

  -- ── Social ─────────────────────────────────────────────────
  ('sd_soc_community_operation',
   'skill_soc_community_operation',
   'Community Operation',
   'Manages and promotes Telegram and community engagement.',
   'normal', 'social', 0, 5, 1,
   'content', '{"channels":["telegram"],"targetingBonus":1}', 'enabled'),

  ('sd_soc_social_listening',
   'skill_soc_social_listening',
   'Social Listening',
   'Monitors viral patterns and community trends across channels.',
   'advanced', 'social', 0, 5, 5,
   'research', '{"channels":["twitter","telegram"],"targetingBonus":2}', 'enabled'),

  ('sd_soc_lead_discovery',
   'skill_soc_lead_discovery',
   'Lead Discovery',
   'Identifies and targets high-quality leads and audience profiles.',
   'advanced', 'social', 0, 5, 5,
   'research', '{"channels":["twitter","telegram","discord"],"targetingBonus":2}', 'enabled'),

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

  ('sd_exp_failure_recovery',
   'skill_exp_failure_recovery',
   'Failure Recovery',
   'Handles workflow errors and autonomous recovery procedures.',
   'expert', 'research', 0, 5, 10,
   'task_sorting', '{"depthBonus":2,"sourceBonus":2,"summaryBonus":3}', 'enabled'),

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
   'research', '{"depthBonus":3,"summaryBonus":3}', 'enabled')
ON CONFLICT(id) DO NOTHING;

-- ================================================================
-- PART 2: skill_acquisition_rules table
-- Single authoritative source for pool membership and release control.
-- ================================================================

CREATE TABLE IF NOT EXISTS skill_acquisition_rules (
  skill_definition_id           TEXT    PRIMARY KEY,
  canonical_code                TEXT    UNIQUE, -- NULL for non-canonical
  catalog_name                  TEXT,           -- public display name
  catalog_description           TEXT,           -- public display description
  catalog_category              TEXT    NOT NULL DEFAULT 'other',
  is_canonical                  INTEGER NOT NULL DEFAULT 0 CHECK (is_canonical IN (0, 1)),
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

CREATE TRIGGER migration_0013_rule_conflict
BEFORE INSERT ON skill_acquisition_rules
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM skill_acquisition_rules r
    WHERE r.skill_definition_id = NEW.skill_definition_id AND NOT (
      r.canonical_code IS NEW.canonical_code
      AND r.catalog_category IS NEW.catalog_category
      AND r.is_canonical IS NEW.is_canonical
      AND r.release_status IS NEW.release_status
      AND r.release_batch IS NEW.release_batch
      AND r.available_in_skill_box IS NEW.available_in_skill_box
      AND r.available_in_normal_synthesis IS NEW.available_in_normal_synthesis
      AND r.available_in_expert_synthesis IS NEW.available_in_expert_synthesis
      AND r.available_in_reset_pool IS NEW.available_in_reset_pool
      AND r.available_as_task_reward IS NEW.available_as_task_reward
      AND r.available_in_market IS NEW.available_in_market
      AND r.available_for_direct_grant IS NEW.available_for_direct_grant
      AND r.drop_weight IS NEW.drop_weight
      AND r.synthesis_weight IS NEW.synthesis_weight
      AND r.required_achievement_code IS NEW.required_achievement_code
      AND r.config_version IS NEW.config_version
    )
  ) THEN RAISE(ROLLBACK, '0013 blocked: acquisition rule ID has different semantics') END;
  SELECT CASE WHEN NEW.canonical_code IS NOT NULL AND EXISTS (
    SELECT 1 FROM skill_acquisition_rules r
    WHERE r.canonical_code = NEW.canonical_code
      AND r.skill_definition_id <> NEW.skill_definition_id
  ) THEN RAISE(ROLLBACK, '0013 blocked: canonical key belongs to another definition ID') END;
END;

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
-- PART 4: Seed all 62 acquisition rules
-- ================================================================

-- ── 4-A: 4 Core Modules — permanently locked out of ALL pools ──

INSERT INTO skill_acquisition_rules
  (skill_definition_id, canonical_code, catalog_name, catalog_description, catalog_category,
   is_canonical, release_status, release_batch,
   available_in_skill_box, available_in_normal_synthesis, available_in_expert_synthesis,
   available_in_reset_pool, available_as_task_reward, available_in_market,
   available_for_direct_grant, drop_weight, synthesis_weight, config_version)
VALUES
  ('sd_core_task_scanner',        NULL, NULL, NULL, 'core', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_core_task_planner',        NULL, NULL, NULL, 'core', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_core_basic_writer',        NULL, NULL, NULL, 'core', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_core_submission_assistant',NULL, NULL, NULL, 'core', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1)
ON CONFLICT(skill_definition_id) DO NOTHING;

-- ── 4-B: 12 Released Normal canonical skills ────────────────────

INSERT INTO skill_acquisition_rules
  (skill_definition_id, canonical_code, catalog_name, catalog_description, catalog_category,
   is_canonical, release_status, release_batch,
   available_in_skill_box, available_in_normal_synthesis, available_in_expert_synthesis,
   available_in_reset_pool, available_as_task_reward, available_in_market,
   available_for_direct_grant, drop_weight, synthesis_weight, config_version)
VALUES
  -- Research (2)
  ('sd_res_project_research', 'skill_res_project_research', 'Project Research', 'Improves project context gathering.', 'research', 1, 'released', 1, 1,0,0,1,1,0,1, 1,0,1),
  ('sd_res_information_summary', 'skill_res_information_summary', 'Information Synthesis', 'Concise summaries of research findings.', 'research', 1, 'released', 1, 1,0,0,1,1,0,1, 1,0,1),
  -- Content (2)
  ('sd_con_structured_writing', 'skill_con_structured_writing', 'Structured Writing', 'Produces structured reports, briefs, and formatted written deliverables.', 'content', 1, 'released', 1, 1,0,0,1,1,0,1, 1,0,1),
  ('sd_con_social_copywriter', 'skill_con_social_copywriter', 'Social Content', 'Generates social copy for promotions.', 'content', 1, 'released', 1, 1,0,0,1,1,0,1, 1,0,1),
  -- Verification (2)
  ('sd_ver_source_verification', 'skill_ver_source_verification', 'Source Verification', 'Verifies source credibility, formats, and link authenticity.', 'verification', 1, 'released', 1, 1,0,0,1,1,0,1, 1,0,1),
  ('sd_ver_submission_checker', 'skill_ver_submission_checker', 'Submission Review', 'Verifies submission format compliance.', 'verification', 1, 'released', 1, 1,0,0,1,1,0,1, 1,0,1),
  -- Onchain (1)
  ('sd_onc_transaction_reader', 'skill_onc_transaction_reader', 'Transaction Reader', 'Reads public transaction data.', 'onchain', 1, 'released', 1, 1,0,0,1,1,0,1, 1,0,1),
  -- Social (1)
  ('sd_soc_community_operation', 'skill_soc_community_operation', 'Community Operation', 'Manages and promotes Telegram and community engagement.', 'social', 1, 'released', 1, 1,0,0,1,1,0,1, 1,0,1),
  -- Automation (3)
  ('sd_aut_task_decomposition', 'skill_aut_task_decomposition', 'Task Decomposition', 'Breaks complex objectives into ordered, executable sub-tasks with dependency mapping.', 'automation', 1, 'released', 1, 1,0,0,1,1,0,1, 1,0,1),
  ('sd_aut_tool_selection', 'skill_aut_tool_selection', 'Tool Selection', 'Evaluates and selects optimal tools, APIs, and resources for a given task.', 'automation', 1, 'released', 1, 1,0,0,1,1,0,1, 1,0,1),
  ('sd_aut_progress_tracking', 'skill_aut_progress_tracking', 'Progress Tracking', 'Monitors task execution state and reports progress milestones in real time.', 'automation', 1, 'released', 1, 1,0,0,1,1,0,1, 1,0,1),
  -- Business (1)
  ('sd_biz_budget_management', 'skill_biz_budget_management', 'Budget Management', 'Tracks, plans, and optimises task and project budgets across GP and time.', 'business', 1, 'released', 1, 1,0,0,1,1,0,1, 1,0,1)
ON CONFLICT(skill_definition_id) DO NOTHING;

-- ── 4-C: 12 Released Advanced canonical skills ──────────────────

INSERT INTO skill_acquisition_rules
  (skill_definition_id, canonical_code, catalog_name, catalog_description, catalog_category,
   is_canonical, release_status, release_batch,
   available_in_skill_box, available_in_normal_synthesis, available_in_expert_synthesis,
   available_in_reset_pool, available_as_task_reward, available_in_market,
   available_for_direct_grant, drop_weight, synthesis_weight, config_version)
VALUES
  -- Research (2)
  ('sd_res_user_market_research', 'skill_res_user_market_research', 'User & Market Research', 'Deep user behaviour analysis and market-segment research for product decisions.', 'research', 1, 'released', 1, 1,1,0,1,1,0,1, 1,1,1),
  ('sd_res_competitive_intelligence', 'skill_res_competitive_intelligence', 'Competitive Intelligence', 'Competitor activity analysis.', 'research', 1, 'released', 1, 1,1,0,1,1,0,1, 1,1,1),
  -- Content (2)
  ('sd_con_technical_documentation', 'skill_con_technical_documentation', 'Technical Documentation', 'Writes technical documentation, API references, integration guides, and specifications.', 'content', 1, 'released', 1, 1,1,0,1,1,0,1, 1,1,1),
  ('sd_con_long_form_writing', 'skill_con_long_form_writing', 'Long-form Writing', 'Writes comprehensive articles, blogs, and strategic long-form materials.', 'content', 1, 'released', 1, 1,1,0,1,1,0,1, 1,1,1),
  -- Verification (1)
  ('sd_ver_advanced_verification', 'skill_ver_advanced_verification', 'Fact Checking', 'Multi-rule verification checks.', 'verification', 1, 'released', 1, 1,1,0,1,1,0,1, 1,1,1),
  -- Onchain (2)
  ('sd_onc_ton_chain_analyst', 'skill_onc_ton_chain_analyst', 'Token Analysis', 'TON blockchain data analysis.', 'onchain', 1, 'released', 1, 1,1,0,1,1,0,1, 1,1,1),
  ('sd_onc_smart_contract_reader', 'skill_onc_smart_contract_reader', 'Smart Contract Reader', 'Reads and summarises contract calls.', 'onchain', 1, 'released', 1, 1,1,0,1,1,0,1, 1,1,1),
  -- Social (2)
  ('sd_soc_social_listening', 'skill_soc_social_listening', 'Social Listening', 'Monitors viral patterns and community trends across channels.', 'social', 1, 'released', 1, 1,1,0,1,1,0,1, 1,1,1),
  ('sd_soc_lead_discovery', 'skill_soc_lead_discovery', 'Lead Discovery', 'Identifies and targets high-quality leads and audience profiles.', 'social', 1, 'released', 1, 1,1,0,1,1,0,1, 1,1,1),
  -- Automation (1)
  ('sd_aut_workflow_planning', 'skill_aut_workflow_planning', 'Workflow Planning', 'Designs and coordinates multi-step automation workflows with branching logic.', 'automation', 1, 'released', 1, 1,1,0,1,1,0,1, 1,1,1),
  -- Business (2)
  ('sd_biz_task_profit_analysis', 'skill_biz_task_profit_analysis', 'Task Profit Analysis', 'Analyses task profitability, cost structure, and return on effort.', 'business', 1, 'released', 1, 1,1,0,1,1,0,1, 1,1,1),
  ('sd_biz_client_delivery_management', 'skill_biz_client_delivery_management', 'Client Delivery Management', 'Manages client deliverables, timelines, quality checks, and handoffs.', 'business', 1, 'released', 1, 1,1,0,1,1,0,1, 1,1,1)
ON CONFLICT(skill_definition_id) DO NOTHING;

-- ── 4-D: 7 Expert advanced_unlock ───────────────────────────────

INSERT INTO skill_acquisition_rules
  (skill_definition_id, canonical_code, catalog_name, catalog_description, catalog_category,
   is_canonical, release_status, release_batch,
   available_in_skill_box, available_in_normal_synthesis, available_in_expert_synthesis,
   available_in_reset_pool, available_as_task_reward, available_in_market,
   available_for_direct_grant, drop_weight, synthesis_weight, config_version)
VALUES
  ('sd_exp_deep_research', 'skill_exp_deep_research', 'Deep Research', 'Expert-level autonomous multi-source deep research with full synthesis and validation.', 'research', 1, 'advanced_unlock', 2, 0,0,1,1,1,0,1, 0,1,1),
  ('sd_exp_multilingual_director', 'skill_exp_multilingual_director', 'Multilingual Adaptation', 'Directs global multilingual campaigns.', 'content', 1, 'advanced_unlock', 2, 0,0,1,1,1,0,1, 0,1,1),
  ('sd_exp_chief_verification_officer', 'skill_exp_chief_verification_officer', 'Risk & Fraud Detection', 'Enterprise-grade verification and audit.', 'verification', 1, 'advanced_unlock', 2, 0,0,1,1,1,0,1, 0,1,1),
  ('sd_exp_onchain_intelligence', 'skill_exp_onchain_intelligence', 'Onchain Risk Review', 'Deep onchain data intelligence.', 'onchain', 1, 'advanced_unlock', 2, 0,0,1,1,1,0,1, 0,1,1),
  ('sd_exp_master_growth_strategist', 'skill_exp_master_growth_strategist', 'Growth Campaign', 'Orchestrates multi-channel growth strategies.', 'social', 1, 'advanced_unlock', 2, 0,0,1,1,1,0,1, 0,1,1),
  ('sd_exp_failure_recovery', 'skill_exp_failure_recovery', 'Failure Recovery', 'Handles workflow errors and autonomous recovery procedures.', 'automation', 1, 'advanced_unlock', 2, 0,0,1,1,1,0,1, 0,1,1),
  ('sd_biz_agent_service_procurement', 'skill_biz_agent_service_procurement', 'Agent Service Procurement', 'Procures, coordinates, and evaluates agent-to-agent service contracts.', 'business', 1, 'advanced_unlock', 2, 0,0,1,1,1,0,1, 0,1,1)
ON CONFLICT(skill_definition_id) DO NOTHING;

-- ── 4-E: 27 Internal existing skills ────────────────────────────

INSERT INTO skill_acquisition_rules
  (skill_definition_id, canonical_code, catalog_name, catalog_description, catalog_category,
   is_canonical, release_status, release_batch,
   available_in_skill_box, available_in_normal_synthesis, available_in_expert_synthesis,
   available_in_reset_pool, available_as_task_reward, available_in_market,
   available_for_direct_grant, drop_weight, synthesis_weight, config_version)
VALUES
  ('sd_res_opportunity_scanner', NULL, NULL, NULL, 'research', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_res_deep_research', NULL, NULL, NULL, 'research', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_res_high_yield_scanner', NULL, NULL, NULL, 'research', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_con_translation', NULL, NULL, NULL, 'content', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_con_short_form_writer', NULL, NULL, NULL, 'content', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_con_growth_copywriter', NULL, NULL, NULL, 'content', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_con_multilingual_campaign', NULL, NULL, NULL, 'content', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_con_content_strategist', NULL, NULL, NULL, 'content', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_soc_telegram_promoter', NULL, NULL, NULL, 'social', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_soc_x_engagement', NULL, NULL, NULL, 'social', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_soc_community_observer', NULL, NULL, NULL, 'social', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_soc_community_growth', NULL, NULL, NULL, 'social', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_soc_viral_pattern_analysis', NULL, NULL, NULL, 'social', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_soc_audience_targeting', NULL, NULL, NULL, 'social', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_ver_evidence_organizer', NULL, NULL, NULL, 'verification', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_ver_risk_analyzer', NULL, NULL, NULL, 'verification', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_ver_fraud_signal_detection', NULL, NULL, NULL, 'verification', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_ver_basic_risk_check', NULL, NULL, NULL, 'verification', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_onc_wallet_observer', NULL, NULL, NULL, 'onchain', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_onc_token_research', NULL, NULL, NULL, 'onchain', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_onc_onchain_risk_review', NULL, NULL, NULL, 'onchain', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_exp_research_director', NULL, NULL, NULL, 'research', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_exp_alpha_opportunity_hunter', NULL, NULL, NULL, 'research', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_exp_contract_risk_expert', NULL, NULL, NULL, 'verification', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_exp_task_orchestration', NULL, NULL, NULL, 'research', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_exp_adaptive_learning', NULL, NULL, NULL, 'research', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1),
  ('sd_exp_perfect_memory', NULL, NULL, NULL, 'research', 0, 'internal', 1, 0,0,0,0,0,0,0, 0,0,1)
ON CONFLICT(skill_definition_id) DO NOTHING;

-- ================================================================
-- PART 5: Assertions
-- ================================================================

CREATE TABLE migration_assertion_temp (
  assertion_name TEXT PRIMARY KEY,
  is_valid INTEGER CHECK (is_valid = 1)
);

-- Assert canonical_code unique constraint behaves correctly
INSERT INTO migration_assertion_temp (assertion_name, is_valid)
VALUES ('canonical_code unique', (
  SELECT CASE WHEN COUNT(canonical_code) = COUNT(DISTINCT canonical_code) THEN 1 ELSE 0 END
  FROM skill_acquisition_rules
  WHERE canonical_code IS NOT NULL
));

-- Assert exactly 31 canonical rules
INSERT INTO migration_assertion_temp (assertion_name, is_valid)
VALUES ('canonical = 31', (
  SELECT CASE WHEN COUNT(*) = 31 THEN 1 ELSE 0 END
  FROM skill_acquisition_rules
  WHERE is_canonical = 1
));

-- Assert exactly 24 released rules
INSERT INTO migration_assertion_temp (assertion_name, is_valid)
VALUES ('released = 24', (
  SELECT CASE WHEN COUNT(*) = 24 THEN 1 ELSE 0 END
  FROM skill_acquisition_rules
  WHERE release_status = 'released'
));

-- Assert exactly 7 advanced_unlock rules
INSERT INTO migration_assertion_temp (assertion_name, is_valid)
VALUES ('advanced_unlock = 7', (
  SELECT CASE WHEN COUNT(*) = 7 THEN 1 ELSE 0 END
  FROM skill_acquisition_rules
  WHERE release_status = 'advanced_unlock'
));

-- Assert 4 core modules are excluded from canonical
INSERT INTO migration_assertion_temp (assertion_name, is_valid)
VALUES ('core excluded = 4', (
  SELECT CASE WHEN COUNT(*) = 4 THEN 1 ELSE 0 END
  FROM skill_acquisition_rules r
  JOIN agent_skill_definitions d ON r.skill_definition_id = d.id
  WHERE d.is_core = 1 AND r.is_canonical = 0
));

-- Assert every definition has exactly one entry in skill_acquisition_rules
INSERT INTO migration_assertion_temp (assertion_name, is_valid)
VALUES ('one rule per definition', (
  SELECT CASE WHEN (SELECT COUNT(*) FROM agent_skill_definitions) = (SELECT COUNT(*) FROM skill_acquisition_rules) THEN 1 ELSE 0 END
));

-- Assert all non-canonical learnable (is_core=0) are internal
INSERT INTO migration_assertion_temp (assertion_name, is_valid)
VALUES ('non-canonical learnable are internal', (
  SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END
  FROM skill_acquisition_rules r
  JOIN agent_skill_definitions d ON r.skill_definition_id = d.id
  WHERE d.is_core = 0 AND r.is_canonical = 0 AND r.release_status != 'internal'
));

-- Assert no orphan rules
INSERT INTO migration_assertion_temp (assertion_name, is_valid)
VALUES ('no orphan rules', (
  SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END
  FROM skill_acquisition_rules
  WHERE skill_definition_id NOT IN (SELECT id FROM agent_skill_definitions)
));

-- Canonical definition and acquisition-rule semantics must agree. This catches
-- a pre-existing row that ON CONFLICT accepted by ID but whose business meaning
-- differs from the canonical manifest. Automation/business definitions use the
-- research runtime category intentionally; their public catalog category remains
-- automation/business.
INSERT INTO migration_assertion_temp (assertion_name, is_valid)
VALUES ('canonical definition semantics', (
  SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END
  FROM skill_acquisition_rules r
  JOIN agent_skill_definitions d ON d.id = r.skill_definition_id
  WHERE r.is_canonical = 1 AND (
    d.code IS NOT r.canonical_code
    OR d.is_core <> 0
    OR d.status <> 'enabled'
    OR d.max_level <> 5
    OR d.required_agent_level <> CASE d.tier WHEN 'normal' THEN 1 WHEN 'advanced' THEN 5 WHEN 'expert' THEN 10 ELSE -1 END
    OR d.tier <> CASE WHEN r.release_status = 'advanced_unlock' THEN 'expert' ELSE d.tier END
    OR d.category <> CASE WHEN r.catalog_category IN ('automation','business') THEN 'research' ELSE r.catalog_category END
  )
));

-- Clean up migration-only guards and assertions.
DROP TRIGGER migration_0013_rule_conflict;
DROP TRIGGER migration_0013_definition_conflict;
DROP TABLE migration_assertion_temp;
