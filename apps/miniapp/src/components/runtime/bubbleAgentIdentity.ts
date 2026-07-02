import { RuntimeState } from "./runtimeTypes";
import { getMockMode } from "../../apiClient";
import type { InventoryItem } from "@growthbot/shared";

export type BubbleMintStatus = "unminted" | "minting" | "minted" | "failed";

export type BubbleRarity = "Starter" | "Common" | "Rare" | "Epic" | "Genesis";

export const BUBBLE_MINT_STATUSES: readonly BubbleMintStatus[] = ["unminted", "minting", "minted", "failed"];

export function isBubbleMintStatus(value: unknown): value is BubbleMintStatus {
  return typeof value === "string" && BUBBLE_MINT_STATUSES.includes(value as BubbleMintStatus);
}

export interface NaturalSkill {
  code: string;
  name: string;
  tier: "Common" | "Advanced" | "Expert";
  desc: string;
}

export interface BubbleAgentIdentity {
  agentId: string;
  displayNo: string;
  series: string;
  colorGene: string;
  rarity: BubbleRarity;
  level: number;
  mintStatus: BubbleMintStatus;
  tokenId?: string;
  naturalSkills: NaturalSkill[];
  installableSlotsCount: number;
}

export function isBubbleInventoryItem(item: InventoryItem): boolean {
  return item.type === "badge" && Boolean(item.bubbleEditionKey || item.displayNo || item.effect?.includes("泡泡"));
}

export interface BlindBoxPoolItem {
  itemId: string;
  itemType: "skill" | "bubble_agent" | "cosmetic" | "motion_pack" | "frame";
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Genesis";
  weight: number;
  enabled: boolean;
}

// MOCK_BLIND_BOX_POOL_EXAMPLE represents an illustrative configuration.
// WARNING: Formal weights and probabilities MUST be configured and validated on the backend/server-side.
// Front-end pool weights are for local previews only and do not represent actual game drop rates.
export const MOCK_BLIND_BOX_POOL_EXAMPLE: BlindBoxPoolItem[] = [
  { itemId: "agent_smoky_gray", itemType: "bubble_agent", rarity: "Common", weight: 60, enabled: true },
  { itemId: "agent_black_gold", itemType: "bubble_agent", rarity: "Rare", weight: 20, enabled: true },
  { itemId: "agent_frost_blue", itemType: "bubble_agent", rarity: "Rare", weight: 10, enabled: true },
  { itemId: "agent_void_purple", itemType: "bubble_agent", rarity: "Epic", weight: 7, enabled: true },
  { itemId: "agent_liquid_silver", itemType: "bubble_agent", rarity: "Genesis", weight: 3, enabled: true },
  { itemId: "skill_common_scan", itemType: "skill", rarity: "Common", weight: 100, enabled: true },
  { itemId: "skill_adv_signal_view", itemType: "skill", rarity: "Rare", weight: 30, enabled: true },
  { itemId: "skill_exp_genesis", itemType: "skill", rarity: "Genesis", weight: 5, enabled: true }
];

