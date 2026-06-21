-- 0007_seed_v1_catalog_and_store.sql
-- Seed canonical asset catalogue (28 assets), official box products
-- (Starter / Worker / Specialist) and their drop tables.
-- All inserts use INSERT OR IGNORE so re-running is idempotent and does not
-- double-grant or override admin edits.

-- =====================================================================
-- 1. ASSET DEFINITIONS CATALOGUE (Work Package D)
-- =====================================================================
-- Stable codes drive the four soulbound default abilities and the drop
-- tables. Columns left NULL fall back to legacy column values.

INSERT OR IGNORE INTO asset_definitions (id, code, key, name, category, asset_type, rarity, status, description_v1, effect, effect_type, effect_value_json, default_uses, max_uses, duration_seconds, soulbound, transferable, transferable_v1, stackable, required_level, requires_wallet) VALUES
-- --- Four soulbound default abilities (auto-granted on Agent claim) ---
('ast_v_task_scanner', 'task_scanner', 'task_scanner', 'Task Scanner', 'skill', 'skill', 'common', 'enabled', 'Scans executable bounty and mission tasks; classifies type, required skills, wallet requirement and risk level.', 'Scan executable tasks and judge risk', 'task_discovery', '{"score":"research","value":5}', NULL, NULL, NULL, 1, 0, 0, 0, 1, 0),
('ast_v_task_planner', 'task_planner', 'task_planner', 'Task Planner', 'skill', 'skill', 'common', 'enabled', 'Splits a task into ordered steps with estimated duration, energy, reward and confirmation requirement.', 'Plan task steps and estimate cost/reward', 'task_sorting', '{"score":"research","value":5}', NULL, NULL, NULL, 1, 0, 0, 0, 1, 0),
('ast_v_basic_writer', 'basic_writer', 'basic_writer', 'Basic Writer', 'skill', 'skill', 'common', 'enabled', 'Drafts simple copy, summaries, translations and task notes.', 'Generate basic content drafts', 'content', '{"score":"content","value":5}', NULL, NULL, NULL, 1, 0, 0, 0, 1, 0),
('ast_v_submission_assistant', 'submission_assistant', 'submission_assistant', 'Submission Assistant', 'skill', 'skill', 'common', 'enabled', 'Builds a task submission summary, organises links and proof, and prepares submission content.', 'Prepare submission summaries and proof', 'verification_reputation', '{"score":"verification","value":5}', NULL, NULL, NULL, 1, 0, 0, 0, 1, 0),
-- --- Basic skills (drops) ---
('ast_v_project_research', 'project_research', 'project_research', 'Project Research', 'skill', 'skill', 'common', 'enabled', 'Improves project context gathering and research score for analysis steps.', 'Boost research score', 'growth_propagation', '{"score":"research","value":8}', NULL, 5, NULL, 0, 1, 1, 1, 1, 0),
('ast_v_social_copywriter', 'social_copywriter', 'social_copywriter', 'Social Copywriter', 'skill', 'skill', 'common', 'enabled', 'Generates higher-quality social copy for X / Telegram promotion steps.', 'Boost content score', 'content', '{"score":"content","value":8}', NULL, 5, NULL, 0, 1, 1, 1, 1, 0),
('ast_v_telegram_promoter', 'telegram_promoter', 'telegram_promoter', 'Telegram Promoter', 'skill', 'skill', 'rare', 'enabled', 'Specialised content generator for Telegram community growth tasks.', 'Boost social score', 'content', '{"score":"social","value":10}', NULL, 5, NULL, 0, 1, 1, 1, 2, 0),
('ast_v_x_reply_assistant', 'x_reply_assistant', 'x_reply_assistant', 'X Reply Assistant', 'skill', 'skill', 'rare', 'enabled', 'Drafts context-aware X replies for engagement tasks.', 'Boost social score', 'content', '{"score":"social","value":10}', NULL, 5, NULL, 0, 1, 1, 1, 2, 0),
('ast_v_translation_module', 'translation_module', 'translation_module', 'Translation Module', 'skill', 'skill', 'common', 'enabled', 'Multilingual translation for campaign and content tasks.', 'Boost content score', 'content', '{"score":"content","value":6}', NULL, 10, NULL, 0, 1, 1, 1, 1, 0),
('ast_v_verification_assistant', 'verification_assistant', 'verification_assistant', 'Verification Assistant', 'skill', 'skill', 'common', 'enabled', 'Improves submission format checks and verification pass rate.', 'Boost verification score', 'verification_reputation', '{"score":"verification","value":8}', NULL, 10, NULL, 0, 1, 1, 1, 1, 0),
-- --- Advanced skills ---
('ast_v_high_yield_scanner', 'high_yield_scanner', 'high_yield_scanner', 'High-Yield Scanner', 'skill', 'skill', 'epic', 'enabled', 'Surfaces higher-value bounty tasks ahead of standard scanners.', 'Boost research score and reward preview', 'task_discovery', '{"score":"research","value":15}', NULL, 5, NULL, 0, 1, 1, 0, 4, 0),
('ast_v_smart_contract_reader', 'smart_contract_reader', 'smart_contract_reader', 'Smart Contract Reader', 'skill', 'skill', 'epic', 'enabled', 'Reads and summarises contract calls for on-chain tasks (read-only).', 'Boost onchain score', 'trading_prep', '{"score":"onchain","value":12}', NULL, 5, NULL, 0, 1, 1, 0, 5, 0),
('ast_v_risk_analyzer', 'risk_analyzer', 'risk_analyzer', 'Risk Analyzer', 'skill', 'skill', 'epic', 'enabled', 'Evaluates task and contract risk before execution.', 'Reduce risk score', 'task_sorting', '{"score":"risk","value":-15}', NULL, 5, NULL, 0, 1, 1, 0, 4, 0),
('ast_v_growth_strategist', 'growth_strategist', 'growth_strategist', 'Growth Strategist', 'skill', 'skill', 'epic', 'enabled', 'Recommends high-impact growth tasks and routing.', 'Boost social and content score', 'growth_propagation', '{"score":"social","value":10}', NULL, 5, NULL, 0, 1, 1, 0, 5, 0),
('ast_v_community_analyst', 'community_analyst', 'community_analyst', 'Community Analyst', 'skill', 'skill', 'rare', 'enabled', 'Analyses community health signals for crew growth tasks.', 'Boost social score', 'growth_propagation', '{"score":"social","value":8}', NULL, 5, NULL, 0, 1, 1, 1, 3, 0),
('ast_v_airdrop_researcher', 'airdrop_researcher', 'airdrop_researcher', 'Airdrop Researcher', 'skill', 'skill', 'rare', 'enabled', 'Discovers and qualifies airdrop-related bounties.', 'Boost research score', 'task_discovery', '{"score":"research","value":10}', NULL, 5, NULL, 0, 1, 1, 1, 3, 0),
('ast_v_onchain_claim_assistant', 'onchain_claim_assistant', 'onchain_claim_assistant', 'On-chain Claim Assistant', 'skill', 'skill', 'epic', 'enabled', 'Prepares on-chain claim steps for user approval (no auto signing).', 'Boost onchain score', 'trading_prep', '{"score":"onchain","value":10}', NULL, 3, NULL, 0, 1, 1, 0, 5, 0),
('ast_v_multilingual_campaign_writer', 'multilingual_campaign_writer', 'multilingual_campaign_writer', 'Multilingual Campaign Writer', 'skill', 'skill', 'rare', 'enabled', 'Produces multilingual campaign copy across markets.', 'Boost content score', 'content', '{"score":"content","value":12}', NULL, 5, NULL, 0, 1, 1, 1, 3, 0),
-- --- Tools and equipment ---
('ast_v_energy_core', 'energy_core', 'energy_core', 'Energy Core', 'tool', 'tool', 'rare', 'enabled', 'Equipment that raises the Agent max energy ceiling.', 'Increase max energy', 'boost', '{"maxEnergy":20}', NULL, NULL, NULL, 0, 1, 1, 0, 2, 0),
('ast_v_parallel_task_chip', 'parallel_task_chip', 'parallel_task_chip', 'Parallel Task Chip', 'tool', 'tool', 'epic', 'enabled', 'Adds an extra concurrent task slot.', 'Add task slot', 'boost', '{"taskSlots":1}', NULL, NULL, NULL, 0, 1, 1, 0, 4, 0),
('ast_v_memory_module', 'memory_module', 'memory_module', 'Memory Module', 'tool', 'tool', 'rare', 'enabled', 'Improves Agent context retention between runs.', 'Boost research score', 'boost', '{"score":"research","value":6}', NULL, NULL, NULL, 0, 1, 1, 0, 3, 0),
('ast_v_browser_tool', 'browser_tool', 'browser_tool', 'Browser Tool', 'tool', 'tool', 'epic', 'enabled', 'Enables read-only web research steps in work runs.', 'Enable research steps', 'task_discovery', '{"score":"research","value":10}', NULL, 10, NULL, 0, 1, 1, 0, 4, 0),
('ast_v_ton_rpc_tool', 'ton_rpc_tool', 'ton_rpc_tool', 'TON RPC Tool', 'tool', 'tool', 'epic', 'enabled', 'Read-only TON RPC reader for on-chain analysis steps.', 'Enable onchain read steps', 'trading_prep', '{"score":"onchain","value":10}', NULL, 10, NULL, 0, 1, 1, 0, 5, 0),
('ast_v_gas_optimizer', 'gas_optimizer', 'gas_optimizer', 'Gas Optimizer', 'tool', 'tool', 'rare', 'enabled', 'Suggests lower-fee execution windows for on-chain steps.', 'Reduce risk score', 'trading_prep', '{"score":"risk","value":-8}', NULL, 10, NULL, 0, 1, 1, 1, 4, 0),
('ast_v_risk_shield', 'risk_shield', 'risk_shield', 'Risk Shield', 'equipment', 'equipment', 'epic', 'enabled', 'Lowers overall Agent risk exposure.', 'Reduce risk score', 'boost', '{"score":"risk","value":-20}', NULL, NULL, NULL, 0, 1, 1, 0, 4, 0),
('ast_v_auto_run_pass', 'auto_run_pass', 'auto_run_pass', 'Auto-run Pass', 'license', 'license', 'rare', 'enabled', 'Grants a window of automated mission execution within daily limits.', 'Enable auto-run window', 'boost', '{"durationSeconds":86400}', NULL, 1, 86400, 0, 1, 1, 0, 2, 0),
('ast_v_project_access_pass', 'project_access_pass', 'project_access_pass_v1', 'Project Access Pass', 'access_pass', 'access_pass', 'legendary', 'enabled', 'Grants eligibility weight for partner project rewards.', 'Add project eligibility', 'access', '{"weight":1}', NULL, NULL, NULL, 0, 1, 1, 0, 3, 0),
('ast_v_group_boost_module', 'group_boost_module', 'group_boost_module', 'Group Boost Module', 'tool', 'tool', 'rare', 'enabled', 'Accelerates crew unlock and group pool progress.', 'Boost crew progress', 'growth_propagation', '{"score":"social","value":8}', NULL, 5, NULL, 0, 1, 1, 1, 2, 0);

