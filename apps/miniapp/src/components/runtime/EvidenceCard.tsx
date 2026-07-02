import React from "react";

export interface EvidenceCardProps {
  type: string;
  title: string;
  status: string;
  createdTime?: string;
  proofUrl?: string;
  proofHash?: string;
}

export function EvidenceCard({
  type,
  title,
  status,
  createdTime,
  proofUrl,
  proofHash
}: EvidenceCardProps) {
  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "8px",
        padding: "12px",
        marginTop: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "6px"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: "9px",
            fontWeight: 700,
            textTransform: "uppercase",
            background: "rgba(0, 152, 234, 0.1)",
            color: "var(--gb-ton-blue)",
            padding: "2px 6px",
            borderRadius: "4px"
          }}
        >
          {type}
        </span>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 600,
            color: status === "approved" || status === "success" || status === "completed" ? "var(--gb-emerald-glow)" : "var(--gb-text-soft)"
          }}
        >
          {status.toUpperCase()}
        </span>
      </div>

      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--gb-text-main)" }}>
        {title}
      </div>

      {createdTime && (
        <div style={{ fontSize: "10px", color: "var(--gb-text-faint)" }}>
          记录时间：{new Date(createdTime).toLocaleString()}
        </div>
      )}

      {proofHash ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px", borderTop: "1px dashed rgba(255,255,255,0.04)", paddingTop: "4px" }}>
          <span style={{ fontSize: "9px", color: "var(--gb-text-faint)", textTransform: "uppercase" }}>证明引用哈希</span>
          <span style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--gb-cyan-cyber)", wordBreak: "break-all" }}>
            {proofHash}
          </span>
        </div>
      ) : (
        <div style={{ fontSize: "10px", color: "var(--gb-text-faint)", fontStyle: "italic", marginTop: "4px" }}>
          暂无链上证明引用
        </div>
      )}

      {proofUrl && (
        <a
          href={proofUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "11px",
            color: "var(--gb-ton-blue)",
            textDecoration: "underline",
            marginTop: "2px",
            display: "inline-block"
          }}
        >
          查看证据链接
        </a>
      )}
    </div>
  );
}
