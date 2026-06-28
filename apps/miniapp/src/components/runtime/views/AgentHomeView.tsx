import React from "react";
import { RuntimeState, WorkspacePrimaryActionKind } from "../runtimeTypes";
import { AgentAvatarStage } from "../AgentAvatarStage";
import { AgentMoodLine } from "../AgentMoodLine";
import { AgentStatusPanel } from "../AgentStatusPanel";
import { deriveAgentVisualProfile, deriveValueCreationSummary } from "../petAgentAdapters";
import { WorkReportShareCard } from "../WorkReportShareCard";
import { Card } from "../index";
import { RuntimeTab } from "../petAgentTypes";
import { getMockMode } from "../../../apiClient";
import { deriveTelegramPlaygroundContext } from "../telegramPlaygroundAdapter";
import { WorkReportSharePreview } from "../WorkReportSharePreview";

interface AgentHomeViewProps {
  state: RuntimeState;
  setTab: (tab: RuntimeTab) => void;
  onPrimaryAction: (kind: WorkspacePrimaryActionKind) => void;
  openReport?: (runId: string) => Promise<void>;
}

export const AgentHomeView: React.FC<AgentHomeViewProps> = ({ state, setTab, onPrimaryAction, openReport }) => {
  const { agent, activeRun, runs, walletPolicy, aiCreditBalance, assetBalances, agentWallet } = state;
  const isDemo = getMockMode();
  const tgContext = deriveTelegramPlaygroundContext();

  if (!agent) {
    return (
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px", textAlign: "center" }}>
        <div style={{ fontSize: "60px" }}>🥚</div>
        <h2 style={{ fontSize: "20px", fontWeight: "bold" }}>唤醒你的 Agent 幼体</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.5" }}>
          它将通过技能卡、预算策略和授权来源来发现机会，并带回可验证战报。所有行动都受 Policy Guard、安全策略与预算上限约束，不提供任何收益或产出承诺。
        </p>
        <button 
          onClick={() => onPrimaryAction("claim")}
          style={{
            padding: "12px 24px",
            background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",
            color: "white",
            border: "none",
            borderRadius: "12px",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)"
          }}
        >
          唤醒 Agent 幼体
        </button>

        {/* Secondary Links/Hints */}
        <div style={{ display: "flex", justifyContent: "space-around", marginTop: "16px", fontSize: "12px" }}>
          <span 
            onClick={() => setTab("Train")}
            style={{ color: "#A78BFA", textDecoration: "underline", cursor: "pointer" }}
          >
            先了解技能卡
          </span>
          <span 
            onClick={() => setTab("Explore")}
            style={{ color: "#A78BFA", textDecoration: "underline", cursor: "pointer" }}
          >
            查看 Telegram 游乐园
          </span>
          <span 
            onClick={() => setTab("Nest")}
            style={{ color: "#A78BFA", textDecoration: "underline", cursor: "pointer" }}
          >
            什么是 Agent 小金库？
          </span>
        </div>
      </div>
    );
  }

  // Derive all data via helpers
  const profile = deriveAgentVisualProfile(agent, activeRun, walletPolicy, aiCreditBalance);
  const valSummary = deriveValueCreationSummary(agent, activeRun, runs);

  // Parse budgets & assets
  const gBalance = assetBalances.find(b => b.asset === "G")?.available.amount || "0";
  const tonBalance = assetBalances.find(b => b.asset === "TON")?.available.amount || "0";
  const aiCredits = aiCreditBalance[0]?.balance.amount || String(agent.energy || 0);

  // Render recent run if any
  const latestRun = runs[0] || null;

  // State-aware wallet indicator
  const getWalletStatusText = () => {
    if (agentWallet) {
      return "Agent 小金库已连接";
    } else if (walletPolicy) {
      return "预算策略已设置，等待钱包连接";
    } else {
      return "Agent 小金库待连接";
    }
  };

  const getWalletStatusBg = () => {
    if (agentWallet) return "rgba(16, 185, 129, 0.1)";
    if (walletPolicy) return "rgba(245, 158, 11, 0.1)";
    return "rgba(239, 68, 68, 0.1)";
  };

  const getWalletStatusColor = () => {
    if (agentWallet) return "#10B981";
    if (walletPolicy) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>
      {/* Head Panel */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "bold" }}>🐾 {agent.name || "我的 Agent"}</h1>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            Zodiac Familiars • 12星座召唤兽系列 {isDemo ? " (Demo)" : ""}
          </span>
        </div>
        <div 
          style={{ 
            padding: "4px 8px", 
            borderRadius: "8px", 
            background: getWalletStatusBg(), 
            color: getWalletStatusColor(), 
            fontSize: "11px", 
            fontWeight: "bold" 
          }}
        >
          {getWalletStatusText()}
        </div>
      </div>

      {/* Avatar Stage */}
      <AgentAvatarStage profile={profile} />

      {/* Mood Line */}
      <AgentMoodLine profile={profile} name={agent.name || "Agent"} />

      {/* Status Panel (Energy, Fatigue, Trust) */}
      <AgentStatusPanel 
        profile={profile} 
        level={agent.level || 1} 
        profession={agent.profession || "赏金猎人幼体"} 
        energy={Number(aiCredits)}
        fatigue={activeRun ? 40 : 10}
        trust={95}
      />

      {/* Value Creation Summary */}
      <Card title={`今日创造的可验证价值${isDemo ? " (演示数据)" : ""}`}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
          <div>
            <div style={{ color: "var(--text-secondary)" }}>今日候选机会</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "var(--text-primary)" }}>
              {runs.length === 0 ? "等待 Agent 外出探索" : `${valSummary.todayRadarCount} 个`}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text-secondary)" }}>已过滤风险</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "var(--text-primary)" }}>
              {runs.length === 0 ? "0 次" : `${valSummary.filteredRisksCount} 次`}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text-secondary)" }}>已完成工作</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "var(--text-primary)" }}>
              {valSummary.completedTasksCount} 项
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text-secondary)" }}>已生成 Work Report</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "var(--text-primary)" }}>
              {valSummary.reportsGeneratedCount} 份
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text-secondary)" }}>已消耗 AI Credit</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "var(--text-primary)" }}>
              {valSummary.aiCreditConsumed} Credits
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text-secondary)" }}>已控制预算</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "var(--text-primary)" }}>
              {valSummary.savedBudget} TON
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text-secondary)" }}>待验收奖励</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#F59E0B" }}>
              {valSummary.pendingVerificationRewards} PTS
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text-secondary)" }}>待结算结果</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#10B981" }}>
              {valSummary.settlingRewards} G
            </div>
          </div>
        </div>
      </Card>

      {/* Telegram Playground Alert Status */}
      <Card title="Telegram 游乐园今日线索">
        <div style={{ fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ lineHeight: "1.4", color: "var(--text-primary)" }}>
            {tgContext.available 
              ? `🔌 授权生效中：今天它在 Telegram 游乐园 (基于所选的 @提及与群授权) 嗅探到 ${tgContext.cluesCount} 条任务线索。` 
              : `🔒 授权 Telegram 探索后，Agent 可以帮你发现群聊和频道中的任务线索。${tgContext.safetyNotice}`}
          </span>
          <button 
            onClick={() => setTab("Explore")}
            style={{ 
              fontSize: "12px", 
              color: "#7C3AED", 
              background: "none", 
              border: "none", 
              cursor: "pointer", 
              fontWeight: "bold",
              marginLeft: "12px",
              whiteSpace: "nowrap"
            }}
          >
            前往设置
          </button>
        </div>
      </Card>

      {/* Budgets & Isolated Wallet Envelope */}
      <Card title="模型能量与授权预算">
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-secondary)" }}>能量储备:</span>
            <span style={{ color: "var(--text-primary)", fontWeight: "bold" }}>{aiCredits} AI Credit</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-secondary)" }}>单次限制:</span>
            <span style={{ color: "var(--text-primary)" }}>
              {walletPolicy?.perTransactionLimit ? `${walletPolicy.perTransactionLimit.amount} TON` : "0.5 TON 限制"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-secondary)" }}>每日预算限制:</span>
            <span style={{ color: "var(--text-primary)" }}>
              {walletPolicy?.dailyLimit ? `${walletPolicy.dailyLimit.amount} TON` : "5.0 TON 限制"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-secondary)" }}>小金库余额:</span>
            <span style={{ color: "var(--text-primary)", fontWeight: "bold" }}>
              {gBalance} G / {tonBalance} TON
            </span>
          </div>
        </div>
      </Card>

      {/* Pending User Approval Intents */}
      {activeRun && activeRun.status === "waiting_user" && (
        <div 
          style={{
            padding: "16px",
            borderRadius: "16px",
            backgroundColor: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: "bold", color: "#F59E0B" }}>
            ⚠️ 等待主人确认 (Pending Intent Approval)
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
            Agent 准备了一笔操作 intent。Policy Guard 正在检查。需要主人确认授权该行动方案。
          </p>
          <button 
            onClick={() => setTab("Explore")}
            style={{
              padding: "8px 16px",
              backgroundColor: "#F59E0B",
              color: "black",
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer",
              alignSelf: "flex-start",
              fontSize: "12px"
            }}
          >
            去处理确认动作
          </button>
        </div>
      )}

      {/* Latest Work Report */}
      <Card title="Agent 带回来的战报">
        {latestRun ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <WorkReportShareCard 
              report={latestRun} 
              onOpen={() => {
                if (openReport && latestRun) {
                  openReport(latestRun.id);
                }
              }} 
            />
            {/* Share Preview Card */}
            <WorkReportSharePreview 
              run={latestRun}
              agentName={agent.name}
              agentLevel={agent.level}
            />
            <button 
              onClick={() => onPrimaryAction("report")}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: "12px",
                cursor: "pointer",
                textAlign: "center",
                marginTop: "4px"
              }}
            >
              点击查看全部战报记录
            </button>
          </div>
        ) : (
          <div style={{ padding: "16px", textAlign: "center", color: "var(--text-secondary)", fontSize: "13px" }}>
            Agent 还没有带回战报。派它出击后，这里会出现可验证工作记录。
          </div>
        )}
      </Card>
    </div>
  );
};
