import React, { useState } from "react";
import { TelegramAuthorizedSourceMock } from "./telegramSourceMockTypes";
import { PermissionBoundaryNotice } from "./PermissionBoundaryNotice";
import { TelegramSourceCard } from "./TelegramSourceCard";
import { Card } from "../index";

interface TelegramSourceSettingsPanelProps {
  initialSources: TelegramAuthorizedSourceMock[];
}

export const TelegramSourceSettingsPanel: React.FC<TelegramSourceSettingsPanelProps> = ({ 
  initialSources 
}) => {
  const [sources, setSources] = useState<TelegramAuthorizedSourceMock[]>(initialSources);

  const handlePause = (id: string) => {
    setSources(prev => prev.map(s => {
      if (s.id === id) {
        const nextStatus = s.status === "disabled" ? "authorized_mock" : "disabled";
        return { ...s, status: nextStatus };
      }
      return s;
    }));
  };

  const handleRemove = (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
  };

  // Compute summary stats
  const authorizedCount = sources.filter(s => s.status === "authorized_mock").length;
  const pendingCount = sources.filter(s => s.status === "pending").length;
  const disabledCount = sources.filter(s => s.status === "disabled" || s.status === "revoked").length;
  const riskCount = sources.filter(s => s.riskLevel === "high" || s.riskLevel === "medium").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Header Info */}
      <div style={{ paddingBottom: "4px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>🔌 Telegram 来源设置 · Mock</h3>
        <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
          这里只展示授权来源模型。真实授权将在 V2 后端完成。所有数据均为静态演示。
        </p>
      </div>

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
          <div style={{ color: "var(--text-secondary)" }}>已授权 (Mock)</div>
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

      {/* Add Source Preview Button */}
      <button 
        disabled
        style={{
          padding: "10px",
          borderRadius: "8px",
          background: "rgba(255, 255, 255, 0.03)",
          color: "gray",
          border: "1px dashed rgba(255, 255, 255, 0.1)",
          fontWeight: "bold",
          fontSize: "12px",
          cursor: "not-allowed",
          textAlign: "center"
        }}
      >
        ➕ 添加新授权来源 (Preview Only)
      </button>

      {/* Source Cards List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {sources.length > 0 ? (
          sources.map(s => (
            <TelegramSourceCard 
              key={s.id} 
              source={s} 
              onPause={handlePause} 
              onRemove={handleRemove}
            />
          ))
        ) : (
          <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--text-secondary)", fontSize: "12px" }}>
            🎒 还没有授权来源。未来你可以添加公会群、公告频道、@GBot 提及入口或用户提交链接。
          </div>
        )}
      </div>
    </div>
  );
};
