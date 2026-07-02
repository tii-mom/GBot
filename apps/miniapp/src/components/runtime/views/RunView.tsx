import { AlertTriangle } from "lucide-react";
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
            当前没有执行中的任务
          </div>
          <p style={{ fontSize: "12px", color: "var(--gb-text-faint)", lineHeight: 1.4, margin: "0 0 20px" }}>
            请先在任务机会中选择一项任务，再授权 Agent 执行。
          </p>
        </div>
      </section>
    );
  }

  const canonicalSteps = [
    { key: "analyze", label: "任务分析", desc: "读取任务要求并匹配能力目录" },
    { key: "qualify", label: "资格校验", desc: "完成风险与策略守卫校验" },
    { key: "plan", label: "生成执行计划", desc: "Agent 生成分步执行建议" },
    { key: "prepare_output", label: "产出草稿", desc: "调用模型能力完成内容工作" },
    { key: "wait_user_confirm", label: "等待用户确认", desc: "继续前需要用户确认授权" },
    { key: "submit", label: "提交与打包", desc: "将结果上传到证据目录" },
    { key: "verify", label: "验证检查", desc: "根据验证规则审计证明材料" },
    { key: "settle", label: "结算", desc: "完成任务结算与资源记录" }
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
        <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "16px 0 4px" }}>执行中的任务</h2>
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
              <span style={{display:'inline-flex', alignItems:'center', gap:'6px', color:'var(--danger)'}}><AlertTriangle size={16} /> 需要确认执行计划</span>
            </h3>
          </div>
          <div style={{ fontSize: "12px", color: "var(--gb-text-soft)", display: "flex", flexDirection: "column", gap: "10px" }}>
            <p>
              Agent 已生成执行计划。涉及真实资产策略约束时，需要先确认资源预算再继续执行：
            </p>
            <div className="task-opp-details-grid plan-review-details-box">
              <div className="task-opp-detail-item">
                <span>预计模型能量</span>
                <strong style={{ color: "var(--gb-amber-pulse)" }}>{activeRun.estimatedEnergy || 10} Credits</strong>
              </div>
              <div className="task-opp-detail-item">
                <span>钱包安全保护</span>
                <strong>隔离授权已启用</strong>
              </div>
            </div>
            <p style={{ fontStyle: "italic", fontSize: "11px", color: "var(--gb-text-muted)" }}>
              * 确认后，Agent 将在上述预算范围内使用模型能量。
            </p>
            <button
              className="gb-cta-button plan-review-button"
              onClick={() => handleRunAction(apiClient.approveStep)}
              disabled={actionLoading}
            >
              <span>确认并签署执行计划</span>
              <small>继续生成结果并进入验证流程</small>
            </button>
          </div>
        </div>
      )}

      {/* 8-Step Timeline */}
      <div className="gb-glass-card">
        <div className="gb-glass-card-header">
          <h3>Agent 执行时间线</h3>
          {loadingSteps && <span style={{ fontSize: "10px", color: "var(--gb-cyan-cyber)" }}>正在加载执行记录...</span>}
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
          <h3>任务控制</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {canResumeRun(activeRun) && (
            <button
              className="gb-cta-button"
              disabled={actionLoading}
              onClick={() => handleRunAction(apiClient.resumeWorkRun)}
            >
              <span>继续任务</span>
            </button>
          )}

          {canPauseRun(activeRun) && (
            <button
              className="gb-cta-button secondary"
              disabled={actionLoading}
              onClick={() => handleRunAction(apiClient.pauseWorkRun)}
            >
              <span>暂停执行</span>
            </button>
          )}

          {canRetryRun(activeRun, steps) && (
            <button
              className="gb-cta-button"
              style={{ background: "var(--gb-primary-neon)" }}
              disabled={actionLoading}
              onClick={() => handleRunAction(apiClient.retryStep)}
            >
              <span>重试失败步骤</span>
            </button>
          )}

          {canCancelRun(activeRun) && (
            <button
              className="gb-cta-button danger"
              disabled={actionLoading}
              onClick={() => handleRunAction(apiClient.cancelWorkRun)}
            >
              <span>终止任务</span>
              <small>停止执行，并释放未使用预算</small>
            </button>
          )}
          
          <div style={{ fontSize: "11px", color: "var(--gb-text-faint)", textAlign: "center", marginTop: "4px" }}>
            所有操作指令都会先经过策略守卫校验。
          </div>
        </div>
      </div>
    </section>
  );

  function handleRunAction(apiCall: (id: string) => Promise<any>) {
    handleAction(() => apiCall(activeRun!.id));
  }
}
