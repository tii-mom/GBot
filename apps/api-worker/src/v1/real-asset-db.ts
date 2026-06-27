import type {
  AdminRealAssetAuditEvent,
  AgentPurchaseType,
  AgentWalletPolicy,
  AgentWalletPolicyStatus,
  AgentWalletRiskMode,
  AgentWalletAssetSnapshot,
  AssetAmount,
  AssetBalance,
  AssetLedgerEvent,
  AssetLedgerEventType,
  AssetSymbol,
  AiCreditBalance,
  AiCreditUsageEvent,
  AiModelTokenProduct,
  AiModelTokenPurchaseIntent,
  AiModelTokenPurchaseResult,
  OnchainIntentStatus,
  OnchainTransactionEvent,
  OnchainTransactionIntent,
  PolicyGuardDecision,
  RealAssetEvidence
} from "@growthbot/shared";

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

export function intToBool(value: number | null | undefined): boolean {
  return Number(value ?? 0) !== 0;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function assetAmountToColumns(amount: AssetAmount) {
  return { asset_symbol: amount.symbol, amount: amount.amount, decimals: amount.decimals };
}

export function columnsToAssetAmount(symbol: string, amount: string, decimals: number): AssetAmount {
  return { symbol: symbol as AssetSymbol, amount, decimals };
}

export interface AgentWalletPolicyRow {
  id: string;
  user_id: string;
  agent_id: string;
  wallet_id: string | null;
  status: string;
  risk_mode: string;
  auto_purchase_enabled: number;
  per_transaction_limit_amount: string;
  per_transaction_limit_asset: string;
  daily_limit_amount: string;
  daily_limit_asset: string;
  minimum_reserve_amount: string;
  minimum_reserve_asset: string;
  allowed_assets_json: string;
  allowed_contracts_json: string;
  allowed_providers_json: string;
  allowed_purchase_types_json: string;
  require_confirmation_above_amount: string | null;
  require_confirmation_above_asset: string | null;
  admin_global_pause: number;
  user_paused: number;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletAssetSnapshotRow {
  id: string;
  user_id: string;
  agent_id: string;
  wallet_id: string;
  asset_symbol: string;
  amount: string;
  decimals: number;
  source: string;
  metadata_json: string | null;
  created_at: string;
}

export interface AssetLedgerEventRow {
  id: string;
  user_id: string;
  agent_id: string;
  wallet_id: string | null;
  event_type: string;
  asset_symbol: string;
  amount: string;
  decimals: number;
  direction: string;
  related_intent_id: string | null;
  related_transaction_id: string | null;
  related_purchase_intent_id: string | null;
  status: string;
  metadata_json: string | null;
  created_at: string;
}

export interface OnchainTransactionIntentRow {
  id: string;
  user_id: string;
  agent_id: string;
  wallet_id: string | null;
  chain: string;
  network: string;
  asset_symbol: string;
  amount: string;
  decimals: number;
  to_address: string | null;
  contract_address: string | null;
  intent_type: string;
  status: string;
  policy_decision_json: string;
  requires_confirmation: number;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnchainTransactionEventRow {
  id: string;
  user_id: string;
  agent_id: string;
  wallet_id: string | null;
  intent_id: string;
  chain: string;
  network: string;
  tx_hash: string | null;
  status: string;
  explorer_url: string | null;
  raw_event_json: string | null;
  metadata_json: string | null;
  created_at: string;
}

export interface AiModelTokenProductRow {
  id: string;
  provider: string;
  model_id: string;
  purchase_type: string;
  asset_symbol: string;
  price_amount: string;
  price_decimals: number;
  credit_amount: string;
  status: string;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiModelTokenPurchaseIntentRow {
  id: string;
  user_id: string;
  agent_id: string;
  wallet_id: string | null;
  product_id: string | null;
  provider: string;
  model_id: string;
  purchase_type: string;
  asset_symbol: string;
  amount: string;
  decimals: number;
  status: string;
  policy_decision_json: string;
  purpose: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiModelTokenPurchaseResultRow {
  id: string;
  purchase_intent_id: string;
  user_id: string;
  agent_id: string;
  provider: string;
  model_id: string;
  status: string;
  credit_asset_symbol: string;
  credit_amount: string;
  credit_decimals: number;
  related_transaction_event_id: string | null;
  metadata_json: string | null;
  created_at: string;
}

export interface AiCreditBalanceRow {
  id: string;
  user_id: string;
  agent_id: string;
  provider: string;
  model_id: string | null;
  asset_symbol: string;
  amount: string;
  decimals: number;
  metadata_json: string | null;
  updated_at: string;
}

export interface AiCreditUsageEventRow {
  id: string;
  user_id: string;
  agent_id: string;
  work_run_id: string | null;
  work_report_id: string | null;
  provider: string;
  model_id: string | null;
  asset_symbol: string;
  amount: string;
  decimals: number;
  purpose: string | null;
  metadata_json: string | null;
  created_at: string;
}

export interface WorkReportEvidenceEventRow {
  id: string;
  user_id: string;
  agent_id: string;
  work_run_id: string | null;
  work_report_id: string | null;
  evidence_type: string;
  status: string;
  title: string;
  summary: string | null;
  related_intent_id: string | null;
  related_transaction_id: string | null;
  related_purchase_intent_id: string | null;
  asset_symbol: string | null;
  amount: string | null;
  decimals: number | null;
  provider: string | null;
  model_id: string | null;
  skill_card_codes_json: string | null;
  metadata_json: string | null;
  created_at: string;
}

export interface AdminRiskAuditEventRow {
  id: string;
  event_type: string;
  actor: string;
  target_type: string;
  target_id: string;
  summary: string;
  status: string;
  metadata_json: string | null;
  created_at: string;
}

type RowContext = {
  id?: string;
  userId?: string;
  agentId?: string;
  walletId?: string | null;
  chain?: string;
  network?: string;
  source?: string;
  direction?: string;
  status?: string;
  purpose?: string | null;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown> | null;
  workRunId?: string | null;
  workReportId?: string | null;
  relatedPurchaseIntentId?: string | null;
  relatedTransactionEventId?: string | null;
  skillCardCodes?: string[];
};

export function toAgentWalletPolicyRow(policy: AgentWalletPolicy, context: RowContext & { id: string; userId: string; agentId: string }): AgentWalletPolicyRow {
  const now = context.updatedAt ?? context.createdAt ?? nowIso();
  return {
    id: context.id,
    user_id: context.userId,
    agent_id: context.agentId,
    wallet_id: context.walletId ?? null,
    status: policy.status,
    risk_mode: policy.riskMode,
    auto_purchase_enabled: boolToInt(policy.autoPurchaseEnabled),
    per_transaction_limit_amount: policy.perTransactionLimit.amount,
    per_transaction_limit_asset: policy.perTransactionLimit.symbol,
    daily_limit_amount: policy.dailyLimit.amount,
    daily_limit_asset: policy.dailyLimit.symbol,
    minimum_reserve_amount: policy.minimumReserve.amount,
    minimum_reserve_asset: policy.minimumReserve.symbol,
    allowed_assets_json: stringifyJson(policy.allowedAssets),
    allowed_contracts_json: stringifyJson(policy.allowedContracts),
    allowed_providers_json: stringifyJson(policy.allowedProviders),
    allowed_purchase_types_json: stringifyJson(policy.allowedPurchaseTypes),
    require_confirmation_above_amount: policy.requireConfirmationAbove?.amount ?? null,
    require_confirmation_above_asset: policy.requireConfirmationAbove?.symbol ?? null,
    admin_global_pause: boolToInt(policy.adminGlobalPause),
    user_paused: boolToInt(policy.userPaused),
    metadata_json: context.metadata ? stringifyJson(context.metadata) : null,
    created_at: context.createdAt ?? now,
    updated_at: now
  };
}

export function fromAgentWalletPolicyRow(row: AgentWalletPolicyRow): AgentWalletPolicy {
  return {
    autoPurchaseEnabled: intToBool(row.auto_purchase_enabled),
    perTransactionLimit: columnsToAssetAmount(row.per_transaction_limit_asset, row.per_transaction_limit_amount, 9),
    dailyLimit: columnsToAssetAmount(row.daily_limit_asset, row.daily_limit_amount, 9),
    minimumReserve: columnsToAssetAmount(row.minimum_reserve_asset, row.minimum_reserve_amount, 9),
    allowedAssets: parseJson<AssetSymbol[]>(row.allowed_assets_json, []),
    allowedContracts: parseJson<string[]>(row.allowed_contracts_json, []),
    allowedProviders: parseJson<string[]>(row.allowed_providers_json, []),
    allowedPurchaseTypes: parseJson<AgentPurchaseType[]>(row.allowed_purchase_types_json, []),
    requireConfirmationAbove: row.require_confirmation_above_amount && row.require_confirmation_above_asset ? columnsToAssetAmount(row.require_confirmation_above_asset, row.require_confirmation_above_amount, 9) : null,
    adminGlobalPause: intToBool(row.admin_global_pause),
    userPaused: intToBool(row.user_paused),
    riskMode: row.risk_mode as AgentWalletRiskMode,
    status: row.status as AgentWalletPolicyStatus
  };
}

export function toWalletAssetSnapshotRow(snapshot: AgentWalletAssetSnapshot, balance: AssetBalance, context: RowContext & { id: string; userId: string; source: string }): WalletAssetSnapshotRow {
  return { id: context.id, user_id: context.userId, agent_id: snapshot.agentId, wallet_id: snapshot.walletId, asset_symbol: balance.asset, amount: balance.total.amount, decimals: balance.total.decimals, source: context.source, metadata_json: context.metadata ? stringifyJson(context.metadata) : null, created_at: context.createdAt ?? snapshot.updatedAt ?? nowIso() };
}

export function fromWalletAssetSnapshotRow(row: WalletAssetSnapshotRow): AssetBalance {
  const amount = columnsToAssetAmount(row.asset_symbol, row.amount, row.decimals);
  return { asset: amount.symbol, available: amount, reserved: columnsToAssetAmount(row.asset_symbol, "0", row.decimals), total: amount, updatedAt: row.created_at };
}

export function toAssetLedgerEventRow(event: AssetLedgerEvent, context: RowContext & { userId?: string; direction: string; status: string }): AssetLedgerEventRow {
  return { id: event.id, user_id: context.userId ?? event.userId, agent_id: event.agentId ?? "", wallet_id: event.walletId, event_type: event.eventType, asset_symbol: event.asset, amount: event.amount.amount, decimals: event.amount.decimals, direction: context.direction, related_intent_id: event.relatedIntentId, related_transaction_id: event.relatedTransactionId, related_purchase_intent_id: context.relatedPurchaseIntentId ?? null, status: context.status, metadata_json: event.metadata ? stringifyJson(event.metadata) : null, created_at: event.createdAt };
}

export function fromAssetLedgerEventRow(row: AssetLedgerEventRow): AssetLedgerEvent {
  return { id: row.id, userId: row.user_id, agentId: row.agent_id || null, walletId: row.wallet_id, eventType: row.event_type as AssetLedgerEventType, asset: row.asset_symbol as AssetSymbol, amount: columnsToAssetAmount(row.asset_symbol, row.amount, row.decimals), relatedIntentId: row.related_intent_id, relatedTransactionId: row.related_transaction_id, metadata: parseJson<Record<string, unknown> | null>(row.metadata_json, null), createdAt: row.created_at };
}

export function toOnchainIntentRow(intent: OnchainTransactionIntent, context: RowContext = {}): OnchainTransactionIntentRow {
  return { id: intent.id, user_id: intent.userId, agent_id: intent.agentId, wallet_id: intent.walletId, chain: context.chain ?? "TON", network: context.network ?? "testnet_simulated", asset_symbol: intent.asset, amount: intent.amount.amount, decimals: intent.amount.decimals, to_address: null, contract_address: intent.targetContract, intent_type: intent.purchaseType ?? "task_execution", status: intent.status, policy_decision_json: stringifyJson(intent.policyDecision), requires_confirmation: boolToInt(Boolean(intent.policyDecision?.requiredConfirmation)), metadata_json: context.metadata ? stringifyJson(context.metadata) : null, created_at: intent.createdAt, updated_at: intent.updatedAt };
}

export function fromOnchainIntentRow(row: OnchainTransactionIntentRow): OnchainTransactionIntent {
  return { id: row.id, userId: row.user_id, agentId: row.agent_id, walletId: row.wallet_id, status: row.status as OnchainIntentStatus, asset: row.asset_symbol as AssetSymbol, amount: columnsToAssetAmount(row.asset_symbol, row.amount, row.decimals), targetContract: row.contract_address, provider: parseJson<{ provider?: string | null }>(row.metadata_json, {}).provider ?? null, purchaseType: row.intent_type as AgentPurchaseType, purpose: parseJson<{ purpose?: string }>(row.metadata_json, {}).purpose ?? row.intent_type, policyDecision: parseJson<PolicyGuardDecision | null>(row.policy_decision_json, null), createdAt: row.created_at, updatedAt: row.updated_at };
}

export function toOnchainTransactionEventRow(event: OnchainTransactionEvent, context: RowContext & { userId: string; agentId: string }): OnchainTransactionEventRow {
  return { id: event.id, user_id: context.userId, agent_id: context.agentId, wallet_id: context.walletId ?? null, intent_id: event.intentId, chain: context.chain ?? "TON", network: context.network ?? "testnet_simulated", tx_hash: event.txHash, status: event.status, explorer_url: null, raw_event_json: null, metadata_json: event.metadata ? stringifyJson(event.metadata) : null, created_at: event.createdAt };
}

export function fromOnchainTransactionEventRow(row: OnchainTransactionEventRow): OnchainTransactionEvent {
  return { id: row.id, intentId: row.intent_id, status: row.status as OnchainIntentStatus, txHash: row.tx_hash, message: parseJson<{ message?: string | null }>(row.metadata_json, {}).message ?? null, metadata: parseJson<Record<string, unknown> | null>(row.metadata_json, null), createdAt: row.created_at };
}

export function toAiModelTokenProductRow(product: AiModelTokenProduct, context: RowContext = {}): AiModelTokenProductRow {
  return { id: product.id, provider: product.provider, model_id: product.modelId, purchase_type: "ai_model_token", asset_symbol: product.purchaseAsset, price_amount: product.price.amount, price_decimals: product.price.decimals, credit_amount: product.creditAmount.amount, status: product.status, metadata_json: context.metadata ? stringifyJson(context.metadata) : null, created_at: context.createdAt ?? nowIso(), updated_at: context.updatedAt ?? context.createdAt ?? nowIso() };
}

export function fromAiModelTokenProductRow(row: AiModelTokenProductRow): AiModelTokenProduct {
  return { id: row.id, provider: row.provider, modelId: row.model_id, displayName: row.model_id, purchaseAsset: "G", price: columnsToAssetAmount(row.asset_symbol, row.price_amount, row.price_decimals), creditAmount: columnsToAssetAmount("AI_CREDIT", row.credit_amount, 9), status: row.status as "active" | "disabled" };
}

export function toAiModelTokenPurchaseIntentRow(intent: AiModelTokenPurchaseIntent, context: RowContext = {}): AiModelTokenPurchaseIntentRow {
  return { id: intent.id, user_id: intent.userId, agent_id: intent.agentId, wallet_id: intent.walletId, product_id: intent.productId, provider: intent.provider, model_id: intent.modelId, purchase_type: "ai_model_token", asset_symbol: intent.spend.symbol, amount: intent.spend.amount, decimals: intent.spend.decimals, status: intent.status, policy_decision_json: stringifyJson(intent.policyDecision), purpose: context.purpose ?? null, metadata_json: context.metadata ? stringifyJson(context.metadata) : null, created_at: intent.createdAt, updated_at: intent.updatedAt };
}

export function fromAiModelTokenPurchaseIntentRow(row: AiModelTokenPurchaseIntentRow): AiModelTokenPurchaseIntent {
  return { id: row.id, userId: row.user_id, agentId: row.agent_id, walletId: row.wallet_id, productId: row.product_id ?? "", provider: row.provider, modelId: row.model_id, spend: columnsToAssetAmount(row.asset_symbol, row.amount, row.decimals), expectedCredits: columnsToAssetAmount("AI_CREDIT", parseJson<{ expectedCredits?: string }>(row.metadata_json, {}).expectedCredits ?? "0", 9), status: row.status as AiModelTokenPurchaseIntent["status"], policyDecision: parseJson<PolicyGuardDecision | null>(row.policy_decision_json, null), relatedOnchainIntentId: parseJson<{ relatedOnchainIntentId?: string | null }>(row.metadata_json, {}).relatedOnchainIntentId ?? null, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function toAiModelTokenPurchaseResultRow(result: AiModelTokenPurchaseResult, context: RowContext & { userId: string; agentId: string; provider: string; modelId: string }): AiModelTokenPurchaseResultRow {
  return { id: result.id, purchase_intent_id: result.purchaseIntentId, user_id: context.userId, agent_id: context.agentId, provider: context.provider, model_id: context.modelId, status: result.status, credit_asset_symbol: result.creditsGranted.symbol, credit_amount: result.creditsGranted.amount, credit_decimals: result.creditsGranted.decimals, related_transaction_event_id: context.relatedTransactionEventId ?? null, metadata_json: stringifyJson({ receiptRef: result.receiptRef, auditEventId: result.auditEventId, spend: result.spend, ...(context.metadata ?? {}) }), created_at: result.createdAt };
}

export function fromAiModelTokenPurchaseResultRow(row: AiModelTokenPurchaseResultRow): AiModelTokenPurchaseResult {
  const metadata = parseJson<{ receiptRef?: string | null; auditEventId?: string | null; spend?: AssetAmount }>(row.metadata_json, {});
  return { id: row.id, purchaseIntentId: row.purchase_intent_id, status: row.status as AiModelTokenPurchaseResult["status"], spend: metadata.spend ?? columnsToAssetAmount("G", "0", 9), creditsGranted: columnsToAssetAmount(row.credit_asset_symbol, row.credit_amount, row.credit_decimals), receiptRef: metadata.receiptRef ?? null, auditEventId: metadata.auditEventId ?? null, createdAt: row.created_at };
}

export function toAiCreditBalanceRow(balance: AiCreditBalance, context: RowContext & { id: string; userId: string }): AiCreditBalanceRow {
  return { id: context.id, user_id: context.userId, agent_id: balance.agentId, provider: balance.provider, model_id: balance.modelId, asset_symbol: balance.balance.symbol, amount: balance.balance.amount, decimals: balance.balance.decimals, metadata_json: stringifyJson({ reserved: balance.reserved, ...(context.metadata ?? {}) }), updated_at: balance.updatedAt ?? context.updatedAt ?? nowIso() };
}

export function fromAiCreditBalanceRow(row: AiCreditBalanceRow): AiCreditBalance {
  return { agentId: row.agent_id, provider: row.provider, modelId: row.model_id, balance: columnsToAssetAmount(row.asset_symbol, row.amount, row.decimals), reserved: parseJson<{ reserved?: AssetAmount }>(row.metadata_json, {}).reserved ?? columnsToAssetAmount(row.asset_symbol, "0", row.decimals), updatedAt: row.updated_at };
}

export function toAiCreditUsageEventRow(event: AiCreditUsageEvent, context: RowContext = {}): AiCreditUsageEventRow {
  return { id: event.id, user_id: event.userId, agent_id: event.agentId, work_run_id: event.workRunId, work_report_id: context.workReportId ?? event.workReportId ?? null, provider: event.provider, model_id: event.modelId, asset_symbol: event.amount.symbol, amount: event.amount.amount, decimals: event.amount.decimals, purpose: context.purpose ?? null, metadata_json: stringifyJson({ purchaseIntentId: event.purchaseIntentId, evidenceRef: event.evidenceRef, ...(context.metadata ?? {}) }), created_at: event.createdAt };
}

export function fromAiCreditUsageEventRow(row: AiCreditUsageEventRow): AiCreditUsageEvent {
  const metadata = parseJson<{ purchaseIntentId?: string | null; evidenceRef?: string | null }>(row.metadata_json, {});
  return { id: row.id, userId: row.user_id, agentId: row.agent_id, workRunId: row.work_run_id, workReportId: row.work_report_id, provider: row.provider, modelId: row.model_id, amount: columnsToAssetAmount(row.asset_symbol, row.amount, row.decimals), purchaseIntentId: metadata.purchaseIntentId ?? null, evidenceRef: metadata.evidenceRef ?? null, createdAt: row.created_at };
}

export function toWorkReportEvidenceRow(evidence: RealAssetEvidence, context: RowContext & { userId: string; agentId?: string | null }): WorkReportEvidenceEventRow {
  const metadata = evidence.metadata ?? {};
  return { id: evidence.id, user_id: context.userId, agent_id: context.agentId ?? evidence.agentId ?? "", work_run_id: context.workRunId ?? null, work_report_id: context.workReportId ?? null, evidence_type: evidence.kind, status: evidence.status, title: evidence.title, summary: evidence.summary, related_intent_id: evidence.intentId, related_transaction_id: evidence.eventId, related_purchase_intent_id: evidence.purchaseIntentId, asset_symbol: typeof metadata.asset === "string" ? metadata.asset : null, amount: typeof metadata.amount === "string" ? metadata.amount : null, decimals: typeof metadata.decimals === "number" ? metadata.decimals : null, provider: typeof metadata.provider === "string" ? metadata.provider : null, model_id: typeof metadata.modelId === "string" ? metadata.modelId : null, skill_card_codes_json: context.skillCardCodes ? stringifyJson(context.skillCardCodes) : null, metadata_json: stringifyJson(metadata), created_at: evidence.createdAt };
}

export function fromWorkReportEvidenceRow(row: WorkReportEvidenceEventRow): RealAssetEvidence {
  return { id: row.id, kind: row.evidence_type as RealAssetEvidence["kind"], title: row.title, summary: row.summary ?? "", status: row.status, agentId: row.agent_id, walletId: null, intentId: row.related_intent_id, purchaseIntentId: row.related_purchase_intent_id, eventId: row.related_transaction_id, createdAt: row.created_at, metadata: parseJson<Record<string, unknown> | null>(row.metadata_json, null) };
}

export function toAdminRiskAuditEventRow(event: AdminRealAssetAuditEvent, context: RowContext = {}): AdminRiskAuditEventRow {
  return { id: event.id, event_type: event.eventType, actor: event.actor, target_type: event.targetType, target_id: event.targetId, summary: event.summary, status: context.status ?? "recorded", metadata_json: stringifyJson(event.metadata), created_at: event.createdAt };
}

export function fromAdminRiskAuditEventRow(row: AdminRiskAuditEventRow): AdminRealAssetAuditEvent {
  return { id: row.id, eventType: row.event_type, actor: row.actor, targetType: row.target_type, targetId: row.target_id, summary: row.summary, createdAt: row.created_at, metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}) };
}
