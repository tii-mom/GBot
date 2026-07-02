import React, { useState } from "react";
import { ShieldAlert, Tag, AlertTriangle, FileText, Lightbulb } from "lucide-react";
import { TelegramOpportunitySignalMock, signalTypeLabel, confidenceLabel } from "./telegramSourceMockTypes";

interface OpportunitySignalCardProps {
  signal: TelegramOpportunitySignalMock;
  mode?: "live" | "mock" | "offline";
  onConvert?: (id: string) => void;
  onIgnore?: (id: string) => void;
}

export const OpportunitySignalCard: React.FC<OpportunitySignalCardProps> = ({ 
  signal, 
  mode = "mock",
  onConvert, 
  onIgnore 
}) => {
  const [showEvidence, setShowEvidence] = useState(false);

  // Derive styles
  const getConfidenceColor = () => {
    switch (signal.confidenceLevel) {
      case "high": return "#10B981";
      case "medium": return "#F59E0B";
      default: return "gray";
    }
  };

  const getStatusLabelText = () => {
    switch (signal.status) {
      case "converted_to_work_run_mock": 
        return "已转为候选任务";
      case "ignored": return "已忽略";
      case "pending_user": return "待用户确认";
      default: return "待确认";
    }
  };

  const getStatusColor = () => {
    switch (signal.status) {
      case "converted_to_work_run_mock": return "#10B981";
      case "ignored": return "gray";
      case "pending_user": return "#F59E0B";
      default: return "#A78BFA";
    }
  };

  return (
    <div 
      style={{
        padding: "14px",
        borderRadius: "12px",
        backgroundColor: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.05)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        fontSize: "12px"
      }}
    >
      {/* Title Block */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span 
            style={{ 
              fontSize: "9px", 
              backgroundColor: "rgba(124, 58, 237, 0.15)", 
              color: "#A78BFA", 
              padding: "1px 6px", 
              borderRadius: "4px",
              fontWeight: "bold",
              marginRight: "6px"
            }}
          >
            {signalTypeLabel[signal.signalType]}
          </span>
          <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>{signal.title}</strong>
        </div>
        <span 
          style={{ 
            fontSize: "10px", 
            fontWeight: "bold", 
            color: getStatusColor() 
          }}
        >
          {getStatusLabelText()}
        </span>
      </div>

      {/* Summary */}
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "11px", lineHeight: "1.4" }}>
        {signal.summary}
      </p>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px", color: "gray" }}>
        <div>预估消耗: <span style={{ color: "var(--text-primary)" }}>{signal.estimatedAiCreditCost} 点模型能量</span></div>
        <div>置信度: <span style={{ color: getConfidenceColor() }}>{confidenceLabel[signal.confidenceLevel]}</span></div>
      </div>

      {/* Skill requirements chips */}
      {signal.requiredSkills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          <span style={{ fontSize: "10px", color: "gray" }}>所需技能:</span>
          {signal.requiredSkills.map((sk, idx) => (
            <span 
              key={idx} 
              style={{ 
                fontSize: "10px", 
                backgroundColor: "rgba(255,255,255,0.03)", 
                padding: "1px 6px", 
                borderRadius: "4px", 
                color: "var(--text-secondary)" 
              }}
            >
              {sk}
            </span>
          ))}
        </div>
      )}

      {/* Risk flags chips */}
      {signal.riskFlags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          <span style={{ fontSize: "10px", color: "gray" }}>风控标记:</span>
          {signal.riskFlags.map((fl, idx) => (
            <span 
              key={idx} 
              style={{ 
                fontSize: "10px", 
                backgroundColor: "rgba(239, 68, 68, 0.05)", 
                padding: "1px 6px", 
                borderRadius: "4px", 
                color: "#EF4444" 
              }}
            >
              {fl}
            </span>
          ))}
        </div>
      )}

      {/* Visible boundary list toggled by button */}
      {showEvidence && (
        <div 
          style={{
            padding: "8px 10px",
            borderRadius: "8px",
            backgroundColor: "rgba(0,0,0,0.15)",
            border: "1px solid rgba(255,255,255,0.04)",
            fontSize: "11px",
            display: "flex",
            flexDirection: "column",
            gap: "6px"
          }}
        >
          <div>
            <span style={{ color: "#A78BFA", fontWeight: "bold" }}><span style={{display:'inline-flex', alignItems:'center', gap:'4px', color:'#A78BFA'}}><FileText size={12} /> 接入证据摘要</span>：</span>
            <ul style={{ margin: "4px 0 0 0", paddingLeft: "16px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "2px" }}>
              {signal.evidencePreview.map((ev, idx) => <li key={idx}>{ev}</li>)}
            </ul>
          </div>
          <div style={{ borderTop: "1px dashed rgba(255,255,255,0.05)", paddingTop: "6px", marginTop: "4px" }}>
            <span style={{ color: "#10B981", fontWeight: "bold" }}><span style={{display:'inline-flex', alignItems:'center', gap:'4px', color:'#10B981'}}><Lightbulb size={12} /> 建议行动</span>:</span>
            <span style={{ color: "var(--text-secondary)", marginLeft: "4px" }}>{signal.recommendedAction}</span>
          </div>
          <div style={{ color: "gray", fontSize: "10px", fontStyle: "italic", marginTop: "2px" }}>
            ※ 注：最终任务产出交付必须通过任务方验收结算。
          </div>
        </div>
      )}

      {/* CTA Buttons */}
      <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
        {signal.status === "candidate" ? (
          <>
            <button 
              onClick={() => onConvert && onConvert(signal.id)}
              style={{ 
                flex: 1, 
                padding: "8px", 
                background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)", 
                color: "white", 
                border: "none", 
                borderRadius: "6px", 
                fontSize: "11px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              转为候选任务
            </button>
            <button 
              onClick={() => onIgnore && onIgnore(signal.id)}
              style={{ 
                padding: "8px 12px", 
                background: "rgba(255,255,255,0.03)", 
                color: "var(--text-secondary)", 
                border: "1px solid rgba(255,255,255,0.05)", 
                borderRadius: "6px", 
                fontSize: "11px",
                cursor: "pointer"
              }}
            >
              忽略线索
            </button>
          </>
        ) : signal.status === "pending_user" ? (
          <>
            <button 
              onClick={() => onConvert && onConvert(signal.id)}
              style={{ 
                flex: 1, 
                padding: "8px", 
                background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)", 
                color: "black", 
                border: "none", 
                borderRadius: "6px", 
                fontSize: "11px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              确认转为候选任务
            </button>
            <button 
              onClick={() => onIgnore && onIgnore(signal.id)}
              style={{ 
                padding: "8px 12px", 
                background: "rgba(255,255,255,0.03)", 
                color: "var(--text-secondary)", 
                border: "1px solid rgba(255,255,255,0.05)", 
                borderRadius: "6px", 
                fontSize: "11px",
                cursor: "pointer"
              }}
            >
              忽略
            </button>
          </>
        ) : (
          <button 
            disabled 
            style={{ 
              flex: 1, 
              padding: "8px", 
              background: "rgba(255,255,255,0.03)", 
              color: "gray", 
              border: "1px solid rgba(255,255,255,0.05)", 
              borderRadius: "6px", 
              fontSize: "11px"
            }}
          >
            {signal.status === "ignored" ? "已忽略此线索" : "已加入待探索队列"}
          </button>
        )}
        <button 
          onClick={() => setShowEvidence(!showEvidence)}
          style={{ 
            padding: "8px 12px", 
            background: "rgba(124, 58, 237, 0.15)", 
            color: "#A78BFA", 
            border: "1px solid rgba(124, 58, 237, 0.2)", 
            borderRadius: "6px", 
            fontSize: "11px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          {showEvidence ? "隐藏证据" : "查看证据"}
        </button>
      </div>
    </div>
  );
};
