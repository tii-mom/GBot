import { Hono, Context } from "hono";
import {
  Bindings,
  requireUser,
  id,
  getAgent,
  toAgentV1,
  parseJson,
  logActivity,
} from "./core";
import {
  resolveAgentSkillEffects,
  getSkillSlotsForLevel,
} from "./skill-effects";
import type {
  SkillDefinition,
  LearnedSkill,
  SkillOperationResult,
  SkillEvent,
  AgentSkillCapability,
  SkillDefinitionStatus,
} from "@growthbot/shared";

type AppContext = Context<{ Bindings: Bindings }>;

// In-memory seed for skill definitions (mirrors migration 0011 seed data)
const SKILL_DEFINITION_SEED: Array<{
  id: string; code: string; name: string; description: string;
  tier: string; category: string; isCore: number;
  maxLevel: number; requiredAgentLevel: number;
  effectType: string; effectConfig: string;
}> = [
  // --- 4 CORE MODULES (is_core=1) ---
  { id: "sd_core_task_scanner", code: "core_task_scanner", name: "Task Scanner", description: "Scans executable tasks and judges risk.", tier: "normal", category: "research", isCore: 1, maxLevel: 1, requiredAgentLevel: 1, effectType: "task_discovery", effectConfig: '{"depthBonus":1,"sourceBonus":1}' },
  { id: "sd_core_task_planner", code: "core_task_planner", name: "Task Planner", description: "Splits tasks into ordered steps.", tier: "normal", category: "research", isCore: 1, maxLevel: 1, requiredAgentLevel: 1, effectType: "task_sorting", effectConfig: '{"depthBonus":1,"summaryBonus":1}' },
  { id: "sd_core_basic_writer", code: "core_basic_writer", name: "Basic Writer", description: "Drafts simple copy, summaries, translations.", tier: "normal", category: "content", isCore: 1, maxLevel: 1, requiredAgentLevel: 1, effectType: "content", effectConfig: '{"modes":["basic"],"languages":["en"]}' },
  { id: "sd_core_submission_assistant", code: "core_submission_assistant", name: "Submission Assistant", description: "Builds submission summaries and organises proof.", tier: "normal", category: "verification", isCore: 1, maxLevel: 1, requiredAgentLevel: 1, effectType: "verification_reputation", effectConfig: '{"verificationBonus":1}' },

  // --- NORMAL TIER (15 skills) ---
  { id: "sd_res_project_research", code: "skill_res_project_research", name: "Project Research", description: "Improves project context gathering.", tier: "normal", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "growth_propagation", effectConfig: '{"depthBonus":1,"sourceBonus":1}' },
  { id: "sd_res_opportunity_scanner", code: "skill_res_opportunity_scanner", name: "Opportunity Scanner", description: "Scans for high-value bounty opportunities.", tier: "normal", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "task_discovery", effectConfig: '{"depthBonus":1,"sourceBonus":1}' },
  { id: "sd_res_information_summary", code: "skill_res_information_summary", name: "Information Summary", description: "Concise summaries of research findings.", tier: "normal", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "research", effectConfig: '{"summaryBonus":1}' },
  { id: "sd_con_social_copywriter", code: "skill_con_social_copywriter", name: "Social Copywriter", description: "Generates social copy for promotions.", tier: "normal", category: "content", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "content", effectConfig: '{"modes":["social_post"],"languages":["en"]}' },
  { id: "sd_con_translation", code: "skill_con_translation", name: "Translation", description: "Multilingual translation for campaign tasks.", tier: "normal", category: "content", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "content", effectConfig: '{"modes":["translation"],"languages":["en","zh","ja","ko"]}' },
  { id: "sd_con_short_form_writer", code: "skill_con_short_form_writer", name: "Short-form Writer", description: "Short-form content for social platforms.", tier: "normal", category: "content", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "content", effectConfig: '{"modes":["short_form"],"summaryBonus":1}' },
  { id: "sd_soc_telegram_promoter", code: "skill_soc_telegram_promoter", name: "Telegram Promoter", description: "Telegram community growth content.", tier: "normal", category: "social", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "content", effectConfig: '{"channels":["telegram"],"targetingBonus":1}' },
  { id: "sd_soc_x_engagement", code: "skill_soc_x_engagement", name: "X Engagement", description: "Drafts X/Twitter replies and threads.", tier: "normal", category: "social", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "content", effectConfig: '{"channels":["twitter"],"targetingBonus":1}' },
  { id: "sd_soc_community_observer", code: "skill_soc_community_observer", name: "Community Observer", description: "Monitors community health signals.", tier: "normal", category: "social", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "growth_propagation", effectConfig: '{"channels":["telegram","discord"],"targetingBonus":1}' },
  { id: "sd_ver_submission_checker", code: "skill_ver_submission_checker", name: "Submission Checker", description: "Verifies submission format compliance.", tier: "normal", category: "verification", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "verification_reputation", effectConfig: '{"verificationBonus":1,"riskChecks":["format"]}' },
  { id: "sd_ver_evidence_organizer", code: "skill_ver_evidence_organizer", name: "Evidence Organizer", description: "Organises proof and links for submissions.", tier: "normal", category: "verification", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "verification_reputation", effectConfig: '{"verificationBonus":1,"riskChecks":["evidence"]}' },
  { id: "sd_ver_basic_risk_check", code: "skill_ver_basic_risk_check", name: "Basic Risk Check", description: "Basic risk assessment for tasks.", tier: "normal", category: "verification", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "risk", effectConfig: '{"riskChecks":["basic_risk"]}' },
  { id: "sd_onc_wallet_observer", code: "skill_onc_wallet_observer", name: "Wallet Observer", description: "Read-only wallet info observation.", tier: "normal", category: "onchain", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "trading_prep", effectConfig: '{"readBonus":1}' },
  { id: "sd_onc_transaction_reader", code: "skill_onc_transaction_reader", name: "Transaction Reader", description: "Reads public transaction data.", tier: "normal", category: "onchain", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "trading_prep", effectConfig: '{"readBonus":1}' },
  { id: "sd_onc_token_research", code: "skill_onc_token_research", name: "Token Research", description: "Research token metadata and holders.", tier: "normal", category: "onchain", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "trading_prep", effectConfig: '{"readBonus":1,"contractBonus":1}' },

  // --- ADVANCED TIER (15 skills) ---
  { id: "sd_res_deep_research", code: "skill_res_deep_research", name: "Deep Research", description: "Deep multi-source research capability.", tier: "advanced", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "research", effectConfig: '{"depthBonus":2,"sourceBonus":2,"summaryBonus":1}' },
  { id: "sd_res_high_yield_scanner", code: "skill_res_high_yield_scanner", name: "High-Yield Scanner", description: "Surfaces higher-value tasks.", tier: "advanced", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "task_discovery", effectConfig: '{"depthBonus":2,"sourceBonus":2}' },
  { id: "sd_res_competitive_intelligence", code: "skill_res_competitive_intelligence", name: "Competitive Intelligence", description: "Competitor activity analysis.", tier: "advanced", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "research", effectConfig: '{"depthBonus":2,"sourceBonus":2,"summaryBonus":1}' },
  { id: "sd_con_growth_copywriter", code: "skill_con_growth_copywriter", name: "Growth Copywriter", description: "High-conversion growth copy.", tier: "advanced", category: "content", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "content", effectConfig: '{"modes":["growth","social_post"],"languages":["en","zh"]}' },
  { id: "sd_con_multilingual_campaign", code: "skill_con_multilingual_campaign", name: "Multilingual Campaign", description: "Multi-language campaign content.", tier: "advanced", category: "content", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "content", effectConfig: '{"modes":["campaign","translation"],"languages":["en","zh","ja","ko","ru","es"]}' },
  { id: "sd_con_content_strategist", code: "skill_con_content_strategist", name: "Content Strategist", description: "Strategic content planning.", tier: "advanced", category: "content", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "content", effectConfig: '{"modes":["strategy","long_form","short_form"],"summaryBonus":2}' },
  { id: "sd_soc_community_growth", code: "skill_soc_community_growth", name: "Community Growth", description: "Accelerates community growth campaigns.", tier: "advanced", category: "social", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "growth_propagation", effectConfig: '{"channels":["telegram","discord"],"targetingBonus":2}' },
  { id: "sd_soc_viral_pattern_analysis", code: "skill_soc_viral_pattern_analysis", name: "Viral Pattern Analysis", description: "Identifies viral content patterns.", tier: "advanced", category: "social", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "research", effectConfig: '{"channels":["twitter","telegram"],"targetingBonus":2}' },
  { id: "sd_soc_audience_targeting", code: "skill_soc_audience_targeting", name: "Audience Targeting", description: "Refines audience targeting parameters.", tier: "advanced", category: "social", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "research", effectConfig: '{"channels":["twitter","telegram","discord"],"targetingBonus":2}' },
  { id: "sd_ver_risk_analyzer", code: "skill_ver_risk_analyzer", name: "Risk Analyzer", description: "Evaluates task and contract risk.", tier: "advanced", category: "verification", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "risk", effectConfig: '{"verificationBonus":2,"riskChecks":["basic_risk","contract_risk","reputation_risk"]}' },
  { id: "sd_ver_advanced_verification", code: "skill_ver_advanced_verification", name: "Advanced Verification", description: "Multi-rule verification checks.", tier: "advanced", category: "verification", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "verification_reputation", effectConfig: '{"verificationBonus":2,"riskChecks":["format","evidence","consistency"]}' },
  { id: "sd_ver_fraud_signal_detection", code: "skill_ver_fraud_signal_detection", name: "Fraud Signal Detection", description: "Detects suspicious submission patterns.", tier: "advanced", category: "verification", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "risk", effectConfig: '{"verificationBonus":1,"riskChecks":["fraud","sybil"]}' },
  { id: "sd_onc_smart_contract_reader", code: "skill_onc_smart_contract_reader", name: "Smart Contract Reader", description: "Reads and summarises contract calls.", tier: "advanced", category: "onchain", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "trading_prep", effectConfig: '{"readBonus":2,"contractBonus":1}' },
  { id: "sd_onc_ton_chain_analyst", code: "skill_onc_ton_chain_analyst", name: "TON Chain Analyst", description: "TON blockchain data analysis.", tier: "advanced", category: "onchain", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "trading_prep", effectConfig: '{"readBonus":2,"contractBonus":2}' },
  { id: "sd_onc_onchain_risk_review", code: "skill_onc_onchain_risk_review", name: "Onchain Risk Review", description: "Flags risky onchain interactions.", tier: "advanced", category: "onchain", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "risk", effectConfig: '{"readBonus":1,"contractBonus":2,"riskChecks":["contract_risk"]}' },

  // --- EXPERT TIER (10 skills) ---
  { id: "sd_exp_research_director", code: "skill_exp_research_director", name: "Autonomous Research Director", description: "Directs multi-source autonomous research.", tier: "expert", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 10, effectType: "research", effectConfig: '{"depthBonus":3,"sourceBonus":3,"summaryBonus":2}' },
  { id: "sd_exp_alpha_opportunity_hunter", code: "skill_exp_alpha_opportunity_hunter", name: "Alpha Opportunity Hunter", description: "Hunts alpha-generating opportunities.", tier: "expert", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 10, effectType: "task_discovery", effectConfig: '{"depthBonus":3,"sourceBonus":3}' },
  { id: "sd_exp_master_growth_strategist", code: "skill_exp_master_growth_strategist", name: "Master Growth Strategist", description: "Orchestrates multi-channel growth strategies.", tier: "expert", category: "social", isCore: 0, maxLevel: 5, requiredAgentLevel: 10, effectType: "growth_propagation", effectConfig: '{"channels":["telegram","twitter","discord"],"targetingBonus":3}' },
  { id: "sd_exp_multilingual_director", code: "skill_exp_multilingual_director", name: "Multilingual Campaign Director", description: "Directs global multilingual campaigns.", tier: "expert", category: "content", isCore: 0, maxLevel: 5, requiredAgentLevel: 10, effectType: "content", effectConfig: '{"modes":["campaign","strategy","translation","long_form","short_form"],"languages":["en","zh","ja","ko","ru","es","fr","de","pt"],"summaryBonus":3}' },
  { id: "sd_exp_chief_verification_officer", code: "skill_exp_chief_verification_officer", name: "Chief Verification Officer", description: "Enterprise-grade verification and audit.", tier: "expert", category: "verification", isCore: 0, maxLevel: 5, requiredAgentLevel: 10, effectType: "verification_reputation", effectConfig: '{"verificationBonus":3,"riskChecks":["format","evidence","consistency","fraud","sybil","contract_risk","reputation_risk"]}' },
  { id: "sd_exp_onchain_intelligence", code: "skill_exp_onchain_intelligence", name: "Onchain Intelligence Expert", description: "Deep onchain data intelligence.", tier: "expert", category: "onchain", isCore: 0, maxLevel: 5, requiredAgentLevel: 10, effectType: "trading_prep", effectConfig: '{"readBonus":3,"contractBonus":3}' },
  { id: "sd_exp_contract_risk_expert", code: "skill_exp_contract_risk_expert", name: "Contract Risk Expert", description: "Deep contract-level risk analysis.", tier: "expert", category: "verification", isCore: 0, maxLevel: 5, requiredAgentLevel: 10, effectType: "risk", effectConfig: '{"verificationBonus":2,"contractBonus":3,"riskChecks":["contract_risk","fraud"]}' },
  { id: "sd_exp_task_orchestration", code: "skill_exp_task_orchestration", name: "Task Orchestration Expert", description: "Optimizes multi-task orchestration.", tier: "expert", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 10, effectType: "task_sorting", effectConfig: '{"depthBonus":2,"sourceBonus":2,"summaryBonus":3}' },
  { id: "sd_exp_adaptive_learning", code: "skill_exp_adaptive_learning", name: "Adaptive Learning", description: "Adapts to new task types dynamically.", tier: "expert", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 10, effectType: "research", effectConfig: '{"depthBonus":2,"sourceBonus":2,"summaryBonus":2}' },
  { id: "sd_exp_perfect_memory", code: "skill_exp_perfect_memory", name: "Perfect Memory", description: "Perfect context retention across runs.", tier: "expert", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 10, effectType: "research", effectConfig: '{"depthBonus":1,"sourceBonus":1,"summaryBonus":3}' },

  // --- NEW CANONICAL DEFINITIONS FOR PR #7 ---
  { id: "sd_res_user_market_research", code: "skill_res_user_market_research", name: "User & Market Research", description: "Deep user behaviour analysis and market-segment research for product decisions.", tier: "advanced", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "research", effectConfig: '{"depthBonus":2,"sourceBonus":2,"summaryBonus":1}' },
  { id: "sd_exp_deep_research", code: "skill_exp_deep_research", name: "Deep Research", description: "Expert-level autonomous multi-source deep research with full synthesis and validation.", tier: "expert", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 10, effectType: "research", effectConfig: '{"depthBonus":3,"sourceBonus":3,"summaryBonus":3}' },
  { id: "sd_con_structured_writing", code: "skill_con_structured_writing", name: "Structured Writing", description: "Produces structured reports, briefs, and formatted written deliverables.", tier: "normal", category: "content", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "content", effectConfig: '{"modes":["structured","report","brief"],"summaryBonus":1}' },
  { id: "sd_con_technical_documentation", code: "skill_con_technical_documentation", name: "Technical Documentation", description: "Writes technical documentation, API references, integration guides, and specifications.", tier: "advanced", category: "content", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "content", effectConfig: '{"modes":["technical","spec","api","guide"],"summaryBonus":2}' },
  { id: "sd_con_long_form_writing", code: "skill_con_long_form_writing", name: "Long-form Writing", description: "Writes comprehensive articles, blogs, and strategic long-form materials.", tier: "advanced", category: "content", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "content", effectConfig: '{"modes":["long_form","article"],"summaryBonus":2}' },
  { id: "sd_ver_source_verification", code: "skill_ver_source_verification", name: "Source Verification", description: "Verifies source credibility, formats, and link authenticity.", tier: "normal", category: "verification", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "verification_reputation", effectConfig: '{"verificationBonus":1,"riskChecks":["source"]}' },
  { id: "sd_soc_community_operation", code: "skill_soc_community_operation", name: "Community Operation", description: "Manages and promotes Telegram and community engagement.", tier: "normal", category: "social", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "content", effectConfig: '{"channels":["telegram"],"targetingBonus":1}' },
  { id: "sd_soc_social_listening", code: "skill_soc_social_listening", name: "Social Listening", description: "Monitors viral patterns and community trends across channels.", tier: "advanced", category: "social", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "research", effectConfig: '{"channels":["twitter","telegram"],"targetingBonus":2}' },
  { id: "sd_soc_lead_discovery", code: "skill_soc_lead_discovery", name: "Lead Discovery", description: "Identifies and targets high-quality leads and audience profiles.", tier: "advanced", category: "social", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "research", effectConfig: '{"channels":["twitter","telegram","discord"],"targetingBonus":2}' },
  { id: "sd_aut_task_decomposition", code: "skill_aut_task_decomposition", name: "Task Decomposition", description: "Breaks complex objectives into ordered, executable sub-tasks with dependency mapping.", tier: "normal", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "task_sorting", effectConfig: '{"depthBonus":1,"summaryBonus":1}' },
  { id: "sd_aut_tool_selection", code: "skill_aut_tool_selection", name: "Tool Selection", description: "Evaluates and selects optimal tools, APIs, and resources for a given task.", tier: "normal", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "task_discovery", effectConfig: '{"depthBonus":1,"sourceBonus":1}' },
  { id: "sd_aut_progress_tracking", code: "skill_aut_progress_tracking", name: "Progress Tracking", description: "Monitors task execution state and reports progress milestones in real time.", tier: "normal", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "task_sorting", effectConfig: '{"depthBonus":1,"summaryBonus":1}' },
  { id: "sd_aut_workflow_planning", code: "skill_aut_workflow_planning", name: "Workflow Planning", description: "Designs and coordinates multi-step automation workflows with branching logic.", tier: "advanced", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "task_sorting", effectConfig: '{"depthBonus":2,"summaryBonus":2}' },
  { id: "sd_exp_failure_recovery", code: "skill_exp_failure_recovery", name: "Failure Recovery", description: "Handles workflow errors and autonomous recovery procedures.", tier: "expert", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 10, effectType: "task_sorting", effectConfig: '{"depthBonus":2,"sourceBonus":2,"summaryBonus":3}' },
  { id: "sd_biz_budget_management", code: "skill_biz_budget_management", name: "Budget Management", description: "Tracks, plans, and optimises task and project budgets across GP and time.", tier: "normal", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 1, effectType: "research", effectConfig: '{"depthBonus":1,"summaryBonus":1}' },
  { id: "sd_biz_task_profit_analysis", code: "skill_biz_task_profit_analysis", name: "Task Profit Analysis", description: "Analyses task profitability, cost structure, and return on effort.", tier: "advanced", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "research", effectConfig: '{"depthBonus":2,"summaryBonus":2}' },
  { id: "sd_biz_client_delivery_management", code: "skill_biz_client_delivery_management", name: "Client Delivery Management", description: "Manages client deliverables, timelines, quality checks, and handoffs.", tier: "advanced", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 5, effectType: "research", effectConfig: '{"depthBonus":2,"summaryBonus":2}' },
  { id: "sd_biz_agent_service_procurement", code: "skill_biz_agent_service_procurement", name: "Agent Service Procurement", description: "Procures, coordinates, and evaluates agent-to-agent service contracts.", tier: "expert", category: "research", isCore: 0, maxLevel: 5, requiredAgentLevel: 10, effectType: "research", effectConfig: '{"depthBonus":3,"summaryBonus":3}' },
];

