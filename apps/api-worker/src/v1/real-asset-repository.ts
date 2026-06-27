import type {
  AdminRealAssetAuditEvent,
  AgentPurchaseType,
  AgentWalletPolicy,
  AgentWalletAssetSnapshot,
  AssetLedgerEvent,
  AiCreditUsageEvent,
  AiModelTokenPurchaseIntent,
  AssetSymbol,
  OnchainIntentStatus,
  OnchainTransactionIntent,
  OnchainTransactionEvent,
  RealAssetEvidence,
  RealAssetPersistenceSource,
  AdminReviewQueueItemStatus
} from "@growthbot/shared";
import {
  fromAdminRiskAuditEventRow,
  fromAiCreditUsageEventRow,
  fromAiModelTokenPurchaseIntentRow,
  fromAssetLedgerEventRow,
  fromOnchainIntentRow,
  fromOnchainTransactionEventRow,
  fromWorkReportEvidenceRow,
  fromWalletAssetSnapshotRow,
  fromAgentWalletPolicyRow,
  toAdminRiskAuditEventRow,
  toAiCreditUsageEventRow,
  toAiModelTokenPurchaseIntentRow,
  toAssetLedgerEventRow,
  toOnchainIntentRow,
  toOnchainTransactionEventRow,
  toWorkReportEvidenceRow,
  toWalletAssetSnapshotRow,
  toAgentWalletPolicyRow,
  type AdminRiskAuditEventRow,
  type AiCreditUsageEventRow,
  type AiModelTokenPurchaseIntentRow,
  type AssetLedgerEventRow,
  type OnchainTransactionEventRow,
  type OnchainTransactionIntentRow,
  type WalletAssetSnapshotRow,
  type WorkReportEvidenceEventRow,
  type AgentWalletPolicyRow,
  parseJson,
  stringifyJson,
  nowIso
} from "./real-asset-db";
import { defaultAgentWalletPolicy, id, type AppContext, type DbAgentWallet } from "./core";
import type {
  AdminReviewQueueItem,
  AdminReviewQueueResponse,
  AdminReviewRiskLevel,
  RealAssetPersistenceStatus
} from "@growthbot/shared";

export interface PersistenceResult<T> extends RealAssetPersistenceStatus {
  value: T;
}

export interface RealAssetListOptions {
  limit?: number;
  status?: string | string[];
  itemType?: string | string[];
  eventType?: string | string[];
  purchaseType?: string | string[];
  workRunId?: string | null;
  workReportId?: string | null;
  relatedIntentId?: string | null;
  relatedPurchaseIntentId?: string | null;
}

export interface WorkReportEvidenceContext {
  userId: string;
  agentId?: string | null;
  workRunId?: string | null;
  workReportId?: string | null;
  skillCardCodes?: string[];
}

export interface WalletPolicyRecord extends AgentWalletPolicy {
  id?: string;
  userId: string;
  agentId: string;
  walletId?: string | null;
  metadata?: Record<string, unknown> | null;
}

type LegacyAdminAuditRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata_json: string | null;
  created_at: string;
};

function result<T>(value: T, source: RealAssetPersistenceSource, persistenceError: string | null = null): PersistenceResult<T> {
  return {
    value,
    source,
    degraded: source !== "db",
    persistenceError
  };
}

async function tableExists(c: AppContext, table: string): Promise<boolean> {
  try {
    const row = await c.env.DB.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?").bind(table).first<{ ok: number }>();
    return Boolean(row);
  } catch {
    return false;
  }
}

async function maybeAgentUserId(c: AppContext, agentId: string): Promise<string | null> {
  try {
    const row = await c.env.DB.prepare("SELECT user_id FROM agents WHERE id = ?").bind(agentId).first<{ user_id: string }>();
    return row?.user_id ?? null;
  } catch {
    return null;
  }
}

async function maybeAgentWalletRow(c: AppContext, agentId: string): Promise<DbAgentWallet | null> {
  try {
    return await c.env.DB.prepare("SELECT * FROM agent_wallets WHERE agent_id = ? ORDER BY updated_at DESC LIMIT 1").bind(agentId).first<DbAgentWallet>();
  } catch {
    return null;
  }
}

function toStatusList(values?: string | string[]): string[] {
  if (!values) return [];
  return Array.isArray(values) ? values.filter(Boolean) : [values];
}

function buildWhereClauses(clauses: string[], params: unknown[]): [string, unknown[]] {
  return clauses.length > 0 ? [` WHERE ${clauses.join(" AND ")}`, params] : ["", params];
}

