import { Hono, Context } from "hono";
import { Bindings, requireUser } from "./core";

export type TelegramUpdateClassification = {
  accepted: boolean;
  reason:
    | "bot_mention"
    | "command"
    | "user_submission"
    | "unsupported_update"
    | "missing_message"
    | "not_authorized_source"
    | "duplicate"
    | "rate_limited";
  eventType?: "mention" | "command" | "submission" | "public_signal";
  contentPreview?: string;
};

export type TelegramSourceType = "group" | "channel" | "user_submission" | "bot_mention" | "public_link";
export type TelegramSourceStatus = "pending" | "authorized" | "revoked" | "disabled";

export type TelegramSignalStatus = "candidate" | "ignored" | "pending_user" | "converted_to_work_run";
export type TelegramSignalType = "bounty" | "announcement" | "risk_link" | "project_update" | "guild_task";

/**
 * Conservative update classification helper.
 * Truncates and safely previews only the first 80 characters without logging.
 */
export function classifyTelegramUpdate(update: any): TelegramUpdateClassification {
  if (!update || typeof update !== "object") {
    return { accepted: false, reason: "unsupported_update" };
  }

  const message = update.message;
  if (!message || typeof message !== "object") {
    return { accepted: false, reason: "missing_message" };
  }

  const text = message.text;
  if (typeof text !== "string" || !text.trim()) {
    return { accepted: false, reason: "unsupported_update" };
  }

  const trimmedText = text.trim();
  const contentPreview = trimmedText.length > 80 ? trimmedText.slice(0, 80) + "..." : trimmedText;

  // 1. Command detection (starts with /)
  if (trimmedText.startsWith("/")) {
    return {
      accepted: true,
      reason: "command",
      eventType: "command",
      contentPreview
    };
  }

  // 2. Mention detection (contains @GBot or @gbot)
  const containsBotMention = /@gbot\b/i.test(trimmedText);
  if (containsBotMention) {
    return {
      accepted: true,
      reason: "bot_mention",
      eventType: "mention",
      contentPreview
    };
  }

  // Reject standard group messages by default to keep permissioned boundary clean
  return {
    accepted: false,
    reason: "not_authorized_source"
  };
}

/**
 * Deduplication helper using Cloudflare KV namespace if available.
 * Keeps update_id keys cached for 5 minutes (300 seconds).
 */
export async function dedupeTelegramUpdate(
  kv: KVNamespace | undefined,
  updateId: number
): Promise<boolean> {
  if (!kv) {
    // V2.2-A Option A fallback stub: always allow if KV is not bound
    return false;
  }
  const key = `tg_update:${updateId}`;
  const existing = await kv.get(key);
  if (existing) {
    return true; // Already processed
  }
  // Store it with a 5-minute (300s) TTL
  await kv.put(key, "1", { expirationTtl: 300 });
  return false;
}

/**
 * Rate limit helper stub.
 */
export async function rateLimitTelegramSource(
  kv: KVNamespace | undefined,
  sourceKey: string
): Promise<boolean> {
  return false;
}

// ─── V2.2-F Ingestion Persistence Helpers ───

export type AcceptedTelegramWebhookEvent = {
  updateIdHash: string;
  sourceId: string;
  agentId: string;
  eventType: "mention" | "command" | "submission" | "public_signal";
  contentPreview: string;
  contentHash: string;
  messageRefHash: string | null;
  riskLevel: "low" | "medium" | "high";
};

export type TelegramOpportunitySignalDraft = {
  signalType: TelegramSignalType;
  title: string;
  summary: string;
  confidenceLevel: "low" | "medium" | "high";
  estimatedAiCreditCost: number;
  requiredSkills: string[];
  riskFlags: string[];
};

/**
 * Truncate text to a bounded preview. Never stores full text.
 */
export function extractBoundedContentPreview(text: string, maxLength: number = 120): string {
  if (!text || typeof text !== "string") return "";
  const cleaned = text.replace(/[\n\r\t]+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength) + "…";
}

/**
 * Hash update ID with optional salt. Does not echo the raw value.
 */
