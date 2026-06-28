import React from "react";

export interface AgentWalletCardProps {
  status: string;
  autoPurchase: boolean;
  address?: string;
  dailyLimit?: string;
}

export function AgentWalletCard({
  status,
  autoPurchase,
  address = "EQD...mock",
  dailyLimit = "5.0 TON"
}: AgentWalletCardProps) {
  return (
    <div className="gb-glass-card">
      <div className="gb-glass-card-header">
        <h3>
          <svg style={{ width: "16px", height: "16px", fill: "var(--gb-ton-blue)" }} viewBox="0 0 24 24">
            <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
          </svg>
          Agent Wallet
        </h3>
        <span style={{ fontSize: "11px", color: "var(--gb-ton-blue)", fontWeight: 700, textTransform: "uppercase" }}>
          {status}
        </span>
      </div>
      
      <div style={{ fontSize: "12px", color: "var(--gb-text-soft)", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--gb-text-muted)" }}>Wallet Address:</span>
          <span style={{ fontFamily: "monospace" }}>{address}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--gb-text-muted)" }}>Policy Guard Limit:</span>
          <span>{dailyLimit}/day</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--gb-text-muted)" }}>Auto-Purchase:</span>
          <span style={{ color: autoPurchase ? "var(--gb-emerald-glow)" : "var(--gb-text-muted)" }}>
            {autoPurchase ? "Active (Bounded by Policy)" : "Paused / Disabled"}
          </span>
        </div>
        
        <div className="agent-wallet-notice-badge">
          <strong>Security Boundary Notice:</strong> The Agent Wallet is strictly isolated. The Agent does NOT hold, control, or request the seed phrase or keys to your main Telegram / TON wallet.
        </div>
      </div>
    </div>
  );
}
