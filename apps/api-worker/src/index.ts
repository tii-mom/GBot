import { Context, Hono } from "hono";
import type {
  Agent,
  BoxSupply,
  DropPoolSummary,
  FomoSnapshot,
  GroupPool,
  InventoryItem,
  ItemCategory,
  LeaderboardRow,
  MarketSection,
  MarketStats,
  MarketplaceListing,
  RecentDrop,
  MeResponse,
  RankTier,
  Rarity,
  RiskStatus,
  Task,
  User,
  AgentModelConfig,
  AgentPromptTemplate,
  AgentModelCallLog,
  AgentProviderAllowlist,
  AiGuideResponse,
  TaskRecommendationResponse
} from "@growthbot/shared";

type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  JOBS: Queue;
  ASSETS: R2Bucket;
  APP_ENV: string;
  MINIAPP_ORIGIN: string;
  ADMIN_ORIGIN: string;
  TELEGRAM_BOT_TOKEN?: string;
  ADMIN_TOKEN?: string;
  JWT_SECRET?: string;
  ADMIN_JWT_SECRET?: string;
  MODEL_CONFIG_SECRET?: string;
};

type AdminSession = {
  username: string;
  issuedAt: number;
  expiresAt: number;
};

type AdminAuditRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata_json: string | null;
  created_at: string;
};

type DbUser = {
  id: string;
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  language_code: string | null;
  entry_source?: string | null;
  risk_status: RiskStatus;
  studio_enabled?: number;
  plan_tier?: string;
};

type DbAgent = {
  id: string;
  user_id: string;
  name: string;
  level: number;
  energy: number;
  max_energy: number;
  auto_run_until: string | null;
  status: string;
};

type DbInventoryItem = {
  id: string;
  owner_user_id: string;
  item_type: InventoryItem["type"];
  name: string;
  rarity: Rarity;
  status: InventoryItem["status"];
  transferable: number;
  soulbound: number;
  expires_at: string | null;
  metadata_json: string | null;
};

type DbTask = {
  id: string;
  project_id: string | null;
  code: string;
  name: string;
  description: string | null;
  energy_cost: number;
  base_pending_points: number;
  requires_wallet: number;
  auto_executable: number;
  ends_at: string | null;
  status: string;
  metadata_json: string | null;
};

type DbListing = {
  id: string;
  seller_user_id: string;
  inventory_item_id: string;
  price: string;
  currency: string;
  status: string;
  expires_at: string | null;
  name: string;
  rarity: Rarity;
  username: string | null;
  metadata_json?: string | null;
};

type AdminBoxRow = {
  id: string;
  key: string;
  name: string;
  status: string;
  rarity: Rarity;
  total_supply: number;
  remaining_supply: number;
  daily_release: number;
  acquisition_route: string;
  starts_at: string | null;
  ends_at: string | null;
  transferable_before_open: number;
  binding_strategy: string;
  created_at: string;
  updated_at: string;
};

type AdminAssetRow = {
  id: string;
  key: string;
  name: string;
  category: ItemCategory;
  rarity: Rarity;
  status: string;
  transferable: number;
  default_expiry_hours: number | null;
  default_uses: number | null;
  effect: string;
  applicable_tasks_json: string | null;
  applicable_boxes_json: string | null;
  requires_wallet: number;
};

type DropPoolRow = {
  id: string;
  asset_name: string;
  category: ItemCategory;
  rarity: Rarity;
  weight: number;
  min_quantity: number;
  max_quantity: number;
  uses_remaining: number | null;
  expiry_hours: number | null;
  transferable: number;
  soulbound: number;
  effect: string;
  requires_wallet: number;
  project_id: string | null;
  metadata_json: string | null;
};

type MarketRulesRow = {
  platform_fee_percent: number;
  min_price: string;
  max_price: string;
  listing_expiry_days: number;
  allow_starter_box_trade: number;
  allow_project_box_trade: number;
  market_paused: number;
  cancel_rules: string;
};

type ParsedResult<T> = { value: T } | { error: { error: string; message: string } };

type TelegramAuthResult = {
  telegramId: string;
  username: string;
  firstName: string | null;
  languageCode: string;
};

const app = new Hono<{ Bindings: Bindings }>();
type AppContext = Context<{ Bindings: Bindings }>;

const DEFAULT_TELEGRAM_USER: TelegramAuthResult = {
  telegramId: "123456789",
  username: "alpha_user",
  firstName: "Alpha",
  languageCode: "en"
};

const ADMIN_PREFIX = "/admin";
const ADMIN_LOGIN_USERNAME = "yudeyou0118";

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }

  await next();

  const origin = c.req.header("origin");
  const allowed = [c.env.MINIAPP_ORIGIN, c.env.ADMIN_ORIGIN].filter(Boolean);
  const allowOrigin = origin && allowed.includes(origin) ? origin : c.env.MINIAPP_ORIGIN || "*";
  c.header("Access-Control-Allow-Origin", allowOrigin);
  c.header("Access-Control-Allow-Headers", "authorization,content-type,idempotency-key,x-telegram-init-data,x-admin-token");
  c.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
});

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: "internal_error", message: "Unexpected GrowthBot API error." }, 500);
});

app.get("/health", async (c) => {
  const seeded = await ensureSeedData(c.env.DB);
  return c.json({ ok: true, env: c.env.APP_ENV, d1: true, seeded });
});

app.post("/auth/telegram", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const auth = await resolveTelegramAuth(c, body.initData);
  const user = await getOrCreateUser(c.env.DB, auth, body.startParam ?? null);
  const agent = await getAgent(c.env.DB, user.id);
  const startParam = body.startParam ? String(body.startParam) : null;
  await trackAnalyticsEvent(c.env.DB, user.id, "mini_app_opened", "telegram_auth", {
    startParam,
    entrySource: user.entry_source || startParam || "direct"
  });
  if (startParam?.startsWith("ref_") || startParam?.startsWith("group_") || startParam === "box_report") {
    await trackAnalyticsEvent(c.env.DB, user.id, "referral_link_opened", "telegram_start", { startParam });
  }

  return c.json({
    accessToken: createDevToken(user.id),
    user: await toUser(c.env.DB, user),
    agent: agent ? await toAgent(c.env.DB, agent) : null,
    startParam: body.startParam ?? null
  });
});

app.post(`${ADMIN_PREFIX}/login`, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const adminPassword = c.env.ADMIN_TOKEN || "";
  const validUsername = username === ADMIN_LOGIN_USERNAME;
  const validPassword = password === adminPassword;
  if (!validUsername || !validPassword) {
    return c.json({ error: "admin_login_failed", message: "账号或密码不正确。" }, 401);
  }
  const session = await createAdminSession(c.env, { username, issuedAt: Date.now(), expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7 });
  return c.json({ accessToken: session, username });
});

app.get("/me", async (c) => {
  await ensureSeedData(c.env.DB);
  const user = await requireUser(c);
  const agent = await getAgent(c.env.DB, user.id);
  await trackAnalyticsEvent(c.env.DB, user.id, "mini_app_opened", "me", { entrySource: user.entry_source || "direct" });
  return c.json<MeResponse>({ user: await toUser(c.env.DB, user), agent: agent ? await toAgent(c.env.DB, agent) : null });
});

app.get("/fomo/snapshot", async (c) => {
  await ensureSeedData(c.env.DB);
  return c.json(await buildFomoSnapshot(c.env.DB));
});

app.post("/analytics/events", async (c) => {
  const user = await requireUser(c);
  const body = await c.req.json().catch(() => ({}));
  const eventName = String(body.eventName || "");
  const allowedEvents = [
    "bot_started",
    "referral_link_opened",
    "mini_app_opened",
    "miniapp_open",
    "agent_claimed",
    "starter_box_opened",
    "task_started",
    "task_submitted",
    "task_completed",
    "bounty_submitted",
    "bounty_approved",
    "bounty_review_required",
    "share_clicked",
    "share_completed",
    "share_personal_report",
    "share_box_report",
    "share_group_invite",
    "invite_joined",
    "invite_activated",
    "market_view"
  ];
  if (!allowedEvents.includes(eventName)) {
    return c.json({ error: "invalid_event", message: "Unsupported analytics event." }, 400);
  }
  await trackAnalyticsEvent(c.env.DB, user.id, eventName, body.source ? String(body.source) : null, body.properties || {}, body.sessionId ? String(body.sessionId) : null);
  return c.json({ ok: true });
});

// ==================== AGENT BOT STUDIO USER ENDPOINTS ====================

app.get("/agent/model-config", async (c) => {
  const user = await requireUser(c);
  if (!user.studio_enabled) {
    return c.json({ error: "studio_not_enabled", message: "您当前无权访问 Agent Studio，请联系管理员开通。" }, 403);
  }
  const rows = await c.env.DB.prepare(
    "SELECT * FROM agent_model_configs WHERE user_id = ? ORDER BY is_default DESC, created_at DESC"
  ).bind(user.id).all<any>();

  const config = rows.results[0];
  if (!config) {
    return c.json({ config: null });
  }
  return c.json({
    config: {
      id: config.id,
      profileName: config.profile_name,
      provider: config.provider,
      baseUrl: config.base_url,
      modelId: config.model_id,
      keyLast4: config.key_last4,
      promptTemplate: config.prompt_template,
      taskPreferencesJson: config.task_preferences_json,
      riskPreferencesJson: config.risk_preferences_json,
      dailyCallLimit: config.daily_call_limit,
      dailyCallCount: config.daily_call_count,
      isDefault: config.is_default === 1,
      status: config.status,
      createdAt: config.created_at,
      updatedAt: config.updated_at
    }
  });
});

app.post("/agent/model-config", async (c) => {
  const user = await requireUser(c);
  if (!user.studio_enabled) {
    return c.json({ error: "studio_not_enabled", message: "您当前无权访问 Agent Studio，请联系管理员开通。" }, 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const {
    id: configIdInput,
    profileName,
    provider,
    baseUrl,
    modelId,
    apiKey,
    promptTemplate,
    taskPreferencesJson,
    riskPreferencesJson,
    dailyCallLimit = 100,
    isDefault = true
  } = body;

  if (!profileName || !provider || !baseUrl || !modelId) {
    return c.json({ error: "missing_fields", message: "Missing required fields (profileName, provider, baseUrl, modelId)." }, 400);
  }

  // Base URL protocol check
  if (!baseUrl.startsWith("https://")) {
    return c.json({ error: "invalid_protocol", message: "Base URL 必须使用 https:// 协议。" }, 400);
  }

  // Base URL SSRF check
  if (!isValidBaseUrl(baseUrl)) {
    return c.json({ error: "ssrf_detected", message: "非法的或受限的 Base URL 域名。" }, 400);
  }

  // Base URL Allowlist check
  const allowlist = await c.env.DB.prepare("SELECT * FROM agent_provider_allowlist WHERE status = 'active'").all<any>();
  const inputUrl = new URL(baseUrl);
  const isAllowed = allowlist.results.some(item => {
    try {
      return new URL(item.base_url).origin === inputUrl.origin;
    } catch {
      return false;
    }
  });
  if (!isAllowed) {
    return c.json({ error: "provider_not_in_allowlist", message: "Base URL 必须来自平台白名单服务商。" }, 400);
  }

  let encryptedApiKey = null;
  let keyLast4 = null;

  const configId = configIdInput || id("config");
  const existing = await c.env.DB.prepare("SELECT * FROM agent_model_configs WHERE id = ? AND user_id = ?").bind(configId, user.id).first<any>();

  if (apiKey !== undefined && apiKey !== null && apiKey !== "") {
    let secretKey = c.env.MODEL_CONFIG_SECRET;
    if (c.env.APP_ENV !== "production" && c.req.header("x-test-no-secret") === "true") {
      secretKey = undefined;
    }
    if (!secretKey) {
      return c.json({ error: "encryption_secret_missing", message: "系统缺少密钥加密配置（MODEL_CONFIG_SECRET），无法保存 API Key。" }, 500);
    }
    encryptedApiKey = await encryptData(apiKey, secretKey);
    keyLast4 = apiKey.slice(-4);
  } else if (existing) {
    // Preserve existing credentials
    encryptedApiKey = existing.encrypted_api_key;
    keyLast4 = existing.key_last4;
  }

  const isDefaultVal = isDefault ? 1 : 0;
  if (isDefaultVal === 1) {
    // Reset all other configs for this user
    await c.env.DB.prepare("UPDATE agent_model_configs SET is_default = 0 WHERE user_id = ?").bind(user.id).run();
  }

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE agent_model_configs SET
        profile_name = ?, provider = ?, base_url = ?, model_id = ?,
        encrypted_api_key = ?, key_last4 = ?, prompt_template = ?,
        task_preferences_json = ?, risk_preferences_json = ?,
        daily_call_limit = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(
      profileName, provider, baseUrl, modelId,
      encryptedApiKey, keyLast4, promptTemplate || null,
      taskPreferencesJson || null, riskPreferencesJson || null,
      Number(dailyCallLimit), isDefaultVal, existing.id
    ).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO agent_model_configs
        (id, user_id, profile_name, provider, base_url, model_id,
         encrypted_api_key, key_last4, prompt_template,
         task_preferences_json, risk_preferences_json, daily_call_limit, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      configId, user.id, profileName, provider, baseUrl, modelId,
      encryptedApiKey, keyLast4, promptTemplate || null,
      taskPreferencesJson || null, riskPreferencesJson || null,
      Number(dailyCallLimit), isDefaultVal
    ).run();
  }

  return c.json({ success: true, id: configId });
});

app.delete("/agent/model-config", async (c) => {
  const user = await requireUser(c);
  if (!user.studio_enabled) {
    return c.json({ error: "studio_not_enabled", message: "您当前无权访问 Agent Studio，请联系管理员开通。" }, 403);
  }
  await c.env.DB.prepare("DELETE FROM agent_model_configs WHERE user_id = ?").bind(user.id).run();
  return c.json({ success: true, message: "自定义配置已完全删除。" });
});

app.post("/agent/tasks/:taskId/ai-guide", async (c) => {
  const user = await requireUser(c);
  const taskId = c.req.param("taskId");
  const task = await c.env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(taskId).first<DbTask>();
  if (!task) {
    return c.json({ error: "task_not_found", message: "Task not found." }, 404);
  }

  // Find user active default model config
  let config = await c.env.DB.prepare("SELECT * FROM agent_model_configs WHERE user_id = ? AND status = 'active' AND is_default = 1").bind(user.id).first<any>();
  if (!config) {
    config = await c.env.DB.prepare("SELECT * FROM agent_model_configs WHERE user_id = ? AND status = 'active' LIMIT 1").bind(user.id).first<any>();
  }

  if (config) {
    // Check daily limit
    const today = new Date().toISOString().split("T")[0];
    let dailyCallCount = config.daily_call_count;
    if (config.last_call_date !== today) {
      dailyCallCount = 0;
      await c.env.DB.prepare("UPDATE agent_model_configs SET daily_call_count = 0, last_call_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(today, config.id).run();
    }

    if (dailyCallCount >= config.daily_call_limit) {
      // Exceeded limit. Log failure and fallback to platform defaults
      await c.env.DB.prepare(
        "INSERT INTO agent_model_call_logs (id, user_id, config_id, purpose, input_summary, output_summary, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(id("log"), user.id, config.id, "ai_guide", "Exceeded daily call limit", "Fallback to default static template", "failed", "daily_call_limit_exceeded").run();
    } else {
      // Increment count
      await c.env.DB.prepare("UPDATE agent_model_configs SET daily_call_count = daily_call_count + 1 WHERE id = ?").bind(config.id).run();

      const systemPrompt = "You are an AI Assistant analyzing a task for GrowthBot. Determine steps, check for requirements/rules, and assess risk. Answer only in JSON matching the schema.";
      const userPrompt = `Task Title: ${task.name}\nCategory: ${task.project_id || "General"}\nDescription: ${task.description || ""}`;

      const result = await callLlmProxy(
        c.env.DB,
        user.id,
        config,
        "ai_guide",
        systemPrompt,
        userPrompt,
        c.env.MODEL_CONFIG_SECRET
      );

      if (result) {
        const validated: AiGuideResponse = {
          summary: String(result.summary || ""),
          steps: Array.isArray(result.steps) ? result.steps.map(String) : [],
          submissionHint: String(result.submissionHint || ""),
          riskLevel: ["low", "medium", "high"].includes(result.riskLevel) ? result.riskLevel : "low",
          riskNotes: Array.isArray(result.riskNotes) ? result.riskNotes.map(String) : [],
          recommended: Boolean(result.recommended),
          reason: String(result.reason || "")
        };
        return c.json(validated);
      }
    }
  }

  // Fallback
  return c.json(getFallbackAiGuide(task.name, task.project_id || "General"));
});

app.post("/agent/bounty/:taskId/ai-guide", async (c) => {
  const user = await requireUser(c);
  const taskId = c.req.param("taskId");
  const task = await c.env.DB.prepare("SELECT * FROM bounty_tasks WHERE id = ?").bind(taskId).first<any>();
  if (!task) {
    return c.json({ error: "task_not_found", message: "Bounty task not found." }, 404);
  }

  let config = await c.env.DB.prepare("SELECT * FROM agent_model_configs WHERE user_id = ? AND status = 'active' AND is_default = 1").bind(user.id).first<any>();
  if (!config) {
    config = await c.env.DB.prepare("SELECT * FROM agent_model_configs WHERE user_id = ? AND status = 'active' LIMIT 1").bind(user.id).first<any>();
  }

  if (config) {
    const today = new Date().toISOString().split("T")[0];
    let dailyCallCount = config.daily_call_count;
    if (config.last_call_date !== today) {
      dailyCallCount = 0;
      await c.env.DB.prepare("UPDATE agent_model_configs SET daily_call_count = 0, last_call_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(today, config.id).run();
    }

    if (dailyCallCount >= config.daily_call_limit) {
      await c.env.DB.prepare(
        "INSERT INTO agent_model_call_logs (id, user_id, config_id, purpose, input_summary, output_summary, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(id("log"), user.id, config.id, "bounty_ai_guide", "Exceeded daily call limit", "Fallback to default static template", "failed", "daily_call_limit_exceeded").run();
    } else {
      await c.env.DB.prepare("UPDATE agent_model_configs SET daily_call_count = daily_call_count + 1 WHERE id = ?").bind(config.id).run();

      const systemPrompt = "You are an AI Assistant analyzing a task for GrowthBot. Determine steps, check for requirements/rules, and assess risk. Answer only in JSON matching the schema.";
      const userPrompt = `Task Title: ${task.title}\nCategory: ${task.category}\nDescription: ${task.description || ""}\nTarget URL: ${task.target_url}`;

      const result = await callLlmProxy(
        c.env.DB,
        user.id,
        config,
        "bounty_ai_guide",
        systemPrompt,
        userPrompt,
        c.env.MODEL_CONFIG_SECRET
      );

      if (result) {
        const validated: AiGuideResponse = {
          summary: String(result.summary || ""),
          steps: Array.isArray(result.steps) ? result.steps.map(String) : [],
          submissionHint: String(result.submissionHint || ""),
          riskLevel: ["low", "medium", "high"].includes(result.riskLevel) ? result.riskLevel : "low",
          riskNotes: Array.isArray(result.riskNotes) ? result.riskNotes.map(String) : [],
          recommended: Boolean(result.recommended),
          reason: String(result.reason || "")
        };
        return c.json(validated);
      }
    }
  }

  return c.json(getFallbackAiGuide(task.title, task.category));
});

app.post("/agent/tasks/recommendations", async (c) => {
  const user = await requireUser(c);
  // Get active tasks
  const tasks = await c.env.DB.prepare("SELECT * FROM tasks WHERE status = 'active'").all<DbTask>();
  const bountyTasks = await c.env.DB.prepare("SELECT * FROM bounty_tasks WHERE status = 'active'").all<any>();

  const allTasks = [
    ...tasks.results.map(t => ({ id: t.id, title: t.name, category: "Normal" })),
    ...bountyTasks.results.map(t => ({ id: t.id, title: t.title, category: t.category }))
  ];

  let config = await c.env.DB.prepare("SELECT * FROM agent_model_configs WHERE user_id = ? AND status = 'active' AND is_default = 1").bind(user.id).first<any>();
  if (!config) {
    config = await c.env.DB.prepare("SELECT * FROM agent_model_configs WHERE user_id = ? AND status = 'active' LIMIT 1").bind(user.id).first<any>();
  }

  if (config) {
    const today = new Date().toISOString().split("T")[0];
    let dailyCallCount = config.daily_call_count;
    if (config.last_call_date !== today) {
      dailyCallCount = 0;
      await c.env.DB.prepare("UPDATE agent_model_configs SET daily_call_count = 0, last_call_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(today, config.id).run();
    }

    if (dailyCallCount < config.daily_call_limit) {
      await c.env.DB.prepare("UPDATE agent_model_configs SET daily_call_count = daily_call_count + 1 WHERE id = ?").bind(config.id).run();

      const systemPrompt = "Analyze the list of tasks and recommend them according to preferences. Output a JSON array containing objects with taskId and reason.";
      const userPrompt = `Preferences: ${config.task_preferences_json || "None"}. Tasks: ${JSON.stringify(allTasks)}`;

      const result = await callLlmProxy(
        c.env.DB,
        user.id,
        config,
        "recommendations",
        systemPrompt,
        userPrompt,
        c.env.MODEL_CONFIG_SECRET
      );

      if (result && Array.isArray(result)) {
        const validated = result.map(item => ({
          taskId: String(item.taskId || ""),
          reason: String(item.reason || "")
        })).filter(item => allTasks.some(t => t.id === item.taskId));

        return c.json({ recommendations: validated });
      }
    }
  }

  // Fallback
  const recommendations = allTasks.slice(0, 3).map((t, idx) => ({
    taskId: t.id,
    reason: idx === 0 ? "基于您的偏好，此任务奖励丰厚，推荐优先完成。" : "该任务步骤简单，耗时极短，适合获取基础能量积分。"
  }));
  return c.json({ recommendations });
});

// ==================== AGENT BOT STUDIO ADMIN ENDPOINTS ====================

app.get(`${ADMIN_PREFIX}/agent/model-configs`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const rows = await c.env.DB.prepare(
    "SELECT id, user_id, profile_name, provider, base_url, model_id, key_last4, daily_call_limit, daily_call_count, is_default, status, created_at, updated_at FROM agent_model_configs ORDER BY created_at DESC"
  ).all<any>();
  return c.json({ configs: rows.results });
});

app.get(`${ADMIN_PREFIX}/agent/model-call-logs`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const rows = await c.env.DB.prepare(
    "SELECT * FROM agent_model_call_logs ORDER BY created_at DESC LIMIT 100"
  ).all<any>();
  return c.json({ logs: rows.results });
});

app.get(`${ADMIN_PREFIX}/agent/prompt-templates`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const rows = await c.env.DB.prepare(
    "SELECT * FROM agent_prompt_templates ORDER BY name ASC"
  ).all<any>();
  return c.json({ templates: rows.results });
});

app.post(`${ADMIN_PREFIX}/agent/prompt-templates`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const body = await c.req.json().catch(() => ({}));
  const { name, scope, content } = body;
  if (!name || !content) {
    return c.json({ error: "missing_fields", message: "Name and Content are required." }, 400);
  }
  const existing = await c.env.DB.prepare("SELECT id FROM agent_prompt_templates WHERE name = ?").bind(name).first<any>();
  if (existing) {
    await c.env.DB.prepare(
      "UPDATE agent_prompt_templates SET scope = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(scope || "user", content, existing.id).run();
    await auditAdminConfig(c.env.DB, "update", "prompt_template", existing.id, { name });
  } else {
    const templateId = id("tmpl");
    await c.env.DB.prepare(
      "INSERT INTO agent_prompt_templates (id, name, scope, content) VALUES (?, ?, ?, ?)"
    ).bind(templateId, name, scope || "user", content).run();
    await auditAdminConfig(c.env.DB, "create", "prompt_template", templateId, { name });
  }
  return c.json({ success: true });
});

app.post(`${ADMIN_PREFIX}/agent/model-configs/:id/disable`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const idVal = c.req.param("id");
  await c.env.DB.prepare("UPDATE agent_model_configs SET status = 'disabled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(idVal).run();
  await auditAdminConfig(c.env.DB, "disable", "model_config", idVal, {});
  return c.json({ success: true });
});

app.get(`${ADMIN_PREFIX}/agent/providers`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const rows = await c.env.DB.prepare(
    "SELECT * FROM agent_provider_allowlist ORDER BY name ASC"
  ).all<any>();
  return c.json({ providers: rows.results });
});

app.post(`${ADMIN_PREFIX}/agent/providers`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const body = await c.req.json().catch(() => ({}));
  const { name, baseUrl, status } = body;
  if (!name || !baseUrl) {
    return c.json({ error: "missing_fields", message: "Name and Base URL are required." }, 400);
  }

  // Base URL protocol check
  if (!baseUrl.startsWith("https://")) {
    return c.json({ error: "invalid_protocol", message: "Base URL 必须使用 https:// 协议。" }, 400);
  }

  // Base URL SSRF check
  if (!isValidBaseUrl(baseUrl)) {
    return c.json({ error: "ssrf_detected", message: "非法的或受限的 Base URL 域名。" }, 400);
  }

  const existing = await c.env.DB.prepare("SELECT id FROM agent_provider_allowlist WHERE base_url = ?").bind(baseUrl).first<any>();
  if (existing) {
    await c.env.DB.prepare(
      "UPDATE agent_provider_allowlist SET name = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(name, status || "active", existing.id).run();
    await auditAdminConfig(c.env.DB, "update", "provider", existing.id, { name, baseUrl });
  } else {
    const providerId = id("prov");
    await c.env.DB.prepare(
      "INSERT INTO agent_provider_allowlist (id, name, base_url, status) VALUES (?, ?, ?, ?)"
    ).bind(providerId, name, baseUrl, status || "active").run();
    await auditAdminConfig(c.env.DB, "create", "provider", providerId, { name, baseUrl });
  }
  return c.json({ success: true });
});


app.post("/agents/claim", async (c) => {
  await ensureSeedData(c.env.DB);
  const user = await requireUser(c);
  const existing = await getAgent(c.env.DB, user.id);
  if (existing) {
    const starter = await getStarterBox(c.env.DB, user.id);
    return c.json({ agent: await toAgent(c.env.DB, existing), starterBox: starter });
  }

  const agentId = id("agent");
  const boxId = id("item");

  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO agents (id, user_id, name, level, energy, max_energy, status) VALUES (?, ?, ?, 1, 100, 150, 'active')"
    ).bind(agentId, user.id, `Agent #${user.telegram_id.slice(-4)}`),
    c.env.DB.prepare(
      "INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound) VALUES (?, ?, 'box', 'Starter Box', 'common', 'available', 0, 1)"
    ).bind(boxId, user.id),
    ledger(c.env.DB, user.id, agentId, "agent_claim", "user_score", 0, null, agentId, { starterBoxId: boxId })
  ]);
  await trackAnalyticsEvent(c.env.DB, user.id, "agent_claimed", "claim", { starterBoxId: boxId });
  if (user.entry_source?.startsWith("ref_") || user.entry_source?.startsWith("group_") || user.entry_source === "box_report") {
    await trackAnalyticsEvent(c.env.DB, user.id, "invite_joined", "claim", { startParam: user.entry_source });
  }

  const agent = await getAgent(c.env.DB, user.id);
  const starterBox = await getInventoryItem(c.env.DB, boxId, user.id);
  return c.json({ agent: await toAgent(c.env.DB, agent!), starterBox: toInventoryItem(starterBox!) });
});

