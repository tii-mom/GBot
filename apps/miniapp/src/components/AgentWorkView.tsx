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
  FolderOpen
} from "lucide-react";
import type { Agent, User } from "@growthbot/shared";
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
  const [selectedRunSteps, setSelectedRunSteps] = useState<any[]>([]);
  const [loadingSelectedSteps, setLoadingSelectedSteps] = useState(false);

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

  // Load detail steps when drawer opens
  useEffect(() => {
    if (selectedRun) {
      setLoadingSelectedSteps(true);
      apiClient.getWorkRunSteps(selectedRun.id)
        .then((res: any) => {
          if (res && res.steps) setSelectedRunSteps(res.steps);
        })
        .catch((err: any) => console.error(err))
        .finally(() => setLoadingSelectedSteps(false));
    } else {
      setSelectedRunSteps([]);
    }
  }, [selectedRun]);

  if (!agent) {
    return (
      <div className="view-panel text-center flex-center flex-column" style={{ padding: "40px 20px" }}>
        <FolderOpen size={48} className="muted" />
        <h3 style={{ marginTop: "16px" }}>{t("work.noAgentTitle", "未激活 Agent")}</h3>
        <p className="muted font-13">{t("work.noAgentDesc", "请先在首页绑定或激活您的 Agent，即可开始让其运行赏金和日常任务。")}</p>
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
              <strong>{activeRun.estimatedEnergy || 0} AI Credits est.</strong>
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
                    <span>Evidence: AI Credit usage recorded</span>
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
          <div className="modal-content text-left" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "85vh", overflowY: "auto" }}>
            <div className="modal-header flex-row justify-between align-center" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3>{t("work.detailsTitle", "运行计划详情")}</h3>
              <button className="close-btn" onClick={() => setSelectedRun(null)}>
                <CheckCircle2 size={18} />
              </button>
            </div>

            <div className="font-12" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <p><strong>{t("work.taskId", "任务ID")}:</strong> {selectedRun.taskId}</p>
              <p><strong>{t("work.status", "最终状态")}:</strong> <span className="rarity-tag epic">{getStatusText(selectedRun.status)}</span></p>
              <p><strong>{t("work.riskLevel", "风险等级")}:</strong> {selectedRun.riskLevel.toUpperCase()}</p>
              <p><strong>{t("work.rewardEarned", "AI Credit usage evidence")}:</strong> WorkRun consumed capacity under policy limits.</p>
              <p><strong>{t("work.energySpent", "扣除行动力")}:</strong> {selectedRun.actualEnergy}</p>
              <p><strong>{t("work.startTime", "启动时间")}:</strong> {new Date(selectedRun.startedAt).toLocaleString()}</p>
              {selectedRun.completedAt && (
                <p><strong>{t("work.endTime", "完成时间")}:</strong> {new Date(selectedRun.completedAt).toLocaleString()}</p>
              )}
              {selectedRun.failedReason && (
                <p className="text-danger"><strong>{t("work.failedReason", "失败原因")}:</strong> {selectedRun.failedReason}</p>
              )}

              {/* Completed Run Used Skills */}
              {selectedRun.usedSkills && selectedRun.usedSkills.length > 0 && (
                <div style={{ marginTop: "12px", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "12px" }}>
                  <h4 style={{ marginBottom: "8px" }}>{t("work.usedSkills", "已使用 Runtime 技能")}</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {selectedRun.usedSkills.map((s: any) => (
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

              <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <h4>{t("work.stepsDetail", "执行步骤详情")}</h4>
                {loadingSelectedSteps ? (
                  <div className="muted font-11" style={{ padding: "10px 0" }}>{t("work.loadingSteps", "正在读取步骤...")}</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                    {selectedRunSteps.map((step) => (
                      <div key={step.id} className="flex-row align-start gap-6 font-11" style={{ display: "flex", gap: "6px" }}>
                        <div>{getStepIcon(step.status)}</div>
                        <div style={{ flex: 1 }}>
                          <strong>{step.stepOrder}. {step.title}</strong>
                          {step.outputSummary && (
                            <p className="muted monospace" style={{ margin: "2px 0 0 0", fontSize: "9px" }}>
                              Result: {step.outputSummary}
                            </p>
                          )}
                          {step.errorMessage && (
                            <p className="text-danger monospace" style={{ margin: "2px 0 0 0", fontSize: "9px" }}>
                              Error: {step.errorMessage}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
