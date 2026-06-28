import React from "react";

export interface AssetBalanceStripProps {
  gBalance: string;
  tonBalance: string;
  aiCredits: string;
  pendingPoints?: number;
}

export function AssetBalanceStrip({
  gBalance,
  tonBalance,
  aiCredits,
  pendingPoints
}: AssetBalanceStripProps) {
  return (
    <div className="asset-balance-strip">
      <div className="asset-balance-item">
        <span>G Balance</span>
        <strong>{gBalance}</strong>
      </div>
      <div className="asset-balance-divider" />
      <div className="asset-balance-item">
        <span>TON Gas</span>
        <strong>{tonBalance}</strong>
      </div>
      <div className="asset-balance-divider" />
      <div className="asset-balance-item">
        <span>AI Credits</span>
        <strong>{aiCredits}</strong>
      </div>
      {typeof pendingPoints === "number" && pendingPoints > 0 && (
        <>
          <div className="asset-balance-divider" />
          <div className="asset-balance-item">
            <span style={{ color: "var(--gb-text-faint)" }}>Pending GP</span>
            <strong style={{ color: "var(--gb-text-muted)", fontSize: "14px" }}>{pendingPoints}</strong>
          </div>
        </>
      )}
    </div>
  );
}
