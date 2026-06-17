export type RankTier = "top_1" | "top_5" | "top_10" | "top_20" | "top_50" | "unranked";
export type RiskStatus = "normal" | "restricted" | "review";
export type ItemType = "box" | "ability" | "ticket" | "energy_pack" | "badge";
export type ItemCategory = "profession" | "skill" | "permit" | "access" | "boost" | "task_discovery" | "task_sorting" | "verification_reputation" | "growth_propagation" | "trading_prep";
export type Rarity = "common" | "rare" | "epic" | "legendary" | "genesis";

export interface User {
  id: string;
  telegramId: string;
  username: string;
  languageCode: string;
  rankTier: RankTier;
  riskStatus: RiskStatus;
  hasAgent: boolean;
}

export interface Agent {
  id: string;
  name: string;
  level: number;
  energy: number;
  maxEnergy: number;
  pendingPoints: number;
  userScore: number;
  rankTier: RankTier;
  autoRunUntil: string | null;
}

export interface InventoryItem {
  id: string;
  type: ItemType;
  name: string;
  rarity: Rarity;
  transferable: boolean;
  soulbound?: boolean;
  expiresAt: string | null;
  status: "available" | "active" | "listed" | "burned" | "expired";
  usesRemaining?: number;
  effect?: string;
  sourceBox?: string;
  tradableLabel?: string;
  category?: ItemCategory;
  cardNumber?: string;
  series?: string;
  learnStatus?: "unlearned" | "learned" | "equipped";
}

export interface Task {
  id: string;
  name: string;
  energyCost: number;
  basePendingPoints: number;
  projectId: string | null;
  projectName?: string;
  requiresWallet: boolean;
  autoExecutable: boolean;
  requiredAbility?: string;
  endsAt: string | null;
  targetUrl?: string;
  code?: string;
}

export type VerificationStatus = "pending" | "submitted" | "verifying" | "approved" | "rejected";

export interface TaskVerification {
  id: string;
  taskId: string;
  userId: string;
  link: string;
  status: VerificationStatus;
  createdAt: string;
  verifiedAt?: string;
  feedback?: string;
}

export interface LeaderboardRow {
  rank: number;
  displayName: string;
  score: number;
}

export interface MarketplaceListing {
  id: string;
  assetItemId: string;
  name: string;
  rarity: Rarity;
  price: string;
  currency: string;
  seller: string;
  expiresAt: string;
  assetType?: "box" | "ability" | "other";
  category?: ItemCategory;
  expiresInMinutes?: number;
  marketSection?: "trending" | "rare" | "expiring" | "floor";
  floorRank?: number;
  cardNumber?: string;
}

export interface MarketStats {
  floorPrice: string;
  volume24h: string;
  currency: string;
  floorMove24h?: string;
  activeListings?: number;
}

export interface RecentDrop {
  id: string;
  boxName: string;
  rewardName: string;
  rarity: Rarity;
  username: string;
  createdAt: string;
}

export interface TrendingItem {
  name: string;
  rarity: Rarity;
  floorPrice: string;
  volume24h: string;
  expiresInMinutes?: number;
}

export interface BoxSupply {
  key: "starter" | "fomo" | "group" | "project";
  name: string;
  remaining: number;
  total: number;
  rarity: Rarity;
  route: string;
  oddsLabel: string;
}

export interface DropPoolSummary {
  boxName: string;
  role: string;
  supplyLabel: string;
  oddsLabel: string;
  topDrops: Array<{
    name: string;
    rarity: Rarity;
    effect: string;
    transferable: boolean;
  }>;
}

export interface ShareStats {
  personalReports: number;
  boxReports: number;
  groupInvites: number;
  shareRateLabel: string;
}

export interface MarketSection {
  key: "trending" | "rare" | "expiring" | "floor";
  title: string;
  listingIds: string[];
}

export interface FomoSnapshot {
  launchWindowEndsAt: string;
  boxesRemaining: {
    starter: number;
    fomo: number;
    group: number;
    project: number;
  };
  activeAgentsToday: number;
  nextGroupUnlockAgents: number;
  groupAgentsActive: number;
  market: MarketStats;
  recentDrops: RecentDrop[];
  trendingItems: TrendingItem[];
  boxSupply?: BoxSupply[];
  dropPools?: DropPoolSummary[];
  shareStats?: ShareStats;
  marketSections?: MarketSection[];
}

export interface GroupPool {
  id: string;
  telegramGroupId: string;
  title?: string;
  memberCount: number;
  dailyScore: number;
  rank: number;
  boostMultiplier: number;
}

export interface MeResponse {
  user: User;
  agent: Agent | null;
}