app.get("/inventory", async (c) => {
  const user = await requireUser(c);
  await releaseCooledDownSkillCards(c.env.DB, user.id);
  const rows = await c.env.DB.prepare(
    "SELECT * FROM inventory_items WHERE owner_user_id = ? AND status != 'burned' ORDER BY created_at DESC"
  ).bind(user.id).all<DbInventoryItem>();
  return c.json({ items: rows.results.map(toInventoryItem) });
});

app.post("/inventory/:itemId/learn", async (c) => {
  const user = await requireUser(c);
  const itemId = c.req.param("itemId");
  const item = await getInventoryItem(c.env.DB, itemId, user.id);
  if (!item || item.item_type !== "ability" || item.status !== "available") {
    return c.json({ error: "item_not_available", message: "Skill card is not available for learning." }, 400);
  }

  const meta = parseJson<Record<string, unknown>>(item.metadata_json, {});
  const originalTransferable = typeof meta.originalTransferable === "boolean" ? meta.originalTransferable : item.transferable === 1;
  const nextMeta = {
    ...meta,
    originalTransferable,
    learnStatus: "equipped",
    cooldownUntil: null
  };

  await c.env.DB.prepare(
    "UPDATE inventory_items SET status = 'active', transferable = 0, metadata_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(JSON.stringify(nextMeta), itemId).run();

  const updatedItem = await getInventoryItem(c.env.DB, itemId, user.id);
  return c.json({ item: toInventoryItem(updatedItem!) });
});

app.post("/inventory/:itemId/unequip", async (c) => {
  const user = await requireUser(c);
  const itemId = c.req.param("itemId");
  const item = await getInventoryItem(c.env.DB, itemId, user.id);
  if (!item || item.item_type !== "ability" || item.status !== "active") {
    return c.json({ error: "item_not_equipped", message: "Skill card is not equipped." }, 400);
  }

  const meta = parseJson<Record<string, unknown>>(item.metadata_json, {});
  const cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const nextMeta = {
    ...meta,
    originalTransferable: typeof meta.originalTransferable === "boolean" ? meta.originalTransferable : item.transferable === 1,
    learnStatus: "unlearned",
    cooldownUntil
  };

  await c.env.DB.prepare(
    "UPDATE inventory_items SET status = 'cooling_down', transferable = 0, metadata_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(JSON.stringify(nextMeta), itemId).run();
  await trackAnalyticsEvent(c.env.DB, user.id, "skill_card_unequipped", "inventory", { itemId, cooldownUntil });

  const updatedItem = await getInventoryItem(c.env.DB, itemId, user.id);
  return c.json({ item: toInventoryItem(updatedItem!) });
});

app.post("/boxes/:inventoryItemId/open", async (c) => {
  const user = await requireUser(c);
  const risk = requireEconomyAllowed(user, "open_box");
  if (risk) return c.json(risk, 423);
  const agent = await requireAgent(c.env.DB, user.id);
  if (await isControlPaused(c.env.KV, "boxes")) {
    return c.json({ error: "boxes_paused", message: "Box openings are temporarily paused." }, 423);
  }
  const inventoryItemId = c.req.param("inventoryItemId");
  const box = await getInventoryItem(c.env.DB, inventoryItemId, user.id);

  if (!box || box.item_type !== "box" || box.status !== "available") {
    return c.json({ error: "box_not_available", message: "Box is not available." }, 400);
  }

  const rewards = rollBoxRewards(box.name);

  const points = rewards.find((reward) => reward.type === "pending_points")?.amount ?? 0;
  const energy = rewards.find((reward) => reward.type === "energy")?.amount ?? 0;
  const abilityReward = rewards.find((reward) => reward.type === "ability");
  const nextEnergy = Math.min(agent.max_energy, agent.energy + energy);
  const openingId = id("opening");

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare("UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ?").bind(box.id, user.id),
    c.env.DB.prepare("UPDATE agents SET energy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(nextEnergy, agent.id),
    ledger(c.env.DB, user.id, agent.id, "box_open", "pending_points", points, null, openingId, {
      boxId: box.id,
      boxName: box.name,
      rewardName: abilityReward?.name,
      rarity: abilityReward?.rarity
    }),
    ledger(c.env.DB, user.id, agent.id, "box_open", "user_score", Math.floor(points * 0.8), null, openingId, { boxId: box.id, boxName: box.name })
  ];

  if (energy > 0) {
    statements.push(ledger(c.env.DB, user.id, agent.id, "box_open", "energy", energy, null, openingId, { boxId: box.id }));
  }

  if (abilityReward?.itemId) {
    const cardNumber = await getNextCardNumber(c.env.DB, c.env.KV);
    const effectPlainText = abilityEffect(abilityReward.name || "");
    const encryptedEffect = await encryptData(effectPlainText, c.env.JWT_SECRET || "growthbot-secret");
    const seriesVal = box.name.replace(" Box", "");
    statements.push(
      c.env.DB.prepare(
        "INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, expires_at, metadata_json) VALUES (?, ?, 'ability', ?, ?, 'available', ?, ?, ?, ?)"
      ).bind(
        abilityReward.itemId,
        user.id,
        abilityReward.name,
        abilityReward.rarity,
        box.name === "Starter Box" ? 0 : 1,
        box.name === "Starter Box" ? 1 : 0,
        new Date(Date.now() + 86_400_000).toISOString(),
        JSON.stringify({
          usesRemaining: abilityUses(abilityReward.name || ""),
          effect: encryptedEffect,
          sourceBox: box.name,
          tradableAfterOpen: box.name !== "Starter Box",
          category: abilityReward.category || categoryForAsset(abilityReward.name || ""),
          cardNumber,
          series: seriesVal,
          learnStatus: "unlearned"
        })
      )
    );
  }

  await c.env.DB.batch(statements);
  await trackAnalyticsEvent(c.env.DB, user.id, box.name === "Starter Box" ? "starter_box_opened" : "box_opened", "box_open", {
    boxId: box.id,
    boxName: box.name,
    openingId,
    rewardName: abilityReward?.name || null
  });
  if (box.name === "Starter Box" && (user.entry_source?.startsWith("ref_") || user.entry_source?.startsWith("group_") || user.entry_source === "box_report")) {
    await trackAnalyticsEvent(c.env.DB, user.id, "invite_activated", "starter_box", { startParam: user.entry_source });
  }
  const updatedAgent = await getAgent(c.env.DB, user.id);

  return c.json({
    openingId,
    box: { id: box.id, name: box.name },
    rewards,
    agent: await toAgent(c.env.DB, updatedAgent!)
  });
});

app.get("/tasks/available", async (c) => {
  if (await isControlPaused(c.env.KV, "tasks")) {
    return c.json({ tasks: [] });
  }
  await ensureSeedData(c.env.DB);
  const rows = await c.env.DB.prepare(
    "SELECT * FROM tasks WHERE status = 'active' AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP) AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP) ORDER BY energy_cost ASC"
  ).all<DbTask>();
  return c.json({ tasks: rows.results.map(toTask) });
});

app.post("/tasks/:taskId/submit", async (c) => {
  const user = await requireUser(c);
  const taskId = c.req.param("taskId");
  const body = await c.req.json().catch(() => ({}));
  const link = String(body.link || "").trim();

  if (!link) {
    return c.json({ error: "link_required", message: "Please provide a completion link." }, 400);
  }

  const task = await c.env.DB.prepare("SELECT * FROM tasks WHERE id = ? AND status = 'active'").bind(taskId).first<DbTask>();
  if (!task) {
    return c.json({ error: "task_not_found", message: "Task not found or inactive." }, 404);
  }

  const existing = await c.env.DB.prepare(
    "SELECT id, status, link FROM task_verifications WHERE task_id = ? AND user_id = ?"
  ).bind(taskId, user.id).first<{ id: string; status: string; link: string }>();

  if (existing) {
    if (existing.status === "approved") {
      return c.json({ error: "task_already_approved", message: "该任务已经验收通过，不能重复提交。" }, 409);
    }
    await c.env.DB.prepare(
      "UPDATE task_verifications SET link = ?, status = 'submitted', created_at = CURRENT_TIMESTAMP, verified_at = NULL, feedback = NULL WHERE id = ?"
    ).bind(link, existing.id).run();
  } else {
    const verifId = id("verif");
    await c.env.DB.prepare(
      "INSERT INTO task_verifications (id, task_id, user_id, link, status) VALUES (?, ?, ?, ?, 'submitted')"
    ).bind(verifId, taskId, user.id, link).run();
  }

  await trackAnalyticsEvent(c.env.DB, user.id, "task_submitted", "task_link", { taskId, linkHost: safeLinkHost(link) });
  return c.json({ status: "submitted", link });
});

app.post("/tasks/:taskId/verify", async (c) => {
  const user = await requireUser(c);
  const taskId = c.req.param("taskId");
  const agent = await requireAgent(c.env.DB, user.id);

  const body = await c.req.json().catch(() => ({}));
  const abilityItemIds = Array.isArray(body.abilityItemIds) ? body.abilityItemIds as string[] : [];

  const verif = await c.env.DB.prepare(
    "SELECT * FROM task_verifications WHERE task_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(taskId, user.id).first<any>();

  if (!verif) {
    return c.json({ error: "no_submission", message: "No link submitted for this task yet." }, 400);
  }

  if (verif.status === "approved") {
    return c.json({ status: "approved", message: "Task is already approved." });
  }

  await c.env.DB.prepare(
    "UPDATE task_verifications SET status = 'verifying', feedback = NULL WHERE id = ?"
  ).bind(verif.id).run();

  const task = await c.env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(taskId).first<DbTask>();
  if (!task) {
    return c.json({ error: "task_not_found", message: "Task not found." }, 404);
  }

  if (agent.energy < task.energy_cost) {
    return c.json({ error: "insufficient_energy", message: "Insufficient energy to verify task." }, 400);
  }

  let isValid = false;
  const taskCode = task.code.toLowerCase();

  if (taskCode.includes("twitter") || taskCode.includes("x_follow") || taskCode.includes("alpha_radar")) {
    const xPattern = /^https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_]+/i;
    isValid = xPattern.test(verif.link);
  } else if (taskCode.includes("telegram") || taskCode.includes("daily_checkin")) {
    const tgPattern = /^https?:\/\/(www\.)?t\.me\/[a-zA-Z0-9_]+/i;
    isValid = tgPattern.test(verif.link) || verif.link.startsWith("@");
  } else if (taskCode.includes("discord") || taskCode.includes("crew_mission")) {
    const dcPattern = /^https?:\/\/(www\.)?(discord\.gg|discord\.com)\/[a-zA-Z0-9_-]+/i;
    isValid = dcPattern.test(verif.link);
  } else {
    const urlPattern = /^https?:\/\/[^\s$.?#].[^\s]*$/i;
    isValid = urlPattern.test(verif.link);
  }

  if (!isValid) {
    await c.env.DB.prepare(
      "UPDATE task_verifications SET status = 'rejected', feedback = 'Link format invalid for target platform.', verified_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(verif.id).run();
    return c.json({ status: "rejected", feedback: "Link format invalid for target platform." }, 400);
  }

  const abilityRows = abilityItemIds.length
    ? await c.env.DB.prepare(
        `SELECT * FROM inventory_items WHERE id IN (${abilityItemIds.map(() => "?").join(",")}) AND owner_user_id = ? AND status = 'available'`
      ).bind(...abilityItemIds, user.id).all<DbInventoryItem>()
    : { results: [] as DbInventoryItem[] };

  const appliedMultiplier = abilityRows.results.reduce((multiplier, ability) => {
    if (ability.name.includes("3x")) return Math.max(multiplier, 3);
    if (ability.name.includes("2x")) return Math.max(multiplier, 2);
    if (ability.name.includes("Task Reroll")) return Math.max(multiplier, 1.5);
    if (ability.name.includes("Alpha Radar")) return Math.max(multiplier, 1.35);
    return multiplier;
  }, 1);

  const pendingPointsEarned = Math.floor(task.base_pending_points * appliedMultiplier);
  const runId = id("run");

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare("UPDATE task_verifications SET status = 'approved', verified_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'approved'").bind(verif.id),
    c.env.DB.prepare("UPDATE agents SET energy = energy - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(task.energy_cost, agent.id),
    ledger(c.env.DB, user.id, agent.id, "task_verify", "pending_points", pendingPointsEarned, null, runId, { taskId }),
    ledger(c.env.DB, user.id, agent.id, "task_verify", "user_score", Math.floor(pendingPointsEarned * 0.8), null, runId, { taskId }),
    c.env.DB.prepare(
      "INSERT INTO task_executions (id, task_id, user_id, agent_id, status, energy_spent, pending_points_earned, applied_multiplier, ability_ids_json, verification_status, completed_at) VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, 'verified', CURRENT_TIMESTAMP)"
    ).bind(id("exec"), task.id, user.id, agent.id, task.energy_cost, pendingPointsEarned, appliedMultiplier, JSON.stringify(abilityItemIds))
  ];

  for (const ability of abilityRows.results) {
    statements.push(c.env.DB.prepare("UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(ability.id));
  }

  await c.env.DB.batch(statements);
  await trackAnalyticsEvent(c.env.DB, user.id, "task_completed", "task_verify", {
    taskId,
    pendingPointsEarned,
    energySpent: task.energy_cost
  });
  const updatedAgent = await getAgent(c.env.DB, user.id);

  return c.json({
    status: "approved",
    pendingPointsEarned,
    energySpent: task.energy_cost,
    agent: await toAgent(c.env.DB, updatedAgent!)
  });
});

app.get("/tasks/:taskId/status", async (c) => {
  const user = await requireUser(c);
  const taskId = c.req.param("taskId");
  const row = await c.env.DB.prepare(
    "SELECT status, link, feedback, created_at FROM task_verifications WHERE task_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(taskId, user.id).first<any>();

  if (!row) {
    return c.json({ status: "pending" });
  }

  return c.json({
    status: row.status,
    link: row.link,
    feedback: row.feedback,
    createdAt: row.created_at
  });
});

async function getAdminUsername(c: AppContext): Promise<string> {
  const token = c.req.header("x-admin-token") || c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return "admin";
  try {
    const [payload] = token.split(".");
    if (payload) {
      const raw = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
      const session = JSON.parse(raw) as AdminSession;
      return session.username || "admin";
    }
  } catch {}
  return "admin";
}

async function grantBountyReward(
  db: D1Database,
  verificationId: string
): Promise<{ success: boolean; error?: string; rewardGranted: boolean }> {
  const verification = await db.prepare(
    "SELECT * FROM bounty_task_verifications WHERE id = ?"
  ).bind(verificationId).first<{
    id: string;
    bounty_task_id: string;
    user_id: string;
    status: string;
    reward_granted_at: string | null;
  }>();

  if (!verification) {
    return { success: false, error: "verification_not_found", rewardGranted: false };
  }

  if (verification.reward_granted_at) {
    return { success: true, rewardGranted: false };
  }

  const task = await db.prepare(
    "SELECT * FROM bounty_tasks WHERE id = ?"
  ).bind(verification.bounty_task_id).first<{
    id: string;
    reward_points: number;
    reward_asset_name: string | null;
    reward_access_pass: string | null;
    budget_remaining: number;
    completed_count: number;
    max_completions: number;
  }>();

  if (!task) {
    return { success: false, error: "bounty_task_not_found", rewardGranted: false };
  }

  if (task.budget_remaining < task.reward_points) {
    return { success: false, error: "budget_insufficient", rewardGranted: false };
  }
  if (task.max_completions > 0 && task.completed_count >= task.max_completions) {
    return { success: false, error: "max_completions_reached", rewardGranted: false };
  }

  const agent = await db.prepare(
    "SELECT id FROM agents WHERE user_id = ? AND status = 'active'"
  ).bind(verification.user_id).first<{ id: string }>();
  const agentId = agent?.id || null;

  const statements: D1PreparedStatement[] = [];

  statements.push(
    db.prepare(
      "UPDATE bounty_task_verifications SET status = 'approved', reward_granted_at = CURRENT_TIMESTAMP, verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP) WHERE id = ? AND reward_granted_at IS NULL"
    ).bind(verificationId)
  );

  statements.push(
    db.prepare(
      "UPDATE bounty_tasks SET budget_remaining = budget_remaining - ?, completed_count = completed_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND budget_remaining >= ?"
    ).bind(task.reward_points, task.id, task.reward_points)
  );

  if (task.reward_points > 0) {
    statements.push(
      ledger(
        db,
        verification.user_id,
        agentId,
        "bounty_task_payout",
        "pending_points",
        task.reward_points,
        null,
        verificationId,
        { taskId: task.id }
      )
    );
  }

  if (task.reward_asset_name) {
    const cardId = id("item");
    const metadata = {
      category: "skill",
      cardNumber: `SK-${Math.floor(Date.now() / 1000)}-${Math.floor(Math.random() * 1000)}`,
      effect: "Bounty Reward skill card",
      sourceBox: "bounty_reward"
    };
    statements.push(
      db.prepare(
        "INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, metadata_json, created_at) VALUES (?, ?, 'ability', ?, 'rare', 'available', 1, 0, ?, CURRENT_TIMESTAMP)"
      ).bind(cardId, verification.user_id, task.reward_asset_name, JSON.stringify(metadata))
    );
  }

  if (task.reward_access_pass) {
    const passId = id("item");
    const metadata = {
      category: "access",
      effect: "Bounty Reward access pass",
      sourceBox: "bounty_reward"
    };
    statements.push(
      db.prepare(
        "INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, metadata_json, created_at) VALUES (?, ?, 'ticket', ?, 'legendary', 'available', 0, 1, ?, CURRENT_TIMESTAMP)"
      ).bind(passId, verification.user_id, task.reward_access_pass, JSON.stringify(metadata))
    );
  }

  await db.batch(statements);
  return { success: true, rewardGranted: true };
}

app.get("/bounty/tasks", async (c) => {
  const rows = await c.env.DB.prepare("SELECT * FROM bounty_tasks ORDER BY created_at DESC").all<any>();
  return c.json({ tasks: rows.results });
});

app.post("/bounty/tasks/:taskId/submit", async (c) => {
  const user = await requireUser(c);
  const taskId = c.req.param("taskId");
  const body = await c.req.json().catch(() => ({}));
  const link = String(body.link || "").trim();

  if (!link) {
    return c.json({ error: "link_required", message: "请提供验收链接。" }, 400);
  }

  const task = await c.env.DB.prepare("SELECT * FROM bounty_tasks WHERE id = ?").bind(taskId).first<any>();
  if (!task) {
    return c.json({ error: "task_not_found", message: "未找到该任务。" }, 404);
  }
  if (task.status === 'paused') {
    return c.json({ error: "task_paused", message: "该任务已暂停。" }, 400);
  }
  if (task.status === 'completed' || task.budget_remaining <= 0 || (task.max_completions > 0 && task.completed_count >= task.max_completions)) {
    return c.json({ error: "task_completed", message: "该任务预算已耗尽或已全部完成。" }, 400);
  }

  const activeVerif = await c.env.DB.prepare(
    "SELECT status FROM bounty_task_verifications WHERE bounty_task_id = ? AND user_id = ? AND status != 'rejected'"
  ).bind(taskId, user.id).first<{ status: string }>();

  if (activeVerif) {
    if (activeVerif.status === 'approved') {
      return c.json({ error: "already_approved", message: "该任务已经通过验收，不能重复提交。" }, 409);
    }
    return c.json({ error: "active_submission_exists", message: "该任务已有正在审核的提交，请勿重复提交。" }, 409);
  }

  const submissionText = `${taskId}:${link.toLowerCase()}`;
  const msgBuffer = new TextEncoder().encode(submissionText);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const submissionHash = toHex(hashBuffer);

  const dup = await c.env.DB.prepare(
    "SELECT * FROM bounty_task_verifications WHERE submission_hash = ?"
  ).bind(submissionHash).first<any>();

  if (dup) {
    if (dup.status !== 'rejected') {
      return c.json({ error: "duplicate_link", message: "此链接已被其他提交使用或正在审核中。" }, 409);
    }
    if (dup.user_id !== user.id) {
      return c.json({ error: "duplicate_link", message: "此链接已被其他用户提交。" }, 409);
    }
    await c.env.DB.prepare(
      "UPDATE bounty_task_verifications SET status = 'submitted', risk_flagged = 0, feedback = NULL, reviewed_by = NULL, created_at = CURRENT_TIMESTAMP, verified_at = NULL, reward_granted_at = NULL WHERE id = ?"
    ).bind(dup.id).run();
    await trackAnalyticsEvent(c.env.DB, user.id, "bounty_submitted", "bounty_link", {
      taskId,
      verificationId: dup.id,
      linkHost: safeLinkHost(link),
      resubmitted: true
    });
    return c.json({ id: dup.id, status: "submitted", link });
  }

  const verifId = id("bverif");
  await c.env.DB.prepare(
    "INSERT INTO bounty_task_verifications (id, bounty_task_id, user_id, link, submission_hash, status) VALUES (?, ?, ?, ?, ?, 'submitted')"
  ).bind(verifId, taskId, user.id, link, submissionHash).run();
  await trackAnalyticsEvent(c.env.DB, user.id, "bounty_submitted", "bounty_link", {
    taskId,
    verificationId: verifId,
    linkHost: safeLinkHost(link)
  });

  return c.json({ id: verifId, status: "submitted", link });
});

app.post("/bounty/tasks/:taskId/verify", async (c) => {
  const user = await requireUser(c);
  const taskId = c.req.param("taskId");

  const verif = await c.env.DB.prepare(
    "SELECT * FROM bounty_task_verifications WHERE bounty_task_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(taskId, user.id).first<any>();

  if (!verif) {
    return c.json({ error: "no_submission", message: "请先提交任务链接。" }, 400);
  }

  if (verif.status === 'approved') {
    return c.json({ error: "already_approved", message: "该提交已通过验收并已发放奖励。" }, 400);
  }

  const task = await c.env.DB.prepare("SELECT * FROM bounty_tasks WHERE id = ?").bind(taskId).first<any>();
  if (!task) {
    return c.json({ error: "task_not_found", message: "未找到该任务。" }, 404);
  }

  let isFormatValid = true;
  if (task.verification_rule) {
    try {
      const rx = new RegExp(task.verification_rule, 'i');
      isFormatValid = rx.test(verif.link);
    } catch (e) {
      isFormatValid = verif.link.startsWith("http");
    }
  } else {
    isFormatValid = verif.link.startsWith("http");
  }

  if (!isFormatValid) {
    await c.env.DB.prepare(
      "UPDATE bounty_task_verifications SET status = 'rejected', feedback = '链接格式不符合任务要求', verified_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(verif.id).run();
    return c.json({ status: "rejected", feedback: "链接格式不符合任务要求", riskFlagged: 0 });
  }

  let riskFlagged = 0;
  if (task.risk_level === 'high') {
    riskFlagged = 1;
  }
  const lowcaseLink = verif.link.toLowerCase();
  if (lowcaseLink.includes("localhost") || lowcaseLink.includes("127.0.0.1") || lowcaseLink.includes("test") || lowcaseLink.includes("example")) {
    riskFlagged = 1;
  }

  if (riskFlagged === 1) {
    await c.env.DB.prepare(
      "UPDATE bounty_task_verifications SET status = 'verifying', risk_flagged = 1, verified_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(verif.id).run();
    await trackAnalyticsEvent(c.env.DB, user.id, "bounty_review_required", "bounty_verify", {
      taskId,
      verificationId: verif.id,
      riskLevel: task.risk_level
    });
    return c.json({
      status: "verifying",
      feedback: "链接格式校验通过，但系统检测到潜在风险或属于高额奖励任务，已转入人工复核中。请耐心等待。",
      riskFlagged: 1
    });
  }

  const payout = await grantBountyReward(c.env.DB, verif.id);
  if (!payout.success) {
    if (payout.error === 'budget_insufficient') {
      await c.env.DB.prepare(
        "UPDATE bounty_tasks SET status = 'paused', paused_reason = '预算积分不足', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(taskId).run();
      await auditAdminConfig(c.env.DB, "pause", "bounty_task", taskId, {
        operator: "system_auto",
        reason: "预算积分不足自动暂停"
      });
    }
    await c.env.DB.prepare(
      "UPDATE bounty_task_verifications SET status = 'verifying', feedback = ? WHERE id = ?"
    ).bind(payout.error || "reward_failed", verif.id).run();
    return c.json({
      status: "verifying",
      feedback: `自动奖励发放失败: ${payout.error}`
    });
  }

  await trackAnalyticsEvent(c.env.DB, user.id, "bounty_approved", "bounty_verify", {
    taskId,
    verificationId: verif.id,
    rewardPoints: task.reward_points
  });
  return c.json({
    status: "approved",
    feedback: "格式校验通过，已成功登记并自动发放奖励。平台并不对您在外部平台的物理完成状态进行实质验证。",
    riskFlagged: 0
  });
});

app.get("/bounty/tasks/:taskId/status", async (c) => {
  const user = await requireUser(c);
  const taskId = c.req.param("taskId");
  const verif = await c.env.DB.prepare(
    "SELECT * FROM bounty_task_verifications WHERE bounty_task_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(taskId, user.id).first<any>();

  if (!verif) {
    return c.json({ status: "not_submitted" });
  }
  return c.json({
    id: verif.id,
    bountyTaskId: verif.bounty_task_id,
    userId: verif.user_id,
    link: verif.link,
    status: verif.status,
    riskFlagged: verif.risk_flagged,
    feedback: verif.feedback,
    createdAt: verif.created_at,
    verifiedAt: verif.verified_at,
    rewardGrantedAt: verif.reward_granted_at
  });
});

app.post("/agents/:agentId/farm", async (c) => {
  const user = await requireUser(c);
  const risk = requireEconomyAllowed(user, "run_mission");
  if (risk) return c.json(risk, 423);
  const agent = await requireAgent(c.env.DB, user.id);
  if (await isControlPaused(c.env.KV, "tasks")) {
    return c.json({ error: "tasks_paused", message: "Missions are temporarily paused." }, 423);
  }
  if (c.req.param("agentId") !== agent.id) {
    return c.json({ error: "agent_mismatch", message: "Agent does not belong to this user." }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const taskIds = Array.isArray(body.taskIds) ? body.taskIds.slice(0, 10) as string[] : [];
  const abilityItemIds = Array.isArray(body.abilityItemIds) ? body.abilityItemIds as string[] : [];
  if (taskIds.length === 0) {
    return c.json({ error: "no_tasks", message: "Select at least one task." }, 400);
  }

  const placeholders = taskIds.map(() => "?").join(",");
  const taskRows = await c.env.DB.prepare(
    `SELECT * FROM tasks WHERE id IN (${placeholders}) AND status = 'active'`
  ).bind(...taskIds).all<DbTask>();
  if (taskRows.results.length !== taskIds.length) {
    return c.json({ error: "task_unavailable", message: "One or more tasks are unavailable." }, 400);
  }

  const tasks = taskRows.results.map(toTask);
  const walletTask = tasks.find((task) => task.requiresWallet);
  if (walletTask) {
    return c.json({ error: "wallet_required", message: "This V0 backend does not execute wallet-required tasks." }, 400);
  }

  const abilityRows = abilityItemIds.length
    ? await c.env.DB.prepare(
        `SELECT * FROM inventory_items WHERE id IN (${abilityItemIds.map(() => "?").join(",")}) AND owner_user_id = ? AND status = 'available'`
      ).bind(...abilityItemIds, user.id).all<DbInventoryItem>()
    : { results: [] as DbInventoryItem[] };

  const requiredMissing = tasks.find((task) => task.requiredAbility && !abilityRows.results.some((ability) => ability.name === task.requiredAbility));
  if (requiredMissing) {
    return c.json({ error: "ability_required", message: `Mission requires ${requiredMissing.requiredAbility}.` }, 400);
  }

  const energySpent = tasks.reduce((sum, task) => sum + task.energyCost, 0);
  if (agent.energy < energySpent) {
    return c.json({ error: "insufficient_energy", message: "Insufficient energy." }, 400);
  }

  const basePoints = tasks.reduce((sum, task) => sum + task.basePendingPoints, 0);
  const appliedMultiplier = abilityRows.results.reduce((multiplier, ability) => {
    if (ability.name.includes("3x")) return Math.max(multiplier, 3);
    if (ability.name.includes("2x")) return Math.max(multiplier, 2);
    if (ability.name.includes("Task Reroll")) return Math.max(multiplier, 1.5);
    if (ability.name.includes("Alpha Radar")) return Math.max(multiplier, 1.35);
    if (ability.name.includes("Mission Permit")) return Math.max(multiplier, 1.2);
    if (ability.name.includes("Auto Farmer")) return Math.max(multiplier, 1.2);
    if (ability.name.includes("Launch Sniper")) return Math.max(multiplier, 1.35);
    return multiplier;
  }, 1);
  const pendingPointsEarned = Math.floor(basePoints * appliedMultiplier);
  const runId = id("run");

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare("UPDATE agents SET energy = energy - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(energySpent, agent.id),
    ledger(c.env.DB, user.id, agent.id, "task_farm", "pending_points", pendingPointsEarned, null, runId, { taskIds, abilityItemIds }),
    ledger(c.env.DB, user.id, agent.id, "task_farm", "user_score", Math.floor(pendingPointsEarned * 0.8), null, runId, { taskIds })
  ];

  for (const task of tasks) {
    statements.push(
      c.env.DB.prepare(
        "INSERT INTO task_executions (id, task_id, user_id, agent_id, status, energy_spent, pending_points_earned, applied_multiplier, ability_ids_json, verification_status, completed_at) VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, 'verified', CURRENT_TIMESTAMP)"
      ).bind(id("exec"), task.id, user.id, agent.id, task.energyCost, Math.floor(task.basePendingPoints * appliedMultiplier), appliedMultiplier, JSON.stringify(abilityItemIds))
    );
  }

  for (const ability of abilityRows.results) {
    statements.push(c.env.DB.prepare("UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(ability.id));
  }

  await c.env.DB.batch(statements);
  const updatedAgent = await getAgent(c.env.DB, user.id);

  return c.json({ runId, completedTasks: tasks.length, energySpent, pendingPointsEarned, appliedMultiplier, agent: await toAgent(c.env.DB, updatedAgent!) });
});

app.get("/leaderboard", async (c) => {
  const user = await requireUser(c);
  const scope = c.req.query("scope") ?? "global";
  const period = c.req.query("period") ?? "daily";
  const rows = await c.env.DB.prepare(
    `SELECT users.username AS displayName, COALESCE(SUM(point_ledger_events.amount), 0) AS score
     FROM users
     LEFT JOIN point_ledger_events ON users.id = point_ledger_events.user_id AND point_ledger_events.point_type = 'user_score'
     GROUP BY users.id
     ORDER BY score DESC
     LIMIT 50`
  ).all<{ displayName: string | null; score: number }>();

  const leaderboard: LeaderboardRow[] = rows.results.map((row, index) => ({
    rank: index + 1,
    displayName: row.displayName || `user_${index + 1}`,
    score: Number(row.score || 0)
  }));
  ensureDemoLeaderboardRows(leaderboard);
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard.forEach((row, index) => { row.rank = index + 1; });

  const currentScore = await pointTotal(c.env.DB, user.id, "user_score");
  const currentRank = Math.max(1, leaderboard.find((row) => row.displayName === (user.username || user.telegram_id))?.rank ?? leaderboard.length + 1);
  return c.json({
    scope,
    period,
    currentUser: { rank: currentRank, rankTier: rankTier(currentScore), pointsToNextTier: pointsToNextTier(currentScore) },
    rows: leaderboard.slice(0, 20)
  });
});

app.post("/groups/pools/join", async (c) => {
  const user = await requireUser(c);
  const risk = requireEconomyAllowed(user, "join_crew");
  if (risk) return c.json(risk, 423);
  const body = await c.req.json().catch(() => ({}));
  const telegramGroupId = String(body.telegramGroupId ?? "-100123456789");
  const title = body.title ? String(body.title) : "Telegram Crew";

  let pool = await c.env.DB.prepare("SELECT * FROM group_pools WHERE telegram_group_id = ?").bind(telegramGroupId).first<any>();
  if (!pool) {
    const poolId = id("pool");
    await c.env.DB.prepare(
      "INSERT INTO group_pools (id, telegram_group_id, title, member_count, daily_score, rank, boost_multiplier) VALUES (?, ?, ?, 0, 0, 999, 1.0)"
    ).bind(poolId, telegramGroupId, title).run();
    pool = await c.env.DB.prepare("SELECT * FROM group_pools WHERE id = ?").bind(poolId).first<any>();
  }

  await c.env.DB.batch([
    c.env.DB.prepare("INSERT OR IGNORE INTO group_pool_members (pool_id, user_id) VALUES (?, ?)").bind(pool.id, user.id),
    c.env.DB.prepare(
      "UPDATE group_pools SET member_count = (SELECT COUNT(*) FROM group_pool_members WHERE pool_id = ?), daily_score = daily_score + 100, boost_multiplier = MIN(2.5, boost_multiplier + 0.01), updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(pool.id, pool.id)
  ]);

  const updated = await c.env.DB.prepare("SELECT * FROM group_pools WHERE id = ?").bind(pool.id).first<any>();
  const groupPool: GroupPool = {
    id: updated.id,
    telegramGroupId: updated.telegram_group_id,
    title: updated.title,
    memberCount: updated.member_count,
    dailyScore: updated.daily_score,
    rank: updated.rank,
    boostMultiplier: updated.boost_multiplier
  };
  return c.json({ pool: groupPool });
});

app.get("/marketplace/listings", async (c) => {
  await ensureAdminConfigData(c.env.DB).catch(() => undefined);
  const rows = await c.env.DB.prepare(
    `SELECT marketplace_listings.*, inventory_items.name, inventory_items.rarity, inventory_items.metadata_json AS metadata_json, users.username
     FROM marketplace_listings
     JOIN inventory_items ON inventory_items.id = marketplace_listings.inventory_item_id
     JOIN users ON users.id = marketplace_listings.seller_user_id
     WHERE marketplace_listings.status = 'active'
     ORDER BY marketplace_listings.created_at DESC
     LIMIT 50`
  ).all<DbListing>();
  const listings = decorateListings(rows.results.map(toMarketplaceListing));
  const volume = await c.env.DB.prepare("SELECT COALESCE(SUM(CAST(price AS REAL)), 0) AS total FROM marketplace_trades WHERE created_at >= datetime('now', '-1 day')").first<{ total: number }>();
  const recent = await c.env.DB.prepare(
    `SELECT marketplace_trades.id, inventory_items.name, marketplace_trades.price, users.username AS buyer
     FROM marketplace_trades
     JOIN inventory_items ON inventory_items.id = marketplace_trades.inventory_item_id
     JOIN users ON users.id = marketplace_trades.buyer_user_id
     ORDER BY marketplace_trades.created_at DESC
     LIMIT 10`
  ).all<{ id: string; name: string; price: string; buyer: string | null }>();

  return c.json({
    stats: {
      floorPrice: floorPrice(listings),
      volume24h: Number(volume?.total ?? 0).toFixed(1),
      currency: "POINT_TEST",
      floorMove24h: listings.length > 1 ? "+18%" : "+0%",
      activeListings: listings.length
    },
    listings,
    marketSections: buildMarketSections(listings),
    recentTrades: recent.results.map((trade) => ({ id: trade.id, name: trade.name, price: trade.price, buyer: trade.buyer || "buyer" }))
  });
});

app.post("/marketplace/listings", async (c) => {
  const user = await requireUser(c);
  const risk = requireEconomyAllowed(user, "create_listing");
  if (risk) return c.json(risk, 423);
  if (await isMarketPaused(c.env)) {
    return c.json({ error: "market_paused", message: "Marketplace is temporarily paused." }, 423);
  }
  const body = await c.req.json().catch(() => ({}));
  const inventoryItemId = String(body.inventoryItemId ?? "");
  const price = String(body.price ?? "");
  const currency = String(body.currency ?? "POINT_TEST");
  const item = await getInventoryItem(c.env.DB, inventoryItemId, user.id);
  if (!item || item.status !== "available" || !item.transferable) {
    return c.json({ error: "item_not_listable", message: "Item is not available for listing." }, 400);
  }
  if (!price || Number.isNaN(Number(price)) || Number(price) <= 0) {
    return c.json({ error: "invalid_price", message: "Invalid listing price." }, 400);
  }

  const listingId = id("listing");
  const expiresAt = body.expiresAt ? String(body.expiresAt) : new Date(Date.now() + 86_400_000).toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE inventory_items SET status = 'listed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(item.id),
    c.env.DB.prepare("INSERT INTO marketplace_listings (id, seller_user_id, inventory_item_id, price, currency, status, expires_at) VALUES (?, ?, ?, ?, ?, 'active', ?)").bind(listingId, user.id, item.id, price, currency, expiresAt)
  ]);

  return c.json({ listing: decorateListings([{ id: listingId, assetItemId: item.id, name: item.name, rarity: item.rarity, price, currency, seller: user.username || user.telegram_id, expiresAt }])[0] });
});

app.post("/marketplace/listings/:listingId/buy", async (c) => {
  const user = await requireUser(c);
  const risk = requireEconomyAllowed(user, "buy_listing");
  if (risk) return c.json(risk, 423);
  if (await isMarketPaused(c.env)) {
    return c.json({ error: "market_paused", message: "Marketplace is temporarily paused." }, 423);
  }
  const agent = await requireAgent(c.env.DB, user.id);
  const listing = await getActiveListing(c.env.DB, c.req.param("listingId"));
  if (!listing) return c.json({ error: "listing_not_found", message: "Listing not found." }, 404);
  if (listing.seller_user_id === user.id) return c.json({ error: "own_listing", message: "Cannot buy your own listing." }, 400);

  const price = Number(listing.price);
  const buyerPoints = await pointTotal(c.env.DB, user.id, "pending_points");
  if (buyerPoints < price) return c.json({ error: "insufficient_points", message: "Insufficient Pending Points." }, 400);

  const tradeId = id("trade");
  const fee = (price * 0.025).toFixed(4);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE marketplace_listings SET status = 'sold', sold_at = CURRENT_TIMESTAMP WHERE id = ?").bind(listing.id),
    c.env.DB.prepare("UPDATE inventory_items SET owner_user_id = ?, status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(user.id, listing.inventory_item_id),
    c.env.DB.prepare("INSERT INTO marketplace_trades (id, listing_id, seller_user_id, buyer_user_id, inventory_item_id, price, currency, fee_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'settled')").bind(tradeId, listing.id, listing.seller_user_id, user.id, listing.inventory_item_id, listing.price, listing.currency, fee),
    ledger(c.env.DB, user.id, agent.id, "marketplace_buy", "pending_points", -Math.ceil(price), null, tradeId, { listingId: listing.id }),
    ledger(c.env.DB, listing.seller_user_id, null, "marketplace_sale", "pending_points", Math.floor(price - Number(fee)), null, tradeId, { listingId: listing.id })
  ]);

  return c.json({ tradeId, listingId: listing.id, item: { id: listing.inventory_item_id, ownerUserId: user.id }, fee });
});

app.post("/marketplace/listings/:listingId/cancel", async (c) => {
  const user = await requireUser(c);
  const risk = requireEconomyAllowed(user, "cancel_listing");
  if (risk) return c.json(risk, 423);
  if (await isMarketPaused(c.env)) {
    return c.json({ error: "market_paused", message: "Marketplace is temporarily paused." }, 423);
  }
  const listing = await getActiveListing(c.env.DB, c.req.param("listingId"));
  if (!listing) return c.json({ error: "listing_not_found", message: "Listing not found." }, 404);
  if (listing.seller_user_id !== user.id) return c.json({ error: "not_seller", message: "Only seller can cancel listing." }, 403);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE marketplace_listings SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE id = ?").bind(listing.id),
    c.env.DB.prepare("UPDATE inventory_items SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(listing.inventory_item_id)
  ]);
  return c.json({ listingId: listing.id });
});

app.post("/telegram/webhook", async (c) => {
  const update = await c.req.json().catch(() => ({}));
  await c.env.JOBS?.send({ type: "telegram_update", update }).catch(() => undefined);
  c.executionCtx.waitUntil(handleTelegramWebhook(c.env, update));
  return c.json({ ok: true });
});

app.get(`${ADMIN_PREFIX}/metrics`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const [users, agents, boxes, pools, risk, volume] = await Promise.all([
    count(c.env.DB, "users"),
    count(c.env.DB, "agents"),
    countWhere(c.env.DB, "inventory_items", "item_type = 'box' AND status = 'burned'"),
    count(c.env.DB, "group_pools"),
    countWhere(c.env.DB, "users", "risk_status != 'normal'"),
    c.env.DB.prepare("SELECT COALESCE(SUM(CAST(price AS REAL)), 0) AS total FROM marketplace_trades").first<{ total: number }>()
  ]);
  return c.json({ botStarts: String(users), agentClaims: String(agents), boxOpens: String(boxes), groupPools: String(pools), marketVolume: `${Number(volume?.total ?? 0).toFixed(1)} POINT_TEST`, riskFlags: String(risk) });
});

app.get(`${ADMIN_PREFIX}/audit-logs`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  await ensureAdminConfigData(c.env.DB);
  const rows = await c.env.DB.prepare(
    "SELECT id, action, target_type, target_id, metadata_json, created_at FROM admin_config_audit_logs ORDER BY created_at DESC LIMIT 200"
  ).all<AdminAuditRow>();
  return c.json({
    auditLogs: rows.results.map(toAdminAuditLog)
  });
});

app.post(`${ADMIN_PREFIX}/audit-logs`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  await ensureAdminConfigData(c.env.DB);
  const body = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare(
    "INSERT INTO admin_config_audit_logs (id, action, target_type, target_id, metadata_json) VALUES (?, ?, ?, ?, ?)"
  ).bind(
    id("audit"),
    String(body.opType || body.action || "update"),
    String(body.targetType || "manual"),
    String(body.targetObject || body.targetId || "default"),
    JSON.stringify({
      operator: body.operator || "system",
      beforeValue: body.beforeValue ?? "",
      afterValue: body.afterValue ?? "",
      status: body.status ?? "success"
    })
  ).run();
  return c.json({ ok: true });
});

app.get(`${ADMIN_PREFIX}/users`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const rows = await c.env.DB.prepare(
    `SELECT users.id, users.telegram_id, users.username, users.risk_status, COALESCE(SUM(point_ledger_events.amount), 0) AS score
     FROM users LEFT JOIN point_ledger_events ON users.id = point_ledger_events.user_id AND point_ledger_events.point_type = 'user_score'
     GROUP BY users.id ORDER BY users.created_at DESC LIMIT 100`
  ).all<{ id: string; telegram_id: string; username: string | null; risk_status: RiskStatus; score: number }>();
  return c.json({ users: rows.results.map((row) => ({ id: row.id, telegramId: row.telegram_id, username: row.username || row.telegram_id, rankTier: rankTier(Number(row.score || 0)), riskStatus: row.risk_status, score: Number(row.score || 0) })) });
});

app.post(`${ADMIN_PREFIX}/users/:userId/risk`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const body = await c.req.json().catch(() => ({}));
  const riskStatus = ["normal", "restricted", "review"].includes(body.riskStatus) ? body.riskStatus : "review";
  const userId = c.req.param("userId");
  const existing = await c.env.DB.prepare("SELECT id, telegram_id, username, risk_status FROM users WHERE id = ?").bind(userId).first<DbUser>();
  if (!existing) return c.json({ error: "unknown_user", message: "Unknown user." }, 404);
  await c.env.DB.prepare("UPDATE users SET risk_status = ? WHERE id = ?").bind(riskStatus, userId).run();
  await auditAdminConfig(c.env.DB, "risk_status", "user", userId, {
    username: existing.username || existing.telegram_id,
    beforeRiskStatus: existing.risk_status,
    afterRiskStatus: riskStatus
  });
  return c.json({ userId, riskStatus });
});

app.post(`${ADMIN_PREFIX}/users/:userId/studio`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const userId = c.req.param("userId");
  const body = await c.req.json().catch(() => ({}));
  const enabled = body.enabled ? 1 : 0;

  // Confirm user exists first
  const userExists = await c.env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first<any>();
  if (!userExists) {
    return c.json({ error: "user_not_found", message: "User not found." }, 404);
  }

  await c.env.DB.prepare("UPDATE users SET studio_enabled = ? WHERE id = ?").bind(enabled, userId).run();
  await auditAdminConfig(c.env.DB, "studio_whitelist", "user", userId, { enabled });
  return c.json({ success: true, userId, enabled: enabled === 1 });
});

app.get(`${ADMIN_PREFIX}/tasks`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const rows = await c.env.DB.prepare("SELECT * FROM tasks ORDER BY status, energy_cost ASC").all<DbTask>();
  return c.json({ tasks: rows.results.map(toAdminTask) });
});

app.post(`${ADMIN_PREFIX}/tasks`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const body = await c.req.json().catch(() => ({}));
  const taskId = id("task");
  const name = String(body.name || "新任务").slice(0, 120);
  const energyCost = Number(body.energyCost || 10);
  const basePendingPoints = Number(body.basePendingPoints || 100);
  if (!Number.isFinite(energyCost) || energyCost < 0) return c.json({ error: "invalid_energy_cost", message: "Invalid energy cost." }, 400);
  if (!Number.isFinite(basePendingPoints) || basePendingPoints < 0) return c.json({ error: "invalid_points", message: "Invalid points." }, 400);
  await c.env.DB.prepare(
    "INSERT INTO tasks (id, code, name, task_type, energy_cost, base_pending_points, requires_wallet, auto_executable, status) VALUES (?, ?, ?, 'admin_created', ?, ?, 0, 1, 'active')"
  ).bind(taskId, taskId, name, Math.floor(energyCost), Math.floor(basePendingPoints)).run();
  await auditAdminConfig(c.env.DB, "create", "task", taskId, { name, energyCost: Math.floor(energyCost), basePendingPoints: Math.floor(basePendingPoints) });
  const rows = await c.env.DB.prepare("SELECT * FROM tasks ORDER BY status, energy_cost ASC").all<DbTask>();
  return c.json({ id: taskId, tasks: rows.results.map(toAdminTask) });
});

app.post(`${ADMIN_PREFIX}/tasks/:taskId/status`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const body = await c.req.json().catch(() => ({}));
  const status = ["active", "paused", "draft"].includes(body.status) ? body.status : "paused";
  const taskId = c.req.param("taskId");
  const existing = await c.env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(taskId).first<DbTask>();
  if (!existing) return c.json({ error: "unknown_task", message: "Unknown task." }, 404);
  await c.env.DB.prepare("UPDATE tasks SET status = ? WHERE id = ?").bind(status, taskId).run();
  await auditAdminConfig(c.env.DB, "status", "task", taskId, { name: existing.name, beforeStatus: existing.status, afterStatus: status });
  const rows = await c.env.DB.prepare("SELECT * FROM tasks ORDER BY status, energy_cost ASC").all<DbTask>();
  return c.json({ taskId, status, tasks: rows.results.map(toAdminTask) });
});

app.get(`${ADMIN_PREFIX}/boxes`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  await ensureAdminConfigData(c.env.DB);
  return c.json({ boxes: await listAdminBoxes(c.env.DB) });
});

app.post(`${ADMIN_PREFIX}/boxes`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  await ensureAdminConfigData(c.env.DB);
  const body = await c.req.json().catch(() => ({}));
  const parsed = parseAdminBoxInput(body, id("box"));
  if ("error" in parsed) return c.json(parsed.error, 400);
  await c.env.DB.prepare(
    `INSERT INTO box_definitions (id, key, name, status, rarity, total_supply, remaining_supply, daily_release, acquisition_route, starts_at, ends_at, transferable_before_open, binding_strategy, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    parsed.value.id,
    parsed.value.key,
    parsed.value.name,
    parsed.value.status,
    parsed.value.rarity,
    parsed.value.totalSupply,
    parsed.value.remainingSupply,
    parsed.value.dailyRelease,
    parsed.value.acquisitionRoute,
    parsed.value.startTime,
    parsed.value.endTime,
    parsed.value.transferableBeforeOpen ? 1 : 0,
    parsed.value.bindingStrategy,
    JSON.stringify({})
  ).run();
  await auditAdminConfig(c.env.DB, "create", "box", parsed.value.id, parsed.value);
  return c.json({ boxes: await listAdminBoxes(c.env.DB) });
});

app.post(`${ADMIN_PREFIX}/boxes/:boxId`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  await ensureAdminConfigData(c.env.DB);
  const boxId = c.req.param("boxId");
  const existing = await getAdminBoxRow(c.env.DB, boxId);
  if (!existing) return c.json({ error: "unknown_box", message: "Unknown box." }, 404);
  const body = await c.req.json().catch(() => ({}));
  const merged = {
    ...toAdminBox(existing),
    ...body,
    id: boxId,
    createdAt: existing.created_at,
    updatedAt: existing.updated_at
  };
  const parsed = parseAdminBoxInput(merged, boxId);
  if ("error" in parsed) return c.json(parsed.error, 400);
  await c.env.DB.prepare(
    `UPDATE box_definitions
     SET key = ?, name = ?, status = ?, rarity = ?, total_supply = ?, remaining_supply = ?, daily_release = ?, acquisition_route = ?,
         starts_at = ?, ends_at = ?, transferable_before_open = ?, binding_strategy = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(
    parsed.value.key,
    parsed.value.name,
    parsed.value.status,
    parsed.value.rarity,
    parsed.value.totalSupply,
    parsed.value.remainingSupply,
    parsed.value.dailyRelease,
    parsed.value.acquisitionRoute,
    parsed.value.startTime,
    parsed.value.endTime,
    parsed.value.transferableBeforeOpen ? 1 : 0,
    parsed.value.bindingStrategy,
    boxId
  ).run();
  await auditAdminConfig(c.env.DB, "update", "box", boxId, body);
  return c.json({ boxes: await listAdminBoxes(c.env.DB) });
});

app.post(`${ADMIN_PREFIX}/boxes/:boxId/archive`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  await ensureAdminConfigData(c.env.DB);
  const boxId = c.req.param("boxId");
  await c.env.DB.prepare("UPDATE box_definitions SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(boxId).run();
  await auditAdminConfig(c.env.DB, "archive", "box", boxId, {});
  return c.json({ boxes: await listAdminBoxes(c.env.DB) });
});

app.post(`${ADMIN_PREFIX}/boxes/:boxId/status`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const body = await c.req.json().catch(() => ({}));
  await ensureAdminConfigData(c.env.DB);
  const status = validBoxStatus(body.status) ? body.status : "paused";
  const boxId = c.req.param("boxId");
  const existing = await getAdminBoxRow(c.env.DB, boxId);
  if (!existing) return c.json({ error: "unknown_box", message: "Unknown box." }, 404);
  await c.env.DB.prepare("UPDATE box_definitions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(status, boxId).run();
  await auditAdminConfig(c.env.DB, "status", "box", boxId, { status });
  return c.json({ boxes: await listAdminBoxes(c.env.DB) });
});

app.get(`${ADMIN_PREFIX}/boxes/:boxId/drop-pool`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  await ensureAdminConfigData(c.env.DB);
  const boxId = c.req.param("boxId");
  const existing = await getAdminBoxRow(c.env.DB, boxId);
  if (!existing) return c.json({ error: "unknown_box", message: "Unknown box." }, 404);
  return c.json({ items: await listDropPool(c.env.DB, boxId) });
});

app.post(`${ADMIN_PREFIX}/boxes/:boxId/drop-pool`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  await ensureAdminConfigData(c.env.DB);
  const boxId = c.req.param("boxId");
  const existing = await getAdminBoxRow(c.env.DB, boxId);
  if (!existing) return c.json({ error: "unknown_box", message: "Unknown box." }, 404);
  const body = await c.req.json().catch(() => ({}));
  const items: unknown[] = Array.isArray(body.items) ? body.items : [];
  const parsed = items.map((item: unknown) => parseDropPoolInput(item, boxId));
  const failed = parsed.find((item) => "error" in item);
  if (failed && "error" in failed) return c.json(failed.error, 400);

  await c.env.DB.prepare("DELETE FROM box_drop_pool_items WHERE box_id = ?").bind(boxId).run();
  const statements = parsed.map((item) => {
    if ("error" in item) throw new Error("invalid_drop_pool");
    const value = item.value;
    return c.env.DB.prepare(
      `INSERT INTO box_drop_pool_items (id, box_id, asset_name, category, rarity, weight, min_quantity, max_quantity, uses_remaining, expiry_hours, transferable, soulbound, effect, requires_wallet, project_id, metadata_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
    ).bind(
      value.id,
      boxId,
      value.assetName,
      value.category,
      value.rarity,
      value.weight,
      value.minQuantity,
      value.maxQuantity,
      value.usesRemaining ?? null,
      value.expiryHours ?? null,
      value.transferable ? 1 : 0,
      value.soulbound ? 1 : 0,
      value.effect,
      value.requiresWallet ? 1 : 0,
      value.projectId ?? null,
      value.metadataJson ?? null
    );
  });
  if (statements.length > 0) await c.env.DB.batch(statements);
  await auditAdminConfig(c.env.DB, "replace", "drop_pool", boxId, { count: statements.length });
  return c.json({ items: await listDropPool(c.env.DB, boxId) });
});

app.get(`${ADMIN_PREFIX}/assets`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  await ensureAdminConfigData(c.env.DB);
  return c.json({ assets: await listAssets(c.env.DB) });
});

app.post(`${ADMIN_PREFIX}/assets`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  await ensureAdminConfigData(c.env.DB);
  const body = await c.req.json().catch(() => ({}));
  const parsed = parseAssetInput(body, id("ast"));
  if ("error" in parsed) return c.json(parsed.error, 400);
  const asset = parsed.value;
  await c.env.DB.prepare(
    `INSERT INTO asset_definitions (id, key, name, category, rarity, status, transferable, default_expiry_hours, default_uses, effect, applicable_tasks_json, applicable_boxes_json, requires_wallet)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    asset.id,
    asset.key,
    asset.name,
    asset.category,
    asset.rarity,
    asset.status,
    asset.transferable ? 1 : 0,
    asset.defaultExpiryHours,
    asset.defaultUses,
    asset.effect,
    JSON.stringify(asset.applicableTasks),
    JSON.stringify(asset.applicableBoxes),
    asset.requiresWallet ? 1 : 0
  ).run();
  await auditAdminConfig(c.env.DB, "create", "asset", asset.id, asset);
  return c.json({ assets: await listAssets(c.env.DB) });
});

app.post(`${ADMIN_PREFIX}/assets/:assetId`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  await ensureAdminConfigData(c.env.DB);
  const assetId = c.req.param("assetId");
  const existing = await c.env.DB.prepare("SELECT * FROM asset_definitions WHERE id = ?").bind(assetId).first<AdminAssetRow>();
  if (!existing) return c.json({ error: "unknown_asset", message: "Unknown asset." }, 404);
  const body = await c.req.json().catch(() => ({}));
  const merged = { ...toAssetDefinition(existing), ...body, id: assetId };
  const parsed = parseAssetInput(merged, assetId);
  if ("error" in parsed) return c.json(parsed.error, 400);
  const asset = parsed.value;
  await c.env.DB.prepare(
    `UPDATE asset_definitions
     SET key = ?, name = ?, category = ?, rarity = ?, status = ?, transferable = ?, default_expiry_hours = ?,
         default_uses = ?, effect = ?, applicable_tasks_json = ?, applicable_boxes_json = ?, requires_wallet = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(
    asset.key,
    asset.name,
    asset.category,
    asset.rarity,
    asset.status,
    asset.transferable ? 1 : 0,
    asset.defaultExpiryHours,
    asset.defaultUses,
    asset.effect,
    JSON.stringify(asset.applicableTasks),
    JSON.stringify(asset.applicableBoxes),
    asset.requiresWallet ? 1 : 0,
    assetId
  ).run();
  await auditAdminConfig(c.env.DB, "update", "asset", assetId, body);
  return c.json({ assets: await listAssets(c.env.DB) });
});

app.get(`${ADMIN_PREFIX}/market-rules`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  await ensureAdminConfigData(c.env.DB);
  return c.json(await getMarketRules(c.env.DB));
});

app.post(`${ADMIN_PREFIX}/market-rules`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  await ensureAdminConfigData(c.env.DB);
  const body = await c.req.json().catch(() => ({}));
  const parsed = parseMarketRulesInput(body);
  if ("error" in parsed) return c.json(parsed.error, 400);
  const rules = parsed.value;
  await c.env.DB.prepare(
    `INSERT INTO market_rules (id, platform_fee_percent, min_price, max_price, listing_expiry_days, allow_starter_box_trade, allow_project_box_trade, market_paused, cancel_rules, updated_at)
     VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       platform_fee_percent = excluded.platform_fee_percent,
       min_price = excluded.min_price,
       max_price = excluded.max_price,
       listing_expiry_days = excluded.listing_expiry_days,
       allow_starter_box_trade = excluded.allow_starter_box_trade,
       allow_project_box_trade = excluded.allow_project_box_trade,
       market_paused = excluded.market_paused,
       cancel_rules = excluded.cancel_rules,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    rules.platformFeePercent,
    rules.minPrice,
    rules.maxPrice,
    rules.listingExpiryDays,
    rules.allowStarterBoxTrade ? 1 : 0,
    rules.allowProjectBoxTrade ? 1 : 0,
    rules.marketPaused ? 1 : 0,
    rules.cancelRules
  ).run();
  await c.env.KV.put("global:market_paused", rules.marketPaused ? "true" : "false");
  await auditAdminConfig(c.env.DB, "update", "market_rules", "default", rules);
  return c.json(await getMarketRules(c.env.DB));
});

app.post(`${ADMIN_PREFIX}/controls/:control`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const body = await c.req.json().catch(() => ({}));
  const control = c.req.param("control");
  if (!["boxes", "tasks"].includes(control)) {
    return c.json({ error: "unknown_control", message: "Unknown control." }, 404);
  }
  const paused = body.paused === true ? "true" : "false";
  await c.env.KV.put(`global:${control}_paused`, paused);

  if (control === "tasks") {
    await c.env.DB.prepare("UPDATE tasks SET status = ? WHERE task_type != 'wallet'").bind(paused === "true" ? "paused" : "active").run();
  }

  if (control === "boxes") {
    await ensureAdminConfigData(c.env.DB);
    await c.env.DB.prepare("UPDATE box_definitions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE status != 'archived'").bind(paused === "true" ? "paused" : "active").run();
  }

  await auditAdminConfig(c.env.DB, "control", control, "global", { paused: paused === "true" });

  return c.json({ control, paused: paused === "true" });
app.get(`${ADMIN_PREFIX}/marketplace/trades`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const rows = await c.env.DB.prepare(
    `SELECT marketplace_trades.id, marketplace_trades.price, marketplace_trades.created_at, marketplace_listings.inventory_item_id, inventory_items.name, users.username AS buyer, seller.username AS seller
     FROM marketplace_trades
     JOIN marketplace_listings ON marketplace_listings.id = marketplace_trades.listing_id
     JOIN inventory_items ON inventory_items.id = marketplace_trades.inventory_item_id
     JOIN users ON users.id = marketplace_trades.buyer_user_id
     JOIN users AS seller ON seller.id = marketplace_trades.seller_user_id
     ORDER BY marketplace_trades.created_at DESC
     LIMIT 100`
  ).all<{ id: string; price: string; created_at: string; inventory_item_id: string; name: string; buyer: string | null; seller: string | null }>();
  return c.json({
    trades: rows.results.map((row) => ({
      id: row.id,
      name: row.name,
      price: row.price,
      buyer: row.buyer || "buyer",
      seller: row.seller || "seller",
      timestamp: row.created_at
    }))
  });
});
});