function groupSnapshots(rows: WalletAssetSnapshotRow[], fallbackPolicy: AgentWalletPolicy): AgentWalletAssetSnapshot[] {
  const groups = new Map<string, WalletAssetSnapshotRow[]>();
  for (const row of rows) {
    const key = `${row.wallet_id}:${row.created_at}`;
    const current = groups.get(key) || [];
    current.push(row);
    groups.set(key, current);
  }

  return Array.from(groups.values()).map((group) => {
    const first = group[0]!;
    return {
      walletId: first.wallet_id,
      agentId: first.agent_id,
      balances: group.map((row) => fromWalletAssetSnapshotRow(row)),
      policy: fallbackPolicy,
      updatedAt: first.created_at
    };
  });
}

export async function getAgentWalletPolicyFromDb(c: AppContext, agentId: string): Promise<PersistenceResult<AgentWalletPolicy | null>> {
  if (!(await tableExists(c, "agent_wallet_policies"))) {
    return result(null, "fallback", "agent_wallet_policies_missing");
  }
  try {
    const row = await c.env.DB.prepare(
      "SELECT * FROM agent_wallet_policies WHERE agent_id = ? ORDER BY updated_at DESC LIMIT 1"
    ).bind(agentId).first<AgentWalletPolicyRow>();
    if (!row) {
      return result(null, "fallback", "agent_wallet_policy_missing");
    }
    return result(fromAgentWalletPolicyRow(row), "db");
  } catch (error) {
    return result(null, "fallback", error instanceof Error ? error.message : "agent_wallet_policy_read_failed");
  }
}

export async function upsertAgentWalletPolicyToDb(c: AppContext, policy: WalletPolicyRecord): Promise<PersistenceResult<AgentWalletPolicy>> {
  if (!(await tableExists(c, "agent_wallet_policies"))) {
    return result(policy, "fallback", "agent_wallet_policies_missing");
  }
  try {
    const now = nowIso();
    const existing = policy.id
      ? await c.env.DB.prepare("SELECT id FROM agent_wallet_policies WHERE id = ?").bind(policy.id).first<{ id: string }>()
      : await c.env.DB.prepare("SELECT id FROM agent_wallet_policies WHERE agent_id = ? ORDER BY updated_at DESC LIMIT 1").bind(policy.agentId).first<{ id: string }>();
    const rowId = existing?.id ?? policy.id ?? id("wallet_policy");
    const row = toAgentWalletPolicyRow(policy, {
      id: rowId,
      userId: policy.userId,
      agentId: policy.agentId,
      walletId: policy.walletId ?? null,
      createdAt: now,
      updatedAt: now,
      metadata: policy.metadata ?? null
    });
    if (existing) {
      await c.env.DB.prepare(
        `UPDATE agent_wallet_policies
         SET user_id = ?, agent_id = ?, wallet_id = ?, status = ?, risk_mode = ?, auto_purchase_enabled = ?,
             per_transaction_limit_amount = ?, per_transaction_limit_asset = ?, daily_limit_amount = ?, daily_limit_asset = ?,
             minimum_reserve_amount = ?, minimum_reserve_asset = ?, allowed_assets_json = ?, allowed_contracts_json = ?,
             allowed_providers_json = ?, allowed_purchase_types_json = ?, require_confirmation_above_amount = ?,
             require_confirmation_above_asset = ?, admin_global_pause = ?, user_paused = ?, metadata_json = ?, updated_at = ?
         WHERE id = ?`
      ).bind(
        row.user_id,
        row.agent_id,
        row.wallet_id,
        row.status,
        row.risk_mode,
        row.auto_purchase_enabled,
        row.per_transaction_limit_amount,
        row.per_transaction_limit_asset,
        row.daily_limit_amount,
        row.daily_limit_asset,
        row.minimum_reserve_amount,
        row.minimum_reserve_asset,
        row.allowed_assets_json,
        row.allowed_contracts_json,
        row.allowed_providers_json,
        row.allowed_purchase_types_json,
        row.require_confirmation_above_amount,
        row.require_confirmation_above_asset,
        row.admin_global_pause,
        row.user_paused,
        row.metadata_json,
        now,
        existing.id
      ).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO agent_wallet_policies (
           id, user_id, agent_id, wallet_id, status, risk_mode, auto_purchase_enabled,
           per_transaction_limit_amount, per_transaction_limit_asset, daily_limit_amount, daily_limit_asset,
           minimum_reserve_amount, minimum_reserve_asset, allowed_assets_json, allowed_contracts_json,
           allowed_providers_json, allowed_purchase_types_json, require_confirmation_above_amount,
           require_confirmation_above_asset, admin_global_pause, user_paused, metadata_json, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        row.id,
        row.user_id,
        row.agent_id,
        row.wallet_id,
        row.status,
        row.risk_mode,
        row.auto_purchase_enabled,
        row.per_transaction_limit_amount,
        row.per_transaction_limit_asset,
        row.daily_limit_amount,
        row.daily_limit_asset,
        row.minimum_reserve_amount,
        row.minimum_reserve_asset,
        row.allowed_assets_json,
        row.allowed_contracts_json,
        row.allowed_providers_json,
        row.allowed_purchase_types_json,
        row.require_confirmation_above_amount,
        row.require_confirmation_above_asset,
        row.admin_global_pause,
        row.user_paused,
        row.metadata_json,
        row.created_at,
        row.updated_at
      ).run();
    }
    return result(policy, "db");
  } catch (error) {
    return result(policy, "fallback", error instanceof Error ? error.message : "agent_wallet_policy_write_failed");
  }
}

