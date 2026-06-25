import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { apiClient, clearFallbackOccurred, fallbackOccurred } from "./apiClient";
import { telegramAdapter } from "./telegramAdapter";
import { Card, StatusBadge } from "./components/runtime";
import { EnvironmentBadge } from "./components/runtime/EnvironmentBadge";
import type { ResearchBriefInput, RuntimeState, Tab } from "./components/runtime/runtimeTypes";
import { reportUrl, tabs } from "./components/runtime/runtimeUtils";
import { AgentsView } from "./components/runtime/views/AgentsView";
import { NetworkView } from "./components/runtime/views/NetworkView";
import { ReportsView } from "./components/runtime/views/ReportsView";
import { TasksView } from "./components/runtime/views/TasksView";
import { WorkspaceView } from "./components/runtime/views/WorkspaceView";
import "./styles.css";

const initialState: RuntimeState = { user: null, agent: null, tasks: [], inventory: [], skills: [], runs: [], activeRun: null, selectedRun: null, selectedSteps: [], selectedReport: null, apiStatus: "Degraded", error: null };

function getInitialRoute(): { tab: Tab; runId: string | null } {
  if (typeof window === "undefined") return { tab: "Workspace", runId: null };
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get("tab") as Tab | null;
  const runId = params.get("runId");
  return { tab: tabParam && tabs.includes(tabParam) ? tabParam : runId ? "Reports" : "Workspace", runId };
}

function App() {
  const initialRoute = getInitialRoute();
  const [tab, setTab] = useState<Tab>(initialRoute.tab);
  const [pendingRunId, setPendingRunId] = useState<string | null>(initialRoute.runId);
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [showStudio, setShowStudio] = useState(false);

  const loadRuntime = useCallback(async () => {
    setLoading(true);
    clearFallbackOccurred();
    try {
      const initData = typeof window !== "undefined" ? window.Telegram?.WebApp?.initData || "" : "";
      const me = initData ? await apiClient.loginOrRegister(initData, telegramAdapter.getStartParam()) : await apiClient.getMe();
      const [tasksRes, invRes] = await Promise.all([apiClient.getTasks(), apiClient.getInventory()]);
      let skills: any[] = [];
      let runs: any[] = [];
      let activeRun: any | null = null;
      if (me.agent) {
        const [skillRes, runRes, activeRes] = await Promise.all([apiClient.getAgentSkills(me.agent.id), apiClient.getWorkRuns(me.agent.id), apiClient.getActiveWorkRun(me.agent.id)]);
        skills = skillRes.skills || [];
        runs = runRes.workRuns || [];
        activeRun = activeRes.run || null;
      }
      setState((s) => ({ ...s, user: me.user, agent: me.agent, tasks: tasksRes.tasks, inventory: invRes.items, skills, runs, activeRun, apiStatus: fallbackOccurred ? "Degraded" : "Healthy", error: null }));
    } catch (err: any) {
      setState((s) => ({ ...s, apiStatus: "Offline", error: err?.message || "Runtime API request failed" }));
    } finally {
      setLoading(false);
    }
  }, []);

  const openReport = useCallback(async (runId: string, syncUrl = true) => {
    const [runRes, stepsRes, reportRes] = await Promise.all([apiClient.getWorkRun(runId), apiClient.getWorkRunSteps(runId), apiClient.getWorkReport(runId).catch(() => ({ report: null }))]);
    setState((s) => ({ ...s, selectedRun: runRes.run, selectedSteps: stepsRes.steps || [], selectedReport: reportRes.report }));
    setTab("Reports");
    if (syncUrl && typeof window !== "undefined") window.history.replaceState(null, "", reportUrl(runId));
  }, []);

  const createResearchRun = async (taskId: string, input: ResearchBriefInput) => {
    const res = await apiClient.createWorkRun(taskId, { input: { type: "research_brief", ...input } });
    await loadRuntime();
    if (res.run?.id) await openReport(res.run.id);
  };

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

  const workspaceStats = useMemo(() => ({
    activeAgents: state.agent ? 1 : 0,
    runningTasks: state.runs.filter((run) => !["completed", "failed", "cancelled"].includes(run.status)).length,
    verifiedReports: state.runs.filter((run) => run.status === "completed" || run.settled).length,
    settlements: state.runs.filter((run) => run.settled).length,
    gpEarned: state.agent?.pendingPoints || state.user?.pendingPoints || 0
  }), [state]);
  const skillNames = state.skills.map((skill: any) => skill.name || skill.skillName || skill.capabilityKey || skill.id).filter(Boolean);

  return <main className="runtime-shell">
    <header className="runtime-top"><div><h1>GrowthBot Runtime</h1><p>Research Brief → WorkRun → Verification → Work Report → Settlement</p></div><EnvironmentBadge apiStatus={state.apiStatus} /></header>
    {state.error && <Card><StatusBadge status="offline" /> {state.error}</Card>}
    <nav className="runtime-nav">{tabs.map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}</button>)}</nav>
    {loading ? <Card>Loading Runtime V1 from GrowthBot API…</Card> : <>
      {tab === "Workspace" && <WorkspaceView state={state} workspaceStats={workspaceStats} setTab={setTab} />}
      {tab === "Agents" && <AgentsView state={state} skillNames={skillNames} showStudio={showStudio} setShowStudio={setShowStudio} />}
      {tab === "Tasks" && <TasksView state={state} createResearchRun={createResearchRun} loadRuntime={loadRuntime} />}
      {tab === "Reports" && <ReportsView state={state} openReport={openReport} />}
      {tab === "Network" && <NetworkView state={state} workspaceStats={workspaceStats} />}
    </>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);
