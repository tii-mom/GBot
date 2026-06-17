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
  Rarity
} from "@growthbot/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8787" : "https://api.gb8.top");

export let fallbackOccurred = false;
export function clearFallbackOccurred() {
  fallbackOccurred = false;
}

// Helper to determine if we should run in Mock Fallback Mode
export function getMockMode(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("mock") === "true" || localStorage.getItem("gb_force_mock") === "true";
}

export function setMockMode(active: boolean) {
  if (typeof window !== "undefined") {
    localStorage.setItem("gb_force_mock", active ? "true" : "false");
  }
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

const DEFAULT_MOCK_DB: MockDB = {
  user: {
    id: "user_mock",
    telegramId: "123456789",
    username: "alpha_user",
    languageCode: "en",
    rankTier: "top_20",
    riskStatus: "normal",
    hasAgent: false // Starts with NO agent for first session experience!
  },
  agent: null,
  inventory: [],
  tasks: [
    {
      id: "task_daily_checkin",
      name: "Daily Check-in",
      energyCost: 10,
      basePendingPoints: 100,
      projectId: null,
      requiresWallet: false,
      autoExecutable: true,
      endsAt: null
    },
    {
      id: "task_group_pool",
      name: "Boost Crew Mission",
      energyCost: 15,
      basePendingPoints: 160,
      projectId: null,
      requiresWallet: false,
      autoExecutable: true,
      endsAt: new Date(Date.now() + 43200000).toISOString()
    },
    {
      id: "task_launch_sniper",
      name: "Genesis Alpha Radar",
      energyCost: 40,
      basePendingPoints: 620,
      projectId: "project_genesis",
      projectName: "Genesis Pool",
      requiresWallet: false,
      autoExecutable: true,
      requiredAbility: "Alpha Radar",
      endsAt: new Date(Date.now() + 7200000).toISOString()
    },
    {
      id: "task_onchain_snipe",
      name: "Run Wallet Mission",
      energyCost: 50,
      basePendingPoints: 950,
      projectId: "project_airdrop",
      projectName: "TON Airdrop",
      requiresWallet: true, // Requires wallet!
      autoExecutable: false,
      endsAt: null
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
      { key: "starter", name: "Starter Box", remaining: 1488, total: 2047, rarity: "common", route: "Free claim", oddsLabel: "Starter asset pool" },
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

function loadMockDB(): MockDB {
  if (typeof window === "undefined") return DEFAULT_MOCK_DB;
  const saved = localStorage.getItem("gb_mock_db");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return DEFAULT_MOCK_DB;
    }
  }
  return DEFAULT_MOCK_DB;
}

function saveMockDB(db: MockDB) {
  if (typeof window !== "undefined") {
    localStorage.setItem("gb_mock_db", JSON.stringify(db));
  }
}

// Helper for simulated network delay in mock mode
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const API_TIMEOUT_MS = 6000;

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

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Server returned error code: ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (!getMockMode()) {
      fallbackOccurred = true;
    }
    console.warn(`[API Client] Network error fetching ${path}. Falling back to mock database.`, err);
    throw err; // Bubbled up to be caught by the caller who will delegate to local handler
  } finally {
    clearTimeout(timeout);
  }
}

