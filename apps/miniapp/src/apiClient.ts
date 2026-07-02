import type {
  Agent,
  FomoSnapshot,
  GroupPool,
  InventoryItem,
  LeaderboardRow,
  MarketplaceListing,
  MeResponse,
  Task,
  User,
  Rarity,
  AiGuideResponse,
  TaskRecommendationResponse,
  WorkReportResponse,
  AssetBalance,
  AssetAmount,
  AgentWallet,
  AgentWalletPolicy,
  AiCreditBalance,
  RealAssetAgentSummary,
  BubbleBoxOpenResult,
  BubbleMintStatus,
  BubblePassportMintRequest,
  BubblePassportMintResponse,
  BubblePassportStatusResponse
} from "@growthbot/shared";
import { CANONICAL_SKILL_CARDS, GBOT_BUBBLE_AGENT_OPS_CONFIG, type BubbleAgentOpsConfig } from "@growthbot/shared";

export type TelegramAuthorizedSource = {
  id: string;
  ownerUserId?: string;
  agentId: string;
  sourceType: "group" | "channel" | "user_submission" | "bot_mention" | "public_link";
  telegramChatTitlePreview: string | null;
  permissionScope: string[];
  status: "pending" | "authorized" | "revoked" | "disabled";
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};

export type TelegramOpportunitySignal = {
  id: string;
  agentId: string;
  sourceEventId: string | null;
  signalType: "bounty" | "announcement" | "risk_link" | "project_update" | "guild_task";
  title: string;
  summary: string;
  sourceUrl: string | null;
  confidenceLevel: "low" | "medium" | "high";
  estimatedAiCreditCost: number;
  requiredSkills: string[];
  riskFlags: string[];
  status: "candidate" | "ignored" | "pending_user" | "converted_to_work_run";
  createdAt: string;
  updatedAt: string;
};

const isLocalMiniappHost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const API_BASE = import.meta.env.VITE_API_BASE ?? (isLocalMiniappHost ? "http://127.0.0.1:8788" : "https://api.gb8.top");

export let fallbackOccurred = false;
export function clearFallbackOccurred() {
  fallbackOccurred = false;
}

// Mock data is opt-in and disabled in production builds unless explicitly enabled.
export function canUseMockMode(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCK_MODE === "true";
}

export function getMockMode(): boolean {
  if (typeof window === "undefined" || !canUseMockMode()) return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("mock") === "true" || localStorage.getItem("gb_force_mock") === "true";
}

export function setMockMode(active: boolean) {
  if (typeof window === "undefined") return;
  if (!canUseMockMode()) {
    localStorage.removeItem("gb_force_mock");
    return;
  }
  localStorage.setItem("gb_force_mock", active ? "true" : "false");
}

function bubblePassportStorageKey(displayNo: string) {
  return `gb_agent_mint_status_${displayNo}`;
}

function emitBubblePassportStatus(displayNo: string, mintStatus: BubbleMintStatus) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("gb_agent_mint_status_changed", {
    detail: { displayNo, mintStatus }
  }));
}

function writeMockBubblePassportStatus(displayNo: string, mintStatus: BubbleMintStatus) {
  if (typeof window === "undefined") return;
  localStorage.setItem(bubblePassportStorageKey(displayNo), mintStatus);
  emitBubblePassportStatus(displayNo, mintStatus);
}

// ----------------- LOCAL MOCK DATABASE STATE -----------------
interface MockDB {
  user: User;
  agent: Agent | null;
  inventory: InventoryItem[];
  tasks: Task[];
  listings: MarketplaceListing[];
  recentTrades: Array<{ id: string; name: string; price: string; buyer: string }>;
  fomo: FomoSnapshot;
  joinedPool: GroupPool | null;
}

const MOCK_DEFAULT_BUBBLE: InventoryItem = {
  id: "item_bubble_common_gray",
  type: "badge",
  name: "烟灰泥泡泡",
  rarity: "common",
  transferable: false,
  soulbound: true,
  expiresAt: null,
  status: "active",
  category: "access",
  series: "烟灰泥泡泡",
  bubbleEditionKey: "common-gray",
  displayNo: "GBOT-780552",
  naturalSkillCodes: [],
  equippedAsCurrentBubble: true,
  effect: "默认 Common 泥泡泡外观"
};

const DEFAULT_MOCK_AGENT: Agent = {
  id: "agent_123",
  name: "泥泡泡 #780552",
  status: "idle",
  level: 1,
  energy: 240,
  maxEnergy: 240,
  pendingPoints: 0,
  dailyRunLimit: 3,
  dailyRunCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
} as unknown as Agent;

const DEFAULT_MOCK_DB: MockDB = {
  user: {
    id: "user_mock",
    telegramId: "123456789",
    username: "alpha_user",
    languageCode: "en",
    rankTier: "top_20",
    riskStatus: "normal",
    hasAgent: true,
    studioEnabled: true,
    planTier: "pro",
    // Compatibility field kept so legacy mock data still matches the old API shape.
    pendingPoints: 1000
  },
  agent: DEFAULT_MOCK_AGENT,
  inventory: [MOCK_DEFAULT_BUBBLE],
  tasks: [
    {
      id: "task_daily_checkin",
      name: "Daily Check-in",
      energyCost: 10,
      // Compatibility field kept so legacy mock data still matches the old API shape.
      basePendingPoints: 100,
      projectId: null,
      requiresWallet: false,
      autoExecutable: true,
      endsAt: null,
      taskType: "task_planning"
    },
    {
      id: "task_group_pool",
      name: "Boost Crew Mission",
      energyCost: 15,
      // Compatibility field kept so legacy mock data still matches the old API shape.
      basePendingPoints: 160,
      projectId: null,
      requiresWallet: false,
      autoExecutable: true,
      endsAt: new Date(Date.now() + 43200000).toISOString(),
      taskType: "structured_content"
    },
    {
      id: "task_launch_sniper",
      name: "Genesis Alpha Radar",
      energyCost: 40,
      // Compatibility field kept so legacy mock data still matches the old API shape.
      basePendingPoints: 620,
      projectId: "project_genesis",
      projectName: "Genesis Pool",
      requiresWallet: false,
      autoExecutable: true,
      requiredAbility: "Alpha Radar",
      endsAt: new Date(Date.now() + 7200000).toISOString(),
      taskType: "project_research"
    },
    {
      id: "task_onchain_snipe",
      name: "Run Wallet Mission",
      energyCost: 50,
      // Compatibility field kept so legacy mock data still matches the old API shape.
      basePendingPoints: 950,
      projectId: "project_airdrop",
      projectName: "TON Activation Campaign",
      requiresWallet: true, // Requires wallet!
      autoExecutable: false,
      endsAt: null,
      taskType: "risk_review"
    }
  ],
  listings: [
    {
      id: "listing_123",
      assetItemId: "item_fomo_box_listed",
      name: "Alpha Box",
      rarity: "rare",
      price: "12.5",
      currency: "POINT_TEST",
      seller: "drop_hunter",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      assetType: "box",
      expiresInMinutes: 1440,
      marketSection: "trending",
      floorRank: 1
    },
    {
      id: "listing_124",
      assetItemId: "item_epic_boost_listed",
      name: "Task Reroll",
      rarity: "epic",
      price: "45.0",
      currency: "POINT_TEST",
      seller: "ton_sniper",
      expiresAt: new Date(Date.now() + 3600000 * 4).toISOString(),
      assetType: "ability",
      expiresInMinutes: 240,
      marketSection: "rare",
      floorRank: 2
    }
  ],
  recentTrades: [
    { id: "trade_1", name: "Crew Boost", price: "9.2", buyer: "alpha_user" },
    { id: "trade_2", name: "Starter Box", price: "4.5", buyer: "market_scout" }
  ],
  fomo: {
    launchWindowEndsAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    boxesRemaining: {
      starter: 1488,
      fomo: 221,
      group: 57,
      project: 47
    },
    activeAgentsToday: 137,
    nextGroupUnlockAgents: 15,
    groupAgentsActive: 8,
    market: {
      floorPrice: "12.5",
      volume24h: "842.0",
      currency: "POINT_TEST",
      floorMove24h: "+18%",
      activeListings: 4
    },
    recentDrops: [
      { id: "drop_demo_1", boxName: "Project Box", rewardName: "Project Access Pass", rarity: "legendary", username: "ton_sniper", createdAt: new Date(Date.now() - 180000).toISOString() },
      { id: "drop_demo_2", boxName: "Crew Box", rewardName: "Crew Boost", rarity: "epic", username: "mission_runner", createdAt: new Date(Date.now() - 420000).toISOString() },
      { id: "drop_demo_3", boxName: "Alpha Box", rewardName: "Alpha Radar", rarity: "rare", username: "drop_hunter", createdAt: new Date(Date.now() - 780000).toISOString() }
    ],
    trendingItems: [
      { name: "Project Box", rarity: "legendary", floorPrice: "88.0", volume24h: "264.0", expiresInMinutes: 122 },
      { name: "Task Reroll", rarity: "epic", floorPrice: "45.0", volume24h: "315.0", expiresInMinutes: 71 },
      { name: "Alpha Box", rarity: "rare", floorPrice: "12.5", volume24h: "420.0", expiresInMinutes: 360 }
    ],
    boxSupply: [
      { key: "starter", name: "Starter Box", remaining: 1488, total: 2047, rarity: "common", route: "Starter activation", oddsLabel: "Starter asset pool" },
      { key: "fomo", name: "Alpha Box", remaining: 221, total: 333, rarity: "rare", route: "Marketplace / campaign", oddsLabel: "Scarce utility pool" },
      { key: "group", name: "Crew Box", remaining: 57, total: 88, rarity: "epic", route: "15 active Agents", oddsLabel: "Crew unlock pool" },
      { key: "project", name: "Project Box", remaining: 47, total: 47, rarity: "legendary", route: "Project campaign", oddsLabel: "Launch window pool" }
    ],
    dropPools: [
      {
        boxName: "Starter Box",
        role: "Free activation",
        supplyLabel: "One per user",
        oddsLabel: "Points / Energy / Basic ability",
        topDrops: [
          { name: "Mission Runner", rarity: "common", effect: "Improves basic Mission consistency", transferable: false },
          { name: "Energy Recovery", rarity: "rare", effect: "Recovers execution Energy", transferable: false },
          { name: "Energy Pack", rarity: "common", effect: "Refills execution energy", transferable: false }
        ]
      }
    ],
    shareStats: {
      personalReports: 18,
      boxReports: 7,
      groupInvites: 12,
      shareRateLabel: "37% first-day share intent"
    },
    marketSections: [
      { key: "trending", title: "Trending now", listingIds: ["listing_123"] },
      { key: "rare", title: "Rare floor", listingIds: ["listing_124"] },
      { key: "expiring", title: "Expiring soon", listingIds: ["listing_124"] },
      { key: "floor", title: "Lowest floor", listingIds: ["listing_123"] }
    ]
  },
  joinedPool: null
};