export async function getEffectiveAgentWalletPolicy(c: AppContext, agentId: string, fallbackPolicy: AgentWalletPolicy): Promise<PersistenceResult<AgentWalletPolicy>> {
  const read = await getAgentWalletPolicyFromDb(c, agentId);
  const basePolicy = read.value ?? fallbackPolicy;
  const walletRow = await maybeAgentWalletRow(c, agentId);
  if (!walletRow) {
    return read.value ? result(basePolicy, read.source, read.persistenceError) : result(basePolicy, "fallback", read.persistenceError);
  }
  const walletFallback = defaultAgentWalletPolicy(walletRow);
  const effectivePolicy: AgentWalletPolicy = {
    ...basePolicy,
    userPaused: walletFallback.userPaused,
    status: walletFallback.userPaused || basePolicy.adminGlobalPause ? "paused" : basePolicy.status
  };
  return read.value ? result(effectivePolicy, read.source, read.persistenceError) : result(effectivePolicy, "fallback", read.persistenceError);
}

export async function listWalletAssetSnapshots(
  c: AppContext,
  agentId: string,
  fallbackPolicy: AgentWalletPolicy = defaultAgentWalletPolicy(null)
): Promise<PersistenceResult<AgentWalletAssetSnapshot[]>> {
  if (!(await tableExists(c, "wallet_asset_snapshots"))) {
    return result([], "fallback", "wallet_asset_snapshots_missing");
  }
  try {
    const rows = await c.env.DB.prepare(
      "SELECT * FROM wallet_asset_snapshots WHERE agent_id = ? ORDER BY created_at DESC"
    ).bind(agentId).all<WalletAssetSnapshotRow>();
    return result(groupSnapshots(rows.results || [], fallbackPolicy), "db");
  } catch (error) {
    return result([], "fallback", error instanceof Error ? error.message : "wallet_asset_snapshot_read_failed");
  }
}