export const apiClient = {
  getMe: async (): Promise<MeResponse> => {
    try {
      return await request<MeResponse>("/me");
    } catch {
      await delay(200);
      const db = loadMockDB();
      return { user: db.user, agent: db.agent };
    }
  },

  claimAgent: async (): Promise<{ agent: Agent; starterBox: InventoryItem }> => {
    try {
      return await request<{ agent: Agent; starterBox: InventoryItem }>("/agents/claim", { method: "POST" });
    } catch {
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
      };

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
      db.inventory = [starterBox];
      saveMockDB(db);

      return { agent: newAgent, starterBox };
    }
  },

  getInventory: async (): Promise<{ items: InventoryItem[] }> => {
    try {
      const res = await request<{ items: InventoryItem[] }>("/inventory");
      // Align response key with spec if needed
      return res;
    } catch {
      await delay(100);
      const db = loadMockDB();
      return { items: db.inventory };
    }
  },

  getFomoSnapshot: async (): Promise<FomoSnapshot> => {
    try {
      return await request<FomoSnapshot>("/fomo/snapshot");
    } catch {
      await delay(100);
      const db = loadMockDB();
      return db.fomo;
    }
  },

  trackEvent: async (eventName: string, source: string, properties: Record<string, unknown> = {}): Promise<void> => {
    try {
      await request<{ ok: boolean }>("/analytics/events", {
        method: "POST",
        body: JSON.stringify({ eventName, source, properties }),
        headers: { "content-type": "application/json" }
      });
    } catch {
      const db = loadMockDB();
      if (eventName === "share_personal_report" && db.fomo.shareStats) db.fomo.shareStats.personalReports += 1;
      if (eventName === "share_box_report" && db.fomo.shareStats) db.fomo.shareStats.boxReports += 1;
      if (eventName === "share_group_invite" && db.fomo.shareStats) db.fomo.shareStats.groupInvites += 1;
      saveMockDB(db);
    }
  },

  openBox: async (inventoryItemId: string): Promise<{
    openingId: string;
    box: { id: string; name: string };
    rewards: Array<{ type: string; amount?: number; itemId?: string; name?: string; rarity?: Rarity; category?: InventoryItem["category"] }>;
    agent: Agent;
  }> => {
    try {
      return await request<any>(`/boxes/${inventoryItemId}/open`, { method: "POST" });
    } catch {
      await delay(500);
      const db = loadMockDB();
      if (!db.agent) throw new Error("No agent claimed.");

      const item = db.inventory.find(i => i.id === inventoryItemId);
      if (!item) throw new Error("Item not found");

      // Burn box
      db.inventory = db.inventory.filter(i => i.id !== inventoryItemId);

      // Starter vs Alpha Box rewards
      let rewards;
      if (item.name === "Starter Box") {
        rewards = [
          { type: "pending_points", amount: 300 },
          { type: "energy", amount: 50 },
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
          { type: "pending_points", amount: 1200 },
          { type: "energy", amount: 35 },
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
          { type: "pending_points", amount: 2400 },
          {
            type: "ability",
            itemId: "item_project_ticket_" + Date.now(),
            name: "Project Access Pass",
            rarity: "legendary" as Rarity,
            category: "access" as const
          }
        ];
      } else {
        rewards = [
          { type: "pending_points", amount: 800 },
          {
            type: "ability",
            itemId: "item_sniper_access_" + Date.now(),
            name: "Alpha Radar",
            rarity: "rare" as Rarity,
            category: "skill" as const
          }
        ];
      }

      // Add minted abilities to inventory
      rewards.forEach(r => {
        if (r.type === "ability" && r.itemId) {
          db.inventory.push({
            id: r.itemId,
            type: "ability",
            name: r.name || "Mission Skill",
            rarity: r.rarity || "common",
            transferable: item.name !== "Starter Box", // starter box abilities are soulbound/non-transferable
            status: "available",
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            usesRemaining: 1,
            category: r.category
          });
        }
      });

      // Update agent
      const pointsReward = rewards.find(r => r.type === "pending_points")?.amount || 0;
      const energyReward = rewards.find(r => r.type === "energy")?.amount || 0;
      const abilityReward = rewards.find(r => r.type === "ability");
      if (abilityReward?.name) {
        db.fomo.recentDrops.unshift({
          id: "drop_" + Date.now(),
          boxName: item.name,
          rewardName: abilityReward.name,
          rarity: abilityReward.rarity || "common",
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
  },

  getTasks: async (): Promise<{ tasks: Task[] }> => {
    try {
      return await request<{ tasks: Task[] }>("/tasks/available");
    } catch {
      await delay(100);
      const db = loadMockDB();
      return { tasks: db.tasks };
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
    } catch {
      await delay(600);
      const db = loadMockDB();
      if (!db.agent) throw new Error("No agent claimed.");

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
  },

  getLeaderboard: async (scope: string, period: string): Promise<{
    scope: string;
    period: string;
    currentUser: { rank: number; rankTier: string; pointsToNextTier: number };
    rows: LeaderboardRow[];
  }> => {
    try {
      return await request<any>(`/leaderboard?scope=${scope}&period=${period}`);
    } catch {
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
  },

  joinGroupPool: async (telegramGroupId: string, startParam?: string): Promise<{ pool: GroupPool }> => {
    try {
      return await request<{ pool: GroupPool }>("/groups/pools/join", {
        method: "POST",
        body: JSON.stringify({ telegramGroupId, startParam }),
        headers: { "content-type": "application/json" }
      });
    } catch {
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
  },

  getMarketplaceListings: async (): Promise<{
    stats: { floorPrice: string; volume24h: string; currency: string; floorMove24h?: string; activeListings?: number };
    listings: MarketplaceListing[];
    recentTrades: Array<{ id: string; name: string; price: string; buyer: string }>;
    marketSections?: Array<{ key: string; title: string; listingIds: string[] }>;
  }> => {
    try {
      return await request<any>("/marketplace/listings");
    } catch {
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
  },

  listMarketplaceItem: async (inventoryItemId: string, price: string): Promise<{ listing: MarketplaceListing }> => {
    try {
      return await request<{ listing: MarketplaceListing }>("/marketplace/listings", {
        method: "POST",
        body: JSON.stringify({ inventoryItemId, price, currency: "POINT_TEST", expiresAt: new Date(Date.now() + 86400000).toISOString() }),
        headers: { "content-type": "application/json" }
      });
    } catch {
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
  },

  buyMarketplaceItem: async (listingId: string): Promise<{
    tradeId: string;
    item: { id: string; ownerUserId: string };
    fee: string;
  }> => {
    try {
      return await request<any>(`/marketplace/listings/${listingId}/buy`, { method: "POST" });
    } catch {
      await delay(300);
      const db = loadMockDB();
      if (!db.agent) throw new Error("No agent claimed.");

      const listing = db.listings.find(l => l.id === listingId);
      if (!listing) throw new Error("Listing not found");

      const priceVal = parseFloat(listing.price);
      if (db.agent.pendingPoints < priceVal) {
        throw new Error("Insufficient Pending Points");
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
    } catch {
      await delay(200);
      const db = loadMockDB();
      const item = db.inventory.find(i => i.id === itemId);
      if (!item) throw new Error("Skill card not found in inventory");
      item.status = "active";
      item.transferable = false;
      saveMockDB(db);
      return { item };
    }
  },

  submitTaskVerification: async (taskId: string, link: string): Promise<{ status: string; link: string }> => {
    try {
      return await request<{ status: string; link: string }>(`/tasks/${taskId}/submit`, {
        method: "POST",
        body: JSON.stringify({ link }),
        headers: { "content-type": "application/json" }
      });
    } catch {
      await delay(200);
      return { status: "submitted", link };
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
    } catch {
      await delay(400);
      const db = loadMockDB();
      if (!db.agent) throw new Error("No agent claimed.");

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
  },

  getTaskVerificationStatus: async (taskId: string): Promise<{
    status: string;
    link?: string;
    feedback?: string;
    createdAt?: string;
  }> => {
    try {
      return await request<{ status: string; link?: string; feedback?: string; createdAt?: string }>(`/tasks/${taskId}/status`);
    } catch {
      await delay(100);
      return { status: "pending" };
    }
  },

  // Reset local preview state (utility helper)
  resetMockState: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("gb_mock_db");
      saveMockDB(DEFAULT_MOCK_DB);
    }
  }
};
