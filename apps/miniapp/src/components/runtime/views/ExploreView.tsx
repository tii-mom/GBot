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

const radarOpportunities = [
  {
    id: "opp_1",
    title: "TON Liquid Staking 协议反馈",
    match: 95,
    cost: "12 能量",
    reward: "候选 15 G",
    risk: "低风险",
    check: "需任务方验收后结算",
    advice: "适合项目研究技能，执行前保留预算确认。"
  },
  {
    id: "opp_2",
    title: "Telegram Bot 工具包文档校对",
    match: 80,
    cost: "8 能量",
    reward: "候选 8 G",
    risk: "低风险",
    check: "需提交证据并待验收",
    advice: "适合技术文档与内容整理能力。"
  },
  {
    id: "opp_3",
    title: "新项目公告线索整理",
    match: 72,
    cost: "10 能量",
    reward: "候选 10 G",
    risk: "需确认",
    check: "高风险链接先进入确认队列",
    advice: "建议平衡模式，先过滤再派遣。"
  }
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

export const ExploreView: React.FC<ExploreViewProps> = ({ state, createResearchRun }) => {
  const { agent, tasks, activeRun, aiCreditBalance } = state;
  const [dispatchMode, setDispatchMode] = useState<DispatchMode>("balanced");
  const [selectedZone, setSelectedZone] = useState("telegram_playground");
  const [selectedOppIndex, setSelectedOppIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subView, setSubView] = useState<TelegramSubView>("overview");
  const [sources, setSources] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [apiMode, setApiMode] = useState<"live" | "mock" | "offline">("mock");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const sourcesRes = await apiClient.listTelegramSources();
      const signalsRes = await apiClient.listTelegramOpportunitySignals();

      setSources(sourcesRes.sources.map(adaptSourceToMock));
      setSignals(signalsRes.signals.map(adaptSignalToMock));
      setApiMode("live");
    } catch (err: any) {
      console.warn("[ExploreView] API failed, using local fallback data:", err);
      setSources(MOCK_TELEGRAM_SOURCES);
      setSignals(MOCK_TELEGRAM_SIGNALS);
      setApiMode(navigator.onLine ? "mock" : "offline");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedZone === "telegram_playground") {
      fetchLiveData();
    }
  }, [selectedZone]);

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
  const currentOpportunity = radarOpportunities[selectedOppIndex % radarOpportunities.length] || radarOpportunities[0]!;
  const aiCredits = aiCreditBalance[0]?.balance.amount || getAssetAmount(state, "AI_CREDIT") || String(agent?.energy || 0);
  const candidateCount = signals.filter((signal) => signal.status === "candidate").length || radarOpportunities.length;
  const pendingUserCount = signals.filter((signal) => signal.status === "pending_user").length;
  const selectedCostNumber = Number(currentOpportunity?.cost.match(/\d+/)?.[0] || 0);
  const enoughEnergy = Number(aiCredits || 0) >= selectedCostNumber;

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
    setIsSubmitting(true);
    try {
      await createResearchRun(
        tasks[0]?.id || "default_task",
        `${selectedZoneMeta.name} · ${currentOpportunity.title}`,
        `Dispatch mode: ${selectedMode.title}. ${currentOpportunity.check}. ${currentOpportunity.advice}`
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextOpportunity = () => {
    setSelectedOppIndex((prev) => (prev + 1) % radarOpportunities.length);
  };

  const prevOpportunity = () => {
    setSelectedOppIndex((prev) => (prev - 1 + radarOpportunities.length) % radarOpportunities.length);
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
            <span>Token 能量</span>
          </div>
          <strong>{aiCredits}</strong>
          <i><b style={{ width: `${Math.min(100, Number(aiCredits) / 2.4)}%` }} /></i>
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
            <h2>{selectedOppIndex + 1} / {radarOpportunities.length} 条候选线索</h2>
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
              <span>{currentOpportunity.match}% 匹配</span>
            </div>
            <i>
              <b style={{ width: `${currentOpportunity.match}%` }} />
            </i>
            <div className="gbot-radar-card__meta">
              <span>{currentOpportunity.cost}</span>
              <span>{currentOpportunity.reward}</span>
              <span>{currentOpportunity.risk}</span>
            </div>
            <p>{currentOpportunity.check}</p>
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
          disabled={isSubmitting || Boolean(activeRun) || !enoughEnergy}
          onClick={handleStartExplore}
        >
          {isSubmitting ? <Loader size={20} className="spinning-icon" /> : <Send size={20} />}
          {isSubmitting ? "指令传输中" : activeRun ? "已有任务进行中" : enoughEnergy ? "派 Agent 出发" : "能量不足"}
        </button>

        {/* Compact Risk Note */}
        <div className="gbot-safety-row" style={{ margin: 0, padding: "6px 10px", fontSize: "11px" }}>
          <AlertTriangle size={14} />
          <span>候选奖励需任务方验收后结算；高风险动作会停下等你确认。</span>
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
