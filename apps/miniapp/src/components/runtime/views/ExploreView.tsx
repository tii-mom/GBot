import React, { useState, useEffect } from "react";
import { RuntimeState } from "../runtimeTypes";
import { Card } from "../index";
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

export const ExploreView: React.FC<ExploreViewProps> = ({ state, createResearchRun }) => {
  const { agent, tasks, activeRun } = state;
  const [dispatchMode, setDispatchMode] = useState<"cautious" | "balanced" | "aggressive">("balanced");
  const [selectedZone, setSelectedZone] = useState<string>("telegram_playground");
  const [topic] = useState("");
  const [context] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subview toggle inside Telegram Plaza Card
  const [subView, setSubView] = useState<"overview" | "sources" | "inbox">("overview");

  // API Integration state
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
      console.warn("[ExploreView] API failed, falling back to mock data:", err);
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

  // Settings Panel Callbacks
  const handlePauseSource = async (id: string) => {
    if (apiMode !== "live") {
      setSources(prev => prev.map(s => {
        if (s.id === id) {
          const nextStatus = s.status === "disabled" ? "authorized_mock" : "disabled";
          return { ...s, status: nextStatus };
        }
        return s;
      }));
      return;
    }
    try {
      const source = sources.find(s => s.id === id);
      if (!source) return;
      const nextStatus = source.status === "disabled" ? "authorized" : "disabled";
      const updated = await apiClient.updateTelegramSource(id, { status: nextStatus });
      setSources(prev => prev.map(s => s.id === id ? adaptSourceToMock(updated) : s));
    } catch (err: any) {
      setError(`暂停/启用失败: ${err.message}`);
    }
  };

  const handleRemoveSource = async (id: string) => {
    if (apiMode !== "live") {
      setSources(prev => prev.filter(s => s.id !== id));
      return;
    }
    try {
      await apiClient.deleteTelegramSource(id);
      setSources(prev => prev.filter(s => s.id !== id));
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
        telegramChatTitlePreview: `👥 Demo Group ${Math.floor(Math.random() * 1000)}`,
        permissionScope: ["mention_analysis"],
        status: "authorized"
      });
      setSources(prev => [adaptSourceToMock(newSrc), ...prev]);
    } catch (err: any) {
      setError(`添加来源失败: ${err.message}`);
    }
  };

  // Opportunity Inbox Callbacks
  const handleIgnoreSignal = async (id: string) => {
    if (apiMode !== "live") {
      setSignals(prev => prev.map(s => s.id === id ? { ...s, status: "ignored" } : s));
      return;
    }
    try {
      const updated = await apiClient.ignoreTelegramOpportunitySignal(id);
      setSignals(prev => prev.map(s => s.id === id ? adaptSignalToMock(updated) : s));
    } catch (err: any) {
      setError(`忽略线索失败: ${err.message}`);
    }
  };

  const handleRequireUserSignal = async (id: string) => {
    if (apiMode !== "live") {
      setSignals(prev => prev.map(s => s.id === id ? { ...s, status: "pending_user" } : s));
      return;
    }
    try {
      const updated = await apiClient.requireUserForTelegramOpportunitySignal(id);
      setSignals(prev => prev.map(s => s.id === id ? adaptSignalToMock(updated) : s));
    } catch (err: any) {
      setError(`变更确认状态失败: ${err.message}`);
    }
  };

  const handleConvertSignal = async (id: string) => {
    if (apiMode !== "live") {
      setSignals(prev => prev.map(s => s.id === id ? { ...s, status: "converted_to_work_run_mock" } : s));
      return;
    }
    try {
      const res = await apiClient.convertTelegramOpportunitySignal(id);
      setSignals(prev => prev.map(s => s.id === id ? adaptSignalToMock(res.signal) : s));
    } catch (err: any) {
      setError(`转换候选状态失败: ${err.message}`);
    }
  };

  const tgContext = deriveTelegramPlaygroundContext();

  // 探索区域定义
  const zones = [
    { id: "ton_new_projects", name: "💎 TON 新项目区", desc: "自动发现 TON 生态最新上线的测试网与交互线索。" },
    { id: "telegram_playground", name: "🔌 Telegram 游乐园", desc: "寻找群聊与频道中经过允许的公开任务线索。" },
    { id: "community_growth", name: "📈 社群增长区", desc: "嗅探推文、社区运营等相关活动增长指标任务。" },
    { id: "onchain_risk", name: "🛡️ 链上风险区", desc: "扫描并审计合约漏洞或高风险代码交付。" },
    { id: "bounty_hall", name: "🏛️ 赏金池大厅", desc: "全局官方与第三方白名单悬赏项目索引地。" }
  ];

  // 机会雷达模拟数据
  const radarOpportunities = [
    {
      id: "opp_1",
      title: "TON Liquid Staking 协议反馈",
      match: "95%",
      cost: "12 Credit",
      reward: "候选奖励：15 G，需任务方验收后结算",
      risk: "低风险",
      advice: "已配备『Project Research』，匹配度较高，但仍需任务方验收。"
    },
    {
      id: "opp_2",
      title: "Telegram Bot 开发者工具包文档校对",
      match: "80%",
      cost: "8 Credit",
      reward: "候选奖励：8 G，需任务方验收后结算",
      risk: "低风险",
      advice: "已配备『Technical Documentation』，建议自动执行"
    }
  ];

  const handleStartExplore = async (taskId: string) => {
    if (!agent) return;
    setIsSubmitting(true);
    try {
      await createResearchRun(
        taskId, 
        topic || "Automated exploration on Zodiac sector", 
        context || "Initiated by explore view strategy panel"
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!agent) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)" }}>
        🔒 请在首页激活你的 Agent 宠物后，再进行派遣与探索操作。
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>
      {/* Page Title */}
      <div>
        <h1 style={{ fontSize: "20px", fontWeight: "bold" }}>🔭 派遣出击 (Agent Explore)</h1>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
          选择派遣模式与探索区域，由 Agent 自动嗅探线索。你只负责预算设置与高风险确认。
        </p>
      </div>

      {/* Dispatch Mode Selector */}
      <Card title="派遣模式 (Dispatch Mode)">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {(["cautious", "balanced", "aggressive"] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setDispatchMode(mode)}
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: dispatchMode === mode ? "1px solid #7C3AED" : "1px solid rgba(255, 255, 255, 0.05)",
                backgroundColor: dispatchMode === mode ? "rgba(124, 58, 237, 0.15)" : "rgba(255, 255, 255, 0.02)",
                color: dispatchMode === mode ? "#A78BFA" : "var(--text-secondary)",
                fontWeight: "bold",
                fontSize: "12px",
                cursor: "pointer"
              }}
            >
              {mode === "cautious" ? "🛡️ 谨慎模式" : mode === "balanced" ? "⚖️ 平衡模式" : "🔥 激进模式"}
            </button>
          ))}
        </div>
        <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "8px", margin: "8px 0 0 0", lineHeight: "1.4" }}>
          {dispatchMode === "cautious" && "※ 谨慎模式：优先选择低费用、低风险、证据要求清晰的任务线索。"}
          {dispatchMode === "balanced" && "※ 平衡模式：自动均衡费用开销与预计奖励，兼顾安全性。"}
          {dispatchMode === "aggressive" && "※ 激进模式：允许 Agent 探索高要求、较复杂的新项目线索，单次信用消耗上限提高。"}
        </p>
      </Card>

      {/* Explore Zones Grid */}
      <Card title="探索区域 (Explore Zones)">
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {zones.map(z => (
            <div
              key={z.id}
              onClick={() => {
                setSelectedZone(z.id);
                if (z.id !== "telegram_playground") {
                  setSubView("overview");
                }
              }}
              style={{
                padding: "12px",
                borderRadius: "12px",
                border: selectedZone === z.id ? "1.5px solid #7C3AED" : "1px solid rgba(255, 255, 255, 0.05)",
                backgroundColor: selectedZone === z.id ? "rgba(124, 58, 237, 0.05)" : "rgba(0, 0, 0, 0.15)",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <div style={{ fontWeight: "bold", fontSize: "13px", color: "var(--text-primary)" }}>{z.name}</div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>{z.desc}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Agent Playground - Telegram Plaza Section */}
      {selectedZone === "telegram_playground" && (
        <Card title="Telegram 游乐园 • Phase 1 Preview">
          {subView === "overview" && (
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "12px" }}>
              
              {/* Host Context Panel */}
              <div 
                style={{ 
                  padding: "12px", 
                  borderRadius: "10px", 
                  backgroundColor: "rgba(255,255,255,0.02)", 
                  border: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}
              >
                <div style={{ fontWeight: "bold", color: "var(--text-primary)", fontSize: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "4px" }}>
                  💻 外部运行上下文 (Host Context)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px" }}>
                  <div>宿主环境: <span style={{ color: tgContext.available ? "#10B981" : "#EF4444" }}>{tgContext.available ? "Telegram 客户端" : "Web 浏览器"}</span></div>
                  <div>运行平台: <span style={{ color: "var(--text-primary)" }}>{tgContext.platform || "N/A"}</span></div>
                  <div>启动来源: <span style={{ color: "var(--text-primary)" }}>{tgContext.launchSource.toUpperCase()}</span></div>
                  <div>携带参数: <span style={{ color: "var(--text-primary)" }}>{tgContext.startParam || "无参数"}</span></div>
                  <div>用户昵称: <span style={{ color: "var(--text-primary)" }}>{tgContext.userDisplayName}</span></div>
                  <div>用户 ID: <span style={{ color: "var(--text-primary)" }}>{tgContext.userIdPreview || "N/A"}</span></div>
                  <div style={{ gridColumn: "span 2" }}>群聊上下文: <span style={{ color: tgContext.chatContextAvailable ? "#10B981" : "#EF4444" }}>{tgContext.chatContextAvailable ? "可用 (Group)" : "不可用 (Private/Browser)"}</span></div>
                </div>
              </div>

              {/* View Switch Buttons */}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setSubView("sources")}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "6px",
                    background: "rgba(124, 58, 237, 0.15)",
                    border: "1px solid rgba(124, 58, 237, 0.25)",
                    color: "#A78BFA",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  打开 Telegram 来源设置
                </button>
                <button
                  onClick={() => setSubView("inbox")}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "6px",
                    background: "rgba(124, 58, 237, 0.15)",
                    border: "1px solid rgba(124, 58, 237, 0.25)",
                    color: "#A78BFA",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  查看 Telegram 线索收件箱
                </button>
              </div>

              <div style={{ padding: "8px", borderRadius: "8px", background: "rgba(124, 58, 237, 0.08)", border: "1px dashed rgba(124, 58, 237, 0.2)", lineHeight: "1.4" }}>
                🔒 <strong>隐私与权限说明：</strong> 授权事件接入后，Agent 仅对被授权的渠道中被 @GBot 提及的命令、或者用户显式提交的数据进行处理，绝对不读取普通历史闲聊，不监控私聊会话，亦不推送批量垃圾私信。
              </div>
              
              {/* Disabled preview buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "4px" }}>
                <button 
                  disabled 
                  style={{ padding: "8px", background: "rgba(255,255,255,0.03)", color: "gray", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", fontSize: "11px" }}
                >
                  让 Agent 探索 Telegram (Preview)
                </button>
                <button 
                  disabled 
                  style={{ padding: "8px", background: "rgba(255,255,255,0.03)", color: "gray", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", fontSize: "11px" }}
                >
                  分享战报 (Preview)
                </button>
                <button 
                  disabled 
                  style={{ padding: "8px", background: "rgba(255,255,255,0.03)", color: "gray", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", fontSize: "11px" }}
                >
                  添加任务来源 (Coming soon)
                </button>
                <button 
                  disabled 
                  style={{ padding: "8px", background: "rgba(255,255,255,0.03)", color: "gray", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", fontSize: "11px" }}
                >
                  设置群权限 (Coming soon)
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px" }}>
                <div style={{ padding: "8px", background: "rgba(255,255,255,0.01)", borderRadius: "6px", textAlign: "center" }}>
                  <div>🐦 X Radar</div>
                  <div style={{ fontSize: "10px", color: "gray", marginTop: "2px" }}>Later</div>
                </div>
                <div style={{ padding: "8px", background: "rgba(255,255,255,0.01)", borderRadius: "6px", textAlign: "center" }}>
                  <div>🌐 Web Scout</div>
                  <div style={{ fontSize: "10px", color: "gray", marginTop: "2px" }}>Later</div>
                </div>
                <div style={{ padding: "8px", background: "rgba(255,255,255,0.01)", borderRadius: "6px", textAlign: "center" }}>
                  <div>🗺️ TON Map</div>
                  <div style={{ fontSize: "10px", color: "gray", marginTop: "2px" }}>Later</div>
                </div>
              </div>
            </div>
          )}

          {subView === "sources" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button
                onClick={() => setSubView("overview")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "var(--text-primary)",
                  fontSize: "11px",
                  cursor: "pointer",
                  alignSelf: "flex-start"
                }}
              >
                ⬅️ 返回游乐园总览
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
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button
                onClick={() => setSubView("overview")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "var(--text-primary)",
                  fontSize: "11px",
                  cursor: "pointer",
                  alignSelf: "flex-start"
                }}
              >
                ⬅️ 返回游乐园总览
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
        </Card>
      )}

      {/* Running Exploration State */}
      {activeRun && (
        <div 
          style={{
            padding: "16px",
            borderRadius: "16px",
            backgroundColor: "rgba(124, 58, 237, 0.08)",
            border: "1px solid rgba(124, 58, 237, 0.2)",
            fontSize: "13px"
          }}
        >
          <div style={{ fontWeight: "bold", color: "#A78BFA", marginBottom: "6px" }}>
            🛰️ Agent 正在外出探索中 (Active Run)
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
            <span>当前阶段: {activeRun.status.toUpperCase()}</span>
            <span>进度: {activeRun.currentStep + 1}/{activeRun.totalSteps || 8}</span>
          </div>
        </div>
      )}

      {/* Opportunity Radar Catalog */}
      <Card title="机会雷达 (Opportunity Radar)">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {radarOpportunities.map(opp => (
            <div 
              key={opp.id}
              style={{
                padding: "12px",
                borderRadius: "12px",
                backgroundColor: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.05)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: "bold", fontSize: "13px", color: "var(--text-primary)" }}>{opp.title}</span>
                <span style={{ fontSize: "10px", background: "rgba(16, 185, 129, 0.1)", color: "#10B981", padding: "2px 6px", borderRadius: "4px" }}>
                  匹配度 {opp.match}
                </span>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px", color: "var(--text-secondary)", marginTop: "8px" }}>
                <div>预计消耗: {opp.cost}</div>
                <div style={{ color: "#10B981" }}>{opp.reward}</div>
                <div>风险评级: {opp.risk}</div>
                <div>建议: {opp.advice}</div>
              </div>

              {/* Only Allow Authorization Controls, No Direct Claim! */}
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button
                  disabled={isSubmitting || !!activeRun}
                  onClick={() => handleStartExplore(tasks[0]?.id || "default_task")}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "6px",
                    background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",
                    color: "white",
                    border: "none",
                    fontWeight: "bold",
                    fontSize: "11px",
                    cursor: "pointer"
                  }}
                >
                  {isSubmitting ? "指令传输中..." : activeRun ? "已有探索进行中" : "派它探索"}
                </button>
                <button
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.05)",
                    color: "var(--text-secondary)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    fontSize: "11px",
                    cursor: "pointer"
                  }}
                >
                  忽略这个方向
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