app.get(`${ADMIN_PREFIX}/marketplace/trades`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const rows = await c.env.DB.prepare(
    `SELECT marketplace_trades.id, inventory_items.name, marketplace_trades.price, buyer.username AS buyer, seller.username AS seller, marketplace_trades.created_at
     FROM marketplace_trades
     JOIN inventory_items ON inventory_items.id = marketplace_trades.inventory_item_id
     JOIN users buyer ON buyer.id = marketplace_trades.buyer_user_id
     JOIN users seller ON seller.id = marketplace_trades.seller_user_id
     ORDER BY marketplace_trades.created_at DESC LIMIT 100`
  ).all<{ id: string; name: string; price: string; buyer: string | null; seller: string | null; created_at: string }>();
  return c.json({ trades: rows.results.map((row) => ({ id: row.id, name: row.name, price: row.price, buyer: row.buyer || "buyer", seller: row.seller || "seller", timestamp: row.created_at })) });
});

app.get(`${ADMIN_PREFIX}/stats/skills`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const db = c.env.DB;
  const stats = await db.prepare(
    "SELECT status, COUNT(*) as count FROM inventory_items WHERE item_type = 'ability' GROUP BY status"
  ).all<{ status: string; count: number }>();

  const countMap = {
    available: 0,
    active: 0,
    listed: 0,
    burned: 0,
    expired: 0
  };
  stats.results.forEach(row => {
    if (row.status in countMap) {
      countMap[row.status as keyof typeof countMap] = row.count;
    }
  });
  return c.json({
    unlearned: countMap.available,
    equipped: countMap.active,
    listed: countMap.listed,
    burned: countMap.burned,
    expired: countMap.expired,
    total: Object.values(countMap).reduce((a, b) => a + b, 0)
  });
});

