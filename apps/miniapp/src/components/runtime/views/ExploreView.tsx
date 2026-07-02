import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crosshair,
  Gauge,
  Globe,
  Loader,
  Map,
  Radio,
  Radar,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap
} from "lucide-react";
import { RuntimeState } from "../runtimeTypes";
import type { BountyOpportunity } from "@growthbot/shared";
import { CollapsibleCard } from "../index";
import { deriveTelegramPlaygroundContext } from "../telegramPlaygroundAdapter";
import {
  TelegramSourceSettingsPanel,
  TelegramOpportunityInbox,
  MOCK_TELEGRAM_SOURCES,
  MOCK_TELEGRAM_SIGNALS
} from "../telegram";
import { apiClient } from "../../../apiClient";
import { adaptSourceToMock, adaptSignalToMock } from "../telegram/telegramApiAdapters";

interface ExploreViewProps {
  state: RuntimeState;
  createResearchRun: (taskId: string, topic: string, context: string) => Promise<any>;
}

type DispatchMode = "cautious" | "balanced" | "aggressive";
type TelegramSubView = "overview" | "sources" | "inbox";

const dispatchModes: Array<{
  id: DispatchMode;
  label: string;
  title: string;
  desc: string;
  bonus: string;
}> = [
  {
    id: "cautious",
    label: "谨慎",
    title: "低风险巡逻",
    desc: "优先低消耗、证据清晰、需确认的候选线索。",
    bonus: "风险过滤 +20%"
  },
  {
    id: "balanced",
    label: "平衡",
    title: "标准派遣",
    desc: "兼顾消耗、匹配度和待验收候选奖励。",
    bonus: "机会匹配 +15%"
  },
  {
    id: "aggressive",
    label: "进阶",
    title: "深度侦察",
    desc: "探索更复杂的新项目方向，高风险动作仍需确认。",
    bonus: "线索深度 +25%"
  }
];

const zones = [
  { id: "ton_new_projects", name: "TON 新项目区", desc: "交互与生态", icon: Map },
  { id: "telegram_playground", name: "Telegram 授权源", desc: "群聊与 @ 线索", icon: Radio },
  { id: "community_growth", name: "社群增长区", desc: "内容与增长", icon: Sparkles },
  { id: "onchain_risk", name: "链上风险区", desc: "合约风险审计", icon: ShieldAlert },
  { id: "bounty_hall", name: "任务机会大厅", desc: "悬赏索引", icon: Globe }
];

const missionNodes = [
  { id: "gate", label: "出发口", status: "done" },
  { id: "scan", label: "线索雷达", status: "active" },
  { id: "guard", label: "风控门", status: "locked" },
  { id: "report", label: "战报箱", status: "idle" }
];

function getAssetAmount(state: RuntimeState, asset: "G" | "TON" | "AI_CREDIT") {
  return state.assetBalances.find((balance) => balance.asset === asset)?.available.amount || "0";
}

function getActionLeft(state: RuntimeState) {
  const limit = state.agent?.dailyRunLimit || 3;
  const count = state.agent?.dailyRunCount || 0;
  return `${Math.max(0, limit - count)}/${limit}`;
}

function settlementLabel(target: BountyOpportunity["settlementTarget"]) {
  if (target === "user_wallet") return "用户钱包";
  if (target === "user_platform_account") return "用户平台账户";
  return "GBot 内部";
}

function custodyLabel(custody: BountyOpportunity["payoutCustody"]) {
  return custody === "never_platform_custody" ? "不经 GBot 托管" : "GBot 内部托管";
}

function automationLabel(mode: BountyOpportunity["automationMode"]) {
  if (mode === "blocked") return "规则不允许自动化";
  if (mode === "auto_execute") return "可低风险执行";
  if (mode === "user_confirm") return "需你确认";
  return "仅推荐";
}

function riskLabel(risk: BountyOpportunity["riskLevel"]) {
  if (risk === "high") return "高风险";
  if (risk === "medium") return "中风险";
  return "低风险";
}

