import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { apiClient, clearFallbackOccurred, fallbackOccurred } from "./apiClient";
import { telegramAdapter } from "./telegramAdapter";
import { Card, EnvironmentNotice, StatusBadge } from "./components/runtime";
import { EnvironmentBadge, deriveRuntimeEnvironment } from "./components/runtime/EnvironmentBadge";
import type { ResearchBriefInput, RuntimeState, Tab, WorkspacePrimaryAction, WorkspaceStats } from "./components/runtime/runtimeTypes";
import { reportUrl, stateEmptyCopy, tabs } from "./components/runtime/runtimeUtils";
import { AgentsView } from "./components/runtime/views/AgentsView";
import { NetworkView } from "./components/runtime/views/NetworkView";
import { ReportsView } from "./components/runtime/views/ReportsView";
import { TasksView } from "./components/runtime/views/TasksView";
import { WorkspaceView } from "./components/runtime/views/WorkspaceView";
import "./styles.css";

const initialState: RuntimeState = {
  user: null,
  agent: null,
  tasks: [],
  inventory: [],
  skills: [],
  skillSlots: null,
  runs: [],
  activeRun: null,
  selectedRun: null,
  selectedSteps: [],
  selectedReport: null,
  reportCache: {},
  realAssetAgent: null,
  assetBalances: [],
  agentWallet: null,
  walletPolicy: null,
  aiCreditBalance: [],
  skillCards: [],
  apiStatus: "Degraded",
  error: null
};

function getInitialRoute(): { tab: Tab; runId: string | null } {
  if (typeof window === "undefined") return { tab: "Workspace", runId: null };
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get("tab") as Tab | null;
  const runId = params.get("runId");
  return { tab: tabParam && tabs.includes(tabParam) ? tabParam : runId ? "Reports" : "Workspace", runId };
}

function getWorkspaceStats(state: RuntimeState): WorkspaceStats {
  const findAsset = (asset: "G" | "TON" | "AI_CREDIT") => state.assetBalances.find((balance) => balance.asset === asset)?.available.amount || "0";
  const aiCredits = state.aiCreditBalance[0]?.balance.amount || findAsset("AI_CREDIT");
  return {
    todayTasks: state.tasks.length,
    activeAgentCount: state.agent ? 1 : 0,
    runningTasks: state.runs.filter((run) => ["discovered", "analyzing", "qualified", "planning", "queued", "executing", "waiting_signature", "submitting", "verifying", "waiting_user", "settling"].includes(run.status)).length,
    waitingConfirmation: state.runs.filter((run) => run.status === "waiting_user").length,
    pendingVerification: state.runs.filter((run) => run.status === "verifying" || run.status === "waiting_signature" || run.status === "submitting").length,
    completedRuns: state.runs.filter((run) => run.status === "completed").length,
    settledRuns: state.runs.filter((run) => run.settled).length,
    pendingPoints: state.agent?.pendingPoints || state.user?.pendingPoints || 0,
    gBalance: findAsset("G"),
    tonBalance: findAsset("TON"),
    aiCreditBalance: aiCredits,
    skillCardPower: state.skillCards.length || state.realAssetAgent?.skillCardSummary.totalCanonicalCards || 31,
    autoPurchaseEnabled: Boolean(state.walletPolicy?.autoPurchaseEnabled),
    energy: state.agent?.energy || 0
  };
}

