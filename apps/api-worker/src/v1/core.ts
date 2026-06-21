import { Context } from "hono";
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
  TaskRecommendationResponse,
  AgentProfession,
  AgentStatus,
  AssetDefinition,
  AssetType,
  BoxProduct,
  BoxProductType,
  BoxDropItem,
  BoxDropTableEntry,
  BoxOrder,
  BoxOrderStatus,
  WorkRun,
  WorkRunStatus,
  WorkStep,
  WorkStepType,
  WorkStepStatus,
  ActivityEvent,
  TaskPlan,
  AgentWallet,
  AgentWalletPolicy
} from "@growthbot/shared";

export type Bindings = {
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
  ENABLE_TEST_ENDPOINTS?: string;
  TEST_ENDPOINT_TOKEN?: string;
};

export type AppContext = Context<{ Bindings: Bindings }>;

export type DbUser = {
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

export type DbAgent = {
  id: string;
  user_id: string;
  name: string;
  level: number;
  energy: number;
  max_energy: number;
  auto_run_until: string | null;
  status: string;
  profession?: string | null;
  experience?: number | null;
  task_slots?: number | null;
  daily_run_limit?: number | null;
  daily_run_count?: number | null;
  daily_run_date?: string | null;
  research_score?: number | null;
  content_score?: number | null;
  social_score?: number | null;
  verification_score?: number | null;
  onchain_score?: number | null;
  risk_score?: number | null;
  active_work_run_id?: string | null;
};

export type DbInventoryItem = {
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
  asset_definition_id?: string | null;
  box_order_id?: string | null;
};

export type DbWorkRun = {
  id: string;
  agent_id: string;
  user_id: string;
  task_id: string;
  task_kind: string;
  status: string;
  current_step: number;
  total_steps: number;
  progress: number;
  estimated_reward: number;
  estimated_energy: number;
  actual_reward: number;
  actual_energy: number;
  risk_level: string;
  requires_user_action: number;
  settled: number;
  settled_at?: string | null;
  settlement_ledger_id?: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_reason: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
};

export type DbWorkStep = {
  id: string;
  run_id: string;
  step_order: number;
  step_type: string;
  title: string;
  description: string | null;
  status: string;
  input_summary: string | null;
  output_summary: string | null;
  tool_name: string | null;
  requires_approval: number;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type DbActivityEvent = {
  id: string;
  agent_id: string;
  run_id: string | null;
  event_type: string;
  title: string;
  message: string | null;
  metadata_json: string | null;
  visibility: string;
  created_at: string;
};

export type DbBoxProduct = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  image_url: string | null;
  box_type: string;
  rarity: Rarity;
  price_amount: number;
  price_currency: string;
  total_supply: number;
  remaining_supply: number;
  per_user_limit: number;
  sale_start_at: string | null;
  sale_end_at: string | null;
  transferable: number;
  status: string;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
};

export type DbBoxOrder = {
  id: string;
  user_id: string;
  box_product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  payment_provider: string;
  status: string;
  idempotency_key: string;
  fulfilled_inventory_item_id: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  fulfillment_attempts?: number;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
};

export type DbBoxDropItem = {
  id: string;
  box_product_id: string;
  asset_definition_id: string | null;
  asset_name: string;
  weight: number;
  guaranteed: number;
  min_quantity: number;
  max_quantity: number;
  rarity: Rarity;
  max_supply: number | null;
  issued_count: number;
  point_amount: number;
  energy_amount: number;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
};

export type DbAssetDefinition = {
  id: string;
  key: string;
  name: string;
  category: string;
  rarity: Rarity;
  status: string;
  transferable: number;
  default_expiry_hours: number | null;
  default_uses: number | null;
  effect: string;
  applicable_tasks_json: string;
  applicable_boxes_json: string;
  requires_wallet: number;
  implementation_status?: string;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
  code?: string | null;
  asset_type?: string | null;
  duration_seconds?: number | null;
  max_uses?: number | null;
  stackable?: number | null;
  soulbound?: number | null;
  transferable_v1?: number | null;
  required_level?: number | null;
  effect_type?: string | null;
  effect_value_json?: string | null;
  description_v1?: string | null;
};

export type DbAgentWallet = {
  id: string;
  agent_id: string;
  user_id: string;
  chain: string;
  network: string;
  address: string | null;
  label: string | null;
  wallet_type: string;
  permission_level: number;
  status: string;
  spending_limit_daily: number;
  spending_used_today: number;
  transaction_limit: number;
  allowed_actions_json: string;
  allowed_contracts_json: string;
  withdrawal_address: string | null;
  last_activity_at: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
};

export type TelegramAuthResult = {
  telegramId: string;
  username: string;
  firstName: string | null;
  languageCode: string;
};

export const DEFAULT_TELEGRAM_USER: TelegramAuthResult = {
  telegramId: "123456789",
  username: "alpha_user",
  firstName: "Alpha",
  languageCode: "en"
};

export function parseJson<T>(jsonStr: string | null | undefined, defaultValue: T): T {
  if (!jsonStr) return defaultValue;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return defaultValue;
  }
}

