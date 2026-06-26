import type { AgentProviderAllowlist, AgentModelConfig, AgentPromptTemplate, AgentModelCallLog } from "@growthbot/shared";
export type { AgentProviderAllowlist, AgentModelConfig, AgentPromptTemplate, AgentModelCallLog };

// 管理后台 API client：真实 Worker API 优先，读接口保留本地预览兜底。
export interface AdminMetrics {
  botStarts: string;
  agentClaims: string;
  boxOpens: string;
  groupPools: string;
  marketVolume: string;
  riskFlags: string;
}

export interface AdminUser {
  id: string;
  telegramId: string;
  username: string;
  rankTier: string;
  riskStatus: "normal" | "restricted" | "review";
  score: number;
  pendingPoints?: number;
  agentStatus?: string;
  backpackCount?: number;
  recentTasks?: Array<{ name: string; timestamp: string }>;
  recentTrades?: Array<{ name: string; price: string; timestamp: string }>;
  studioEnabled?: boolean;
  planTier?: string;
}

export interface AuditLog {
  id: string;
  operator: string;
  opType: string;
  targetObject: string;
  beforeValue: string;
  afterValue: string;
  timestamp: string;
  status: "success" | "failed";
}

export interface AdminTask {
  id: string;
  name: string;
  energyCost: number;
  basePendingPoints: number;
  status: "active" | "draft" | "paused";
}

export type BoxKey = "starter" | "alpha" | "crew" | "project" | "wallet";
export type BoxStatus = "active" | "paused" | "draft" | "archived";

export interface AdminBox {
  id: string;
  key: BoxKey;
  name: string;
  status: BoxStatus;
  rarity: "common" | "rare" | "epic" | "legendary" | "genesis";
  totalSupply: number;
  remainingSupply: number;
  dailyRelease: number;
  acquisitionRoute: string;
  startTime: string | null;
  endTime: string | null;
  transferableBeforeOpen: boolean;
  bindingStrategy: "soulbound" | "transferable" | "bind_on_use";
  createdAt: string;
  updatedAt: string;
}

export interface DropPoolItem {
  id: string;
  assetName: string;
  category: "profession" | "skill" | "permit" | "access" | "boost";
  rarity: "common" | "rare" | "epic" | "legendary" | "genesis";
  weight: number;
  minQuantity: number;
  maxQuantity: number;
  usesRemaining?: number;
  expiryHours?: number;
  transferable: boolean;
  soulbound: boolean;
  effect: string;
  requiresWallet: boolean;
  projectId?: string | null;
  metadataJson?: string;
}

export interface AssetDefinition {
  id: string;
  name: string;
  key: string;
  category: "profession" | "skill" | "permit" | "access" | "boost";
  rarity: "common" | "rare" | "epic" | "legendary" | "genesis";
  status: "enabled" | "disabled";
  transferable: boolean;
  defaultExpiryHours: number | null;
  defaultUses: number | null;
  effect: string;
  applicableTasks: string[];
  applicableBoxes: string[];
  requiresWallet: boolean;
}

export interface MarketRules {
  platformFeePercent: number;
  minPrice: string;
  maxPrice: string;
  listingExpiryDays: number;
  allowStarterBoxTrade: boolean;
  allowProjectBoxTrade: boolean;
  marketPaused: boolean;
  cancelRules: string;
}

export interface AdminTrade {
  id: string;
  name: string;
  price: string;
  buyer: string;
  seller: string;
  timestamp: string;
}

export interface AdminFomo {
  rareDrops: Array<{ id: string; boxName: string; rewardName: string; rarity: string; username: string; createdAt: string }>;
  activeListings: number;
  boxSupply: Array<{ key: string; name: string; remaining: number; total: number; rarity: string; route: string; oddsLabel: string }>;
  shareSurfaces: Array<{ key: string; label: string; status: string }>;
  shareEvents: Array<{ eventName: string; count: number }>;
  growthFunnel?: Array<{ key: string; label: string; count: number }>;
  channelBreakdown?: Array<{ source: string; count: number }>;
  shareBreakdown?: Array<{ eventName: string; source: string; count: number }>;
  shareMaterialLeaderboard?: Array<{ source: string; label: string; shares: number; clicks?: number; claims?: number; activations?: number; shareRate: number; activationRate?: number; recommendation: string }>;
  riskSignals?: Array<{ key: string; label: string; count: number }>;
  userTotal?: number;
}

interface AdminState {
  metrics: AdminMetrics;
  users: AdminUser[];
  tasks: AdminTask[];
  boxes: AdminBox[];
  dropPools: Record<string, DropPoolItem[]>;
  assets: AssetDefinition[];
  marketRules: MarketRules;
  trades: AdminTrade[];
  fomo: AdminFomo;
  globalBoxesPaused: boolean;
  globalTasksPaused: boolean;
  auditLogs: AuditLog[];
  bountyTasks: any[];
  bountyVerifications: any[];
  agentConfigs: AgentModelConfig[];
  agentCallLogs: AgentModelCallLog[];
  promptTemplates: AgentPromptTemplate[];
  agentProviders: AgentProviderAllowlist[];
  v1Assets?: any[];
  v1Boxes?: any[];
  v1Orders?: any[];
  v1WorkRuns?: any[];
}