function App() {
  const initialRoute = getInitialRoute();
  const [tab, setTab] = useState<Tab>(initialRoute.tab);
  const [pendingRunId, setPendingRunId] = useState<string | null>(initialRoute.runId);
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [showStudio, setShowStudio] = useState(false);
  const latestReportRequestRef = useRef<string | null>(null);
  const environment = deriveRuntimeEnvironment();

  const loadRuntime = useCallback(async () => {
    setLoading(true);
    clearFallbackOccurred();
    try {
      const initData = typeof window !== "undefined" ? window.Telegram?.WebApp?.initData || "" : "";
      const me = initData ? await apiClient.loginOrRegister(initData, telegramAdapter.getStartParam()) : await apiClient.getMe();
      const [tasksRes, invRes] = await Promise.all([apiClient.getTasks(), apiClient.getInventory()]);
      let skills: RuntimeState["skills"] = [];
      let runs: RuntimeState["runs"] = [];
      let activeRun: RuntimeState["activeRun"] = null;
      let skillSlots: RuntimeState["skillSlots"] = null;

      if (me.agent) {
        const [skillRes, runRes, activeRes] = await Promise.all([
          apiClient.getAgentSkills(me.agent.id),
          apiClient.getWorkRuns(me.agent.id),
          apiClient.getActiveWorkRun(me.agent.id)
        ]);
        skills = (skillRes.skills || []).map((skill: any) => skill);
        runs = runRes.workRuns || [];
        activeRun = activeRes.run || null;
        skillSlots = skillRes.slots || null;
      }

      setState((s) => ({
        ...s,
        user: me.user,
        agent: me.agent,
        tasks: tasksRes.tasks,
        inventory: invRes.items,
        skills,
        skillSlots,
        runs,
        activeRun,
        reportCache: s.reportCache,
        realAssetAgent: (me as any).realAssetAgent || null,
        assetBalances: me.assetBalances || [],
        agentWallet: me.agentWallet || null,
        walletPolicy: me.walletPolicy || null,
        aiCreditBalance: me.aiCreditBalance || [],
        skillCards: (me as any).skillCards || [],
        apiStatus: fallbackOccurred ? "Degraded" : "Healthy",
        error: null
      }));
    } catch (err: any) {
      setState((s) => ({ ...s, apiStatus: "Offline", error: err?.message || "Runtime API request failed" }));
    } finally {
      setLoading(false);
    }
  }, []);

  const openReport = useCallback(async (runId: string, syncUrl = true) => {
    latestReportRequestRef.current = runId;
    const [runRes, stepsRes, reportRes] = await Promise.all([
      apiClient.getWorkRun(runId),
      apiClient.getWorkRunSteps(runId),
      apiClient.getWorkReport(runId)
    ]);
    if (latestReportRequestRef.current !== runId) return;
    setState((s) => ({
      ...s,
      selectedRun: runRes.run,
      selectedSteps: stepsRes.steps || [],
      selectedReport: reportRes.report,
      reportCache: { ...s.reportCache, [runId]: reportRes.report }
    }));
    setTab("Reports");
    if (syncUrl && typeof window !== "undefined") window.history.replaceState(null, "", reportUrl(runId));
  }, []);

  const createResearchRun = useCallback(async (taskId: string, input: ResearchBriefInput) => {
    const res = await apiClient.createWorkRun(taskId, { input: { type: "research_brief", ...input } });
    await loadRuntime();
    if (res.run?.id) await openReport(res.run.id);
  }, [loadRuntime, openReport]);

  const onPrimaryAction = useCallback((kind: WorkspacePrimaryAction["kind"]) => {
    switch (kind) {
      case "claim":
        apiClient.claimAgent().then(loadRuntime).catch((err: unknown) => setState((s) => ({ ...s, error: err instanceof Error ? err.message : "领取 Agent 失败" })));
        return;
      case "energy":
        setTab("Network");
        return;
      case "plan":
      case "verify":
      case "tasks":
        setTab("Tasks");
        return;
      case "report":
        setTab("Reports");
        return;
      case "retry":
        setTab("Tasks");
        return;
    }
  }, [loadRuntime]);

  useEffect(() => {
    telegramAdapter.init();
    telegramAdapter.expand();
    telegramAdapter.setHeaderColor("#090a0f");
    telegramAdapter.setBackgroundColor("#090a0f");
    loadRuntime();
  }, [loadRuntime]);

  useEffect(() => {
    if (!loading && pendingRunId) {
      openReport(pendingRunId, false).finally(() => setPendingRunId(null));
    }
  }, [loading, openReport, pendingRunId]);

  const workspaceStats = useMemo(() => getWorkspaceStats(state), [state]);
  const skillNames = state.skills.map((skill: any) => skill.skillName || skill.name || skill.skillCode || skill.id).filter(Boolean);

  return (
    <main className="runtime-shell">
      <header className="runtime-top">
        <div>
          <p className="eyebrow">GrowthBot Mini App</p>
          <h1>Agent Runtime 工作台</h1>
          <p>我的 Agent → 分析任务 → 生成计划 → 等待确认 → 执行任务 → 提交验收 → Work Report → Settlement → 分享 / Network 增长</p>
        </div>
        <EnvironmentBadge environment={environment} apiStatus={state.apiStatus} />
      </header>

      <EnvironmentNotice title={`Environment: ${environment}`} description={state.apiStatus === "Healthy" ? "API 状态正常。" : state.apiStatus === "Degraded" ? "部分数据暂时不可用。" : "Agent 网络连接异常，正在重试。"} />

      {state.error && <Card><StatusBadge status="offline" /> {state.error}</Card>}

      <nav className="runtime-nav" aria-label="Runtime Navigation">
        {tabs.map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}</button>)}
      </nav>

      {loading ? <Card>Loading Agent Runtime from GrowthBot API…</Card> : (
        <>
          {state.apiStatus !== "Healthy" && <Card><StatusBadge status={state.apiStatus.toLowerCase()} /> {state.apiStatus === "Offline" ? "Agent 网络连接异常，正在重试。" : "部分数据暂时不可用。"}</Card>}
          {tab === "Workspace" && <WorkspaceView state={state} workspaceStats={workspaceStats} setTab={setTab} onPrimaryAction={onPrimaryAction} />}
          {tab === "Agents" && <AgentsView state={state} skillNames={skillNames} showStudio={showStudio} setShowStudio={setShowStudio} />}
          {tab === "Tasks" && <TasksView state={state} createResearchRun={createResearchRun} loadRuntime={loadRuntime} />}
          {tab === "Reports" && <ReportsView state={state} openReport={openReport} />}
          {tab === "Network" && <NetworkView state={state} workspaceStats={workspaceStats} />}
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