-- =====================================================================
-- 2. OFFICIAL BOX PRODUCTS (Work Packages E + F)
-- =====================================================================

INSERT OR IGNORE INTO box_products (id, code, name, description, image_url, box_type, rarity, price_amount, price_currency, total_supply, remaining_supply, per_user_limit, sale_start_at, sale_end_at, transferable, status, metadata_json) VALUES
('bp_starter', 'starter', 'Starter Box', 'Free one-time Starter Box. Fixed GP + Energy bonus plus one random common skill/tool/pass. Core Agent abilities are NOT inside — they are granted automatically with the Agent.', NULL, 'starter', 'common', 0, 'GP', 1000000, 1000000, 1, NULL, NULL, 0, 'active', '{"free":true,"fixed":{"pending_points":100,"energy":20}}'),
('bp_worker', 'worker', 'Worker Box', 'Purchased with GP. Drops basic skills, tools, equipment, energy and passes to expand what your Agent can run.', NULL, 'worker', 'rare', 250, 'GP', 50000, 50000, 5, NULL, NULL, 1, 'active', '{}'),
('bp_specialist', 'specialist', 'Specialist Box', 'Purchased with GP. Higher rarity drops focused on Research, Creator, Growth, Hunter, Verifier and On-chain abilities. Probabilities shown in store.', NULL, 'specialist', 'epic', 1200, 'GP', 8000, 8000, 2, NULL, NULL, 1, 'active', '{}');