function toSkillDefinition(row: any): SkillDefinition {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    tier: row.tier,
    category: row.category,
    isCore: row.is_core === 1,
    maxLevel: row.max_level,
    requiredAgentLevel: row.required_agent_level,
    effectType: row.effect_type,
    effectConfig: parseJson(row.effect_config_json, {}),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toLearnedSkill(row: any): LearnedSkill {
  return {
    id: row.id,
    agentId: row.agent_id,
    skillDefinitionId: row.skill_definition_id,
    skillCode: row.code || "",
    skillName: row.name || "",
    skillTier: row.tier || "normal",
    skillCategory: row.category || "research",
    skillDescription: row.description || null,
    skillLevel: row.skill_level,
    slotIndex: row.slot_index,
    locked: row.locked === 1,
    status: row.status,
    sourceInventoryItemId: row.source_inventory_item_id,
    replacedByLearnedSkillId: row.replaced_by_learned_skill_id,
    replacedAt: row.replaced_at,
    learnedAt: row.learned_at,
    updatedAt: row.updated_at,
  };
}

function toSkillEvent(row: any): SkillEvent {
  return {
    id: row.id,
    userId: row.user_id,
    agentId: row.agent_id,
    eventType: row.event_type,
    skillDefinitionId: row.skill_definition_id,
    replacedSkillDefinitionId: row.replaced_skill_definition_id,
    inventoryItemId: row.inventory_item_id,
    slotIndex: row.slot_index,
    operationId: row.operation_id,
    before: parseJson(row.before_json, null),
    after: parseJson(row.after_json, null),
    createdAt: row.created_at,
  };
}

async function ensureSkillSeedData(db: D1Database): Promise<void> {
  const count = await db.prepare("SELECT COUNT(*) AS cnt FROM agent_skill_definitions").first<{cnt: number}>();
  if (count && Number(count.cnt) >= 62) return;
  // Re-seed any missing definitions via batch INSERT OR IGNORE
  const stmts = SKILL_DEFINITION_SEED.map(row =>
    db.prepare(`
      INSERT OR IGNORE INTO agent_skill_definitions
        (id, code, name, description, tier, category, is_core, max_level, required_agent_level, effect_type, effect_config_json, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'enabled')
    `).bind(row.id, row.code, row.name, row.description, row.tier, row.category, row.isCore, row.maxLevel, row.requiredAgentLevel, row.effectType, row.effectConfig)
  );
  if (stmts.length > 0) await db.batch(stmts);
}

export function registerV1Skill(app: Hono<{ Bindings: Bindings }>) {

  // GET /skills/definitions — List all skill definitions
  app.get("/skills/definitions", async (c) => {
    const user = await requireUser(c);
    await ensureSkillSeedData(c.env.DB);
    const rows = await c.env.DB.prepare(
      "SELECT * FROM agent_skill_definitions ORDER BY is_core DESC, tier, category, name"
    ).all();
    return c.json({ definitions: rows.results.map(toSkillDefinition) });
  });

  // GET /skills/catalog — List canonical skills catalog
  app.get("/skills/catalog", async (c) => {
    const user = await requireUser(c);
    
    const rows = await c.env.DB.prepare(`
      SELECT d.id, d.code, d.name, d.tier, r.catalog_category, r.release_status, r.release_batch,
             r.available_in_skill_box, r.available_in_normal_synthesis, r.available_in_expert_synthesis,
             r.available_in_reset_pool, r.available_as_task_reward, r.available_in_market, r.available_for_direct_grant
      FROM agent_skill_definitions d
      JOIN skill_acquisition_rules r ON r.skill_definition_id = d.id
      WHERE r.release_status IN ('released', 'advanced_unlock')
      ORDER BY d.tier DESC, r.catalog_category, d.name
    `).all<any>();

    const skills = rows.results.map((row) => {
      const channels: string[] = [];
      if (row.available_in_skill_box === 1) channels.push("skill_box");
      if (row.available_in_normal_synthesis === 1 || row.available_in_expert_synthesis === 1) channels.push("synthesis");
      if (row.available_in_reset_pool === 1) channels.push("reset");
      if (row.available_as_task_reward === 1) channels.push("task_reward");
      if (row.available_in_market === 1) channels.push("market");
      if (row.available_for_direct_grant === 1) channels.push("direct_grant");

      return {
        id: row.id,
        code: row.code,
        name: row.name,
        tier: row.tier,
        catalogCategory: row.catalog_category,
        releaseStatus: row.release_status,
        releaseBatch: row.release_batch,
        acquisitionChannels: channels,
      };
    });

    const released = skills.filter((s) => s.releaseStatus === "released");
    const advUnlock = skills.filter((s) => s.releaseStatus === "advanced_unlock");

    return c.json({
      catalogVersion: 1,
      totalCanonicalSkills: skills.length,
      releasedSkills: released.length,
      advancedUnlockSkills: advUnlock.length,
      categories: [
        "research",
        "content",
        "verification",
        "onchain",
        "social",
        "automation",
        "business"
      ],
      skills,
    });
  });

  // GET /agents/:agentId/skills — List learned skills
  app.get("/agents/:agentId/skills", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");
    const agent = await c.env.DB.prepare("SELECT * FROM agents WHERE id = ?").bind(agentId).first<any>();
    if (!agent || agent.user_id !== user.id) return c.json({ error: "forbidden" }, 403);

    const rows = await c.env.DB.prepare(`
      SELECT als.*, sd.code, sd.name, sd.tier, sd.category, sd.description
      FROM agent_learned_skills als
      JOIN agent_skill_definitions sd ON sd.id = als.skill_definition_id
      WHERE als.agent_id = ? AND als.status = 'active'
      ORDER BY als.slot_index ASC
    `).bind(agentId).all();

    const totalSlots = getSkillSlotsForLevel(agent.level);
    const usedSlots = rows.results.length;

    return c.json({
      skills: rows.results.map(toLearnedSkill),
      slots: { total: totalSlots, used: usedSlots, free: totalSlots - usedSlots, maxReplaceable: totalSlots - usedSlots },
    });
  });

  // POST /agents/:agentId/skills/learn — Learn a skill card (empty slot or replace)
  app.post("/agents/:agentId/skills/learn", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");

    const agent = await c.env.DB.prepare("SELECT * FROM agents WHERE id = ?").bind(agentId).first<any>();
    if (!agent || agent.user_id !== user.id) return c.json({ error: "agent_not_found", message: "Agent not found or not owned." }, 403);

    const body = await c.req.json().catch(() => ({}));
    const inventoryItemId = body.inventoryItemId;
    const idempotencyKey = body.idempotencyKey || `${user.id}:${agentId}:learn:${inventoryItemId}`;
    const protectionInventoryItemId = body.protectionInventoryItemId || null;
    const protectedLearnedSkillId = body.protectedLearnedSkillId || null;

    if (!inventoryItemId) return c.json({ error: "inventory_item_required", message: "inventoryItemId is required." }, 400);

    // 1. Idempotency check
    const existingOp = await c.env.DB.prepare(
      "SELECT * FROM agent_skill_operations WHERE user_id = ? AND operation_type IN ('learn','replace') AND idempotency_key = ?"
    ).bind(user.id, idempotencyKey).first<any>();
    if (existingOp) {
      const result = parseJson<any>(existingOp.result_json, null);
      // Fetch the learned skill that was produced
      if (existingOp.learned_skill_id) {
        const ls = await c.env.DB.prepare(`
          SELECT als.*, sd.code, sd.name, sd.tier, sd.category, sd.description
          FROM agent_learned_skills als
          JOIN agent_skill_definitions sd ON sd.id = als.skill_definition_id
          WHERE als.id = ?
        `).bind(existingOp.learned_skill_id).first<any>();
        return c.json({ result: { ...result, learnedSkill: ls ? toLearnedSkill(ls) : null }, idempotent: true });
      }
      return c.json({ result, idempotent: true });
    }

    // 2. Verify skill card in inventory
    const card = await c.env.DB.prepare(
      "SELECT * FROM inventory_items WHERE id = ? AND owner_user_id = ? AND item_type = 'skill_card' AND status = 'available'"
    ).bind(inventoryItemId, user.id).first<any>();
    if (!card) return c.json({ error: "skill_card_not_found", message: "Skill card not available in inventory." }, 400);

    // 3. Verify skill definition is learnable
    const def = await c.env.DB.prepare(
      "SELECT * FROM agent_skill_definitions WHERE id = ?"
    ).bind(card.skill_definition_id).first<any>();
    if (!def) return c.json({ error: "skill_definition_not_found", message: "Invalid skill definition." }, 400);
    if (def.is_core === 1) return c.json({ error: "core_skill_not_learnable", message: "Core modules cannot be learned as skill cards." }, 400);
    if (def.status === "disabled") return c.json({ error: "skill_disabled", message: "This skill is disabled and cannot be learned." }, 400);
    if ((agent.level ?? 1) < def.required_agent_level) {
      return c.json({ error: "skill_level_too_low", message: `Agent level ${agent.level} is too low. Required: ${def.required_agent_level}` }, 400);
    }

    const totalSlots = getSkillSlotsForLevel(agent.level);
    const existingSkills = await c.env.DB.prepare(
      "SELECT * FROM agent_learned_skills WHERE agent_id = ? AND status = 'active' ORDER BY slot_index ASC"
    ).bind(agentId).all<any>();
    const activeSkills = existingSkills.results;

    // 4. Determine if empty slot or replacement
    const hasFreeSlot = activeSkills.length < totalSlots;

    if (hasFreeSlot) {
      // --- EMPTY SLOT LEARN ---
      // Find first free slot index
      const usedSlots = new Set(activeSkills.map(s => s.slot_index));
      let freeSlot = 0;
      while (usedSlots.has(freeSlot)) freeSlot++;

      const learnedSkillId = id("ls");
      const operationId = id("sop");

      try {
        await c.env.DB.batch([
          // Consume skill card
          c.env.DB.prepare(
            "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
          ).bind(inventoryItemId, user.id),
          // Insert learned skill
          c.env.DB.prepare(
            "INSERT INTO agent_learned_skills (id, agent_id, skill_definition_id, skill_level, slot_index, status, source_inventory_item_id) VALUES (?, ?, ?, 1, ?, 'active', ?)"
          ).bind(learnedSkillId, agentId, def.id, freeSlot, inventoryItemId),
          // Operation log
          c.env.DB.prepare(
            "INSERT INTO agent_skill_operations (id, user_id, agent_id, operation_type, idempotency_key, learned_skill_id, consumed_inventory_item_id, result_json, status) VALUES (?, ?, ?, 'learn', ?, ?, ?, ?, 'completed')"
          ).bind(operationId, user.id, agentId, idempotencyKey, learnedSkillId, inventoryItemId, JSON.stringify({ operationId, consumedCard: true, skillSlotUsed: freeSlot })),
          // Event
          c.env.DB.prepare(
            "INSERT INTO agent_skill_events (id, user_id, agent_id, event_type, skill_definition_id, inventory_item_id, slot_index, operation_id) VALUES (?, ?, ?, 'learn', ?, ?, ?, ?)"
          ).bind(id("sev"), user.id, agentId, def.id, inventoryItemId, freeSlot, operationId),
        ]);
      } catch (err: any) {
        // Check if skill card already consumed (concurrent protection)
        if (err.message?.includes("UNIQUE") || err.message?.includes("inventory_items")) {
          return c.json({ error: "card_already_consumed", message: "Skill card was already consumed." }, 409);
        }
        throw err;
      }

      await logActivity(c.env.DB, agentId, null, "skill_learned", `Learned ${def.name}`, `Skill card consumed, slot ${freeSlot}.`, null);

      const newSkill = await c.env.DB.prepare(`
        SELECT als.*, sd.code, sd.name, sd.tier, sd.category, sd.description
        FROM agent_learned_skills als
        JOIN agent_skill_definitions sd ON sd.id = als.skill_definition_id
        WHERE als.id = ?
      `).bind(learnedSkillId).first<any>();

      const result: SkillOperationResult = {
        operationId,
        learnedSkill: newSkill ? toLearnedSkill(newSkill) : null,
        replacedSkill: null,
        consumedCard: true,
        consumedProtectionToken: false,
        skillSlotUsed: freeSlot,
      };

      return c.json({ result });
    } else {
      // --- FULL SLOTS: RANDOM REPLACEMENT ---
      // Find replaceable skills (not locked, not core)
      const replaceableSkills = activeSkills.filter(s => s.locked === 0);

      // Check if protection token protects an additional skill
      let extraProtectedIds = new Set<string>();
      let protectionConsumed = false;
      let consumedProtectionItemId: string | null = null;

      if (protectedLearnedSkillId && activeSkills.some(s => s.id === protectedLearnedSkillId && s.locked === 0)) {
        // Protected via protectedLearnedSkillId directly — no token needed
        extraProtectedIds.add(protectedLearnedSkillId);
      } else if (protectionInventoryItemId) {
        // Verify protection token
        const token = await c.env.DB.prepare(
          "SELECT * FROM inventory_items WHERE id = ? AND owner_user_id = ? AND item_type = 'consumable' AND status = 'available'"
        ).bind(protectionInventoryItemId, user.id).first<any>();
        if (!token) return c.json({ error: "protection_invalid", message: "Protection token not available." }, 400);
        // Resolve which skill to protect
        if (protectedLearnedSkillId) {
          if (!activeSkills.some(s => s.id === protectedLearnedSkillId)) {
            return c.json({ error: "protection_invalid", message: "protectedLearnedSkillId not found or not active." }, 400);
          }
          extraProtectedIds.add(protectedLearnedSkillId);
        }
        consumedProtectionItemId = protectionInventoryItemId;
      }

      // Exclude extra protected skills from replaceable pool
      const trulyReplaceable = replaceableSkills.filter(s => !extraProtectedIds.has(s.id));

      // Also exclude skills protected via the protectedLearnedSkillId param and locked skills
      if (trulyReplaceable.length === 0) {
        return c.json({ error: "no_replaceable_skill", message: "No replaceable skills available. Unlock a skill or use a protection token." }, 400);
      }

      // Random selection
      const target = trulyReplaceable[Math.floor(Math.random() * trulyReplaceable.length)]!;
      const learnedSkillId = id("ls");
      const operationId = id("sop");

      try {
        const statements = [
          // Consume skill card
          c.env.DB.prepare(
            "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
          ).bind(inventoryItemId, user.id),
          // Mark old skill as replaced
          c.env.DB.prepare(
            "UPDATE agent_learned_skills SET status = 'replaced', replaced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND agent_id = ? AND status = 'active' AND locked = 0"
          ).bind(target.id, agentId),
          // Insert new skill into same slot
          c.env.DB.prepare(
            "INSERT INTO agent_learned_skills (id, agent_id, skill_definition_id, skill_level, slot_index, status, source_inventory_item_id, replaced_by_learned_skill_id) VALUES (?, ?, ?, 1, ?, 'active', ?, ?)"
          ).bind(learnedSkillId, agentId, def.id, target.slot_index, inventoryItemId, target.id),
        ];

        // Consume protection token if provided
        if (consumedProtectionItemId) {
          statements.push(
            c.env.DB.prepare(
              "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
            ).bind(consumedProtectionItemId, user.id)
          );
        }

        // Operation log
        statements.push(
          c.env.DB.prepare(
            "INSERT INTO agent_skill_operations (id, user_id, agent_id, operation_type, idempotency_key, learned_skill_id, replaced_learned_skill_id, consumed_inventory_item_id, consumed_protection_item_id, result_json, status) VALUES (?, ?, ?, 'replace', ?, ?, ?, ?, ?, ?, 'completed')"
          ).bind(operationId, user.id, agentId, idempotencyKey, learnedSkillId, target.id, inventoryItemId, consumedProtectionItemId,
            JSON.stringify({ operationId, consumedCard: true, consumedProtectionToken: !!consumedProtectionItemId, skillSlotUsed: target.slot_index, replacedSkillId: target.id }))
        );

        // Events
        statements.push(
          c.env.DB.prepare(
            "INSERT INTO agent_skill_events (id, user_id, agent_id, event_type, skill_definition_id, replaced_skill_definition_id, inventory_item_id, protection_inventory_item_id, slot_index, operation_id) VALUES (?, ?, ?, 'replace_random', ?, ?, ?, ?, ?, ?)"
          ).bind(id("sev"), user.id, agentId, def.id, target.skill_definition_id, inventoryItemId, consumedProtectionItemId, target.slot_index, operationId)
        );

        if (consumedProtectionItemId) {
          statements.push(
            c.env.DB.prepare(
              "INSERT INTO agent_skill_events (id, user_id, agent_id, event_type, inventory_item_id, operation_id) VALUES (?, ?, ?, 'consume_protection_token', ?, ?)"
            ).bind(id("sev"), user.id, agentId, consumedProtectionItemId, operationId)
          );
        }

        await c.env.DB.batch(statements);
      } catch (err: any) {
        if (err.message?.includes("UNIQUE") || err.message?.includes("inventory_items")) {
          return c.json({ error: "card_already_consumed", message: "Skill card was already consumed." }, 409);
        }
        throw err;
      }

      await logActivity(c.env.DB, agentId, null, "skill_replaced", `Replaced ${target.name} with ${def.name}`, `Random replacement in slot ${target.slot_index}.`, null);

      const newSkill = await c.env.DB.prepare(`
        SELECT als.*, sd.code, sd.name, sd.tier, sd.category, sd.description
        FROM agent_learned_skills als
        JOIN agent_skill_definitions sd ON sd.id = als.skill_definition_id
        WHERE als.id = ?
      `).bind(learnedSkillId).first<any>();

      const replacedSkillRow = await c.env.DB.prepare(`
        SELECT als.*, sd.code, sd.name, sd.tier, sd.category, sd.description
        FROM agent_learned_skills als
        JOIN agent_skill_definitions sd ON sd.id = als.skill_definition_id
        WHERE als.id = ?
      `).bind(target.id).first<any>();

      const result: SkillOperationResult = {
        operationId,
        learnedSkill: newSkill ? toLearnedSkill(newSkill) : null,
        replacedSkill: replacedSkillRow ? toLearnedSkill(replacedSkillRow) : null,
        consumedCard: true,
        consumedProtectionToken: !!consumedProtectionItemId,
        skillSlotUsed: target.slot_index,
      };

      return c.json({ result });
    }
  });

  // POST /agents/:agentId/skills/:learnedSkillId/lock
  app.post("/agents/:agentId/skills/:learnedSkillId/lock", async (c) => {
    const user = await requireUser(c);
    const { agentId, learnedSkillId } = c.req.param();
    const body = await c.req.json().catch(() => ({}));
    const idempotencyKey = body.idempotencyKey || `${user.id}:${agentId}:lock:${learnedSkillId}`;

    const agent = await c.env.DB.prepare("SELECT user_id FROM agents WHERE id = ?").bind(agentId).first<any>();
    if (!agent || agent.user_id !== user.id) return c.json({ error: "agent_not_found" }, 403);

    // Check existing operation
    const existing = await c.env.DB.prepare(
      "SELECT * FROM agent_skill_operations WHERE user_id = ? AND operation_type = 'lock' AND idempotency_key = ?"
    ).bind(user.id, idempotencyKey).first<any>();
    if (existing) return c.json({ result: parseJson(existing.result_json, {}), idempotent: true });

    const skill = await c.env.DB.prepare(
      "SELECT als.*, sd.is_core FROM agent_learned_skills als JOIN agent_skill_definitions sd ON sd.id = als.skill_definition_id WHERE als.id = ? AND als.agent_id = ? AND als.status = 'active'"
    ).bind(learnedSkillId, agentId).first<any>();
    if (!skill) return c.json({ error: "skill_not_found", message: "Active skill not found." }, 404);
    if (skill.is_core === 1) return c.json({ error: "cannot_lock_core", message: "Core modules cannot be locked." }, 400);
    if (skill.locked === 1) return c.json({ error: "already_locked", message: "Skill is already locked." }, 400);

    // Check agent-wide lock limit (database-level via uq_agent_single_locked_skill)
    try {
      await c.env.DB.prepare(
        "UPDATE agent_learned_skills SET locked = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND agent_id = ? AND status = 'active' AND locked = 0"
      ).bind(learnedSkillId, agentId).run();

      const opId = id("sop");
      await c.env.DB.prepare(
        "INSERT INTO agent_skill_operations (id, user_id, agent_id, operation_type, idempotency_key, learned_skill_id, result_json, status) VALUES (?, ?, ?, 'lock', ?, ?, ?, 'completed')"
      ).bind(opId, user.id, agentId, idempotencyKey, learnedSkillId, JSON.stringify({ operationId: opId, locked: true })).run();
      await c.env.DB.prepare(
        "INSERT INTO agent_skill_events (id, user_id, agent_id, event_type, skill_definition_id, operation_id) VALUES (?, ?, ?, 'lock', ?, ?)"
      ).bind(id("sev"), user.id, agentId, skill.skill_definition_id, opId).run();
    } catch (err: any) {
      const errMsg = String(err.message || "");
      if (errMsg.includes("UNIQUE constraint failed") || errMsg.includes("uq_agent_single_locked_skill")) {
        return c.json({ error: "lock_limit_exceeded", message: "Only one skill can be locked per agent." }, 400);
      }
      throw err;
    }

    return c.json({ result: { operationId: "done", locked: true } });
  });

  // POST /agents/:agentId/skills/:learnedSkillId/unlock
  app.post("/agents/:agentId/skills/:learnedSkillId/unlock", async (c) => {
    const user = await requireUser(c);
    const { agentId, learnedSkillId } = c.req.param();
    const body = await c.req.json().catch(() => ({}));
    const idempotencyKey = body.idempotencyKey || `${user.id}:${agentId}:unlock:${learnedSkillId}`;

    const agent = await c.env.DB.prepare("SELECT user_id FROM agents WHERE id = ?").bind(agentId).first<any>();
    if (!agent || agent.user_id !== user.id) return c.json({ error: "agent_not_found" }, 403);

    const existing = await c.env.DB.prepare(
      "SELECT * FROM agent_skill_operations WHERE user_id = ? AND operation_type = 'unlock' AND idempotency_key = ?"
    ).bind(user.id, idempotencyKey).first<any>();
    if (existing) return c.json({ result: parseJson(existing.result_json, {}), idempotent: true });

    await c.env.DB.prepare(
      "UPDATE agent_learned_skills SET locked = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND agent_id = ? AND status = 'active'"
    ).bind(learnedSkillId, agentId).run();

    const opId = id("sop");
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO agent_skill_operations (id, user_id, agent_id, operation_type, idempotency_key, learned_skill_id, result_json, status) VALUES (?, ?, ?, 'unlock', ?, ?, ?, 'completed')"
      ).bind(opId, user.id, agentId, idempotencyKey, learnedSkillId, JSON.stringify({ operationId: opId, unlocked: true })),
      c.env.DB.prepare(
        "INSERT INTO agent_skill_events (id, user_id, agent_id, event_type, skill_definition_id, operation_id) VALUES (?, ?, ?, 'unlock', ?, ?)"
      ).bind(id("sev"), user.id, agentId, null, opId),
    ]);

    return c.json({ result: { operationId: opId, unlocked: true } });
  });

  // GET /agents/:agentId/skill-events
  app.get("/agents/:agentId/skill-events", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");
    const agent = await c.env.DB.prepare("SELECT user_id FROM agents WHERE id = ?").bind(agentId).first<any>();
    if (!agent || agent.user_id !== user.id) return c.json({ error: "forbidden" }, 403);

    const rows = await c.env.DB.prepare(
      "SELECT * FROM agent_skill_events WHERE agent_id = ? ORDER BY created_at DESC LIMIT 50"
    ).bind(agentId).all();
    return c.json({ events: rows.results.map(toSkillEvent) });
  });

  // GET /agent/skill-effects — capability context for current agent
  app.get("/agent/skill-effects", async (c) => {
    const user = await requireUser(c);
    const agent = await c.env.DB.prepare("SELECT * FROM agents WHERE user_id = ? AND status IN ('active', 'idle', 'working')").bind(user.id).first<any>();
    if (!agent) return c.json({ error: "agent_not_found" }, 404);

    const capability = await resolveAgentSkillEffects(c.env.DB, agent.id);
    const totalSlots = getSkillSlotsForLevel(agent.level);
    const usedRow = await c.env.DB.prepare(
      "SELECT COUNT(*) AS used FROM agent_learned_skills WHERE agent_id = ? AND status = 'active'"
    ).bind(agent.id).first<{ used: number }>();

    return c.json({
      capability,
      slots: { total: totalSlots, used: Number(usedRow?.used ?? 0), free: totalSlots - Number(usedRow?.used ?? 0), maxReplaceable: totalSlots - Number(usedRow?.used ?? 0) },
    });
  });
}

export { SKILL_DEFINITION_SEED, ensureSkillSeedData, toSkillDefinition, toLearnedSkill };