export function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export async function verifyTelegramInitData(initData: string, botToken: string): Promise<boolean> {
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

export async function getOrCreateUser(db: D1Database, auth: TelegramAuthResult, startParam: string | null): Promise<DbUser> {
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

export async function resolveTelegramAuth(c: AppContext, initData?: string): Promise<TelegramAuthResult> {
  if (c.env.APP_ENV !== "production" && !initData) return DEFAULT_TELEGRAM_USER;
  if (c.env.APP_ENV !== "production" && initData) {
    try {
      const parsed = new URLSearchParams(initData);
      const userRaw = parsed.get("user");
      if (userRaw) {
        const user = JSON.parse(userRaw) as { id: number; username?: string; first_name?: string; language_code?: string };
        return {
          telegramId: String(user.id),
          username: user.username || `tg_${user.id}`,
          firstName: user.first_name || null,
          languageCode: user.language_code || "en"
        };
      }
    } catch (_) {}
  }

  if (!initData || !c.env.TELEGRAM_BOT_TOKEN) {
    if (c.env.APP_ENV === "production") throw new Error("telegram_auth_required");
    return DEFAULT_TELEGRAM_USER;
  }

  const parsed = new URLSearchParams(initData);
  const hash = parsed.get("hash");
  const userRaw = parsed.get("user");
  if (!hash || !userRaw) throw new Error("invalid_telegram_init_data");

  if (c.env.APP_ENV !== "production") {
    const user = JSON.parse(userRaw) as { id: number; username?: string; first_name?: string; language_code?: string };
    return {
      telegramId: String(user.id),
      username: user.username || `tg_${user.id}`,
      firstName: user.first_name || null,
      languageCode: user.language_code || "en"
    };
  }

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

export async function requireUser(c: AppContext): Promise<DbUser> {
  const bodyInitData = c.req.header("x-telegram-init-data") || undefined;
  const auth = await resolveTelegramAuth(c, bodyInitData);
  return getOrCreateUser(c.env.DB, auth, null);
}

export async function requireAdmin(c: AppContext) {
  const token = c.req.header("x-admin-token");
  if (!token) return c.json({ error: "admin_auth_required", message: "Admin token required" }, 401);
  
  if (c.env.APP_ENV !== "production" && token === "admin_mock_token") {
    return null;
  }

  if (!c.env.ADMIN_JWT_SECRET) {
    if (token === c.env.ADMIN_TOKEN) {
      return null;
    }
    return c.json({ error: "admin_invalid_token", message: "Invalid admin token" }, 401);
  }

  // Basic JWT decoding helper
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error();
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && Date.now() > payload.exp * 1000) {
      return c.json({ error: "token_expired", message: "Token expired" }, 401);
    }
    return null;
  } catch {
    return c.json({ error: "admin_invalid_token", message: "Invalid admin token" }, 401);
  }
}

export async function getAgent(db: D1Database, userId: string): Promise<DbAgent | null> {
  return db.prepare("SELECT * FROM agents WHERE user_id = ? AND status IN ('active', 'idle')").bind(userId).first<DbAgent>();
}

export function rankTier(score: number): RankTier {
  if (score >= 5000) return "top_1";
  if (score >= 2000) return "top_5";
  if (score >= 1000) return "top_10";
  if (score >= 500) return "top_20";
  if (score >= 200) return "top_50";
  return "unranked";
}

export async function pointTotal(db: D1Database, userId: string, pointType: string): Promise<number> {
  const row = await db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM point_ledger_events WHERE user_id = ? AND point_type = ?").bind(userId, pointType).first<{ total: number }>();
  return Number(row?.total ?? 0);
}

export async function toAgentWithPoints(db: D1Database, row: DbAgent): Promise<Agent> {
  const pendingPoints = await pointTotal(db, row.user_id, "pending_points");
  const userScore = await pointTotal(db, row.user_id, "user_score");
  return { ...toAgentV1(row), pendingPoints, userScore, rankTier: rankTier(userScore) };
}

export async function toAgent(db: D1Database, row: DbAgent): Promise<Agent> {
  return toAgentWithPoints(db, row);
}

export function toAgentV1(row: DbAgent): Agent {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    energy: row.energy,
    maxEnergy: row.max_energy,
    pendingPoints: 0,
    userScore: 0,
    rankTier: "unranked",
    autoRunUntil: row.auto_run_until,
    profession: (row.profession as AgentProfession) || "scout",
    status: (row.status as AgentStatus) || "idle",
    experience: row.experience ?? 0,
    taskSlots: row.task_slots ?? 1,
    dailyRunLimit: row.daily_run_limit ?? 3,
    dailyRunCount: row.daily_run_count ?? 0,
    researchScore: row.research_score ?? 20,
    contentScore: row.content_score ?? 20,
    socialScore: row.social_score ?? 10,
    verificationScore: row.verification_score ?? 10,
    onchainScore: row.onchain_score ?? 0,
    riskScore: row.risk_score ?? 30,
    activeWorkRunId: row.active_work_run_id || null
  };
}

