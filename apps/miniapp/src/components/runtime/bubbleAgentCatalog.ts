import {
  GBOT_BUBBLE_BLIND_BOX_POOL,
  GBOT_BUBBLE_EDITIONS,
  GBOT_BUBBLE_AGENT_OPS_CONFIG,
  type BubbleAgentOpsConfig,
  type BubbleBlindBoxPoolItem,
  type BubbleEditionConfig
} from "@growthbot/shared";
import { BubbleAgentIdentity } from "./bubbleAgentIdentity";

export type BubbleEdition = BubbleEditionConfig;

export const BUBBLE_EDITIONS = GBOT_BUBBLE_EDITIONS;
export const BUBBLE_AGENT_OPS_CONFIG = GBOT_BUBBLE_AGENT_OPS_CONFIG;

const blindBoxTotalWeight = GBOT_BUBBLE_BLIND_BOX_POOL
  .filter((item) => item.enabled)
  .reduce((sum, item) => sum + item.weight, 0);

export const BLIND_BOX_TOTAL_WEIGHT = blindBoxTotalWeight;

export const BLIND_BOX_PREVIEW_ITEMS = GBOT_BUBBLE_BLIND_BOX_POOL.map((item) => ({
  label: item.label,
  rarity: item.rarity,
  desc: item.desc,
  itemType: item.itemType,
  weight: item.weight,
  enabled: item.enabled,
  chanceLabel: blindBoxTotalWeight > 0 ? `${((item.weight / blindBoxTotalWeight) * 100).toFixed(2)}%` : "0%"
}));

export function getBlindBoxTotalWeight(pool: readonly BubbleBlindBoxPoolItem[]) {
  return pool
    .filter((item) => item.enabled)
    .reduce((sum, item) => sum + item.weight, 0);
}

export function getBlindBoxPreviewItems(config: BubbleAgentOpsConfig) {
  const totalWeight = getBlindBoxTotalWeight(config.blindBoxPool);
  return config.blindBoxPool.map((item) => ({
    label: item.label,
    rarity: item.rarity,
    desc: item.desc,
    itemType: item.itemType,
    weight: item.weight,
    enabled: item.enabled,
    chanceLabel: totalWeight > 0 ? `${((item.weight / totalWeight) * 100).toFixed(2)}%` : "0%"
  }));
}

export function createBubblePreviewIdentity(edition: BubbleEdition): BubbleAgentIdentity {
  return {
    agentId: edition.key,
    displayNo: edition.key === "common-gray"
      ? "GBOT-000001"
      : `GBOT-${edition.key.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6).padEnd(6, "0")}`,
    series: edition.name,
    colorGene: edition.colorGene,
    rarity: edition.rarity,
    level: 1,
    mintStatus: "unminted",
    naturalSkills: edition.naturalSkills,
    installableSlotsCount: 4
  };
}
