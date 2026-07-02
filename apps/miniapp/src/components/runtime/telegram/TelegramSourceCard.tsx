import React, { useState } from "react";
import { Key, Eye, XOctagon } from "lucide-react";
import { TelegramAuthorizedSourceMock, sourceTypeLabel, sourceStatusLabel, riskLevelLabel } from "./telegramSourceMockTypes";

interface TelegramSourceCardProps {
  source: TelegramAuthorizedSourceMock;
  onPause?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export const TelegramSourceCard: React.FC<TelegramSourceCardProps> = ({ 
  source, 
  onPause, 
  onRemove 
}) => {
  const [showBoundary, setShowBoundary] = useState(false);

  // Derive styles
  const getStatusColor = () => {
    switch (source.status) {
      case "authorized_mock": return "#10B981";
      case "pending": return "#F59E0B";
      default: return "gray";
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
      {/* Title block */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: "bold", fontSize: "13px", color: "var(--text-primary)" }}>
            {source.titlePreview}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
            类型: {sourceTypeLabel[source.sourceType]}
          </div>
        </div>
        <span 
          style={{ 
            fontSize: "10px", 
            backgroundColor: "rgba(255,255,255,0.03)", 
            padding: "2px 6px", 
            borderRadius: "4px", 
            color: getStatusColor(), 
            border: `1px solid ${getStatusColor()}`
          }}
        >
          {sourceStatusLabel[source.status]}
        </span>
      </div>

      {/* Info details */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "10px", color: "var(--text-secondary)" }}>
        <span>风险状况: {riskLevelLabel[source.riskLevel]}</span>
        {source.lastSignalAt && <span>最后处理时间: {source.lastSignalAt}</span>}
      </div>

      {/* Permission scope chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {source.permissionScope.map((scope, idx) => (
          <span 
            key={idx} 
            style={{ 
              fontSize: "10px", 
              backgroundColor: "rgba(124, 58, 237, 0.1)", 
              color: "#A78BFA", 
              padding: "1px 6px", 
              borderRadius: "4px" 
            }}
          >
            <span style={{display:'inline-flex', alignItems:'center', gap:'4px'}}><Key size={12} />{scope}</span>
          </span>
        ))}
      </div>

      {/* Visible boundary list toggled by button */}
      {showBoundary && (
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
          <div style={{ color: "gray", fontSize: "10px", fontStyle: "italic" }}>
            ※ {source.dataBoundary}
          </div>
          <div>
            <span style={{ color: "#10B981", fontWeight: "bold" }}><span style={{display:'inline-flex', alignItems:'center', gap:'4px', color:'#10B981'}}><Eye size={12} /> Agent 可以接入:</span></span>
            <ul style={{ margin: "2px 0 0 0", paddingLeft: "16px", color: "var(--text-secondary)" }}>
              {source.canSee.map((item, idx) => <li key={idx}>{item}</li>)}
            </ul>
          </div>
          <div>
            <span style={{ color: "#EF4444", fontWeight: "bold" }}><span style={{display:'inline-flex', alignItems:'center', gap:'4px', color:'#EF4444'}}><XOctagon size={12} /> Agent 无法接入:</span></span>
            <ul style={{ margin: "2px 0 0 0", paddingLeft: "16px", color: "var(--text-secondary)" }}>
              {source.cannotSee.map((item, idx) => <li key={idx}>{item}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Actions block */}
      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
        <button 
          onClick={() => onPause && onPause(source.id)}
          style={{ 
            flex: 1, 
            padding: "6px", 
            background: "rgba(255,255,255,0.03)", 
            color: "var(--text-secondary)", 
            border: "1px solid rgba(255,255,255,0.05)", 
            borderRadius: "6px", 
            fontSize: "11px",
            cursor: "pointer"
          }}
        >
          暂停来源
        </button>
        <button 
          onClick={() => onRemove && onRemove(source.id)}
          style={{ 
            flex: 1, 
            padding: "6px", 
            background: "rgba(239, 68, 68, 0.08)", 
            color: "#EF4444", 
            border: "1px solid rgba(239, 68, 68, 0.15)", 
            borderRadius: "6px", 
            fontSize: "11px",
            cursor: "pointer"
          }}
        >
          移除来源
        </button>
        <button 
          onClick={() => setShowBoundary(!showBoundary)}
          style={{ 
            padding: "6px 12px", 
            background: "rgba(124, 58, 237, 0.15)", 
            color: "#A78BFA", 
            border: "1px solid rgba(124, 58, 237, 0.2)", 
            borderRadius: "6px", 
            fontSize: "11px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          {showBoundary ? "收起边界" : "查看权限边界"}
        </button>
      </div>
    </div>
  );
};
