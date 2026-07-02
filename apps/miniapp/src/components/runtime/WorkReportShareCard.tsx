import React from "react";
import { FolderOpen } from "lucide-react";
import type { WorkReport, WorkRun } from "@growthbot/shared";
import { formatSettlementLabel, formatVerificationLabel, statusLabel } from "./runtimeUtils";

export interface WorkReportShareCardProps {
  report: WorkReport | WorkRun;
  onOpen: () => void;
}

export function WorkReportShareCard({ report, onOpen }: WorkReportShareCardProps) {
  const isWorkReport = "reportKind" in report || "overallStatus" in report;
  
  // Extract statuses
  const status = isWorkReport ? (report as WorkReport).overallStatus : (report as WorkRun).status;
  const taskId = isWorkReport ? (report as WorkReport).taskId : (report as WorkRun).taskId;
  
  const verificationStatus = isWorkReport 
    ? (report as WorkReport).verification?.status 
    : null;
  const settlementStatus = isWorkReport
    ? (report as WorkReport).settlement?.status
    : ((report as WorkRun).settled ? "settled" : "pending");
  
  const evidenceCount = isWorkReport && (report as WorkReport).evidence 
    ? (report as WorkReport).evidence.length 
    : 0;

  // Real report URL check
  const isRealUrl = isWorkReport && (report as WorkReport).id && !(report as WorkReport).id.includes("mock") && !(report as WorkReport).id.includes("demo");

  return (
    <button
      onClick={onOpen}
      style={{
        width: "100%",
        display: "block",
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "12px",
        padding: "14px",
        textAlign: "left",
        cursor: "pointer",
        transition: "border-color 0.2s ease, transform 0.15s ease",
        color: "#fff",
        marginBottom: "8px"
      }}
      className="interactive"
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 800, wordBreak: "break-all", whiteSpace: "normal" }}>
            {taskId}
          </div>
          <div style={{ fontSize: "11px", color: "var(--gb-text-muted)", marginTop: "4px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <span>Verification: {formatVerificationLabel(verificationStatus)}</span>
            <span>·</span>
            <span>Settlement: {formatSettlementLabel(settlementStatus)}</span>
          </div>
        </div>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            background: "rgba(255, 255, 255, 0.06)",
            padding: "3px 8px",
            borderRadius: "4px",
            color: "var(--gb-text-soft)",
            whiteSpace: "nowrap"
          }}
        >
          {statusLabel(status)}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "12px",
          borderTop: "1px dashed rgba(255, 255, 255, 0.04)",
          paddingTop: "10px",
          fontSize: "11px"
        }}
      >
        <span style={{ color: "var(--gb-text-faint)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <FolderOpen size={12} />
            {evidenceCount > 0 ? `${evidenceCount} 份证据文件` : "暂无有效证据"}
          </span>
        </span>
        
        <span
          style={{
            fontSize: "10px",
            color: isRealUrl ? "var(--gb-ton-blue)" : "var(--gb-text-faint)",
            fontWeight: "bold"
          }}
        >
          {isRealUrl ? "链接可用" : "暂无公开链接"}
        </span>
      </div>
    </button>
  );
}
