import React, { useState, useEffect } from "react";
import {
  Zap,
  Play,
  Pause,
  XOctagon,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  UserCheck,
  ChevronRight,
  RefreshCw,
  FolderOpen,
  Share2,
  FileText,
  Layers,
  Cpu,
  Coins,
  HelpCircle,
  AlertCircle,
  CheckCircle,
  XCircle,
  ExternalLink
} from "lucide-react";
import type { Agent, User, WorkReport } from "@growthbot/shared";
import { apiClient } from "../apiClient";
import { telegramAdapter } from "../telegramAdapter";
import { translateRarity } from "../i18n";

interface AgentWorkViewProps {
  user: User;
  agent: Agent | null;
  t: (key: string, fallback: string) => string;
  onRefreshData?: () => Promise<void>;
}

export function AgentWorkView({ user, agent, t, onRefreshData }: AgentWorkViewProps) {
  const [activeRun, setActiveRun] = useState<any | null>(null);
  const [runSteps, setRunSteps] = useState<any[]>([]);
  const [runEvents, setRunEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // History tabs: "active" | "completed" | "failed" | "cancelled"
  const [historyTab, setHistoryTab] = useState<"completed" | "failed" | "cancelled">("completed");
  const [historyRuns, setHistoryRuns] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Selected run for detail drawer
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [selectedReport, setSelectedReport] = useState<WorkReport | null>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // 1. Fetch active run
  const fetchActiveWork = async () => {
    if (!agent) return;
    try {
      const res = await apiClient.getActiveWorkRun(agent.id);
      if (res && res.run) {
        setActiveRun(res.run);
        // Load steps & events
        const [stepsRes, eventsRes] = await Promise.all([
          apiClient.getWorkRunSteps(res.run.id),
          apiClient.getWorkRunEvents(res.run.id)
        ]);
        if (stepsRes && stepsRes.steps) setRunSteps(stepsRes.steps);
        if (eventsRes && eventsRes.events) setRunEvents(eventsRes.events);
      } else {
        setActiveRun(null);
        setRunSteps([]);
        setRunEvents([]);
      }
    } catch (err) {
      console.error("Failed to load active work run", err);
    }
  };

  // 2. Fetch history runs
  const fetchHistory = async () => {
    if (!agent) return;
    setLoadingHistory(true);
    try {
      const res = await apiClient.getWorkRuns(agent.id, historyTab);
      if (res && res.workRuns) {
        setHistoryRuns(res.workRuns);
      } else {
        setHistoryRuns([]);
      }
    } catch (err) {
      console.error("Failed to load history runs", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch initial data
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchActiveWork(), fetchHistory()]).finally(() => setLoading(false));
  }, [agent, historyTab]);

  // Polling active run if running
  useEffect(() => {
    let timer: any;
    const isTransitional = activeRun && [
      "discovered", "analyzing", "qualified", "planning",
      "queued", "executing", "submitting", "verifying"
    ].includes(activeRun.status);

    if (isTransitional) {
      timer = setInterval(() => {
        fetchActiveWork();
        if (onRefreshData) onRefreshData();
      }, 5000);
    }
    return () => clearInterval(timer);
  }, [activeRun]);

  // Load detail Work Report when selectedRun is set
  useEffect(() => {
    if (selectedRun) {
      setLoadingReport(true);
      setReportError(null);
      setSelectedReport(null);
      apiClient.getWorkReport(selectedRun.id)
        .then((res: any) => {
          if (res && res.report) {
            setSelectedReport(res.report);
          } else {
            setReportError(t("work.reportLoadError", "无法加载报告数据"));
          }
        })
        .catch((err: any) => {
          console.error(err);
          if (err.status === 401) {
            setReportError("401");
          } else if (err.status === 404) {
            setReportError("404");
          } else {
            setReportError(err.message || t("work.reportLoadError", "无法加载报告数据"));
          }
        })
        .finally(() => {
          setLoadingReport(false);
        });
    } else {
      setSelectedReport(null);
      setReportError(null);
    }
  }, [selectedRun]);

  if (!agent) {
    return (
      <div className="view-panel text-center flex-center flex-column" style={{ padding: "40px 20px" }}>
        <FolderOpen size={48} className="muted" />
        <h3 style={{ marginTop: "16px" }}>{t("work.noAgentTitle", "未绑定 Agent")}</h3>
        <p className="muted font-13">{t("work.noAgentDesc", "请先在首页绑定或领取您的 Agent，即可开始让其运行赏金和日常任务。")}</p>
      </div>
    );
  }

  // Handle flow controls
  const handleAction = async (action: () => Promise<any>, successMsg: string) => {
    if (!activeRun) return;
    setActionLoading(true);
    telegramAdapter.hapticImpact("medium");
    try {
      await action();
      telegramAdapter.showAlert(successMsg);
      await fetchActiveWork();
      await fetchHistory();
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      telegramAdapter.showAlert(err.message || t("work.actionFailed", "操作失败，请重试。"));
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "discovered": return t("status.discovered", "已发现任务");
      case "analyzing": return t("status.analyzing", "分析中");
      case "qualified": return t("status.qualified", "资格通过");
      case "rejected": return t("status.rejected", "不合规拒绝");
      case "planning": return t("status.planning", "规划步骤中");
      case "waiting_user": return t("status.waiting_user", "等待确认");
      case "queued": return t("status.queued", "排队中");
      case "executing": return t("status.executing", "执行中");
      case "waiting_signature": return t("status.waiting_signature", "等待签名");
      case "submitting": return t("status.submitting", "提交中");
      case "verifying": return t("status.verifying", "验证中");
      case "completed": return t("status.completed", "已完成");
      case "failed": return t("status.failed", "执行失败");
      case "cancelled": return t("status.cancelled", "已取消");
      case "paused": return t("status.paused", "暂停中");
      default: return status;
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 size={16} className="text-emerald" />;
      case "failed": return <AlertTriangle size={16} className="text-danger" />;
      case "waiting_approval": return <Clock size={16} className="text-amber animate-pulse" />;
      case "in_progress": return <Activity size={16} className="text-primary animate-pulse" />;
      default: return <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--border)" }} />;
    }
  };

  return (
    <div className="view-panel agent-work-view animate-fade-in" style={{ paddingBottom: "80px" }}>
      {/* 1. Header Info */}
      <div className="section-header flex-row align-center justify-between" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>{t("work.title", "工作台 Workbench")}</h2>
          <p className="muted font-12">{agent.name} {t("work.statusSubtitle", "正在自主规划和推进任务步骤。")}</p>
        </div>
        <button
          onClick={async () => {
            telegramAdapter.hapticImpact("light");
            setLoading(true);
            await Promise.all([fetchActiveWork(), fetchHistory()]);
            setLoading(false);
          }}
          disabled={loading}
          style={{ background: "transparent", border: "none", color: "var(--text-muted)" }}
        >
          <RefreshCw size={18} className={loading ? "spinning-icon" : ""} />
        </button>
      </div>

      {/* 2. Active Run Panel */}
      {activeRun ? (
        <div className="card active-run-card border-epic" style={{ padding: "16px", margin: "16px 0", borderRadius: "12px", background: "var(--card-bg)" }}>
          <div className="flex-row justify-between align-center" style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="eyebrow uppercase text-epic font-11">{t("work.activeRun", "当前执行计划")}</span>
            <span className={`rarity-tag ${activeRun.status === "paused" ? "common" : "epic"}`}>
              {getStatusText(activeRun.status)}
            </span>
          </div>

          <h3 style={{ margin: "8px 0 4px 0" }}>{activeRun.taskId.replace("task_", "").toUpperCase()}</h3>
          <p className="muted font-12" style={{ marginBottom: "12px" }}>
            {t("work.riskLabel", "风险评级")}: <span className={activeRun.riskLevel === "high" ? "text-danger" : "text-emerald"}>{activeRun.riskLevel.toUpperCase()}</span>
          </p>

          {/* Progress bar */}
          <div className="progress-track" style={{ height: "6px", margin: "8px 0" }}>
            <div className="progress-fill farm" style={{ width: `${activeRun.progress}%` }} />
          </div>
          <div className="flex-row justify-between font-11 muted" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{t("work.progress", "当前进度")} {activeRun.progress}%</span>
            <span>{activeRun.currentStep}/{activeRun.totalSteps} {t("work.stepsCount", "步")}</span>
          </div>

          {/* Estimates */}
          <div className="fomo-signal-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "10px", margin: "12px 0 0 0" }}>
            <div className="fomo-signal" style={{ padding: "6px 8px" }}>
              <Zap size={14} className="text-amber" />
              <strong>{activeRun.estimatedReward} GP</strong>
              <span>{t("work.rewardEst", "预计奖励")}</span>
            </div>
            <div className="fomo-signal" style={{ padding: "6px 8px" }}>
              <Activity size={14} className="text-primary" />
              <strong>{activeRun.estimatedEnergy}</strong>
              <span>{t("work.energyEst", "预计行动力")}</span>
            </div>
          </div>

          {/* Active Run Used Skills */}
          {activeRun.usedSkills && activeRun.usedSkills.length > 0 && (
            <div style={{ marginTop: "12px", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "12px" }}>
              <span className="font-11 text-white block mb-6" style={{ display: "block", marginBottom: "6px" }}>⚙️ {t("work.activeUsedSkills", "已加载 Runtime 技能")}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {activeRun.usedSkills.map((s: any) => (
                  <div key={s.skillDefinitionId} className="flex-row align-center justify-between font-11" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.2)", padding: "6px 8px", borderRadius: "6px" }}>
                    <div className="flex-row align-center gap-6" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="text-white font-bold">{s.name}</span>
                      <span className="font-10 text-amber font-mono" style={{ background: "rgba(212,163,89,0.1)", padding: "1px 4px", borderRadius: "3px" }}>
                        Lv.{s.level}
                      </span>
                    </div>
                    <span style={{
                      fontSize: "9px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: s.selectionRole === 'required' ? "rgba(168, 85, 247, 0.15)" : "rgba(59, 130, 246, 0.15)",
                      color: s.selectionRole === 'required' ? "#c084fc" : "#60a5fa"
                    }}>
                      {s.selectionRole === 'required' ? t("work.roleRequired", "Required") : t("work.roleRecommended", "Recommended")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex-row gap-8" style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
            {activeRun.status === "waiting_user" && (
              <button
                className="primary action-btn flex-row align-center gap-6"
                style={{ flex: 1 }}
                disabled={actionLoading}
                onClick={() => handleAction(() => apiClient.approveStep(activeRun.id), t("work.approvedAlert", "已确认下一步，Agent 继续工作。"))}
              >
                <UserCheck size={16} /> {t("work.approveNext", "确认下一步")}
              </button>
            )}

            {activeRun.status === "failed" && (
              <button
                className="primary action-btn flex-row align-center gap-6"
                style={{ flex: 1 }}
                disabled={actionLoading}
                onClick={() => handleAction(() => apiClient.retryStep(activeRun.id), t("work.retryingAlert", "重试指令已下达。"))}
              >
                <RotateCw size={16} /> {t("work.retryStep", "重试失败步骤")}
              </button>
            )}

            {activeRun.status === "paused" ? (
              <button
                className="secondary action-btn flex-row align-center gap-6"
                style={{ flex: 1 }}
                disabled={actionLoading}
                onClick={() => handleAction(() => apiClient.resumeWorkRun(activeRun.id), t("work.resumedAlert", "Agent 已恢复工作。"))}
              >
                <Play size={16} /> {t("work.resume", "恢复工作")}
              </button>
            ) : (
              !["completed", "failed", "cancelled"].includes(activeRun.status) && (
                <button
                  className="secondary action-btn flex-row align-center gap-6"
                  style={{ flex: 1 }}
                  disabled={actionLoading}
                  onClick={() => handleAction(() => apiClient.pauseWorkRun(activeRun.id), t("work.pausedAlert", "工作已暂停。"))}
                >
                  <Pause size={16} /> {t("work.pause", "暂停")}
                </button>
              )
            )}

            {!["completed", "failed", "cancelled"].includes(activeRun.status) && (
              <button
                className="danger action-btn flex-row align-center gap-6"
                disabled={actionLoading}
                onClick={() => handleAction(() => apiClient.cancelWorkRun(activeRun.id), t("work.cancelledAlert", "工作计划已取消。"))}
              >
                <XOctagon size={16} /> {t("work.cancel", "放弃")}
              </button>
            )}
          </div>

          {/* Stepper details */}
          <div className="stepper-section" style={{ marginTop: "20px" }}>
            <h4 className="font-13" style={{ marginBottom: "12px" }}>{t("work.stepsDetail", "执行步骤进度")}</h4>
            <div className="steps-wrapper" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {runSteps.map((step) => (
                <div key={step.id} className="flex-row align-start gap-8 font-12" style={{ display: "flex", gap: "8px" }}>
                  <div style={{ marginTop: "2px" }}>{getStepIcon(step.status)}</div>
                  <div style={{ flex: 1 }}>
                    <div className="flex-row justify-between" style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong>{step.stepOrder}. {step.title}</strong>
                      <span className="muted font-10 uppercase">{step.status.replace("_", " ")}</span>
                    </div>
                    {step.description && <p className="muted font-11" style={{ margin: "2px 0 0 0" }}>{step.description}</p>}
                    {step.outputSummary && (
                      <div style={{ background: "rgba(0,0,0,0.15)", padding: "4px 8px", borderRadius: "4px", marginTop: "4px", fontSize: "10px" }} className="monospace text-muted">
                        Output: {step.outputSummary}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline events logs */}
          {runEvents.length > 0 && (
            <div className="events-log-section" style={{ marginTop: "20px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
              <h4 className="font-13" style={{ marginBottom: "10px" }}>{t("work.timeline", "Agent 日记 (事件流)")}</h4>
              <div className="events-log-wrapper" style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "150px", overflowY: "auto", paddingRight: "4px" }}>
                {runEvents.map((evt) => (
                  <div key={evt.id} className="font-11" style={{ borderLeft: "2px solid var(--primary)", paddingLeft: "8px" }}>
                    <span className="muted font-9">{new Date(evt.createdAt).toLocaleTimeString()}</span> - <strong>{evt.title}</strong>
                    {evt.message && <p className="muted font-10" style={{ margin: "2px 0 0 0" }}>{evt.message}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card text-center flex-center flex-column" style={{ padding: "30px 16px", margin: "16px 0", borderRadius: "12px" }}>
          <Activity size={32} className="muted animate-pulse" />
          <h4 style={{ marginTop: "12px" }}>{t("work.idleTitle", "Agent 空闲中")}</h4>
          <p className="muted font-12" style={{ margin: "6px 0 12px 0" }}>
            {t("work.idleDesc", "当前无正在运行的工作计划。你可以前往“任务 Missions”页面领取新的赏金，或者指派 Agent 自动扫描。")}
          </p>
        </div>
      )}

      {/* 3. History Tabs Section */}
      <div className="history-tab-section" style={{ marginTop: "24px" }}>
        <h3>{t("work.historyTitle", "历史运行记录")}</h3>

        {/* tabs */}
        <div className="tab-header flex-row" style={{ display: "flex", gap: "6px", margin: "12px 0" }}>
          {(["completed", "failed", "cancelled"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setHistoryTab(tab)}
              className={historyTab === tab ? "active" : ""}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: "600",
                background: historyTab === tab ? "var(--primary)" : "var(--card-bg)",
                border: "none",
                color: historyTab === tab ? "#000" : "var(--text)"
              }}
            >
              {getStatusText(tab)}
            </button>
          ))}
        </div>

        {/* lists */}
        {loadingHistory ? (
          <div className="text-center muted font-12" style={{ padding: "20px" }}>
            <RefreshCw className="spinning-icon" size={16} /> {t("work.loadingHistory", "正在加载历史记录...")}
          </div>
        ) : historyRuns.length === 0 ? (
          <div className="text-center muted font-12" style={{ padding: "30px 10px" }}>
            {t("work.noHistory", "暂无对应类型的历史任务记录。")}
          </div>
        ) : (
          <div className="history-list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {historyRuns.map((run) => (
              <div
                key={run.id}
                className="history-row flex-row align-center justify-between"
                onClick={() => setSelectedRun(run)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "var(--card-bg)",
                  padding: "12px",
                  borderRadius: "8px",
                  cursor: "pointer"
                }}
              >
                <div>
                  <strong className="font-13">{run.taskId.replace("task_", "").toUpperCase()}</strong>
                  <div className="muted font-10 flex-row gap-8" style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    <span>GP: +{run.actualReward}</span>
                    <span>Energy: -{run.actualEnergy}</span>
                  </div>
                </div>
                <div className="flex-row align-center gap-4 muted font-11" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span>{new Date(run.completedAt || run.createdAt).toLocaleDateString()}</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. selected run detail drawer */}
      {selectedRun && (
        <div className="modal-backdrop active-modal" onClick={() => setSelectedRun(null)}>
          <div className="modal-content text-left animate-scale-in" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "88vh", overflowY: "auto", width: "95%", maxWidth: "520px", padding: "20px", borderRadius: "16px", background: "var(--card-bg)" }}>
            <div className="modal-header flex-row justify-between align-center" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
              <div>
                <h3 className="font-15 text-white font-bold">{t("work.reportTitle", "工作数据战报")}</h3>
                <span className="font-9 text-muted font-mono" style={{ opacity: 0.6 }}>{selectedRun.id}</span>
              </div>
              <button className="close-btn" onClick={() => setSelectedRun(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", padding: "4px" }}>
                <XCircle size={18} />
              </button>
            </div>

            {loadingReport ? (
              <div className="text-center flex-center flex-column" style={{ padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <RefreshCw className="spinning-icon text-primary" size={24} />
                <p className="muted font-11" style={{ marginTop: "12px" }}>{t("work.loadingReport", "正在安全投影计算，生成工作战报...")}</p>
              </div>
            ) : reportError ? (
              <div className="text-center flex-center flex-column text-danger" style={{ padding: "30px 10px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <AlertCircle size={32} />
                <h4 style={{ marginTop: "12px", fontSize: "14px" }}>
                  {reportError === "401"
                    ? t("work.err401", "未授权访问 (401)")
                    : reportError === "404"
                      ? t("work.err404", "工作记录未找到或越权 (404)")
                      : t("work.errLoad", "无法加载报告数据")}
                </h4>
                <p className="muted font-10" style={{ marginTop: "6px" }}>{reportError !== "401" && reportError !== "404" ? reportError : ""}</p>
              </div>
            ) : selectedReport ? (
              <div className="report-body font-12 flex-column gap-12" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* 1. Header Outcome */}
                <div style={{
                  background: selectedReport.kind === 'simulation'
                    ? "rgba(148,163,184,0.06)"
                    : selectedReport.overallStatus === 'completed'
                      ? "rgba(16,185,129,0.06)"
                      : selectedReport.overallStatus.includes("failed")
                        ? "rgba(239,68,68,0.06)"
                        : "rgba(245,158,11,0.06)",
                  border: `1px solid ${
                    selectedReport.kind === 'simulation'
                      ? "rgba(148,163,184,0.15)"
                      : selectedReport.overallStatus === 'completed'
                        ? "rgba(16,185,129,0.15)"
                        : selectedReport.overallStatus.includes("failed")
                          ? "rgba(239,68,68,0.15)"
                          : "rgba(245,158,11,0.15)"
                  }`,
                  padding: "12px",
                  borderRadius: "10px"
                }}>
                  <div className="flex-row justify-between align-center" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="font-13 text-white font-bold">{selectedReport.title.replace("task_", "").toUpperCase()}</span>
                    <span className={`rarity-tag ${
                      selectedReport.kind === 'simulation'
                        ? "common"
                        : selectedReport.overallStatus === 'completed'
                          ? "epic"
                          : "rare"
                    }`} style={{ fontSize: "9px", padding: "2px 6px" }}>
                      {selectedReport.kind === 'simulation'
                        ? "Simulation"
                        : selectedReport.kind === 'verified_runtime_work'
                          ? "Verified Runtime Work"
                          : selectedReport.kind === 'runtime_unsettled'
                            ? "Runtime Unsettled"
                            : selectedReport.kind === 'runtime_work'
                              ? "Runtime Work"
                              : "External"}
                    </span>
                  </div>
                  <div className="muted font-10" style={{ marginTop: "6px", display: "flex", justifyContent: "space-between" }}>
                    <span>Agent: {agent.name}</span>
                    <span>
                      {selectedReport.startedAt && new Date(selectedReport.startedAt).toLocaleDateString()}{" "}
                      {selectedReport.startedAt && new Date(selectedReport.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="muted font-10" style={{ margin: "4px 0 0 0" }}>
                    <strong>{t("work.overallStatus", "整体状态")}:</strong>{" "}
                    <span style={{
                      color: selectedReport.overallStatus === 'completed' ? "#10b981" : selectedReport.overallStatus.includes("failed") ? "#ef4444" : "#f59e0b",
                      fontWeight: "bold"
                    }}>
                      {selectedReport.overallStatus.toUpperCase()}
                    </span>
                  </p>
                  {selectedReport.kind === 'simulation' && (
                    <div className="font-9 text-slate" style={{ marginTop: "6px", background: "rgba(255,255,255,0.03)", padding: "4px 6px", borderRadius: "4px" }}>
                      * {t("work.simNote", "模拟任务 — 不计入正式工作履历，仅用于路径模拟调试。")}
                    </div>
                  )}
                </div>

                {/* Warnings */}
                {selectedReport.warnings.length > 0 && (
                  <div style={{ background: "rgba(239,68,68,0.03)", border: "1px dashed rgba(239,68,68,0.2)", padding: "8px 10px", borderRadius: "8px" }}>
                    <div className="flex-row align-center gap-4 text-danger font-bold font-10" style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                      <AlertTriangle size={12} />
                      <span>{t("work.warningsTitle", "数据投影一致性告警")}</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "14px" }} className="font-9 text-danger font-mono">
                      {selectedReport.warnings.slice(0, 3).map((w, idx) => (
                        <li key={idx}>[{w.code}] {w.message}</li>
                      ))}
                      {selectedReport.warnings.length > 3 && (
                        <li>... and {selectedReport.warnings.length - 3} more warnings.</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* 2. Overview Metrics */}
                <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", padding: "10px", borderRadius: "8px" }}>
                  <h4 className="font-10 text-muted uppercase font-bold" style={{ marginBottom: "6px" }}>{t("work.metricsTitle", "执行成本与模型资源")}</h4>
                  <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div style={{ background: "rgba(0,0,0,0.12)", padding: "6px 8px", borderRadius: "5px" }}>
                      <div className="font-9 text-slate">{t("work.metricsTokens", "消耗 Token 总量")}</div>
                      <div className="font-12 text-white font-mono font-bold" style={{ marginTop: "1px" }}>
                        {selectedReport.metrics.totalTokens.toLocaleString()}
                      </div>
                      <div className="font-8 text-slate" style={{ opacity: 0.6 }}>
                        In: {selectedReport.metrics.inputTokens} | Out: {selectedReport.metrics.outputTokens}
                      </div>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.12)", padding: "6px 8px", borderRadius: "5px" }}>
                      <div className="font-9 text-slate">{t("work.metricsCost", "模型估算成本")}</div>
                      <div className="font-12 text-white font-mono font-bold" style={{ marginTop: "1px" }}>
                        ${(selectedReport.metrics.estimatedCostUsdMicros / 1000000).toFixed(4)}
                      </div>
                      <div className="font-8 text-slate" style={{ opacity: 0.6 }}>
                        {selectedReport.metrics.estimatedCostUsdMicros.toLocaleString()} micros
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Steps Timeline */}
                <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", padding: "10px", borderRadius: "8px" }}>
                  <h4 className="font-10 text-muted uppercase font-bold" style={{ marginBottom: "8px" }}>{t("work.timeline", "计划执行步骤")}</h4>
                  {selectedReport.steps.length === 0 ? (
                    <div className="muted font-10 text-center" style={{ padding: "6px" }}>{t("work.noSteps", "无步骤记录")}</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {selectedReport.steps.map((step) => (
                        <div key={step.id} className="flex-row align-start gap-6 font-10" style={{ display: "flex", gap: "6px", borderBottom: "1px solid rgba(255,255,255,0.02)", paddingBottom: "6px" }}>
                          <div style={{ marginTop: "1px" }}>{getStepIcon(step.status)}</div>
                          <div style={{ flex: 1 }}>
                            <div className="flex-row justify-between" style={{ display: "flex", justifyContent: "space-between" }}>
                              <strong className="text-white">{step.sequence}. {step.name}</strong>
                              <span className="muted font-9 uppercase">{step.status}</span>
                            </div>
                            {step.description && <p className="muted font-9" style={{ margin: "1px 0 0 0", opacity: 0.8 }}>{step.description}</p>}
                            {step.errorMessage && (
                              <p className="text-danger font-mono font-9" style={{ margin: "2px 0 0 0", background: "rgba(239,68,68,0.04)", padding: "2px 4px", borderRadius: "3px" }}>
                                Error: {step.errorMessage}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Runtime & Recovery Executions Chain */}
                <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", padding: "10px", borderRadius: "8px" }}>
                  <div className="flex-row justify-between align-center" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <h4 className="font-10 text-muted uppercase font-bold" style={{ margin: 0 }}>{t("work.runtimeChain", "模型调用与 Recovery 恢复链")}</h4>
                    <span className="font-8 text-slate font-mono" style={{ opacity: 0.5 }}>depth_limit = 2</span>
                  </div>
                  {selectedReport.runtimeExecutions.length === 0 ? (
                    <div className="muted font-10 text-center" style={{ padding: "6px" }}>{t("work.noExecutions", "无调用链路数据")}</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {selectedReport.runtimeExecutions.map((exec) => {
                        const isRecovery = exec.recoveryOfExecutionId !== null;
                        return (
                          <div
                            key={exec.executionId}
                            style={{
                              marginLeft: isRecovery ? "12px" : "0",
                              borderLeft: isRecovery ? "1.5px solid var(--primary)" : "none",
                              paddingLeft: isRecovery ? "6px" : "0",
                              background: exec.isFinalEffectiveExecution ? "rgba(16,185,129,0.02)" : "rgba(0,0,0,0.1)",
                              border: exec.isFinalEffectiveExecution ? "1px solid rgba(16,185,129,0.15)" : "1px solid rgba(255,255,255,0.02)",
                              padding: "6px 8px",
                              borderRadius: "5px"
                            }}
                          >
                            <div className="flex-row justify-between" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span className="font-bold text-white font-mono font-9">
                                {isRecovery ? `└─ Recovery Attempt #${exec.attemptNumber}` : `Produce Attempt #${exec.attemptNumber}`}
                              </span>
                              <div className="flex-row gap-4 align-center" style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                {exec.isFinalEffectiveExecution && (
                                  <span className="font-8 text-emerald" style={{ background: "rgba(16,185,129,0.08)", padding: "1px 3px", borderRadius: "2px" }}>
                                    {t("work.finalEffective", "最终有效产出")}
                                  </span>
                                )}
                                <span className={`rarity-tag ${exec.status === 'completed' ? 'epic' : 'common'}`} style={{ fontSize: "8px", padding: "1px 3px" }}>
                                  {exec.status}
                                </span>
                              </div>
                            </div>
                            <div className="muted font-9" style={{ marginTop: "3px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px" }}>
                              <div>Model: <span className="font-mono text-white">{exec.modelName || "unknown"}</span></div>
                              <div>Tokens: <span className="font-mono text-white">{exec.totalTokens}</span></div>
                              <div>Cost: <span className="font-mono text-white">${(exec.estimatedCostUsdMicros / 1000000).toFixed(4)}</span></div>
                              {exec.errorCode && <div className="text-danger font-mono font-9">ErrCode: {exec.errorCode}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 5. Used Skills */}
                {selectedReport.skillUsages.length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", padding: "10px", borderRadius: "8px" }}>
                    <h4 className="font-10 text-muted uppercase font-bold" style={{ marginBottom: "6px" }}>{t("work.usedSkills", "消耗技能统计")}</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {selectedReport.skillUsages.map((usage) => (
                        <div key={usage.usageId} className="flex-row align-center justify-between font-10" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.12)", padding: "4px 6px", borderRadius: "5px" }}>
                          <div>
                            <span className="text-white font-bold">{usage.skillName}</span>
                            {usage.learnedLevel && (
                              <span className="font-8 text-amber font-mono" style={{ marginLeft: "4px", background: "rgba(212,163,89,0.08)", padding: "1px 2px", borderRadius: "2px" }}>
                                Lv.{usage.learnedLevel}
                              </span>
                            )}
                          </div>
                          <div className="flex-row gap-4 align-center" style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                            <span className="font-8 font-mono text-slate" style={{ opacity: 0.6 }}>
                              ${(usage.estimatedCostUsdMicros / 1000000).toFixed(4)}
                            </span>
                            <span style={{
                              fontSize: "8px",
                              padding: "1px 3px",
                              borderRadius: "2px",
                              background: usage.selectionRole === 'required' ? "rgba(168, 85, 247, 0.1)" : "rgba(59, 130, 246, 0.1)",
                              color: usage.selectionRole === 'required' ? "#c084fc" : "#60a5fa"
                            }}>
                              {usage.selectionRole}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Verification & Settlement Audit */}
                <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", padding: "10px", borderRadius: "8px" }}>
                  <h4 className="font-10 text-muted uppercase font-bold" style={{ marginBottom: "6px" }}>{t("work.auditSection", "核验与账目清算")}</h4>
                  <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {/* Verification */}
                    <div style={{ background: "rgba(0,0,0,0.12)", padding: "6px 8px", borderRadius: "5px" }}>
                      <div className="font-9 text-slate">{t("work.verification", "Verification 校验结果")}</div>
                      <div className="font-11 text-white font-bold" style={{ marginTop: "3px", display: "flex", alignItems: "center", gap: "3px" }}>
                        {selectedReport.verification.status === "passed" ? (
                          <>
                            <CheckCircle size={12} className="text-emerald" />
                            <span className="text-emerald">PASSED</span>
                          </>
                        ) : selectedReport.verification.status === "failed" ? (
                          <>
                            <XCircle size={12} className="text-danger" />
                            <span className="text-danger">FAILED</span>
                          </>
                        ) : (
                          <>
                            <HelpCircle size={12} className="text-amber" />
                            <span className="text-amber">{selectedReport.verification.status.toUpperCase()}</span>
                          </>
                        )}
                      </div>
                      {selectedReport.verification.reasonCode && (
                        <div className="font-8 text-slate font-mono" style={{ marginTop: "1px", opacity: 0.6 }}>
                          Reason: {selectedReport.verification.reasonCode}
                        </div>
                      )}
                    </div>

                    {/* Settlement */}
                    <div style={{ background: "rgba(0,0,0,0.12)", padding: "6px 8px", borderRadius: "5px" }}>
                      <div className="font-9 text-slate">{t("work.settlement", "Settlement 清算结算")}</div>
                      <div className="font-11 text-white font-bold" style={{ marginTop: "3px", display: "flex", alignItems: "center", gap: "3px" }}>
                        {selectedReport.settlement.status === "settled" ? (
                          <>
                            <Coins size={12} className="text-emerald" />
                            <span className="text-emerald">SETTLED</span>
                          </>
                        ) : selectedReport.settlement.status === "inconsistent" ? (
                          <>
                            <AlertCircle size={12} className="text-danger" />
                            <span className="text-danger">INCONSISTENT</span>
                          </>
                        ) : (
                          <>
                            <Clock size={12} className="text-amber" />
                            <span className="text-amber">{selectedReport.settlement.status.toUpperCase()}</span>
                          </>
                        )}
                      </div>
                      {selectedReport.settlement.grossGp !== null && (
                        <div className="font-8 text-slate font-mono" style={{ marginTop: "1px", opacity: 0.8 }}>
                          Reward: <span className="text-white font-bold">+{selectedReport.settlement.grossGp} GP</span>
                        </div>
                      )}
                      {selectedReport.settlement.actualEnergy !== null && (
                        <div className="font-8 text-slate font-mono" style={{ opacity: 0.8 }}>
                          Energy Spent: <span className="text-white font-bold">-{selectedReport.settlement.actualEnergy}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 7. Research Brief structured Result */}
                {selectedReport.structuredResult && (
                  <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", padding: "10px", borderRadius: "8px" }}>
                    <h4 className="font-10 text-muted uppercase font-bold" style={{ marginBottom: "8px" }}>{t("work.structuredResult", "研究成果投射")}</h4>

                    {selectedReport.structuredResult.type === "research_brief" ? (
                      <div className="flex-column gap-8" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ background: "rgba(0,0,0,0.12)", padding: "6px 8px", borderRadius: "5px" }}>
                          <span className="font-9 text-slate font-bold" style={{ display: "block", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "2px" }}>{t("brief.summary", "核心摘要 Summary")}</span>
                          <p className="font-10 text-white" style={{ margin: "3px 0 0 0" }}>{selectedReport.structuredResult.value.summary}</p>
                        </div>
                        <div style={{ background: "rgba(0,0,0,0.12)", padding: "6px 8px", borderRadius: "5px" }}>
                          <span className="font-9 text-slate font-bold" style={{ display: "block", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "2px" }}>{t("brief.coreProduct", "核心产品 Core Product")}</span>
                          <p className="font-10 text-white" style={{ margin: "3px 0 0 0" }}>{selectedReport.structuredResult.value.coreProduct}</p>
                        </div>
                        <div style={{ background: "rgba(0,0,0,0.12)", padding: "6px 8px", borderRadius: "5px" }}>
                          <span className="font-9 text-slate font-bold" style={{ display: "block", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "2px" }}>{t("brief.targetUsers", "目标用户 Target Users")}</span>
                          <p className="font-10 text-white" style={{ margin: "3px 0 0 0" }}>{selectedReport.structuredResult.value.targetUsers}</p>
                        </div>
                        <div style={{ background: "rgba(0,0,0,0.12)", padding: "6px 8px", borderRadius: "5px" }}>
                          <span className="font-9 text-slate font-bold" style={{ display: "block", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "2px" }}>{t("brief.businessModel", "商业模式 Business Model")}</span>
                          <p className="font-10 text-white" style={{ margin: "3px 0 0 0" }}>{selectedReport.structuredResult.value.businessModel}</p>
                        </div>
                        <div style={{ background: "rgba(0,0,0,0.12)", padding: "6px 8px", borderRadius: "5px" }}>
                          <span className="font-9 text-slate font-bold" style={{ display: "block", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "2px" }}>{t("brief.team", "团队背景 Team Background")}</span>
                          <p className="font-10 text-white" style={{ margin: "3px 0 0 0" }}>{selectedReport.structuredResult.value.teamBackground}</p>
                        </div>
                        <div style={{ background: "rgba(0,0,0,0.12)", padding: "6px 8px", borderRadius: "5px" }}>
                          <span className="font-9 text-slate font-bold" style={{ display: "block", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "2px" }}>{t("brief.competition", "竞争格局 Competition")}</span>
                          <p className="font-10 text-white" style={{ margin: "3px 0 0 0" }}>{selectedReport.structuredResult.value.competition}</p>
                        </div>
                        <div style={{ background: "rgba(0,0,0,0.12)", padding: "6px 8px", borderRadius: "5px" }}>
                          <span className="font-9 text-slate font-bold" style={{ display: "block", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "2px" }}>{t("brief.risks", "潜在风险 Risks")}</span>
                          <p className="font-10 text-white" style={{ margin: "3px 0 0 0" }}>{selectedReport.structuredResult.value.risks}</p>
                        </div>

                        {/* Fact vs Judgment */}
                        <div style={{ background: "rgba(0,0,0,0.12)", padding: "6px 8px", borderRadius: "5px" }}>
                          <span className="font-9 text-slate font-bold" style={{ display: "block", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "4px" }}>{t("brief.factVsJudgment", "事实判断与推论 Fact vs Judgment")}</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            {selectedReport.structuredResult.value.factVsJudgment.map((item, idx) => (
                              <div key={idx} className="font-9 flex-row align-start gap-4" style={{ display: "flex", gap: "4px", alignItems: "flex-start" }}>
                                <span style={{
                                  fontSize: "7px",
                                  padding: "1px 3px",
                                  borderRadius: "2px",
                                  background: item.type === 'fact' ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                                  color: item.type === 'fact' ? "#10b981" : "#f59e0b",
                                  fontWeight: "bold",
                                  marginTop: "1px"
                                }}>
                                  {item.type.toUpperCase()}
                                </span>
                                <span className="text-white" style={{ flex: 1 }}>{item.statement}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Recommendations */}
                        <div style={{ background: "rgba(0,0,0,0.12)", padding: "6px 8px", borderRadius: "5px" }}>
                          <span className="font-9 text-slate font-bold" style={{ display: "block", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "4px" }}>{t("brief.recommendations", "推荐行动 Recommendations")}</span>
                          <ol style={{ margin: 0, paddingLeft: "14px" }} className="text-white">
                            {selectedReport.structuredResult.value.recommendations.map((rec, idx) => (
                              <li key={idx} style={{ marginTop: idx > 0 ? "2px" : "0" }}>{rec}</li>
                            ))}
                          </ol>
                        </div>

                        {/* Sources */}
                        <div style={{ background: "rgba(0,0,0,0.12)", padding: "6px 8px", borderRadius: "5px" }}>
                          <span className="font-9 text-slate font-bold" style={{ display: "block", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "4px" }}>{t("brief.sources", "研究来源 Sources")}</span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {selectedReport.structuredResult.value.sources.map((src, idx) => (
                              <a
                                key={idx}
                                href={src.safeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-row align-center gap-2 text-primary font-9"
                                style={{ background: "rgba(59,130,246,0.08)", padding: "2px 6px", borderRadius: "3px", display: "inline-flex", textDecoration: "none", alignItems: "center" }}
                              >
                                {src.displayDomain} <ExternalLink size={8} />
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center flex-center flex-column text-muted font-10" style={{ padding: "8px 0" }}>
                        <FileText size={16} />
                        <p style={{ marginTop: "2px" }}>{t("work.structuredUnavailable", "成果暂不可用")}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 8. Action Buttons */}
                <div className="flex-row gap-8" style={{ display: "flex", gap: "8px", marginTop: "4px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                  <button
                    className="secondary action-btn"
                    style={{ flex: 1, padding: "8px" }}
                    onClick={() => setSelectedRun(null)}
                  >
                    {t("work.back", "关闭")}
                  </button>

                  <button
                    className="primary action-btn flex-row align-center justify-center gap-4"
                    style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: "4px", padding: "8px" }}
                    disabled={!selectedReport.share.allowed}
                    onClick={() => {
                      if (selectedReport.share.allowed) {
                        telegramAdapter.shareUrl("https://t.me/G2047_bot?start=work_report", selectedReport.share.text || "");
                      }
                    }}
                  >
                    <Share2 size={12} /> {t("work.shareReport", "安全分享")}
                  </button>
                </div>

                {!selectedReport.share.allowed && (
                  <p className="text-center font-8 text-amber font-mono" style={{ margin: 0, opacity: 0.8 }}>
                    * {t("work.shareDisabled", "当前限制分享")}: {selectedReport.share.blockedReason}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