app.get(`${ADMIN_PREFIX}/task-verifications`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const rows = await c.env.DB.prepare(
    `SELECT task_verifications.*, users.username, tasks.name as task_name
     FROM task_verifications
     JOIN users ON task_verifications.user_id = users.id
     JOIN tasks ON task_verifications.task_id = tasks.id
     ORDER BY task_verifications.created_at DESC LIMIT 100`
  ).all<any>();
  return c.json({ verifications: rows.results });
});

app.post(`${ADMIN_PREFIX}/task-verifications/:verifId/approve`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const verifId = c.req.param("verifId");

  const verif = await c.env.DB.prepare(
    "SELECT * FROM task_verifications WHERE id = ?"
  ).bind(verifId).first<any>();

  if (!verif) {
    return c.json({ error: "verification_not_found" }, 404);
  }

  if (verif.status === "approved") {
    return c.json({ success: true, message: "Already approved" });
  }

  const task = await c.env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(verif.task_id).first<DbTask>();
  const agent = await requireAgent(c.env.DB, verif.user_id);

  if (!task || !agent) {
    return c.json({ error: "task_or_agent_missing" }, 400);
  }

  const pendingPointsEarned = task.base_pending_points;
  const runId = id("run_admin");

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare("UPDATE task_verifications SET status = 'approved', verified_at = CURRENT_TIMESTAMP WHERE id = ?").bind(verifId),
    c.env.DB.prepare("UPDATE agents SET energy = MAX(0, energy - ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(task.energy_cost, agent.id),
    ledger(c.env.DB, verif.user_id, agent.id, "task_verify_manual", "pending_points", pendingPointsEarned, null, runId, { taskId: task.id }),
    ledger(c.env.DB, verif.user_id, agent.id, "task_verify_manual", "user_score", Math.floor(pendingPointsEarned * 0.8), null, runId, { taskId: task.id }),
    c.env.DB.prepare(
      "INSERT INTO task_executions (id, task_id, user_id, agent_id, status, energy_spent, pending_points_earned, applied_multiplier, verification_status, completed_at) VALUES (?, ?, ?, ?, 'completed', ?, ?, 1, 'verified', CURRENT_TIMESTAMP)"
    ).bind(id("exec"), task.id, verif.user_id, agent.id, task.energy_cost, pendingPointsEarned)
  ];

  await c.env.DB.batch(statements);
  await auditAdminConfig(c.env.DB, "manual_approve", "verification", verifId, { userId: verif.user_id, taskId: verif.task_id });

  return c.json({ success: true });
});

app.post(`${ADMIN_PREFIX}/task-verifications/:verifId/reject`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const verifId = c.req.param("verifId");
  const body = await c.req.json().catch(() => ({}));
  const feedback = String(body.feedback || "Rejected by administrator manual review.").trim();

  await c.env.DB.prepare(
    "UPDATE task_verifications SET status = 'rejected', feedback = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(feedback, verifId).run();

  await auditAdminConfig(c.env.DB, "manual_reject", "verification", verifId, { feedback });

  return c.json({ success: true });
});

