import React from "react";

export function RuntimeSkeleton() {
  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* HUD Header Skeleton */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="gb-shimmer-bg skeleton-title" style={{ width: "120px", height: "20px", marginBottom: 0 }} />
        <div className="gb-shimmer-bg" style={{ width: "80px", height: "24px", borderRadius: "12px" }} />
      </div>

      {/* Hero Card Skeleton */}
      <div className="gb-glass-card gb-shimmer-bg" style={{ minHeight: "220px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "12px" }}>
        <div className="gb-shimmer-bg" style={{ width: "90px", height: "90px", borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div className="gb-shimmer-bg skeleton-title" style={{ width: "160px", marginBottom: 0 }} />
        <div className="gb-shimmer-bg skeleton-text" style={{ width: "100px", marginBottom: 0 }} />
      </div>

      {/* Asset Strip Skeleton */}
      <div className="asset-balance-strip" style={{ margin: "0", background: "rgba(255,255,255,0.02)" }}>
        <div className="gb-shimmer-bg" style={{ width: "60px", height: "30px", borderRadius: "4px" }} />
        <div className="gb-shimmer-bg" style={{ width: "60px", height: "30px", borderRadius: "4px" }} />
        <div className="gb-shimmer-bg" style={{ width: "60px", height: "30px", borderRadius: "4px" }} />
      </div>

      {/* Secondary Card Skeletons */}
      <div className="gb-glass-card" style={{ margin: 0 }}>
        <div className="gb-shimmer-bg skeleton-title" />
        <div className="gb-shimmer-bg skeleton-text" style={{ width: "90%" }} />
        <div className="gb-shimmer-bg skeleton-text" style={{ width: "70%" }} />
      </div>
    </div>
  );
}
