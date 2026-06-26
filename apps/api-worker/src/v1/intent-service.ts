import type {
  AgentPurchaseType,
  AgentWalletPolicy,
  AiModelTokenPurchaseIntent,
  OnchainIntentStatus,
  OnchainTransactionEvent,
  OnchainTransactionIntent,
  PolicyGuardDecision,
  PolicyGuardReason,
  PolicyGuardInput,
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

export function workReportEvidenceDraft(input: {
  onchainIntent?: OnchainTransactionIntent | null;
  transactionEvent?: OnchainTransactionEvent | null;
  aiPurchaseIntent?: AiModelTokenPurchaseIntent | null;
  skillCards?: string[];
}) {
  return [
    {
      type: "policy_decision",
      ...SIMULATED_EXECUTION_GUARD,
      intentId: input.onchainIntent?.id ?? null,
      decision: input.onchainIntent?.policyDecision ?? null
    },
    {
      type: "transaction_event",
      ...SIMULATED_EXECUTION_GUARD,
      event: input.transactionEvent ?? null
    },
    {
      type: "ai_credit_purchase",
      ...SIMULATED_EXECUTION_GUARD,
      purchaseIntent: input.aiPurchaseIntent ?? null
    },
    {
      type: "ai_credit_usage",
      ...SIMULATED_EXECUTION_GUARD,
      usage: { amount: zeroAssetAmount("AI_CREDIT"), evidenceRef: null }
    },
    {
      type: "skill_card_capability",
      ...SIMULATED_EXECUTION_GUARD,
      skillCards: input.skillCards ?? []
    }
  ];
}