// Admin-side Bounty Task Network routes
app.post(`${ADMIN_PREFIX}/bounty/tasks`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  const body = await c.req.json().catch(() => ({}));
  const {
    id: taskId,
    title,
    description,
    category,
    platform,
    targetUrl,
    budgetTotal,
    rewardPoints,
    rewardAssetName,
    rewardAccessPass,
    deadline,
    verificationRule,
    submissionType,
    riskLevel,
    ownerType,
    ownerName,
    maxCompletions,
    settlementMode,
    chainId,
    escrowContract,
    escrowTxHash,
    rewardToken,
    rewardTokenAddress,
    rewardDecimals,
    oracleMode,
    disputeStatus
  } = body;

  if (!taskId || !title || !category || !platform || !targetUrl || !ownerType) {
    return c.json({ error: "missing_required_fields", message: "缺少必要字段" }, 400);
  }

  const budget = Number(budgetTotal) || 0;
  const rewardPts = Number(rewardPoints) || 0;
  const maxCompl = Number(maxCompletions) || 0;

  await c.env.DB.prepare(
    `INSERT INTO bounty_tasks (
      id, title, description, category, platform, target_url,
      budget_total, budget_remaining, reward_points, reward_asset_name, reward_access_pass,
      deadline, verification_rule, submission_type, risk_level, owner_type, owner_name,
      completed_count, max_completions, paused_reason, status, created_by_admin,
      settlement_mode, chain_id, escrow_contract, escrow_tx_hash,
      reward_token, reward_token_address, reward_decimals,
      oracle_mode, dispute_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, 'active', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    taskId, title, description || null, category, platform, targetUrl,
    budget, budget, rewardPts, rewardAssetName || null, rewardAccessPass || null,
    deadline || null, verificationRule || null, submissionType || 'link', riskLevel || 'low', ownerType, ownerName || null,
    maxCompl,
    settlementMode || 'offchain',
    chainId !== undefined && chainId !== null ? Number(chainId) : null,
    escrowContract || null,
    escrowTxHash || null,
    rewardToken || null,
    rewardTokenAddress || null,
    rewardDecimals !== undefined && rewardDecimals !== null ? Number(rewardDecimals) : null,
    oracleMode || 'format_check',
    disputeStatus || 'none'
  ).run();

  const adminUsername = await getAdminUsername(c);
  await auditAdminConfig(c.env.DB, "create", "bounty_task", taskId, {
    operator: adminUsername,
    title,
    budgetTotal: budget,
    rewardPoints: rewardPts
  });

  return c.json({ success: true, taskId });
});

app.post(`${ADMIN_PREFIX}/bounty/tasks/:taskId/budget`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;

  const taskId = c.req.param("taskId");
  const adminUsername = await getAdminUsername(c);
  const body = await c.req.json().catch(() => ({}));
  const budgetTotal = Number(body.budgetTotal);

  if (isNaN(budgetTotal) || budgetTotal < 0) {
    return c.json({ error: "invalid_budget", message: "预算总额必须为非负整数。" }, 400);
  }

  const task = await c.env.DB.prepare("SELECT * FROM bounty_tasks WHERE id = ?").bind(taskId).first<any>();
  if (!task) {
    return c.json({ error: "task_not_found", message: "未找到该赏金任务。" }, 404);
  }

  const beforeBudget = task.budget_total;
  const beforeRemaining = task.budget_remaining;
  const budgetRemaining = Math.max(0, budgetTotal - (task.completed_count * task.reward_points));

  await c.env.DB.prepare(
    "UPDATE bounty_tasks SET budget_total = ?, budget_remaining = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(budgetTotal, budgetRemaining, taskId).run();

  await auditAdminConfig(c.env.DB, "adjust_budget", "bounty_task", taskId, {
    operator: adminUsername,
    beforeBudget,
    afterBudget: budgetTotal,
    beforeRemaining,
    afterRemaining: budgetRemaining
  });

  return c.json({ success: true, budgetTotal, budgetRemaining });
});

app.post(`${ADMIN_PREFIX}/bounty/tasks/:taskId/pause`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;

  const taskId = c.req.param("taskId");
  const adminUsername = await getAdminUsername(c);
  const body = await c.req.json().catch(() => ({}));
  const paused = !!body.paused;
  const reason = String(body.reason || "").trim();

  const task = await c.env.DB.prepare("SELECT * FROM bounty_tasks WHERE id = ?").bind(taskId).first<any>();
  if (!task) {
    return c.json({ error: "task_not_found", message: "未找到该赏金任务。" }, 404);
  }

  const beforeStatus = task.status;
  const afterStatus = paused ? 'paused' : 'active';
  const pausedReason = paused ? (reason || "管理员手动暂停") : null;

  await c.env.DB.prepare(
    "UPDATE bounty_tasks SET status = ?, paused_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(afterStatus, pausedReason, taskId).run();

  await auditAdminConfig(c.env.DB, paused ? "pause" : "resume", "bounty_task", taskId, {
    operator: adminUsername,
    beforeStatus,
    afterStatus,
    pausedReason
  });

  return c.json({ success: true, status: afterStatus, pausedReason });
});

app.get(`${ADMIN_PREFIX}/bounty/tasks`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;

  const rows = await c.env.DB.prepare("SELECT * FROM bounty_tasks ORDER BY created_at DESC").all<any>();
  return c.json({ tasks: rows.results });
});

app.get(`${ADMIN_PREFIX}/bounty/verifications`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;

  const rows = await c.env.DB.prepare(
    `SELECT v.*, t.title AS task_title, t.reward_points, u.username AS user_username
     FROM bounty_task_verifications v
     JOIN bounty_tasks t ON t.id = v.bounty_task_id
     JOIN users u ON u.id = v.user_id
     ORDER BY v.created_at DESC`
  ).all<any>();

  return c.json({ verifications: rows.results });
});

app.post(`${ADMIN_PREFIX}/bounty/verifications/:id/approve`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;

  const verifId = c.req.param("id");
  const adminUsername = await getAdminUsername(c);

  const verif = await c.env.DB.prepare(
    "SELECT * FROM bounty_task_verifications WHERE id = ?"
  ).bind(verifId).first<any>();

  if (!verif) {
    return c.json({ error: "verification_not_found", message: "未找到该验收记录。" }, 404);
  }

  if (verif.reward_granted_at) {
    return c.json({ error: "already_rewarded", message: "该任务奖励已发放，不能重复发放。" }, 400);
  }

  await c.env.DB.prepare(
    "UPDATE bounty_task_verifications SET status = 'approved', reviewed_by = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(adminUsername, verifId).run();

  const payout = await grantBountyReward(c.env.DB, verifId);
  if (!payout.success) {
    return c.json({ error: payout.error || "reward_failed", message: `审核通过但奖励发放失败: ${payout.error}` }, 400);
  }

  await auditAdminConfig(c.env.DB, "manual_approve", "bounty_verification", verifId, {
    operator: adminUsername,
    userId: verif.user_id,
    taskId: verif.bounty_task_id
  });

  return c.json({ success: true, message: "手动验收通过，奖励已成功发放。" });
});

app.post(`${ADMIN_PREFIX}/bounty/verifications/:id/reject`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;

  const verifId = c.req.param("id");
  const adminUsername = await getAdminUsername(c);
  const body = await c.req.json().catch(() => ({}));
  const feedback = String(body.feedback || "").trim();

  if (!feedback) {
    return c.json({ error: "feedback_required", message: "请填写拒绝原因/反馈意见。" }, 400);
  }

  const verif = await c.env.DB.prepare(
    "SELECT * FROM bounty_task_verifications WHERE id = ?"
  ).bind(verifId).first<any>();

  if (!verif) {
    return c.json({ error: "verification_not_found", message: "未找到该验收记录。" }, 404);
  }

  if (verif.status === 'approved' || verif.reward_granted_at) {
    return c.json({ error: "cannot_reject_approved", message: "已通过并已发放奖励的记录无法拒绝。" }, 400);
  }

  await c.env.DB.prepare(
    "UPDATE bounty_task_verifications SET status = 'rejected', feedback = ?, reviewed_by = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(feedback, adminUsername, verifId).run();

  await auditAdminConfig(c.env.DB, "manual_reject", "bounty_verification", verifId, {
    operator: adminUsername,
    userId: verif.user_id,
    taskId: verif.bounty_task_id,
    feedback
  });

  return c.json({ success: true, message: "已成功拒绝该提交。" });
});

app.get(`${ADMIN_PREFIX}/fomo`, async (c) => {
  const auth = await requireAdmin(c);
  if (auth) return auth;
  await ensureAdminConfigData(c.env.DB);
  const snapshot = await buildFomoSnapshot(c.env.DB);
  const events = await c.env.DB.prepare(
    "SELECT event_name, COUNT(*) AS count FROM analytics_events WHERE created_at >= datetime('now', '-1 day') GROUP BY event_name"
  ).all<{ event_name: string; count: number }>();
  const eventCounts = new Map(events.results.map((event) => [event.event_name, Number(event.count || 0)]));
  const userCount = await count(c.env.DB, "users");
  const agentCount = await count(c.env.DB, "agents");
  const starterOpens = await countWhere(c.env.DB, "point_ledger_events", "event_type = 'box_open' AND metadata_json LIKE '%Starter Box%'");
  const taskSubmits = await count(c.env.DB, "task_verifications");
  const taskApprovals = await countWhere(c.env.DB, "task_verifications", "status = 'approved'");
  const bountySubmits = await count(c.env.DB, "bounty_task_verifications");
  const bountyApprovals = await countWhere(c.env.DB, "bounty_task_verifications", "status = 'approved'");
  const riskBounty = await countWhere(c.env.DB, "bounty_task_verifications", "risk_flagged = 1");
  const d1Users = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM users WHERE created_at <= datetime('now', '-1 day') AND last_seen_at >= datetime(created_at, '+1 day')"
  ).first<{ count: number }>();
  const sourceRows = await c.env.DB.prepare(
    "SELECT COALESCE(source, 'unknown') AS source, COUNT(*) AS count FROM analytics_events WHERE created_at >= datetime('now', '-7 day') GROUP BY source ORDER BY count DESC LIMIT 8"
  ).all<{ source: string; count: number }>();
  const shareRows = await c.env.DB.prepare(
    "SELECT event_name, COALESCE(source, 'unknown') AS source, COUNT(*) AS count FROM analytics_events WHERE event_name IN ('share_clicked','share_completed','share_personal_report','share_box_report','share_group_invite') AND created_at >= datetime('now', '-7 day') GROUP BY event_name, source ORDER BY count DESC"
  ).all<{ event_name: string; source: string; count: number }>();
  return c.json({
    rareDrops: snapshot.recentDrops,
    activeListings: snapshot.market.activeListings ?? 0,
    boxSupply: snapshot.boxSupply ?? [],
    shareSurfaces: [
      { key: "personal_report", label: "Agent 战报分享", status: "active" },
      { key: "box_report", label: "技能包结果分享", status: "active" },
      { key: "crew_invite", label: "战队邀请分享", status: "active" },
      { key: "bounty_completed", label: "赏金通过分享", status: "ready" }
    ],
    shareEvents: events.results.map((event) => ({ eventName: event.event_name, count: Number(event.count || 0) })),
    growthFunnel: [
      { key: "mini_app_opened", label: "打开 Mini App", count: Math.max(eventCounts.get("mini_app_opened") || 0, eventCounts.get("miniapp_open") || 0) },
      { key: "agent_claimed", label: "领取 Agent", count: Math.max(eventCounts.get("agent_claimed") || 0, agentCount) },
      { key: "starter_box_opened", label: "开启启动技能包", count: Math.max(eventCounts.get("starter_box_opened") || 0, starterOpens) },
      { key: "task_submitted", label: "提交基础任务", count: Math.max(eventCounts.get("task_submitted") || 0, taskSubmits) },
      { key: "task_completed", label: "基础任务通过", count: Math.max(eventCounts.get("task_completed") || 0, taskApprovals) },
      { key: "bounty_submitted", label: "提交赏金任务", count: Math.max(eventCounts.get("bounty_submitted") || 0, bountySubmits) },
      { key: "bounty_approved", label: "赏金验收通过", count: Math.max(eventCounts.get("bounty_approved") || 0, bountyApprovals) },
      { key: "share_completed", label: "完成分享动作", count: (eventCounts.get("share_completed") || 0) + (eventCounts.get("share_personal_report") || 0) + (eventCounts.get("share_box_report") || 0) + (eventCounts.get("share_group_invite") || 0) },
      { key: "invite_activated", label: "邀请激活", count: eventCounts.get("invite_activated") || 0 },
      { key: "d1_retained", label: "次日留存", count: Number(d1Users?.count || 0) }
    ],
    channelBreakdown: sourceRows.results.map((row) => ({ source: row.source, count: Number(row.count || 0) })),
    shareBreakdown: shareRows.results.map((row) => ({ eventName: row.event_name, source: row.source, count: Number(row.count || 0) })),
    riskSignals: [
      { key: "bounty_risk_flagged", label: "赏金人工复核", count: riskBounty },
      { key: "restricted_users", label: "受限用户", count: await countWhere(c.env.DB, "users", "risk_status != 'normal'") }
    ],
    userTotal: userCount
  });
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(env.JOBS.send({ type: "cron_tick", at: new Date().toISOString() }));
  },
  async queue(batch: MessageBatch, _env: Bindings) {
    for (const message of batch.messages) {
      try {
        console.log("job", message.body);
        message.ack();
      } catch {
        message.retry({ delaySeconds: 60 });
      }
    }
  }
};

async function requireUser(c: AppContext): Promise<DbUser> {
  const bodyInitData = c.req.header("x-telegram-init-data") || undefined;
  const auth = await resolveTelegramAuth(c, bodyInitData);
  return getOrCreateUser(c.env.DB, auth, null);
}

function requireEconomyAllowed(user: DbUser, action: string): { error: string; message: string; action: string; riskStatus: RiskStatus } | null {
  if (user.risk_status === "normal") return null;
  return {
    error: "risk_restricted",
    message: "This account is under risk review. Economic actions are temporarily unavailable.",
    action,
    riskStatus: user.risk_status
  };
}

async function resolveTelegramAuth(c: AppContext, initData?: string): Promise<TelegramAuthResult> {
  if (c.env.APP_ENV !== "production" && !initData) return DEFAULT_TELEGRAM_USER;
  if (!initData || !c.env.TELEGRAM_BOT_TOKEN) {
    if (c.env.APP_ENV === "production") throw new Error("telegram_auth_required");
    return DEFAULT_TELEGRAM_USER;
  }

  const parsed = new URLSearchParams(initData);
  const hash = parsed.get("hash");
  const userRaw = parsed.get("user");
  if (!hash || !userRaw) throw new Error("invalid_telegram_init_data");

  const ok = await verifyTelegramInitData(initData, c.env.TELEGRAM_BOT_TOKEN);
  if (!ok) throw new Error("invalid_telegram_signature");

  const user = JSON.parse(userRaw) as { id: number; username?: string; first_name?: string; language_code?: string };
  return {
    telegramId: String(user.id),
    username: user.username || `tg_${user.id}`,
    firstName: user.first_name || null,
    languageCode: user.language_code || "en"
  };
}

async function verifyTelegramInitData(initData: string, botToken: string): Promise<boolean> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;
  params.delete("hash");
  const dataCheckString = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = await crypto.subtle.importKey("raw", new TextEncoder().encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const secretKey = await crypto.subtle.sign("HMAC", secret, new TextEncoder().encode(botToken));
  const hmacKey = await crypto.subtle.importKey("raw", secretKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(dataCheckString));
  return toHex(signature) === hash;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getOrCreateUser(db: D1Database, auth: TelegramAuthResult, startParam: string | null): Promise<DbUser> {
  const existing = await db.prepare("SELECT * FROM users WHERE telegram_id = ?").bind(auth.telegramId).first<DbUser>();
  if (existing) {
    await db.prepare("UPDATE users SET username = ?, first_name = ?, language_code = ?, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").bind(auth.username, auth.firstName, auth.languageCode, existing.id).run();
    return { ...existing, username: auth.username, first_name: auth.firstName, language_code: auth.languageCode };
  }
  const userId = id("user");
  await db.prepare(
    "INSERT INTO users (id, telegram_id, username, first_name, language_code, entry_source, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
  ).bind(userId, auth.telegramId, auth.username, auth.firstName, auth.languageCode, startParam).run();
  return (await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<DbUser>())!;
}

async function getAgent(db: D1Database, userId: string): Promise<DbAgent | null> {
  return db.prepare("SELECT * FROM agents WHERE user_id = ? AND status = 'active'").bind(userId).first<DbAgent>();
}

async function requireAgent(db: D1Database, userId: string): Promise<DbAgent> {
  const agent = await getAgent(db, userId);
  if (!agent) throw new Error("agent_required");
  return agent;
}

async function getInventoryItem(db: D1Database, id: string, userId: string): Promise<DbInventoryItem | null> {
  return db.prepare("SELECT * FROM inventory_items WHERE id = ? AND owner_user_id = ?").bind(id, userId).first<DbInventoryItem>();
}

async function getStarterBox(db: D1Database, userId: string): Promise<InventoryItem | null> {
  const row = await db.prepare("SELECT * FROM inventory_items WHERE owner_user_id = ? AND item_type = 'box' AND name = 'Starter Box' AND status = 'available' ORDER BY created_at DESC LIMIT 1").bind(userId).first<DbInventoryItem>();
  return row ? toInventoryItem(row) : null;
}

async function getActiveListing(db: D1Database, listingId: string): Promise<DbListing | null> {
  return db.prepare(
    `SELECT marketplace_listings.*, inventory_items.name, inventory_items.rarity, inventory_items.metadata_json AS metadata_json, users.username
     FROM marketplace_listings
     JOIN inventory_items ON inventory_items.id = marketplace_listings.inventory_item_id
     JOIN users ON users.id = marketplace_listings.seller_user_id
     WHERE marketplace_listings.id = ? AND marketplace_listings.status = 'active'`
  ).bind(listingId).first<DbListing>();
}

async function toUser(db: D1Database, row: DbUser): Promise<User> {
  const agent = await getAgent(db, row.id);
  const score = await pointTotal(db, row.id, "user_score");
  return {
    id: row.id,
    telegramId: row.telegram_id,
    username: row.username || row.telegram_id,
    languageCode: row.language_code || "en",
    rankTier: rankTier(score),
    riskStatus: row.risk_status,
    hasAgent: Boolean(agent),
    studioEnabled: Number(row.studio_enabled ?? 0) === 1,
    planTier: row.plan_tier || "free"
  };
}

async function toAgent(db: D1Database, row: DbAgent): Promise<Agent> {
  const pendingPoints = await pointTotal(db, row.user_id, "pending_points");
  const userScore = await pointTotal(db, row.user_id, "user_score");
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    energy: row.energy,
    maxEnergy: row.max_energy,
    pendingPoints,
    userScore,
    rankTier: rankTier(userScore),
    autoRunUntil: row.auto_run_until
  };
}

function getDesensitizedSummary(name: string, category: string): string {
  const mapping: Record<string, string> = {
    "Mission Runner": "用途：[任务整理] 改善基础任务执行效率",
    "Alpha Scout": "用途：[任务发现] 扫描高价值 Alpha 任务",
    "Alpha Radar": "用途：[任务发现] 扫描高价值 Alpha 任务",
    "Crew Captain": "用途：[增长传播] 提升战队协同任务整理速度",
    "Crew Boost": "用途：[增长传播] 提升战队裂变增长速率",
    "Project Access Pass": "用途：[验收与信誉] 提升项目资格验收通过概率",
    "Allowlist Weight": "用途：[验收与信誉] 提高项目准入评分与分配权重",
    "Wallet Task Permit": "用途：[交易准备] 钱包交互策略与安全隔离规则",
    "Wallet Operator": "用途：[交易准备] 隔离签名策略与自动下单功能",
    "Task Reroll": "用途：[任务整理] 重新对准任务队列和整理分类",
    "Energy Recovery": "用途：[基础状态] 快速为 Agent 注入执行能量"
  };
  return mapping[name] || `用途：[${category || "通用技能"}] 改善 Agent 部分执行参数`;
}

async function releaseCooledDownSkillCards(db: D1Database, userId: string) {
  const rows = await db.prepare(
    "SELECT * FROM inventory_items WHERE owner_user_id = ? AND item_type = 'ability' AND status = 'cooling_down'"
  ).bind(userId).all<DbInventoryItem>();
  const statements: D1PreparedStatement[] = [];
  const now = Date.now();

  for (const row of rows.results) {
    const meta = parseJson<Record<string, unknown>>(row.metadata_json, {});
    const cooldownUntil = typeof meta.cooldownUntil === "string" ? meta.cooldownUntil : null;
    if (!cooldownUntil || new Date(cooldownUntil).getTime() > now) continue;

    const originalTransferable = meta.originalTransferable === true && row.soulbound !== 1;
    const nextMeta = {
      ...meta,
      cooldownUntil: null,
      learnStatus: "unlearned"
    };
    statements.push(
      db.prepare(
        "UPDATE inventory_items SET status = 'available', transferable = ?, metadata_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(originalTransferable ? 1 : 0, JSON.stringify(nextMeta), row.id)
    );
  }

  if (statements.length > 0) {
    await db.batch(statements);
  }
}

function toInventoryItem(row: DbInventoryItem): InventoryItem {
  const meta = parseJson<{
    usesRemaining?: number;
    effect?: string;
    sourceBox?: string;
    tradableAfterOpen?: boolean;
    category?: ItemCategory;
    cardNumber?: string;
    series?: string;
    learnStatus?: InventoryItem["learnStatus"];
    cooldownUntil?: string | null;
  }>(row.metadata_json, {});
  const cat = meta.category || categoryForAsset(row.name) || "skill";
  return {
    id: row.id,
    type: row.item_type,
    name: row.name,
    rarity: row.rarity,
    transferable: row.transferable === 1,
    soulbound: row.soulbound === 1,
    expiresAt: row.expires_at,
    status: row.status,
    usesRemaining: meta.usesRemaining,
    effect: getDesensitizedSummary(row.name, cat),
    sourceBox: meta.sourceBox,
    tradableLabel: meta.tradableAfterOpen === false ? "Soulbound" : row.transferable === 1 ? "Market ready" : undefined,
    category: cat,
    cardNumber: meta.cardNumber,
    series: meta.series,
    learnStatus: row.status === "active" ? "equipped" : meta.learnStatus || "unlearned",
    cooldownUntil: meta.cooldownUntil ?? null
  };
}

function toTask(row: DbTask): Task {
  const meta = parseJson<{ projectName?: string; requiredAbility?: string; targetUrl?: string }>(row.metadata_json, {});
  return {
    id: row.id,
    name: row.name,
    energyCost: row.energy_cost,
    basePendingPoints: row.base_pending_points,
    projectId: row.project_id,
    projectName: meta.projectName,
    requiresWallet: row.requires_wallet === 1,
    autoExecutable: row.auto_executable === 1,
    requiredAbility: meta.requiredAbility,
    endsAt: row.ends_at,
    targetUrl: meta.targetUrl || undefined,
    code: row.code
  };
}

function toAdminTask(task: DbTask) {
  return {
    id: task.id,
    name: task.name,
    energyCost: task.energy_cost,
    basePendingPoints: task.base_pending_points,
    status: task.status
  };
}

function toMarketplaceListing(row: DbListing): MarketplaceListing {
  const meta = parseJson<{ category?: ItemCategory; cardNumber?: string; series?: string }>(row.metadata_json || null, {});
  return {
    id: row.id,
    assetItemId: row.inventory_item_id,
    name: row.name,
    rarity: row.rarity,
    price: row.price,
    currency: row.currency,
    seller: row.username || row.seller_user_id,
    expiresAt: row.expires_at || new Date(Date.now() + 86_400_000).toISOString(),
    category: meta.category || categoryForAsset(row.name),
    cardNumber: meta.cardNumber
  };
}

async function handleTelegramWebhook(env: Bindings, update: unknown): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  const message = (update as { message?: { chat?: { id?: number | string }; text?: string } }).message;
  const chatId = message?.chat?.id;
  const text = message?.text?.trim() || "";
  if (!chatId || !text.startsWith("/")) return;

  const command = text.split(/\s+/)[0]?.split("@")[0]?.toLowerCase() || "/start";
  const payload = telegramCommandPayload(command, env.MINIAPP_ORIGIN || "https://app.gb8.top");
  await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, payload.text, payload.buttonText, payload.url);
}

function telegramCommandPayload(command: string, miniAppUrl: string): { text: string; buttonText: string; url: string } {
  const baseUrl = miniAppUrl.replace(/\/$/, "");
  if (command === "/farm") {
    return {
      text: "你的 GrowthBot Agent 可以在 Mini App 中执行任务。打开后可查看能量、积分和可用任务。",
      buttonText: "查看任务",
      url: `${baseUrl}/?tgWebAppStartParam=missions`
    };
  }
  if (command === "/boxes") {
    return {
      text: "盲盒可揭示积分、能量、职业、技能、许可证和准入权资产。打开 GrowthBot 查看可用盲盒。",
      buttonText: "查看盲盒",
      url: `${baseUrl}/?tgWebAppStartParam=boxes`
    };
  }
  if (command === "/market") {
    return {
      text: "市场展示可流通的盲盒、技能、许可证和准入权，并提供地板价、到期时间和近期成交。",
      buttonText: "查看市场",
      url: `${baseUrl}/?tgWebAppStartParam=market`
    };
  }
  if (command === "/pool") {
    return {
      text: "战队可帮助已验证 Agent 解锁战队盒。打开 GrowthBot 加入战队或分享邀请。",
      buttonText: "查看战队",
      url: `${baseUrl}/?tgWebAppStartParam=pool`
    };
  }
  if (command === "/help") {
    return {
      text: "GrowthBot V0 使用积分、盲盒、任务和未来奖励资格机制。V0 不需要钱包资金，也不承诺固定奖励、收益或固定兑换比例。",
      buttonText: "打开 GrowthBot",
      url: baseUrl
    };
  }
  return {
    text: "欢迎使用 GrowthBot。领取免费 Agent，开启启动盒，执行任务，并通过 Telegram 构建未来奖励资格。",
    buttonText: "打开 GrowthBot",
    url: baseUrl
  };
}

async function sendTelegramMessage(token: string, chatId: number | string, text: string, buttonText: string, url: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[
          {
            text: buttonText,
            web_app: { url }
          }
        ]]
      }
    })
  });
  if (!response.ok) {
    console.log("telegram_send_failed", await response.text().catch(() => ""));
  }
}

async function pointTotal(db: D1Database, userId: string, pointType: string): Promise<number> {
  const row = await db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM point_ledger_events WHERE user_id = ? AND point_type = ?").bind(userId, pointType).first<{ total: number }>();
  return Number(row?.total ?? 0);
}

function ledger(db: D1Database, userId: string, agentId: string | null, eventType: string, pointType: string, amount: number, projectId: string | null, sourceId: string, metadata: Record<string, unknown>): D1PreparedStatement {
  return db.prepare(
    "INSERT INTO point_ledger_events (id, user_id, agent_id, event_type, point_type, amount, project_id, source_id, quality_multiplier, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)"
  ).bind(id("ledger"), userId, agentId, eventType, pointType, amount, projectId, sourceId, JSON.stringify(metadata));
}

async function ensureSeedData(db: D1Database): Promise<boolean> {
  const row = await db.prepare("SELECT COUNT(*) AS count FROM tasks").first<{ count: number }>();
  if ((row?.count ?? 0) > 0) {
    await ensureV03Data(db);
    return false;
  }
  const sellerId = "user_demo_seller";
  const listedItemId = "item_demo_fomo_box";
  const listingId = "listing_demo_fomo_box";
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO tasks (id, project_id, code, name, description, task_type, energy_cost, base_pending_points, requires_wallet, auto_executable, status, metadata_json) VALUES ('task_daily_checkin', NULL, 'telegram_checkin', '加入 TG 官方频道', '指挥 Agent 加入 GrowthBot 官方频道获取项目首发快讯。', 'checkin', 10, 100, 0, 0, 'active', '{\"targetUrl\":\"https://t.me/GrowthBotOfficial\"}')"),
    db.prepare("INSERT OR IGNORE INTO tasks (id, project_id, code, name, description, task_type, energy_cost, base_pending_points, requires_wallet, auto_executable, status, metadata_json, ends_at) VALUES ('task_group_pool', NULL, 'discord_join', '加入 Discord 社区', '加入 Discord 激活社区协作加权。', 'group_pool', 15, 160, 0, 0, 'active', '{\"targetUrl\":\"https://discord.gg/growthbot\"}', datetime('now', '+12 hours'))"),
    db.prepare("INSERT OR IGNORE INTO tasks (id, project_id, code, name, description, task_type, energy_cost, base_pending_points, requires_wallet, auto_executable, status, metadata_json, ends_at) VALUES ('task_launch_sniper', 'project_genesis', 'twitter_follow', '关注官方推特 X', '在推特上关注 GrowthBot 官方账号以获取分配权重。', 'launch', 40, 620, 0, 0, 'active', '{\"projectName\":\"Genesis Pool\",\"requiredAbility\":\"Alpha Radar\",\"targetUrl\":\"https://x.com/growthbot\"}', datetime('now', '+2 hours'))"),
    db.prepare("INSERT OR IGNORE INTO tasks (id, project_id, code, name, description, task_type, energy_cost, base_pending_points, requires_wallet, auto_executable, status, metadata_json) VALUES ('task_onchain_snipe', 'project_airdrop', 'survey_feedback', '填写产品反馈问卷', '提交问卷，反馈 V0.4 升级体验。', 'wallet', 50, 950, 1, 0, 'active', '{\"projectName\":\"TON Airdrop\",\"targetUrl\":\"https://forms.gle/growthbot\"}')"),
    db.prepare("INSERT OR IGNORE INTO users (id, telegram_id, username, first_name, language_code, risk_status) VALUES (?, '900000001', 'drop_hunter', 'Drop', 'en', 'normal')").bind(sellerId),
    db.prepare("INSERT OR IGNORE INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, expires_at) VALUES (?, ?, 'box', 'Alpha Box', 'rare', 'listed', 1, 0, datetime('now', '+1 day'))").bind(listedItemId, sellerId),
    db.prepare("INSERT OR IGNORE INTO marketplace_listings (id, seller_user_id, inventory_item_id, price, currency, status, expires_at) VALUES (?, ?, ?, '12.5', 'POINT_TEST', 'active', datetime('now', '+1 day'))").bind(listingId, sellerId, listedItemId),
    db.prepare("INSERT OR IGNORE INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, expires_at, metadata_json) VALUES ('item_demo_group_box', ?, 'box', 'Crew Box', 'epic', 'listed', 1, 0, datetime('now', '+9 hours'), '{\"supply\":\"group_unlock\"}')").bind(sellerId),
    db.prepare("INSERT OR IGNORE INTO marketplace_listings (id, seller_user_id, inventory_item_id, price, currency, status, expires_at) VALUES ('listing_demo_group_box', ?, 'item_demo_group_box', '28.0', 'POINT_TEST', 'active', datetime('now', '+9 hours'))").bind(sellerId),
    db.prepare("INSERT OR IGNORE INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, expires_at, metadata_json) VALUES ('item_demo_3x_boost', ?, 'ability', 'Task Reroll', 'epic', 'listed', 1, 0, datetime('now', '+4 hours'), '{\"usesRemaining\":1,\"effect\":\"Reroll one Mission result preview\"}')").bind(sellerId),
    db.prepare("INSERT OR IGNORE INTO marketplace_listings (id, seller_user_id, inventory_item_id, price, currency, status, expires_at) VALUES ('listing_demo_3x_boost', ?, 'item_demo_3x_boost', '45.0', 'POINT_TEST', 'active', datetime('now', '+4 hours'))").bind(sellerId),
    db.prepare("INSERT OR IGNORE INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, expires_at, metadata_json) VALUES ('item_demo_project_box', ?, 'box', 'Project Box', 'legendary', 'listed', 1, 0, datetime('now', '+2 hours'), '{\"supply\":\"campaign\"}')").bind(sellerId),
    db.prepare("INSERT OR IGNORE INTO marketplace_listings (id, seller_user_id, inventory_item_id, price, currency, status, expires_at) VALUES ('listing_demo_project_box', ?, 'item_demo_project_box', '88.0', 'POINT_TEST', 'active', datetime('now', '+2 hours'))").bind(sellerId)
  ]);
  await ensureV03Data(db);
  return true;
}

async function ensureV03Data(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare("UPDATE inventory_items SET name = 'Alpha Box' WHERE name = 'FOMO Box'"),
    db.prepare("UPDATE inventory_items SET name = 'Crew Box' WHERE name = 'Group Box'"),
    db.prepare("UPDATE inventory_items SET name = 'Mission Runner', metadata_json = json_set(COALESCE(metadata_json, '{}'), '$.category', 'profession', '$.effect', 'Improves basic Mission consistency') WHERE name = '24h Auto Farmer'"),
    db.prepare("UPDATE inventory_items SET name = 'Alpha Radar', metadata_json = json_set(COALESCE(metadata_json, '{}'), '$.category', 'skill', '$.effect', 'Unlocks Alpha Mission access') WHERE name = 'Launch Sniper Access'"),
    db.prepare("UPDATE inventory_items SET name = 'Crew Boost', metadata_json = json_set(COALESCE(metadata_json, '{}'), '$.category', 'skill', '$.effect', 'Boosts Crew unlock progress') WHERE name = 'Group Rally Boost'"),
    db.prepare("UPDATE inventory_items SET name = 'Project Access Pass', metadata_json = json_set(COALESCE(metadata_json, '{}'), '$.category', 'access', '$.effect', 'Adds project-specific reward eligibility weight') WHERE name = 'Project Allowlist Ticket'"),
    db.prepare("UPDATE inventory_items SET name = 'Task Reroll', metadata_json = json_set(COALESCE(metadata_json, '{}'), '$.category', 'skill', '$.effect', 'Reroll one Mission result preview') WHERE name = '3x Points Boost'"),
    db.prepare("UPDATE tasks SET name = '加入 TG 官方频道', description = '指挥 Agent 加入 GrowthBot 官方频道获取项目首发快讯。', metadata_json = '{\"targetUrl\":\"https://t.me/GrowthBotOfficial\"}' WHERE id = 'task_daily_checkin'"),
    db.prepare("UPDATE tasks SET code = 'discord_join', name = '加入 Discord 社区', description = '加入 Discord 激活社区协作加权。', metadata_json = '{\"targetUrl\":\"https://discord.gg/growthbot\"}' WHERE id = 'task_group_pool'"),
    db.prepare("UPDATE tasks SET code = 'twitter_follow', name = '关注官方推特 X', description = '在推特上关注 GrowthBot 官方账号以获取分配权重。', metadata_json = '{\"projectName\":\"Genesis Pool\",\"requiredAbility\":\"Alpha Radar\",\"targetUrl\":\"https://x.com/growthbot\"}' WHERE id = 'task_launch_sniper'"),
    db.prepare("UPDATE tasks SET code = 'survey_feedback', name = '填写产品反馈问卷', description = '提交问卷，反馈 V0.4 升级体验。', metadata_json = '{\"projectName\":\"TON Airdrop\",\"targetUrl\":\"https://forms.gle/growthbot\"}' WHERE id = 'task_onchain_snipe'")
  ]);
  await ensureAdminConfigData(db);
}

async function ensureAdminConfigData(db: D1Database): Promise<void> {
  // Idempotently check and patch columns for users table
  try {
    const tableInfo = await db.prepare("PRAGMA table_info(users)").all<{ name: string }>();
    const cols = tableInfo.results.map(r => r.name);
    if (!cols.includes("studio_enabled")) {
      await db.prepare("ALTER TABLE users ADD COLUMN studio_enabled INTEGER NOT NULL DEFAULT 0").run();
    }
    if (!cols.includes("plan_tier")) {
      await db.prepare("ALTER TABLE users ADD COLUMN plan_tier TEXT NOT NULL DEFAULT 'free'").run();
    }
  } catch (err) {
    console.error("Failed to ensure studio columns in users table:", err);
  }

  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS box_definitions (id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', rarity TEXT NOT NULL DEFAULT 'common', total_supply INTEGER NOT NULL DEFAULT 0, remaining_supply INTEGER NOT NULL DEFAULT 0, daily_release INTEGER NOT NULL DEFAULT 0, acquisition_route TEXT NOT NULL DEFAULT '', starts_at TEXT, ends_at TEXT, transferable_before_open INTEGER NOT NULL DEFAULT 0, binding_strategy TEXT NOT NULL DEFAULT 'soulbound', metadata_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS asset_definitions (id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, name TEXT NOT NULL, category TEXT NOT NULL, rarity TEXT NOT NULL DEFAULT 'common', status TEXT NOT NULL DEFAULT 'enabled', transferable INTEGER NOT NULL DEFAULT 0, default_expiry_hours INTEGER, default_uses INTEGER, effect TEXT NOT NULL DEFAULT '', applicable_tasks_json TEXT NOT NULL DEFAULT '[]', applicable_boxes_json TEXT NOT NULL DEFAULT '[]', requires_wallet INTEGER NOT NULL DEFAULT 0, metadata_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS box_drop_pool_items (id TEXT PRIMARY KEY, box_id TEXT NOT NULL, asset_id TEXT, asset_name TEXT NOT NULL, category TEXT NOT NULL, rarity TEXT NOT NULL DEFAULT 'common', weight REAL NOT NULL, min_quantity INTEGER NOT NULL DEFAULT 1, max_quantity INTEGER NOT NULL DEFAULT 1, uses_remaining INTEGER, expiry_hours INTEGER, transferable INTEGER NOT NULL DEFAULT 0, soulbound INTEGER NOT NULL DEFAULT 0, effect TEXT NOT NULL DEFAULT '', requires_wallet INTEGER NOT NULL DEFAULT 0, project_id TEXT, metadata_json TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS market_rules (id TEXT PRIMARY KEY, platform_fee_percent REAL NOT NULL DEFAULT 2.5, min_price TEXT NOT NULL DEFAULT '0.1', max_price TEXT NOT NULL DEFAULT '1000.0', listing_expiry_days INTEGER NOT NULL DEFAULT 7, allow_starter_box_trade INTEGER NOT NULL DEFAULT 0, allow_project_box_trade INTEGER NOT NULL DEFAULT 1, market_paused INTEGER NOT NULL DEFAULT 0, cancel_rules TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS admin_config_audit_logs (id TEXT PRIMARY KEY, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT, metadata_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS skill_card_sequences (card_type TEXT PRIMARY KEY, current_val INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE TABLE IF NOT EXISTS task_verifications (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, user_id TEXT NOT NULL, link TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'submitted', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, verified_at TEXT, feedback TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS bounty_tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, category TEXT NOT NULL, platform TEXT NOT NULL, target_url TEXT NOT NULL, budget_total INTEGER NOT NULL DEFAULT 0, budget_remaining INTEGER NOT NULL DEFAULT 0, reward_points INTEGER NOT NULL DEFAULT 0, reward_asset_name TEXT, reward_access_pass TEXT, deadline TEXT, verification_rule TEXT, submission_type TEXT NOT NULL DEFAULT 'link', risk_level TEXT NOT NULL DEFAULT 'low', owner_type TEXT NOT NULL, owner_name TEXT, completed_count INTEGER NOT NULL DEFAULT 0, max_completions INTEGER NOT NULL DEFAULT 0, paused_reason TEXT, status TEXT NOT NULL DEFAULT 'active', created_by_admin INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, settlement_mode TEXT NOT NULL DEFAULT 'offchain', chain_id INTEGER, escrow_contract TEXT, escrow_tx_hash TEXT, reward_token TEXT, reward_token_address TEXT, reward_decimals INTEGER, oracle_mode TEXT NOT NULL DEFAULT 'format_check', dispute_status TEXT NOT NULL DEFAULT 'none')"),
    db.prepare("CREATE TABLE IF NOT EXISTS bounty_task_verifications (id TEXT PRIMARY KEY, bounty_task_id TEXT NOT NULL, user_id TEXT NOT NULL, link TEXT NOT NULL, submission_hash TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'submitted', risk_flagged INTEGER NOT NULL DEFAULT 0, feedback TEXT, reviewed_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, verified_at TEXT, reward_granted_at TEXT, FOREIGN KEY (bounty_task_id) REFERENCES bounty_tasks(id))"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_bounty_task_status ON bounty_tasks(status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_bounty_verif_user ON bounty_task_verifications(user_id, status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_bounty_verif_task ON bounty_task_verifications(bounty_task_id)")
  ]);

  await seedOperationalBountyTemplates(db);

  const row = await db.prepare("SELECT COUNT(*) AS count FROM box_definitions").first<{ count: number }>();
  if ((row?.count ?? 0) > 0) return;

  await db.batch([
    db.prepare("INSERT OR IGNORE INTO box_definitions (id, key, name, status, rarity, total_supply, remaining_supply, daily_release, acquisition_route, starts_at, transferable_before_open, binding_strategy) VALUES ('box_starter', 'starter', '启动盒', 'active', 'common', 2047, 1488, 150, '启动赠送', '2026-06-16T00:00:00Z', 0, 'soulbound')"),
    db.prepare("INSERT OR IGNORE INTO box_definitions (id, key, name, status, rarity, total_supply, remaining_supply, daily_release, acquisition_route, starts_at, transferable_before_open, binding_strategy) VALUES ('box_alpha', 'alpha', 'Alpha 盒', 'active', 'rare', 333, 221, 20, '任务产出与市场交易', '2026-06-16T00:00:00Z', 1, 'transferable')"),
    db.prepare("INSERT OR IGNORE INTO box_definitions (id, key, name, status, rarity, total_supply, remaining_supply, daily_release, acquisition_route, starts_at, transferable_before_open, binding_strategy) VALUES ('box_crew', 'crew', '战队盒', 'active', 'epic', 88, 57, 5, '战队活跃达标解锁', '2026-06-16T00:00:00Z', 1, 'transferable')"),
    db.prepare("INSERT OR IGNORE INTO box_definitions (id, key, name, status, rarity, total_supply, remaining_supply, daily_release, acquisition_route, starts_at, ends_at, transferable_before_open, binding_strategy) VALUES ('box_project', 'project', '项目盒', 'draft', 'legendary', 47, 47, 10, '合作项目活动', '2026-06-16T00:00:00Z', '2026-07-16T00:00:00Z', 1, 'transferable')"),
    db.prepare("INSERT OR IGNORE INTO box_definitions (id, key, name, status, rarity, total_supply, remaining_supply, daily_release, acquisition_route, transferable_before_open, binding_strategy) VALUES ('box_wallet', 'wallet', '钱包盒', 'draft', 'legendary', 100, 100, 0, '链上任务准入', 1, 'transferable')"),
    db.prepare("INSERT OR IGNORE INTO asset_definitions (id, key, name, category, rarity, status, transferable, default_expiry_hours, default_uses, effect, applicable_tasks_json, applicable_boxes_json, requires_wallet) VALUES ('ast_1', 'mission_runner', '任务执行员', 'profession', 'common', 'enabled', 1, NULL, NULL, '提升基础任务执行稳定性', '[\"task_daily_checkin\"]', '[\"box_starter\"]', 0)"),
    db.prepare("INSERT OR IGNORE INTO asset_definitions (id, key, name, category, rarity, status, transferable, default_expiry_hours, default_uses, effect, applicable_tasks_json, applicable_boxes_json, requires_wallet) VALUES ('ast_2', 'alpha_scout', 'Alpha 侦察员', 'profession', 'rare', 'enabled', 1, NULL, NULL, '发现 Alpha 高价值任务', '[\"task_launch_sniper\"]', '[\"box_alpha\"]', 0)"),
    db.prepare("INSERT OR IGNORE INTO asset_definitions (id, key, name, category, rarity, status, transferable, default_expiry_hours, default_uses, effect, applicable_tasks_json, applicable_boxes_json, requires_wallet) VALUES ('ast_3', 'crew_captain', '战队队长', 'profession', 'epic', 'enabled', 1, NULL, NULL, '激活战队协同加成', '[\"task_group_pool\"]', '[\"box_crew\"]', 0)"),
    db.prepare("INSERT OR IGNORE INTO asset_definitions (id, key, name, category, rarity, status, transferable, default_expiry_hours, default_uses, effect, applicable_tasks_json, applicable_boxes_json, requires_wallet) VALUES ('ast_4', 'wallet_operator', '钱包操作员', 'profession', 'legendary', 'enabled', 1, NULL, NULL, '执行用户授权的钱包任务', '[\"task_onchain_snipe\"]', '[\"box_alpha\"]', 1)"),
    db.prepare("INSERT OR IGNORE INTO asset_definitions (id, key, name, category, rarity, status, transferable, default_expiry_hours, default_uses, effect, applicable_tasks_json, applicable_boxes_json, requires_wallet) VALUES ('ast_7', 'alpha_radar', 'Alpha 雷达', 'skill', 'rare', 'enabled', 1, 72, 5, '扫描高权重 Alpha 任务', '[\"task_launch_sniper\"]', '[\"box_alpha\"]', 0)"),
    db.prepare("INSERT OR IGNORE INTO asset_definitions (id, key, name, category, rarity, status, transferable, default_expiry_hours, default_uses, effect, applicable_tasks_json, applicable_boxes_json, requires_wallet) VALUES ('ast_8', 'crew_boost', '战队加速', 'skill', 'epic', 'enabled', 1, 24, 3, '提升战队解锁进度', '[\"task_group_pool\"]', '[\"box_starter\",\"box_crew\"]', 0)"),
    db.prepare("INSERT OR IGNORE INTO asset_definitions (id, key, name, category, rarity, status, transferable, default_expiry_hours, default_uses, effect, applicable_tasks_json, applicable_boxes_json, requires_wallet) VALUES ('ast_9', 'task_reroll', '任务重掷', 'skill', 'common', 'enabled', 1, NULL, 1, '刷新一次任务结果预览', '[]', '[\"box_starter\",\"box_crew\"]', 0)"),
    db.prepare("INSERT OR IGNORE INTO asset_definitions (id, key, name, category, rarity, status, transferable, default_expiry_hours, default_uses, effect, applicable_tasks_json, applicable_boxes_json, requires_wallet) VALUES ('ast_10', 'energy_recovery', '能量恢复', 'skill', 'common', 'enabled', 1, NULL, 1, '恢复 Agent 执行能量', '[]', '[\"box_starter\"]', 0)"),
    db.prepare("INSERT OR IGNORE INTO asset_definitions (id, key, name, category, rarity, status, transferable, default_expiry_hours, default_uses, effect, applicable_tasks_json, applicable_boxes_json, requires_wallet) VALUES ('ast_11', 'project_access_pass', '项目准入通行证', 'access', 'legendary', 'enabled', 1, 168, NULL, '增加合作项目奖励资格权重', '[]', '[\"box_project\"]', 0)"),
    db.prepare("INSERT OR IGNORE INTO asset_definitions (id, key, name, category, rarity, status, transferable, default_expiry_hours, default_uses, effect, applicable_tasks_json, applicable_boxes_json, requires_wallet) VALUES ('ast_12', 'wallet_task_permit', '钱包任务许可证', 'permit', 'legendary', 'enabled', 1, 24, 1, '授权一次高安全等级钱包任务', '[\"task_onchain_snipe\"]', '[\"box_alpha\"]', 1)"),
    db.prepare("INSERT OR IGNORE INTO asset_definitions (id, key, name, category, rarity, status, transferable, default_expiry_hours, default_uses, effect, applicable_tasks_json, applicable_boxes_json, requires_wallet) VALUES ('ast_14', 'allowlist_weight', '白名单权重', 'access', 'genesis', 'enabled', 0, NULL, NULL, '增加未来奖励资格权重', '[]', '[\"box_project\"]', 0)"),
    db.prepare("INSERT OR IGNORE INTO box_drop_pool_items (id, box_id, asset_name, category, rarity, weight, min_quantity, max_quantity, uses_remaining, expiry_hours, transferable, soulbound, effect, requires_wallet) VALUES ('dp_s1', 'box_starter', '任务重掷', 'skill', 'common', 45, 1, 1, 1, NULL, 0, 1, '刷新一次任务结果预览', 0)"),
    db.prepare("INSERT OR IGNORE INTO box_drop_pool_items (id, box_id, asset_name, category, rarity, weight, min_quantity, max_quantity, uses_remaining, expiry_hours, transferable, soulbound, effect, requires_wallet) VALUES ('dp_s2', 'box_starter', '能量恢复', 'skill', 'common', 20, 1, 1, 1, NULL, 0, 1, '恢复 Agent 执行能量', 0)"),
    db.prepare("INSERT OR IGNORE INTO box_drop_pool_items (id, box_id, asset_name, category, rarity, weight, min_quantity, max_quantity, transferable, soulbound, effect, requires_wallet) VALUES ('dp_a2', 'box_alpha', 'Alpha 雷达', 'skill', 'rare', 30, 1, 1, 1, 0, '扫描高权重 Alpha 任务', 0)"),
    db.prepare("INSERT OR IGNORE INTO box_drop_pool_items (id, box_id, asset_name, category, rarity, weight, min_quantity, max_quantity, uses_remaining, expiry_hours, transferable, soulbound, effect, requires_wallet) VALUES ('dp_a3', 'box_alpha', '钱包任务许可证', 'permit', 'legendary', 20, 1, 1, 1, 24, 1, 0, '授权一次高安全等级钱包任务', 1)"),
    db.prepare("INSERT OR IGNORE INTO box_drop_pool_items (id, box_id, asset_name, category, rarity, weight, min_quantity, max_quantity, transferable, soulbound, effect, requires_wallet) VALUES ('dp_c1', 'box_crew', '战队队长', 'profession', 'epic', 40, 1, 1, 1, 0, '激活战队协同加成', 0)"),
    db.prepare("INSERT OR IGNORE INTO box_drop_pool_items (id, box_id, asset_name, category, rarity, weight, min_quantity, max_quantity, transferable, soulbound, effect, requires_wallet) VALUES ('dp_p2', 'box_project', '项目准入通行证', 'access', 'legendary', 40, 1, 1, 1, 0, '增加合作项目奖励资格权重', 0)"),
    db.prepare("INSERT OR IGNORE INTO market_rules (id, platform_fee_percent, min_price, max_price, listing_expiry_days, allow_starter_box_trade, allow_project_box_trade, market_paused, cancel_rules) VALUES ('default', 2.5, '0.1', '1000.0', 7, 0, 1, 0, '挂单可由发布者取消；取消后资产退回背包，已成交订单不可撤销。')")
  ]);
}

async function seedOperationalBountyTemplates(db: D1Database): Promise<void> {
  const deadline = "2026-07-31T23:59:59Z";
  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO bounty_tasks (
        id, title, description, category, platform, target_url,
        budget_total, budget_remaining, reward_points, reward_asset_name, reward_access_pass,
        deadline, verification_rule, submission_type, risk_level, owner_type, owner_name,
        completed_count, max_completions, paused_reason, status, created_by_admin,
        settlement_mode, oracle_mode, dispute_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'link', ?, ?, ?, 0, ?, NULL, 'active', 1, 'offchain', 'format_check', 'none')`
    ).bind(
      "bounty_template_telegram_join",
      "加入 GrowthBot Telegram 社区",
      "加入官方 Telegram 社区，完成后提交 t.me 链接或个人公开主页链接。",
      "community",
      "telegram",
      "https://t.me/GrowthBotOfficial",
      20000,
      20000,
      80,
      null,
      null,
      deadline,
      "^https?:\\/\\/(www\\.)?t\\.me\\/[a-zA-Z0-9_+\\/-]+$",
      "low",
      "official",
      "GrowthBot 官方",
      250
    ),
    db.prepare(
      `INSERT OR IGNORE INTO bounty_tasks (
        id, title, description, category, platform, target_url,
        budget_total, budget_remaining, reward_points, reward_asset_name, reward_access_pass,
        deadline, verification_rule, submission_type, risk_level, owner_type, owner_name,
        completed_count, max_completions, paused_reason, status, created_by_admin,
        settlement_mode, oracle_mode, dispute_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'link', ?, ?, ?, 0, ?, NULL, 'active', 1, 'offchain', 'format_check', 'none')`
    ).bind(
      "bounty_template_x_repost",
      "转发 GrowthBot X 公告",
      "转发或引用官方公告，提交您的 X 帖子链接。",
      "social",
      "x",
      "https://x.com/growthbot",
      30000,
      30000,
      120,
      null,
      null,
      deadline,
      "^https?:\\/\\/(www\\.)?(twitter|x)\\.com\\/[a-zA-Z0-9_]+\\/status\\/[0-9]+",
      "medium",
      "official",
      "GrowthBot 官方",
      250
    ),
    db.prepare(
      `INSERT OR IGNORE INTO bounty_tasks (
        id, title, description, category, platform, target_url,
        budget_total, budget_remaining, reward_points, reward_asset_name, reward_access_pass,
        deadline, verification_rule, submission_type, risk_level, owner_type, owner_name,
        completed_count, max_completions, paused_reason, status, created_by_admin,
        settlement_mode, oracle_mode, dispute_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'link', ?, ?, ?, 0, ?, NULL, 'active', 1, 'offchain', 'format_check', 'none')`
    ).bind(
      "bounty_template_discord_join",
      "加入合作项目 Discord",
      "加入合作项目 Discord 并提交 Discord 邀请或公开资料链接。",
      "community",
      "discord",
      "https://discord.gg/growthbot",
      15000,
      15000,
      100,
      null,
      null,
      deadline,
      "^https?:\\/\\/(www\\.)?(discord\\.gg|discord\\.com)\\/[a-zA-Z0-9_\\/-]+",
      "medium",
      "project",
      "白名单项目方",
      150
    ),
    db.prepare(
      `INSERT OR IGNORE INTO bounty_tasks (
        id, title, description, category, platform, target_url,
        budget_total, budget_remaining, reward_points, reward_asset_name, reward_access_pass,
        deadline, verification_rule, submission_type, risk_level, owner_type, owner_name,
        completed_count, max_completions, paused_reason, status, created_by_admin,
        settlement_mode, oracle_mode, dispute_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'link', ?, ?, ?, 0, ?, NULL, 'active', 1, 'offchain', 'admin_review', 'none')`
    ).bind(
      "bounty_template_survey_feedback",
      "填写 V1 内测反馈问卷",
      "完成产品反馈问卷，提交表单完成页或回执链接。",
      "survey",
      "form",
      "https://forms.gle/growthbot",
      12000,
      12000,
      150,
      "反馈分析技能卡",
      null,
      deadline,
      "^https?:\\/\\/",
      "high",
      "official",
      "GrowthBot 官方",
      80
    ),
    db.prepare(
      `INSERT OR IGNORE INTO bounty_tasks (
        id, title, description, category, platform, target_url,
        budget_total, budget_remaining, reward_points, reward_asset_name, reward_access_pass,
        deadline, verification_rule, submission_type, risk_level, owner_type, owner_name,
        completed_count, max_completions, paused_reason, status, created_by_admin,
        settlement_mode, oracle_mode, dispute_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'link', ?, ?, ?, 0, ?, NULL, 'active', 1, 'offchain', 'format_check', 'none')`
    ).bind(
      "bounty_template_project_page",
      "访问项目活动页并完成登记",
      "打开合作项目活动页完成登记，提交活动页或公开回执链接。",
      "project",
      "web",
      "https://app.gb8.top",
      18000,
      18000,
      120,
      null,
      "项目活动准入权",
      deadline,
      "^https?:\\/\\/",
      "medium",
      "project",
      "白名单项目方",
      150
    )
  ]);
}

