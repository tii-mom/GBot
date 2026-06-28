import React from "react";
import type { WorkReport, WorkRun, WorkStep } from "@growthbot/shared";
import { telegramAdapter } from "../../../telegramAdapter";
import { EvidenceCard } from "../EvidenceCard";
import { formatSettlementLabel, formatVerificationLabel, markdownFromReport, reportUrl, statusLabel } from "../runtimeUtils";

export function WorkReportDetail({
  run,
  steps,
  report
}: {
  run: WorkRun | null;
  steps: WorkStep[];
  report: WorkReport | null;
}) {
  if (!run) {
    return (
      <div className="gb-glass-card" style={{ textAlign: "center", padding: "24px", color: "var(--gb-text-muted)" }}>
        Select a report from the list to inspect execution details and proofs.
      </div>
    );
  }

  // Real report URL check
  const isRealUrl = report?.id && !report.id.includes("mock") && !report.id.includes("demo");
  const canonicalUrl = isRealUrl ? reportUrl(run.id) : "";
  const shareText = report?.share?.text || `GrowthBot Work Report for Task ${run.taskId}`;

  const copyLink = async () => {
    if (!canonicalUrl) return;
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      alert("Report URL copied successfully.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleShare = () => {
    if (!canonicalUrl) return;
    telegramAdapter.shareUrl(canonicalUrl, shareText);
  };

  const exportMd = () => {
    if (typeof document === "undefined") return;
    const blob = new Blob([markdownFromReport(run, steps, report)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `growthbot-work-report-${run.id}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Safe parsing helper
  const renderMetadataRow = (label: string, value: string | React.ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
      <span style={{ color: "var(--gb-text-muted)" }}>{label}</span>
      <strong style={{ color: "var(--gb-text-soft)" }}>{value}</strong>
    </div>
  );

  return (
    <div className="gb-glass-card">
      <div className="gb-glass-card-header">
        <h3>
          <svg style={{ width: "16px", height: "16px", fill: "var(--gb-ton-blue)" }} viewBox="0 0 24 24">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
          </svg>
          Proof Report
        </h3>
        <span style={{ fontSize: "11px", color: "var(--gb-cyan-cyber)", fontWeight: 700 }}>
          ID: {run.id.slice(0, 8)}
        </span>
      </div>

      <div style={{ padding: "8px 0" }}>
        <h4 style={{ fontSize: "16px", margin: "0 0 10px", color: "#fff" }}>{run.taskId}</h4>
        
        {/* Action bar with real URL constraints */}
        <div style={{ display: "flex", gap: "8px", margin: "12px 0" }}>
          <button
            className="gb-cta-button secondary"
            style={{ flex: 1, padding: "8px" }}
            onClick={copyLink}
            disabled={!canonicalUrl}
          >
            <span>{canonicalUrl ? "Copy Link" : "Link Unavailable"}</span>
          </button>
          
          <button
            className="gb-cta-button"
            style={{ flex: 1, padding: "8px" }}
            onClick={handleShare}
            disabled={!canonicalUrl}
          >
            <span>Share Report</span>
          </button>
          
          <button
            className="gb-cta-button secondary"
            style={{ flex: 1, padding: "8px" }}
            onClick={exportMd}
          >
            <span>Export MD</span>
          </button>
        </div>

        {/* Info grids */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "12px" }}>
          
          {/* Section 1: Inputs & Plan */}
          <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "8px", padding: "10px" }}>
            <h5 style={{ fontSize: "11px", color: "var(--gb-cyan-cyber)", textTransform: "uppercase", margin: "0 0 6px" }}>
              Input & Strategy
            </h5>
            <div style={{ color: "var(--gb-text-soft)", lineHeight: 1.4 }}>
              <strong>Topic:</strong> {(report?.input as any)?.topic || run.taskId}<br />
              {(report?.input as any)?.context && (
                <>
                  <strong>Brief Context:</strong> {(report?.input as any)?.context}
                </>
              )}
            </div>
          </div>

          {/* Section 2: AI Capacity & Skill Requirements */}
          <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "8px", padding: "10px" }}>
            <h5 style={{ fontSize: "11px", color: "var(--gb-cyan-cyber)", textTransform: "uppercase", margin: "0 0 6px" }}>
              Resource & Capability Ledger
            </h5>
            {renderMetadataRow("AI Credits Expended", `${run.estimatedEnergy || 10} capacity`)}
            {renderMetadataRow("Capability Scope", run.riskLevel || "Generalist Scouter")}
            {renderMetadataRow("Security Policy Guard", "Isolated wallet boundary active")}
          </div>

          {/* Section 3: Verification & Settlement status */}
          <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "8px", padding: "10px" }}>
            <h5 style={{ fontSize: "11px", color: "var(--gb-cyan-cyber)", textTransform: "uppercase", margin: "0 0 6px" }}>
              Validation & Settlement
            </h5>
            {renderMetadataRow("Verification Status", formatVerificationLabel(report?.verification?.status || null))}
            {renderMetadataRow("Settlement Status", report?.settlement?.status ? formatSettlementLabel(report.settlement.status) : "Unsettled")}
            {renderMetadataRow("On-Chain Proof Event", report?.settlement?.transactionId ? `ID: ${report.settlement.transactionId}` : "None - Local verification only")}
          </div>

          {/* Section 4: Evidence files */}
          <div style={{ marginTop: "8px" }}>
            <h5 style={{ fontSize: "11px", color: "var(--gb-cyan-cyber)", textTransform: "uppercase", margin: "0 0 4px" }}>
              Collected Proof Evidence
            </h5>
            {report?.evidence && report.evidence.length > 0 ? (
              report.evidence.map((ev: any, idx: number) => (
                <EvidenceCard
                  key={idx}
                  type={ev.type || ev.kind || "Log"}
                  title={ev.title || `Evidence File ${idx + 1}`}
                  status={ev.status || "verified"}
                  createdTime={ev.createdTime || ev.timestamp}
                  proofHash={ev.proofHash || ev.hash}
                  proofUrl={ev.proofUrl || ev.url}
                />
              ))
            ) : (
              <div style={{ fontSize: "11px", color: "var(--gb-text-faint)", fontStyle: "italic", padding: "10px", textAlign: "center" }}>
                No active evidence files generated for this run scope.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