export function ledger(db: D1Database, userId: string, agentId: string | null, eventType: string, pointType: string, amount: number, projectId: string | null, sourceId: string, metadata: Record<string, unknown> = {}): D1PreparedStatement {
  return db.prepare(
    "INSERT INTO point_ledger_events (id, user_id, agent_id, event_type, point_type, amount, project_id, source_id, quality_multiplier, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)"
  ).bind(id("ledger"), userId, agentId, eventType, pointType, amount, projectId, sourceId, JSON.stringify(metadata));
}

export async function logActivity(db: D1Database, agentId: string, runId: string | null, eventType: string, title: string, message: string | null, metadata: Record<string, unknown> | null): Promise<void> {
  try {
    await db.prepare(
      "INSERT INTO agent_activity_events (id, agent_id, run_id, event_type, title, message, metadata_json, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, 'owner')"
    ).bind(id("actv"), agentId, runId, eventType, title, message, metadata ? JSON.stringify(metadata) : null).run();
  } catch (err) {
    console.error("logActivity failed:", err);
  }
}

export function toInventoryItem(row: DbInventoryItem): InventoryItem {
  const meta = parseJson<{
    usesRemaining?: number;
    effect?: string;
    sourceBox?: string;
    tradableAfterOpen?: boolean;
    originalTransferable?: boolean;
    learnStatus?: "unlearned" | "learned" | "equipped";
    cooldownUntil?: string | null;
  }>(row.metadata_json, {});

  return {
    id: row.id,
    type: row.item_type,
    name: row.name,
    rarity: row.rarity,
    status: row.status,
    transferable: row.transferable === 1,
    soulbound: row.soulbound === 1,
    expiresAt: row.expires_at,
    usesRemaining: meta.usesRemaining,
    effect: meta.effect,
    sourceBox: meta.sourceBox,
    learnStatus: meta.learnStatus,
    cooldownUntil: meta.cooldownUntil
  };
}

export function toBoxProduct(row: DbBoxProduct): BoxProduct {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    boxType: (row.box_type as BoxProductType) || "standard",
    rarity: row.rarity,
    priceAmount: row.price_amount,
    priceCurrency: row.price_currency,
    totalSupply: row.total_supply,
    remainingSupply: row.remaining_supply,
    perUserLimit: row.per_user_limit,
    saleStartAt: row.sale_start_at,
    saleEndAt: row.sale_end_at,
    transferable: row.transferable === 1,
    status: (row.status as BoxProduct["status"]) || "active",
    metadata: parseJson<Record<string, unknown> | null>(row.metadata_json, null)
  };
}

export function toBoxOrder(row: DbBoxOrder, product?: { name: string; code: string }): BoxOrder {
  return {
    id: row.id,
    userId: row.user_id,
    boxProductId: row.box_product_id,
    boxName: product?.name ?? row.box_product_id,
    boxCode: product?.code ?? "",
    quantity: row.quantity,
    unitPrice: row.unit_price,
    totalPrice: row.total_price,
    currency: row.currency,
    paymentProvider: row.payment_provider,
    status: (row.status as BoxOrderStatus) || "created",
    fulfilledInventoryItemId: row.fulfilled_inventory_item_id,
    failureCode: row.failure_code || null,
    failureMessage: row.failure_message || null,
    fulfillmentAttempts: row.fulfillment_attempts || 0,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    fulfilledAt: row.fulfilled_at
  };
}

