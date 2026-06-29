// Legacy runtime dashboard view. Not part of Pet Agent V1 primary navigation.
import React, { useEffect, useState } from "react";
import type { WorkRun, WorkStep } from "@growthbot/shared";
import { apiClient } from "../../../apiClient";
import {
  canApproveRun,
  canCancelRun,
  canPauseRun,
  canResumeRun,
  canRetryRun,
  statusLabel
} from "../runtimeUtils";

export function RunView({
  activeRun,
  onReload
}: {
  activeRun: WorkRun | null;
  onReload: () => Promise<void>;
}) {
  const [steps, setSteps] = useState<WorkStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Load steps for active run if it exists
  useEffect(() => {
    if (!activeRun) {
      setSteps([]);
      return;
    }

    let isMounted = true;
    const fetchSteps = async () => {
      setLoadingSteps(true);
      try {
        const res = await apiClient.getWorkRunSteps(activeRun.id);
        if (isMounted) {
          setSteps(res.steps || []);
        }
      } catch (err) {
        console.error("Failed to load run steps:", err);
      } finally {
        if (isMounted) setLoadingSteps(false);
      }
    };

    fetchSteps();

    return () => {
      isMounted = false;
    };
  }, [activeRun]);

  const handleAction = async (actionFn: () => Promise<any>) => {
    setActionLoading(true);
    try {
      await actionFn();
      await onReload();
    } catch (err) {
      console.error(err);
      alert("State transition action failed. Please check network state.");
    } finally {
      setActionLoading(false);
    }
  };

  if (!activeRun) {
    return (
      <section className="runtime-stack animate-fade-in" style={{ padding: "32px 16px", textAlign: "center" }}>
        <div className="gb-glass-card" style={{ padding: "40px 24px" }}>
          <div style={{ color: "var(--gb-text-muted)", fontSize: "14px", marginBottom: "16px" }}>
            No Active WorkRun in progress
          </div>
          <p style={{ fontSize: "12px", color: "var(--gb-text-faint)", lineHeight: 1.4, margin: "0 0 20px" }}>
            Select a job opportunity in the Tasks market to commission your Agent for execution.
          </p>
        </div>
      </section>
    );
  }

  // Define the canonical 8 steps
  const canonicalSteps = [
    { key: "analyze", label: "Analyze Task", desc: "Scan task requirements and query catalog specs" },
    { key: "qualify", label: "Verify Eligibility", desc: "Risk and Policy Guard eligibility check" },
    { key: "plan", label: "Generate Execution Plan", desc: "Agent formulates step-by-step proposal" },
    { key: "prepare_output", label: "Draft Output", desc: "AI capacity model executes content work" },
    { key: "wait_user_confirm", label: "Await User Confirmation", desc: "Requires user signature before proceeding" },
    { key: "submit", label: "Submit & Package", desc: "Payload upload to evidence directory" },
    { key: "verify", label: "Verification Check", desc: "Verification rules audit proof outputs" },
    { key: "settle", label: "Settlement", desc: "Finalize run, account AI Credits, disburse gas" }
  ];

  // Map active status to step key
  const statusToStepMap: Record<string, string> = {
    discovered: "analyze",
    analyzing: "analyze",
    qualified: "qualify",
    planning: "plan",
    executing: "prepare_output",
    waiting_user: "wait_user_confirm",
    submitting: "submit",
    waiting_signature: "submit",
    verifying: "verify",
    settling: "settle",
    completed: "settle"
  };

  // Helper to determine status of each step based on steps data or run status
  const getStepStatus = (stepKey: string, index: number) => {
    // If we have real steps from API, let's map by stepType
    const matchingStep = steps.find((s) => s.stepType === stepKey);
    if (matchingStep) {
      return matchingStep.status; // 'pending' | 'executing' | 'completed' | 'failed'
    }

    // Conservative mapping fallback if API steps aren't detailed
    const runStatus = activeRun.status;
    const mappedActiveKey = statusToStepMap[runStatus] || runStatus;
    const currentActiveIndex = canonicalSteps.findIndex((s) => s.key === mappedActiveKey);

    if (runStatus === "completed") return "completed";
    if (currentActiveIndex === -1) return "pending";
    if (index < currentActiveIndex) return "completed";
    if (index === currentActiveIndex) {
      return runStatus === "failed" ? "failed" : "executing";
    }
    return "pending";
  };

  const isAwaitingUser = activeRun.status === "waiting_user";

  return (
    <section className="runtime-stack animate-fade-in" style={{ paddingBottom: "24px" }}>
      <div style={{ padding: "0 16px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "16px 0 4px" }}>Active WorkRun</h2>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="run-view-id-strip">
            ID: {activeRun.id.slice(0, 12)}...
          </span>
          <span className={`agent-status-tag ${isAwaitingUser ? "waiting" : "working"}`}>
            {statusLabel(activeRun.status)}
          </span>
        </div>
      </div>

      {/* Plan Review Panel for User Confirmation */}
      {isAwaitingUser && (
        <div className="gb-glass-card plan-review-warning-card">
          <div className="gb-glass-card-header">
            <h3 className="plan-review-warning-title">
              ⚠️ Plan Review & Approval Required
            </h3>
          </div>
          <div style={{ fontSize: "12px", color: "var(--gb-text-soft)", display: "flex", flexDirection: "column", gap: "10px" }}>
            <p>
              Your Scouter Agent has generated a plan. Under real-asset policy constraints, you must confirm the resource allocation budget before execution:
            </p>
            <div className="task-opp-details-grid plan-review-details-box">
              <div className="task-opp-detail-item">
                <span>Estimated Energy Gas</span>
                <strong style={{ color: "var(--gb-amber-pulse)" }}>{activeRun.estimatedEnergy || 10} Credits</strong>
              </div>
              <div className="task-opp-detail-item">
                <span>Wallet Security Guard</span>
                <strong>Isolated Sweep Active</strong>
              </div>
            </div>
            <p style={{ fontStyle: "italic", fontSize: "11px", color: "var(--gb-text-muted)" }}>
              * Confirming this plan authorizes the Agent to spend the specified AI Credits.
            </p>
            <button
              className="gb-cta-button plan-review-button"
              onClick={() => handleCtaClick(apiClient.approveStep)}
              disabled={actionLoading}
            >
              <span>Approve & Sign Execution Plan</span>
              <small>Proceed to output generation and validation check</small>
            </button>
          </div>
        </div>
      )}

      {/* 8-Step Timeline */}
      <div className="gb-glass-card">
        <div className="gb-glass-card-header">
          <h3>Agent Processing Timeline</h3>
          {loadingSteps && <span style={{ fontSize: "10px", color: "var(--gb-cyan-cyber)" }}>Loading traces...</span>}
        </div>
        <div className="gb-timeline-container">
          {canonicalSteps.map((step, index) => {
            const status = getStepStatus(step.key, index);
            let statusClass = "";
            if (status === "completed") statusClass = "completed";
            else if (status === "executing") statusClass = "active";
            else if (status === "failed") statusClass = "failed";

            return (
              <div key={step.key} className={`gb-timeline-node ${statusClass}`}>
                <div className="gb-timeline-marker">
                  {status === "completed" ? "✓" : status === "failed" ? "✗" : index + 1}
                </div>
                <div className="gb-timeline-content">
                  <div className="gb-timeline-step-title">{step.label}</div>
                  <div className="gb-timeline-step-desc">{step.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Gating Controls */}
      <div className="gb-glass-card">
        <div className="gb-glass-card-header">
          <h3>Runtime Intent Controls</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {canResumeRun(activeRun) && (
            <button
              className="gb-cta-button"
              disabled={actionLoading}
              onClick={() => handleCtaClick(apiClient.resumeWorkRun)}
            >
              <span>Resume WorkRun</span>
            </button>
          )}

          {canPauseRun(activeRun) && (
            <button
              className="gb-cta-button secondary"
              disabled={actionLoading}
              onClick={() => handleCtaClick(apiClient.pauseWorkRun)}
            >
              <span>Pause Execution</span>
            </button>
          )}

          {canRetryRun(activeRun, steps) && (
            <button
              className="gb-cta-button"
              style={{ background: "var(--gb-primary-neon)" }}
              disabled={actionLoading}
              onClick={() => handleCtaClick(apiClient.retryStep)}
            >
              <span>Retry Failed Step</span>
            </button>
          )}

          {canCancelRun(activeRun) && (
            <button
              className="gb-cta-button danger"
              disabled={actionLoading}
              onClick={() => handleCtaClick(apiClient.cancelWorkRun)}
            >
              <span>Terminate Job</span>
              <small>Cancels run, refunds unspent gas</small>
            </button>
          )}
          
          <div style={{ fontSize: "11px", color: "var(--gb-text-faint)", textAlign: "center", marginTop: "4px" }}>
            Operational commands are sent to the Policy Guard for validation.
          </div>
        </div>
      </div>
    </section>
  );

  function handleCtaClick(apiCall: (id: string) => Promise<any>) {
    handleAction(() => apiCall(activeRun!.id));
  }
}
