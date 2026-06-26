// Legacy GP-era ledger compatibility boundary.
//
// This module is the only place new backend code should touch
// point_ledger_events / pending_points directly. The canonical economy uses
// G, TON, AI_CREDIT, Agent Wallet policy, intents, and asset ledger evidence.
// These helpers are retained to keep existing UI, recovery, and verification
// flows stable while the real-asset ledger migration is introduced.

const LEGACY_PENDING_POINTS_POINT_TYPE = "pending_points" as const;

function legacyId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export { LEGACY_PENDING_POINTS_POINT_TYPE };

export async function legacyPointTotal(db: D1Database, userId: string, pointType: string): Promise<number> {
  const row = await db.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM point_ledger_events WHERE user_id = ? AND point_type = ?"
  ).bind(userId, pointType).first<{ total: number }>();
  return Number(row?.total ?? 0);
}

export async function legacyPendingPointsBalance(db: D1Database, userId: string): Promise<number> {
  return legacyPointTotal(db, userId, LEGACY_PENDING_POINTS_POINT_TYPE);
}

export function legacyPointLedger(
  db: D1Database,
  userId: string,
  agentId: string | null,
  eventType: string,
  pointType: string,
  amount: number,
  projectId: string | null,
  sourceId: string,
  metadata: Record<string, unknown> = {},
  explicitLedgerId?: string
): D1PreparedStatement {
  const ledgerId = explicitLedgerId || legacyId("ledger");
  return db.prepare(
    "INSERT INTO point_ledger_events (id, user_id, agent_id, event_type, point_type, amount, project_id, source_id, quality_multiplier, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)"
  ).bind(ledgerId, userId, agentId, eventType, pointType, amount, projectId, sourceId, JSON.stringify({ ...metadata, compatibilityOnly: true }));
}

export function legacyPendingPointsLedger(
  db: D1Database,
  userId: string,
  agentId: string | null,
  eventType: string,
  amount: number,
  projectId: string | null,
  sourceId: string,
  metadata: Record<string, unknown> = {},
  explicitLedgerId?: string
): D1PreparedStatement {
  return legacyPointLedger(
    db,
    userId,
    agentId,
    eventType,
    LEGACY_PENDING_POINTS_POINT_TYPE,
    amount,
    projectId,
    sourceId,
    metadata,
    explicitLedgerId
  );
}

export async function legacyPendingPointsLedgerRowsBySource(
  db: D1Database,
  userId: string,
  sourceId: string,
  eventType?: string
): Promise<any[]> {
  const baseQuery = eventType
    ? "SELECT * FROM point_ledger_events WHERE user_id = ? AND source_id = ? AND event_type = ? AND point_type = 'pending_points' ORDER BY created_at, id"
    : "SELECT * FROM point_ledger_events WHERE user_id = ? AND source_id = ? AND point_type = 'pending_points' ORDER BY created_at, id";
  const rows = await db.prepare(baseQuery).bind(...(eventType ? [userId, sourceId, eventType] : [userId, sourceId])).all<any>();
  return rows.results;
}

export async function legacyPointLedgerRowsBySource(
  db: D1Database,
  userId: string,
  sourceId: string
): Promise<any[]> {
  const rows = await db.prepare(
    "SELECT * FROM point_ledger_events WHERE user_id = ? AND source_id = ? ORDER BY created_at, id"
  ).bind(userId, sourceId).all<any>();
  return rows.results;
}

export async function legacyPointLedgerRowsByAnySource(
  db: D1Database,
  userId: string,
  sourceIds: string[]
): Promise<any[]> {
  if (sourceIds.length === 0) return [];
  const placeholders = sourceIds.map(() => "?").join(", ");
  const rows = await db.prepare(
    `SELECT * FROM point_ledger_events WHERE user_id = ? AND source_id IN (${placeholders}) ORDER BY created_at, id`
  ).bind(userId, ...sourceIds).all<any>();
  return rows.results;
}

export function legacyLedgerCompatibilitySummary() {
  return {
    compatibilityOnly: true,
    legacyTables: ["point_ledger_events"],
    legacyPointTypes: [LEGACY_PENDING_POINTS_POINT_TYPE, "user_score", "claim_credits", "energy"],
    canonicalReplacement: "AssetLedgerEvent / OnchainTransactionIntent / AiCreditUsageEvent"
  };
}
