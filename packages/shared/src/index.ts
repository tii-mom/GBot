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
  /** Stable product-facing Agent number. Display name changes must not mutate this value. */
  displayNo?: string;
  agentNo?: string;
  serialNo?: string;
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
  bubbleEditionKey?: string;
  displayNo?: string;
  naturalSkillCodes?: string[];
  equippedAsCurrentBubble?: boolean;
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

export type BountyOpportunitySource =
  | "gbot"
  | "okx_ai"
  | "algora"
  | "github"
  | "bountycaster"
  | "zealy"
  | "layer3"
  | "external";

export type BountyOpportunityAutomationMode = "recommend_only" | "user_confirm" | "auto_execute" | "blocked";
export type BountyOpportunitySettlementTarget = "user_wallet" | "user_platform_account" | "gbot_internal";
export type BountyOpportunityPayoutCustody = "never_platform_custody" | "gbot_escrow_for_internal_only";
export type BountyOpportunityRiskLevel = "low" | "medium" | "high";
export type BountyOpportunityStatus = "active" | "paused" | "completed";

export interface BountyOpportunity {
  id: string;
  source: BountyOpportunitySource;
  platform: string;
  externalTaskId?: string | null;
  localTaskId?: string | null;
  title: string;
  summary: string;
  rewardDisplay: string;
  rewardAsset?: string | null;
  rewardAmountUsdEstimate?: number | null;
  fuelCostG: number;
  aiCreditEstimate: number;
  successProbability: number;
  riskLevel: BountyOpportunityRiskLevel;
  automationMode: BountyOpportunityAutomationMode;
  settlementTarget: BountyOpportunitySettlementTarget;
  payoutCustody: BountyOpportunityPayoutCustody;
  requiredSkills: string[];
  evidenceRequirements: string[];
  platformRulesUrl?: string | null;
  targetUrl?: string | null;
  deadline?: string | null;
  status: BountyOpportunityStatus;
  createdAt?: string;
  updatedAt?: string;
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
  | "requires_confirmation"
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
  persistence: "db" | "fallback" | "simulated";
  persistenceError: string | null;
  review: {
    reviewer: string;
    notes: string | null;
    metadata: Record<string, unknown> | null;
  };
}

export type ExecutorReadinessStatus = "blocked" | "ready_for_testnet_pr" | "not_applicable";
export type ExecutorReadinessGateStatus = "pass" | "warning" | "fail";
export type ExecutorReadinessGateKey =
  | "db_policy_persistence"
  | "durable_intent_ledger"
  | "durable_audit_log"
  | "tx_status_tracker"
  | "admin_review_queue"
  | "global_pause"
  | "rollback_runbook"
  | "testnet_boundary"
  | "no_private_key_storage"
  | "no_seed_phrase_storage"
  | "no_mnemonic_storage"
  | "no_main_wallet_control"
  | "no_live_execution";

export interface ExecutorReadinessGate {
  key: ExecutorReadinessGateKey;
  status: ExecutorReadinessGateStatus;
  title: string;
  summary: string;
  evidence: string;
  requiredBeforeTestnetExecutor: boolean;
  updatedAt: string;
}

export interface GlobalPauseReadiness {
  readable: boolean;
  auditable: boolean;
  currentStatus: "active" | "paused";
  summary: string;
}

export interface RollbackReadinessSummary {
  status: ExecutorReadinessGateStatus;
  runbookPath: string;
  stopConditionsDocumented: boolean;
  reconciliationDocumented: boolean;
  auditCollectionDocumented: boolean;
  summary: string;
}

export type TxStatusTrackerLifecycleStatus =
  | "not_started"
  | "intent_created"
  | "awaiting_admin_review"
  | "approved_for_future_testnet"
  | "submitted_testnet_placeholder"
  | "pending_confirmation"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "blocked";