const API_BASE = import.meta.env.VITE_API_BASE ?? (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8787" : "https://api.gb8.top");
const API_TIMEOUT_MS = 6000;
let apiFallbackOccurred = false;

const DEFAULT_STATE: AdminState = {
  metrics: {
    botStarts: "12,480",
    agentClaims: "8,932",
    boxOpens: "7,104",
    groupPools: "312",
    marketVolume: "842 积分",
    riskFlags: "41"
  },
  users: [
    { 
      id: "u_1", 
      telegramId: "123456789", 
      username: "alpha_user", 
      rankTier: "top_20", 
      riskStatus: "normal", 
      score: 980,
      pendingPoints: 120,
      agentStatus: "已激活 (Alpha 侦察员)",
      backpackCount: 5,
      recentTasks: [
        { name: "每日签到", timestamp: "3小时前" },
        { name: "战队助力", timestamp: "5小时前" }
      ],
      recentTrades: [
        { name: "战队加速", price: "9.2 积分", timestamp: "10分钟前" }
      ],
      studioEnabled: true,
      planTier: "pro"
    },
    { 
      id: "u_2", 
      telegramId: "987654321", 
      username: "mission_runner", 
      rankTier: "top_1", 
      riskStatus: "normal", 
      score: 98200,
      pendingPoints: 450,
      agentStatus: "已激活 (任务执行者)",
      backpackCount: 12,
      recentTasks: [
        { name: "每日签到", timestamp: "1小时前" },
        { name: "战队邀请", timestamp: "2小时前" },
        { name: "高倍率高产任务", timestamp: "4小时前" }
      ],
      recentTrades: [
        { name: "项目准入通行证", price: "120 积分", timestamp: "3小时前" }
      ],
      studioEnabled: false,
      planTier: "free"
    },
    { 
      id: "u_3", 
      telegramId: "555666777", 
      username: "sybil_hunter", 
      rankTier: "unranked", 
      riskStatus: "restricted", 
      score: 50,
      pendingPoints: 0,
      agentStatus: "未激活",
      backpackCount: 0,
      recentTasks: [
        { name: "每日签到", timestamp: "2天前" }
      ],
      recentTrades: [],
      studioEnabled: false,
      planTier: "free"
    },
    { 
      id: "u_4", 
      telegramId: "111222333", 
      username: "drop_sniper", 
      rankTier: "top_5", 
      riskStatus: "review", 
      score: 87610,
      pendingPoints: 890,
      agentStatus: "已激活 (钱包操作员)",
      backpackCount: 8,
      recentTasks: [
        { name: "链上签名任务", timestamp: "20分钟前" },
        { name: "每日签到", timestamp: "12小时前" }
      ],
      recentTrades: [
        { name: "Alpha 雷达", price: "45 积分", timestamp: "1小时前" }
      ],
      studioEnabled: true,
      planTier: "pro"
    }
  ],
  tasks: [
    { id: "task_daily_checkin", name: "每日签到", energyCost: 10, basePendingPoints: 100, status: "active" },
    { id: "task_group_pool", name: "提升战队挖矿收益", energyCost: 15, basePendingPoints: 160, status: "active" },
    { id: "task_launch_sniper", name: "创世启动首发锁定", energyCost: 40, basePendingPoints: 620, status: "active" }
  ],
  boxes: [
    { id: "box_starter", key: "starter", name: "启动盒", status: "active", rarity: "common", totalSupply: 2047, remainingSupply: 1488, dailyRelease: 150, acquisitionRoute: "启动赠送", startTime: "2026-06-16T00:00:00Z", endTime: null, transferableBeforeOpen: false, bindingStrategy: "soulbound", createdAt: "2026-06-16T00:00:00Z", updatedAt: "2026-06-16T00:00:00Z" },
    { id: "box_alpha", key: "alpha", name: "Alpha 盒", status: "active", rarity: "rare", totalSupply: 333, remainingSupply: 221, dailyRelease: 20, acquisitionRoute: "任务产出与市场交易", startTime: "2026-06-16T00:00:00Z", endTime: null, transferableBeforeOpen: true, bindingStrategy: "transferable", createdAt: "2026-06-16T00:00:00Z", updatedAt: "2026-06-16T00:00:00Z" },
    { id: "box_crew", key: "crew", name: "战队盒", status: "active", rarity: "epic", totalSupply: 88, remainingSupply: 57, dailyRelease: 5, acquisitionRoute: "战队活跃达标解锁", startTime: "2026-06-16T00:00:00Z", endTime: null, transferableBeforeOpen: true, bindingStrategy: "transferable", createdAt: "2026-06-16T00:00:00Z", updatedAt: "2026-06-16T00:00:00Z" },
    { id: "box_project", key: "project", name: "项目盒", status: "draft", rarity: "legendary", totalSupply: 47, remainingSupply: 47, dailyRelease: 10, acquisitionRoute: "合作项目活动", startTime: "2026-06-16T00:00:00Z", endTime: "2026-07-16T00:00:00Z", transferableBeforeOpen: true, bindingStrategy: "transferable", createdAt: "2026-06-16T00:00:00Z", updatedAt: "2026-06-16T00:00:00Z" },
    { id: "box_wallet", key: "wallet", name: "钱包盒", status: "draft", rarity: "legendary", totalSupply: 100, remainingSupply: 100, dailyRelease: 0, acquisitionRoute: "链上任务准入", startTime: null, endTime: null, transferableBeforeOpen: true, bindingStrategy: "transferable", createdAt: "2026-06-16T00:00:00Z", updatedAt: "2026-06-16T00:00:00Z" }
  ],
  dropPools: {
    box_starter: [
      { id: "dp_s1", assetName: "任务重置", category: "skill", rarity: "common", weight: 45, minQuantity: 1, maxQuantity: 1, usesRemaining: 1, expiryHours: undefined, transferable: true, soulbound: false, effect: "刷新当前任务列表", requiresWallet: false },
      { id: "dp_s2", assetName: "能量恢复", category: "skill", rarity: "common", weight: 20, minQuantity: 1, maxQuantity: 1, usesRemaining: 1, expiryHours: undefined, transferable: true, soulbound: false, effect: "瞬间恢复50点能量值", requiresWallet: false },
      { id: "dp_s3", assetName: "任务执行者", category: "profession", rarity: "common", weight: 25, minQuantity: 1, maxQuantity: 1, usesRemaining: undefined, expiryHours: undefined, transferable: true, soulbound: false, effect: "基础任务自动执行", requiresWallet: false },
      { id: "dp_s4", assetName: "战队加速", category: "skill", rarity: "epic", weight: 10, minQuantity: 1, maxQuantity: 1, usesRemaining: 3, expiryHours: 24, transferable: true, soulbound: false, effect: "提升战队总线开盒效率", requiresWallet: false }
    ],
    box_alpha: [
      { id: "dp_a1", assetName: "Alpha 侦察员", category: "profession", rarity: "rare", weight: 40, minQuantity: 1, maxQuantity: 1, usesRemaining: undefined, expiryHours: undefined, transferable: true, soulbound: false, effect: "发现Alpha高产任务", requiresWallet: false },
      { id: "dp_a2", assetName: "Alpha 雷达", category: "skill", rarity: "rare", weight: 30, minQuantity: 1, maxQuantity: 1, usesRemaining: 5, expiryHours: 72, transferable: true, soulbound: false, effect: "扫描高倍率收益任务", requiresWallet: false },
      { id: "dp_a3", assetName: "钱包任务许可证", category: "permit", rarity: "legendary", weight: 20, minQuantity: 1, maxQuantity: 1, usesRemaining: 1, expiryHours: 24, transferable: true, soulbound: false, effect: "授权一次高安全等级钱包任务", requiresWallet: true },
      { id: "dp_a4", assetName: "钱包操作员", category: "profession", rarity: "legendary", weight: 10, minQuantity: 1, maxQuantity: 1, usesRemaining: undefined, expiryHours: undefined, transferable: true, soulbound: false, effect: "执行链上签名任务", requiresWallet: true }
    ],
    box_crew: [
      { id: "dp_c1", assetName: "战队队长", category: "profession", rarity: "epic", weight: 40, minQuantity: 1, maxQuantity: 1, usesRemaining: undefined, expiryHours: undefined, transferable: true, soulbound: false, effect: "激活战队协同加成", requiresWallet: false },
      { id: "dp_c2", assetName: "战队加速", category: "skill", rarity: "epic", weight: 40, minQuantity: 1, maxQuantity: 1, usesRemaining: 3, expiryHours: 24, transferable: true, soulbound: false, effect: "提升战队总线开盒效率", requiresWallet: false },
      { id: "dp_c3", assetName: "任务重置", category: "skill", rarity: "common", weight: 20, minQuantity: 1, maxQuantity: 1, usesRemaining: 1, expiryHours: undefined, transferable: true, soulbound: false, effect: "刷新当前任务列表", requiresWallet: false }
    ],
    box_project: [
      { id: "dp_p1", assetName: "项目猎人", category: "profession", rarity: "legendary", weight: 30, minQuantity: 1, maxQuantity: 1, usesRemaining: undefined, expiryHours: undefined, transferable: true, soulbound: false, effect: "获取合作方专属白名单任务", requiresWallet: false },
      { id: "dp_p2", assetName: "项目准入通行证", category: "access", rarity: "legendary", weight: 40, minQuantity: 1, maxQuantity: 1, usesRemaining: undefined, expiryHours: 168, transferable: true, soulbound: false, effect: "准入特定项目链上交互", requiresWallet: false },
      { id: "dp_p3", assetName: "准入权重", category: "access", rarity: "genesis", weight: 30, minQuantity: 1, maxQuantity: 1, usesRemaining: undefined, expiryHours: undefined, transferable: false, soulbound: true, effect: "增加未来空投代币分配比重", requiresWallet: false }
    ]
  },
  assets: [
    { id: "ast_1", name: "任务执行者", key: "mission_runner", category: "profession", rarity: "common", status: "enabled", transferable: true, defaultExpiryHours: null, defaultUses: null, effect: "基础任务自动执行", applicableTasks: ["task_daily_checkin"], applicableBoxes: ["box_starter"], requiresWallet: false },
    { id: "ast_2", name: "Alpha 侦察员", key: "alpha_scout", category: "profession", rarity: "rare", status: "enabled", transferable: true, defaultExpiryHours: null, defaultUses: null, effect: "发现Alpha高产任务", applicableTasks: ["task_launch_sniper"], applicableBoxes: ["box_alpha"], requiresWallet: false },
    { id: "ast_3", name: "战队队长", key: "crew_captain", category: "profession", rarity: "epic", status: "enabled", transferable: true, defaultExpiryHours: null, defaultUses: null, effect: "激活战队协同加成", applicableTasks: ["task_group_pool"], applicableBoxes: ["box_crew"], requiresWallet: false },
    { id: "ast_4", name: "钱包操作员", key: "wallet_operator", category: "profession", rarity: "legendary", status: "enabled", transferable: true, defaultExpiryHours: null, defaultUses: null, effect: "执行链上签名任务", applicableTasks: ["task_onchain_snipe"], applicableBoxes: ["box_alpha"], requiresWallet: true },
    { id: "ast_5", name: "市场侦察员", key: "market_scout", category: "profession", rarity: "rare", status: "enabled", transferable: true, defaultExpiryHours: null, defaultUses: null, effect: "监控市场挂单异动", applicableTasks: [], applicableBoxes: [], requiresWallet: false },
    { id: "ast_6", name: "项目猎人", key: "project_hunter", category: "profession", rarity: "legendary", status: "enabled", transferable: true, defaultExpiryHours: null, defaultUses: null, effect: "获取合作方专属白名单任务", applicableTasks: [], applicableBoxes: ["box_project"], requiresWallet: false },
    { id: "ast_7", name: "Alpha 雷达", key: "alpha_radar", category: "skill", rarity: "rare", status: "enabled", transferable: true, defaultExpiryHours: 72, defaultUses: 5, effect: "扫描高倍率收益任务", applicableTasks: ["task_launch_sniper"], applicableBoxes: ["box_alpha"], requiresWallet: false },
    { id: "ast_8", name: "战队加速", key: "crew_boost", category: "skill", rarity: "epic", status: "enabled", transferable: true, defaultExpiryHours: 24, defaultUses: 3, effect: "提升战队总线开盒效率", applicableTasks: ["task_group_pool"], applicableBoxes: ["box_starter", "box_crew"], requiresWallet: false },
    { id: "ast_9", name: "任务重置", key: "task_reroll", category: "skill", rarity: "common", status: "enabled", transferable: true, defaultExpiryHours: null, defaultUses: 1, effect: "刷新当前任务列表", applicableTasks: [], applicableBoxes: ["box_starter", "box_crew"], requiresWallet: false },
    { id: "ast_10", name: "能量恢复", key: "energy_recovery", category: "skill", rarity: "common", status: "enabled", transferable: true, defaultExpiryHours: null, defaultUses: 1, effect: "瞬间恢复50点能量值", applicableTasks: [], applicableBoxes: ["box_starter"], requiresWallet: false },
    { id: "ast_11", name: "项目准入通行证", key: "project_access_pass", category: "access", rarity: "legendary", status: "enabled", transferable: true, defaultExpiryHours: 168, defaultUses: null, effect: "准入特定项目链上交互", applicableTasks: [], applicableBoxes: ["box_project"], requiresWallet: false },
    { id: "ast_12", name: "钱包任务许可证", key: "wallet_task_permit", category: "permit", rarity: "legendary", status: "enabled", transferable: true, defaultExpiryHours: 24, defaultUses: 1, effect: "授权一次高安全等级钱包任务", applicableTasks: ["task_onchain_snipe"], applicableBoxes: ["box_alpha"], requiresWallet: true },
    { id: "ast_13", name: "合作任务通行证", key: "partner_quest_pass", category: "permit", rarity: "rare", status: "enabled", transferable: true, defaultExpiryHours: 48, defaultUses: 3, effect: "执行合作方联名活动任务", applicableTasks: [], applicableBoxes: [], requiresWallet: false },
    { id: "ast_14", name: "准入权重", key: "allowlist_weight", category: "access", rarity: "genesis", status: "enabled", transferable: false, defaultExpiryHours: null, defaultUses: null, effect: "增加未来空投代币分配比重", applicableTasks: [], applicableBoxes: ["box_project"], requiresWallet: false }
  ],
  marketRules: {
    platformFeePercent: 2.5,
    minPrice: "0.1",
    maxPrice: "1000.0",
    listingExpiryDays: 7,
    allowStarterBoxTrade: false,
    allowProjectBoxTrade: true,
    marketPaused: false,
    cancelRules: "挂单可随时由发布者无条件取消，已挂单资产取消后自动退回用户背包，无需扣除手续费。"
  },
  trades: [
    { id: "tr_1", name: "战队加速", price: "9.2", buyer: "alpha_user", seller: "drop_hunter", timestamp: "10分钟前" },
    { id: "tr_2", name: "启动盒", price: "4.5", buyer: "whale_farmer", seller: "chad_farmer", timestamp: "34分钟前" }
  ],
  fomo: {
    rareDrops: [
      { id: "drop_1", boxName: "项目盒", rewardName: "项目准入通行证", rarity: "legendary", username: "ton_sniper", createdAt: "3分钟前" },
      { id: "drop_2", boxName: "战队盒", rewardName: "战队加速", rarity: "epic", username: "mission_runner", createdAt: "7分钟前" }
    ],
    activeListings: 4,
    boxSupply: [
      { key: "starter", name: "启动盒", remaining: 1488, total: 2047, rarity: "common", route: "启动赠送", oddsLabel: "启动资产池" },
      { key: "alpha", name: "Alpha 盒", remaining: 221, total: 333, rarity: "rare", route: "任务产出与市场交易", oddsLabel: "侦察与高级策略资产" },
      { key: "crew", name: "战队盒", remaining: 57, total: 88, rarity: "epic", route: "战队活跃达标解锁", oddsLabel: "战队协同与倍率资产" },
      { key: "project", name: "项目盒", remaining: 47, total: 47, rarity: "legendary", route: "合作项目活动", oddsLabel: "准入权与空投加权资产" }
    ],
    shareSurfaces: [
      { key: "personal_report", label: "个人分享报告", status: "active" },
      { key: "box_report", label: "开盒报告分享", status: "active" },
      { key: "group_invite", label: "战队邀请链接", status: "active" }
    ],
    shareEvents: [
      { eventName: "share_personal_report", count: 18 },
      { eventName: "share_box_report", count: 7 },
      { eventName: "share_group_invite", count: 12 }
    ],
    growthFunnel: [
      { key: "mini_app_opened", label: "打开 Mini App", count: 156 },
      { key: "agent_claimed", label: "领取 Agent", count: 98 },
      { key: "starter_box_opened", label: "开启启动技能包", count: 84 },
      { key: "task_submitted", label: "提交基础任务", count: 62 },
      { key: "task_completed", label: "基础任务通过", count: 55 },
      { key: "bounty_submitted", label: "提交赏金任务", count: 19 },
      { key: "bounty_approved", label: "赏金验收通过", count: 13 },
      { key: "share_completed", label: "完成分享动作", count: 37 },
      { key: "invite_activated", label: "邀请激活", count: 8 },
      { key: "d1_retained", label: "次日留存", count: 11 }
    ],
    channelBreakdown: [
      { source: "home_personal_report", count: 18 },
      { source: "box_open_report", count: 7 },
      { source: "group_pool_invite", count: 12 },
      { source: "skill_card_detail", count: 9 },
      { source: "market_listing_detail", count: 5 }
    ],
    shareBreakdown: [
      { eventName: "share_completed", source: "home_personal_report", count: 18 },
      { eventName: "share_completed", source: "box_open_report", count: 7 },
      { eventName: "share_completed", source: "group_pool_invite", count: 12 },
      { eventName: "share_completed", source: "skill_card_detail", count: 9 },
      { eventName: "share_completed", source: "market_listing_detail", count: 5 }
    ],
    shareMaterialLeaderboard: [
      { source: "home_personal_report", label: "Agent 战报", shares: 18, clicks: 14, claims: 8, activations: 6, shareRate: 35, activationRate: 33, recommendation: "继续作为默认分享入口" },
      { source: "group_pool_invite", label: "战队邀请", shares: 12, clicks: 10, claims: 5, activations: 4, shareRate: 24, activationRate: 33, recommendation: "适合群组裂变活动" },
      { source: "skill_card_detail", label: "技能卡详情", shares: 9, clicks: 7, claims: 4, activations: 3, shareRate: 18, activationRate: 33, recommendation: "优先推稀有卡分享" },
      { source: "box_open_report", label: "开包结果", shares: 7, clicks: 5, claims: 3, activations: 2, shareRate: 14, activationRate: 29, recommendation: "适合开包后即时触发" },
      { source: "market_listing_detail", label: "市场挂单", shares: 5, clicks: 4, claims: 2, activations: 1, shareRate: 10, activationRate: 20, recommendation: "适合低编号/低地板挂单" }
    ],
    riskSignals: [
      { key: "bounty_risk_flagged", label: "赏金人工复核", count: 2 },
      { key: "restricted_users", label: "受限用户", count: 1 }
    ],
    userTotal: 156
  },
  globalBoxesPaused: false,
  globalTasksPaused: false,
  auditLogs: [
    { id: "log_1", operator: "yudeyou0118", opType: "修改市场规则", targetObject: "手续费", beforeValue: "2.5%", afterValue: "3.0%", timestamp: "2026-06-17 11:20:00", status: "success" },
    { id: "log_2", operator: "yudeyou0118", opType: "暂停任务", targetObject: "提升战队挖矿收益", beforeValue: "运行中", afterValue: "已暂停", timestamp: "2026-06-17 10:45:12", status: "success" },
    { id: "log_3", operator: "yudeyou0118", opType: "修改风控状态", targetObject: "@sybil_hunter", beforeValue: "正常", afterValue: "限制用户", timestamp: "2026-06-17 09:12:30", status: "success" }
  ],
  bountyTasks: [],
  bountyVerifications: [],
  agentConfigs: [],
  agentCallLogs: [],
  promptTemplates: [
    {
      id: "tmpl_task_analysis",
      name: "task_analysis",
      scope: "system",
      content: "You are an AI Assistant analyzing a task for GrowthBot. Determine steps, check for requirements/rules, and assess risk. Answer only in JSON matching the schema.",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "tmpl_task_recommendation",
      name: "task_recommendation",
      scope: "system",
      content: "Analyze the list of tasks and recommend them according to preferences. Output a JSON array containing objects with taskId and reason.",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  agentProviders: [
    { id: "prov_openai", name: "OpenAI", baseUrl: "https://api.openai.com", status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "prov_anthropic", name: "Anthropic", baseUrl: "https://api.anthropic.com", status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "prov_deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com", status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "prov_groq", name: "Groq", baseUrl: "https://api.groq.com", status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "prov_dashscope", name: "Aliyuncs DashScope", baseUrl: "https://dashscope.aliyuncs.com", status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "prov_openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai", status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ],
  v1Assets: [],
  v1Boxes: [],
  v1Orders: [],
  v1WorkRuns: []
};

function getAdminState(): AdminState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  const saved = localStorage.getItem("gb_admin_state_v3");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return DEFAULT_STATE;
    }
  }
  return DEFAULT_STATE;
}

function saveAdminState(state: AdminState) {
  if (typeof window !== "undefined") {
    localStorage.setItem("gb_admin_state_v3", JSON.stringify(state));
  }
}

function shouldUseMock(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return params.get("mock") === "true" || localStorage.getItem("gb_admin_force_mock") === "true" || isLocal;
}

function adminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("gb_admin_token");
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (shouldUseMock()) throw new Error("Admin mock mode active");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const headers = new Headers(options?.headers);
    if (!headers.has("content-type") && options?.body) headers.set("content-type", "application/json");
    const token = adminToken();
    if (token) headers.set("x-admin-token", token);

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
    if (!res.ok) throw new Error(`Admin API ${path} returned ${res.status}`);
    return await res.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

function markFallback(error: unknown) {
  if (!shouldUseMock()) {
    throw error;
  }
  apiFallbackOccurred = true;
  console.warn("[管理后台 API] 已回退到本地预览状态。", error);
}

function requireMockWriteFallback(error: unknown): never {
  markFallback(error);
  throw new Error("真实接口写入失败，未保存到线上 D1。请检查登录会话或 API 连通性后重试。");
}

export const adminClient = {
  getApiBase: () => API_BASE,
  hasAdminToken: () => !!adminToken(),
  fallbackOccurred: () => apiFallbackOccurred,
  clearFallback: () => { apiFallbackOccurred = false; },
  isMockMode: shouldUseMock,
  login: async (username: string, password: string): Promise<{ username: string }> => {
    const result = await request<{ accessToken: string; username: string }>("/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    if (typeof window !== "undefined") localStorage.setItem("gb_admin_token", result.accessToken);
    return { username: result.username };
  },
  clearAdminToken: () => {
    if (typeof window !== "undefined") localStorage.removeItem("gb_admin_token");
  },

  getMetrics: async (): Promise<AdminMetrics> => {
    try { return await request<AdminMetrics>("/admin/metrics"); } catch (error) { markFallback(error); return getAdminState().metrics; }
  },

  getUsers: async (): Promise<AdminUser[]> => {
    try { return (await request<{ users: AdminUser[] }>("/admin/users")).users; } catch (error) { markFallback(error); return getAdminState().users; }
  },

  updateUserRisk: async (userId: string, riskStatus: "normal" | "restricted" | "review"): Promise<AdminUser[]> => {
    try {
      await request(`/admin/users/${userId}/risk`, { method: "POST", body: JSON.stringify({ riskStatus }) });
      return (await request<{ users: AdminUser[] }>("/admin/users")).users;
    } catch (error) {
      requireMockWriteFallback(error);
    }
  },

  getTasks: async (): Promise<AdminTask[]> => {
    try { return (await request<{ tasks: AdminTask[] }>("/admin/tasks")).tasks; } catch (error) { markFallback(error); return getAdminState().tasks; }
  },

  createTask: async (name: string, energyCost: number, basePendingPoints: number): Promise<AdminTask[]> => {
    try {
      await request("/admin/tasks", { method: "POST", body: JSON.stringify({ name, energyCost, basePendingPoints }) });
      return (await request<{ tasks: AdminTask[] }>("/admin/tasks")).tasks;
    } catch (error) {
      requireMockWriteFallback(error);
    }
  },

  updateTaskStatus: async (taskId: string, status: "active" | "draft" | "paused"): Promise<AdminTask[]> => {
    try {
      await request(`/admin/tasks/${taskId}/status`, { method: "POST", body: JSON.stringify({ status }) });
      return (await request<{ tasks: AdminTask[] }>("/admin/tasks")).tasks;
    } catch (error) {
      requireMockWriteFallback(error);
    }
  },

  getBoxes: async (): Promise<AdminBox[]> => {
    try { return (await request<{ boxes: AdminBox[] }>("/admin/boxes")).boxes; } catch (error) { markFallback(error); return getAdminState().boxes; }
  },

  createBox: async (box: Omit<AdminBox, "id" | "createdAt" | "updatedAt">): Promise<AdminBox[]> => {
    try {
      await request("/admin/boxes", { method: "POST", body: JSON.stringify(box) });
      return (await request<{ boxes: AdminBox[] }>("/admin/boxes")).boxes;
    } catch (error) {
      requireMockWriteFallback(error);
    }
  },

  updateBox: async (id: string, updatedFields: Partial<AdminBox>): Promise<AdminBox[]> => {
    try {
      await request(`/admin/boxes/${id}`, { method: "POST", body: JSON.stringify(updatedFields) });
      return (await request<{ boxes: AdminBox[] }>("/admin/boxes")).boxes;
    } catch (error) {
      requireMockWriteFallback(error);
    }
  },

  archiveBox: async (id: string): Promise<AdminBox[]> => {
    try {
      await request(`/admin/boxes/${id}/archive`, { method: "POST" });
      return (await request<{ boxes: AdminBox[] }>("/admin/boxes")).boxes;
    } catch (error) {
      requireMockWriteFallback(error);
    }
  },

  updateBoxStatus: async (boxId: string, status: "active" | "draft" | "paused"): Promise<AdminBox[]> => {
    try {
      await request(`/admin/boxes/${boxId}/status`, { method: "POST", body: JSON.stringify({ status }) });
      return (await request<{ boxes: AdminBox[] }>("/admin/boxes")).boxes;
    } catch (error) {
      requireMockWriteFallback(error);
    }
  },

  getDropPool: async (boxId: string): Promise<DropPoolItem[]> => {
    try {
      return (await request<{ items: DropPoolItem[] }>(`/admin/boxes/${boxId}/drop-pool`)).items;
    } catch (error) {
      markFallback(error);
      return getAdminState().dropPools[boxId] || [];
    }
  },

  updateDropPool: async (boxId: string, items: DropPoolItem[]): Promise<DropPoolItem[]> => {
    try {
      await request(`/admin/boxes/${boxId}/drop-pool`, { method: "POST", body: JSON.stringify({ items }) });
      return (await request<{ items: DropPoolItem[] }>(`/admin/boxes/${boxId}/drop-pool`)).items;
    } catch (error) {
      requireMockWriteFallback(error);
    }
  },

  getAssets: async (): Promise<AssetDefinition[]> => {
    try { return (await request<{ assets: AssetDefinition[] }>("/admin/assets")).assets; } catch (error) { markFallback(error); return getAdminState().assets; }
  },

  createAsset: async (asset: Omit<AssetDefinition, "id">): Promise<AssetDefinition[]> => {
    try {
      await request("/admin/assets", { method: "POST", body: JSON.stringify(asset) });
      return (await request<{ assets: AssetDefinition[] }>("/admin/assets")).assets;
    } catch (error) {
      requireMockWriteFallback(error);
    }
  },

  updateAsset: async (id: string, updatedFields: Partial<AssetDefinition>): Promise<AssetDefinition[]> => {
    try {
      await request(`/admin/assets/${id}`, { method: "POST", body: JSON.stringify(updatedFields) });
      return (await request<{ assets: AssetDefinition[] }>("/admin/assets")).assets;
    } catch (error) {
      requireMockWriteFallback(error);
    }
  },

  getMarketRules: async (): Promise<MarketRules> => {
    try { return await request<MarketRules>("/admin/market-rules"); } catch (error) { markFallback(error); return getAdminState().marketRules; }
  },

  updateMarketRules: async (rules: MarketRules): Promise<MarketRules> => {
    try {
      return await request<MarketRules>("/admin/market-rules", { method: "POST", body: JSON.stringify(rules) });
    } catch (error) {
      requireMockWriteFallback(error);
    }
  },

  getTrades: async (): Promise<AdminTrade[]> => {
    try { return (await request<{ trades: AdminTrade[] }>("/admin/marketplace/trades")).trades; } catch (error) { markFallback(error); return getAdminState().trades; }
  },

  getFomo: async (): Promise<AdminFomo> => {
    try { return await request<AdminFomo>("/admin/fomo"); } catch (error) { markFallback(error); return getAdminState().fomo; }
  },

  isBoxesPaused: async (): Promise<boolean> => {
    try { return (await request<{ boxes: AdminBox[] }>("/admin/boxes")).boxes.every(box => box.status === "paused"); } catch (error) { markFallback(error); return getAdminState().globalBoxesPaused; }
  },

  setPauseBoxes: async (paused: boolean): Promise<boolean> => {
    try {
      const result = await request<{ paused: boolean }>("/admin/controls/boxes", { method: "POST", body: JSON.stringify({ paused }) });
      return result.paused;
    } catch (error) {
      requireMockWriteFallback(error);
    }
  },

  isTasksPaused: async (): Promise<boolean> => {
    const tasks = await adminClient.getTasks();
    return tasks.length > 0 && tasks.every(task => task.status === "paused");
  },

  setPauseTasks: async (paused: boolean): Promise<boolean> => {
    try {
      const result = await request<{ paused: boolean }>("/admin/controls/tasks", { method: "POST", body: JSON.stringify({ paused }) });
      return result.paused;
    } catch (error) {
      requireMockWriteFallback(error);
    }
  },

  getAuditLogs: async (): Promise<AuditLog[]> => {
    try {
      return (await request<{ auditLogs: AuditLog[] }>("/admin/audit-logs")).auditLogs;
    } catch (error) {
      markFallback(error);
      return getAdminState().auditLogs;
    }
  },

  createAuditLog: async (log: Omit<AuditLog, "id" | "timestamp">): Promise<AuditLog[]> => {
    try {
      await request("/admin/audit-logs", { method: "POST", body: JSON.stringify(log) });
      return (await request<{ auditLogs: AuditLog[] }>("/admin/audit-logs")).auditLogs;
    } catch (error) {
      requireMockWriteFallback(error);
    }
  },

  getSkillStats: async (): Promise<{
    unlearned: number;
    equipped: number;
    listed: number;
    burned: number;
    expired: number;
    total: number;
  }> => {
    try {
      return await request<any>("/admin/stats/skills");
    } catch (error) {
      markFallback(error);
      return {
        unlearned: 28,
        equipped: 15,
        listed: 8,
        burned: 12,
        expired: 0,
        total: 63
      };
    }
  },

  getTaskVerifications: async (): Promise<any[]> => {
    try {
      return (await request<{ verifications: any[] }>("/admin/task-verifications")).verifications;
    } catch (error) {
      markFallback(error);
      return [
        {
          id: "verif_mock_1",
          task_id: "task_daily_checkin",
          task_name: "加入 TG 官方频道",
          user_id: "user_demo_1",
          username: "drop_hunter",
          link: "https://t.me/GrowthBotOfficial",
          status: "submitted",
          created_at: new Date().toISOString()
        },
        {
          id: "verif_mock_2",
          task_id: "task_launch_sniper",
          task_name: "关注官方推特 X",
          user_id: "user_demo_2",
          username: "ton_sniper",
          link: "https://x.com/growthbot",
          status: "approved",
          created_at: new Date(Date.now() - 3600000).toISOString(),
          verified_at: new Date(Date.now() - 3500000).toISOString()
        }
      ];
    }
  },

  approveTaskVerification: async (verifId: string): Promise<void> => {
    try {
      await request(`/admin/task-verifications/${verifId}/approve`, { method: "POST" });
    } catch (error) {
      requireMockWriteFallback(error);
    }
  },

  rejectTaskVerification: async (verifId: string, feedback: string): Promise<void> => {
    try {
      await request(`/admin/task-verifications/${verifId}/reject`, {
        method: "POST",
        body: JSON.stringify({ feedback })
      });
    } catch (error) {
      requireMockWriteFallback(error);
    }
  },

  getBountyTasks: async (): Promise<any[]> => {
    try {
      return (await request<{ tasks: any[] }>("/admin/bounty/tasks")).tasks;
    } catch (error) {
      markFallback(error);
      const state = getAdminState();
      if (!state.bountyTasks) {
        state.bountyTasks = [
          {
            id: "bounty_task_1",
            title: "关注 GrowthBot 官方推特",
            description: "在推特关注我们的官方账号 @GrowthBot 并提交您的个人主页链接。",
            category: "social",
            platform: "twitter",
            target_url: "https://x.com/growthbot",
            budget_total: 1000,
            budget_remaining: 995,
            reward_points: 500,
            reward_asset_name: null,
            reward_access_pass: null,
            deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
            verification_rule: "^https?:\\/\\/(www\\.)?(twitter|x)\\.com\\/[a-zA-Z0-9_]+$",
            submission_type: "link",
            risk_level: "low",
            owner_type: "official",
            owner_name: "GrowthBot 官方",
            completed_count: 5,
            max_completions: 1000,
            paused_reason: null,
            status: "active",
            created_by_admin: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
      }
      return state.bountyTasks;
    }
  },

  createBountyTask: async (task: any): Promise<void> => {
    try {
      await request("/admin/bounty/tasks", {
        method: "POST",
        body: JSON.stringify(task)
      });
    } catch (error) {
      requireMockWriteFallback(error);
      const state = getAdminState();
      if (!state.bountyTasks) state.bountyTasks = [];
      state.bountyTasks.push({
        ...task,
        target_url: task.targetUrl,
        budget_total: task.budgetTotal,
        budget_remaining: task.budgetTotal,
        reward_points: task.rewardPoints,
        reward_asset_name: task.rewardAssetName,
        reward_access_pass: task.rewardAccessPass,
        verification_rule: task.verificationRule,
        submission_type: task.submissionType || "link",
        risk_level: task.riskLevel || "low",
        owner_name: task.ownerName,
        owner_type: task.ownerType,
        max_completions: task.maxCompletions || 0,
        completed_count: 0,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        settlement_mode: task.settlementMode || "offchain",
        chain_id: task.chainId ? Number(task.chainId) : null,
        escrow_contract: task.escrowContract || null,
        escrow_tx_hash: task.escrowTxHash || null,
        reward_token: task.rewardToken || null,
        reward_token_address: task.rewardTokenAddress || null,
        reward_decimals: task.rewardDecimals ? Number(task.rewardDecimals) : null,
        oracle_mode: task.oracleMode || "format_check",
        dispute_status: task.disputeStatus || "none"
      });
      if (!state.auditLogs) state.auditLogs = [];
      state.auditLogs.unshift({
        id: "audit_" + Math.random(),
        operator: "admin",
        opType: "创建赏金任务",
        targetObject: task.title,
        beforeValue: "-",
        afterValue: JSON.stringify(task),
        timestamp: new Date().toISOString(),
        status: "success"
      });
    }
  },

  adjustBountyBudget: async (taskId: string, budgetTotal: number): Promise<void> => {
    try {
      await request(`/admin/bounty/tasks/${taskId}/budget`, {
        method: "POST",
        body: JSON.stringify({ budgetTotal })
      });
    } catch (error) {
      requireMockWriteFallback(error);
      const state = getAdminState();
      const task = (state.bountyTasks || []).find((t: any) => t.id === taskId);
      if (task) {
        const before = task.budget_total;
        task.budget_total = budgetTotal;
        task.budget_remaining = Math.max(0, budgetTotal - task.completed_count);
        if (!state.auditLogs) state.auditLogs = [];
        state.auditLogs.unshift({
          id: "audit_" + Math.random(),
          operator: "admin",
          opType: "调整赏金任务预算",
          targetObject: task.title,
          beforeValue: `${before}`,
          afterValue: `${budgetTotal}`,
          timestamp: new Date().toISOString(),
          status: "success"
        });
      }
    }
  },

  pauseBountyTask: async (taskId: string, paused: boolean, reason?: string): Promise<void> => {
    try {
      await request(`/admin/bounty/tasks/${taskId}/pause`, {
        method: "POST",
        body: JSON.stringify({ paused, reason })
      });
    } catch (error) {
      requireMockWriteFallback(error);
      const state = getAdminState();
      const task = (state.bountyTasks || []).find((t: any) => t.id === taskId);
      if (task) {
        const before = task.status;
        task.status = paused ? "paused" : "active";
        task.paused_reason = paused ? (reason || "管理员暂停") : null;
        if (!state.auditLogs) state.auditLogs = [];
        state.auditLogs.unshift({
          id: "audit_" + Math.random(),
          operator: "admin",
          opType: paused ? "暂停赏金任务" : "恢复赏金任务",
          targetObject: task.title,
          beforeValue: before,
          afterValue: task.status,
          timestamp: new Date().toISOString(),
          status: "success"
        });
      }
    }
  },

  getBountyVerifications: async (): Promise<any[]> => {
    try {
      return (await request<{ verifications: any[] }>("/admin/bounty/verifications")).verifications;
    } catch (error) {
      markFallback(error);
      const state = getAdminState();
      if (!state.bountyVerifications) {
        state.bountyVerifications = [
          {
            id: "bverif_mock_1",
            bounty_task_id: "bounty_task_1",
            task_title: "关注 GrowthBot 官方推特",
            user_id: "u_1",
            user_username: "alpha_user",
            link: "https://x.com/growthbot",
            status: "submitted",
            risk_flagged: 0,
            feedback: null,
            created_at: new Date().toISOString()
          }
        ];
      }
      return state.bountyVerifications;
    }
  },

  approveBountyVerification: async (id: string): Promise<void> => {
    try {
      await request(`/admin/bounty/verifications/${id}/approve`, { method: "POST" });
    } catch (error) {
      requireMockWriteFallback(error);
      const state = getAdminState();
      const verif = (state.bountyVerifications || []).find((v: any) => v.id === id);
      if (verif) {
        verif.status = "approved";
        verif.reward_granted_at = new Date().toISOString();
        const task = (state.bountyTasks || []).find((t: any) => t.id === verif.bounty_task_id);
        if (task) {
          task.budget_remaining = Math.max(0, task.budget_remaining - 1);
          task.completed_count += 1;
        }
        if (!state.auditLogs) state.auditLogs = [];
        state.auditLogs.unshift({
          id: "audit_" + Math.random(),
          operator: "admin",
          opType: "人工通过赏金验收",
          targetObject: verif.id,
          beforeValue: "submitted",
          afterValue: "approved",
          timestamp: new Date().toISOString(),
          status: "success"
        });
      }
    }
  },

  rejectBountyVerification: async (id: string, feedback: string): Promise<void> => {
    try {
      await request(`/admin/bounty/verifications/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ feedback })
      });
    } catch (error) {
      requireMockWriteFallback(error);
      const state = getAdminState();
      const verif = (state.bountyVerifications || []).find((v: any) => v.id === id);
      if (verif) {
        verif.status = "rejected";
        verif.feedback = feedback;
        if (!state.auditLogs) state.auditLogs = [];
        state.auditLogs.unshift({
          id: "audit_" + Math.random(),
          operator: "admin",
          opType: "人工拒绝赏金验收",
          targetObject: verif.id,
          beforeValue: "submitted",
          afterValue: `rejected (${feedback})`,
          timestamp: new Date().toISOString(),
          status: "success"
        });
      }
    }
  },

  getAgentConfigs: async (): Promise<AgentModelConfig[]> => {
    try {
      const res = await request<{ configs: AgentModelConfig[] }>("/admin/agent/model-configs");
      return res.configs;
    } catch (error) {
      markFallback(error);
      return getAdminState().agentConfigs || [];
    }
  },

  getAgentCallLogs: async (): Promise<AgentModelCallLog[]> => {
    try {
      const res = await request<{ logs: AgentModelCallLog[] }>("/admin/agent/model-call-logs");
      return res.logs;
    } catch (error) {
      markFallback(error);
      return getAdminState().agentCallLogs || [];
    }
  },

  getPromptTemplates: async (): Promise<AgentPromptTemplate[]> => {
    try {
      const res = await request<{ templates: AgentPromptTemplate[] }>("/admin/agent/prompt-templates");
      return res.templates;
    } catch (error) {
      markFallback(error);
      return getAdminState().promptTemplates || [];
    }
  },

  savePromptTemplate: async (name: string, scope: string, content: string): Promise<void> => {
    try {
      await request("/admin/agent/prompt-templates", {
        method: "POST",
        body: JSON.stringify({ name, scope, content })
      });
    } catch (error) {
      requireMockWriteFallback(error);
      const state = getAdminState();
      if (!state.promptTemplates) state.promptTemplates = [];
      const existing = state.promptTemplates.find((t: any) => t.name === name);
      if (existing) {
        existing!.scope = scope;
        existing!.content = content;
        existing!.updatedAt = new Date().toISOString();
      } else {
        state.promptTemplates.push({
          id: "tmpl_" + Math.random().toString(36).substring(2, 9),
          name,
          scope,
          content,
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      saveAdminState(state);
    }
  },

  disableAgentConfig: async (id: string): Promise<void> => {
    try {
      await request(`/admin/agent/model-configs/${id}/disable`, { method: "POST" });
    } catch (error) {
      requireMockWriteFallback(error);
      const state = getAdminState();
      const cfg = (state.agentConfigs || []).find((c: any) => c.id === id);
      if (cfg) {
        cfg!.status = "disabled";
        cfg!.updatedAt = new Date().toISOString();
        saveAdminState(state);
      }
    }
  },

  getProviders: async (): Promise<AgentProviderAllowlist[]> => {
    try {
      const res = await request<{ providers: AgentProviderAllowlist[] }>("/admin/agent/providers");
      return res.providers;
    } catch (error) {
      markFallback(error);
      return getAdminState().agentProviders || [];
    }
  },

  saveProvider: async (name: string, baseUrl: string, status?: string): Promise<void> => {
    try {
      await request("/admin/agent/providers", {
        method: "POST",
        body: JSON.stringify({ name, baseUrl, status })
      });
    } catch (error) {
      requireMockWriteFallback(error);
      const state = getAdminState();
      if (!state.agentProviders) state.agentProviders = [];
      const existing = state.agentProviders.find((p: any) => p.baseUrl === baseUrl);
      const normalizedStatus: "active" | "disabled" = (status === "disabled" ? "disabled" : "active");
      if (existing) {
        existing!.name = name;
        existing!.status = normalizedStatus;
        existing!.updatedAt = new Date().toISOString();
      } else {
        state.agentProviders.push({
          id: "prov_" + Math.random().toString(36).substring(2, 9),
          name,
          baseUrl,
          status: normalizedStatus,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      saveAdminState(state);
    }
  },

  setUserStudioEnabled: async (userId: string, enabled: boolean): Promise<void> => {
    try {
      await request(`/admin/users/${userId}/studio`, {
        method: "POST",
        body: JSON.stringify({ enabled })
      });
    } catch (error) {
      requireMockWriteFallback(error);
      const state = getAdminState();
      const user = state.users.find(u => u.id === userId);
      if (user) {
        user!.studioEnabled = enabled;
        saveAdminState(state);
      }
    }
  },

  getV1Assets: async (): Promise<any[]> => {
    try {
      return (await request<{ assets: any[] }>("/admin/v1/assets")).assets;
    } catch (error) {
      markFallback(error);
      const state = getAdminState();
      if (!state.v1Assets) {
        state.v1Assets = [
          { id: "asset_scout", name: "Alpha Scout", code: "alpha_scout", rarity: "rare", type: "ability", status: "enabled", requiredLevel: 1 },
          { id: "asset_runner", name: "Mission Runner", code: "mission_runner", rarity: "common", type: "ability", status: "enabled", requiredLevel: 1 },
          { id: "asset_captain", name: "Crew Captain", code: "crew_captain", rarity: "epic", type: "ability", status: "enabled", requiredLevel: 1 }
        ];
        saveAdminState(state);
      }
      return state.v1Assets;
    }
  },

  setV1AssetStatus: async (assetId: string, status: "enabled" | "disabled"): Promise<void> => {
    try {
      await request(`/admin/v1/assets/${assetId}/status`, {
        method: "POST",
        body: JSON.stringify({ status })
      });
    } catch (error) {
      requireMockWriteFallback(error);
      const state = getAdminState();
      const asset = (state.v1Assets || []).find((a: any) => a.id === assetId);
      if (asset) {
        asset.status = status;
        saveAdminState(state);
      }
    }
  },

  getV1Boxes: async (): Promise<any[]> => {
    try {
      return (await request<{ boxes: any[] }>("/admin/v1/boxes")).boxes;
    } catch (error) {
      markFallback(error);
      const state = getAdminState();
      if (!state.v1Boxes) {
        state.v1Boxes = [
          { id: "box_starter", name: "Starter Box", code: "starter", priceAmount: 0, status: "active", remainingSupply: 1000, totalSupply: 2047, rarity: "common" },
          { id: "box_alpha", name: "Alpha Box", code: "alpha", priceAmount: 50, status: "active", remainingSupply: 221, totalSupply: 333, rarity: "rare" }
        ];
        saveAdminState(state);
      }
      return state.v1Boxes;
    }
  },

  setV1BoxStatus: async (boxId: string, status: "active" | "paused"): Promise<void> => {
    try {
      await request(`/admin/v1/boxes/${boxId}/status`, {
        method: "POST",
        body: JSON.stringify({ status })
      });
    } catch (error) {
      requireMockWriteFallback(error);
      const state = getAdminState();
      const box = (state.v1Boxes || []).find((b: any) => b.id === boxId);
      if (box) {
        box.status = status;
        saveAdminState(state);
      }
    }
  },

  getV1Orders: async (): Promise<any[]> => {
    try {
      return (await request<{ orders: any[] }>("/admin/v1/orders")).orders;
    } catch (error) {
      markFallback(error);
      const state = getAdminState();
      if (!state.v1Orders) {
        state.v1Orders = [
          { id: "order_1", userId: "user_demo_1", username: "drop_hunter", boxProductId: "box_alpha", boxName: "Alpha Box", priceAmount: 50, status: "completed", createdAt: new Date().toISOString() }
        ];
        saveAdminState(state);
      }
      return state.v1Orders;
    }
  },

  getV1WorkRuns: async (status?: string): Promise<any[]> => {
    try {
      const url = status ? `/admin/v1/work-runs?status=${encodeURIComponent(status)}` : "/admin/v1/work-runs";
      return (await request<{ workRuns: any[] }>(url)).workRuns;
    } catch (error) {
      markFallback(error);
      const state = getAdminState();
      if (!state.v1WorkRuns) {
        state.v1WorkRuns = [
          { id: "run_1", agentId: "agent_demo", taskId: "task_daily_checkin", status: "completed", currentStep: 3, totalSteps: 3, progress: 100, createdAt: new Date().toISOString() },
          { id: "run_2", agentId: "agent_demo", taskId: "task_launch_sniper", status: "paused", currentStep: 1, totalSteps: 4, progress: 25, createdAt: new Date(Date.now() - 3600000).toISOString() }
        ];
        saveAdminState(state);
      }
      if (status) {
        return state.v1WorkRuns.filter((r: any) => r.status === status);
      }
      return state.v1WorkRuns;
    }
  }
};
