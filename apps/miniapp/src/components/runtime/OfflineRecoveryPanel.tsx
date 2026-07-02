import React, { useState } from "react";
import { canUseMockMode } from "../../apiClient";

export interface OfflineRecoveryPanelProps {
  errorMsg?: string;
  onRetry: () => void;
  onEnterDemo?: () => void;
  diagnosticData?: Record<string, any>;
}

export function OfflineRecoveryPanel({
  errorMsg = "Agent Network connection temporarily offline.",
  onRetry,
  onEnterDemo,
  diagnosticData
}: OfflineRecoveryPanelProps) {
  const [showDiag, setShowDiag] = useState(false);

  // Check permission constraints
  const canDemo = canUseMockMode();

  const handleCopyDiagnostics = () => {
    const text = JSON.stringify(diagnosticData || { error: errorMsg, timestamp: Date.now() }, null, 2);
    navigator.clipboard.writeText(text);
    alert("连接状态信息已复制。");
  };

  return (
    <div className="gb-glass-card offline-recovery-panel" style={{ margin: "24px 16px" }}>
      <div className="offline-pulse-icon">
        <svg style={{ width: "28px", height: "28px", fill: "var(--gb-risk-red)" }} viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      </div>

      <h2>Agent 连接暂不可用</h2>
      <p style={{ color: "var(--gb-text-soft)", fontSize: "14px", lineHeight: "1.5" }}>
        当前无法连接 Agent 服务。你可以重试连接，或在允许的环境中查看本地预览数据。
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
        <button className="gb-cta-button" onClick={onRetry}>
          <span>重试连接</span>
          <small>重新建立安全的 Agent 连接</small>
        </button>

        {canDemo && onEnterDemo && (
          <button className="gb-cta-button secondary" onClick={onEnterDemo}>
            <span>查看预览模式</span>
            <small>使用本地预览数据了解核心流程</small>
          </button>
        )}
      </div>

      <div className="diagnostic-accordion">
        <div className="diagnostic-header" onClick={() => setShowDiag(!showDiag)}>
          <span>连接状态信息</span>
          <span>{showDiag ? "▲" : "▼"}</span>
        </div>
        {showDiag && (
          <div className="diagnostic-content">
            <button
              onClick={handleCopyDiagnostics}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "none",
                color: "#fff",
                padding: "4px 8px",
                borderRadius: "4px",
                cursor: "pointer",
                marginBottom: "8px",
                fontSize: "9px"
              }}
            >
              复制状态信息
            </button>
            <div style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>
              {JSON.stringify(diagnosticData || { error: errorMsg, timestamp: new Date().toISOString() }, null, 2)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