function ensureMockDefaultBubble(db: MockDB): MockDB {
  if (!db.agent) return db;
  const hasBubble = db.inventory.some((item) => item.bubbleEditionKey || item.displayNo || item.effect?.includes("泡泡"));
  if (hasBubble) return db;
  return {
    ...db,
    inventory: [MOCK_DEFAULT_BUBBLE, ...db.inventory]
  };
}

function loadMockDB(): MockDB {
  if (typeof window === "undefined") return DEFAULT_MOCK_DB;
  const saved = localStorage.getItem("gb_mock_db");
  if (saved) {
    try {
      return ensureMockDefaultBubble(JSON.parse(saved));
    } catch {
      return DEFAULT_MOCK_DB;
    }
  }
  return ensureMockDefaultBubble(DEFAULT_MOCK_DB);
}

function saveMockDB(db: MockDB) {
  if (typeof window !== "undefined") {
    localStorage.setItem("gb_mock_db", JSON.stringify(db));
  }
}

// Helper for simulated network delay in mock mode
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const API_TIMEOUT_MS = 6000;

function assetAmount(symbol: AssetAmount["symbol"], amount: string, decimals = symbol === "TON" ? 9 : 2): AssetAmount {
  return { symbol, amount, decimals };
}

function assetBalance(symbol: AssetBalance["asset"], available: string, reserved = "0"): AssetBalance {
  const total = String(Number(available) + Number(reserved));
  return { asset: symbol, available: assetAmount(symbol, available), reserved: assetAmount(symbol, reserved), total: assetAmount(symbol, total), updatedAt: new Date().toISOString() };
}

