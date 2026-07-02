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
        <span>G 余额</span>
        <strong>{gBalance}</strong>
      </div>
      <div className="asset-balance-divider" />
      <div className="asset-balance-item">
        <span>TON Gas 预算</span>
        <strong>{tonBalance}</strong>
      </div>
      <div className="asset-balance-divider" />
      <div className="asset-balance-item">
        <span>模型能量</span>
        <strong>{aiCredits}</strong>
      </div>
      {typeof pendingPoints === "number" && pendingPoints > 0 && (
        <>
          <div className="asset-balance-divider" />
          <div className="asset-balance-item">
            <span style={{ color: "var(--gb-text-faint)" }}>待入账积分</span>
            <strong style={{ color: "var(--gb-text-muted)", fontSize: "14px" }}>{pendingPoints}</strong>
          </div>
        </>
      )}
    </div>
  );
}