export function toWorkRun(row: DbWorkRun): WorkRun {
  return {
    id: row.id,
    agentId: row.agent_id,
    userId: row.user_id,
    taskId: row.task_id,
    taskKind: (row.task_kind as "basic" | "bounty") || "basic",
    status: (row.status as WorkRunStatus) || "discovered",
    currentStep: row.current_step,
    totalSteps: row.total_steps,
    progress: row.progress,
    estimatedReward: row.estimated_reward,
    estimatedEnergy: row.estimated_energy,
    actualReward: row.actual_reward,
    actualEnergy: row.actual_energy,
    riskLevel: (row.risk_level as WorkRun["riskLevel"]) || "low",
    requiresUserAction: row.requires_user_action === 1,
    settled: row.settled === 1,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failedReason: row.failed_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toWorkStep(row: DbWorkStep): WorkStep {
  return {
    id: row.id,
    runId: row.run_id,
    stepOrder: row.step_order,
    stepType: (row.step_type as WorkStepType) || "analyze",
    title: row.title,
    description: row.description,
    status: (row.status as WorkStepStatus) || "pending",
    inputSummary: row.input_summary,
    outputSummary: row.output_summary,
    toolName: row.tool_name,
    requiresApproval: row.requires_approval === 1,
    approvedAt: row.approved_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toActivityEvent(row: DbActivityEvent): ActivityEvent {
  return {
    id: row.id,
    agentId: row.agent_id,
    runId: row.run_id,
    eventType: row.event_type,
    title: row.title,
    message: row.message,
    metadata: parseJson<Record<string, unknown> | null>(row.metadata_json, null),
    visibility: (row.visibility as "owner" | "public") || "owner",
    createdAt: row.created_at
  };
}

export function toAgentWallet(row: DbAgentWallet): AgentWallet {
  return {
    id: row.id,
    agentId: row.agent_id,
    userId: row.user_id,
    chain: row.chain,
    network: row.network,
    address: row.address,
    label: row.label,
    walletType: "observation",
    permissionLevel: row.permission_level,
    status: (row.status as AgentWallet["status"]) || "active",
    spendingLimitDaily: row.spending_limit_daily,
    spendingUsedToday: row.spending_used_today,
    transactionLimit: row.transaction_limit,
    allowedActions: parseJson<string[]>(row.allowed_actions_json, []),
    allowedContracts: parseJson<string[]>(row.allowed_contracts_json, []),
    withdrawalAddress: row.withdrawal_address,
    lastActivityAt: row.last_activity_at,
    metadata: parseJson<Record<string, unknown> | null>(row.metadata_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toAssetDefinition(row: DbAssetDefinition): AssetDefinition {
  return {
    id: row.id,
    code: row.key || row.code || "",
    description: row.effect_type || row.effect || null,
    assetType: (row.asset_type as AssetType) || "ability",
    name: row.name,
    category: (row.category as ItemCategory) || "skill",
    rarity: row.rarity,
    effectType: row.effect_type || null,
    effectValue: parseJson<Record<string, unknown> | null>(row.effect_value_json, null),
    durationSeconds: row.duration_seconds || null,
    maxUses: row.max_uses || null,
    stackable: row.stackable === 1,
    soulbound: row.soulbound === 1,
    transferable: row.transferable_v1 === 1,
    requiredLevel: row.required_level ?? 1,
    requiresWallet: row.requires_wallet === 1,
    status: row.status === "enabled" ? "enabled" : "disabled"
  };
}

export async function ensureUserBalanceSnapshot(db: D1Database, userId: string): Promise<number> {
  const row = await db.prepare("SELECT pending_points_balance FROM user_balance_snapshots WHERE user_id = ?").bind(userId).first<{ pending_points_balance: number }>();
  if (row) {
    return row.pending_points_balance;
  }
  // Calculate from ledger
  const sumRow = await db.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM point_ledger_events WHERE user_id = ? AND point_type = 'pending_points'"
  ).bind(userId).first<{ total: number }>();
  const balance = Number(sumRow?.total ?? 0);
  
  await db.prepare(
    `INSERT INTO user_balance_snapshots (user_id, pending_points_balance)
     VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       pending_points_balance = excluded.pending_points_balance,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(userId, balance).run();
  
  return balance;
}

export function requireTestMode(c: Context<{ Bindings: Bindings }>) {
  if (c.env.APP_ENV !== "test" || c.env.ENABLE_TEST_ENDPOINTS !== "true") {
    return c.json({ error: "forbidden", message: "Test endpoints are disabled in this environment" }, 403);
  }
  const token = c.req.header("x-test-endpoint-token");
  if (!token || !c.env.TEST_ENDPOINT_TOKEN || token !== c.env.TEST_ENDPOINT_TOKEN) {
    return c.json({ error: "forbidden", message: "Invalid or missing test endpoint token" }, 403);
  }
  return null;
}