// Simple stable hash utility to map UUID to a stable positive integer
function getStableNumber(uuid: string): number {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = (hash << 5) - hash + uuid.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function rarityFromInventory(value: InventoryItem["rarity"] | undefined): BubbleRarity {
  if (value === "genesis") return "Genesis";
  if (value === "epic") return "Epic";
  if (value === "rare") return "Rare";
  if (value === "common") return "Common";
  return "Common";
}

function colorFromEditionKey(key: string | undefined, fallback?: string): string {
  const colorGeneMap: Record<string, string> = {
    "common-gray": "烟灰泥泡泡",
    "gray": "烟灰泥泡泡",
    "black-gold": "黑金泥泡泡",
    "blue": "冰蓝泥泡泡",
    "purple": "暗紫泥泡泡",
    "red": "赤金泥泡泡",
    "silver": "白银泥泡泡"
  };
  return (key && colorGeneMap[key]) || fallback || "烟灰泥泡泡";
}

function naturalSkillsFromCodes(codes: readonly string[] | undefined): NaturalSkill[] {
  if (!codes?.length) return [];
  const catalog: Record<string, NaturalSkill> = {
    cool_module: { code: "cool_module", name: "冷静模块", tier: "Advanced", desc: "天生携带高级策略标签，影响战报风格与行动展示" },
    data_lens: { code: "data_lens", name: "数据镜片", tier: "Advanced", desc: "天生携带高级分析标签，偏向数据化展示" },
    dark_observe: { code: "dark_observe", name: "暗线观察", tier: "Advanced", desc: "天生携带高级观察标签，偏向链上信号叙事" },
    silent_check: { code: "silent_check", name: "静默校验", tier: "Advanced", desc: "天生携带校验展示标签，用于战报信息层级" },
    fast_echo: { code: "fast_echo", name: "快速回声", tier: "Advanced", desc: "天生携带高级行动标签，偏向节奏感展示" },
    route_memory: { code: "route_memory", name: "路线记忆", tier: "Advanced", desc: "天生携带路线展示标签，用于任务地图表现" },
    genesis_stamp: { code: "genesis_stamp", name: "Genesis 印记", tier: "Expert", desc: "天生携带专家纪念标签，用于身份展示与专属战报语气" },
    silver_archive: { code: "silver_archive", name: "白银档案", tier: "Expert", desc: "天生携带纪念档案标签，用于收藏展示" },
    origin_frame: { code: "origin_frame", name: "原初边框", tier: "Advanced", desc: "天生携带专属舞台框展示标签" }
  };
  return codes.map((code) => catalog[code]).filter((skill): skill is NaturalSkill => Boolean(skill));
}

export function deriveBubbleAgentIdentity(agent: RuntimeState["agent"] | null, selectedBubble?: InventoryItem | null): BubbleAgentIdentity {
  if (!agent) {
    return {
      agentId: "",
      displayNo: "GBOT-000000",
      series: "待命泥泡泡",
      colorGene: "烟灰泥泡泡",
      rarity: "Starter",
      level: 1,
      mintStatus: "unminted",
      naturalSkills: [],
      installableSlotsCount: 4
    };
  }

  const agentHash = getStableNumber(agent.id);
  const displayNo = selectedBubble?.displayNo || selectedBubble?.cardNumber || `GBOT-${String(agentHash % 1000000).padStart(6, '0')}`;

  // 1. Check mock overrides (highest priority)
  let derivedColor: string | null = null;
  let derivedRarity: BubbleRarity | null = null;

  if (typeof window !== "undefined" && getMockMode()) {
    const params = new URLSearchParams(window.location.search);
    const colorGeneParam = params.get("colorGene");
    if (colorGeneParam) {
      const colorGeneMap: Record<string, string> = {
        "gray": "烟灰泥泡泡",
        "black-gold": "黑金泥泡泡",
        "blue": "冰蓝泥泡泡",
        "purple": "暗紫泥泡泡",
        "red": "赤金泥泡泡",
        "silver": "白银泥泡泡"
      };
      if (colorGeneMap[colorGeneParam]) {
        derivedColor = colorGeneMap[colorGeneParam];
      }
    }
    const rarityParam = params.get("rarity");
    if (rarityParam && ["Rare", "Epic", "Genesis", "Common"].includes(rarityParam)) {
      derivedRarity = rarityParam as BubbleRarity;
    }
  }

  // 2. Check if agent contains explicit database asset metadata
  const a = agent as any;
  const hasAssetFields = !!(
    a.colorGene || a.color_gene ||
    a.rarity || a.assetRarity || a.agentRarity ||
    a.series || a.agentSeries ||
    a.source || a.origin
  );

  let colorGene = selectedBubble
    ? colorFromEditionKey(selectedBubble.bubbleEditionKey, selectedBubble.series || selectedBubble.name)
    : "烟灰泥泡泡";
  let rarity: BubbleRarity = selectedBubble ? rarityFromInventory(selectedBubble.rarity) : "Common";

  if (derivedColor || derivedRarity) {
    // Apply mock parameters
    colorGene = derivedColor || (
      derivedRarity === "Genesis" ? "白银泥泡泡" :
      derivedRarity === "Common" ? "烟灰泥泡泡" :
      derivedRarity === "Epic" ? "暗紫泥泡泡" :
      "黑金泥泡泡"
    );
    rarity = derivedRarity || (
      derivedColor === "烟灰泥泡泡" ? "Common" :
      derivedColor === "白银泥泡泡" ? "Genesis" :
      derivedColor === "暗紫泥泡泡" || derivedColor === "赤金泥泡泡" ? "Epic" :
      "Rare"
    );
  } else if (!selectedBubble && hasAssetFields) {
    // Read from DB fields if available
    rarity = (a.rarity || a.assetRarity || a.agentRarity || "Common") as BubbleRarity;
    colorGene = a.colorGene || a.color_gene || (rarity === "Genesis" ? "白银泥泡泡" : rarity === "Common" ? "烟灰泥泡泡" : "黑金泥泡泡");
  } else {
    // DEFAULT TO COMMON YANHUI (Ordinary Bubble Agent for normal users)
    rarity = "Common";
    colorGene = "烟灰泥泡泡";
  }

  // Derive series based on: explicit backend fields, derived colorGene, or fallback
  const dbSeries = derivedColor ? null : selectedBubble?.series || selectedBubble?.name || a.series || a.agentSeries;
  const derivedSeries = dbSeries || colorGene || "烟灰泥泡泡";

  // Derive natural skills (permanent, non-detachable, do not occupy the 4 installable slots)
  const naturalSkills: NaturalSkill[] = selectedBubble
    ? naturalSkillsFromCodes(selectedBubble.naturalSkillCodes)
    : [];
  if (naturalSkills.length === 0 && colorGene === "黑金泥泡泡") {
    naturalSkills.push({
      code: "cool_module",
      name: "冷静模块",
      tier: "Advanced",
      desc: "天生携带高级策略标签，影响战报风格与行动展示"
    });
  } else if (naturalSkills.length === 0 && colorGene === "冰蓝泥泡泡") {
    naturalSkills.push({
      code: "data_lens",
      name: "数据镜片",
      tier: "Advanced",
      desc: "天生携带高级分析标签，偏向数据化展示"
    });
  } else if (naturalSkills.length === 0 && colorGene === "暗紫泥泡泡") {
    naturalSkills.push({
      code: "dark_observe",
      name: "暗线观察",
      tier: "Advanced",
      desc: "天生携带高级观察标签，偏向链上信号叙事"
    });
  } else if (naturalSkills.length === 0 && colorGene === "赤金泥泡泡") {
    naturalSkills.push({
      code: "fast_echo",
      name: "快速回声",
      tier: "Advanced",
      desc: "天生携带高级行动标签，偏向节奏感展示"
    });
  } else if (naturalSkills.length === 0 && colorGene === "白银泥泡泡") {
    naturalSkills.push({
      code: "genesis_stamp",
      name: "Genesis 印记",
      tier: "Expert",
      desc: "天生携带专家纪念标签，用于身份展示与专属战报语气"
    });
  }

  // Formal mint state must come from backend fields. Local cache is mock-only.
  const backendMintStatus = a.mintStatus || a.passportStatus || a.assetMintStatus;
  let mintStatus: BubbleMintStatus = isBubbleMintStatus(backendMintStatus) ? backendMintStatus : "unminted";
  const storageKey = `gb_agent_mint_status_${displayNo}`;

  if (typeof window !== "undefined" && getMockMode()) {
    const storedMintStatus = localStorage.getItem(storageKey);
    if (isBubbleMintStatus(storedMintStatus)) {
      mintStatus = storedMintStatus;
    }

    const params = new URLSearchParams(window.location.search);
    const urlMint = params.get("mintStatus");
    if (isBubbleMintStatus(urlMint)) {
      mintStatus = urlMint;
    }
  }

  // The Passport display token follows the permanent bubble display number in the app UI.
  const tokenId = mintStatus === "minted" ? `Passport-#${displayNo.replace("GBOT-", "")}` : undefined;

  return {
    agentId: agent.id,
    displayNo,
    series: derivedSeries,
    colorGene,
    rarity,
    level: agent.level || 1,
    mintStatus,
    tokenId,
    naturalSkills,
    installableSlotsCount: 4
  };
}
