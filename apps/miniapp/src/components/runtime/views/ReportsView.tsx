// Legacy runtime dashboard view. Not part of Pet Agent V1 primary navigation.
import React, { useMemo, useState } from "react";
import type { WorkReport, WorkRun } from "@growthbot/shared";
import type { ReportFilter, RuntimeState } from "../runtimeTypes";
import { EmptyState } from "..";
import { reportFilterLabels, reportFilters, stateEmptyCopy } from "../runtimeUtils";
import { WorkReportDetail } from "./WorkReportDetail";
import { WorkReportShareCard } from "../WorkReportShareCard";

function runMatchesFilter(run: WorkRun, report: WorkReport | null, filter: ReportFilter) {
  switch (filter) {
    case "Verified":
      return report?.verification?.status === "approved";
    case "Failed":
      return run.status === "failed" || report?.verification?.status === "rejected";
    case "Shared":
      return report?.share?.allowed === true;
    case "Pending Verification":
      return run.status === "verifying" || run.status === "waiting_signature" || report?.verification?.status === "verifying" || report?.verification?.status === "pending";
    default:
      return true;
  }
}

function emptyCopyForFilter(filter: ReportFilter) {
  switch (filter) {
    case "Failed":
      return { title: "No failed reports", description: "All runs executed within target policy constraints." };
    case "Shared":
      return { title: "No shared reports", description: "You haven't authorized public sharing of any evidence reports." };
    case "Pending Verification":
      return { title: "No reports pending verification", description: "All submitted reports have resolved." };
    case "Verified":
      return { title: "No verified reports", description: "Completed tasks will showcase audit results here." };
    default:
      return { title: "No reports available", description: stateEmptyCopy.noReport };
  }
}

export function ReportsView({
  state,
  openReport
}: {
  state: RuntimeState;
  openReport: (runId: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<ReportFilter>("All");

  const reports = useMemo(() => {
    return state.runs.filter((run) => {
      const cached = state.reportCache[run.id];
      const selected = state.selectedRun?.id === run.id ? state.selectedReport : null;
      return runMatchesFilter(run, cached || selected, filter);
    });
  }, [filter, state.reportCache, state.runs, state.selectedReport, state.selectedRun]);

  const emptyCopy = emptyCopyForFilter(filter);

  return (
    <section className="runtime-stack animate-fade-in" style={{ paddingBottom: "24px" }}>
      <div style={{ padding: "0 16px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "16px 0 4px" }}>Proof Gallery</h2>
        <p style={{ fontSize: "12px", color: "var(--gb-text-muted)", lineHeight: 1.4 }}>
          Audit trace and read-only projections of generated evidence, verification milestones, and policy decisions.
        </p>
      </div>

      {/* Filter Row */}
      <div className="gb-glass-card">
        <div className="filter-row">
          {reportFilters.map((item) => (
            <button
              key={item}
              className={item === filter ? "active" : ""}
              onClick={() => setFilter(item)}
              style={{
                padding: "6px 12px",
                fontSize: "11px",
                borderRadius: "8px",
                cursor: "pointer",
                background: item === filter ? "var(--gb-ton-blue)" : "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: item === filter ? "#fff" : "var(--gb-text-soft)"
              }}
            >
              {reportFilterLabels[item]}
            </button>
          ))}
        </div>
      </div>

      {/* Reports List */}
      <div className="gb-glass-card">
        <div className="gb-glass-card-header">
          <h3>Evidence Archive</h3>
        </div>
        {reports.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {reports.map((run) => {
              const cached = state.reportCache[run.id];
              const selected = state.selectedRun?.id === run.id ? state.selectedReport || run : run;
              const activeItem = selected || cached;
              return (
                <WorkReportShareCard
                  key={run.id}
                  report={activeItem}
                  onOpen={() => openReport(run.id)}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState title={emptyCopy.title} description={emptyCopy.description} />
        )}
      </div>

      {/* Report Detail Display */}
      {state.selectedRun && (
        <WorkReportDetail
          run={state.selectedRun}
          steps={state.selectedSteps}
          report={state.selectedReport}
        />
      )}
    </section>
  );
}

// Compatibility: Agent 战报中心, 筛选, 战报列表

