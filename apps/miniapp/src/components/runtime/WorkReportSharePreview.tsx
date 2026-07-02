import { Clock, ShieldAlert } from "lucide-react";
import React, { useState } from "react";
import type { WorkRun } from "@growthbot/shared";
import { Card } from "./index";
import { statusLabel } from "./runtimeUtils";

interface WorkReportSharePreviewProps {
  run: WorkRun | null;
  agentName?: string;
  agentLevel?: number;
}

export const WorkReportSharePreview: React.FC<WorkReportSharePreviewProps> = ({ 
  run, 
  agentName = "GrowthBot Agent",
  agentLevel = 1
}) => {
  const [copyStatus, setCopyStatus] = useState<string>("");

  if (!run) {
    return (
      <div style={{ padding: "12px", textAlign: "center", color: "var(--text-secondary)", fontSize: "12px" }}>
        <span style={{display:'inline-flex', alignItems:'center', gap:'6px'}}><Clock size={16} className="spinning-icon" /> 等待 Agent 带回战报...</span>
      </div>
    );
  }

  // Map values safely
  const taskId = run.taskId || "未命名任务";
  const energyConsumed = run.actualEnergy || run.estimatedEnergy || 0;
  const status = run.status || "unknown";

  // Derive verification/settlement statuses
  const getVerificationText = () => {
    if (run.settled) return "已完成";
    if (status === "verifying") return "待验收";
    if (status === "settling") return "待结算";
    return "待验收";
  };

  const getSummaryText = () => {
    return `Agent 战报分享\n` +
      `- Agent: ${agentName} (Lv.${agentLevel})\n` +
      `- 探索方向: ${taskId}\n` +
      `- 当前状态: ${getVerificationText()}\n` +
      `- 消耗模型能量: ${energyConsumed} 点\n` +
      `※ 任务结果取决于任务方验收与结算，不构成任何结果承诺。`;
  };

  const handleCopy = () => {
    const text = getSummaryText();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopyStatus("已复制到剪贴板！");
          setTimeout(() => setCopyStatus(""), 2000);
        })
        .catch(() => {
          setCopyStatus("复制失败，请手动选择复制。");
        });
    } else {
      setCopyStatus("暂不支持自动复制，请手动复制。");
    }
  };

  return (
    <Card title="战报分享卡">
      <div 
        style={{
          padding: "16px",
          borderRadius: "14px",
          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(124, 58, 237, 0.05) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          fontSize: "13px",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ color: "var(--text-primary)" }}>{taskId}</strong>
          <span 
            style={{ 
              fontSize: "11px", 
              backgroundColor: run.settled ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)", 
              color: run.settled ? "#10B981" : "#F59E0B", 
              padding: "2px 8px", 
              borderRadius: "6px",
              fontWeight: "bold"
            }}
          >
            {getVerificationText()}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px", color: "var(--text-secondary)", fontSize: "12px" }}>
          <div>Agent 名称: {agentName} (Lv.{agentLevel})</div>
          <div>消耗模型能量: {energyConsumed} 点</div>
          <div>当前进度阶段: {statusLabel(status)}</div>
        </div>

        <div 
          style={{ 
            fontSize: "11px", 
            color: "gray", 
            borderTop: "1px dashed rgba(255,255,255,0.06)", 
            paddingTop: "8px", 
            marginTop: "4px",
            lineHeight: "1.4"
          }}
        >
          <strong><ShieldAlert size={14} style={{color:'var(--blue)', verticalAlign:'middle', marginRight:'6px', display:'inline-block'}} /> 安全提示：</strong> 任务结果取决于任务方验收与结算。
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button 
            disabled 
            style={{ flex: 1, padding: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", color: "gray", fontSize: "11px" }}
          >
            预览分享卡
          </button>
          <button 
            onClick={handleCopy}
            style={{ flex: 1, padding: "8px", background: "rgba(124, 58, 237, 0.2)", border: "1px solid rgba(124, 58, 237, 0.3)", borderRadius: "6px", color: "#A78BFA", fontSize: "11px", cursor: "pointer", fontWeight: "bold" }}
          >
            复制战报摘要
          </button>
          <button 
            disabled 
            style={{ flex: 1, padding: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", color: "gray", fontSize: "11px" }}
          >
            分享到群
          </button>
        </div>

        {copyStatus && (
          <div style={{ fontSize: "11px", color: "#10B981", textAlign: "center", marginTop: "4px" }}>
            {copyStatus}
          </div>
        )}
      </div>
    </Card>
  );
};
export default WorkReportSharePreview;
