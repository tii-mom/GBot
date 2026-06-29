import { Hono, Context } from "hono";
import { Bindings } from "./core";

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
  // Option A stub: always allow. Real rate limit will be implemented in subsequent phases.
  return false;
}

export function registerV1Telegram(app: Hono<{ Bindings: Bindings }>) {
  const PREFIX = "/v1/telegram";

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
      // Configuration error (Do not reveal secret availability details to client)
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

    // V2.2-A Security Rule: Do not trigger real actions or store content in this skeletal phase.
    return c.json({
      ok: true,
      status: "accepted",
      mode: "skeleton",
      handled: classification.accepted,
      reason: classification.reason
    });
  });
}
