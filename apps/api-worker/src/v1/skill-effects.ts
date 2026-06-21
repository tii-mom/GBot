import type { AgentSkillCapability } from "@growthbot/shared";
import type { DbAgent } from "./core";

// Server-side caps to prevent unbounded skill stacking
const MAX_RESEARCH_DEPTH = 10;
const MAX_SOURCE_LIMIT = 20;
const MAX_SUMMARY_DEPTH = 5;
const MAX_VERIFICATION_LEVEL = 5;
const MAX_ONCHAIN_READ_LEVEL = 3;
const MAX_CONTRACT_ANALYSIS_LEVEL = 3;
const MAX_AUDIENCE_TARGETING_LEVEL = 3;

interface SkillEffectRow {
  code: string;
  tier: string;
  category: string;
  status: string;
  effect_config_json: string;
}

export function computeCapability(skills: SkillEffectRow[], isCoreModules: boolean[]): AgentSkillCapability {
  const cap: AgentSkillCapability = {
    researchDepth: 1,
    sourceLimit: 2,
    summaryDepth: 1,
    contentModes: ["basic"],
    supportedLanguages: ["en"],
    supportedChannels: ["telegram"],
    audienceTargetingLevel: 0,
    verificationLevel: 0,
    riskChecks: [],
    onchainReadLevel: 0,
    contractAnalysisLevel: 0,
  };

  // Core modules always contribute baseline
  if (isCoreModules.length > 0) {
    cap.researchDepth = Math.max(cap.researchDepth, 2);
    cap.sourceLimit = Math.max(cap.sourceLimit, 3);
    cap.summaryDepth = Math.max(cap.summaryDepth, 1);
    cap.verificationLevel = Math.max(cap.verificationLevel, 1);
  }

  for (const skill of skills) {
    if (skill.status !== "active" && skill.status !== "enabled") continue;
    const cfg = parseEffectConfig(skill.effect_config_json);
    const tierBonus = tierMultiplier(skill.tier);

    switch (skill.category) {
      case "research":
        cap.researchDepth = Math.min(MAX_RESEARCH_DEPTH, cap.researchDepth + (cfg.depthBonus ?? 1) * tierBonus);
        cap.sourceLimit = Math.min(MAX_SOURCE_LIMIT, cap.sourceLimit + (cfg.sourceBonus ?? 1) * tierBonus);
        cap.summaryDepth = Math.min(MAX_SUMMARY_DEPTH, cap.summaryDepth + (cfg.summaryBonus ?? 0) * tierBonus);
        break;
      case "content":
        if (cfg.modes) cap.contentModes = mergeUniq(cap.contentModes, cfg.modes);
        if (cfg.languages) cap.supportedLanguages = mergeUniq(cap.supportedLanguages, cfg.languages);
        cap.summaryDepth = Math.min(MAX_SUMMARY_DEPTH, cap.summaryDepth + (cfg.summaryBonus ?? 0) * tierBonus);
        break;
      case "social":
        if (cfg.channels) cap.supportedChannels = mergeUniq(cap.supportedChannels, cfg.channels);
        cap.audienceTargetingLevel = Math.min(MAX_AUDIENCE_TARGETING_LEVEL, cap.audienceTargetingLevel + (cfg.targetingBonus ?? 1) * tierBonus);
        break;
      case "verification":
        cap.verificationLevel = Math.min(MAX_VERIFICATION_LEVEL, cap.verificationLevel + (cfg.verificationBonus ?? 1) * tierBonus);
        if (cfg.riskChecks) cap.riskChecks = mergeUniq(cap.riskChecks, cfg.riskChecks);
        break;
      case "onchain":
        cap.onchainReadLevel = Math.min(MAX_ONCHAIN_READ_LEVEL, cap.onchainReadLevel + (cfg.readBonus ?? 1) * tierBonus);
        cap.contractAnalysisLevel = Math.min(MAX_CONTRACT_ANALYSIS_LEVEL, cap.contractAnalysisLevel + (cfg.contractBonus ?? 1) * tierBonus);
        break;
    }
  }

  return cap;
}

function parseEffectConfig(json: string): Record<string, any> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function tierMultiplier(tier: string): number {
  switch (tier) {
    case "normal": return 1;
    case "advanced": return 2;
    case "expert": return 3;
    default: return 1;
  }
}

function mergeUniq<T>(a: T[], b: T[]): T[] {
  const set = new Set([...a, ...b]);
  return Array.from(set);
}

export async function resolveAgentSkillEffects(
  db: D1Database,
  agentId: string
): Promise<AgentSkillCapability> {
  // Fetch all active learned skills joined with definitions
  const rows = await db.prepare(`
    SELECT sd.code, sd.tier, sd.category, als.status, sd.effect_config_json
    FROM agent_learned_skills als
    JOIN agent_skill_definitions sd ON sd.id = als.skill_definition_id
    WHERE als.agent_id = ? AND als.status = 'active'
  `).bind(agentId).all<SkillEffectRow>();

  // Check if core modules exist (agent has basis abilities)
  const hasCore = true; // all agents always have core modules

  return computeCapability(rows.results, hasCore ? [true] : []);
}

export async function resolveAgentSkillEffectsWithCoreCheck(
  db: D1Database,
  agentId: string
): Promise<{ capability: AgentSkillCapability; totalSlots: number; usedSlots: number }> {
  const [capability, slotInfo] = await Promise.all([
    resolveAgentSkillEffects(db, agentId),
    db.prepare(`
      SELECT COUNT(*) AS used FROM agent_learned_skills
      WHERE agent_id = ? AND status = 'active'
    `).bind(agentId).first<{ used: number }>(),
  ]);

  // Get agent level for slot calculation
  const agent = await db.prepare("SELECT level FROM agents WHERE id = ?").bind(agentId).first<{ level: number }>();
  const level = agent?.level ?? 1;
  const totalSlots = getSkillSlotsForLevel(level);
  const usedSlots = Number(slotInfo?.used ?? 0);

  return { capability, totalSlots, usedSlots };
}

export function getSkillSlotsForLevel(level: number): number {
  if (level >= 30) return 8;
  if (level >= 20) return 7;
  if (level >= 10) return 6;
  if (level >= 5) return 5;
  return 4;
}

export { MAX_RESEARCH_DEPTH, MAX_SOURCE_LIMIT, MAX_VERIFICATION_LEVEL, MAX_ONCHAIN_READ_LEVEL };
