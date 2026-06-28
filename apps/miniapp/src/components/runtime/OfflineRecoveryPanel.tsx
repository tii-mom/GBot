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
    alert("Diagnostics copied to clipboard.");
  };

  return (
    <div className="gb-glass-card offline-recovery-panel" style={{ margin: "24px 16px" }}>
      <div className="offline-pulse-icon">
        <svg style={{ width: "28px", height: "28px", fill: "var(--gb-risk-red)" }} viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      </div>

      <h2>Agent Connection Offline</h2>
      <p style={{ color: "var(--gb-text-soft)", fontSize: "14px", lineHeight: "1.5" }}>
        Agent Network is temporarily unavailable. Reconnecting…
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
        <button className="gb-cta-button" onClick={onRetry}>
          <span>Retry Connection</span>
          <small>Attempt to re-establish secure agent connection</small>
        </button>

        {canDemo && onEnterDemo && (
          <button className="gb-cta-button secondary" onClick={onEnterDemo}>
            <span>View Demo Mode</span>
            <small>Sandbox simulation with offline demo data</small>
          </button>
        )}
      </div>

      <div className="diagnostic-accordion">
        <div className="diagnostic-header" onClick={() => setShowDiag(!showDiag)}>
          <span>Developer Diagnostics</span>
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
              Copy Diagnostics
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