function rollBoxRewards(boxName: string): Array<{ type: string; amount?: number; itemId?: string; name?: string; rarity?: Rarity; category?: ItemCategory }> {
  if (boxName === "Starter Box") {
    return [
      { type: "pending_points", amount: 300 },
      { type: "energy", amount: 50 },
      { type: "ability", itemId: id("item"), name: "Mission Runner", rarity: "common", category: "profession" }
    ];
  }
  if (boxName === "Crew Box" || boxName === "Group Box") {
    return [
      { type: "pending_points", amount: 1200 },
      { type: "energy", amount: 35 },
      { type: "ability", itemId: id("item"), name: "Crew Captain", rarity: "epic", category: "profession" }
    ];
  }
  if (boxName === "Project Box") {
    return [
      { type: "pending_points", amount: 2400 },
      { type: "ability", itemId: id("item"), name: "Project Access Pass", rarity: "legendary", category: "access" }
    ];
  }
  return [
    { type: "pending_points", amount: 800 },
    { type: "ability", itemId: id("item"), name: "Alpha Radar", rarity: "rare", category: "skill" }
  ];
}

function abilityUses(name: string): number {
  if (name.includes("Mission Runner")) return 3;
  if (name.includes("Crew")) return 2;
  if (name.includes("Permit") || name.includes("Pass")) return 1;
  return 1;
}