-- =====================================================================
-- 3. DROP TABLES (server-authoritative)
-- =====================================================================

-- Starter Box: fixed 100 GP + 20 Energy (guaranteed) plus ONE weighted-random ability
INSERT OR IGNORE INTO box_drop_items (id, box_product_id, asset_definition_id, asset_name, weight, guaranteed, min_quantity, max_quantity, rarity, point_amount, energy_amount) VALUES
('di_starter_fixed_gp', 'bp_starter', NULL, 'GP Bonus', 0, 1, 1, 1, 'common', 100, 0),
('di_starter_fixed_energy', 'bp_starter', NULL, 'Energy Bonus', 0, 1, 1, 1, 'common', 0, 20),
('di_starter_random_1', 'bp_starter', 'ast_v_verification_assistant', 'Verification Assistant', 30, 0, 1, 1, 'common', 0, 0),
('di_starter_random_2', 'bp_starter', 'ast_v_translation_module', 'Translation Module', 25, 0, 1, 1, 'common', 0, 0),
('di_starter_random_3', 'bp_starter', 'ast_v_energy_core', 'Energy Core', 15, 0, 1, 1, 'rare', 0, 0),
('di_starter_random_4', 'bp_starter', 'ast_v_auto_run_pass', 'Auto-run Pass', 15, 0, 1, 1, 'rare', 0, 0),
('di_starter_random_5', 'bp_starter', 'ast_v_group_boost_module', 'Group Boost Module', 15, 0, 1, 1, 'rare', 0, 0);

