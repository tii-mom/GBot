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

    return c.json({
      ok: true,
      status: "accepted",
      mode: "skeleton",
      handled: classification.accepted,
      reason: classification.reason
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
}