export function getRealAssetFallback(agentId = "agent_123", userId = "user_mock"): RealAssetAgentSummary & { skillCards: typeof CANONICAL_SKILL_CARDS } {
  const walletPolicy: AgentWalletPolicy = {
    autoPurchaseEnabled: true,
    perTransactionLimit: assetAmount("G", "25"),
    dailyLimit: assetAmount("G", "80"),
    minimumReserve: assetAmount("TON", "0.05", 9),
    allowedAssets: ["G", "TON", "AI_CREDIT"],
    allowedContracts: ["simulated-ai-credit-vault", "simulated-skill-card-store"],
    allowedProviders: ["openai", "workers-ai", "mock-ai-provider"],
    allowedPurchaseTypes: ["ai_model_token", "ai_credit", "skill_card", "task_execution"],
    requireConfirmationAbove: assetAmount("G", "20"),
    adminGlobalPause: false,
    userPaused: false,
    riskMode: "conservative",
    status: "active"
  };
  const agentWallet: AgentWallet = {
    id: "wallet_simulated_agent",
    agentId,
    userId,
    chain: "TON",
    network: "testnet_simulated",
    address: null,
    label: "Isolated Agent Wallet · simulated",
    walletType: "testnet_simulated",
    permissionLevel: 1,
    status: "active",
    assetBalances: [assetBalance("G", "128.50"), assetBalance("TON", "0.420", "0"), assetBalance("AI_CREDIT", "240")],
    policy: walletPolicy,
    spendingLimitDaily: 80,
    spendingUsedToday: 12,
    transactionLimit: 25,
    allowedActions: ["buy_ai_credit", "execute_opportunity_task", "buy_skill_card"],
    allowedContracts: walletPolicy.allowedContracts,
    withdrawalAddress: null,
    lastActivityAt: null,
    metadata: { simulationOnly: true, mainWalletControl: false, storesSeedPhrase: false },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const skillCardSummary = { totalCanonicalCards: 31, normal: 12, advanced: 12, expert: 7 };
  return {
    assetBalances: agentWallet.assetBalances || [],
    agentWallet,
    walletPolicy,
    aiCreditBalance: [{ agentId, provider: "mock-ai-provider", modelId: "gbot-simulated-model", balance: assetAmount("AI_CREDIT", "240"), reserved: assetAmount("AI_CREDIT", "18"), updatedAt: new Date().toISOString() }] satisfies AiCreditBalance[],
    skillCardSummary,
    purchaseIntentSummary: { proposed: 1, allowed: 1, denied: 0, queued: 0, executing: 0, succeeded: 0, failed: 0, cancelled: 0, paused: 0 },
    skillCards: CANONICAL_SKILL_CARDS
  };
}

function withRealAssetFallback<T extends MeResponse>(response: T): T & { realAssetAgent: RealAssetAgentSummary; skillCards: typeof CANONICAL_SKILL_CARDS } {
  const fallback = getRealAssetFallback(response.agent?.id || "agent_123", response.user.id);
  const realAssetAgent = (response as any).realAssetAgent || fallback;
  return {
    ...response,
    realAssetAgent,
    assetBalances: response.assetBalances || realAssetAgent.assetBalances || fallback.assetBalances,
    agentWallet: response.agentWallet ?? realAssetAgent.agentWallet ?? fallback.agentWallet,
    walletPolicy: response.walletPolicy ?? realAssetAgent.walletPolicy ?? fallback.walletPolicy,
    aiCreditBalance: response.aiCreditBalance || realAssetAgent.aiCreditBalance || fallback.aiCreditBalance,
    skillCardSummary: response.skillCardSummary || realAssetAgent.skillCardSummary || fallback.skillCardSummary,
    purchaseIntentSummary: response.purchaseIntentSummary || realAssetAgent.purchaseIntentSummary || fallback.purchaseIntentSummary,
    skillCards: (response as any).skillCards || fallback.skillCards
  };
}

function toInventoryRarity(value: unknown): Rarity {
  const normalized = String(value || "common").toLowerCase();
  if (normalized === "starter") return "common";
  if (normalized === "cosmetic") return "rare";
  if (normalized === "common" || normalized === "rare" || normalized === "epic" || normalized === "legendary" || normalized === "genesis") {
    return normalized;
  }
  return "common";
}

// Fallback logic wrapper
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // If force mock mode, execute local action instead
  if (getMockMode()) {
    throw new Error("Force mock active");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const headers = new Headers(options?.headers);
    if (!headers.has("content-type") && options?.body) {
      headers.set("content-type", "application/json");
    }
    if (typeof window !== "undefined" && window.Telegram?.WebApp?.initData) {
      headers.set("x-telegram-init-data", window.Telegram.WebApp.initData);
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("gb_access_token") : null;
    if (token && !headers.has("authorization")) {
      headers.set("authorization", `Bearer ${token}`);
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Server returned error code: ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (!getMockMode()) {
      fallbackOccurred = true;
      console.error(`[API Client] API request failed for ${path}. Mock fallback is disabled.`, err);
    }
    throw err; // Callers may use local data only when explicit mock mode is active.
  } finally {
    clearTimeout(timeout);
  }
}

export const apiClient = {
  getBubbleAgentConfig: async (): Promise<BubbleAgentOpsConfig> => {
    try {
      return await request<BubbleAgentOpsConfig>("/bubble-agent/config");
    } catch (error) {
      if (getMockMode()) {
        return GBOT_BUBBLE_AGENT_OPS_CONFIG;
      }
      throw error;
    }
  },

  requestBubblePassportMint: async (payload: BubblePassportMintRequest): Promise<BubblePassportMintResponse> => {
    try {
      const response = await request<BubblePassportMintResponse>("/bubble-agent/passport/mint", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" }
      });
      emitBubblePassportStatus(response.displayNo, response.mintStatus);
      return response;
    } catch (error) {
      if (getMockMode()) {
        await delay(420);
        writeMockBubblePassportStatus(payload.displayNo, "minting");
        return {
          displayNo: payload.displayNo,
          mintStatus: "minting",
          ownerState: "pending_chain_index",
          chain: payload.chain || "TON",
          tokenId: null,
          requestedAt: new Date().toISOString(),
          message: "已记录自愿铸造请求，等待钱包确认与链上索引同步。"
        };
      }
      throw error;
    }
  },

  getBubblePassportStatus: async (displayNo: string): Promise<BubblePassportStatusResponse> => {
    try {
      return await request<BubblePassportStatusResponse>(`/bubble-agent/passport/${encodeURIComponent(displayNo)}`);
    } catch (error) {
      if (getMockMode()) {
        const storedMintStatus = typeof window !== "undefined"
          ? localStorage.getItem(bubblePassportStorageKey(displayNo))
          : null;
        const mintStatus: BubbleMintStatus = storedMintStatus === "minting" || storedMintStatus === "minted" || storedMintStatus === "failed"
          ? storedMintStatus
          : "unminted";
        return {
          passport: {
            displayNo,
            mintStatus,
            ownerState: mintStatus === "minted"
              ? "synced_to_holder"
              : mintStatus === "minting"
                ? "pending_chain_index"
                : mintStatus === "failed"
                  ? "claim_required"
                  : "app_asset",
            chain: "TON",
            tokenId: mintStatus === "minted" ? `Passport-#${displayNo.replace("GBOT-", "")}` : null
          }
        };
      }
      throw error;
    }
  },

  completeMockBubblePassportMint: async (
    displayNo: string,
    mintStatus: Extract<BubbleMintStatus, "minted" | "failed"> = "minted"
  ): Promise<BubblePassportMintResponse> => {
    if (!getMockMode()) {
      throw new Error("Mock passport completion is only available in preview mode.");
    }
    await delay(760);
    writeMockBubblePassportStatus(displayNo, mintStatus);
    return {
      displayNo,
      mintStatus,
      ownerState: mintStatus === "minted" ? "synced_to_holder" : "claim_required",
      chain: "TON",
      tokenId: mintStatus === "minted" ? `Passport-#${displayNo.replace("GBOT-", "")}` : null,
      requestedAt: new Date().toISOString(),
      message: mintStatus === "minted"
        ? "Passport 已同步到当前绑定钱包。"
        : "铸造流程未完成，可重新发起。"
    };
  },

  loginOrRegister: async (initData: string, startParam?: string | null): Promise<MeResponse> => {
    try {
      const res = await request<{ accessToken: string; user: User; agent: Agent | null }>("/auth/telegram", {
        method: "POST",
        body: JSON.stringify({ initData, startParam })
      });
      // Store JWT in localStorage
      if (typeof window !== "undefined" && res.accessToken) {
        localStorage.setItem("gb_access_token", res.accessToken);
      }
      return withRealAssetFallback({ user: res.user, agent: res.agent } as MeResponse);
    } catch (err) {
      if (!getMockMode()) {
        throw err;
      }
      await delay(200);
      const db = loadMockDB();
      return withRealAssetFallback({ user: db.user, agent: db.agent } as MeResponse);
    }
  },

  getMe: async (): Promise<MeResponse> => {
    try {
      // Use authorization header if present
      const token = typeof window !== "undefined" ? localStorage.getItem("gb_access_token") : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers["authorization"] = `Bearer ${token}`;
      }
      return withRealAssetFallback(await request<MeResponse>("/me", { headers }));
    } catch (err) {
      if (getMockMode()) {
        await delay(200);
        const db = loadMockDB();
        return withRealAssetFallback({ user: db.user, agent: db.agent } as MeResponse);
      }
      throw err;
    }
  },

  claimAgent: async (): Promise<{ agent: Agent; starterBox: InventoryItem }> => {
    try {
      return await request<{ agent: Agent; starterBox: InventoryItem }>("/agents/claim", { method: "POST" });
    } catch (err) {
      if (getMockMode()) {
        await delay(300);
        const db = loadMockDB();
  
        const newAgent: Agent = {
          id: "agent_123",
          name: "Agent #123",
          level: 1,
          energy: 100,
          maxEnergy: 150,
          pendingPoints: 0,
          userScore: 0,
          rankTier: "unranked",
          autoRunUntil: null
        } as unknown as Agent;
  
        const starterBox: InventoryItem = {
          id: "item_starter_box",
          type: "box",
          name: "Starter Box",
          rarity: "common",
          transferable: false,
          expiresAt: null,
          status: "available"
        };
        db.user.hasAgent = true;
        db.agent = newAgent;
        db.inventory = [MOCK_DEFAULT_BUBBLE, starterBox];
        saveMockDB(db);
  
        return { agent: newAgent, starterBox };
      }
      throw err;
    }
  },

  getInventory: async (): Promise<{ items: InventoryItem[] }> => {
    try {
      const res = await request<{ items: InventoryItem[] }>("/inventory");
      // Align response key with spec if needed
      return res;
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        const db = loadMockDB();
        return { items: db.inventory };
      }
      throw err;
    }
  },

  getFomoSnapshot: async (): Promise<FomoSnapshot> => {
    try {
      return await request<FomoSnapshot>("/fomo/snapshot");
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        const db = loadMockDB();
        return db.fomo;
      }
      throw err;
    }
  },

  trackEvent: async (eventName: string, source: string, properties: Record<string, unknown> = {}): Promise<void> => {
    try {
      await request<{ ok: boolean }>("/analytics/events", {
        method: "POST",
        body: JSON.stringify({ eventName, source, properties }),
        headers: { "content-type": "application/json" }
      });
    } catch (err) {
      if (getMockMode()) {
        const db = loadMockDB();
        if (eventName === "share_personal_report" && db.fomo.shareStats) db.fomo.shareStats.personalReports += 1;
        if (eventName === "share_box_report" && db.fomo.shareStats) db.fomo.shareStats.boxReports += 1;
        if (eventName === "share_group_invite" && db.fomo.shareStats) db.fomo.shareStats.groupInvites += 1;
        saveMockDB(db);
      }
      // Analytics fire-and-forget: suppress errors in production
    }
  },

  openBox: async (inventoryItemId: string): Promise<BubbleBoxOpenResult & { agent: Agent }> => {
    try {
      return await request<any>(`/boxes/${inventoryItemId}/open`, { method: "POST" });
    } catch (err) {
      if (getMockMode()) {
        await delay(500);
        const db = loadMockDB();
        if (!db.agent) throw new Error("No agent activated.");
  
        const item = db.inventory.find(i => i.id === inventoryItemId);
        if (!item) throw new Error("Item not found");
  
        // Burn box
        db.inventory = db.inventory.filter(i => i.id !== inventoryItemId);
  
        // Starter vs skill-box rewards. Real mode is resolved by the backend.
        let rewards: BubbleBoxOpenResult["rewards"];
        if (item.name === "Starter Box") {
          rewards = [
            { type: "pending_points", name: "300 G", amount: 300 },
            { type: "energy", name: "50 Token 能量", amount: 50 },
            {
              type: "ability",
              itemId: "item_auto_farmer_" + Date.now(),
              name: "Mission Runner",
              rarity: "common" as Rarity,
              category: "profession" as const
            }
          ];
        } else if (item.name === "Crew Box") {
          rewards = [
            { type: "pending_points", name: "1200 G", amount: 1200 },
            { type: "energy", name: "35 Token 能量", amount: 35 },
            {
              type: "ability",
              itemId: "item_group_rally_" + Date.now(),
              name: "Crew Captain",
              rarity: "epic" as Rarity,
              category: "profession" as const
            }
          ];
        } else if (item.name === "Project Box") {
          rewards = [
            { type: "pending_points", name: "2400 G", amount: 2400 },
            {
              type: "ability",
              itemId: "item_project_ticket_" + Date.now(),
              name: "Project Access Pass",
              rarity: "legendary" as Rarity,
              category: "access" as const
            }
          ];
        } else {
          const bubbleRoll = Date.now() % 5 === 0;
          if (bubbleRoll) {
            const edition = GBOT_BUBBLE_AGENT_OPS_CONFIG.editions.find((item) => item.key === "black-gold") ?? GBOT_BUBBLE_AGENT_OPS_CONFIG.editions[0];
            if (!edition) throw new Error("泡泡配置缺失。");
            const displayNo = `GBOT-${String(Date.now()).slice(-6)}`;
            rewards = [
              {
                type: "bubble_agent",
                itemId: "item_bubble_" + Date.now(),
                name: edition.name,
                rarity: edition.rarity,
                category: "bubble_agent",
                bubbleEditionKey: edition.key,
                displayNo,
                naturalSkillCodes: edition.naturalSkills.map((skill) => skill.code)
              }
            ];
          } else {
            rewards = [
              {
                type: "skill",
                itemId: "item_skill_card_" + Date.now(),
                name: "高级技能卡",
                rarity: "Rare",
                category: "skill"
              }
            ];
          }
        }
  
        // Add minted abilities to inventory
        rewards.forEach(r => {
          if ((r.type === "ability" || r.type === "skill") && r.itemId) {
            db.inventory.push({
              id: r.itemId,
              type: r.type === "skill" ? "skill_card" : "ability",
              name: r.name || "Mission Skill",
              rarity: toInventoryRarity(r.rarity),
              transferable: item.name !== "Starter Box", // starter box abilities are soulbound/non-transferable
              status: "available",
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
              usesRemaining: 1,
              category: r.category as InventoryItem["category"]
            });
          }
          if (r.type === "bubble_agent" && r.itemId) {
            db.inventory.push({
              id: r.itemId,
              type: "badge",
              name: r.name || "特别版泡泡",
              rarity: toInventoryRarity(r.rarity),
              transferable: false,
              soulbound: true,
              status: "available",
              expiresAt: null,
              category: "access",
              series: r.name,
              cardNumber: r.displayNo,
              displayNo: r.displayNo,
              bubbleEditionKey: r.bubbleEditionKey,
              naturalSkillCodes: r.naturalSkillCodes,
              effect: "特别版泡泡外观与天生标签"
            });
          }
        });
  
        // Update agent
        const pointsReward = rewards.find(r => r.type === "pending_points")?.amount || 0;
        const energyReward = rewards.find(r => r.type === "energy")?.amount || 0;
        const abilityReward = rewards.find(r => r.type === "ability" || r.type === "skill" || r.type === "bubble_agent");
        if (abilityReward?.name) {
          db.fomo.recentDrops.unshift({
            id: "drop_" + Date.now(),
            boxName: item.name,
            rewardName: abilityReward.name,
            rarity: toInventoryRarity(abilityReward.rarity),
            username: db.user.username,
            createdAt: new Date().toISOString()
          });
          db.fomo.recentDrops = db.fomo.recentDrops.slice(0, 6);
        }
  
        db.agent = {
          ...db.agent,
          pendingPoints: db.agent.pendingPoints + pointsReward,
          energy: Math.min(db.agent.maxEnergy, db.agent.energy + energyReward),
          userScore: db.agent.userScore + Math.floor(pointsReward * 0.8), // userScore grows with points
          rankTier: "top_20"
        };
  
        saveMockDB(db);
  
        return {
          openingId: "opening_" + Date.now(),
          box: { id: inventoryItemId, name: item.name },
          rewards,
          agent: db.agent
        };
      }
      throw err;
    }
  },

  getTasks: async (): Promise<{ tasks: Task[] }> => {
    try {
      return await request<{ tasks: Task[] }>("/tasks/available");
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        const db = loadMockDB();
        return { tasks: db.tasks };
      }
      throw err;
    }
  },

  runFarm: async (taskIds: string[], abilityItemIds: string[]): Promise<{
    runId: string;
    completedTasks: number;
    energySpent: number;
    pendingPointsEarned: number;
    appliedMultiplier: number;
    agent: Agent;
  }> => {
    try {
      const agentId = (await apiClient.getMe()).agent?.id || "agent_123";
      return await request<any>(`/agents/${agentId}/farm`, {
        method: "POST",
        body: JSON.stringify({ taskIds, abilityItemIds }),
        headers: { "content-type": "application/json" }
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(600);
        const db = loadMockDB();
        if (!db.agent) throw new Error("No agent activated.");
  
        // Calculate cost & rewards
        let energySpent = 0;
        let pendingPointsEarned = 0;
  
        taskIds.forEach(tid => {
          const task = db.tasks.find(t => t.id === tid);
          if (task) {
            energySpent += task.energyCost;
            pendingPointsEarned += task.basePendingPoints;
          }
        });
  
        if (db.agent.energy < energySpent) {
          throw new Error("Insufficient energy");
        }
  
        // Check abilities
        let multiplier = 1.0;
        abilityItemIds.forEach(aid => {
          const item = db.inventory.find(i => i.id === aid);
          if (item && item.type === "ability" && item.status === "available") {
            if (item.name.includes("2x")) multiplier = 2.0;
            else if (item.name.includes("3x")) multiplier = 3.0;
            else multiplier = 1.2;
  
            // Consume ability charges
            item.status = "burned";
          }
        });
  
        db.inventory = db.inventory.filter(i => i.status !== "burned");
  
        const finalEarned = Math.floor(pendingPointsEarned * multiplier);
  
        db.agent = {
          ...db.agent,
          energy: Math.max(0, db.agent.energy - energySpent),
          pendingPoints: db.agent.pendingPoints + finalEarned,
          userScore: db.agent.userScore + Math.floor(finalEarned * 0.8),
          rankTier: "top_20"
        };
  
        saveMockDB(db);
  
        return {
          runId: "run_" + Date.now(),
          completedTasks: taskIds.length,
          energySpent,
          pendingPointsEarned: finalEarned,
          appliedMultiplier: multiplier,
          agent: db.agent
        };
      }
      throw err;
    }
  },

  getLeaderboard: async (scope: string, period: string): Promise<{
    scope: string;
    period: string;
    currentUser: { rank: number; rankTier: string; pointsToNextTier: number };
    rows: LeaderboardRow[];
  }> => {
    try {
      return await request<any>(`/leaderboard?scope=${scope}&period=${period}`);
    } catch (err) {
      if (getMockMode()) {
        await delay(150);
        const db = loadMockDB();
        const rows: LeaderboardRow[] = [
          { rank: 1, displayName: "mission_runner", score: 98200 },
          { rank: 2, displayName: "drop_hunter", score: 87610 },
          { rank: 3, displayName: "ton_sniper", score: 80940 },
          { rank: 4, displayName: "crew_boost", score: 71200 },
          { rank: 5, displayName: "crew_captain", score: 62000 },
          { rank: 6, displayName: db.user.username, score: db.agent?.userScore || 0 }
        ];
  
        // Sort rows
        rows.sort((a, b) => b.score - a.score);
        rows.forEach((r, idx) => { r.rank = idx + 1; });
  
        const myRowIndex = rows.findIndex(r => r.displayName === db.user.username);
        const myRank = myRowIndex + 1;
  
        return {
          scope,
          period,
          currentUser: {
            rank: myRank || 4821,
            rankTier: db.agent?.rankTier || "unranked",
            pointsToNextTier: 680
          },
          rows
        };
      }
      throw err;
    }
  },

  joinGroupPool: async (telegramGroupId: string, startParam?: string): Promise<{ pool: GroupPool }> => {
    try {
      return await request<{ pool: GroupPool }>("/groups/pools/join", {
        method: "POST",
        body: JSON.stringify({ telegramGroupId, startParam }),
        headers: { "content-type": "application/json" }
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(200);
        const db = loadMockDB();
  
        const newPool: GroupPool = {
          id: "pool_" + Date.now(),
          telegramGroupId,
          title: "Telegram Crew",
          memberCount: 43,
          dailyScore: 15400,
          rank: 78,
          boostMultiplier: 1.15
        };
  
        db.joinedPool = newPool;
        saveMockDB(db);
  
        return { pool: newPool };
      }
      throw err;
    }
  },

  getMarketplaceListings: async (): Promise<{
    stats: { floorPrice: string; volume24h: string; currency: string; floorMove24h?: string; activeListings?: number };
    listings: MarketplaceListing[];
    recentTrades: Array<{ id: string; name: string; price: string; buyer: string }>;
    marketSections?: Array<{ key: string; title: string; listingIds: string[] }>;
  }> => {
    try {
      return await request<any>("/marketplace/listings");
    } catch (err) {
      if (getMockMode()) {
        await delay(150);
        const db = loadMockDB();
        return {
          stats: {
            floorPrice: "12.5",
            volume24h: "842.0",
            currency: "POINT_TEST",
            floorMove24h: "+18%",
            activeListings: db.listings.length
          },
          listings: db.listings,
          recentTrades: db.recentTrades,
          marketSections: db.fomo.marketSections
        };
      }
      throw err;
    }
  },

  listMarketplaceItem: async (inventoryItemId: string, price: string): Promise<{ listing: MarketplaceListing }> => {
    try {
      return await request<{ listing: MarketplaceListing }>("/marketplace/listings", {
        method: "POST",
        body: JSON.stringify({ inventoryItemId, price, currency: "POINT_TEST", expiresAt: new Date(Date.now() + 86400000).toISOString() }),
        headers: { "content-type": "application/json" }
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(250);
        const db = loadMockDB();
  
        const item = db.inventory.find(i => i.id === inventoryItemId);
        if (!item) throw new Error("Item not found");
  
        // Mark listed in inventory
        item.status = "listed";
  
        const newListing: MarketplaceListing = {
          id: "listing_" + Date.now(),
          assetItemId: inventoryItemId,
          name: item.name,
          rarity: item.rarity,
          price,
          currency: "POINT_TEST",
          seller: db.user.username,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          assetType: item.type === "box" ? "box" : "ability",
          expiresInMinutes: 1440,
          marketSection: item.type === "box" ? "trending" : "rare",
          floorRank: db.listings.length + 1
        };
  
        db.listings.push(newListing);
        saveMockDB(db);
  
        return { listing: newListing };
      }
      throw err;
    }
  },

  buyMarketplaceItem: async (listingId: string): Promise<{
    tradeId: string;
    item: { id: string; ownerUserId: string };
    fee: string;
  }> => {
    try {
      return await request<any>(`/marketplace/listings/${listingId}/buy`, { method: "POST" });
    } catch (err) {
      if (getMockMode()) {
        await delay(300);
        const db = loadMockDB();
        if (!db.agent) throw new Error("No agent activated.");
  
        const listing = db.listings.find(l => l.id === listingId);
        if (!listing) throw new Error("Listing not found");
  
        const priceVal = parseFloat(listing.price);
        if (db.agent.pendingPoints < priceVal) {
          throw new Error("Insufficient Pending Points.");
        }
  
        // Deduct points
        db.agent.pendingPoints = Math.max(0, db.agent.pendingPoints - priceVal);
  
        // Delete listing
        db.listings = db.listings.filter(l => l.id !== listingId);
  
        // Add to inventory
        const newItem: InventoryItem = {
          id: listing.assetItemId,
          type: listing.name.includes("Box") ? "box" : "ability",
          name: listing.name,
          rarity: listing.rarity,
          transferable: true,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          status: "available",
          effect: listing.name.includes("Box") ? "Unopened supply item" : "Mission asset",
          sourceBox: listing.name.includes("Box") ? listing.name : undefined,
          tradableLabel: "Market ready"
        };
        db.inventory.push(newItem);
  
        // Add trade history
        db.recentTrades.unshift({
          id: "trade_" + Date.now(),
          name: listing.name,
          price: listing.price,
          buyer: db.user.username
        });
  
        saveMockDB(db);
  
        return {
          tradeId: "trade_" + Date.now(),
          item: { id: listing.assetItemId, ownerUserId: db.user.id },
          fee: (priceVal * 0.025).toFixed(4)
        };
      }
      throw err;
    }
  },

  // Cancel marketplace listing (client-side mock handler)
  cancelMarketplaceItem: async (listingId: string): Promise<{ listingId: string }> => {
    await delay(200);
    const db = loadMockDB();

    const listing = db.listings.find(l => l.id === listingId);
    if (listing) {
      // Revert status of item in inventory if it exists there
      const item = db.inventory.find(i => i.id === listing.assetItemId);
      if (item) {
        item.status = "available";
      } else {
        // Put back in inventory
        db.inventory.push({
          id: listing.assetItemId,
          type: listing.name.includes("Box") ? "box" : "ability",
          name: listing.name,
          rarity: listing.rarity,
          transferable: true,
          expiresAt: listing.expiresAt,
          status: "available",
          effect: listing.name.includes("Box") ? "Unopened supply item" : "Mission asset",
          sourceBox: listing.name.includes("Box") ? listing.name : undefined,
          tradableLabel: "Market ready"
        });
      }
    }

    db.listings = db.listings.filter(l => l.id !== listingId);
    saveMockDB(db);

    return { listingId };
  },

  learnSkillCard: async (itemId: string): Promise<{ item: InventoryItem }> => {
    try {
      return await request<{ item: InventoryItem }>(`/inventory/${itemId}/learn`, { method: "POST" });
    } catch (err) {
      if (getMockMode()) {
        await delay(200);
        const db = loadMockDB();
        const item = db.inventory.find(i => i.id === itemId);
        if (!item) throw new Error("Skill card not found in inventory");
        item.status = "active";
        item.transferable = false;
        item.learnStatus = "equipped";
        saveMockDB(db);
        return { item };
      }
      throw err;
    }
  },

  unequipSkillCard: async (itemId: string): Promise<{ item: InventoryItem }> => {
    try {
      return await request<{ item: InventoryItem }>(`/inventory/${itemId}/unequip`, { method: "POST" });
    } catch (err) {
      if (getMockMode()) {
        await delay(200);
        const db = loadMockDB();
        const item = db.inventory.find(i => i.id === itemId);
        if (!item) throw new Error("Skill card not found in inventory");
        item.status = "cooling_down";
        item.transferable = false;
        item.learnStatus = "unlearned";
        item.cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        saveMockDB(db);
        return { item };
      }
      throw err;
    }
  },

  submitTaskVerification: async (taskId: string, link: string): Promise<{ status: string; link: string }> => {
    try {
      return await request<{ status: string; link: string }>(`/tasks/${taskId}/submit`, {
        method: "POST",
        body: JSON.stringify({ link }),
        headers: { "content-type": "application/json" }
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(200);
        return { status: "submitted", link };
      }
      throw err;
    }
  },

  verifyTaskVerification: async (taskId: string, abilityItemIds: string[], submittedLink?: string): Promise<{
    status: "approved" | "rejected";
    pendingPointsEarned?: number;
    energySpent?: number;
    agent?: Agent;
    feedback?: string;
  }> => {
    try {
      return await request<any>(`/tasks/${taskId}/verify`, {
        method: "POST",
        body: JSON.stringify({ abilityItemIds }),
        headers: { "content-type": "application/json" }
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(400);
        const db = loadMockDB();
        if (!db.agent) throw new Error("No agent activated.");
  
        const task = db.tasks.find(t => t.id === taskId);
        if (!task) throw new Error("Task not found");
  
        if (db.agent.energy < task.energyCost) {
          throw new Error("Insufficient energy");
        }
  
        // Check link format mock
        const link = submittedLink || "";
        let isValid = false;
        const name = task.name.toLowerCase();
        if (name.includes("twitter") || name.includes("x") || name.includes("radar")) {
          isValid = /^https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_]+/i.test(link);
        } else if (name.includes("telegram") || name.includes("check-in") || name.includes("tg")) {
          isValid = /^https?:\/\/(www\.)?t\.me\/[a-zA-Z0-9_]+/i.test(link) || link.startsWith("@");
        } else if (name.includes("discord") || name.includes("community")) {
          isValid = /^https?:\/\/(www\.)?(discord\.gg|discord\.com)\/[a-zA-Z0-9_-]+/i.test(link);
        } else {
          isValid = /^https?:\/\/[^\s$.?#].[^\s]*$/i.test(link);
        }
  
        if (!isValid) {
          return { status: "rejected", feedback: "Link format invalid for target platform." };
        }
  
        // Calculate cost & rewards
        const energySpent = task.energyCost;
        const basePoints = task.basePendingPoints;
  
        // Check abilities
        let multiplier = 1.0;
        abilityItemIds.forEach(aid => {
          const item = db.inventory.find(i => i.id === aid);
          if (item && item.type === "ability" && item.status === "available") {
            if (item.name.includes("2x")) multiplier = 2.0;
            else if (item.name.includes("3x")) multiplier = 3.0;
            else multiplier = 1.2;
  
            // Consume ability
            item.status = "burned";
          }
        });
  
        db.inventory = db.inventory.filter(i => i.status !== "burned");
  
        const finalEarned = Math.floor(basePoints * multiplier);
  
        db.agent = {
          ...db.agent,
          energy: Math.max(0, db.agent.energy - energySpent),
          pendingPoints: db.agent.pendingPoints + finalEarned,
          userScore: db.agent.userScore + Math.floor(finalEarned * 0.8),
          rankTier: "top_20"
        };
  
        saveMockDB(db);
  
        return {
          status: "approved",
          pendingPointsEarned: finalEarned,
          energySpent,
          agent: db.agent
        };
      }
      throw err;
    }
  },

  getTaskVerificationStatus: async (taskId: string): Promise<{
    status: string;
    link?: string;
    feedback?: string;
    createdAt?: string;
  }> => {
    try {
      return await request<{ status: string; link?: string; feedback?: string; createdAt?: string }>(`/tasks/${taskId}/status`);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { status: "pending" };
      }
      throw err;
    }
  },

  // Bounty Task Network endpoints
  getBountyTasks: async (): Promise<{ tasks: any[] }> => {
    try {
      return await request<{ tasks: any[] }>("/bounty/tasks");
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        const db = loadMockDB();
        const mockBountyTasks = (db as any).bountyTasks || [
          {
            id: "bounty_task_1",
            title: "关注 GrowthBot 官方推特",
            description: "在推特关注我们的官方账号 @GrowthBot 并提交您的个人主页链接。",
            category: "social",
            platform: "twitter",
            targetUrl: "https://x.com/growthbot",
            budgetTotal: 1000,
            budgetRemaining: 995,
            rewardPoints: 500,
            rewardAssetName: null,
            rewardAccessPass: null,
            deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
            verificationRule: "^https?:\\/\\/(www\\.)?(twitter|x)\\.com\\/[a-zA-Z0-9_]+$",
            submissionType: "link",
            riskLevel: "low",
            ownerType: "official",
            ownerName: "GrowthBot 官方",
            completedCount: 5,
            maxCompletions: 1000,
            pausedReason: null,
            status: "active",
            createdByAdmin: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: "bounty_task_2",
            title: "加入官方 Telegram 群组",
            description: "加入 GrowthBot 官方群组并提交您的 Telegram 个人链接。",
            category: "social",
            platform: "telegram",
            targetUrl: "https://t.me/GrowthBotOfficial",
            budgetTotal: 500,
            budgetRemaining: 498,
            rewardPoints: 300,
            rewardAssetName: "Task Reroll",
            rewardAccessPass: null,
            deadline: new Date(Date.now() + 86400000 * 10).toISOString(),
            verificationRule: "^https?:\\/\\/t\\.me\\/[a-zA-Z0-9_]+$",
            submissionType: "link",
            riskLevel: "low",
            ownerType: "official",
            ownerName: "GrowthBot 官方",
            completedCount: 2,
            maxCompletions: 500,
            pausedReason: null,
            status: "active",
            createdByAdmin: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ];
        (db as any).bountyTasks = mockBountyTasks;
        saveMockDB(db);
        return { tasks: mockBountyTasks };
      }
      throw err;
    }
  },

  submitBountyTask: async (taskId: string, link: string): Promise<{ id: string; status: string; link: string }> => {
    try {
      return await request<any>(`/bounty/tasks/${taskId}/submit`, {
        method: "POST",
        body: JSON.stringify({ link }),
        headers: { "content-type": "application/json" }
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(300);
        const db = loadMockDB();
        const task = ((db as any).bountyTasks || []).find((t: any) => t.id === taskId);
        if (!task) throw new Error("Task not found");
  
        const verifications = (db as any).bountyVerifications || {};
        const verifId = "bverif_" + Math.random().toString(36).substring(2, 9);
        const newVerif = {
          id: verifId,
          bountyTaskId: taskId,
          userId: "user_mock",
          link,
          submissionHash: `${taskId}:${link}`,
          status: "submitted",
          riskFlagged: 0,
          feedback: null,
          reviewedBy: null,
          createdAt: new Date().toISOString(),
          verifiedAt: null,
          rewardGrantedAt: null
        };
        verifications[taskId] = newVerif;
        (db as any).bountyVerifications = verifications;
        saveMockDB(db);
  
        return { id: verifId, status: "submitted", link };
      }
      throw err;
    }
  },

  verifyBountyTask: async (taskId: string): Promise<{
    status: "approved" | "rejected" | "verifying";
    feedback?: string;
    riskFlagged?: number;
  }> => {
    try {
      return await request<any>(`/bounty/tasks/${taskId}/verify`, {
        method: "POST"
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(400);
        const db = loadMockDB();
        const task = ((db as any).bountyTasks || []).find((t: any) => t.id === taskId);
        const verifications = (db as any).bountyVerifications || {};
        const verif = verifications[taskId];
  
        if (!task || !verif) throw new Error("Verification record not found");
  
        let isFormatValid = true;
        if (task.verificationRule) {
          try {
            const rx = new RegExp(task.verificationRule, 'i');
            isFormatValid = rx.test(verif.link);
          } catch (e) {
            isFormatValid = verif.link.startsWith("http");
          }
        } else {
          isFormatValid = verif.link.startsWith("http");
        }
  
        if (!isFormatValid) {
          verif.status = "rejected";
          verif.feedback = "链接格式不符合任务要求";
          verif.verifiedAt = new Date().toISOString();
          saveMockDB(db);
          return { status: "rejected", feedback: "链接格式不符合任务要求", riskFlagged: 0 };
        }
  
        let riskFlagged = 0;
        if (task.riskLevel === 'high') {
          riskFlagged = 1;
        }
        const lowcaseLink = verif.link.toLowerCase();
        if (lowcaseLink.includes("localhost") || lowcaseLink.includes("127.0.0.1") || lowcaseLink.includes("test")) {
          riskFlagged = 1;
        }
  
        if (riskFlagged === 1) {
          verif.status = "verifying";
          verif.riskFlagged = 1;
          verif.verifiedAt = new Date().toISOString();
          saveMockDB(db);
          return {
            status: "verifying",
            feedback: "链接格式校验通过，但系统检测到潜在风险或属于高额奖励任务，已转入人工复核中。",
            riskFlagged: 1
          };
        }
  
        verif.status = "approved";
        verif.rewardGrantedAt = new Date().toISOString();
        verif.verifiedAt = new Date().toISOString();
  
        task.budgetRemaining = Math.max(0, task.budgetRemaining - 1);
        task.completedCount += 1;
  
        if (db.agent) {
          db.agent.pendingPoints += task.rewardPoints;
          db.agent.userScore += Math.floor(task.rewardPoints * 0.8);
        }
  
        saveMockDB(db);
        return {
          status: "approved",
          feedback: "格式校验通过，已成功登记并自动发放奖励。平台并不对您在外部平台的物理完成状态进行实质验证。",
          riskFlagged: 0
        };
      }
      throw err;
    }
  },

  getBountyTaskStatus: async (taskId: string): Promise<{
    status: string;
    id?: string;
    bountyTaskId?: string;
    userId?: string;
    link?: string;
    riskFlagged?: number;
    feedback?: string;
    createdAt?: string;
    verifiedAt?: string;
    rewardGrantedAt?: string;
  }> => {
    try {
      return await request<any>(`/bounty/tasks/${taskId}/status`);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        const db = loadMockDB();
        const verifications = (db as any).bountyVerifications || {};
        const verif = verifications[taskId];
        if (!verif) {
          return { status: "not_submitted" };
        }
        return verif;
      }
      throw err;
    }
  },

  getModelConfig: async (): Promise<{ config: any }> => {
    try {
      return await request<{ config: any }>("/agent/model-config");
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        const db = loadMockDB();
        return { config: (db as any).agentModelConfig || null };
      }
      throw err;
    }
  },

  saveModelConfig: async (config: any): Promise<{ success: boolean; id: string }> => {
    try {
      return await request<any>("/agent/model-config", {
        method: "POST",
        body: JSON.stringify(config),
        headers: { "content-type": "application/json" }
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(200);
        const db = loadMockDB();
        const configId = config.id || "config_" + Date.now();
        const existing = (db as any).agentModelConfig;
        const keyLast4 = config.apiKey ? config.apiKey.slice(-4) : (existing ? (existing as any).keyLast4 : null);
        const newConfig = {
          ...config,
          id: configId,
          keyLast4,
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        delete newConfig.apiKey;
        (db as any).agentModelConfig = newConfig;
        saveMockDB(db);
        return { success: true, id: configId };
      }
      throw err;
    }
  },

  deleteModelConfig: async (): Promise<{ success: boolean }> => {
    try {
      return await request<any>("/agent/model-config", { method: "DELETE" });
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        const db = loadMockDB();
        (db as any).agentModelConfig = null;
        saveMockDB(db);
        return { success: true };
      }
      throw err;
    }
  },

  getAiGuide: async (taskId: string, isBounty = false): Promise<AiGuideResponse> => {
    try {
      const endpoint = isBounty ? `/agent/bounty/${taskId}/ai-guide` : `/agent/tasks/${taskId}/ai-guide`;
      return await request<AiGuideResponse>(endpoint, { method: "POST" });
    } catch (err) {
      if (getMockMode()) {
        await delay(150);
        const db = loadMockDB();
        const task = isBounty
          ? ((db as any).bountyTasks || []).find((t: any) => t.id === taskId)
          : db.tasks.find((t: any) => t.id === taskId);
        const title = task ? (task.name || task.title) : "未知任务";
        const category = task ? (task.projectId || task.category || "General") : "General";
  
        return {
          summary: `智能解析了任务 "${title}"。这是一个 ${category} 类型的任务。`,
          steps: [
            "点击直达链接进入外部任务页面。",
            "按照任务说明完成对应动作（关注、发帖或加群等）。",
            "完成后复制外部页面的主页或分享链接。",
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
      throw err;
    }
  },

  getRecommendations: async (): Promise<TaskRecommendationResponse> => {
    try {
      return await request<TaskRecommendationResponse>("/agent/tasks/recommendations", { method: "POST" });
    } catch (err) {
      if (getMockMode()) {
        await delay(150);
        const db = loadMockDB();
        const allTasks = [
          ...db.tasks.map(t => ({ id: t.id, title: t.name })),
          ...((db as any).bountyTasks || []).map((t: any) => ({ id: t.id, title: t.title }))
        ];
        const recs = allTasks.slice(0, 3).map((t, idx) => ({
          taskId: t.id,
          reason: idx === 0 ? "基于您的偏好，此任务奖励丰厚，推荐优先完成。" : "该任务步骤简单，耗时极短，适合获取基础能量积分。"
        }));
        return { recommendations: recs };
      }
      throw err;
    }
  },

  // ----------------- V1 APIs FOR STORE, WORKFLOW & WALLET -----------------
  getAssetCatalog: async (): Promise<{ catalog: any[] }> => {
    try {
      return await request<any>("/assets/catalog");
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { catalog: [] };
      }
      throw err;
    }
  },

  getStoreBoxes: async (): Promise<{ products: any[] }> => {
    try {
      return await request<any>("/store/boxes");
    } catch (err) {
      if (getMockMode()) {
        await delay(150);
        return {
          products: [
            { id: "starter", code: "starter", name: "Starter Box", description: "Free Starter Pack", boxType: "starter", rarity: "common", priceAmount: 0, priceCurrency: "GP", totalSupply: 2047, remainingSupply: 1488, perUserLimit: 1, saleStartAt: null, saleEndAt: null, transferable: false, status: "active", metadata: null },
            { id: "worker", code: "worker", name: "Worker Box", description: "Standard workbench utility pack", boxType: "worker", rarity: "rare", priceAmount: 200, priceCurrency: "GP", totalSupply: 1000, remainingSupply: 820, perUserLimit: 5, saleStartAt: null, saleEndAt: null, transferable: true, status: "active", metadata: null },
            { id: "specialist", code: "specialist", name: "Specialist Box", description: "Advanced skill and tools pack", boxType: "specialist", rarity: "epic", priceAmount: 500, priceCurrency: "GP", totalSupply: 500, remainingSupply: 420, perUserLimit: 3, saleStartAt: null, saleEndAt: null, transferable: true, status: "active", metadata: null }
          ]
        };
      }
      throw err;
    }
  },

  getStoreBox: async (boxId: string): Promise<{ product: any }> => {
    try {
      return await request<any>(`/store/boxes/${boxId}`);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        const products = [
          { id: "starter", code: "starter", name: "Starter Box", description: "Free Starter Pack", boxType: "starter", rarity: "common", priceAmount: 0, priceCurrency: "GP", totalSupply: 2047, remainingSupply: 1488, perUserLimit: 1, saleStartAt: null, saleEndAt: null, transferable: false, status: "active", metadata: null },
          { id: "worker", code: "worker", name: "Worker Box", description: "Standard workbench utility pack", boxType: "worker", rarity: "rare", priceAmount: 200, priceCurrency: "GP", totalSupply: 1000, remainingSupply: 820, perUserLimit: 5, saleStartAt: null, saleEndAt: null, transferable: true, status: "active", metadata: null },
          { id: "specialist", code: "specialist", name: "Specialist Box", description: "Advanced skill and tools pack", boxType: "specialist", rarity: "epic", priceAmount: 500, priceCurrency: "GP", totalSupply: 500, remainingSupply: 420, perUserLimit: 3, saleStartAt: null, saleEndAt: null, transferable: true, status: "active", metadata: null }
        ];
        const p = products.find(x => x.id === boxId) || products[0];
        return { product: p };
      }
      throw err;
    }
  },

  getDropTable: async (boxId: string): Promise<{ dropTable: any[] }> => {
    try {
      return await request<any>(`/store/boxes/${boxId}/drop-table`);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return {
          dropTable: [
            { id: "drop_gp", boxProductId: boxId, assetDefinitionId: null, assetName: "积分奖励", weight: 50, guaranteed: true, minQuantity: 1, maxQuantity: 1, rarity: "common", pointAmount: 100, energyAmount: 0, probability: 1.0 },
            { id: "drop_energy", boxProductId: boxId, assetDefinitionId: null, assetName: "行动力包", weight: 50, guaranteed: true, minQuantity: 1, maxQuantity: 1, rarity: "common", pointAmount: 0, energyAmount: 20, probability: 1.0 },
            { id: "drop_ability_1", boxProductId: boxId, assetDefinitionId: "def_scanner", assetName: "Task Scanner", weight: 30, guaranteed: false, minQuantity: 1, maxQuantity: 1, rarity: "common", pointAmount: 0, energyAmount: 0, probability: 0.6 },
            { id: "drop_ability_2", boxProductId: boxId, assetDefinitionId: "def_planner", assetName: "Task Planner", weight: 20, guaranteed: false, minQuantity: 1, maxQuantity: 1, rarity: "rare", pointAmount: 0, energyAmount: 0, probability: 0.4 }
          ]
        };
      }
      throw err;
    }
  },

  purchaseBox: async (boxId: string, quantity = 1, idempotencyKey?: string): Promise<{ order: any }> => {
    try {
      return await request<any>(`/store/boxes/${boxId}/orders`, {
        method: "POST",
        body: JSON.stringify({ quantity, idempotencyKey })
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(300);
        const db = loadMockDB();
        if (!db.agent) throw new Error("Activate Agent first");
        const price = boxId === "worker" ? 200 : (boxId === "specialist" ? 500 : 0);
        const cost = price * quantity;
        if (db.agent.pendingPoints < cost) {
          throw new Error("insufficient_balance");
        }
        db.agent.pendingPoints -= cost;
        
        const boxItem: InventoryItem = {
          id: "item_purchased_" + Date.now(),
          type: "box",
          name: boxId === "skill_box" ? "Skill Box" : boxId === "worker" ? "Worker Box" : "Specialist Box",
          rarity: boxId === "skill_box" || boxId === "worker" ? "rare" : "epic",
          transferable: true,
          expiresAt: null,
          status: "available"
        };
        db.inventory.push(boxItem);
        saveMockDB(db);

        return {
          order: {
            id: "order_" + Date.now(),
            userId: db.user.id,
            boxProductId: boxId,
            boxName: boxItem.name,
            boxCode: boxId,
            quantity,
            unitPrice: price,
            totalPrice: cost,
            currency: "GP",
            paymentProvider: "gp_balance",
            status: "fulfilled",
            fulfilledInventoryItemId: boxItem.id,
            createdAt: new Date().toISOString(),
            paidAt: new Date().toISOString(),
            fulfilledAt: new Date().toISOString()
          }
        };
      }
      throw err;
    }
  },

  getOrder: async (orderId: string): Promise<{ order: any }> => {
    try {
      return await request<any>(`/store/orders/${orderId}`);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { order: null };
      }
      throw err;
    }
  },

  planTask: async (taskId: string): Promise<any> => {
    try {
      return await request<any>(`/tasks/${taskId}/plan`, { method: "POST" });
    } catch (err) {
      if (getMockMode()) {
        await delay(150);
        return {
          taskId,
          taskName: "Mock Mission Workbench",
          taskKind: "basic",
          qualified: true,
          rejectionReason: null,
          riskLevel: "low",
          estimatedReward: 100,
          estimatedEnergy: 25,
          estimatedDurationSeconds: 120,
          requiresUserAction: true,
          requiresWallet: false,
          steps: [
            { stepType: "analyze", title: "Analyze task requirements", description: "Briefing requirements.", requiresApproval: false, toolName: "task_scanner" },
            { stepType: "qualify", title: "Check qualification", description: "Validating agent parameters.", requiresApproval: false, toolName: "task_scanner" },
            { stepType: "plan", title: "Generate execution plan", description: "Setting up paths.", requiresApproval: false, toolName: "task_planner" },
            { stepType: "prepare_output", title: "Prepare output", description: "Writing response.", requiresApproval: false, toolName: "basic_writer" },
            { stepType: "wait_user_confirm", title: "Wait for user confirmation", description: "Pause for review.", requiresApproval: true, toolName: null },
            { stepType: "submit", title: "Submit", description: "Recording proof.", requiresApproval: false, toolName: "submission_assistant" },
            { stepType: "verify", title: "Verify", description: "Verifying accuracy.", requiresApproval: false, toolName: "submission_assistant" },
            { stepType: "settle", title: "Settle reward", description: "Granting points.", requiresApproval: false, toolName: null }
          ]
        };
      }
      throw err;
    }
  },

  createWorkRun: async (taskId: string, idempotencyKeyOrOptions?: string | { idempotencyKey?: string; input?: Record<string, unknown> }, legacyInput?: Record<string, unknown>): Promise<{ run: any }> => {
    const body = typeof idempotencyKeyOrOptions === "string"
      ? { idempotencyKey: idempotencyKeyOrOptions, ...(legacyInput ? { input: legacyInput } : {}) }
      : { idempotencyKey: idempotencyKeyOrOptions?.idempotencyKey, ...(idempotencyKeyOrOptions?.input ? { input: idempotencyKeyOrOptions.input } : {}) };
    try {
      return await request<any>(`/tasks/${taskId}/run`, {
        method: "POST",
        body: JSON.stringify(body)
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(250);
        const db = loadMockDB();
        const runId = "run_" + Date.now();
        const newRun = {
          id: runId,
          agentId: db.agent?.id || "agent_mock",
          userId: db.user.id,
          taskId,
          taskKind: "basic",
          status: "waiting_user",
          currentStep: 5,
          totalSteps: 8,
          progress: 50,
          estimatedReward: 120,
          estimatedEnergy: 25,
          actualReward: 0,
          actualEnergy: 0,
          riskLevel: "low",
          requiresUserAction: true,
          settled: false,
          startedAt: new Date().toISOString(),
          completedAt: null,
          failedReason: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        (db as any).activeRun = newRun;
        saveMockDB(db);
        return { run: newRun };
      }
      throw err;
    }
  },

  getWorkRuns: async (agentId: string, status?: string): Promise<{ workRuns: any[] }> => {
    try {
      let url = `/agents/${agentId}/work-runs`;
      if (status) url += `?status=${status}`;
      return await request<any>(url);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        const db = loadMockDB();
        const active = (db as any).activeRun;
        return { workRuns: active ? [active] : [] };
      }
      throw err;
    }
  },

  getActiveWorkRun: async (agentId: string): Promise<{ run: any | null }> => {
    try {
      return await request<any>(`/agents/${agentId}/work-runs/active`);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        const db = loadMockDB();
        return { run: (db as any).activeRun || null };
      }
      throw err;
    }
  },

  getWorkRun: async (runId: string): Promise<{ run: any }> => {
    try {
      return await request<any>(`/work-runs/${runId}`);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        const db = loadMockDB();
        return { run: (db as any).activeRun || null };
      }
      throw err;
    }
  },

  getWorkReport: async (runId: string): Promise<WorkReportResponse> => {
    try {
      return await request<WorkReportResponse>(`/work-runs/${runId}/report`);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { report: null };
      }
      throw err;
    }
  },

  getWorkRunSteps: async (runId: string): Promise<{ steps: any[] }> => {
    try {
      return await request<any>(`/work-runs/${runId}/steps`);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return {
          steps: [
            { id: "s1", runId, stepOrder: 1, stepType: "analyze", title: "Analyze task requirements", description: "Briefing requirements.", status: "completed" },
            { id: "s2", runId, stepOrder: 2, stepType: "qualify", title: "Check qualification", description: "Validating agent parameters.", status: "completed" },
            { id: "s3", runId, stepOrder: 3, stepType: "plan", title: "Generate execution plan", description: "Setting up paths.", status: "completed" },
            { id: "s4", runId, stepOrder: 4, stepType: "prepare_output", title: "Prepare output", description: "Writing response.", status: "completed" },
            { id: "s5", runId, stepOrder: 5, stepType: "wait_user_confirm", title: "Wait for user confirmation", description: "Pause for review.", status: "waiting_approval", requiresApproval: true },
            { id: "s6", runId, stepOrder: 6, stepType: "submit", title: "Submit", description: "Recording proof.", status: "pending" },
            { id: "s7", runId, stepOrder: 7, stepType: "verify", title: "Verify", description: "Verifying accuracy.", status: "pending" },
            { id: "s8", runId, stepOrder: 8, stepType: "settle", title: "Settle reward", description: "Granting points.", status: "pending" }
          ]
        };
      }
      throw err;
    }
  },

  getWorkRunEvents: async (runId: string): Promise<{ events: any[] }> => {
    try {
      return await request<any>(`/work-runs/${runId}/events`);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return {
          events: [
            { id: "e1", agentId: "a1", runId, eventType: "run_created", title: "Plan initiated", message: "Workbench generated step routes.", createdAt: new Date().toISOString() },
            { id: "e2", agentId: "a1", runId, eventType: "step_success", title: "Output ready", message: "Draft prepared. Pending verification.", createdAt: new Date().toISOString() }
          ]
        };
      }
      throw err;
    }
  },

  approveStep: async (runId: string): Promise<{ run: any }> => {
    try {
      return await request<any>(`/work-runs/${runId}/approve-step`, { method: "POST" });
    } catch (err) {
      if (getMockMode()) {
        await delay(200);
        const db = loadMockDB();
        const run = (db as any).activeRun;
        if (run) {
          run.status = "completed";
          run.currentStep = 8;
          run.progress = 100;
          run.actualReward = run.estimatedReward;
          run.actualEnergy = run.estimatedEnergy;
          run.requiresUserAction = false;
          if (db.agent) {
            db.agent.pendingPoints += run.estimatedReward;
            db.agent.energy = Math.max(0, db.agent.energy - run.estimatedEnergy);
          }
          (db as any).activeRun = null; // cleared active run
          saveMockDB(db);
        }
        return { run };
      }
      throw err;
    }
  },

  pauseWorkRun: async (runId: string): Promise<{ run: any }> => {
    try {
      return await request<any>(`/work-runs/${runId}/pause`, { method: "POST" });
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        const db = loadMockDB();
        const run = (db as any).activeRun;
        if (run) {
          run.status = "paused";
          saveMockDB(db);
        }
        return { run };
      }
      throw err;
    }
  },

  resumeWorkRun: async (runId: string): Promise<{ run: any }> => {
    try {
      return await request<any>(`/work-runs/${runId}/resume`, { method: "POST" });
    } catch (err) {
      if (getMockMode()) {
        await delay(150);
        const db = loadMockDB();
        const run = (db as any).activeRun;
        if (run) {
          run.status = "executing";
          saveMockDB(db);
        }
        return { run };
      }
      throw err;
    }
  },

  cancelWorkRun: async (runId: string): Promise<{ run: any }> => {
    try {
      return await request<any>(`/work-runs/${runId}/cancel`, { method: "POST" });
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        const db = loadMockDB();
        const run = (db as any).activeRun;
        if (run) {
          run.status = "cancelled";
          (db as any).activeRun = null;
          saveMockDB(db);
        }
        return { run };
      }
      throw err;
    }
  },

  retryStep: async (runId: string): Promise<{ run: any }> => {
    try {
      return await request<any>(`/work-runs/${runId}/retry-step`, { method: "POST" });
    } catch (err) {
      if (getMockMode()) {
        await delay(150);
        const db = loadMockDB();
        const run = (db as any).activeRun;
        if (run) {
          run.status = "executing";
          saveMockDB(db);
        }
        return { run };
      }
      throw err;
    }
  },

  getAgentWallet: async (agentId: string): Promise<{ wallet: any | null }> => {
    try {
      return await request<any>(`/agents/${agentId}/wallet`);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        const db = loadMockDB();
        return { wallet: (db as any).agentWallet || null };
      }
      throw err;
    }
  },

  linkWallet: async (agentId: string, address: string): Promise<{ wallet: any }> => {
    try {
      return await request<any>(`/agents/${agentId}/wallet/link`, {
        method: "POST",
        body: JSON.stringify({ address })
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(200);
        const db = loadMockDB();
        const wallet = {
          id: "w_mock_" + Date.now(),
          agentId,
          userId: db.user.id,
          chain: "ton",
          network: "testnet",
          address,
          walletType: "observation",
          permissionLevel: 0,
          status: "active",
          spendingLimitDaily: 50,
          spendingUsedToday: 0,
          transactionLimit: 10,
          allowedActions: ["swap"],
          allowedContracts: [],
          withdrawalAddress: null,
          createdAt: new Date().toISOString()
        };
        (db as any).agentWallet = wallet;
        saveMockDB(db);
        return { wallet };
      }
      throw err;
    }
  },

  createWallet: async (agentId: string): Promise<{ wallet: any }> => {
    try {
      return await request<any>(`/agents/${agentId}/wallet`, { method: "POST" });
    } catch (err) {
      if (getMockMode()) {
        return await apiClient.linkWallet(agentId, "EQCD39VS5jcptHL8vMjEXCcBI-ZWd1Y_I6cgH1wGBLHOwZaC");
      }
      throw err;
    }
  },

  pauseWallet: async (agentId: string): Promise<{ wallet: any }> => {
    try {
      return await request<any>(`/agents/${agentId}/wallet/pause`, { method: "POST" });
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        const db = loadMockDB();
        const wallet = (db as any).agentWallet;
        if (wallet) wallet.status = "paused";
        saveMockDB(db);
        return { wallet };
      }
      throw err;
    }
  },

  resumeWallet: async (agentId: string): Promise<{ wallet: any }> => {
    try {
      return await request<any>(`/agents/${agentId}/wallet/resume`, { method: "POST" });
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        const db = loadMockDB();
        const wallet = (db as any).agentWallet;
        if (wallet) wallet.status = "active";
        saveMockDB(db);
        return { wallet };
      }
      throw err;
    }
  },

  updateWalletPolicy: async (agentId: string, policy: any): Promise<{ wallet: any }> => {
    try {
      return await request<any>(`/agents/${agentId}/wallet/policy`, {
        method: "PUT",
        body: JSON.stringify(policy)
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(150);
        const db = loadMockDB();
        const wallet = (db as any).agentWallet;
        if (wallet) {
          wallet.spendingLimitDaily = policy.spendingLimitDaily;
          wallet.transactionLimit = policy.transactionLimit;
          wallet.allowedActions = policy.allowedActions;
          wallet.withdrawalAddress = policy.withdrawalAddress;
        }
        saveMockDB(db);
        return { wallet };
      }
      throw err;
    }
  },

  getWalletTransactions: async (agentId: string): Promise<any> => {
    try {
      return await request<any>(`/agents/${agentId}/wallet/transactions`);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return {
          supported: false,
          mode: "observation",
          reason: "Agentic Wallet is currently in preview-only mode and does not perform active on-chain transactions.",
          transactions: []
        };
      }
      throw err;
    }
  },

  // Reset local preview state (utility helper)
  // PR #5 — Skill Core API methods
  getSkillDefinitions: async (): Promise<{ definitions: any[] }> => {
    try {
      return await request<any>("/skills/definitions");
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { definitions: [] };
      }
      throw err;
    }
  },

  getAgentSkills: async (agentId: string): Promise<{ skills: any[]; slots: any }> => {
    try {
      return await request<any>(`/agents/${agentId}/skills`);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { skills: [], slots: { total: 4, used: 0, free: 4 } };
      }
      throw err;
    }
  },

  learnSkill: async (agentId: string, body: { inventoryItemId: string; idempotencyKey: string; protectionInventoryItemId?: string; protectedLearnedSkillId?: string }): Promise<any> => {
    try {
      return await request<any>(`/agents/${agentId}/skills/learn`, {
        method: "POST",
        body: JSON.stringify(body)
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(200);
        return { result: { operationId: "mock_op", learnedSkill: null, replacedSkill: null, consumedCard: true, consumedProtectionToken: false, skillSlotUsed: 0 } };
      }
      throw err;
    }
  },

  lockSkill: async (agentId: string, learnedSkillId: string, idempotencyKey: string): Promise<any> => {
    try {
      return await request<any>(`/agents/${agentId}/skills/${learnedSkillId}/lock`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey })
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { result: { operationId: "mock_lock", locked: true } };
      }
      throw err;
    }
  },

  unlockSkill: async (agentId: string, learnedSkillId: string, idempotencyKey: string): Promise<any> => {
    try {
      return await request<any>(`/agents/${agentId}/skills/${learnedSkillId}/unlock`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey })
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { result: { operationId: "mock_unlock", unlocked: true } };
      }
      throw err;
    }
  },

  getSkillEvents: async (agentId: string): Promise<{ events: any[] }> => {
    try {
      return await request<any>(`/agents/${agentId}/skill-events`);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { events: [] };
      }
      throw err;
    }
  },

  getSkillEffects: async (): Promise<{ capability: any; slots: any }> => {
    try {
      return await request<any>("/agent/skill-effects");
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { capability: { researchDepth: 1, sourceLimit: 2, verificationLevel: 0 }, slots: { total: 4, used: 0, free: 4 } };
      }
      throw err;
    }
  },
  getSkillRuntimeStatus: async (): Promise<{ runtimeVersion: number; activeRuntimeSkills: number; plannedRuntimeSkills: number; skills: any[] }> => {
    try {
      return await request<any>("/skills/runtime-status");
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { runtimeVersion: 1, activeRuntimeSkills: 0, plannedRuntimeSkills: 31, skills: [] };
      }
      throw err;
    }
  },

  previewSkillRuntime: async (agentId: string, taskType: string, input?: any): Promise<{ taskType: string; selectedSkills: any[]; missingRequiredSkills: string[] }> => {
    try {
      return await request<any>(`/agents/${agentId}/runtime/preview`, {
        method: "POST",
        body: JSON.stringify({ taskType, input })
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { taskType, selectedSkills: [], missingRequiredSkills: [] };
      }
      throw err;
    }
  },

  executeSkillRuntime: async (agentId: string, taskType: string, input: any, idempotencyKey: string): Promise<any> => {
    try {
      return await request<any>(`/agents/${agentId}/runtime/execute`, {
        method: "POST",
        body: JSON.stringify({ taskType, input, idempotencyKey })
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { executionId: "mock_exec", taskType, selectedSkills: [], missingRequiredSkills: [], result: {}, usage: {} };
      }
      throw err;
    }
  },
  listTelegramSources: async (params?: { agentId?: string; status?: TelegramAuthorizedSource["status"] }): Promise<{ sources: TelegramAuthorizedSource[] }> => {
    try {
      const q = new URLSearchParams();
      if (params?.agentId) q.append("agentId", params.agentId);
      if (params?.status) q.append("status", params.status);
      const queryStr = q.toString();
      const path = `/v1/telegram/sources${queryStr ? `?${queryStr}` : ""}`;
      return await request<{ sources: TelegramAuthorizedSource[] }>(path);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { sources: [] };
      }
      throw err;
    }
  },

  createTelegramSource: async (input: { agentId: string; sourceType: string; telegramChatId?: string; telegramChatTitlePreview?: string; permissionScope: string[]; status: string }): Promise<TelegramAuthorizedSource> => {
    try {
      return await request<TelegramAuthorizedSource>("/v1/telegram/sources", {
        method: "POST",
        body: JSON.stringify(input)
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return {
          id: `src_mock_${Date.now()}`,
          agentId: input.agentId,
          sourceType: input.sourceType as any,
          telegramChatTitlePreview: input.telegramChatTitlePreview || "Mock Group",
          permissionScope: input.permissionScope,
          status: input.status as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          revokedAt: null
        };
      }
      throw err;
    }
  },

  updateTelegramSource: async (id: string, input: { status?: string; telegramChatTitlePreview?: string; permissionScope?: string[] }): Promise<TelegramAuthorizedSource> => {
    try {
      return await request<TelegramAuthorizedSource>(`/v1/telegram/sources/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input)
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return {
          id,
          agentId: "mock_agent",
          sourceType: "group",
          telegramChatTitlePreview: input.telegramChatTitlePreview || "Mock Group",
          permissionScope: input.permissionScope || [],
          status: (input.status || "authorized") as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          revokedAt: input.status === "revoked" ? new Date().toISOString() : null
        };
      }
      throw err;
    }
  },

  deleteTelegramSource: async (id: string): Promise<{ ok: boolean; status: string }> => {
    try {
      return await request<{ ok: boolean; status: string }>(`/v1/telegram/sources/${id}`, {
        method: "DELETE"
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { ok: true, status: "revoked" };
      }
      throw err;
    }
  },

  listTelegramOpportunitySignals: async (params?: { agentId?: string; status?: TelegramOpportunitySignal["status"]; signalType?: TelegramOpportunitySignal["signalType"] }): Promise<{ signals: TelegramOpportunitySignal[] }> => {
    try {
      const q = new URLSearchParams();
      if (params?.agentId) q.append("agentId", params.agentId);
      if (params?.status) q.append("status", params.status);
      if (params?.signalType) q.append("signalType", params.signalType);
      const queryStr = q.toString();
      const path = `/v1/telegram/opportunity-signals${queryStr ? `?${queryStr}` : ""}`;
      return await request<{ signals: TelegramOpportunitySignal[] }>(path);
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { signals: [] };
      }
      throw err;
    }
  },

  ignoreTelegramOpportunitySignal: async (id: string): Promise<TelegramOpportunitySignal> => {
    try {
      return await request<TelegramOpportunitySignal>(`/v1/telegram/opportunity-signals/${id}/ignore`, {
        method: "POST"
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { id, status: "ignored" } as any;
      }
      throw err;
    }
  },

  requireUserForTelegramOpportunitySignal: async (id: string): Promise<TelegramOpportunitySignal> => {
    try {
      return await request<TelegramOpportunitySignal>(`/v1/telegram/opportunity-signals/${id}/require-user`, {
        method: "POST"
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return { id, status: "pending_user" } as any;
      }
      throw err;
    }
  },

  convertTelegramOpportunitySignal: async (id: string): Promise<{ signal: TelegramOpportunitySignal; workRun: null; mode: string }> => {
    try {
      return await request<{ signal: TelegramOpportunitySignal; workRun: null; mode: string }>(`/v1/telegram/opportunity-signals/${id}/convert`, {
        method: "POST"
      });
    } catch (err) {
      if (getMockMode()) {
        await delay(100);
        return {
          signal: { id, status: "converted_to_work_run" } as any,
          workRun: null,
          mode: "conversion_state_only"
        };
      }
      throw err;
    }
  },

  resetMockState: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("gb_mock_db");
      saveMockDB(DEFAULT_MOCK_DB);
    }
  }
} as any;
