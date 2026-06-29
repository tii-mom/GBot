import React, { useState } from "react";
import { TelegramOpportunitySignalMock } from "./telegramSourceMockTypes";
import { OpportunitySignalCard } from "./OpportunitySignalCard";

interface TelegramOpportunityInboxProps {
  initialSignals: TelegramOpportunitySignalMock[];
}

type FilterType = "all" | "bounty" | "announcement" | "risk_link" | "guild_task";

export const TelegramOpportunityInbox: React.FC<TelegramOpportunityInboxProps> = ({ 
  initialSignals 
}) => {
  const [signals, setSignals] = useState<TelegramOpportunitySignalMock[]>(initialSignals);
  const [filter, setFilter] = useState<FilterType>("all");

  const handleConvert = (id: string) => {
    setSignals(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, status: "converted_to_work_run_mock" };
      }
      return s;
    }));
  };

  const handleIgnore = (id: string) => {
    setSignals(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, status: "ignored" };
      }
      return s;
    }));
  };

  // Filter signals
  const filteredSignals = signals.filter(s => {
    if (filter === "all") return true;
    return s.signalType === filter;
  });

  // Stats
  const candidateCount = signals.filter(s => s.status === "candidate").length;
  const pendingUserCount = signals.filter(s => s.status === "pending_user").length;
  const ignoredCount = signals.filter(s => s.status === "ignored").length;
  
  const totalEstimatedCredit = filteredSignals
    .filter(s => s.status === "candidate" || s.status === "pending_user")
    .reduce((sum, s) => sum + s.estimatedAiCreditCost, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Header Info */}
      <div style={{ paddingBottom: "4px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>🔭 Telegram 线索收件箱 · Mock</h3>
        <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
          Agent 会把授权来源中可处理的信息整理为候选线索，等待主人确认。
        </p>
      </div>

      {/* Filter Row */}
      <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
        {([
          { id: "all", label: "全部" },
          { id: "bounty", label: "🎯 悬赏" },
          { id: "announcement", label: "📢 公告" },
          { id: "risk_link", label: "🛡️ 风险提示" },
          { id: "guild_task", label: "🤝 公会任务" }
        ] as const).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: "6px 12px",
              borderRadius: "20px",
              border: filter === f.id ? "1px solid #7C3AED" : "1px solid rgba(255, 255, 255, 0.05)",
              backgroundColor: filter === f.id ? "rgba(124, 58, 237, 0.15)" : "rgba(255, 255, 255, 0.02)",
              color: filter === f.id ? "#A78BFA" : "var(--text-secondary)",
              fontSize: "11px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontWeight: filter === f.id ? "bold" : "normal"
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Stats Summary Panel */}
      <div 
        style={{ 
          display: "flex", 
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
          background: "rgba(255,255,255,0.01)",
          padding: "8px 12px",
          borderRadius: "8px",
          color: "gray"
        }}
      >
        <span>未处理线索: <strong style={{ color: "var(--text-primary)" }}>{candidateCount}</strong> 个</span>
        <span>待主人确认: <strong style={{ color: "#F59E0B" }}>{pendingUserCount}</strong> 个</span>
        <span>已忽略: <strong style={{ color: "gray" }}>{ignoredCount}</strong> 个</span>
        <span>预估模型消耗: <strong style={{ color: "#A78BFA" }}>{totalEstimatedCredit} Credits</strong></span>
      </div>

      {/* OpportunitySignalCard list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filteredSignals.length > 0 ? (
          filteredSignals.map(s => (
            <OpportunitySignalCard 
              key={s.id} 
              signal={s} 
              onConvert={handleConvert}
              onIgnore={handleIgnore}
            />
          ))
        ) : (
          <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--text-secondary)", fontSize: "12px", border: "1px dashed rgba(255,255,255,0.05)", borderRadius: "12px" }}>
            🕸️ 该筛选分类下暂无候选线索。添加授权来源并激活 Agent 后，符合处理规则的信息会整理呈现到此处。
          </div>
        )}
      </div>
    </div>
  );
};
