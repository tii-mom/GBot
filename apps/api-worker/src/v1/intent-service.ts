import type {
  AgentPurchaseType,
  AgentWalletPolicy,
  AiCreditPurchaseEvidence,
  AiCreditUsageEvidence,
  AiModelTokenPurchaseIntent,
  OnchainIntentEvidence,
  OnchainIntentStatus,
  OnchainTransactionEvent,
  OnchainTransactionIntent,
  PolicyDecisionEvidence,
  PolicyGuardDecision,
  PolicyGuardReason,
  PolicyGuardInput,
  RealAssetEvidence,
  SkillCardCapabilityEvidence,
  TransactionEventEvidence,
  AssetSymbol
} from "@growthbot/shared";
import { defaultAssetBalances, toAssetAmount, zeroAssetAmount, createAssetLedgerEventDraft } from "./asset-ledger";

export const SIMULATED_EXECUTION_GUARD = {
  mode: "simulated" as const,
  liveExecution: false,
  custody: false,
  mainWalletControl: false
};

function intentId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function numericAmount(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function simulatePolicyGuardDecision(input: PolicyGuardInput): PolicyGuardDecision {
  const reasons: PolicyGuardReason[] = [];
  const amount = numericAmount(input.amount.amount);
  const perTransactionLimit = numericAmount(input.policy.perTransactionLimit.amount);
  const dailyLimit = numericAmount(input.policy.dailyLimit.amount);
  const dailySpendSoFar = numericAmount(input.dailySpendSoFar?.amount ?? 0);

  if (input.policy.adminGlobalPause) reasons.push("admin_global_pause");
  if (input.policy.userPaused) reasons.push("user_paused");
  if (!input.policy.allowedAssets.includes(input.asset)) reasons.push("asset_not_allowed");
  if (input.contractAddress && input.policy.allowedContracts.length > 0 && !input.policy.allowedContracts.includes(input.contractAddress)) reasons.push("contract_not_allowed");
  if (input.provider && input.policy.allowedProviders.length > 0 && !input.policy.allowedProviders.includes(input.provider)) reasons.push("provider_not_allowed");
  if (input.purchaseType && !input.policy.allowedPurchaseTypes.includes(input.purchaseType)) reasons.push("purchase_type_not_allowed");
  if (perTransactionLimit >= 0 && amount > perTransactionLimit) reasons.push("per_transaction_limit_exceeded");
  if (dailyLimit >= 0 && dailySpendSoFar + amount > dailyLimit) reasons.push("daily_limit_exceeded");
  if (!input.policy.autoPurchaseEnabled && input.purchaseType === "ai_model_token") reasons.push("auto_purchase_disabled");

  const confirmationAbove = input.policy.requireConfirmationAbove ? numericAmount(input.policy.requireConfirmationAbove.amount) : null;
  if (confirmationAbove !== null && amount > confirmationAbove) reasons.push("confirmation_required");

  const pause = reasons.includes("admin_global_pause") || reasons.includes("user_paused");
  const requiresConfirmation = reasons.includes("confirmation_required") || reasons.includes("auto_purchase_disabled");
  const denyReasons = reasons.filter((reason) => reason !== "confirmation_required" && reason !== "auto_purchase_disabled");
  const status = pause ? "paused" : denyReasons.length > 0 ? "denied" : requiresConfirmation ? "requires_confirmation" : "allowed";

  return {
    status,
    reasons: reasons.length > 0 ? reasons : ["within_policy"],
    requiresUserConfirmation: status === "requires_confirmation",
    evaluatedAt: new Date().toISOString(),
    inputSummary: {
      ...SIMULATED_EXECUTION_GUARD,
      agentId: input.agentId,
      walletId: input.walletId,
      intentId: input.intentId,
      asset: input.asset,
      amount: input.amount.amount,
      provider: input.provider,
      contractAddress: input.contractAddress,
      purchaseType: input.purchaseType
    }
  };
}

export function createOnchainIntentDraft(input: {
  userId: string;
  agentId: string;
  walletId?: string | null;
  policy: AgentWalletPolicy;
  asset?: AssetSymbol;
  amount?: string | number;
  targetContract?: string | null;
  provider?: string | null;
  purchaseType?: AgentPurchaseType | null;
  purpose?: string;
}): OnchainTransactionIntent {
  const id = intentId("intent");
  const asset = input.asset ?? "G";
  const amount = toAssetAmount(asset, input.amount ?? "0");
  const decision = simulatePolicyGuardDecision({
    agentId: input.agentId,
    walletId: input.walletId ?? null,
    intentId: id,
    asset,
    amount,
    contractAddress: input.targetContract ?? null,
    provider: input.provider ?? null,
    purchaseType: input.purchaseType ?? null,
    policy: input.policy,
    currentBalances: defaultAssetBalances(),
    dailySpendSoFar: toAssetAmount(asset, "0")
  });
  const status: OnchainIntentStatus = decision.status === "allowed"
    ? "allowed"
    : decision.status === "paused"
      ? "paused"
      : decision.status === "requires_confirmation"
        ? "proposed"
        : "denied";
  const now = new Date().toISOString();

  return {
    id,
    userId: input.userId,
    agentId: input.agentId,
    walletId: input.walletId ?? null,
    status,
    asset,
    amount,
    targetContract: input.targetContract ?? null,
    provider: input.provider ?? null,
    purchaseType: input.purchaseType ?? null,
    purpose: input.purpose ?? "simulated_intent",
    policyDecision: decision,
    createdAt: now,
    updatedAt: now
  };
}

export function createPurchaseIntentDraft(input: Parameters<typeof createOnchainIntentDraft>[0]): OnchainTransactionIntent {
  return createOnchainIntentDraft({ ...input, purchaseType: input.purchaseType ?? "ai_model_token", purpose: input.purpose ?? "simulated_purchase_intent" });
}

export function createTransactionEventDraft(input: {
  intent: OnchainTransactionIntent;
  status?: OnchainIntentStatus;
  message?: string | null;
}): OnchainTransactionEvent {
  return {
    id: intentId("txevt"),
    intentId: input.intent.id,
    status: input.status ?? input.intent.status,
    txHash: null,
    message: input.message ?? "Simulated policy/audit event. No live chain transaction was executed.",
    metadata: {
      ...SIMULATED_EXECUTION_GUARD,
      assetLedgerEvent: createAssetLedgerEventDraft({
        userId: input.intent.userId,
        agentId: input.intent.agentId,
        walletId: input.intent.walletId,
        relatedIntentId: input.intent.id,
        asset: input.intent.asset,
        amount: input.intent.amount.amount,
        eventType: "audit"
      })
    },
    createdAt: new Date().toISOString()
  };
}

export function createAiModelTokenPurchaseIntentDraft(input: {
  userId: string;
  agentId: string;
  walletId?: string | null;
  policy: AgentWalletPolicy;
  productId?: string;
  provider?: string;
  modelId?: string;
  spendAmount?: string | number;
  expectedCredits?: string | number;
}): AiModelTokenPurchaseIntent {
  const onchainIntent = createPurchaseIntentDraft({
    userId: input.userId,
    agentId: input.agentId,
    walletId: input.walletId ?? null,
    policy: input.policy,
    asset: "G",
    amount: input.spendAmount ?? "0",
    provider: input.provider ?? "simulated-provider",
    purchaseType: "ai_model_token",
    purpose: "simulated_ai_model_token_purchase"
  });
  const now = new Date().toISOString();
  const status = onchainIntent.policyDecision?.status === "allowed"
    ? "allowed"
    : onchainIntent.policyDecision?.status === "requires_confirmation"
      ? "proposed"
      : onchainIntent.policyDecision?.status === "paused"
        ? "denied"
        : "denied";

  return {
    id: intentId("ai_purchase"),
    userId: input.userId,
    agentId: input.agentId,
    walletId: input.walletId ?? null,
    productId: input.productId ?? "simulated-ai-credit-pack",
    provider: input.provider ?? "simulated-provider",
    modelId: input.modelId ?? "simulated-model",
    spend: toAssetAmount("G", input.spendAmount ?? "0"),
    expectedCredits: toAssetAmount("AI_CREDIT", input.expectedCredits ?? "0"),
    status,
    policyDecision: onchainIntent.policyDecision,
    relatedOnchainIntentId: onchainIntent.id,
    createdAt: now,
    updatedAt: now
  };
}

export function purchaseIntentSummaryDraft() {
  return { proposed: 0, allowed: 0, denied: 0, queued: 0, executing: 0, succeeded: 0, failed: 0, cancelled: 0, paused: 0 };
}

function evidenceCreatedAt(input?: { createdAt?: string | null; fallback?: string | null }): string {
  return input?.createdAt || input?.fallback || "1970-01-01T00:00:00.000Z";
}

function auditMetadata(extra: Record<string, unknown> = {}) {
  return {
    ...SIMULATED_EXECUTION_GUARD,
    simulationOnly: true,
    liveExecution: false,
    privateKeyRequired: false,
    mainWalletControl: false,
    auditVersion: "real_asset_work_report_evidence_v1",
    ...extra
  };
}

export function policyDecisionEvidenceDraft(input: {
  onchainIntent?: OnchainTransactionIntent | null;
  createdAt?: string | null;
}): PolicyDecisionEvidence {
  const decision = input.onchainIntent?.policyDecision ?? null;
  return {
    type: "policy_decision",
    title: "Policy Guard decision evidence",
    status: decision?.status ?? "simulated",
    summary: decision
      ? `Policy Guard evaluated the simulated ${input.onchainIntent?.purchaseType || "real-asset"} intent as ${decision.status}.`
      : "Policy Guard evidence placeholder for a simulated Work Report.",
    relatedIntentId: input.onchainIntent?.id ?? null,
    asset: input.onchainIntent?.asset ?? null,
    amount: input.onchainIntent?.amount ?? null,
    provider: input.onchainIntent?.provider ?? null,
    createdAt: evidenceCreatedAt({ createdAt: input.createdAt, fallback: input.onchainIntent?.createdAt }),
    metadata: auditMetadata({ decision, reasons: decision?.reasons ?? [], source: "work_report_evidence_draft" }) as unknown as PolicyDecisionEvidence["metadata"]
  };
}

export function onchainIntentEvidenceDraft(input: {
  onchainIntent?: OnchainTransactionIntent | null;
  createdAt?: string | null;
}): OnchainIntentEvidence {
  return {
    type: "onchain_intent",
    title: "Onchain intent evidence",
    status: input.onchainIntent?.status === "allowed" ? "allowed" : input.onchainIntent?.status === "denied" ? "denied" : "proposed",
    summary: input.onchainIntent
      ? `Simulated intent recorded for ${input.onchainIntent.asset} ${input.onchainIntent.amount.amount}; no chain transaction was executed.`
      : "No live onchain intent exists yet; this report keeps a simulated intent placeholder.",
    relatedIntentId: input.onchainIntent?.id ?? null,
    asset: input.onchainIntent?.asset ?? null,
    amount: input.onchainIntent?.amount ?? null,
    provider: input.onchainIntent?.provider ?? null,
    createdAt: evidenceCreatedAt({ createdAt: input.createdAt, fallback: input.onchainIntent?.createdAt }),
    metadata: auditMetadata({ purpose: input.onchainIntent?.purpose ?? "simulated_work_report_intent" })
  };
}

export function aiCreditPurchaseEvidenceDraft(input: {
  aiPurchaseIntent?: AiModelTokenPurchaseIntent | null;
  createdAt?: string | null;
}): AiCreditPurchaseEvidence {
  const purchase = input.aiPurchaseIntent;
  return {
    type: "ai_credit_purchase",
    title: "AI Model Token purchase intent evidence",
    status: purchase?.status === "allowed" ? "allowed" : purchase?.status === "denied" ? "denied" : "proposed",
    summary: purchase
      ? `Agent prepared a simulated ${purchase.provider}/${purchase.modelId} AI Credit purchase intent under wallet policy limits.`
      : "AI Credit purchase evidence placeholder; no provider charge or chain transaction was executed.",
    relatedPurchaseIntentId: purchase?.id ?? null,
    relatedIntentId: purchase?.relatedOnchainIntentId ?? null,
    asset: "G",
    amount: purchase?.spend ?? zeroAssetAmount("G"),
    provider: purchase?.provider ?? null,
    modelId: purchase?.modelId ?? null,
    createdAt: evidenceCreatedAt({ createdAt: input.createdAt, fallback: purchase?.createdAt }),
    metadata: auditMetadata({ expectedCredits: purchase?.expectedCredits ?? zeroAssetAmount("AI_CREDIT"), purchaseStatus: purchase?.status ?? "placeholder" })
  };
}

export function aiCreditUsageEvidenceDraft(input: {
  runId?: string | null;
  purchaseIntentId?: string | null;
  provider?: string | null;
  modelId?: string | null;
  amount?: string | number;
  createdAt?: string | null;
}): AiCreditUsageEvidence {
  const amount = toAssetAmount("AI_CREDIT", input.amount ?? "0");
  return {
    type: "ai_credit_usage",
    title: "AI Credit usage evidence",
    status: "recorded",
    summary: `AI Credit usage was recorded for Work Run ${input.runId || "unknown"} in simulation-only mode.`,
    relatedPurchaseIntentId: input.purchaseIntentId ?? null,
    asset: "AI_CREDIT",
    amount,
    provider: input.provider ?? "simulated-provider",
    modelId: input.modelId ?? "simulated-model",
    createdAt: evidenceCreatedAt({ createdAt: input.createdAt }),
    metadata: auditMetadata({ workRunId: input.runId ?? null, usageEventSource: "work_report_draft" })
  };
}

export function skillCardCapabilityEvidenceDraft(input: {
  skillCards?: string[];
  createdAt?: string | null;
}): SkillCardCapabilityEvidence {
  const skillCards = input.skillCards?.length ? input.skillCards : ["project_research", "source_verification", "budget_management"];
  return {
    type: "skill_card_capability",
    title: "Skill Card capability contribution evidence",
    status: "observed",
    summary: `${skillCards.length} Skill Card capability code(s) contributed to the simulated Work Report evidence path.`,
    skillCardCodes: skillCards,
    createdAt: evidenceCreatedAt({ createdAt: input.createdAt }),
    metadata: auditMetadata({ totalCanonicalCards: 31, capabilitySource: "agent_learned_skills_or_default_simulation" })
  };
}

export function futureTransactionEvidenceDraft(input: {
  onchainIntent?: OnchainTransactionIntent | null;
  transactionEvent?: OnchainTransactionEvent | null;
  createdAt?: string | null;
}): TransactionEventEvidence {
  return {
    type: input.transactionEvent ? "transaction_event" : "future_transaction_placeholder",
    title: input.transactionEvent ? "Transaction event evidence" : "Future transaction evidence placeholder",
    status: input.transactionEvent?.txHash ? "observed" : "placeholder",
    summary: input.transactionEvent?.txHash
      ? "Live transaction evidence was observed and linked to the intent."
      : "Future live chain reports must attach tx hash, transaction status, and policy decision evidence; this draft executed no transaction.",
    relatedIntentId: input.onchainIntent?.id ?? input.transactionEvent?.intentId ?? null,
    relatedTransactionId: input.transactionEvent?.id ?? null,
    asset: input.onchainIntent?.asset ?? null,
    amount: input.onchainIntent?.amount ?? null,
    createdAt: evidenceCreatedAt({ createdAt: input.createdAt, fallback: input.transactionEvent?.createdAt ?? input.onchainIntent?.createdAt }),
    metadata: auditMetadata({ txHash: input.transactionEvent?.txHash ?? null, liveTxRequiredForFutureReports: true })
  };
}

export function workReportEvidenceDraft(input: {
  onchainIntent?: OnchainTransactionIntent | null;
  transactionEvent?: OnchainTransactionEvent | null;
  aiPurchaseIntent?: AiModelTokenPurchaseIntent | null;
  skillCards?: string[];
  runId?: string | null;
  createdAt?: string | null;
}): RealAssetEvidence[] {
  const createdAt = evidenceCreatedAt({ createdAt: input.createdAt, fallback: input.onchainIntent?.createdAt });
  return [
    policyDecisionEvidenceDraft({ onchainIntent: input.onchainIntent ?? null, createdAt }),
    onchainIntentEvidenceDraft({ onchainIntent: input.onchainIntent ?? null, createdAt }),
    aiCreditPurchaseEvidenceDraft({ aiPurchaseIntent: input.aiPurchaseIntent ?? null, createdAt }),
    aiCreditUsageEvidenceDraft({
      runId: input.runId ?? null,
      purchaseIntentId: input.aiPurchaseIntent?.id ?? null,
      provider: input.aiPurchaseIntent?.provider ?? input.onchainIntent?.provider ?? null,
      modelId: input.aiPurchaseIntent?.modelId ?? null,
      amount: input.aiPurchaseIntent?.expectedCredits.amount ?? "0",
      createdAt
    }),
    skillCardCapabilityEvidenceDraft({ skillCards: input.skillCards ?? [], createdAt }),
    futureTransactionEvidenceDraft({ onchainIntent: input.onchainIntent ?? null, transactionEvent: input.transactionEvent ?? null, createdAt }),
    {
      type: "legacy_settlement_compatibility",
      title: "Legacy GP settlement compatibility",
      status: "compatibility",
      summary: "Legacy GP settlement fields are retained for existing clients but are not the primary Work Report success metric.",
      createdAt,
      metadata: auditMetadata({ compatibilityField: "settlement", futureCleanup: "GP_REMOVAL_PLAN" })
    }
  ];
}