function abilityEffect(name: string): string {
  if (name.includes("3x")) return "Reroll one Mission result preview";
  if (name.includes("Alpha Radar")) return "Unlocks Alpha Mission access";
  if (name.includes("Crew")) return "Boosts Crew unlock progress";
  if (name.includes("Allowlist")) return "Adds project-specific reward eligibility weight";
  if (name.includes("Project Access")) return "Adds project-specific reward eligibility weight";
  if (name.includes("Mission Runner")) return "Improves basic Mission consistency";
  if (name.includes("Wallet")) return "Unlocks user-approved Wallet Missions";
  if (name.includes("Permit")) return "Grants limited Mission access";
  return "Mission modifier";
}

function categoryForAsset(name: string): ItemCategory | undefined {
  if (["Alpha Radar", "Alpha Scout", "Market Scout"].some((token) => name.includes(token))) return "task_discovery";
  if (["Mission Runner", "Task Reroll", "Energy Recovery"].some((token) => name.includes(token))) return "task_sorting";
  if (["Access", "Allowlist", "Ticket", "Quest Pass", "Slot", "Project Access"].some((token) => name.includes(token))) return "verification_reputation";
  if (["Crew Captain", "Crew Boost", "Group Rally"].some((token) => name.includes(token))) return "growth_propagation";
  if (["Wallet Operator", "Wallet Task Permit", "Permit"].some((token) => name.includes(token))) return "trading_prep";
  return undefined;
}

function normalizeRecentDrops(rows: Array<{ id: string; metadata_json: string | null; created_at: string; username: string | null }>): RecentDrop[] {
  const parsed = rows
    .map((row) => {
      const meta = parseJson<{ boxName?: string; rewardName?: string; rarity?: Rarity }>(row.metadata_json, {});
      return {
        id: row.id,
        boxName: meta.boxName || "Alpha Box",
        rewardName: meta.rewardName || "Alpha Radar",
        rarity: meta.rarity || "rare",
        username: row.username || "mission_runner",
        createdAt: row.created_at
      };
    })
    .filter((drop) => drop.rarity !== "common");

  if (parsed.length > 0) return parsed.slice(0, 6);
  return [
    { id: "drop_demo_1", boxName: "Project Box", rewardName: "Project Access Pass", rarity: "legendary", username: "project_hunter", createdAt: new Date(Date.now() - 180_000).toISOString() },
    { id: "drop_demo_2", boxName: "Crew Box", rewardName: "Crew Captain", rarity: "epic", username: "crew_captain", createdAt: new Date(Date.now() - 420_000).toISOString() },
    { id: "drop_demo_3", boxName: "Alpha Box", rewardName: "Alpha Radar", rarity: "rare", username: "alpha_scout", createdAt: new Date(Date.now() - 780_000).toISOString() }
  ];
}

function trendingItemsFromListings(listings: MarketplaceListing[], currency: string) {
  const byName = new Map<string, MarketplaceListing[]>();
  for (const listing of listings) {
    byName.set(listing.name, [...(byName.get(listing.name) || []), listing]);
  }
  const trending = Array.from(byName.entries()).map(([name, items]) => {
    const floor = Math.min(...items.map((item) => Number(item.price)));
    const shortestExpiry = Math.min(...items.map((item) => Math.max(1, Math.floor((new Date(item.expiresAt).getTime() - Date.now()) / 60_000))));
    return {
      name,
      rarity: items[0]?.rarity || "common",
      floorPrice: floor.toFixed(1),
      volume24h: (floor * items.length).toFixed(1),
      expiresInMinutes: shortestExpiry
    };
  }).sort((a, b) => Number(b.volume24h) - Number(a.volume24h));

  if (trending.length > 0) return trending.slice(0, 4);
  return [
    { name: "Alpha Box", rarity: "rare" as Rarity, floorPrice: "12.5", volume24h: "420.0", expiresInMinutes: 180 },
    { name: "Task Reroll", rarity: "epic" as Rarity, floorPrice: "45.0", volume24h: "315.0", expiresInMinutes: 90 }
  ].map((item) => ({ ...item, volume24h: `${item.volume24h}` || currency }));
}

function nextUtcReset(hour: number): string {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

function ensureDemoLeaderboardRows(rows: LeaderboardRow[]) {
  const demo = [
    { rank: 1, displayName: "mission_runner", score: 98200 },
    { rank: 2, displayName: "drop_hunter", score: 87610 },
    { rank: 3, displayName: "ton_sniper", score: 80940 }
  ];
  for (const item of demo) {
    if (!rows.some((row) => row.displayName === item.displayName)) rows.push(item);
  }
}

function rankTier(score: number): RankTier {
  if (score >= 50_000) return "top_1";
  if (score >= 20_000) return "top_5";
  if (score >= 5_000) return "top_10";
  if (score >= 200) return "top_20";
  if (score > 0) return "top_50";
  return "unranked";
}

function pointsToNextTier(score: number): number {
  if (score < 200) return 200 - score;
  if (score < 5_000) return 5_000 - score;
  if (score < 20_000) return 20_000 - score;
  if (score < 50_000) return 50_000 - score;
  return 0;
}

function floorPrice(listings: MarketplaceListing[]): string {
  if (listings.length === 0) return "0";
  return Math.min(...listings.map((listing) => Number(listing.price))).toFixed(1);
}

function decorateListings(listings: MarketplaceListing[]): MarketplaceListing[] {
  const floor = floorPrice(listings);
  const floorValue = Number(floor);
  const sorted = [...listings].sort((a, b) => Number(a.price) - Number(b.price));
  return sorted.map((listing, index) => ({
    ...listing,
    assetType: listing.name.toLowerCase().includes("box") ? "box" : "ability",
    expiresInMinutes: Math.max(1, Math.floor((new Date(listing.expiresAt).getTime() - Date.now()) / 60000)),
    marketSection: listing.name.toLowerCase().includes("box")
      ? "trending"
      : Number(listing.price) <= floorValue * 1.1
        ? "floor"
        : "rare",
    floorRank: index + 1
  }));
}

function buildBoxSupply(agentsToday: number, fomoListed: number, groupMembers: number): BoxSupply[] {
  return [
    { key: "starter", name: "Starter Box", remaining: Math.max(0, 2047 - agentsToday), total: 2047, rarity: "common", route: "Free claim", oddsLabel: "Starter asset pool" },
    { key: "fomo", name: "Alpha Box", remaining: Math.max(0, 333 - fomoListed), total: 333, rarity: "rare", route: "Marketplace / campaign", oddsLabel: "Scarce mission asset pool" },
    { key: "group", name: "Crew Box", remaining: Math.max(0, 88 - groupMembers), total: 88, rarity: "epic", route: "15 active Agents", oddsLabel: "Crew unlock pool" },
    { key: "project", name: "Project Box", remaining: 47, total: 47, rarity: "legendary", route: "Project campaign", oddsLabel: "Project access pool" }
  ];
}

function buildDropPools(): DropPoolSummary[] {
  return [
    {
      boxName: "Starter Box",
      role: "Free activation",
      supplyLabel: "One per user",
      oddsLabel: "Points / Energy / Starter Skill",
      topDrops: [
        { name: "Mission Runner", rarity: "common", effect: "Improves basic Mission consistency", transferable: false },
        { name: "Energy Recovery", rarity: "rare", effect: "Refills execution energy", transferable: false },
        { name: "Energy Pack", rarity: "common", effect: "Refills execution energy", transferable: false }
      ]
    },
    {
      boxName: "Alpha Box",
      role: "Alpha discovery",
      supplyLabel: "Daily limited supply",
      oddsLabel: "Rare mission assets",
      topDrops: [
        { name: "Alpha Scout", rarity: "rare", effect: "Profession identity for Alpha Missions", transferable: true },
        { name: "Alpha Radar", rarity: "rare", effect: "Unlocks Alpha Mission access", transferable: true },
        { name: "Wallet Task Permit", rarity: "epic", effect: "Unlocks user-approved Wallet Missions", transferable: true }
      ]
    },
    {
      boxName: "Crew Box",
      role: "Crew virality",
      supplyLabel: "Unlock-based",
      oddsLabel: "Crew utility and boosts",
      topDrops: [
        { name: "Crew Captain", rarity: "epic", effect: "Profession identity for Crew Missions", transferable: true },
        { name: "Crew Boost", rarity: "rare", effect: "Boosts Crew unlock progress", transferable: true },
        { name: "Energy Cache", rarity: "common", effect: "Refills group activity", transferable: false }
      ]
    },
    {
      boxName: "Project Box",
      role: "Campaign access",
      supplyLabel: "Project-specific",
      oddsLabel: "Eligibility heavy",
      topDrops: [
        { name: "Project Hunter", rarity: "epic", effect: "Profession identity for partner Missions", transferable: true },
        { name: "Project Access Pass", rarity: "legendary", effect: "Project-specific eligibility weight", transferable: true },
        { name: "Partner Quest Pass", rarity: "rare", effect: "Partner Mission access", transferable: true }
      ]
    }
  ];
}

function buildMarketSections(listings: MarketplaceListing[]): MarketSection[] {
  const trending = listings.filter((item) => item.marketSection === "trending" || item.assetType === "box").map((item) => item.id);
  const rare = listings.filter((item) => item.marketSection === "rare").map((item) => item.id);
  const expiring = [...listings].sort((a, b) => (a.expiresInMinutes ?? 9999) - (b.expiresInMinutes ?? 9999)).slice(0, 3).map((item) => item.id);
  const floor = [...listings].sort((a, b) => Number(a.price) - Number(b.price)).slice(0, 3).map((item) => item.id);
  return [
    { key: "trending", title: "Trending now", listingIds: trending },
    { key: "rare", title: "Rare floor", listingIds: rare },
    { key: "expiring", title: "Expiring soon", listingIds: expiring },
    { key: "floor", title: "Lowest floor", listingIds: floor }
  ];
}

async function listAdminBoxes(db: D1Database) {
  const rows = await db.prepare("SELECT * FROM box_definitions ORDER BY CASE key WHEN 'starter' THEN 1 WHEN 'alpha' THEN 2 WHEN 'crew' THEN 3 WHEN 'project' THEN 4 WHEN 'wallet' THEN 5 ELSE 9 END").all<AdminBoxRow>();
  return rows.results.map(toAdminBox);
}

async function getAdminBoxRow(db: D1Database, boxId: string): Promise<AdminBoxRow | null> {
  return db.prepare("SELECT * FROM box_definitions WHERE id = ?").bind(boxId).first<AdminBoxRow>();
}

function toAdminBox(row: AdminBoxRow) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    status: row.status,
    rarity: row.rarity,
    totalSupply: Number(row.total_supply),
    remainingSupply: Number(row.remaining_supply),
    dailyRelease: Number(row.daily_release),
    acquisitionRoute: row.acquisition_route,
    startTime: row.starts_at,
    endTime: row.ends_at,
    transferableBeforeOpen: row.transferable_before_open === 1,
    bindingStrategy: row.binding_strategy,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function listDropPool(db: D1Database, boxId: string) {
  const rows = await db.prepare("SELECT * FROM box_drop_pool_items WHERE box_id = ? AND status != 'archived' ORDER BY weight DESC, created_at ASC").bind(boxId).all<DropPoolRow>();
  return rows.results.map((row) => ({
    id: row.id,
    assetName: row.asset_name,
    category: row.category,
    rarity: row.rarity,
    weight: Number(row.weight),
    minQuantity: Number(row.min_quantity),
    maxQuantity: Number(row.max_quantity),
    usesRemaining: row.uses_remaining ?? undefined,
    expiryHours: row.expiry_hours ?? undefined,
    transferable: row.transferable === 1,
    soulbound: row.soulbound === 1,
    effect: row.effect,
    requiresWallet: row.requires_wallet === 1,
    projectId: row.project_id,
    metadataJson: row.metadata_json ?? undefined
  }));
}

async function listAssets(db: D1Database) {
  const rows = await db.prepare("SELECT * FROM asset_definitions ORDER BY status, category, rarity, name").all<AdminAssetRow>();
  return rows.results.map(toAssetDefinition);
}

function toAssetDefinition(row: AdminAssetRow) {
  return {
    id: row.id,
    name: row.name,
    key: row.key,
    category: row.category,
    rarity: row.rarity,
    status: row.status,
    transferable: row.transferable === 1,
    defaultExpiryHours: row.default_expiry_hours,
    defaultUses: row.default_uses,
    effect: row.effect,
    applicableTasks: parseJson<string[]>(row.applicable_tasks_json, []),
    applicableBoxes: parseJson<string[]>(row.applicable_boxes_json, []),
    requiresWallet: row.requires_wallet === 1
  };
}

async function getMarketRules(db: D1Database) {
  const row = await db.prepare("SELECT * FROM market_rules WHERE id = 'default'").first<MarketRulesRow>();
  const fallback: MarketRulesRow = {
    platform_fee_percent: 2.5,
    min_price: "0.1",
    max_price: "1000.0",
    listing_expiry_days: 7,
    allow_starter_box_trade: 0,
    allow_project_box_trade: 1,
    market_paused: 0,
    cancel_rules: "挂单可由发布者取消；取消后资产退回背包，已成交订单不可撤销。"
  };
  const value = row || fallback;
  return {
    platformFeePercent: Number(value.platform_fee_percent),
    minPrice: value.min_price,
    maxPrice: value.max_price,
    listingExpiryDays: Number(value.listing_expiry_days),
    allowStarterBoxTrade: value.allow_starter_box_trade === 1,
    allowProjectBoxTrade: value.allow_project_box_trade === 1,
    marketPaused: value.market_paused === 1,
    cancelRules: value.cancel_rules
  };
}

function validBoxKey(value: unknown): value is "starter" | "alpha" | "crew" | "project" | "wallet" {
  return ["starter", "alpha", "crew", "project", "wallet"].includes(String(value));
}

function validBoxStatus(value: unknown): value is "active" | "paused" | "draft" | "archived" {
  return ["active", "paused", "draft", "archived"].includes(String(value));
}

function validRarity(value: unknown): value is Rarity {
  return ["common", "rare", "epic", "legendary", "genesis"].includes(String(value));
}

function validCategory(value: unknown): value is ItemCategory {
  return ["profession", "skill", "permit", "access", "boost"].includes(String(value));
}

function parseAdminBoxInput(body: any, fallbackId: string): ParsedResult<{
  id: string;
  key: "starter" | "alpha" | "crew" | "project" | "wallet";
  name: string;
  status: "active" | "paused" | "draft" | "archived";
  rarity: Rarity;
  totalSupply: number;
  remainingSupply: number;
  dailyRelease: number;
  acquisitionRoute: string;
  startTime: string | null;
  endTime: string | null;
  transferableBeforeOpen: boolean;
  bindingStrategy: string;
}> {
  const totalSupply = Number(body.totalSupply ?? body.total_supply ?? 0);
  const remainingSupply = Number(body.remainingSupply ?? body.remaining_supply ?? totalSupply);
  const dailyRelease = Number(body.dailyRelease ?? body.daily_release ?? 0);
  if (!validBoxKey(body.key)) return { error: { error: "invalid_box_key", message: "Invalid box key." } };
  if (!validBoxStatus(body.status)) return { error: { error: "invalid_box_status", message: "Invalid box status." } };
  if (!validRarity(body.rarity)) return { error: { error: "invalid_rarity", message: "Invalid rarity." } };
  if (!Number.isFinite(totalSupply) || totalSupply < 0 || !Number.isFinite(remainingSupply) || remainingSupply < 0 || remainingSupply > totalSupply) {
    return { error: { error: "invalid_supply", message: "Invalid box supply." } };
  }
  if (!Number.isFinite(dailyRelease) || dailyRelease < 0) return { error: { error: "invalid_daily_release", message: "Invalid daily release." } };
  const bindingStrategy = ["soulbound", "transferable", "bind_on_use"].includes(String(body.bindingStrategy)) ? String(body.bindingStrategy) : "soulbound";
  return {
    value: {
      id: String(body.id || fallbackId),
      key: body.key,
      name: String(body.name || "未命名盲盒").slice(0, 80),
      status: body.status,
      rarity: body.rarity,
      totalSupply: Math.floor(totalSupply),
      remainingSupply: Math.floor(remainingSupply),
      dailyRelease: Math.floor(dailyRelease),
      acquisitionRoute: String(body.acquisitionRoute || "").slice(0, 160),
      startTime: body.startTime ? String(body.startTime) : null,
      endTime: body.endTime ? String(body.endTime) : null,
      transferableBeforeOpen: body.transferableBeforeOpen === true,
      bindingStrategy
    }
  };
}

function parseDropPoolInput(body: any, boxId: string): ParsedResult<{
  id: string;
  boxId: string;
  assetName: string;
  category: ItemCategory;
  rarity: Rarity;
  weight: number;
  minQuantity: number;
  maxQuantity: number;
  usesRemaining?: number;
  expiryHours?: number;
  transferable: boolean;
  soulbound: boolean;
  effect: string;
  requiresWallet: boolean;
  projectId: string | null;
  metadataJson: string | null;
}> {
  const weight = Number(body.weight);
  const minQuantity = Number(body.minQuantity ?? 1);
  const maxQuantity = Number(body.maxQuantity ?? minQuantity);
  if (!validCategory(body.category)) return { error: { error: "invalid_category", message: "Invalid asset category." } };
  if (!validRarity(body.rarity)) return { error: { error: "invalid_rarity", message: "Invalid rarity." } };
  if (!Number.isFinite(weight) || weight <= 0) return { error: { error: "invalid_weight", message: "Drop weight must be positive." } };
  if (!Number.isFinite(minQuantity) || !Number.isFinite(maxQuantity) || minQuantity < 1 || maxQuantity < minQuantity) {
    return { error: { error: "invalid_quantity", message: "Invalid quantity range." } };
  }
  return {
    value: {
      id: String(body.id || id("dp")),
      boxId,
      assetName: String(body.assetName || "未命名资产").slice(0, 80),
      category: body.category,
      rarity: body.rarity,
      weight,
      minQuantity: Math.floor(minQuantity),
      maxQuantity: Math.floor(maxQuantity),
      usesRemaining: body.usesRemaining === undefined || body.usesRemaining === "" ? undefined : Math.max(0, Math.floor(Number(body.usesRemaining))),
      expiryHours: body.expiryHours === undefined || body.expiryHours === "" ? undefined : Math.max(0, Math.floor(Number(body.expiryHours))),
      transferable: body.transferable === true,
      soulbound: body.soulbound === true,
      effect: String(body.effect || "").slice(0, 240),
      requiresWallet: body.requiresWallet === true,
      projectId: body.projectId ? String(body.projectId) : null,
      metadataJson: body.metadataJson ? String(body.metadataJson) : null
    }
  };
}

function parseAssetInput(body: any, fallbackId: string): ParsedResult<{
  id: string;
  key: string;
  name: string;
  category: ItemCategory;
  rarity: Rarity;
  status: string;
  transferable: boolean;
  defaultExpiryHours: number | null;
  defaultUses: number | null;
  effect: string;
  applicableTasks: string[];
  applicableBoxes: string[];
  requiresWallet: boolean;
}> {
  if (!validCategory(body.category)) return { error: { error: "invalid_category", message: "Invalid asset category." } };
  if (!validRarity(body.rarity)) return { error: { error: "invalid_rarity", message: "Invalid rarity." } };
  const status = ["enabled", "disabled"].includes(String(body.status)) ? String(body.status) : "enabled";
  const applicableTasks = Array.isArray(body.applicableTasks) ? body.applicableTasks.map(String) : [];
  const applicableBoxes = Array.isArray(body.applicableBoxes) ? body.applicableBoxes.map(String) : [];
  return {
    value: {
      id: String(body.id || fallbackId),
      key: String(body.key || "").replace(/[^a-z0-9_:-]/gi, "_").slice(0, 80),
      name: String(body.name || "未命名资产").slice(0, 80),
      category: body.category,
      rarity: body.rarity,
      status,
      transferable: body.transferable === true,
      defaultExpiryHours: body.defaultExpiryHours === null || body.defaultExpiryHours === "" || body.defaultExpiryHours === undefined ? null : Math.max(0, Math.floor(Number(body.defaultExpiryHours))),
      defaultUses: body.defaultUses === null || body.defaultUses === "" || body.defaultUses === undefined ? null : Math.max(0, Math.floor(Number(body.defaultUses))),
      effect: String(body.effect || "").slice(0, 240),
      applicableTasks,
      applicableBoxes,
      requiresWallet: body.requiresWallet === true
    }
  };
}

function parseMarketRulesInput(body: any): ParsedResult<{
  platformFeePercent: number;
  minPrice: string;
  maxPrice: string;
  listingExpiryDays: number;
  allowStarterBoxTrade: boolean;
  allowProjectBoxTrade: boolean;
  marketPaused: boolean;
  cancelRules: string;
}> {
  const fee = Number(body.platformFeePercent);
  const min = Number(body.minPrice);
  const max = Number(body.maxPrice);
  const expiryDays = Number(body.listingExpiryDays);
  if (!Number.isFinite(fee) || fee < 0 || fee > 50) return { error: { error: "invalid_fee", message: "Invalid platform fee." } };
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max <= min) return { error: { error: "invalid_price_range", message: "Invalid price range." } };
  if (!Number.isFinite(expiryDays) || expiryDays < 1 || expiryDays > 90) return { error: { error: "invalid_expiry", message: "Invalid listing expiry." } };
  return {
    value: {
      platformFeePercent: fee,
      minPrice: String(body.minPrice),
      maxPrice: String(body.maxPrice),
      listingExpiryDays: Math.floor(expiryDays),
      allowStarterBoxTrade: body.allowStarterBoxTrade === true,
      allowProjectBoxTrade: body.allowProjectBoxTrade === true,
      marketPaused: body.marketPaused === true,
      cancelRules: String(body.cancelRules || "").slice(0, 500)
    }
  };
}