export const ExploreView: React.FC<ExploreViewProps> = ({ state, createResearchRun }) => {
  const { agent, tasks, activeRun, aiCreditBalance } = state;
  const [dispatchMode, setDispatchMode] = useState<DispatchMode>("balanced");
  const [selectedZone, setSelectedZone] = useState("telegram_playground");
  const [selectedOppIndex, setSelectedOppIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subView, setSubView] = useState<TelegramSubView>("overview");
  const [sources, setSources] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<BountyOpportunity[]>([]);
  const [apiMode, setApiMode] = useState<"live" | "mock" | "offline">("mock");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sourcesRes, signalsRes, opportunitiesRes] = await Promise.all([
        apiClient.listTelegramSources(),
        apiClient.listTelegramOpportunitySignals(),
        apiClient.getOpportunities()
      ]);

      setSources(sourcesRes.sources.map(adaptSourceToMock));
      setSignals(signalsRes.signals.map(adaptSignalToMock));
      setOpportunities(opportunitiesRes.opportunities);
      setApiMode("live");
    } catch (err: any) {
      console.warn("[ExploreView] API failed, using local fallback data:", err);
      try {
        const opportunitiesRes = await apiClient.getOpportunities();
        setOpportunities(opportunitiesRes.opportunities);
      } catch {
        setOpportunities([]);
      }
      setSources(MOCK_TELEGRAM_SOURCES);
      setSignals(MOCK_TELEGRAM_SIGNALS);
      setApiMode(typeof navigator !== "undefined" && navigator.onLine ? "mock" : "offline");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
  }, []);

  const handlePauseSource = async (id: string) => {
    if (apiMode !== "live") {
      setSources((prev) =>
        prev.map((source) => source.id === id ? { ...source, status: source.status === "disabled" ? "authorized_mock" : "disabled" } : source)
      );
      return;
    }
    try {
      const source = sources.find((item) => item.id === id);
      if (!source) return;
      const nextStatus = source.status === "disabled" ? "authorized" : "disabled";
      const updated = await apiClient.updateTelegramSource(id, { status: nextStatus });
      setSources((prev) => prev.map((item) => item.id === id ? adaptSourceToMock(updated) : item));
    } catch (err: any) {
      setError(`暂停/启用失败: ${err.message}`);
    }
  };

  const handleRemoveSource = async (id: string) => {
    if (apiMode !== "live") {
      setSources((prev) => prev.filter((source) => source.id !== id));
      return;
    }
    try {
      await apiClient.deleteTelegramSource(id);
      setSources((prev) => prev.filter((source) => source.id !== id));
    } catch (err: any) {
      setError(`删除来源失败: ${err.message}`);
    }
  };

  const handleAddSourcePreview = async () => {
    if (apiMode !== "live") return;
    try {
      const activeAgentId = agent?.id || "agent_default";
      const newSrc = await apiClient.createTelegramSource({
        agentId: activeAgentId,
        sourceType: "group",
        telegramChatId: String(Math.floor(Math.random() * -100000000000)),
        telegramChatTitlePreview: `Telegram 群组 ${Math.floor(Math.random() * 1000)}`,
        permissionScope: ["mention_analysis"],
        status: "authorized"
      });
      setSources((prev) => [adaptSourceToMock(newSrc), ...prev]);
    } catch (err: any) {
      setError(`添加来源失败: ${err.message}`);
    }
  };

  const handleIgnoreSignal = async (id: string) => {
    if (apiMode !== "live") {
      setSignals((prev) => prev.map((signal) => signal.id === id ? { ...signal, status: "ignored" } : signal));
      return;
    }
    try {
      const updated = await apiClient.ignoreTelegramOpportunitySignal(id);
      setSignals((prev) => prev.map((signal) => signal.id === id ? adaptSignalToMock(updated) : signal));
    } catch (err: any) {
      setError(`忽略线索失败: ${err.message}`);
    }
  };

  const handleRequireUserSignal = async (id: string) => {
    if (apiMode !== "live") {
      setSignals((prev) => prev.map((signal) => signal.id === id ? { ...signal, status: "pending_user" } : signal));
      return;
    }
    try {
      const updated = await apiClient.requireUserForTelegramOpportunitySignal(id);
      setSignals((prev) => prev.map((signal) => signal.id === id ? adaptSignalToMock(updated) : signal));
    } catch (err: any) {
      setError(`变更确认状态失败: ${err.message}`);
    }
  };

  const handleConvertSignal = async (id: string) => {
    if (apiMode !== "live") {
      setSignals((prev) => prev.map((signal) => signal.id === id ? { ...signal, status: "converted_to_work_run_mock" } : signal));
      return;
    }
    try {
      const res = await apiClient.convertTelegramOpportunitySignal(id);
      setSignals((prev) => prev.map((signal) => signal.id === id ? adaptSignalToMock(res.signal) : signal));
    } catch (err: any) {
      setError(`转换候选状态失败: ${err.message}`);
    }
  };

  const tgContext = deriveTelegramPlaygroundContext();
  const selectedMode = dispatchModes.find((mode) => mode.id === dispatchMode) ?? dispatchModes[0]!;
  const selectedZoneMeta = zones.find((zone) => zone.id === selectedZone) ?? zones[0]!;
  const currentOpportunity = opportunities.length > 0
    ? opportunities[selectedOppIndex % opportunities.length]
    : null;
  const aiCredits = aiCreditBalance[0]?.balance.amount || getAssetAmount(state, "AI_CREDIT") || String(agent?.energy || 0);
  const gFuel = getAssetAmount(state, "G");
  const candidateCount = signals.filter((signal) => signal.status === "candidate").length || opportunities.length;
  const pendingUserCount = signals.filter((signal) => signal.status === "pending_user").length;
  const selectedFuelCost = Number(currentOpportunity?.fuelCostG || 0);
  const selectedAiCost = Number(currentOpportunity?.aiCreditEstimate || 0);
  const enoughFuel = Number(gFuel || 0) >= selectedFuelCost;
  const enoughEnergy = Number(aiCredits || 0) >= selectedAiCost;
  const automationBlocked = currentOpportunity?.automationMode === "blocked";

  const launchSourceLabel = useMemo<Record<typeof tgContext.launchSource, string>>(
    () => ({
      direct: "直接打开",
      startapp: "启动链接",
      group: "群入口",
      unknown: "未知来源"
    }),
    [tgContext.launchSource]
  );

  const handleStartExplore = async () => {
    if (!agent || !currentOpportunity) return;
    if (automationBlocked || !enoughFuel || !enoughEnergy) return;
    setIsSubmitting(true);
    try {
      const taskId = currentOpportunity.localTaskId || tasks[0]?.id || "default_task";
      await createResearchRun(
        taskId,
        `${currentOpportunity.platform} · ${currentOpportunity.title}`,
        [
          `Dispatch mode: ${selectedMode.title}.`,
          `Route: ${selectedZoneMeta.name}.`,
          `Opportunity source: ${currentOpportunity.source}.`,
          `Reward: ${currentOpportunity.rewardDisplay}.`,
          `Fuel: ${currentOpportunity.fuelCostG} G + ${currentOpportunity.aiCreditEstimate} Token.`,
          `Payout: ${settlementLabel(currentOpportunity.settlementTarget)}; custody: ${custodyLabel(currentOpportunity.payoutCustody)}.`,
          `Automation: ${automationLabel(currentOpportunity.automationMode)}.`,
          "This phase creates a GBot work plan and evidence package; it does not claim external acceptance or external submission."
        ].join(" ")
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextOpportunity = () => {
    if (opportunities.length === 0) return;
    setSelectedOppIndex((prev) => (prev + 1) % opportunities.length);
  };

  const prevOpportunity = () => {
    if (opportunities.length === 0) return;
    setSelectedOppIndex((prev) => (prev - 1 + opportunities.length) % opportunities.length);
  };

  if (!agent) {
    return (
      <main className="gbot-mini-page gbot-explore-page">
        <header className="gbot-mini-header">
          <div className="gbot-mini-header__left">
            <div className="gbot-mini-header__icon">
              <Compass size={18} />
            </div>
            <div className="gbot-mini-header__titles">
              <h1>任务地图</h1>
              <span>DISPATCH CONSOLE</span>
            </div>
          </div>
        </header>
        <div className="gbot-mini-empty" style={{ margin: "40px 0" }}>
          <Bot size={32} className="text-amber" />
          <strong>先激活你的 Agent</strong>
          <p>领养 Agent 后才能进入任务地图并派它外出整理候选线索。</p>
        </div>
      </main>
    );
  }

  return (
    <main className="gbot-mini-page gbot-explore-page">
      {/* 1. HUD Top Header */}
      <header className="gbot-mini-header">
        <div className="gbot-mini-header__left">
          <div className="gbot-mini-header__icon">
            <Compass size={18} />
          </div>
          <div className="gbot-mini-header__titles">
            <h1>任务地图</h1>
            <span>DISPATCH CONSOLE</span>
          </div>
        </div>
        <div className="gbot-mini-header__right">
          <span className="gbot-mini-pill gbot-mini-pill--active">
            <Zap size={14} />
            {aiCredits}
          </span>
          <span className="gbot-mini-pill">
            <Gauge size={14} />
            {getActionLeft(state)}
          </span>
        </div>
      </header>

      {/* 2. Stat Strip */}
      <div className="gbot-mini-stat-strip">
        <div className="gbot-mini-stat-item">
          <div className="gbot-mini-stat-item__top">
            <span>当前路线</span>
          </div>
          <strong>{selectedZoneMeta.name.replace("区", "").replace("大厅", "")}</strong>
          <i><b style={{ width: "80%" }} /></i>
        </div>
        <div className="gbot-mini-stat-item">
          <div className="gbot-mini-stat-item__top">
            <span>G 燃料</span>
          </div>
          <strong>{gFuel}</strong>
          <i><b style={{ width: `${Math.min(100, Number(gFuel) / 2)}%` }} /></i>
        </div>
        <div className="gbot-mini-stat-item">
          <div className="gbot-mini-stat-item__top">
            <span>今日可派</span>
          </div>
          <strong>{getActionLeft(state)}</strong>
          <i><b style={{ width: "100%" }} /></i>
        </div>
      </div>



      {/* 4. Zone Route Selector */}
      <div className="gbot-mini-carousel" style={{ margin: "0" }}>
        {zones.map((zone) => {
          const Icon = zone.icon;
          const active = zone.id === selectedZone;
          return (
            <button
              className={`gbot-zone-tile${active ? " is-active" : ""}`}
              key={zone.id}
              type="button"
              onClick={() => {
                setSelectedZone(zone.id);
                if (zone.id !== "telegram_playground") setSubView("overview");
              }}
              style={{ width: "120px", minHeight: "44px", padding: "6px 8px" }}
            >
              <Icon size={16} />
              <span style={{ fontSize: "12px", whiteSpace: "nowrap" }}>{zone.name}</span>
            </button>
          );
        })}
      </div>

      {/* 6. Single Active Opportunity Radar Card with Arrow Switcher */}
      <section className="gbot-mini-panel">
        <div className="gbot-mini-panel__title">
          <div>
            <span>机会雷达</span>
            <h2>{opportunities.length > 0 ? selectedOppIndex + 1 : 0} / {opportunities.length} 条任务机会</h2>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button type="button" className="gbot-mini-icon-btn" onClick={prevOpportunity} aria-label="上一条线索">
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="gbot-mini-icon-btn" onClick={nextOpportunity} aria-label="下一条线索">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {currentOpportunity ? (
          <div className="gbot-radar-card is-selected" style={{ margin: 0 }}>
            <div className="gbot-radar-card__top">
              <strong>{currentOpportunity.title}</strong>
              <span>{currentOpportunity.successProbability}% 成功率</span>
            </div>
            <i>
              <b style={{ width: `${currentOpportunity.successProbability}%` }} />
            </i>
            <div className="gbot-radar-card__meta">
              <span>{currentOpportunity.fuelCostG} G</span>
              <span>{currentOpportunity.aiCreditEstimate} Token</span>
              <span>{riskLabel(currentOpportunity.riskLevel)}</span>
            </div>
            <div className="gbot-radar-card__meta">
              <span>{currentOpportunity.platform}</span>
              <span>{settlementLabel(currentOpportunity.settlementTarget)}</span>
              <span>{automationLabel(currentOpportunity.automationMode)}</span>
            </div>
            <p>{currentOpportunity.summary}</p>
            <p>{currentOpportunity.rewardDisplay} · {custodyLabel(currentOpportunity.payoutCustody)}</p>
          </div>
        ) : (
          <div className="gbot-mini-empty">
            <Radar size={20} />
            <strong>暂无可派线索</strong>
            <p>该路线暂无新候选机会，可切换其他路线。</p>
          </div>
        )}
      </section>

      {/* Active Run Card */}
      {activeRun && (
        <section className="gbot-running-card">
          <Loader size={18} className="spinning-icon" />
          <div>
            <strong>Agent 正在外出</strong>
            <p>阶段：{activeRun.status} · 进度 {activeRun.currentStep + 1}/{activeRun.totalSteps || 8}</p>
          </div>
        </section>
      )}

      {/* 7. Action Dock (Primary Dispatch Button min 44px height) */}
      <div className="gbot-mini-action-dock">
        <button
          type="button"
          className="gbot-mini-primary-btn"
          disabled={isSubmitting || Boolean(activeRun) || !enoughFuel || !enoughEnergy || automationBlocked || !currentOpportunity}
          onClick={handleStartExplore}
        >
          {isSubmitting ? <Loader size={20} className="spinning-icon" /> : <Send size={20} />}
          {isSubmitting
            ? "指令传输中"
            : activeRun
              ? "已有任务进行中"
              : automationBlocked
                ? "规则不允许自动化"
                : !enoughFuel || !enoughEnergy
                  ? "燃料不足"
                  : "消耗 G 派遣 Agent"}
        </button>

        {/* Compact Risk Note */}
        <div className="gbot-safety-row" style={{ margin: 0, padding: "6px 10px", fontSize: "11px" }}>
          <AlertTriangle size={14} />
          <span>外部赏金归用户钱包或平台账户；GBot 只记录燃料、证据和结算追踪。</span>
        </div>
      </div>

      {/* 8. Collapsible Detail Section (Telegram 授权源 & 线索箱) */}
      <CollapsibleCard
        title="Telegram 授权源 & 线索箱"
        summary={`${apiMode === "live" ? "已连接" : apiMode === "offline" ? "离线" : "本地"} · ${sources.length} 个来源 · ${pendingUserCount} 条待确认`}
        className="gbot-drawer-card"
      >
        {subView === "overview" && (
          <div className="gbot-telegram-overview">
            {/* Mission Nodes Horizontal Bar */}
            <div className="gbot-task-map-board" style={{ margin: "0 0 8px 0" }}>
              <div className="gbot-task-map-board__path" />
              {missionNodes.map((node, index) => (
                <article className={`gbot-map-node is-${node.status}`} key={node.id}>
                  <b>{index + 1}</b>
                  <strong>{node.label}</strong>
                </article>
              ))}
            </div>

            <div className="gbot-permission-note">
              <ShieldCheck size={18} />
              <p>只处理授权来源、@ 提及或用户提交内容；不读取普通历史闲聊。</p>
            </div>

            <div className="gbot-telegram-stats">
              <div>
                <span>宿主</span>
                <strong>{tgContext.available ? "Telegram" : "Web"}</strong>
              </div>
              <div>
                <span>启动</span>
                <strong>{launchSourceLabel[tgContext.launchSource]}</strong>
              </div>
              <div>
                <span>线索</span>
                <strong>{candidateCount}</strong>
              </div>
              <div>
                <span>待确认</span>
                <strong>{pendingUserCount}</strong>
              </div>
            </div>

            <div className="gbot-inline-actions">
              <button type="button" className="gbot-mini-btn" onClick={() => setSubView("sources")}>
                管理来源
              </button>
              <button type="button" className="gbot-mini-btn" onClick={() => setSubView("inbox")}>
                查看线索箱
              </button>
            </div>
          </div>
        )}

        {subView === "sources" && (
          <div className="gbot-telegram-subview">
            <button className="gbot-back-button gbot-mini-btn" type="button" onClick={() => setSubView("overview")}>
              <ArrowLeft size={14} />
              返回总览
            </button>
            <TelegramSourceSettingsPanel
              sources={sources}
              mode={apiMode}
              isLoading={isLoading}
              error={error}
              onRefresh={fetchLiveData}
              onPause={handlePauseSource}
              onRemove={handleRemoveSource}
              onAddPreview={handleAddSourcePreview}
            />
          </div>
        )}

        {subView === "inbox" && (
          <div className="gbot-telegram-subview">
            <button className="gbot-back-button gbot-mini-btn" type="button" onClick={() => setSubView("overview")}>
              <ArrowLeft size={14} />
              返回总览
            </button>
            <TelegramOpportunityInbox
              signals={signals}
              mode={apiMode}
              isLoading={isLoading}
              error={error}
              onRefresh={fetchLiveData}
              onIgnore={handleIgnoreSignal}
              onRequireUser={handleRequireUserSignal}
              onConvert={handleConvertSignal}
            />
          </div>
        )}
      </CollapsibleCard>
    </main>
  );
};