export async function hashTelegramUpdateId(updateId: string | number, salt?: string): Promise<string> {
  return hashTelegramIdentifier(String(updateId), salt);
}

/**
 * Hash content text with optional salt. Full text is processed in memory only.
 */
export async function hashTelegramContentPreview(text: string, salt?: string): Promise<string> {
  return hashTelegramIdentifier(text, salt);
}

/**
 * Derive a simple deterministic candidate signal from an accepted ingestion event.
 * This is NOT AI classification — it produces conservative low-confidence candidates.
 */
export function deriveSignalFromIngestionEvent(event: AcceptedTelegramWebhookEvent): TelegramOpportunitySignalDraft {
  const signalTypeMap: Record<string, TelegramSignalType> = {
    command: "guild_task",
    mention: "announcement",
    submission: "bounty",
    public_signal: "announcement"
  };

  const signalType = signalTypeMap[event.eventType] || "announcement";

  const titleMap: Record<string, string> = {
    command: "Telegram 指令候选信号",
    mention: "Telegram 提及候选信号",
    submission: "Telegram 提交候选信号",
    public_signal: "Telegram 公开候选信号"
  };

  const confidenceLevel = (event.eventType === "command" || event.eventType === "mention") ? "medium" : "low";

  return {
    signalType,
    title: titleMap[event.eventType] || "Telegram 候选信号",
    summary: event.contentPreview || "(无预览)",
    confidenceLevel,
    estimatedAiCreditCost: confidenceLevel === "medium" ? 3 : 2,
    requiredSkills: ["telegram_signal_parser"],
    riskFlags: ["needs_owner_review"]
  };
}

/**
 * Hash Telegram chat IDs server-side using SHA-256 with optional salt.
 */
export async function hashTelegramIdentifier(value: string, salt?: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const inputStr = salt ? `${value}:${salt}` : value;
    const data = encoder.encode(inputStr);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  } catch (err) {
    throw new Error("Hashing failed internally");
  }
}

/**
 * Serializes database row to external API format (camelCase, omitting raw values).
 */
export function serializeSource(row: any) {
  let permissionScope: string[] = [];
  try {
    if (typeof row.permission_scope === "string") {
      permissionScope = JSON.parse(row.permission_scope);
    } else if (Array.isArray(row.permission_scope)) {
      permissionScope = row.permission_scope;
    }
  } catch (e) {
    permissionScope = [];
  }

  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    agentId: row.agent_id,
    sourceType: row.source_type,
    telegramChatTitlePreview: row.telegram_chat_title_preview || null,
    permissionScope,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revokedAt: row.revoked_at || null
  };
}

/**
 * Serializes opportunity signal row to external API format (camelCase, array-parsed fields).
 */