export async function appendWalletAssetSnapshot(
  c: AppContext,
  snapshot: AgentWalletAssetSnapshot
): Promise<PersistenceResult<AgentWalletAssetSnapshot>> {
  if (!(await tableExists(c, "wallet_asset_snapshots"))) {
    return result(snapshot, "simulated", "wallet_asset_snapshots_missing");
  }
  try {
    const userId = await maybeAgentUserId(c, snapshot.agentId);
    if (!userId) {
      return result(snapshot, "fallback", "agent_user_missing");
    }
    const createdAt = snapshot.updatedAt ?? nowIso();
    const statements = snapshot.balances.map((balance) =>
      c.env.DB.prepare(
        `INSERT INTO wallet_asset_snapshots (id, user_id, agent_id, wallet_id, asset_symbol, amount, decimals, source, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id("wallet_snapshot"),
        userId,
        snapshot.agentId,
        snapshot.walletId,
        balance.asset,
        balance.total.amount,
        balance.total.decimals,
        "runtime_snapshot",
        stringifyJson({ policy: snapshot.policy }),
        createdAt
      )
    );
    if (statements.length > 0) {
      await c.env.DB.batch(statements);
    }
    return result(snapshot, "db");
  } catch (error) {
    return result(snapshot, "fallback", error instanceof Error ? error.message : "wallet_asset_snapshot_write_failed");
  }
}

export async function getLatestWalletAssetSnapshot(
  c: AppContext,
  agentId: string,
  walletId: string,
  fallbackPolicy: AgentWalletPolicy = defaultAgentWalletPolicy(null)
): Promise<PersistenceResult<AgentWalletAssetSnapshot | null>> {
  if (!(await tableExists(c, "wallet_asset_snapshots"))) {
    return result(null, "fallback", "wallet_asset_snapshots_missing");
  }
  try {
    const rows = await c.env.DB.prepare(
      "SELECT * FROM wallet_asset_snapshots WHERE agent_id = ? AND wallet_id = ? ORDER BY created_at DESC"
    ).bind(agentId, walletId).all<WalletAssetSnapshotRow>();
    const grouped = groupSnapshots(rows.results || [], fallbackPolicy);
    return result(grouped[0] ?? null, grouped.length > 0 ? "db" : "fallback", grouped.length > 0 ? null : "wallet_asset_snapshot_missing");
  } catch (error) {
    return result(null, "fallback", error instanceof Error ? error.message : "wallet_asset_snapshot_read_failed");
  }
}

export async function appendAssetLedgerEvent(c: AppContext, event: AssetLedgerEvent): Promise<PersistenceResult<AssetLedgerEvent>> {
  if (!(await tableExists(c, "asset_ledger_events"))) {
    return result(event, "simulated", "asset_ledger_events_missing");
  }
  try {
    const row = toAssetLedgerEventRow(event, {
      userId: event.userId,
      direction: Number(event.amount.amount) >= 0 ? "credit" : "debit",
      status: "recorded"
    });
    await c.env.DB.prepare(
      `INSERT INTO asset_ledger_events (
         id, user_id, agent_id, wallet_id, event_type, asset_symbol, amount, decimals, direction,
         related_intent_id, related_transaction_id, related_purchase_intent_id, status, metadata_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      row.id,
      row.user_id,
      row.agent_id,
      row.wallet_id,
      row.event_type,
      row.asset_symbol,
      row.amount,
      row.decimals,
      row.direction,
      row.related_intent_id,
      row.related_transaction_id,
      row.related_purchase_intent_id,
      row.status,
      row.metadata_json,
      row.created_at
    ).run();
    return result(event, "db");
  } catch (error) {
    return result(event, "fallback", error instanceof Error ? error.message : "asset_ledger_event_write_failed");
  }
}

export async function listAssetLedgerEvents(c: AppContext, agentId: string, options: RealAssetListOptions = {}): Promise<PersistenceResult<AssetLedgerEvent[]>> {
  if (!(await tableExists(c, "asset_ledger_events"))) {
    return result([], "fallback", "asset_ledger_events_missing");
  }
  try {
    const clauses = ["agent_id = ?"];
    const params: unknown[] = [agentId];
    const statuses = toStatusList(options.status);
    const eventTypes = toStatusList(options.eventType);
    if (options.workRunId) {
      clauses.push("metadata_json LIKE ?");
      params.push(`%${options.workRunId}%`);
    }
    if (options.relatedIntentId) {
      clauses.push("related_intent_id = ?");
      params.push(options.relatedIntentId);
    }
    if (options.relatedPurchaseIntentId) {
      clauses.push("related_purchase_intent_id = ?");
      params.push(options.relatedPurchaseIntentId);
    }
    if (statuses.length > 0) {
      clauses.push(`status IN (${statuses.map(() => "?").join(", ")})`);
      params.push(...statuses);
    }
    if (eventTypes.length > 0) {
      clauses.push(`event_type IN (${eventTypes.map(() => "?").join(", ")})`);
      params.push(...eventTypes);
    }
    const [where] = buildWhereClauses(clauses, params);
    const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
    const rows = await c.env.DB.prepare(
      `SELECT * FROM asset_ledger_events${where} ORDER BY created_at DESC LIMIT ${limit}`
    ).bind(...params).all<AssetLedgerEventRow>();
    return result((rows.results || []).map(fromAssetLedgerEventRow), "db");
  } catch (error) {
    return result([], "fallback", error instanceof Error ? error.message : "asset_ledger_event_read_failed");
  }
}

export async function appendOnchainTransactionIntent(c: AppContext, intent: OnchainTransactionIntent): Promise<PersistenceResult<OnchainTransactionIntent>> {
  if (!(await tableExists(c, "onchain_transaction_intents"))) {
    return result(intent, "simulated", "onchain_transaction_intents_missing");
  }
  try {
    await c.env.DB.prepare(
      `INSERT INTO onchain_transaction_intents (
         id, user_id, agent_id, wallet_id, chain, network, asset_symbol, amount, decimals, to_address,
         contract_address, intent_type, status, policy_decision_json, requires_confirmation, metadata_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      intent.id,
      intent.userId,
      intent.agentId,
      intent.walletId,
      "TON",
      "testnet_simulated",
      intent.asset,
      intent.amount.amount,
      intent.amount.decimals,
      null,
      intent.targetContract,
      intent.purchaseType ?? "task_execution",
      intent.status,
      stringifyJson(intent.policyDecision),
      intent.policyDecision?.requiredConfirmation ? 1 : 0,
      stringifyJson({ purpose: intent.purpose, provider: intent.provider }),
      intent.createdAt,
      intent.updatedAt
    ).run();
    return result(intent, "db");
  } catch (error) {
    return result(intent, "fallback", error instanceof Error ? error.message : "onchain_transaction_intent_write_failed");
  }
}

export async function listOnchainTransactionIntents(c: AppContext, agentId: string, options: RealAssetListOptions = {}): Promise<PersistenceResult<OnchainTransactionIntent[]>> {
  if (!(await tableExists(c, "onchain_transaction_intents"))) {
    return result([], "fallback", "onchain_transaction_intents_missing");
  }
  try {
    const clauses = ["agent_id = ?"];
    const params: unknown[] = [agentId];
    const statuses = toStatusList(options.status);
    const purchaseTypes = toStatusList(options.purchaseType);
    if (statuses.length > 0) {
      clauses.push(`status IN (${statuses.map(() => "?").join(", ")})`);
      params.push(...statuses);
    }
    if (purchaseTypes.length > 0) {
      clauses.push(`intent_type IN (${purchaseTypes.map(() => "?").join(", ")})`);
      params.push(...purchaseTypes);
    }
    if (options.relatedIntentId) {
      clauses.push("id = ?");
      params.push(options.relatedIntentId);
    }
    const [where] = buildWhereClauses(clauses, params);
    const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
    const rows = await c.env.DB.prepare(
      `SELECT * FROM onchain_transaction_intents${where} ORDER BY created_at DESC LIMIT ${limit}`
    ).bind(...params).all<OnchainTransactionIntentRow>();
    return result((rows.results || []).map(fromOnchainIntentRow), "db");
  } catch (error) {
    return result([], "fallback", error instanceof Error ? error.message : "onchain_transaction_intent_read_failed");
  }
}

export async function updateOnchainTransactionIntentStatusSimulated(
  c: AppContext,
  intentId: string,
  status: OnchainIntentStatus,
  metadata: Record<string, unknown> | null = null
): Promise<PersistenceResult<OnchainTransactionIntent | null>> {
  if (!(await tableExists(c, "onchain_transaction_intents"))) {
    return result(null, "simulated", "onchain_transaction_intents_missing");
  }
  try {
    const existing = await c.env.DB.prepare("SELECT * FROM onchain_transaction_intents WHERE id = ?").bind(intentId).first<OnchainTransactionIntentRow>();
    if (!existing) {
      return result(null, "fallback", "onchain_transaction_intent_missing");
    }
    const nextMetadata = {
      ...(parseJson<Record<string, unknown>>(existing.metadata_json, {}) || {}),
      ...(metadata || {}),
      simulatedReview: true
    };
    await c.env.DB.prepare(
      "UPDATE onchain_transaction_intents SET status = ?, metadata_json = ?, updated_at = ? WHERE id = ?"
    ).bind(status, stringifyJson(nextMetadata), nowIso(), intentId).run();
    const updated = await c.env.DB.prepare("SELECT * FROM onchain_transaction_intents WHERE id = ?").bind(intentId).first<OnchainTransactionIntentRow>();
    if (updated && (await tableExists(c, "onchain_transaction_events"))) {
      await c.env.DB.prepare(
        `INSERT INTO onchain_transaction_events (
           id, user_id, agent_id, wallet_id, intent_id, chain, network, tx_hash, status, explorer_url, raw_event_json, metadata_json, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id("tx_event"),
        updated.user_id,
        updated.agent_id,
        updated.wallet_id,
        updated.id,
        updated.chain,
        updated.network,
        null,
        status,
        null,
        null,
        stringifyJson({ ...nextMetadata, simulatedReview: true }),
        nowIso()
      ).run();
    }
    return result(updated ? fromOnchainIntentRow(updated) : null, "db");
  } catch (error) {
    return result(null, "fallback", error instanceof Error ? error.message : "onchain_transaction_intent_update_failed");
  }
}

export async function appendAiModelTokenPurchaseIntent(c: AppContext, intent: AiModelTokenPurchaseIntent): Promise<PersistenceResult<AiModelTokenPurchaseIntent>> {
  if (!(await tableExists(c, "ai_model_token_purchase_intents"))) {
    return result(intent, "simulated", "ai_model_token_purchase_intents_missing");
  }
  try {
    await c.env.DB.prepare(
      `INSERT INTO ai_model_token_purchase_intents (
         id, user_id, agent_id, wallet_id, product_id, provider, model_id, purchase_type, asset_symbol,
         amount, decimals, status, policy_decision_json, purpose, metadata_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      intent.id,
      intent.userId,
      intent.agentId,
      intent.walletId,
      intent.productId,
      intent.provider,
      intent.modelId,
      "ai_model_token",
      intent.spend.symbol,
      intent.spend.amount,
      intent.spend.decimals,
      intent.status,
      stringifyJson(intent.policyDecision),
      intent.relatedOnchainIntentId ? `related:${intent.relatedOnchainIntentId}` : null,
      stringifyJson({ relatedOnchainIntentId: intent.relatedOnchainIntentId }),
      intent.createdAt,
      intent.updatedAt
    ).run();
    return result(intent, "db");
  } catch (error) {
    return result(intent, "fallback", error instanceof Error ? error.message : "ai_model_token_purchase_intent_write_failed");
  }
}

export async function listAiModelTokenPurchaseIntents(c: AppContext, agentId: string, options: RealAssetListOptions = {}): Promise<PersistenceResult<AiModelTokenPurchaseIntent[]>> {
  if (!(await tableExists(c, "ai_model_token_purchase_intents"))) {
    return result([], "fallback", "ai_model_token_purchase_intents_missing");
  }
  try {
    const clauses = ["agent_id = ?"];
    const params: unknown[] = [agentId];
    const statuses = toStatusList(options.status);
    const purchaseTypes = toStatusList(options.purchaseType);
    if (statuses.length > 0) {
      clauses.push(`status IN (${statuses.map(() => "?").join(", ")})`);
      params.push(...statuses);
    }
    if (purchaseTypes.length > 0) {
      clauses.push(`purchase_type IN (${purchaseTypes.map(() => "?").join(", ")})`);
      params.push(...purchaseTypes);
    }
    if (options.relatedPurchaseIntentId) {
      clauses.push("id = ?");
      params.push(options.relatedPurchaseIntentId);
    }
    const [where] = buildWhereClauses(clauses, params);
    const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
    const rows = await c.env.DB.prepare(
      `SELECT * FROM ai_model_token_purchase_intents${where} ORDER BY created_at DESC LIMIT ${limit}`
    ).bind(...params).all<AiModelTokenPurchaseIntentRow>();
    return result((rows.results || []).map(fromAiModelTokenPurchaseIntentRow), "db");
  } catch (error) {
    return result([], "fallback", error instanceof Error ? error.message : "ai_model_token_purchase_intent_read_failed");
  }
}

export async function updateAiModelTokenPurchaseIntentStatusSimulated(
  c: AppContext,
  intentId: string,
  status: AiModelTokenPurchaseIntent["status"],
  metadata: Record<string, unknown> | null = null
): Promise<PersistenceResult<AiModelTokenPurchaseIntent | null>> {
  if (!(await tableExists(c, "ai_model_token_purchase_intents"))) {
    return result(null, "simulated", "ai_model_token_purchase_intents_missing");
  }
  try {
    const existing = await c.env.DB.prepare("SELECT * FROM ai_model_token_purchase_intents WHERE id = ?").bind(intentId).first<AiModelTokenPurchaseIntentRow>();
    if (!existing) {
      return result(null, "fallback", "ai_model_token_purchase_intent_missing");
    }
    const nextMetadata = {
      ...(parseJson<Record<string, unknown>>(existing.metadata_json, {}) || {}),
      ...(metadata || {}),
      simulatedReview: true
    };
    await c.env.DB.prepare(
      "UPDATE ai_model_token_purchase_intents SET status = ?, metadata_json = ?, updated_at = ? WHERE id = ?"
    ).bind(status, stringifyJson(nextMetadata), nowIso(), intentId).run();
    const updated = await c.env.DB.prepare("SELECT * FROM ai_model_token_purchase_intents WHERE id = ?").bind(intentId).first<AiModelTokenPurchaseIntentRow>();
    return result(updated ? fromAiModelTokenPurchaseIntentRow(updated) : null, "db");
  } catch (error) {
    return result(null, "fallback", error instanceof Error ? error.message : "ai_model_token_purchase_intent_update_failed");
  }
}

export async function appendAiCreditUsageEvent(
  c: AppContext,
  event: AiCreditUsageEvent,
  context: {
    workReportId?: string | null;
    purpose?: string | null;
    metadata?: Record<string, unknown> | null;
  } = {}
): Promise<PersistenceResult<AiCreditUsageEvent>> {
  const effectiveEvent: AiCreditUsageEvent = {
    ...event,
    workReportId: context.workReportId ?? event.workReportId ?? null
  };
  if (!(await tableExists(c, "ai_credit_usage_events"))) {
    return result(effectiveEvent, "simulated", "ai_credit_usage_events_missing");
  }
  try {
    const row = toAiCreditUsageEventRow(effectiveEvent, context);
    await c.env.DB.prepare(
      `INSERT INTO ai_credit_usage_events (
         id, user_id, agent_id, work_run_id, work_report_id, provider, model_id, asset_symbol, amount, decimals, purpose, metadata_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      row.id,
      row.user_id,
      row.agent_id,
      row.work_run_id,
      row.work_report_id,
      row.provider,
      row.model_id,
      row.asset_symbol,
      row.amount,
      row.decimals,
      row.purpose,
      row.metadata_json,
      row.created_at
    ).run();
    return result(effectiveEvent, "db");
  } catch (error) {
    return result(effectiveEvent, "fallback", error instanceof Error ? error.message : "ai_credit_usage_event_write_failed");
  }
}

export async function listAiCreditUsageEvents(c: AppContext, agentId: string, options: RealAssetListOptions = {}): Promise<PersistenceResult<AiCreditUsageEvent[]>> {
  if (!(await tableExists(c, "ai_credit_usage_events"))) {
    return result([], "fallback", "ai_credit_usage_events_missing");
  }
  try {
    const clauses = ["agent_id = ?"];
    const params: unknown[] = [agentId];
    if (options.workRunId) {
      clauses.push("work_run_id = ?");
      params.push(options.workRunId);
    }
    if (options.workReportId) {
      clauses.push("work_report_id = ?");
      params.push(options.workReportId);
    }
    const [where] = buildWhereClauses(clauses, params);
    const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
    const rows = await c.env.DB.prepare(
      `SELECT * FROM ai_credit_usage_events${where} ORDER BY created_at DESC LIMIT ${limit}`
    ).bind(...params).all<AiCreditUsageEventRow>();
    return result((rows.results || []).map(fromAiCreditUsageEventRow), "db");
  } catch (error) {
    return result([], "fallback", error instanceof Error ? error.message : "ai_credit_usage_event_read_failed");
  }
}

export async function appendWorkReportEvidenceEvent(
  c: AppContext,
  evidence: RealAssetEvidence,
  context: Partial<WorkReportEvidenceContext> = {}
): Promise<PersistenceResult<RealAssetEvidence>> {
  if (!(await tableExists(c, "work_report_evidence_events"))) {
    return result(evidence, "simulated", "work_report_evidence_events_missing");
  }
  try {
    const userId = context.userId || (evidence.agentId ? await maybeAgentUserId(c, evidence.agentId) : null);
    if (!userId) {
      return result(evidence, "fallback", "work_report_evidence_user_missing");
    }
    await c.env.DB.prepare(
      `INSERT INTO work_report_evidence_events (
         id, user_id, agent_id, work_run_id, work_report_id, evidence_type, status, title, summary,
         related_intent_id, related_transaction_id, related_purchase_intent_id, asset_symbol, amount, decimals,
         provider, model_id, skill_card_codes_json, metadata_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      evidence.id,
      userId,
      context.agentId ?? evidence.agentId ?? "",
      context.workRunId ?? null,
      context.workReportId ?? null,
      evidence.kind,
      evidence.status,
      evidence.title,
      evidence.summary,
      evidence.intentId,
      evidence.eventId,
      evidence.purchaseIntentId,
      typeof evidence.metadata?.asset === "string" ? evidence.metadata.asset : null,
      typeof evidence.metadata?.amount === "string" ? evidence.metadata.amount : null,
      typeof evidence.metadata?.decimals === "number" ? evidence.metadata.decimals : null,
      typeof evidence.metadata?.provider === "string" ? evidence.metadata.provider : null,
      typeof evidence.metadata?.modelId === "string" ? evidence.metadata.modelId : null,
      context.skillCardCodes ? stringifyJson(context.skillCardCodes) : evidence.metadata && Array.isArray((evidence.metadata as Record<string, unknown>).skillCardCodes) ? stringifyJson((evidence.metadata as Record<string, unknown>).skillCardCodes) : null,
      stringifyJson(evidence.metadata),
      evidence.createdAt
    ).run();
    return result(evidence, "db");
  } catch (error) {
    return result(evidence, "fallback", error instanceof Error ? error.message : "work_report_evidence_write_failed");
  }
}

export async function listWorkReportEvidenceEvents(c: AppContext, agentId: string, options: RealAssetListOptions = {}): Promise<PersistenceResult<RealAssetEvidence[]>> {
  if (!(await tableExists(c, "work_report_evidence_events"))) {
    return result([], "fallback", "work_report_evidence_events_missing");
  }
  try {
    const clauses = ["agent_id = ?"];
    const params: unknown[] = [agentId];
    if (options.workRunId) {
      clauses.push("work_run_id = ?");
      params.push(options.workRunId);
    }
    if (options.workReportId) {
      clauses.push("work_report_id = ?");
      params.push(options.workReportId);
    }
    if (options.relatedIntentId) {
      clauses.push("related_intent_id = ?");
      params.push(options.relatedIntentId);
    }
    if (options.relatedPurchaseIntentId) {
      clauses.push("related_purchase_intent_id = ?");
      params.push(options.relatedPurchaseIntentId);
    }
    const [where] = buildWhereClauses(clauses, params);
    const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
    const rows = await c.env.DB.prepare(
      `SELECT * FROM work_report_evidence_events${where} ORDER BY created_at DESC LIMIT ${limit}`
    ).bind(...params).all<WorkReportEvidenceEventRow>();
    return result((rows.results || []).map(fromWorkReportEvidenceRow), "db");
  } catch (error) {
    return result([], "fallback", error instanceof Error ? error.message : "work_report_evidence_read_failed");
  }
}

export async function listWorkReportEvidenceByReport(c: AppContext, workReportId: string): Promise<PersistenceResult<RealAssetEvidence[]>> {
  if (!(await tableExists(c, "work_report_evidence_events"))) {
    return result([], "fallback", "work_report_evidence_events_missing");
  }
  try {
    const rows = await c.env.DB.prepare(
      "SELECT * FROM work_report_evidence_events WHERE work_report_id = ? ORDER BY created_at DESC"
    ).bind(workReportId).all<WorkReportEvidenceEventRow>();
    return result((rows.results || []).map(fromWorkReportEvidenceRow), "db");
  } catch (error) {
    return result([], "fallback", error instanceof Error ? error.message : "work_report_evidence_by_report_read_failed");
  }
}

export async function appendAdminRiskAuditEvent(c: AppContext, event: AdminRealAssetAuditEvent): Promise<PersistenceResult<AdminRealAssetAuditEvent>> {
  if (!(await tableExists(c, "admin_risk_audit_events"))) {
    return result(event, "simulated", "admin_risk_audit_events_missing");
  }
  try {
    await c.env.DB.prepare(
      `INSERT INTO admin_risk_audit_events (
         id, event_type, actor, target_type, target_id, summary, status, metadata_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      event.id,
      event.eventType,
      event.actor,
      event.targetType,
      event.targetId,
      event.summary,
      "recorded",
      stringifyJson(event.metadata),
      event.createdAt
    ).run();
    return result(event, "db");
  } catch (error) {
    return result(event, "fallback", error instanceof Error ? error.message : "admin_risk_audit_event_write_failed");
  }
}

export async function listAdminRiskAuditEvents(c: AppContext, options: RealAssetListOptions = {}): Promise<PersistenceResult<AdminRealAssetAuditEvent[]>> {
  if (!(await tableExists(c, "admin_risk_audit_events"))) {
    try {
      const legacy = await c.env.DB.prepare(
        "SELECT id, action, target_type, target_id, metadata_json, created_at FROM admin_config_audit_logs ORDER BY created_at DESC LIMIT ?"
      ).bind(Math.max(1, Math.min(options.limit ?? 100, 500))).all<LegacyAdminAuditRow>();
      return result((legacy.results || []).map((row) => fromAdminRiskAuditEventRow({
        id: row.id,
        event_type: row.action,
        actor: (() => {
          const metadata = parseJson<Record<string, unknown>>(row.metadata_json, {});
          return typeof metadata.operator === "string" ? metadata.operator : "系统管理员";
        })(),
        target_type: row.target_type,
        target_id: row.target_id || row.target_type,
        summary: (() => {
          const metadata = parseJson<Record<string, unknown>>(row.metadata_json, {});
          const afterValue = typeof metadata.afterValue === "string" ? metadata.afterValue : row.action;
          return String(afterValue);
        })(),
        status: "recorded",
        metadata_json: row.metadata_json,
        created_at: row.created_at
      })), "simulated", "admin_risk_audit_events_missing");
    } catch {
      return result([], "simulated", "admin_risk_audit_events_missing");
    }
  }
  try {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (options.eventType) {
      const eventTypes = toStatusList(options.eventType);
      if (eventTypes.length > 0) {
        clauses.push(`event_type IN (${eventTypes.map(() => "?").join(", ")})`);
        params.push(...eventTypes);
      }
    }
    const [where] = buildWhereClauses(clauses, params);
    const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
    const rows = await c.env.DB.prepare(
      `SELECT * FROM admin_risk_audit_events${where} ORDER BY created_at DESC LIMIT ${limit}`
    ).bind(...params).all<AdminRiskAuditEventRow>();
    return result((rows.results || []).map(fromAdminRiskAuditEventRow), "db");
  } catch (error) {
    return result([], "fallback", error instanceof Error ? error.message : "admin_risk_audit_event_read_failed");
  }
}

export interface ReviewQueueBuildResult {
  queue: AdminReviewQueueResponse;
  persistence: RealAssetPersistenceStatus;
}

export function reviewStatusFromPolicy(status?: string | null): AdminReviewQueueItemStatus {
  switch (status) {
    case "allowed":
    case "denied":
    case "requires_confirmation":
    case "resolved":
    case "failed":
    case "simulated_only":
    case "pending":
      return status;
    default:
      return "pending";
  }
}
