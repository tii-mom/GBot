export type RankTier = "top_1" | "top_5" | "top_10" | "top_20" | "top_50" | "unranked";
export type RiskStatus = "normal" | "restricted" | "review";
export type ItemType = "box" | "ability" | "ticket" | "energy_pack" | "badge" | "skill_card" | "consumable";
export type ItemCategory = "profession" | "skill" | "permit" | "access" | "boost" | "task_discovery" | "task_sorting" | "verification_reputation" | "growth_propagation" | "trading_prep";
export type Rarity = "common" | "rare" | "epic" | "legendary" | "genesis";

// Shared contract note:
// These fields keep the historical API shape intact for compatibility while
// the canonical docs define the new product model.
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
  /** Legacy compatibility field preserved until the backend contract is migrated. */
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
  /** Legacy compatibility field preserved until the backend contract is migrated. */
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
  skillDefinitionId?: string;
  skill_definition_id?: string;
}

export interface Task {
  id: string;
  name: string;
  energyCost: number;
  /** Legacy compatibility field preserved until the backend contract is migrated. */
  basePendingPoints: number;
  projectId: string | null;
  projectName?: string;
  requiresWallet: boolean;
  autoExecutable: boolean;
  requiredAbility?: string;
  endsAt: string | null;
  targetUrl?: string;
  code?: string;
  taskType?: string;
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
  assetBalances?: AssetBalance[];
  agentWallet?: AgentWallet | null;
  walletPolicy?: AgentWalletPolicy | null;
  aiCreditBalance?: AiCreditBalance[];
  skillCardSummary?: RealAssetAgentSummary["skillCardSummary"];
  purchaseIntentSummary?: RealAssetAgentSummary["purchaseIntentSummary"];
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
// Real Asset Agent V1 shared contract
// Canonical source: docs/GBOT_CANONICAL_V1.md and real-asset companion docs.
// Legacy GP / pending_points fields below remain compatibility-only.
// =====================================================================

export type AssetSymbol = "G" | "TON" | "AI_CREDIT";
export type AssetLedgerEventType =
  | "deposit"
  | "reserve"
  | "release"
  | "spend"
  | "purchase"
  | "usage"
  | "refund"
  | "adjustment"
  | "audit";

export interface AssetAmount {
  symbol: AssetSymbol;
  amount: string;
  decimals: number;
}

export interface AssetBalance {
  asset: AssetSymbol;
  available: AssetAmount;
  reserved: AssetAmount;
  total: AssetAmount;
  updatedAt: string | null;
}

export interface AssetLedgerEvent {
  id: string;
  userId: string;
  agentId: string | null;
  walletId: string | null;
  eventType: AssetLedgerEventType;
  asset: AssetSymbol;
  amount: AssetAmount;
  relatedIntentId: string | null;
  relatedTransactionId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// `observation` is retained as a legacy compatibility value for old API modules;
// canonical responses should prefer `linked_observation` for read-only linked wallets.
export type AgentWalletType = "isolated_agent_wallet" | "linked_observation" | "testnet_simulated" | "observation";
export type AgentWalletStatus = "active" | "paused" | "revoked" | "pending_setup";
export type AgentWalletPolicyStatus = "active" | "paused" | "requires_review" | "disabled";
export type AgentWalletRiskMode = "conservative" | "balanced" | "aggressive";
export type AgentPurchaseType = "ai_model_token" | "ai_credit" | "skill_card" | "task_execution";

export interface AgentWalletPolicy {
  autoPurchaseEnabled: boolean;
  perTransactionLimit: AssetAmount;
  dailyLimit: AssetAmount;
  minimumReserve: AssetAmount;
  allowedAssets: AssetSymbol[];
  allowedContracts: string[];
  allowedProviders: string[];
  allowedPurchaseTypes: AgentPurchaseType[];
  requireConfirmationAbove: AssetAmount | null;
  adminGlobalPause: boolean;
  userPaused: boolean;
  riskMode: AgentWalletRiskMode;
  status: AgentWalletPolicyStatus;
  /** Legacy compatibility fields mapped from existing agent_wallets columns. */
  spendingLimitDaily?: number;
  /** Legacy compatibility fields mapped from existing agent_wallets columns. */
  transactionLimit?: number;
  /** Legacy compatibility fields mapped from existing agent_wallets columns. */
  allowedActions?: string[];
  /** Legacy compatibility field; not part of canonical Agent control. */
  withdrawalAddress?: string | null;
}

export interface AgentWalletAssetSnapshot {
  walletId: string;
  agentId: string;
  balances: AssetBalance[];
  policy: AgentWalletPolicy;
  updatedAt: string | null;
}

export type PolicyGuardDecisionStatus = "allowed" | "denied" | "requires_confirmation" | "paused";
export type PolicyGuardReason =
  | "within_policy"
  | "auto_purchase_disabled"
  | "asset_not_allowed"
  | "contract_not_allowed"
  | "provider_not_allowed"
  | "purchase_type_not_allowed"
  | "per_transaction_limit_exceeded"
  | "daily_limit_exceeded"
  | "minimum_reserve_violation"
  | "confirmation_required"
  | "admin_global_pause"
  | "user_paused"
  | "wallet_inactive"
  | "unsupported_live_execution";

export interface PolicyGuardInput {
  agentId: string;
  walletId: string | null;
  intentId: string | null;
  asset: AssetSymbol;
  amount: AssetAmount;
  contractAddress: string | null;
  provider: string | null;
  purchaseType: AgentPurchaseType | null;
  policy: AgentWalletPolicy;
  currentBalances: AssetBalance[];
  dailySpendSoFar: AssetAmount | null;
}

export interface PolicyGuardDecision {
  status: PolicyGuardDecisionStatus;
  reasons: PolicyGuardReason[];
  requiresUserConfirmation: boolean;
  requiredConfirmation: boolean;
  riskMode: AgentWalletRiskMode;
  evaluatedAt: string;
  inputSummary: Record<string, unknown>;
}

export type OnchainIntentStatus =
  | "proposed"
  | "allowed"
  | "denied"
  | "queued"
  | "executing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "paused";

export interface OnchainTransactionIntent {
  id: string;
  userId: string;
  agentId: string;
  walletId: string | null;
  status: OnchainIntentStatus;
  asset: AssetSymbol;
  amount: AssetAmount;
  targetContract: string | null;
  provider: string | null;
  purchaseType: AgentPurchaseType | null;
  purpose: string;
  policyDecision: PolicyGuardDecision | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnchainTransactionEvent {
  id: string;
  intentId: string;
  status: OnchainIntentStatus;
  txHash: string | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AiModelTokenProduct {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  purchaseAsset: "G";
  price: AssetAmount;
  creditAmount: AssetAmount;
  status: "active" | "disabled";
}

export interface AiModelTokenPurchaseIntent {
  id: string;
  userId: string;
  agentId: string;
  walletId: string | null;
  productId: string;
  provider: string;
  modelId: string;
  spend: AssetAmount;
  expectedCredits: AssetAmount;
  status: "proposed" | "allowed" | "denied" | "pending_payment" | "purchased" | "failed" | "reversed";
  policyDecision: PolicyGuardDecision | null;
  relatedOnchainIntentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RealAssetConsoleSource = "api" | "fallback_mock";
export type RealAssetConsoleDataSource = "api" | "fallback";
export type RealAssetPersistenceSource = "db" | "fallback" | "simulated";

export interface RealAssetPersistenceStatus {
  source: RealAssetPersistenceSource;
  degraded: boolean;
  persistenceError: string | null;
}

export interface RealAssetEvidence {
  id: string;
  kind: "wallet_policy" | "onchain_intent" | "ai_purchase_intent" | "policy_decision" | "transaction_event" | "audit_event" | "work_report";
  title: string;
  summary: string;
  status: string;
  agentId: string | null;
  walletId: string | null;
  intentId: string | null;
  purchaseIntentId: string | null;
  eventId: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface RealAssetEvidenceSection {
  key: string;
  title: string;
  description: string | null;
  items: RealAssetEvidence[];
}

export interface RealAssetSummary {
  agentCount: number;
  walletPolicyCount: number;
  onchainIntentCount: number;
  purchaseIntentCount: number;
  evidenceCount: number;
  auditEventCount: number;
  allowedCount: number;
  deniedCount: number;
  requiresConfirmationCount: number;
  pausedCount: number;
  readinessGaps: string[];
  lastReviewedAt: string | null;
}

export interface AdminRealAssetAuditEvent {
  id: string;
  eventType: string;
  actor: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export type AdminReviewQueueItemType =
  | "onchain_intent"
  | "ai_model_token_purchase_intent"
  | "policy_decision"
  | "evidence_gap"
  | "audit_event";

export type AdminReviewQueueItemStatus =
  | "pending"
  | "requires_confirmation"
  | "allowed"
  | "denied"
  | "resolved"
  | "failed"
  | "simulated_only";

export type AdminReviewRiskLevel = "low" | "medium" | "high";

export interface AdminReviewQueueItem {
  id: string;
  itemType: AdminReviewQueueItemType;
  status: AdminReviewQueueItemStatus;
  riskLevel: AdminReviewRiskLevel;
  agentId: string | null;
  userId: string | null;
  title: string;
  summary: string;
  policyDecision: PolicyGuardDecision | null;
  relatedIntentId: string | null;
  relatedPurchaseIntentId: string | null;
  relatedEvidenceId: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface AdminReviewQueueResponse {
  mode: "simulated";
  dataSource: RealAssetConsoleSource;
  generatedAt: string;
  liveExecution: false;
  custody: false;
  mainWalletControl: false;
  persistence: RealAssetPersistenceStatus;
  items: AdminReviewQueueItem[];
  filters: {
    statuses: AdminReviewQueueItemStatus[];
    itemTypes: AdminReviewQueueItemType[];
  };
}

export interface AdminReviewActionRequest {
  reviewer?: string;
  reviewStatus?: AdminReviewQueueItemStatus;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AdminReviewActionResponse {
  mode: "simulated";
  liveExecution: false;
  custody: false;
  mainWalletControl: false;
  itemId: string;
  status: AdminReviewQueueItemStatus;
  reviewedAt: string;
  persistence: "db" | "fallback";
  persistenceError: string | null;
  review: {
    reviewer: string;
    notes: string | null;
    metadata: Record<string, unknown> | null;
  };
}

export interface AdminRealAssetReadinessGap {
  key: "missingDbPersistence" | "missingDurableAuditLog" | "missingPolicyPersistence" | "missingTestnetExecutor" | "missingTxStatusTracker" | "missingAdminReviewQueue" | "missingRollbackRunbook" | "productionDeployNotEnabled";
  label: string;
  detail: string;
  blocked: boolean;
}

export interface AdminRealAssetGlobalRisk {
  adminGlobalPause: boolean;
  allowedAssets: AssetSymbol[];
  allowedProviders: string[];
  allowedContracts: string[];
  allowedPurchaseTypes: AgentPurchaseType[];
  defaultRiskMode: AgentWalletRiskMode;
  testnetExecutorReady: boolean;
  liveExecutorReady: boolean;
  reason: string;
}

export type AdminRealAssetPurchaseIntentKind = "onchain_intent" | "ai_purchase_intent";

export interface AdminRealAssetPurchaseIntentRow {
  kind: AdminRealAssetPurchaseIntentKind;
  id: string;
  userId: string;
  agentId: string;
  walletId: string | null;
  status: string;
  asset: AssetSymbol;
  amount: AssetAmount;
  provider: string | null;
  modelId: string | null;
  purchaseType: AgentPurchaseType | null;
  purpose: string;
  policyDecision: PolicyGuardDecision | null;
  createdAt: string;
  updatedAt: string;
  targetContract: string | null;
  expectedCredits: AssetAmount | null;
  productId: string | null;
}

export interface AdminRealAssetPolicyDecisionRow {
  intentId: string;
  intentKind: AdminRealAssetPurchaseIntentKind | "wallet_policy";
  status: PolicyGuardDecisionStatus;
  reasons: PolicyGuardReason[];
  requiredConfirmation: boolean;
  riskMode: AgentWalletRiskMode;
  evaluatedAt: string;
  summary: string;
}

export interface AdminRealAssetWalletPolicyRow {
  agentId: string;
  userId: string;
  displayName: string;
  walletId: string | null;
  walletStatus: AgentWalletStatus;
  riskMode: AgentWalletRiskMode;
  autoPurchaseEnabled: boolean;
  perTransactionLimit: AssetAmount;
  dailyLimit: AssetAmount;
  minimumReserve: AssetAmount;
  allowedAssets: AssetSymbol[];
  allowedContracts: string[];
  allowedProviders: string[];
  allowedPurchaseTypes: AgentPurchaseType[];
  requireConfirmationAbove: AssetAmount | null;
  adminGlobalPause: boolean;
  userPaused: boolean;
  status: AgentWalletPolicyStatus;
  updatedAt: string | null;
  assetSnapshot: AgentWalletAssetSnapshot;
}

export interface AdminRealAssetRiskConsoleAgent {
  agent: Agent;
  wallet: AgentWallet | null;
  walletPolicy: AgentWalletPolicy;
  assetSnapshot: AgentWalletAssetSnapshot;
  agentId: string;
  userId: string;
  displayName: string;
  walletStatus: AgentWalletStatus;
  riskMode: AgentWalletRiskMode;
  autoPurchaseEnabled: boolean;
  latestIntentStatus: string;
  latestEvidenceStatus: string;
  updatedAt: string | null;
  onchainIntents: OnchainTransactionIntent[];
  aiModelTokenPurchaseIntents: AiModelTokenPurchaseIntent[];
  evidenceSections: RealAssetEvidenceSection[];
  readinessGaps: string[];
  lastReviewedAt: string | null;
}

export interface AdminRealAssetRiskConsole {
  mode: "simulated";
  dataSource: RealAssetConsoleSource;
  generatedAt: string;
  liveExecution: false;
  custody: false;
  mainWalletControl: false;
  globalRisk: AdminRealAssetGlobalRisk;
  walletPolicy: AgentWalletPolicy;
  globalControls: {
    adminGlobalPause: boolean;
    providerAllowlist: string[];
    contractAllowlist: string[];
    assetAllowlist: AssetSymbol[];
    purchaseTypeAllowlist: string[];
  };
  realAssetSummary: RealAssetSummary;
  walletPolicies: AdminRealAssetWalletPolicyRow[];
  purchaseIntents: AdminRealAssetPurchaseIntentRow[];
  policyDecisions: AdminRealAssetPolicyDecisionRow[];
  evidence: RealAssetEvidence[];
  assetSnapshots: AgentWalletAssetSnapshot[];
  readinessGaps: AdminRealAssetReadinessGap[];
  intentStates: Array<{ status: string; count: number; description: string }>;
  onchainIntents: OnchainTransactionIntent[];
  aiModelTokenPurchaseIntents: AiModelTokenPurchaseIntent[];
  transactionEvents: OnchainTransactionEvent[];
  agents: AdminRealAssetRiskConsoleAgent[];
  evidenceSections: RealAssetEvidenceSection[];
  auditEvents: AdminRealAssetAuditEvent[];
  lastReviewedAt: string | null;
}

export interface RealAssetConsoleResponse<T> {
  dataSource: RealAssetConsoleSource;
  source?: RealAssetConsoleSource;
  loading: boolean;
  error: string | null;
  stale: boolean;
  fallbackReason: string | null;
  generatedAt: string;
  refreshedAt?: string;
  data: T;
}

export interface AiModelTokenPurchaseResult {
  id: string;
  purchaseIntentId: string;
  status: "purchased" | "failed" | "reversed";
  spend: AssetAmount;
  creditsGranted: AssetAmount;
  receiptRef: string | null;
  auditEventId: string | null;
  createdAt: string;
}

export interface AiCreditBalance {
  agentId: string;
  provider: string;
  modelId: string | null;
  balance: AssetAmount;
  reserved: AssetAmount;
  updatedAt: string | null;
}

export interface AiCreditUsageEvent {
  id: string;
  userId: string;
  agentId: string;
  workRunId: string | null;
  workReportId?: string | null;
  provider: string;
  modelId: string | null;
  amount: AssetAmount;
  purchaseIntentId: string | null;
  evidenceRef: string | null;
  createdAt: string;
}

export type CanonicalSkillTier = "normal" | "advanced" | "expert";
export type CanonicalSkillCategory = "research" | "content" | "verification" | "onchain" | "social_growth" | "automation" | "business_collaboration";

export interface SkillCardAsset {
  assetType: "skill_card";
  transferable: boolean;
  soulbound: boolean;
}

export interface SkillCardEffectProfile {
  capabilityTags: string[];
  riskLevel: "low" | "medium" | "high";
  unlocks: string[];
}

export interface CanonicalSkillCard {
  code: string;
  name: string;
  tier: CanonicalSkillTier;
  category: CanonicalSkillCategory;
  shortDescription: string;
  capabilityTags: string[];
  asset: SkillCardAsset;
  effectProfile: SkillCardEffectProfile;
}

function skillCard(
  code: string,
  name: string,
  tier: CanonicalSkillTier,
  category: CanonicalSkillCategory,
  shortDescription: string,
  capabilityTags: string[]
): CanonicalSkillCard {
  return {
    code,
    name,
    tier,
    category,
    shortDescription,
    capabilityTags,
    asset: { assetType: "skill_card", transferable: true, soulbound: false },
    effectProfile: { capabilityTags, riskLevel: tier === "expert" ? "high" : tier === "advanced" ? "medium" : "low", unlocks: capabilityTags }
  };
}

export const CANONICAL_SKILL_CARDS = [
  skillCard("project_research", "Project Research", "normal", "research", "Research a project, product, or ecosystem using structured sources.", ["research", "project_scoping", "source_collection"]),
  skillCard("information_synthesis", "Information Synthesis", "normal", "research", "Turn multiple inputs into a concise, decision-ready summary.", ["synthesis", "summarization", "briefing"]),
  skillCard("social_content", "Social Content", "normal", "content", "Draft short-form posts and campaign updates for social channels.", ["social_copy", "content_drafting", "channel_adaptation"]),
  skillCard("structured_writing", "Structured Writing", "normal", "content", "Create clear outlines, reports, and formatted written deliverables.", ["writing", "outlining", "reporting"]),
  skillCard("submission_review", "Submission Review", "normal", "verification", "Check user submissions for completeness and basic rule alignment.", ["submission_check", "quality_review", "rubric"]),
  skillCard("source_verification", "Source Verification", "normal", "verification", "Verify cited sources and separate claims from unsupported statements.", ["source_check", "citation_review", "claim_review"]),
  skillCard("transaction_reader", "Transaction Reader", "normal", "onchain", "Read and explain transaction-level onchain evidence.", ["transaction_reading", "onchain_evidence", "wallet_activity"]),
  skillCard("community_operation", "Community Operation", "normal", "social_growth", "Assist routine community updates, FAQs, and engagement workflows.", ["community_ops", "moderation_support", "engagement"]),
  skillCard("task_decomposition", "Task Decomposition", "normal", "automation", "Break complex opportunities into executable subtasks.", ["planning", "task_breakdown", "execution_steps"]),
  skillCard("tool_selection", "Tool Selection", "normal", "automation", "Choose suitable tools and execution modes for a task.", ["tool_routing", "workflow_choice", "automation"]),
  skillCard("progress_tracking", "Progress Tracking", "normal", "automation", "Track task status, blockers, and next actions.", ["status_tracking", "checklists", "workrun_progress"]),
  skillCard("budget_management", "Budget Management", "normal", "business_collaboration", "Track simple budgets and spending constraints for Agent work.", ["budget", "limits", "spend_awareness"]),
  skillCard("competitive_intelligence", "Competitive Intelligence", "advanced", "research", "Compare competitors, positioning, and ecosystem signals.", ["market_map", "competitor_analysis", "positioning"]),
  skillCard("user_market_research", "User & Market Research", "advanced", "research", "Analyze user needs, segments, and market demand signals.", ["user_research", "market_research", "segmentation"]),
  skillCard("technical_documentation", "Technical Documentation", "advanced", "content", "Write developer-facing docs, API notes, and technical explainers.", ["technical_writing", "api_docs", "developer_docs"]),
  skillCard("long_form_writing", "Long-form Writing", "advanced", "content", "Create long-form articles, narratives, and in-depth reports.", ["longform", "editorial", "narrative"]),
  skillCard("fact_checking", "Fact Checking", "advanced", "verification", "Check factual claims against reliable evidence.", ["fact_check", "evidence_review", "accuracy"]),
  skillCard("token_analysis", "Token Analysis", "advanced", "onchain", "Analyze token mechanics, supply, utility, and observable risks.", ["tokenomics", "asset_analysis", "onchain_context"]),
  skillCard("smart_contract_reader", "Smart Contract Reader", "advanced", "onchain", "Read smart contract interfaces and summarize behavior without executing transactions.", ["contract_reading", "abi_review", "function_analysis"]),
  skillCard("social_listening", "Social Listening", "advanced", "social_growth", "Monitor community and social signals for trends and issues.", ["social_monitoring", "sentiment", "trend_detection"]),
  skillCard("lead_discovery", "Lead Discovery", "advanced", "social_growth", "Find potential collaborators, clients, or opportunity leads.", ["lead_research", "prospecting", "opportunity_discovery"]),
  skillCard("workflow_planning", "Workflow Planning", "advanced", "automation", "Design multi-step workflows with checkpoints and approvals.", ["workflow_design", "approval_points", "execution_plan"]),
  skillCard("task_profit_analysis", "Task Profit Analysis", "advanced", "business_collaboration", "Estimate task cost, effort, and upside without guaranteeing outcomes.", ["cost_benefit", "task_scoring", "risk_adjusted_planning"]),
  skillCard("client_delivery_management", "Client Delivery Management", "advanced", "business_collaboration", "Organize deliverables, acceptance criteria, and client handoff state.", ["delivery", "acceptance", "client_ops"]),
  skillCard("deep_research", "Deep Research", "expert", "research", "Perform deeper multi-source research and produce robust briefs.", ["deep_research", "multi_source", "expert_brief"]),
  skillCard("multilingual_adaptation", "Multilingual Adaptation", "expert", "content", "Adapt content across languages and cultural contexts.", ["localization", "translation_adaptation", "multilingual"]),
  skillCard("risk_fraud_detection", "Risk & Fraud Detection", "expert", "verification", "Identify fraud patterns, manipulation signals, and high-risk claims.", ["fraud_detection", "risk_review", "abuse_signals"]),
  skillCard("onchain_risk_review", "Onchain Risk Review", "expert", "onchain", "Review onchain interactions, contracts, and wallet activity for risk signals.", ["onchain_risk", "contract_risk", "wallet_risk"]),
  skillCard("growth_campaign", "Growth Campaign", "expert", "social_growth", "Plan growth campaigns with messaging, channels, and measurement.", ["growth_strategy", "campaign_planning", "measurement"]),
  skillCard("failure_recovery", "Failure Recovery", "expert", "automation", "Recover from failed workflows with diagnosis and safer next steps.", ["recovery", "debugging", "fallback_plan"]),
  skillCard("agent_service_procurement", "Agent Service Procurement", "expert", "business_collaboration", "Help source and manage external services under explicit budget and policy.", ["procurement", "service_selection", "policy_budget"])
] as const satisfies readonly CanonicalSkillCard[];

export interface RealAssetAgentSummary {
  assetBalances: AssetBalance[];
  agentWallet: AgentWallet | null;
  walletPolicy: AgentWalletPolicy | null;
  aiCreditBalance: AiCreditBalance[];
  skillCardSummary: {
    totalCanonicalCards: number;
    normal: number;
    advanced: number;
    expert: number;
  };
  purchaseIntentSummary: {
    proposed: number;
    allowed: number;
    denied: number;
    queued: number;
    executing: number;
    succeeded: number;
    failed: number;
    cancelled: number;
    paused: number;
  };
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
  /** Legacy compatibility field preserved until the pricing contract is migrated. */
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
  /** Legacy compatibility field preserved until the payment contract is migrated. */
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

export type WorkExecutionMode = "simulated" | "runtime" | "external";

export interface WorkRun {
  id: string;
  agentId: string;
  userId: string;
  taskId: string;
  taskKind: "basic" | "bounty";
  executionMode?: WorkExecutionMode;
  rewardEligible?: boolean;
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
  researchBriefResult?: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  failedReason: string | null;
  createdAt: string;
  updatedAt: string;
  usedSkills?: any[];
}


export interface VerificationSummary {
  status: "pending" | "verifying" | "approved" | "rejected" | "unknown";
  checkedAt: string | null;
  score?: number;
  notes?: string | null;
}

export interface SettlementSummary {
  status: "pending" | "settled" | "failed" | "unknown";
  settledAt: string | null;
  rewardPoints?: number;
  transactionId?: string | null;
}

export interface WorkReport {
  id: string;
  runId: string;
  taskId: string;
  agentId: string;
  reportKind: "research_brief" | "work_report" | "verification_result" | "settlement";
  overallStatus: string;
  input: Record<string, unknown> | null;
  execution: Record<string, unknown> | null;
  evidence: Array<Record<string, unknown>>;
  verification: VerificationSummary;
  settlement: SettlementSummary;
  share?: {
    allowed: boolean;
    text: string | null;
    blockedReason: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkReportResponse {
  report: WorkReport | null;
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

export interface AgentWallet {
  id: string;
  agentId: string;
  userId: string;
  chain: "TON" | string;
  network: string;
  address: string | null;
  label: string | null;
  walletType: AgentWalletType;
  permissionLevel: number;
  status: AgentWalletStatus;
  assetBalances?: AssetBalance[];
  policy?: AgentWalletPolicy;
  /** Legacy compatibility field mapped from existing agent_wallets.spending_limit_daily. */
  spendingLimitDaily: number;
  /** Legacy compatibility field mapped from existing agent_wallets.spending_used_today. */
  spendingUsedToday: number;
  /** Legacy compatibility field mapped from existing agent_wallets.transaction_limit. */
  transactionLimit: number;
  /** Legacy compatibility field mapped from existing agent_wallets.allowed_actions_json. */
  allowedActions: string[];
  allowedContracts: string[];
  /** Legacy compatibility field; canonical Agent Wallet must not control the user's main wallet. */
  withdrawalAddress: string | null;
  lastActivityAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// =====================================================================
// PR #5 — Agent Skill Core types
// =====================================================================

export type SkillTier = "normal" | "advanced" | "expert";
export type SkillCategory = "research" | "content" | "social" | "verification" | "onchain";
export type SkillDefinitionStatus = "enabled" | "deprecated" | "disabled";
export type LearnedSkillStatus = "active" | "replaced" | "disabled";
export type SkillEventType = "learn" | "replace_random" | "lock" | "unlock" | "protect" | "consume_card" | "consume_protection_token" | "replace_skill_executed";
export type SkillOperationType = "learn" | "replace" | "lock" | "unlock" | "protect_learn";

export interface SkillDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  tier: SkillTier;
  category: SkillCategory;
  isCore: boolean;
  maxLevel: number;
  requiredAgentLevel: number;
  effectType: string | null;
  effectConfig: Record<string, unknown>;
  status: SkillDefinitionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LearnedSkill {
  id: string;
  agentId: string;
  skillDefinitionId: string;
  skillCode: string;
  skillName: string;
  skillTier: SkillTier;
  skillCategory: SkillCategory;
  skillDescription: string | null;
  skillLevel: number;
  slotIndex: number;
  locked: boolean;
  status: LearnedSkillStatus;
  sourceInventoryItemId: string | null;
  replacedByLearnedSkillId: string | null;
  replacedAt: string | null;
  learnedAt: string;
  updatedAt: string;
}

export interface SkillOperationResult {
  operationId: string;
  learnedSkill: LearnedSkill | null;
  replacedSkill: LearnedSkill | null;
  consumedCard: boolean;
  consumedProtectionToken: boolean;
  skillSlotUsed: number;
}

export interface SkillEvent {
  id: string;
  userId: string;
  agentId: string;
  eventType: SkillEventType;
  skillDefinitionId: string | null;
  replacedSkillDefinitionId: string | null;
  inventoryItemId: string | null;
  slotIndex: number | null;
  operationId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

export interface AgentSkillCapability {
  researchDepth: number;
  sourceLimit: number;
  summaryDepth: number;
  contentModes: string[];
  supportedLanguages: string[];
  supportedChannels: string[];
  audienceTargetingLevel: number;
  verificationLevel: number;
  riskChecks: string[];
  onchainReadLevel: number;
  contractAnalysisLevel: number;
}

export interface AgentSkillSlots {
  total: number;
  used: number;
  free: number;
  maxReplaceable: number;
}

// =====================================================================
// PR #6 — Skill Economy Loop types
// =====================================================================

export type SkillEconomyEventType =
  | 'skill_box_draw'
  | 'reset'
  | 'upgrade'
  | 'synthesis_input_consumed'
  | 'synthesis_result'
  | 'pity_incremented'
  | 'pity_triggered';

export type SynthesisType = 'normal_to_advanced' | 'advanced_to_expert';

export interface SkillEconomyEvent {
  id: string;
  userId: string;
  agentId: string | null;
  eventType: SkillEconomyEventType;
  boxOpeningId: string | null;
  learnedSkillId: string | null;
  inventoryItemId: string | null;
  slotIndex: number | null;
  rollInteger: number | null;
  weightTotal: number | null;
  selectedRange: string | null;
  selectedRewardType: string | null;
  selectedSkillDefinitionId: string | null;
  testOverrideUsed: boolean;
  poolCode?: string | null;
  poolVersion?: number | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  operationId?: string | null;
  createdAt: string;
}

export interface SynthesisPityStatus {
  pityCount: number;
}

export interface SkillUpgradeCost {
  currentLevel: number;
  nextLevel: number;
  gpCost: number;
  tier: string;
  tierMultiplier: number;
}
