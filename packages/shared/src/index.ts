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
  studioEnabled: boolean;
  planTier: string;
  pendingPoints: number;
}

export type AgentProfession = "scout" | "research" | "creator" | "growth" | "hunter" | "verifier" | "onchain";
export type AgentStatus = "idle" | "active" | "analyzing" | "working" | "waiting_user" | "verifying" | "paused" | "failed" | "cancelled";

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
  // --- Work Package A: Agent core attributes ---
  profession: AgentProfession;
  status: AgentStatus;
  experience: number;
  taskSlots: number;
  dailyRunLimit: number;
  dailyRunCount: number;
  researchScore: number;
  contentScore: number;
  socialScore: number;
  verificationScore: number;
  onchainScore: number;
  riskScore: number;
  activeWorkRunId: string | null;
}

export interface InventoryItem {
  id: string;
  type: ItemType;
  name: string;
  rarity: Rarity;
  transferable: boolean;
  soulbound?: boolean;
  expiresAt: string | null;
  status: "available" | "active" | "cooling_down" | "listed" | "burned" | "expired";
  usesRemaining?: number;
  effect?: string;
  sourceBox?: string;
  tradableLabel?: string;
  category?: ItemCategory;
  cardNumber?: string;
  series?: string;
  learnStatus?: "unlearned" | "learned" | "equipped";
  cooldownUntil?: string | null;
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

export interface BountyTask {
  id: string;
  title: string;
  description: string | null;
  category: string;
  platform: string;
  targetUrl: string;
  budgetTotal: number;
  budgetRemaining: number;
  rewardPoints: number;
  rewardAssetName: string | null;
  rewardAccessPass: string | null;
  deadline: string | null;
  verificationRule: string | null;
  submissionType: string;
  riskLevel: string;
  ownerType: string;
  ownerName: string | null;
  completedCount: number;
  maxCompletions: number;
  pausedReason: string | null;
  status: 'active' | 'paused' | 'completed';
  createdByAdmin: number;
  createdAt: string;
  updatedAt: string;
  settlementMode: string;
  chainId: number | null;
  escrowContract: string | null;
  escrowTxHash: string | null;
  rewardToken: string | null;
  rewardTokenAddress: string | null;
  rewardDecimals: number | null;
  oracleMode: string;
  disputeStatus: string;
}

export interface BountyTaskVerification {
  id: string;
  bountyTaskId: string;
  userId: string;
  link: string;
  submissionHash: string;
  status: 'submitted' | 'verifying' | 'approved' | 'rejected';
  riskFlagged: number;
  feedback: string | null;
  reviewedBy: string | null;
  createdAt: string;
  verifiedAt: string | null;
  rewardGrantedAt: string | null;
}

export interface AgentProviderAllowlist {
  id: string;
  name: string;
  baseUrl: string;
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
}

export interface AgentModelConfig {
  id: string;
  userId: string;
  profileName: string;
  provider: string;
  baseUrl: string;
  modelId: string;
  keyLast4?: string | null;
  promptTemplate?: string | null;
  taskPreferencesJson?: string | null;
  riskPreferencesJson?: string | null;
  dailyCallLimit: number;
  dailyCallCount: number;
  lastCallDate?: string | null;
  isDefault: boolean;
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
}

export interface AgentPromptTemplate {
  id: string;
  name: string;
  scope: string;
  content: string;
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
}

export interface AgentModelCallLog {
  id: string;
  userId: string;
  configId: string | null;
  purpose: string;
  inputSummary: string | null;
  outputSummary: string | null;
  tokensUsed: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export interface AiGuideResponse {
  summary: string;
  steps: string[];
  submissionHint: string;
  riskLevel: "low" | "medium" | "high";
  riskNotes: string[];
  recommended: boolean;
  reason: string;
}

export interface TaskRecommendationResponse {
  recommendations: Array<{
    taskId: string;
    reason: string;
  }>;
}

// =====================================================================
// Work Package A/D/E/F/G/B shared types
// =====================================================================

export type AssetType = "skill" | "tool" | "equipment" | "license" | "consumable" | "badge" | "access_pass";

export interface AssetDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  assetType: AssetType;
  category: ItemCategory;
  rarity: Rarity;
  effectType: string | null;
  effectValue: Record<string, unknown> | null;
  durationSeconds: number | null;
  maxUses: number | null;
  stackable: boolean;
  soulbound: boolean;
  transferable: boolean;
  requiredLevel: number;
  requiresWallet: boolean;
  status: "enabled" | "disabled";
}

export interface AssetDefinitionWithCatalog extends AssetDefinition {
  legacyEffect: string;
}

export type BoxProductType = "starter" | "worker" | "specialist" | "standard";

export interface BoxProduct {
  id: string;
  code: string;
  name: string;
  description: string | null;
  boxType: BoxProductType;
  rarity: Rarity;
  priceAmount: number;
  priceCurrency: string;
  totalSupply: number;
  remainingSupply: number;
  perUserLimit: number;
  saleStartAt: string | null;
  saleEndAt: string | null;
  transferable: boolean;
  status: "active" | "paused" | "draft";
  metadata: Record<string, unknown> | null;
}

export interface BoxDropItem {
  id: string;
  boxProductId: string;
  assetDefinitionId: string | null;
  assetName: string;
  weight: number;
  guaranteed: boolean;
  minQuantity: number;
  maxQuantity: number;
  rarity: Rarity;
  pointAmount: number;
  energyAmount: number;
  issuedCount: number;
  maxSupply: number | null;
}

export interface BoxDropTableEntry extends BoxDropItem {
  probability: number;
}

export type BoxOrderStatus = "created" | "paid" | "fulfilled" | "cancelled" | "failed";

export interface BoxOrder {
  id: string;
  userId: string;
  boxProductId: string;
  boxName: string;
  boxCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  paymentProvider: string;
  status: BoxOrderStatus;
  fulfilledInventoryItemId: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  fulfillmentAttempts?: number;
  createdAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
}

export type WorkRunStatus =
  | "discovered"
  | "analyzing"
  | "qualified"
  | "rejected"
  | "planning"
  | "waiting_user"
  | "queued"
  | "executing"
  | "waiting_signature"
  | "submitting"
  | "verifying"
  | "settling"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused"
  | "disputed";

export type WorkStepType =
  | "analyze"
  | "qualify"
  | "plan"
  | "prepare_output"
  | "wait_user_confirm"
  | "submit"
  | "verify"
  | "settle";

export type WorkStepStatus = "pending" | "in_progress" | "waiting_approval" | "completed" | "failed" | "skipped";

export interface WorkRun {
  id: string;
  agentId: string;
  userId: string;
  taskId: string;
  taskKind: "basic" | "bounty";
  status: WorkRunStatus;
  currentStep: number;
  totalSteps: number;
  progress: number;
  estimatedReward: number;
  estimatedEnergy: number;
  actualReward: number;
  actualEnergy: number;
  riskLevel: "low" | "medium" | "high";
  requiresUserAction: boolean;
  settled: boolean;
  startedAt: string | null;
  completedAt: string | null;
  failedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkStep {
  id: string;
  runId: string;
  stepOrder: number;
  stepType: WorkStepType;
  title: string;
  description: string | null;
  status: WorkStepStatus;
  inputSummary: string | null;
  outputSummary: string | null;
  toolName: string | null;
  requiresApproval: boolean;
  approvedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEvent {
  id: string;
  agentId: string;
  runId: string | null;
  eventType: string;
  title: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  visibility: "owner" | "public";
  createdAt: string;
}

export interface TaskPlan {
  taskId: string;
  taskName: string;
  taskKind: "basic" | "bounty";
  qualified: boolean;
  rejectionReason: string | null;
  riskLevel: "low" | "medium" | "high";
  estimatedReward: number;
  estimatedEnergy: number;
  estimatedDurationSeconds: number;
  requiresUserAction: boolean;
  requiresWallet: boolean;
  steps: Array<{
    stepType: WorkStepType;
    title: string;
    description: string;
    requiresApproval: boolean;
    toolName: string | null;
  }>;
}

export type AgentWalletStatus = "active" | "paused";
export type AgentWalletType = "observation";

export interface AgentWallet {
  id: string;
  agentId: string;
  userId: string;
  chain: string;
  network: string;
  address: string | null;
  label: string | null;
  walletType: AgentWalletType;
  permissionLevel: number;
  status: AgentWalletStatus;
  spendingLimitDaily: number;
  spendingUsedToday: number;
  transactionLimit: number;
  allowedActions: string[];
  allowedContracts: string[];
  withdrawalAddress: string | null;
  lastActivityAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentWalletPolicy {
  spendingLimitDaily: number;
  transactionLimit: number;
  allowedActions: string[];
  allowedContracts: string[];
  withdrawalAddress: string | null;
}