export interface TxStatusTrackerEventDraft {
  id: string;
  intentId: string | null;
  purchaseIntentId: string | null;
  status: TxStatusTrackerLifecycleStatus;
  title: string;
  summary: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface TxStatusTrackerSummary {
  mode: "simulated";
  liveExecution: false;
  custody: false;
  mainWalletControl: false;
  executorEnabled: false;
  testnetExecutorEnabled: false;
  liveExecutorEnabled: false;
  trackerStatus: ExecutorReadinessGateStatus;
  chain: "TON";
  network: "testnet_simulated";
  statusesSupported: TxStatusTrackerLifecycleStatus[];
  events: TxStatusTrackerEventDraft[];
  summary: string;
  nextRequiredImplementation: string[];
  updatedAt: string;
}

export interface ExecutorReadinessSummary {
  mode: "simulated";
  liveExecution: false;
  custody: false;
  mainWalletControl: false;
  executorEnabled: false;
  testnetExecutorEnabled: false;
  liveExecutorEnabled: false;
  overallStatus: ExecutorReadinessStatus;
  gates: ExecutorReadinessGate[];
  txStatusTracker: TxStatusTrackerSummary;
  globalPause: GlobalPauseReadiness;
  rollbackReadiness: RollbackReadinessSummary;
  generatedAt: string;
  nextAllowedStep: "complete_readiness_gates" | "prepare_future_testnet_executor_pr" | "do_not_start_executor";
  blockedReasons: string[];
  safetyFlags: string[];
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
// Bubble Agent commercial operations shared config
// =====================================================================

export type BubbleMintStatus = "unminted" | "minting" | "minted" | "failed";
export type BubbleAgentRarity = "Starter" | "Common" | "Rare" | "Epic" | "Genesis";
export type BubbleNaturalSkillTier = "Common" | "Advanced" | "Expert";

export interface BubbleNaturalSkillConfig {
  code: string;
  name: string;
  tier: BubbleNaturalSkillTier;
  desc: string;
}

export interface BubbleEditionConfig {
  key: string;
  name: string;
  rarity: BubbleAgentRarity;
  colorGene: string;
  source: string;
  note: string;
  className: string;
  naturalSkills: BubbleNaturalSkillConfig[];
  frameLabel: string;
}

export interface BubbleBlindBoxPoolItem {
  itemId: string;
  label: string;
  itemType: "skill" | "bubble_agent" | "cosmetic" | "motion_pack" | "frame";
  rarity: BubbleAgentRarity | "Legendary" | "Cosmetic";
  weight: number;
  enabled: boolean;
  desc: string;
}

export interface BubblePassportSyncStatus {
  displayNo: string;
  status: BubbleMintStatus;
  ownerState: "app_asset" | "pending_chain_index" | "synced_to_holder" | "claim_required";
  chain?: "TON" | "EVM";
  tokenId?: string | null;
  lastIndexedAt?: string | null;
  note: string;
}

export interface BubblePassportMintRequest {
  agentId: string;
  displayNo: string;
  inventoryItemId?: string | null;
  series?: string | null;
  rarity?: string | null;
  chain?: "TON" | "EVM";
}

export interface BubblePassportMintResponse {
  displayNo: string;
  mintStatus: BubbleMintStatus;
  ownerState: BubblePassportSyncStatus["ownerState"];
  chain: "TON" | "EVM";
  tokenId?: string | null;
  requestedAt: string;
  message: string;
}

export interface BubblePassportStatusRecord {
  displayNo: string;
  mintStatus: BubbleMintStatus;
  ownerState: BubblePassportSyncStatus["ownerState"];
  agentId?: string;
  inventoryItemId?: string | null;
  series?: string | null;
  rarity?: string | null;
  chain: "TON" | "EVM";
  tokenId?: string | null;
  walletAddress?: string | null;
  requestCount?: number;
  lastRequestedAt?: string | null;
  mintedAt?: string | null;
  lastIndexedAt?: string | null;
  failureReason?: string | null;
  updatedAt?: string | null;
}

export interface BubblePassportStatusResponse {
  passport: BubblePassportStatusRecord;
}

export interface BubblePassportEventRecord {
  id: string;
  displayNo: string;
  eventType: string;
  beforeStatus?: BubbleMintStatus | null;
  afterStatus: BubbleMintStatus;
  ownerState: BubblePassportSyncStatus["ownerState"];
  chain: "TON" | "EVM";
  tokenId?: string | null;
  createdAt: string;
}

export interface AdminBubblePassportConsoleResponse {
  generatedAt: string;
  totals: {
    total: number;
    unminted: number;
    minting: number;
    minted: number;
    failed: number;
  };
  passports: BubblePassportStatusRecord[];
  events: BubblePassportEventRecord[];
}

export interface BubbleShareSurfaceConfig {
  key: "agent_home" | "work_report" | "bubble_codex" | "guild_wall" | "passport_card";
  label: string;
  status: "active" | "draft" | "paused";
  defaultText: string;
}

export interface BubbleBoxOpenReward {
  type: "skill" | "bubble_agent" | "cosmetic" | "motion_pack" | "frame" | "pending_points" | "energy" | "ability";
  name: string;
  amount?: number;
  itemId?: string;
  rarity?: BubbleAgentRarity | Rarity | "Legendary" | "Cosmetic";
  category?: ItemCategory | "bubble_agent" | "motion_pack" | "frame";
  bubbleEditionKey?: string;
  displayNo?: string;
  naturalSkillCodes?: string[];
}

export interface BubbleBoxOpenResult {
  openingId: string;
  box: { id: string; name: string };
  rewards: BubbleBoxOpenReward[];
  agent?: Agent;
}

export interface BubbleAgentOpsConfig {
  version: "bubble_ops_v1";
  source: "shared_static_v1" | "api_static_v1" | "api_dynamic_v1";
  generatedAt: string;
  editions: readonly BubbleEditionConfig[];
  blindBoxPool: readonly BubbleBlindBoxPoolItem[];
  passportSyncPreview: readonly BubblePassportSyncStatus[];
  shareSurfaces: readonly BubbleShareSurfaceConfig[];
}

export const GBOT_BUBBLE_EDITIONS: readonly BubbleEditionConfig[] = [
  {
    key: "common-gray",
    name: "烟灰泥泡泡",
    rarity: "Common",
    colorGene: "烟灰泥泡泡",
    source: "注册默认获得",
    note: "基础款，初始无天生技能，拥有 4 个可装配槽。",
    className: "gray",
    naturalSkills: [],
    frameLabel: "默认泥框"
  },
  {
    key: "black-gold",
    name: "黑金泥泡泡",
    rarity: "Rare",
    colorGene: "黑金泥泡泡",
    source: "技能盲盒 / 活动",
    note: "经典特别版，冷脸黑金质感，适合主线展示。",
    className: "black-gold",
    naturalSkills: [
      {
        code: "cool_module",
        name: "冷静模块",
        tier: "Advanced",
        desc: "天生携带高级策略标签，影响战报风格与行动展示"
      }
    ],
    frameLabel: "黑金底框"
  },
  {
    key: "blue",
    name: "冰蓝泥泡泡",
    rarity: "Rare",
    colorGene: "冰蓝泥泡泡",
    source: "技能盲盒 / 活动",
    note: "数据感更强，适合线索整理和分析向展示。",
    className: "blue",
    naturalSkills: [
      {
        code: "data_lens",
        name: "数据镜片",
        tier: "Advanced",
        desc: "天生携带高级分析标签，偏向数据化展示"
      }
    ],
    frameLabel: "冰蓝底框"
  },
  {
    key: "purple",
    name: "暗紫泥泡泡",
    rarity: "Epic",
    colorGene: "暗紫泥泡泡",
    source: "技能盲盒 / 活动",
    note: "偏暗线观察与风险标记，适合稀有展示墙。",
    className: "purple",
    naturalSkills: [
      {
        code: "dark_observe",
        name: "暗线观察",
        tier: "Advanced",
        desc: "天生携带高级观察标签，偏向链上信号叙事"
      },
      {
        code: "silent_check",
        name: "静默校验",
        tier: "Advanced",
        desc: "天生携带校验展示标签，用于战报信息层级"
      }
    ],
    frameLabel: "暗紫底框"
  },
  {
    key: "red",
    name: "赤金泥泡泡",
    rarity: "Epic",
    colorGene: "赤金泥泡泡",
    source: "技能盲盒 / 活动",
    note: "节奏更强的特别款，适合任务出勤截图。",
    className: "red",
    naturalSkills: [
      {
        code: "fast_echo",
        name: "快速回声",
        tier: "Advanced",
        desc: "天生携带高级行动标签，偏向节奏感展示"
      },
      {
        code: "route_memory",
        name: "路线记忆",
        tier: "Advanced",
        desc: "天生携带路线展示标签，用于任务地图表现"
      }
    ],
    frameLabel: "赤金底框"
  },
  {
    key: "silver",
    name: "白银泥泡泡",
    rarity: "Genesis",
    colorGene: "白银泥泡泡",
    source: "纪念系列",
    note: "Genesis 纪念身份展示，拥有 1-3 个固化标签。",
    className: "silver",
    naturalSkills: [
      {
        code: "genesis_stamp",
        name: "Genesis 印记",
        tier: "Expert",
        desc: "天生携带专家纪念标签，用于身份展示与专属战报语气"
      },
      {
        code: "silver_archive",
        name: "白银档案",
        tier: "Expert",
        desc: "天生携带纪念档案标签，用于收藏展示"
      },
      {
        code: "origin_frame",
        name: "原初边框",
        tier: "Advanced",
        desc: "天生携带专属舞台框展示标签"
      }
    ],
    frameLabel: "白银底框"
  }
] as const;

export const GBOT_BUBBLE_BLIND_BOX_POOL: readonly BubbleBlindBoxPoolItem[] = [
  { itemId: "skill_common_card", label: "普通技能卡", itemType: "skill", rarity: "Common", weight: 6200, enabled: true, desc: "补齐基础打工能力" },
  { itemId: "skill_advanced_card", label: "高级技能卡", itemType: "skill", rarity: "Rare", weight: 1900, enabled: true, desc: "扩展任务选择空间" },
  { itemId: "skill_expert_card", label: "专家技能卡", itemType: "skill", rarity: "Epic", weight: 520, enabled: true, desc: "解锁更复杂的战报能力" },
  { itemId: "bubble_black_gold", label: "黑金泥泡泡", itemType: "bubble_agent", rarity: "Rare", weight: 260, enabled: true, desc: "特别版泡泡，天生冷静模块" },
  { itemId: "bubble_blue", label: "冰蓝泥泡泡", itemType: "bubble_agent", rarity: "Rare", weight: 220, enabled: true, desc: "特别版泡泡，天生数据镜片" },
  { itemId: "bubble_purple", label: "暗紫泥泡泡", itemType: "bubble_agent", rarity: "Epic", weight: 90, enabled: true, desc: "特别版泡泡，天生 2 个高级标签" },
  { itemId: "bubble_red", label: "赤金泥泡泡", itemType: "bubble_agent", rarity: "Epic", weight: 90, enabled: true, desc: "特别版泡泡，天生 2 个高级标签" },
  { itemId: "bubble_silver", label: "白银泥泡泡", itemType: "bubble_agent", rarity: "Genesis", weight: 12, enabled: true, desc: "Genesis 纪念泡泡，天生 1-3 个固化标签" },
  { itemId: "motion_pack_dark_slime", label: "泥泡泡动作包", itemType: "motion_pack", rarity: "Cosmetic", weight: 420, enabled: true, desc: "改变待机、点击和出勤动作表现" },
  { itemId: "frame_pack_color", label: "专属底框", itemType: "frame", rarity: "Cosmetic", weight: 288, enabled: true, desc: "泡泡对应颜色舞台底框" }
] as const;

export const GBOT_BUBBLE_PASSPORT_SYNC_PREVIEW: readonly BubblePassportSyncStatus[] = [
  {
    displayNo: "GBOT-780552",
    status: "unminted",
    ownerState: "app_asset",
    chain: "TON",
    tokenId: null,
    lastIndexedAt: null,
    note: "应用内资产，用户可选择自愿铸造 Passport。"
  },
  {
    displayNo: "GBOT-000888",
    status: "minting",
    ownerState: "pending_chain_index",
    chain: "TON",
    tokenId: null,
    lastIndexedAt: null,
    note: "用户已发起铸造，等待链上确认与索引同步。"
  },
  {
    displayNo: "GBOT-001999",
    status: "minted",
    ownerState: "synced_to_holder",
    chain: "TON",
    tokenId: "Passport-#1999",
    lastIndexedAt: "2026-07-01T04:20:00Z",
    note: "链上 Passport 已同步到当前绑定钱包。"
  },
  {
    displayNo: "GBOT-006666",
    status: "failed",
    ownerState: "claim_required",
    chain: "TON",
    tokenId: null,
    lastIndexedAt: "2026-07-01T04:10:00Z",
    note: "铸造流程未完成，用户可重新发起或联系客服。"
  }
] as const;

export const GBOT_BUBBLE_SHARE_SURFACES: readonly BubbleShareSurfaceConfig[] = [
  {
    key: "agent_home",
    label: "首页编号泡泡",
    status: "active",
    defaultText: "我的 GBot 泥泡泡 Agent 正在外出整理候选机会。"
  },
  {
    key: "work_report",
    label: "任务战报",
    status: "active",
    defaultText: "这是一份 GBot Agent 可验证战报，候选结果需验收后结算。"
  },
  {
    key: "bubble_codex",
    label: "泡泡图鉴",
    status: "active",
    defaultText: "特别版泥泡泡拥有外观、底框和天生标签差异。"
  },
  {
    key: "guild_wall",
    label: "公会展示墙",
    status: "active",
    defaultText: "来公会展示墙看看大家的编号泡泡和战报。"
  },
  {
    key: "passport_card",
    label: "Passport 铭牌",
    status: "draft",
    defaultText: "用户可自愿将应用内泡泡铸造为 Agent Passport。"
  }
] as const;

export const GBOT_BUBBLE_AGENT_OPS_CONFIG: BubbleAgentOpsConfig = {
  version: "bubble_ops_v1",
  source: "shared_static_v1",
  generatedAt: "2026-07-01T00:00:00.000Z",
  editions: GBOT_BUBBLE_EDITIONS,
  blindBoxPool: GBOT_BUBBLE_BLIND_BOX_POOL,
  passportSyncPreview: GBOT_BUBBLE_PASSPORT_SYNC_PREVIEW,
  shareSurfaces: GBOT_BUBBLE_SHARE_SURFACES
} as const;

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
export type SkillCategory = "research" | "content" | "social" | "verification" | "onchain" | "automation" | "business";
export type SkillDefinitionStatus = "enabled" | "deprecated" | "disabled";
export type LearnedSkillStatus = "active" | "replaced" | "disabled";
export type SkillEventType = "learn" | "replace_random" | "lock" | "unlock" | "protect" | "consume_card" | "consume_protection_token" | "replace_skill_executed";
export type SkillOperationType = "learn" | "replace" | "lock" | "unlock" | "protect_learn";

export interface AgentRuntimeEffect {
  canSign: boolean;
  canBroadcast: boolean;
  canTakeCustody: boolean;
  canControlUserMainWallet: boolean;
  requiresAdminReview: boolean;
}

export interface SkillRuntimeSpec {
  id: string;
  key: string;
  name: string;
  tier: SkillTier;
  displaySummary: string;
  purpose: string;
  useWhen: string;
  doNotUseWhen: string;
  requiredInputs: string[];
  executionSteps: string[];
  outputFormat: string[];
  evidenceRequired: string[];
  safetyBoundary: string[];
  agentRuntimeEffect: AgentRuntimeEffect;
  adminReviewPolicy: string;
  workReportSections: string[];
}

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
