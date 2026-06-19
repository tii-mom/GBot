import React, { useEffect, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  Pickaxe,
  Package,
  Zap,
  Users,
  ShoppingBag,
  Languages,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import type {
  Agent,
  FomoSnapshot,
  InventoryItem,
  MarketplaceListing,
  MeResponse,
  Task,
  User,
  LeaderboardRow
} from "@growthbot/shared";

import { telegramAdapter } from "./telegramAdapter";
import { apiClient, getMockMode, setMockMode, fallbackOccurred, clearFallbackOccurred } from "./apiClient";
import { HomeView } from "./components/HomeView";
import { BoxOpeningView } from "./components/BoxOpeningView";
import { InventoryView } from "./components/InventoryView";
import { EarnView } from "./components/EarnView";
import { LeaderboardView } from "./components/LeaderboardView";
import { GroupPoolView } from "./components/GroupPoolView";
import { MarketplaceView } from "./components/MarketplaceView";
import { AgentStudioView } from "./components/AgentStudioView";
import { createTranslator, detectLocale, getLocaleLabel, translateAssetName, type Locale } from "./i18n";
import "./styles.css";

const SUPPORTED_LOCALES: Locale[] = ["en", "zh-CN", "ko"];

function App() {
  // Safe App States
  const [user, setUser] = useState<User | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [recentTrades, setRecentTrades] = useState<Array<{ id: string; name: string; price: string; buyer: string }>>([]);
  const [marketStats, setMarketStats] = useState({ floorPrice: "12.5", volume24h: "842.0", currency: "GP" });
  const [fomoSnapshot, setFomoSnapshot] = useState<FomoSnapshot | null>(null);
  const [joinedPool, setJoinedPool] = useState<any>(null);

  const [activeTab, setActiveTab] = useState("agent");
  const [showStudio, setShowStudio] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [hasWallet, setHasWallet] = useState(false);
  const [mockActive, setMockActive] = useState(getMockMode());
  const [showUnboxingOverlay, setShowUnboxingOverlay] = useState(false);
  const [initialBoxId, setInitialBoxId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiFailed, setApiFailed] = useState(false);
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window === "undefined") return "en";
    return (localStorage.getItem("gb_locale") as Locale | null) || detectLocale(telegramAdapter.getUser().languageCode || navigator.language);
  });
  const t = createTranslator(locale);

  const cycleLocale = () => {
    const nextLocale = SUPPORTED_LOCALES[(SUPPORTED_LOCALES.indexOf(locale) + 1) % SUPPORTED_LOCALES.length] || "en";
    setLocale(nextLocale);
    localStorage.setItem("gb_locale", nextLocale);
    telegramAdapter.hapticImpact("light");
  };

  // Load and cache all resources
  const loadAllData = useCallback(async () => {
    setLoading(true);
    clearFallbackOccurred();
    setApiFailed(false);
    try {
      // 1. Authenticate user via Telegram initData
      const startParam = telegramAdapter.getStartParam();
      const initData = typeof window !== "undefined" && window.Telegram?.WebApp?.initData ? window.Telegram.WebApp.initData : "";
      
      let meData;
      if (initData) {
        meData = await apiClient.loginOrRegister(initData, startParam);
      } else {
        meData = await apiClient.getMe();
      }
      setUser(meData.user);
      setAgent(meData.agent);

      // 3. Fetch Inventory
      const invData = await apiClient.getInventory();
      setInventory(invData.items);

      // 4. Fetch Tasks
      const tasksData = await apiClient.getTasks();
      setTasks(tasksData.tasks);

      // 5. Fetch Marketplace
      const marketData = await apiClient.getMarketplaceListings();
      setListings(marketData.listings);
      setRecentTrades(marketData.recentTrades);
      if (marketData.stats) {
        setMarketStats(marketData.stats);
      }

      const fomoData = await apiClient.getFomoSnapshot();
      setFomoSnapshot(fomoData);
    } catch (err) {
      console.error("Failed to load backend data", err);
      setStatusText(t("top.apiFailed", "无法连接 GrowthBot API，已启用本地沙盒。"));
    } finally {
      setLoading(false);
      setApiFailed(fallbackOccurred);
    }
  }, []);

  // Initialize
  useEffect(() => {
    telegramAdapter.init();
    loadAllData();
  }, [loadAllData]);

  // Toggle Mock Fallback explicitly
  const toggleMock = (val: boolean) => {
    setMockMode(val);
    setMockActive(val);
    clearFallbackOccurred();
    setApiFailed(false);
    telegramAdapter.showAlert(
      val 
        ? t("top.mockOn", "已切换到离线预览模式，数据会保存在本地。")
        : t("top.mockOff", "已切换到接口模式，正在连接服务。")
    );
    loadAllData();
  };

  // Claim Free Agent action
  const handleClaimAgent = async () => {
    telegramAdapter.hapticImpact("heavy");
    try {
      const data = await apiClient.claimAgent();
      setAgent(data.agent);
      if (user) {
        setUser({ ...user, hasAgent: true });
      }
      // Reload inventory (contains Starter Box)
      const inv = await apiClient.getInventory();
      setInventory(inv.items);
      setStatusText(t("home.claimed", "免费 Agent 已领取！打开启动盒开始。"));
      
      // Auto redirect to unboxing
      setInitialBoxId(null);
      setShowUnboxingOverlay(true);
    } catch (err: any) {
      telegramAdapter.showAlert(err.message || t("home.claimFailed", "领取 Agent 失败"));
    }
  };

  // Open box action
  const handleOpenBox = async (boxItemId: string) => {
    try {
      const data = await apiClient.openBox(boxItemId);
      setAgent(data.agent);
      // Reload inventory
      const inv = await apiClient.getInventory();
      setInventory(inv.items);
      setStatusText(`${translateAssetName(t, data.box.name)}${t("home.opened", "已打开，奖励已到账。")}`);
      return data;
    } catch (err: any) {
      telegramAdapter.showAlert(err.message || t("box.errorTitle", "技能激活失败"));
      return null;
    }
  };

  const handleOpenBoxFromInventory = (boxItemId: string) => {
    setInitialBoxId(boxItemId);
    setShowUnboxingOverlay(true);
  };

  // Execute task (run Missions for Points)
  const handleExecuteTask = async (taskId: string, abilityItemId?: string) => {
    try {
      const abilityIds = abilityItemId ? [abilityItemId] : [];
      const res = await apiClient.runFarm([taskId], abilityIds);
      setAgent(res.agent);
      // Update inventory and status text
      const inv = await apiClient.getInventory();
      setInventory(inv.items);
      setStatusText(`${t("home.taskDone", "任务完成！获得")} +${res.pendingPointsEarned} GP。`);
    } catch (err: any) {
      telegramAdapter.showAlert(err.message || t("earn.failed", "任务执行失败。"));
    }
  };

  // Activate ability
  const handleUseAbility = async (itemId: string) => {
    try {
      telegramAdapter.hapticImpact("medium");
      await apiClient.learnSkillCard(itemId);
      telegramAdapter.showAlert(t("home.abilityActive", "技能已激活！会应用到后续任务执行中。"));
      await loadAllData();
    } catch (err: any) {
      telegramAdapter.showAlert(err.message || t("inv.useFailed", "技能装备失败"));
    }
  };

  const handleUnequipAbility = async (itemId: string) => {
    try {
      telegramAdapter.hapticImpact("medium");
      await apiClient.unequipSkillCard(itemId);
      telegramAdapter.showAlert(t("inv.unequippedToast", "技能卡已卸下，24 小时冷却后可恢复交易。"));
      await loadAllData();
    } catch (err: any) {
      telegramAdapter.showAlert(err.message || t("inv.unequipFailed", "卸下技能失败"));
    }
  };

  // List item to marketplace
  const handleListMarketplace = async (itemId: string, price: string) => {
    await apiClient.listMarketplaceItem(itemId, price);
    // Reload listings and inventory
    const inv = await apiClient.getInventory();
    setInventory(inv.items);
    const mkt = await apiClient.getMarketplaceListings();
    setListings(mkt.listings);
  };

  // Buy listed item
  const handleBuyItem = async (listingId: string) => {
    await apiClient.buyMarketplaceItem(listingId);
    // Reload listings, inventory, and stats
    const me = await apiClient.getMe();
    setAgent(me.agent);
    const inv = await apiClient.getInventory();
    setInventory(inv.items);
    const mkt = await apiClient.getMarketplaceListings();
    setListings(mkt.listings);
    setRecentTrades(mkt.recentTrades);
  };

  // Cancel listed item (mock/local fallback action)
  const handleCancelListing = async (listingId: string) => {
    await apiClient.cancelMarketplaceItem(listingId);
    // Reload lists
    const inv = await apiClient.getInventory();
    setInventory(inv.items);
    const mkt = await apiClient.getMarketplaceListings();
    setListings(mkt.listings);
  };

  // Connect isolated wallet mock trigger
  const handleConnectWallet = () => {
    telegramAdapter.hapticImpact("medium");
    telegramAdapter.showConfirm(
      t("home.walletConfirm", "开启 TON Agentic Wallet 升级？\n\n这会准备一个隔离的执行账户，用于后续需要用户授权的钱包任务。你可以随时暂停并设置限制。"),
      (ok) => {
        if (ok) {
          setHasWallet(true);
          telegramAdapter.showAlert(t("home.walletUnlocked", "Agentic Wallet 升级已开启。"));
        }
      }
    );
  };

  // Join group mining pool
  const handleJoinPool = async (telegramGroupId: string) => {
    const data = await apiClient.joinGroupPool(telegramGroupId);
    setJoinedPool(data.pool);
  };

  // Reset Mock State
  const handleResetState = () => {
    apiClient.resetMockState();
    setHasWallet(false);
    telegramAdapter.showAlert(t("top.resetDone", "本地预览状态已重置。"));
    loadAllData();
  };

  // Fetch Leaderboard callback
  const handleFetchLeaderboard = useCallback(async (scope: "global" | "group"): Promise<LeaderboardRow[]> => {
    const board = await apiClient.getLeaderboard(scope, "daily");
    return board.rows;
  }, []);

  const activeAbilities = inventory
    .filter((i) => i.type === "ability" && i.status === "active")
    .map((i) => i.name);

  // Quick navigation helpers
  const navigateToEarn = () => setActiveTab("earn");

  // Renders the correct view component based on active tab
  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="loading-container text-center pad-40">
          <RefreshCw className="spinning-icon icon-margin text-emerald" size={32} />
          <p className="muted">{t("top.loading", "正在读取 Agent 数据...")}</p>
        </div>
      );
    }

    if (!user) {
      return (
        <div className="loading-container text-center pad-40">
          <p className="text-danger">{t("top.sessionFailed", "无法验证会话资料。")}</p>
        </div>
      );
    }

    switch (activeTab) {
      case "agent":
        return (
          <HomeView
            user={user}
            agent={agent}
            onClaimAgent={handleClaimAgent}
            onFarm={async (taskIds, abilityItemIds) => {
              // Trigger multi-Mission run
              const taskId = taskIds[0];
              if (taskId) {
                await handleExecuteTask(taskId, abilityItemIds[0]);
              }
            }}
            availableTasksCount={tasks.length}
            activeAbilities={activeAbilities}
            pointsToNextTier={680}
            triggerMockRefill={() => {
              if (agent) {
                setAgent({ ...agent, energy: agent.maxEnergy });
                telegramAdapter.showAlert(t("home.demoRefill", "能量已补满（演示补能）。"));
              }
            }}
            statusText={statusText}
            fomoSnapshot={fomoSnapshot}
            t={t}
            onOpenStudio={() => setShowStudio(true)}
            onNavigateToRank={() => {
              setActiveTab("rank");
              telegramAdapter.hapticImpact("light");
            }}
          />
        );
      case "inventory":
        return (
          <InventoryView
            items={inventory}
            onOpenBox={handleOpenBoxFromInventory}
            onUseAbility={handleUseAbility}
            onUnequipAbility={handleUnequipAbility}
            onListMarketplace={handleListMarketplace}
            t={t}
          />
        );
      case "earn":
        return (
          <EarnView
            tasks={tasks}
            agent={agent}
            inventory={inventory}
            onExecuteTask={handleExecuteTask}
            onConnectWallet={handleConnectWallet}
            hasWallet={hasWallet}
            t={t}
            onRefreshData={loadAllData}
          />
        );
      case "pool":
        return (
          <GroupPoolView
            joinedPool={joinedPool}
            fomoSnapshot={fomoSnapshot}
            onJoinPool={handleJoinPool}
            onNavigateToEarn={navigateToEarn}
            t={t}
          />
        );
      case "market":
        return (
          <MarketplaceView
            stats={marketStats}
            listings={listings}
            recentTrades={recentTrades}
            trendingItems={fomoSnapshot?.trendingItems || []}
            marketSections={fomoSnapshot?.marketSections || []}
            boxSupply={fomoSnapshot?.boxSupply || []}
            onNavigateToEarn={navigateToEarn}
            currentUserUsername={user.username}
            onBuyItem={handleBuyItem}
            onCancelListing={handleCancelListing}
            t={t}
          />
        );
      case "rank":
        return (
          <LeaderboardView
            currentUserRank={{
              rank: 4821,
              rankTier: agent?.rankTier || "unranked",
              pointsToNextTier: 680
            }}
            onFetchLeaderboard={handleFetchLeaderboard}
            onNavigateToEarn={navigateToEarn}
            agent={agent}
            t={t}
          />
        );
      default:
        return <p>{t("top.viewMissing", "视图不存在。")}</p>;
    }
  };

  const hasBoxes = inventory.some((i) => i.type === "box" && i.status === "available");
  const showDevControls = mockActive || (typeof window !== "undefined" && window.location.hostname === "localhost");

  return (
    <main className="app-shell flex-column">
      {/* Dev Controller Switcher (Top of the app preview) */}
      {showDevControls && (
        <div className="dev-banner-controller">
          <div className="dev-left">
            <span>{t("top.mode", "Mode")}: <strong>{mockActive ? t("top.mockMode", "Mock Mode") : t("top.apiLive", "API Live")}</strong></span>
            <button className="reset-dev-btn" onClick={handleResetState}>{t("top.reset", "Reset DB")}</button>
          </div>
          <div className="dev-right">
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={mockActive} 
                onChange={(e) => toggleMock(e.target.checked)} 
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>
      )}

      {apiFailed && (
        <div className="api-failed-banner animate-fade-in">
          <AlertTriangle size={14} />
          <span>{t("top.apiFailed", "无法连接 GrowthBot API，已启用本地沙盒。")}</span>
        </div>
      )}

      {/* App Shell Top Header */}
      <header className="topbar">
        <div>
          <span className="eyebrow uppercase">GrowthBot V0</span>
          <h1>{t("top.title", "你的 Agent 网络")}</h1>
        </div>
        <div className="topbar-actions">
          <button className="language-switcher" onClick={cycleLocale} aria-label={t("top.lang", "Language")}> 
            <Languages size={16} />
            <span>{getLocaleLabel(locale)}</span>
          </button>
          <div className="topbar-logo-ring">
            <img src="/growthbot-logo.png" alt="GrowthBot" className="brand-logo-img top-logo animate-glow" />
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <section className="app-main-content">
        {renderTabContent()}
      </section>

      {/* Bottom Main Action Bar Triggered by Box Overlay */}
      {showUnboxingOverlay && (
        <BoxOpeningView
          boxes={inventory.filter(i => i.type === "box" && i.status === "available")}
          onOpenBox={handleOpenBox}
          onClose={() => {
            setShowUnboxingOverlay(false);
            setInitialBoxId(null);
          }}
          t={t}
          initialBoxId={initialBoxId}
        />
      )}

      {showStudio && (
        <AgentStudioView
          onClose={() => setShowStudio(false)}
          t={t}
        />
      )}

      {/* Navigation tabs */}
      <nav className="bottom-tabs">
        <button
          className={`tab-item ${activeTab === "agent" ? "active" : ""}`}
          onClick={() => { setActiveTab("agent"); telegramAdapter.hapticImpact("light"); }}
          title="Agent"
        >
          <Pickaxe size={18} />
          <span>{t("nav.home", "Home")}</span>
        </button>

        <button
          className={`tab-item ${activeTab === "earn" ? "active" : ""}`}
          onClick={() => { setActiveTab("earn"); telegramAdapter.hapticImpact("light"); }}
          title={t("nav.earn", "任务")}
        >
          <Zap size={18} />
          <span>{t("nav.earn", "Missions")}</span>
        </button>

        <button
          className={`tab-item ${activeTab === "inventory" ? "active" : ""} ${hasBoxes ? "pulse-highlight" : ""}`}
          onClick={() => { setActiveTab("inventory"); telegramAdapter.hapticImpact("light"); }}
          title={t("nav.bag", "背包")}
        >
          <Package size={18} />
          <span>{t("nav.bag", "Bag")}</span>
        </button>

        <button
          className={`tab-item ${activeTab === "market" ? "active" : ""}`}
          onClick={() => { setActiveTab("market"); telegramAdapter.hapticImpact("light"); }}
          title={t("nav.market", "市场")}
        >
          <ShoppingBag size={18} />
          <span>{t("nav.market", "Market")}</span>
        </button>

        <button
          className={`tab-item ${activeTab === "pool" ? "active" : ""}`}
          onClick={() => { setActiveTab("pool"); telegramAdapter.hapticImpact("light"); }}
          title={t("nav.pool", "战队")}
        >
          <Users size={18} />
          <span>{t("nav.pool", "Crew")}</span>
        </button>
      </nav>

      {/* Simulated Telegram WebApp MainButton container for browser preview testing */}
      <button id="tg-mock-main-button" style={{ display: "none" }} className="tg-mock-bottom-button"></button>
    </main>
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