-- Worker Box: weighted skills/tools/equipment/energy.
INSERT OR IGNORE INTO box_drop_items (id, box_product_id, asset_definition_id, asset_name, weight, guaranteed, min_quantity, max_quantity, rarity, point_amount, energy_amount) VALUES
('di_worker_1', 'bp_worker', 'ast_v_project_research', 'Project Research', 18, 0, 1, 1, 'common', 0, 0),
('di_worker_2', 'bp_worker', 'ast_v_social_copywriter', 'Social Copywriter', 16, 0, 1, 1, 'common', 0, 0),
('di_worker_3', 'bp_worker', 'ast_v_translation_module', 'Translation Module', 14, 0, 1, 1, 'common', 0, 0),
('di_worker_4', 'bp_worker', 'ast_v_telegram_promoter', 'Telegram Promoter', 10, 0, 1, 1, 'rare', 0, 0),
('di_worker_5', 'bp_worker', 'ast_v_x_reply_assistant', 'X Reply Assistant', 10, 0, 1, 1, 'rare', 0, 0),
('di_worker_6', 'bp_worker', 'ast_v_energy_core', 'Energy Core', 8, 0, 1, 1, 'rare', 0, 0),
('di_worker_7', 'bp_worker', 'ast_v_memory_module', 'Memory Module', 6, 0, 1, 1, 'rare', 0, 0),
('di_worker_8', 'bp_worker', 'ast_v_group_boost_module', 'Group Boost Module', 6, 0, 1, 1, 'rare', 0, 0),
('di_worker_9', 'bp_worker', 'ast_v_auto_run_pass', 'Auto-run Pass', 4, 0, 1, 1, 'rare', 0, 0),
('di_worker_10', 'bp_worker', 'ast_v_gas_optimizer', 'Gas Optimizer', 4, 0, 1, 1, 'rare', 0, 0),
('di_worker_11', 'bp_worker', 'ast_v_community_analyst', 'Community Analyst', 4, 0, 1, 1, 'rare', 0, 0);

-- Specialist Box: higher rarity, focused professions. Lower weights overall.
INSERT OR IGNORE INTO box_drop_items (id, box_product_id, asset_definition_id, asset_name, weight, guaranteed, min_quantity, max_quantity, rarity, point_amount, energy_amount) VALUES
('di_specialist_1', 'bp_specialist', 'ast_v_high_yield_scanner', 'High-Yield Scanner', 16, 0, 1, 1, 'epic', 0, 0),
('di_specialist_2', 'bp_specialist', 'ast_v_smart_contract_reader', 'Smart Contract Reader', 14, 0, 1, 1, 'epic', 0, 0),
('di_specialist_3', 'bp_specialist', 'ast_v_risk_analyzer', 'Risk Analyzer', 14, 0, 1, 1, 'epic', 0, 0),
('di_specialist_4', 'bp_specialist', 'ast_v_growth_strategist', 'Growth Strategist', 12, 0, 1, 1, 'epic', 0, 0),
('di_specialist_5', 'bp_specialist', 'ast_v_airdrop_researcher', 'Airdrop Researcher', 12, 0, 1, 1, 'rare', 0, 0),
('di_specialist_6', 'bp_specialist', 'ast_v_onchain_claim_assistant', 'On-chain Claim Assistant', 10, 0, 1, 1, 'epic', 0, 0),
('di_specialist_7', 'bp_specialist', 'ast_v_multilingual_campaign_writer', 'Multilingual Campaign Writer', 10, 0, 1, 1, 'rare', 0, 0),
('di_specialist_8', 'bp_specialist', 'ast_v_parallel_task_chip', 'Parallel Task Chip', 6, 0, 1, 1, 'epic', 0, 0),
('di_specialist_9', 'bp_specialist', 'ast_v_browser_tool', 'Browser Tool', 6, 0, 1, 1, 'epic', 0, 0),
('di_specialist_10', 'bp_specialist', 'ast_v_ton_rpc_tool', 'TON RPC Tool', 6, 0, 1, 1, 'epic', 0, 0),
('di_specialist_11', 'bp_specialist', 'ast_v_risk_shield', 'Risk Shield', 4, 0, 1, 1, 'epic', 0, 0),
('di_specialist_12', 'bp_specialist', 'ast_v_project_access_pass', 'Project Access Pass', 4, 0, 1, 1, 'legendary', 0, 0);