async function auditAdminConfig(db: D1Database, action: string, targetType: string, targetId: string, metadata: unknown): Promise<void> {
  await db.prepare("INSERT INTO admin_config_audit_logs (id, action, target_type, target_id, metadata_json) VALUES (?, ?, ?, ?, ?)")
    .bind(id("audit"), action, targetType, targetId, JSON.stringify(metadata || {}))
    .run()
    .catch(() => undefined);
}

function toAdminAuditLog(row: AdminAuditRow) {
  const metadata = parseJson<Record<string, unknown>>(row.metadata_json, {});
  const opType = adminAuditTitle(row.action, row.target_type, metadata);
  const summary = adminAuditSummary(row.action, row.target_type, metadata);
  return {
    id: row.id,
    operator: String(metadata.operator || "系统管理员"),
    opType,
    targetObject: adminAuditTarget(row.target_type, row.target_id, metadata),
    beforeValue: adminAuditBefore(row.action, row.target_type, metadata),
    afterValue: summary,
    timestamp: row.created_at,
    status: metadata.status === "failed" ? "failed" : "success"
  };
}

function adminAuditTitle(action: string, targetType: string, metadata: Record<string, unknown>): string {
  if (targetType === "box") {
    if (action === "create") return "创建盲盒";
    if (action === "archive") return "归档盲盒";
    if (action === "status") return metadata.afterStatus === "paused" || metadata.status === "paused" ? "暂停盲盒" : "更新盲盒状态";
    return "更新盲盒";
  }
  if (targetType === "drop_pool") return "替换掉落池";
  if (targetType === "asset") return action === "create" ? "创建资产" : "修改资产";
  if (targetType === "market_rules") return "更新市场规则";
  if (targetType === "task") return action === "create" ? "创建任务" : metadata.afterStatus === "paused" ? "暂停任务" : "更新任务状态";
  if (targetType === "tasks") return metadata.paused === true ? "全局暂停任务" : "全局恢复任务";
  if (targetType === "boxes") return metadata.paused === true ? "全局暂停盲盒" : "全局恢复盲盒";
  if (targetType === "user" || action === "risk_status") return "修改用户风控";
  return String(metadata.opType || action || "运营操作");
}

function adminAuditTarget(targetType: string, targetId: string | null, metadata: Record<string, unknown>): string {
  const name = metadata.name || metadata.username || metadata.assetName || metadata.key;
  return name ? `${targetType}:${targetId || "default"} (${String(name)})` : `${targetType}:${targetId || "default"}`;
}

function adminAuditBefore(action: string, targetType: string, metadata: Record<string, unknown>): string {
  if (metadata.beforeValue) return String(metadata.beforeValue);
  if (metadata.beforeStatus) return `状态：${statusLabel(String(metadata.beforeStatus))}`;
  if (metadata.beforeRiskStatus) return `风控：${riskLabel(String(metadata.beforeRiskStatus))}`;
  if (action === "create") return "新建前无记录";
  if (targetType === "drop_pool") return "原掉落池已被整体替换";
  return "";
}

function adminAuditSummary(action: string, targetType: string, metadata: Record<string, unknown>): string {
  if (metadata.afterValue) return String(metadata.afterValue);
  if (metadata.afterStatus || metadata.status) return `状态：${statusLabel(String(metadata.afterStatus || metadata.status))}`;
  if (metadata.afterRiskStatus) return `风控：${riskLabel(String(metadata.afterRiskStatus))}`;
  if (targetType === "drop_pool") return `已保存 ${Number(metadata.count || 0)} 个掉落项`;
  if (targetType === "market_rules") {
    return `手续费 ${metadata.platformFeePercent ?? "-"}%，价格区间 ${metadata.minPrice ?? "-"}-${metadata.maxPrice ?? "-"} POINT_TEST，市场${metadata.marketPaused ? "已挂起" : "可交易"}`;
  }
  if (targetType === "task") {
    return `任务：${String(metadata.name || "-")}，能量 ${metadata.energyCost ?? "-"}，积分 ${metadata.basePendingPoints ?? "-"}`;
  }
  if (targetType === "box") {
    return `盲盒：${String(metadata.name || metadata.key || "-")}，状态 ${statusLabel(String(metadata.status || metadata.afterStatus || "-"))}，库存 ${metadata.remainingSupply ?? "-"} / ${metadata.totalSupply ?? "-"}`;
  }
  if (targetType === "asset") {
    return `资产：${String(metadata.name || metadata.key || "-")}，分类 ${categoryLabel(String(metadata.category || "-"))}，稀有度 ${rarityLabel(String(metadata.rarity || "-"))}`;
  }
  if (targetType === "tasks" || targetType === "boxes") return metadata.paused === true ? "已执行全局暂停" : "已恢复正常运行";
  return rowLikeSummary(metadata);
}

function rowLikeSummary(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata).filter(([key]) => !["operator", "status"].includes(key));
  if (entries.length === 0) return "已写入审计记录";
  return entries.slice(0, 6).map(([key, value]) => `${key}: ${String(value)}`).join("，");
}

function statusLabel(value: string): string {
  return ({ active: "运行中", paused: "已暂停", draft: "草稿", archived: "已归档", enabled: "已启用", disabled: "已停用" } as Record<string, string>)[value] || value;
}

function riskLabel(value: string): string {
  return ({ normal: "正常", restricted: "限制用户", review: "标记复核" } as Record<string, string>)[value] || value;
}

function rarityLabel(value: string): string {
  return ({ common: "普通", rare: "稀有", epic: "史诗", legendary: "传说", genesis: "创世" } as Record<string, string>)[value] || value;
}

function categoryLabel(value: string): string {
  return ({ profession: "职业", skill: "技能", permit: "许可证", access: "准入权", boost: "加成" } as Record<string, string>)[value] || value;
}

async function createAdminSession(env: Bindings, session: AdminSession): Promise<string> {
  const secret = env.ADMIN_JWT_SECRET || env.ADMIN_TOKEN || "growthbot-admin-session";
  const payload = encodeBase64Url(JSON.stringify(session));
  const signature = await hmacSha256Base64Url(secret, payload);
  return `${payload}.${signature}`;
}

async function verifyAdminSession(env: Bindings, token: string): Promise<boolean> {
  const secret = env.ADMIN_JWT_SECRET || env.ADMIN_TOKEN || "growthbot-admin-session";
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (!constantTimeEqual(await hmacSha256Base64Url(secret, payload), signature)) return false;
  try {
    const session = JSON.parse(decodeBase64Url(payload)) as AdminSession;
    return typeof session.expiresAt === "number" && session.expiresAt > Date.now();
  } catch {
    return false;
  }
}

async function hmacSha256Base64Url(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return arrayBufferToBase64Url(signature);
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

function encodeBase64Url(value: string): string {
  return btoa(unescape(encodeURIComponent(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  return decodeURIComponent(escape(atob(padded)));
}

async function isMarketPaused(env: Bindings): Promise<boolean> {
  if (await env.KV.get("global:market_paused") === "true") return true;
  await ensureAdminConfigData(env.DB).catch(() => undefined);
  const rules = await getMarketRules(env.DB).catch(() => null);
  return rules?.marketPaused === true;
}

async function buildFomoSnapshot(db: D1Database): Promise<FomoSnapshot> {
  const [agentsToday, fomoListed, groupPools, listingsRows, volume, recentDrops, personalShares, boxShares, groupShares] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM agents WHERE created_at >= datetime('now', '-1 day')").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM inventory_items WHERE item_type = 'box' AND name = 'Alpha Box' AND status IN ('available', 'listed')").first<{ count: number }>(),
    db.prepare("SELECT COALESCE(SUM(member_count), 0) AS members FROM group_pools").first<{ members: number }>(),
    db.prepare(
      `SELECT marketplace_listings.*, inventory_items.name, inventory_items.rarity, inventory_items.metadata_json AS metadata_json, users.username
       FROM marketplace_listings
       JOIN inventory_items ON inventory_items.id = marketplace_listings.inventory_item_id
       JOIN users ON users.id = marketplace_listings.seller_user_id
       WHERE marketplace_listings.status = 'active'
       ORDER BY CAST(marketplace_listings.price AS REAL) ASC
       LIMIT 50`
    ).all<DbListing>(),
    db.prepare("SELECT COALESCE(SUM(CAST(price AS REAL)), 0) AS total FROM marketplace_trades WHERE created_at >= datetime('now', '-1 day')").first<{ total: number }>(),
    db.prepare(
      `SELECT point_ledger_events.id, point_ledger_events.metadata_json, point_ledger_events.created_at, users.username
       FROM point_ledger_events
       JOIN users ON users.id = point_ledger_events.user_id
       WHERE point_ledger_events.event_type = 'box_open'
       ORDER BY point_ledger_events.created_at DESC
       LIMIT 12`
    ).all<{ id: string; metadata_json: string | null; created_at: string; username: string | null }>(),
    countWhere(db, "analytics_events", "event_name = 'share_personal_report' AND created_at >= datetime('now', '-1 day')"),
    countWhere(db, "analytics_events", "event_name = 'share_box_report' AND created_at >= datetime('now', '-1 day')"),
    countWhere(db, "analytics_events", "event_name = 'share_group_invite' AND created_at >= datetime('now', '-1 day')")
  ]);

  const listings = decorateListings(listingsRows.results.map(toMarketplaceListing));
  const market: MarketStats = {
    floorPrice: floorPrice(listings),
    volume24h: Number(volume?.total ?? 0).toFixed(1),
    currency: "POINT_TEST",
    floorMove24h: listings.length > 1 ? "+18%" : "+0%",
    activeListings: listings.length
  };
  const boxSupply = buildBoxSupply(Number(agentsToday?.count ?? 0), Number(fomoListed?.count ?? 0), Number(groupPools?.members ?? 0));

  return {
    launchWindowEndsAt: nextUtcReset(8),
    boxesRemaining: {
      starter: boxSupply.find((box) => box.key === "starter")?.remaining ?? 0,
      fomo: boxSupply.find((box) => box.key === "fomo")?.remaining ?? 0,
      group: boxSupply.find((box) => box.key === "group")?.remaining ?? 0,
      project: boxSupply.find((box) => box.key === "project")?.remaining ?? 0
    },
    activeAgentsToday: Math.max(24, Number(agentsToday?.count ?? 0) + 137),
    nextGroupUnlockAgents: 15,
    groupAgentsActive: Math.min(15, Math.max(8, Number(groupPools?.members ?? 0))),
    market,
    recentDrops: normalizeRecentDrops(recentDrops.results),
    trendingItems: trendingItemsFromListings(listings, market.currency),
    boxSupply,
    dropPools: buildDropPools(),
    shareStats: {
      personalReports: personalShares,
      boxReports: boxShares,
      groupInvites: groupShares,
      shareRateLabel: `${Math.max(18, personalShares + boxShares + groupShares + 21)}% first-day share intent`
    },
    marketSections: buildMarketSections(listings)
  };
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

async function requireAdmin(c: AppContext) {
  if (!c.env.ADMIN_TOKEN && c.env.APP_ENV !== "production") return null;
  const token = c.req.header("x-admin-token") || c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (token && await verifyAdminSession(c.env, token)) return null;
  return c.json({ error: "admin_unauthorized" }, 401);
}

async function isControlPaused(kv: KVNamespace, control: "boxes" | "tasks"): Promise<boolean> {
  return await kv.get(`global:${control}_paused`) === "true";
}

async function count(db: D1Database, table: string): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

async function countWhere(db: D1Database, table: string, where: string): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

async function trackAnalyticsEvent(
  db: D1Database,
  userId: string | null,
  eventName: string,
  source: string | null,
  properties: Record<string, unknown> = {},
  sessionId: string | null = null
): Promise<void> {
  await db.prepare(
    "INSERT INTO analytics_events (id, user_id, event_name, session_id, source, properties_json) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(
    id("event"),
    userId,
    eventName,
    sessionId,
    source,
    JSON.stringify(properties)
  ).run();
}

function createDevToken(userId: string): string {
  return `dev.${btoa(userId).replace(/=+$/g, "")}`;
}

function safeLinkHost(link: string): string | null {
  try {
    return new URL(link).hostname.toLowerCase();
  } catch {
    return link.startsWith("@") ? "telegram_handle" : null;
  }
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

// Symmetric Encryption helpers using Web Crypto API (AES-GCM)
async function encryptData(text: string, secretKeyStr: string = "growthbot-secret"): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const keyHash = await crypto.subtle.digest("SHA-256", encoder.encode(secretKeyStr));
    const key = await crypto.subtle.importKey("raw", keyHash, { name: "AES-GCM" }, false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);
    let binary = "";
    for (let i = 0; i < result.byteLength; i++) {
      binary += String.fromCharCode(result[i]!);
    }
    return btoa(binary);
  } catch (e) {
    throw new Error("skill_metadata_encryption_failed");
  }
}

async function decryptData(cipherText: string, secretKeyStr: string = "growthbot-secret"): Promise<string> {
  if (!cipherText) return "";
  if (!cipherText.endsWith("=") && cipherText.length % 4 !== 0) {
    if (cipherText.startsWith("enc:")) return cipherText.slice(4);
    return cipherText;
  }
  try {
    const binaryStr = atob(cipherText);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    if (bytes.length < 12) return cipherText;
    const iv = bytes.slice(0, 12);
    const encrypted = bytes.slice(12);
    const encoder = new TextEncoder();
    const keyHash = await crypto.subtle.digest("SHA-256", encoder.encode(secretKeyStr));
    const key = await crypto.subtle.importKey("raw", keyHash, { name: "AES-GCM" }, false, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    if (cipherText.startsWith("enc:")) return cipherText.slice(4);
    return cipherText;
  }
}

async function getNextCardNumber(db: D1Database, kv: KVNamespace | null): Promise<string> {
  try {
    await db.prepare("INSERT OR IGNORE INTO skill_card_sequences (card_type, current_val) VALUES ('skill_card', 0)").run();
    await db.prepare("UPDATE skill_card_sequences SET current_val = current_val + 1 WHERE card_type = 'skill_card'").run();
    const row = await db.prepare("SELECT current_val FROM skill_card_sequences WHERE card_type = 'skill_card'").first<{ current_val: number }>();
    if (row && row.current_val > 0) {
      return `skill_card_${String(row.current_val).padStart(6, '0')}`;
    }
  } catch (e) {}
  if (kv) {
    try {
      const current = await kv.get("sequence:skill_card");
      const nextVal = (parseInt(current || "0", 10) + 1);
      await kv.put("sequence:skill_card", String(nextVal));
      return `skill_card_${String(nextVal).padStart(6, '0')}`;
    } catch (e) {}
  }
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `skill_card_${ts}_${rand}`;
}

// ==================== AGENT BOT STUDIO HELPER FUNCTIONS ====================

function isValidBaseUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase();

    // Block loopback
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1") return false;

    // Block raw private IPv4
    const ipPattern = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
    const match = hostname.match(ipPattern);
    if (match) {
      const octets = match.slice(1, 5).map(Number);
      if (octets[0] === 10) return false;
      if (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31) return false;
      if (octets[0] === 192 && octets[1] === 168) return false;
      if (octets[0] === 127) return false;
      if (octets[0] === 169 && octets[1] === 254) return false;
      if (octets[0] === 0) return false;
    }

    // Block raw IPv6 to prevent SSRF bypass
    if (hostname.includes(":") || hostname.startsWith("[")) {
      return false;
    }

    // Block metadata service IP
    if (hostname === "169.254.169.254") return false;

    return true;
  } catch {
    return false;
  }
}

async function callLlmProxy(
  db: D1Database,
  userId: string,
  config: any,
  purpose: string,
  systemPrompt: string,
  userPrompt: string,
  secretKey?: string
): Promise<any> {
  const logId = id("log");
  let apiKey: string | null = null;
  if (config.encrypted_api_key && secretKey) {
    try {
      apiKey = await decryptData(config.encrypted_api_key, secretKey);
    } catch (e) {
      console.error("Failed to decrypt API key", e);
    }
  }

  const inputSummary = `Purpose: ${purpose}, Model: ${config.model_id}, Provider: ${config.provider}`;
  let outputSummary = "";
  let status = "success";
  let errorMessage: string | null = null;
  let responseObj: any = null;

  try {
    if (!config.base_url.startsWith("https://")) {
      throw new Error("Only https protocol is allowed.");
    }

    // Check dynamic provider allowlist
    const allowlist = await db.prepare("SELECT * FROM agent_provider_allowlist WHERE status = 'active'").all<any>();
    const inputUrl = new URL(config.base_url);
    const isAllowed = allowlist.results.some(item => {
      try {
        return new URL(item.base_url).origin === inputUrl.origin;
      } catch {
        return false;
      }
    });
    if (!isAllowed) {
      throw new Error("Base URL not in allowlist.");
    }

    let targetUrl = config.base_url;
    if (!targetUrl.endsWith("/chat/completions") && !targetUrl.endsWith("/chat/completions/")) {
      targetUrl = targetUrl.replace(/\/+$/, "") + "/chat/completions";
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model_id,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(5000)
    });

    if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
      throw new Error("Redirects are forbidden to prevent SSRF.");
    }

    if (!res.ok) {
      throw new Error(`LLM API returned status ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error("No response body.");
    }

    let receivedLength = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedLength += value.length;
      if (receivedLength > 32 * 1024) {
        throw new Error("Response body exceeded maximum size limit of 32KB.");
      }
    }

    const responseBodyText = new TextDecoder().decode(
      new Uint8Array(chunks.reduce((acc, chunk) => acc.concat(Array.from(chunk)), [] as number[]))
    );

    const parsedJson = JSON.parse(responseBodyText);
    const content = parsedJson.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in response choices.");
    }

    responseObj = JSON.parse(content.replace(/```json/g, "").replace(/```/g, "").trim());
    outputSummary = `Tokens: ${parsedJson.usage?.total_tokens || 0}, Status: success`;
  } catch (err: any) {
    status = "failed";
    errorMessage = err.message || String(err);
    outputSummary = `Error: ${errorMessage}`;
  }

  await db.prepare(
    "INSERT INTO agent_model_call_logs (id, user_id, config_id, purpose, input_summary, output_summary, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(logId, userId, config.id, purpose, inputSummary, outputSummary.slice(0, 500), status, errorMessage?.slice(0, 500) || null).run();

  if (status === "failed" || !responseObj) {
    return null;
  }
  return responseObj;
}

function getFallbackAiGuide(taskName: string, category: string): AiGuideResponse {
  return {
    summary: `智能解析了任务 "${taskName}"。这是一个 ${category} 类型的任务。`,
    steps: [
      "点击直达链接进入外部任务页面。",
      "按照任务说明完成对应动作（关注、转发、加群或完成表单等）。",
      "完成最后一步后，复制外部页面的分享或个人主页链接。",
      "回到本页面，提交正确的链接格式以通过平台验收。"
    ],
    submissionHint: "请提交合法的 https 链接，例如您的个人主页或特定推文链接。",
    riskLevel: "low",
    riskNotes: [
      "请不要在提交后立即取消关注，否则可能会被系统风控拦截。",
      "请勿提交无关链接或重复提交其他账号的链接。"
    ],
    recommended: true,
    reason: "该任务属于高性价比的入门任务，适合快速获取积分奖励。"
  };
}
