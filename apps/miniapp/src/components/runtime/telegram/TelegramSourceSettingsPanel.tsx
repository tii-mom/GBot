import { PlusCircle, Inbox, RefreshCw } from "lucide-react";
import React from "react";
import { TelegramAuthorizedSourceMock } from "./telegramSourceMockTypes";
import { PermissionBoundaryNotice } from "./PermissionBoundaryNotice";
import { TelegramSourceCard } from "./TelegramSourceCard";

export interface TelegramSourceSettingsPanelProps {
  sources: TelegramAuthorizedSourceMock[];
  mode?: "live" | "mock" | "offline";
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onPause?: (id: string) => Promise<void> | void;
  onRemove?: (id: string) => Promise<void> | void;
  onAddPreview?: () => void;
}

export const TelegramSourceSettingsPanel: React.FC<TelegramSourceSettingsPanelProps> = ({ 
  sources,
  mode = "mock",
  isLoading = false,
  error = null,
  onRefresh,
  onPause,
  onRemove,
  onAddPreview
}) => {
  // Compute summary stats
  const authorizedCount = sources.filter(s => s.status === "authorized_mock" || s.status === "authorized" as any).length;
  const pendingCount = sources.filter(s => s.status === "pending").length;
  const disabledCount = sources.filter(s => s.status === "disabled" || s.status === "revoked").length;
  const riskCount = sources.filter(s => s.riskLevel === "high" || s.riskLevel === "medium").length;

  const getModeBadge = () => {
    switch (mode) {
      case "live":
        return { text: "已连接", color: "#10B981" };
      case "offline":
        return { text: "离线", color: "#EF4444" };
      default:
        return { text: "本地数据", color: "#3B82F6" };
    }
  };

  const badge = getModeBadge();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Header Info */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: "4px" }}>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            Telegram 授权事件接入
            <span 
              style={{ 
                fontSize: "10px", 
                backgroundColor: "rgba(255,255,255,0.05)", 
                padding: "2px 6px", 
                borderRadius: "4px", 
                color: badge.color, 
                border: `1px solid ${badge.color}`
              }}
            >
              {badge.text}
            </span>
          </h3>
          <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
            设置和管理您的 Agent 在 Telegram 平台所绑定的数据源。
          </p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              background: "rgba(255,255,255,0.05)",
              color: "var(--text-primary)",
              border: "1px solid rgba(255,255,255,0.1)",
              fontSize: "10px",
              cursor: "pointer"
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <RefreshCw size={12} />
              {isLoading ? "刷新中..." : "刷新"}
            </span>
          </button>
        )}
      </div>

      {error && (
        <div 
          style={{ 
            padding: "8px 12px", 
            borderRadius: "6px", 
            background: "rgba(239, 68, 68, 0.1)", 
            border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "#FCA5A5",
            fontSize: "11px"
          }}
        >
          {error}
        </div>
      )}

      {/* Permission Boundary Notice */}
      <PermissionBoundaryNotice />

      {/* Summary Counts Bar */}
      <div 
        style={{ 
          display: "grid", 
          gridTemplateColumns: "1fr 1fr 1fr 1fr", 
          gap: "8px",
          textAlign: "center",
          fontSize: "11px",
          background: "rgba(255,255,255,0.01)",
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.03)"
        }}
      >
        <div>
          <div style={{ color: "var(--text-secondary)" }}>已授权</div>
          <div style={{ fontWeight: "bold", color: "#10B981", fontSize: "14px", marginTop: "2px" }}>{authorizedCount}</div>
        </div>
        <div>
          <div style={{ color: "var(--text-secondary)" }}>等待授权</div>
          <div style={{ fontWeight: "bold", color: "#F59E0B", fontSize: "14px", marginTop: "2px" }}>{pendingCount}</div>
        </div>
        <div>
          <div style={{ color: "var(--text-secondary)" }}>已暂停/撤销</div>
          <div style={{ fontWeight: "bold", color: "gray", fontSize: "14px", marginTop: "2px" }}>{disabledCount}</div>
        </div>
        <div>
          <div style={{ color: "var(--text-secondary)" }}>中高风险源</div>
          <div style={{ fontWeight: "bold", color: "#EF4444", fontSize: "14px", marginTop: "2px" }}>{riskCount}</div>
        </div>
      </div>

      {/* Add Source Button */}
      <button 
        onClick={onAddPreview}
        disabled={isLoading || mode !== "live"}
        style={{
          padding: "10px",
          borderRadius: "8px",
          background: mode === "live" ? "rgba(124, 58, 237, 0.1)" : "rgba(255, 255, 255, 0.03)",
          color: mode === "live" ? "#A78BFA" : "gray",
          border: mode === "live" ? "1px dashed rgba(124, 58, 237, 0.3)" : "1px dashed rgba(255, 255, 255, 0.1)",
          fontWeight: "bold",
          fontSize: "12px",
          cursor: mode === "live" ? "pointer" : "not-allowed",
          textAlign: "center"
        }}
      >
        <span style={{display:'inline-flex', alignItems:'center', gap:'4px'}}><PlusCircle size={12} /> 添加新授权来源</span>
      </button>

      {/* Source Cards List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {sources.length > 0 ? (
          sources.map(s => (
            <TelegramSourceCard 
              key={s.id} 
              source={s} 
              onPause={onPause} 
              onRemove={onRemove}
            />
          ))
        ) : (
          <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--text-secondary)", fontSize: "12px" }}>
            <span style={{display:'inline-flex', alignItems:'center', gap:'4px'}}><Inbox size={12} /> 还没有授权来源</span>。您可以添加公会群、公告频道、@GBot 提及入口或用户提交链接。
          </div>
        )}
      </div>
    </div>
  );
};