export function serializeSignal(row: any) {
  let requiredSkills: string[] = [];
  try {
    if (typeof row.required_skills === "string") {
      requiredSkills = JSON.parse(row.required_skills);
    } else if (Array.isArray(row.required_skills)) {
      requiredSkills = row.required_skills;
    }
  } catch (e) {
    requiredSkills = [];
  }

  let riskFlags: string[] = [];
  try {
    if (typeof row.risk_flags === "string") {
      riskFlags = JSON.parse(row.risk_flags);
    } else if (Array.isArray(row.risk_flags)) {
      riskFlags = row.risk_flags;
    }
  } catch (e) {
    riskFlags = [];
  }

  return {
    id: row.id,
    agentId: row.agent_id,
    sourceEventId: row.source_event_id || null,
    signalType: row.signal_type,
    title: row.title,
    summary: row.summary,
    sourceUrl: row.source_url || null,
    confidenceLevel: row.confidence_level,
    estimatedAiCreditCost: Number(row.estimated_ai_credit_cost || 0),
    requiredSkills,
    riskFlags,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function registerV1Telegram(app: Hono<{ Bindings: Bindings }>) {
  const PREFIX = "/v1/telegram";

  // --- Webhook Endpoint ---
  app.post(`${PREFIX}/webhook`, async (c) => {
    // 1. Enforce payload size limit (64 KB = 65536 Bytes)
    const contentLengthHeader = c.req.header("content-length");
    if (contentLengthHeader) {
      const size = parseInt(contentLengthHeader, 10);
      if (!isNaN(size) && size > 65536) {
        return c.json({ ok: false, error: "payload_too_large" }, 413);
      }
    }

    // 2. Secret configuration validation
    const serverSecret = c.env.TELEGRAM_WEBHOOK_SECRET;
    if (!serverSecret || !serverSecret.trim()) {
      return c.json({ ok: false, error: "configuration_error" }, 503);
    }

    // 3. Header verification
    const clientSecret = c.req.header("X-Telegram-Bot-Api-Secret-Token");
    if (!clientSecret || clientSecret !== serverSecret) {
      return c.json({ ok: false, error: "unauthorized" }, 401);
    }

    // 4. Parse request payload
    let update: any;
    try {
      update = await c.req.json();
    } catch (err) {
      return c.json({ ok: false, error: "bad_request" }, 400);
    }

    const updateId = Number(update.update_id);
    if (isNaN(updateId)) {
      return c.json({ ok: false, error: "bad_request" }, 400);
    }

    // 5. Deduplication check
    const isDuplicate = await dedupeTelegramUpdate(c.env.KV, updateId);
    if (isDuplicate) {
      return c.json({
        ok: true,
        status: "accepted",
        mode: "skeleton",
        handled: false,
        reason: "duplicate"
      });
    }

    // 6. Classification of update intent
    const classification = classifyTelegramUpdate(update);

    if (!classification.accepted) {
      return c.json({
        ok: true,
        status: "ignored",
        reason: classification.reason,
        handled: false
      });
    }

    // 7. Determine source chat hash and look up authorized source
    const chatId = update.message?.chat?.id;
    if (!chatId) {
      return c.json({
        ok: true,
        status: "ignored",
        reason: "missing_chat_id",
        handled: false
      });
    }

    const chatHash = await hashTelegramIdentifier(String(chatId), c.env.TELEGRAM_IDENTIFIER_HASH_SALT);

    const sourceRow = await c.env.DB.prepare(`
      SELECT * FROM telegram_authorized_sources
      WHERE telegram_chat_id_hash = ?
      AND status = 'authorized'
      LIMIT 1
    `).bind(chatHash).first();

    if (!sourceRow) {
      return c.json({
        ok: true,
        status: "ignored",
        reason: "not_authorized_source",
        handled: false
      });
    }

    // 8. Build accepted event structure
    const rawText = update.message?.text || "";
    const updateIdHash = await hashTelegramUpdateId(updateId, c.env.TELEGRAM_IDENTIFIER_HASH_SALT);
    const contentPreview = extractBoundedContentPreview(rawText, 120);
    const contentHash = await hashTelegramContentPreview(rawText, c.env.TELEGRAM_IDENTIFIER_HASH_SALT);
    const messageId = update.message?.message_id;
    const messageRefHash = messageId
      ? await hashTelegramIdentifier(`${chatId}:${messageId}`, c.env.TELEGRAM_IDENTIFIER_HASH_SALT)
      : null;

    const acceptedEvent: AcceptedTelegramWebhookEvent = {
      updateIdHash,
      sourceId: sourceRow.id as string,
      agentId: sourceRow.agent_id as string,
      eventType: classification.eventType!,
      contentPreview,
      contentHash,
      messageRefHash,
      riskLevel: "low"
    };

    // 9. Insert telegram_ingestion_events
    const eventId = `evt_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    await c.env.DB.prepare(`
      INSERT INTO telegram_ingestion_events (
        id, source_id, agent_id, event_type, telegram_update_id_hash,
        message_ref_hash, content_preview, content_hash, risk_level, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?)
    `).bind(
      eventId,
      acceptedEvent.sourceId,
      acceptedEvent.agentId,
      acceptedEvent.eventType,
      acceptedEvent.updateIdHash,
      acceptedEvent.messageRefHash,
      acceptedEvent.contentPreview,
      acceptedEvent.contentHash,
      acceptedEvent.riskLevel,
      now
    ).run();

    // 10. Create candidate opportunity signal
    const signalDraft = deriveSignalFromIngestionEvent(acceptedEvent);
    const signalId = `sig_${crypto.randomUUID()}`;

    await c.env.DB.prepare(`
      INSERT INTO telegram_opportunity_signals (
        id, agent_id, source_event_id, signal_type, title, summary,
        source_url, confidence_level, estimated_ai_credit_cost,
        required_skills, risk_flags, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 'candidate', ?, ?)
    `).bind(
      signalId,
      acceptedEvent.agentId,
      eventId,
      signalDraft.signalType,
      signalDraft.title,
      signalDraft.summary,
      signalDraft.confidenceLevel,
      signalDraft.estimatedAiCreditCost,
      JSON.stringify(signalDraft.requiredSkills),
      JSON.stringify(signalDraft.riskFlags),
      now,
      now
    ).run();

    // 11. Update ingestion event status
    await c.env.DB.prepare(
      "UPDATE telegram_ingestion_events SET status = 'converted_to_signal' WHERE id = ?"
    ).bind(eventId).run();

    return c.json({
      ok: true,
      status: "accepted",
      mode: "ingestion_persistence_mvp",
      handled: true,
      eventId,
      signalId
    });
  });

  // --- Source Settings Endpoints ---

  // 1. GET /v1/telegram/sources
  app.get(`${PREFIX}/sources`, async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.query("agentId");
    const status = c.req.query("status");

    let query = "SELECT * FROM telegram_authorized_sources WHERE owner_user_id = ?";
    const params: any[] = [user.id];

    if (agentId) {
      query += " AND agent_id = ?";
      params.push(agentId);
    }
    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY created_at DESC";

    const rows = await c.env.DB.prepare(query).bind(...params).all();
    const sources = (rows.results || []).map(serializeSource);

    return c.json({ sources });
  });

  // 2. POST /v1/telegram/sources
  app.post(`${PREFIX}/sources`, async (c) => {
    const user = await requireUser(c);

    let body: any;
    try {
      body = await c.req.json();
    } catch (err) {
      return c.json({ ok: false, error: "bad_request" }, 400);
    }

    const { agentId, sourceType, telegramChatId, telegramChatTitlePreview, permissionScope, status } = body;

    // Validate required fields
    if (!agentId || !sourceType || !status) {
      return c.json({ ok: false, error: "missing_required_fields" }, 400);
    }

    // Validate sourceType enum
    const validSourceTypes: TelegramSourceType[] = ["group", "channel", "user_submission", "bot_mention", "public_link"];
    if (!validSourceTypes.includes(sourceType)) {
      return c.json({ ok: false, error: "invalid_source_type" }, 400);
    }

    // Validate status enum
    const validStatuses: TelegramSourceStatus[] = ["pending", "authorized", "revoked", "disabled"];
    if (!validStatuses.includes(status)) {
      return c.json({ ok: false, error: "invalid_status" }, 400);
    }

    // Validate permissionScope
    if (permissionScope && !Array.isArray(permissionScope)) {
      return c.json({ ok: false, error: "permission_scope_must_be_array" }, 400);
    }

    // Verify user owns the agent
    const agent = await c.env.DB.prepare("SELECT user_id FROM agents WHERE id = ?").bind(agentId).first<{ user_id: string }>();
    if (!agent || agent.user_id !== user.id) {
      return c.json({ ok: false, error: "forbidden_agent" }, 403);
    }

    // Compute single-way SHA-256 hash for raw chat ID
    let chatHash: string | null = null;
    if (telegramChatId) {
      chatHash = await hashTelegramIdentifier(String(telegramChatId), c.env.TELEGRAM_IDENTIFIER_HASH_SALT);
    }

    const id = `src_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const permissionScopeStr = JSON.stringify(permissionScope || []);

    await c.env.DB.prepare(`
      INSERT INTO telegram_authorized_sources (
        id, owner_user_id, agent_id, source_type, telegram_chat_id_hash, 
        telegram_chat_title_preview, permission_scope, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, user.id, agentId, sourceType, chatHash, 
      telegramChatTitlePreview || null, permissionScopeStr, status, createdAt, createdAt
    ).run();

    const createdRow = await c.env.DB.prepare("SELECT * FROM telegram_authorized_sources WHERE id = ?").bind(id).first();
    return c.json(serializeSource(createdRow), 201);
  });

  // 3. PATCH /v1/telegram/sources/:id
  app.patch(`${PREFIX}/sources/:id`, async (c) => {
    const user = await requireUser(c);
    const id = c.req.param("id");

    let body: any;
    try {
      body = await c.req.json();
    } catch (err) {
      return c.json({ ok: false, error: "bad_request" }, 400);
    }

    // Check existence and ownership
    const existing = await c.env.DB.prepare("SELECT * FROM telegram_authorized_sources WHERE id = ?").bind(id).first();
    if (!existing) {
      return c.json({ ok: false, error: "not_found" }, 404);
    }
    if (existing.owner_user_id !== user.id) {
      return c.json({ ok: false, error: "forbidden" }, 403);
    }

    const { status, telegramChatTitlePreview, permissionScope } = body;

    let query = "UPDATE telegram_authorized_sources SET updated_at = ?";
    const params: any[] = [new Date().toISOString()];

    if (status) {
      const validStatuses: TelegramSourceStatus[] = ["pending", "authorized", "revoked", "disabled"];
      if (!validStatuses.includes(status)) {
        return c.json({ ok: false, error: "invalid_status" }, 400);
      }
      query += ", status = ?";
      params.push(status);

      // Handle revoked_at lifecycle
      if (status === "revoked") {
        query += ", revoked_at = ?";
        params.push(new Date().toISOString());
      } else if (existing.status === "revoked" && status === "authorized") {
        query += ", revoked_at = NULL";
      }
    }

    if (telegramChatTitlePreview !== undefined) {
      query += ", telegram_chat_title_preview = ?";
      params.push(telegramChatTitlePreview);
    }

    if (permissionScope !== undefined) {
      if (!Array.isArray(permissionScope)) {
        return c.json({ ok: false, error: "permission_scope_must_be_array" }, 400);
      }
      query += ", permission_scope = ?";
      params.push(JSON.stringify(permissionScope));
    }

    query += " WHERE id = ?";
    params.push(id);

    await c.env.DB.prepare(query).bind(...params).run();

    const updatedRow = await c.env.DB.prepare("SELECT * FROM telegram_authorized_sources WHERE id = ?").bind(id).first();
    return c.json(serializeSource(updatedRow));
  });

  // 4. DELETE /v1/telegram/sources/:id
  app.delete(`${PREFIX}/sources/:id`, async (c) => {
    const user = await requireUser(c);
    const id = c.req.param("id");

    const existing = await c.env.DB.prepare("SELECT * FROM telegram_authorized_sources WHERE id = ?").bind(id).first();
    if (!existing) {
      return c.json({ ok: false, error: "not_found" }, 404);
    }
    if (existing.owner_user_id !== user.id) {
      return c.json({ ok: false, error: "forbidden" }, 403);
    }

    // Prefer soft delete: status = 'revoked', revoked_at = current timestamp
    const now = new Date().toISOString();
    await c.env.DB.prepare(`
      UPDATE telegram_authorized_sources 
      SET status = 'revoked', revoked_at = ?, updated_at = ? 
      WHERE id = ?
    `).bind(now, now, id).run();

    return c.json({ ok: true, status: "revoked" });
  });

  // --- Opportunity Signal Endpoints ---

  // 1. GET /v1/telegram/opportunity-signals
  app.get(`${PREFIX}/opportunity-signals`, async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.query("agentId");
    const status = c.req.query("status");
    const signalType = c.req.query("signalType");

    // Scope query by checking agent ownership
    let query = `
      SELECT s.* FROM telegram_opportunity_signals s
      JOIN agents a ON s.agent_id = a.id
      WHERE a.user_id = ?
    `;
    const params: any[] = [user.id];

    if (agentId) {
      query += " AND s.agent_id = ?";
      params.push(agentId);
    }
    if (status) {
      // Validate status
      const validStatuses: TelegramSignalStatus[] = ["candidate", "ignored", "pending_user", "converted_to_work_run"];
      if (!validStatuses.includes(status as TelegramSignalStatus)) {
        return c.json({ ok: false, error: "invalid_status" }, 400);
      }
      query += " AND s.status = ?";
      params.push(status);
    }
    if (signalType) {
      // Validate signalType
      const validTypes: TelegramSignalType[] = ["bounty", "announcement", "risk_link", "project_update", "guild_task"];
      if (!validTypes.includes(signalType as TelegramSignalType)) {
        return c.json({ ok: false, error: "invalid_signal_type" }, 400);
      }
      query += " AND s.signal_type = ?";
      params.push(signalType);
    }

    query += " ORDER BY s.created_at DESC";

    const rows = await c.env.DB.prepare(query).bind(...params).all();
    const signals = (rows.results || []).map(serializeSignal);

    return c.json({ signals });
  });

  // 2. GET /v1/telegram/opportunity-signals/:id
  app.get(`${PREFIX}/opportunity-signals/:id`, async (c) => {
    const user = await requireUser(c);
    const id = c.req.param("id");

    const row = await c.env.DB.prepare(`
      SELECT s.* FROM telegram_opportunity_signals s
      JOIN agents a ON s.agent_id = a.id
      WHERE s.id = ? AND a.user_id = ?
    `).bind(id, user.id).first();

    if (!row) {
      return c.json({ ok: false, error: "not_found" }, 404);
    }

    return c.json(serializeSignal(row));
  });

  // 3. POST /v1/telegram/opportunity-signals/:id/ignore
  app.post(`${PREFIX}/opportunity-signals/:id/ignore`, async (c) => {
    const user = await requireUser(c);
    const id = c.req.param("id");

    const row = await c.env.DB.prepare(`
      SELECT s.* FROM telegram_opportunity_signals s
      JOIN agents a ON s.agent_id = a.id
      WHERE s.id = ? AND a.user_id = ?
    `).bind(id, user.id).first();

    if (!row) {
      return c.json({ ok: false, error: "not_found" }, 404);
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare("UPDATE telegram_opportunity_signals SET status = 'ignored', updated_at = ? WHERE id = ?")
      .bind(now, id).run();

    const updated = await c.env.DB.prepare("SELECT * FROM telegram_opportunity_signals WHERE id = ?").bind(id).first();
    return c.json(serializeSignal(updated));
  });

  // 4. POST /v1/telegram/opportunity-signals/:id/require-user
  app.post(`${PREFIX}/opportunity-signals/:id/require-user`, async (c) => {
    const user = await requireUser(c);
    const id = c.req.param("id");

    const row = await c.env.DB.prepare(`
      SELECT s.* FROM telegram_opportunity_signals s
      JOIN agents a ON s.agent_id = a.id
      WHERE s.id = ? AND a.user_id = ?
    `).bind(id, user.id).first();

    if (!row) {
      return c.json({ ok: false, error: "not_found" }, 404);
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare("UPDATE telegram_opportunity_signals SET status = 'pending_user', updated_at = ? WHERE id = ?")
      .bind(now, id).run();

    const updated = await c.env.DB.prepare("SELECT * FROM telegram_opportunity_signals WHERE id = ?").bind(id).first();
    return c.json(serializeSignal(updated));
  });

  // 5. POST /v1/telegram/opportunity-signals/:id/convert
  app.post(`${PREFIX}/opportunity-signals/:id/convert`, async (c) => {
    const user = await requireUser(c);
    const id = c.req.param("id");

    const row = await c.env.DB.prepare(`
      SELECT s.* FROM telegram_opportunity_signals s
      JOIN agents a ON s.agent_id = a.id
      WHERE s.id = ? AND a.user_id = ?
    `).bind(id, user.id).first();

    if (!row) {
      return c.json({ ok: false, error: "not_found" }, 404);
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare("UPDATE telegram_opportunity_signals SET status = 'converted_to_work_run', updated_at = ? WHERE id = ?")
      .bind(now, id).run();

    const updated = await c.env.DB.prepare("SELECT * FROM telegram_opportunity_signals WHERE id = ?").bind(id).first();

    // V2.2-D requirement: Must not create a real WorkRun yet. Return state-only placeholder response format.
    return c.json({
      signal: serializeSignal(updated),
      workRun: null,
      mode: "conversion_state_only"
    });
  });
}
