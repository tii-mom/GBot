import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Agent, InventoryItem, Task, User } from "@growthbot/shared";
import { apiClient, clearFallbackOccurred, fallbackOccurred } from "./apiClient";
import { telegramAdapter } from "./telegramAdapter";
import { AgentStudioView } from "./components/AgentStudioView";
import { Card, StatCard, RuntimeBadge, StatusBadge, ProgressCard, ReportCard, AgentCard, RuntimeTimeline, TaskLine } from "./components/runtime";
import { EnvironmentBadge, type ApiStatus } from "./components/runtime/EnvironmentBadge";
import "./styles.css";

type Tab = "Workspace" | "Agents" | "Tasks" | "Reports" | "Network";
type ResearchBriefInput = { topic: string; context: string };
type RuntimeState = {
  user: User | null;
  agent: Agent | null;
  tasks: Task[];
  inventory: InventoryItem[];
  skills: any[];
  runs: any[];
  activeRun: any | null;
  selectedRun: any | null;
  selectedSteps: any[];
  selectedReport: any | null;
  apiStatus: ApiStatus;
  error: string | null;
};

const tabs: Tab[] = ["Workspace", "Agents", "Tasks", "Reports", "Network"];
const initialState: RuntimeState = { user: null, agent: null, tasks: [], inventory: [], skills: [], runs: [], activeRun: null, selectedRun: null, selectedSteps: [], selectedReport: null, apiStatus: "Degraded", error: null };
const runningStatuses = new Set(["discovered", "analyzing", "qualified", "planning", "queued", "executing", "submitting", "verifying", "settling"]);

const isResearchTask = (task: Task) => [task.name, task.taskType, task.code].filter(Boolean).join(" ").toLowerCase().includes("research");
const classifyAsset = (item: InventoryItem) => item.type === "ability" || item.type === "skill_card" || item.category === "skill" ? "Skills" : item.type === "box" ? "Boxes" : item.type === "ticket" ? "Tickets" : item.type === "energy_pack" || item.type === "badge" || item.type === "consumable" ? "Rewards" : "Assets";
const canPauseRun = (run: any | null) => !!run && runningStatuses.has(run.status);
const canCancelRun = (run: any | null) => !!run && runningStatuses.has(run.status);
const canResumeRun = (run: any | null) => run?.status === "paused";
const canApproveRun = (run: any | null, steps: any[]) => !!run && (run.status === "waiting_user" || steps.some((step) => step.status === "waiting_approval" || step.requiresApproval));
const canRetryRun = (run: any | null, steps: any[]) => !!run && (run.status === "failed" || steps.some((step) => step.status === "failed"));

function getInitialRoute(): { tab: Tab; runId: string | null } {
  if (typeof window === "undefined") return { tab: "Workspace", runId: null };
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get("tab") as Tab | null;
  const runId = params.get("runId");
  return { tab: tabParam && tabs.includes(tabParam) ? tabParam : runId ? "Reports" : "Workspace", runId };
}

function reportUrl(runId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "Reports");
  url.searchParams.set("runId", runId);
  return url.toString();
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
      {tab === "Workspace" && <section className="runtime-grid"><StatCard label="Active Agents" value={workspaceStats.activeAgents}/><StatCard label="Running Tasks" value={workspaceStats.runningTasks}/><StatCard label="Verified Reports" value={workspaceStats.verifiedReports}/><StatCard label="Settlements" value={workspaceStats.settlements}/><StatCard label="GP Earned" value={workspaceStats.gpEarned}/><Card title="Recent Activity"><ul><li>Research Brief: {state.tasks.find(isResearchTask)?.name || "No research task returned"}</li><li>Verification: {state.runs.find((run) => run.status === "verifying")?.id || "No active verification"}</li><li>Settlement: {state.runs.find((run) => run.settled)?.id || "No settled runtime returned"}</li><li>Work Report: {state.runs[0]?.id || "No WorkRun history returned"}</li></ul></Card><Card title="Quick Actions"><button onClick={() => setTab("Tasks")}>New Research Brief</button><button onClick={() => setTab("Reports")}>Open Reports</button><button onClick={() => setTab("Tasks")}>Open Tasks</button></Card></section>}
      {tab === "Agents" && <section><Card title="Agent Center" action={<button onClick={() => setShowStudio(true)}>Open Studio</button>}>{state.agent ? <AgentCard agent={state.agent} skills={skillNames} lastRuntime={state.runs[0]?.id}/> : <p>No agent returned by /me.</p>}</Card><Card title="Overview / Runtime / Skills / History"><p>Overview: {state.agent?.profession || "No profession"}</p><p>Runtime: <RuntimeBadge status={state.activeRun?.status || state.agent?.status} progress={state.activeRun?.progress}/></p><p>Skills: {skillNames.join(", ") || "No skills returned"}</p><p>History: {state.runs.length} WorkRuns</p></Card>{showStudio && <AgentStudioView onClose={() => setShowStudio(false)} t={(k: string, d?: string) => d || k} />}</section>}
      {tab === "Tasks" && <section><ResearchBriefCreate tasks={state.tasks} agent={state.agent} onCreate={createResearchRun}/><TaskBucket title="Available" tasks={state.tasks} action={(task) => <button onClick={() => createResearchRun(task.id, { topic: task.name, context: "Started from available task list." })}>Start WorkRun</button>} /><Card title="Running / Verification Awaiting / Completed">{state.runs.map((run) => <ProgressCard key={run.id} label={`${run.taskId} · ${run.status}`} progress={run.progress || 0} detail={`${run.estimatedReward || 0} GP · runtime ${run.id}`} />)}<RuntimeActions run={state.activeRun} steps={state.selectedRun?.id === state.activeRun?.id ? state.selectedSteps : []} reload={loadRuntime}/></Card></section>}
      {tab === "Reports" && <section><Card title="Reports">{state.runs.map((run) => <ReportCard key={run.id} title={`Work Report · ${run.taskId}`} runId={run.id} status={run.status} onOpen={() => openReport(run.id)} />)}</Card><WorkReportDetail run={state.selectedRun} steps={state.selectedSteps} report={state.selectedReport}/></section>}
      {tab === "Network" && <section><Card title="Team / Contribution / Progress / Members / Rewards"><p>Team: {state.user?.username || "Current Telegram user"}</p><p>Contribution: {workspaceStats.gpEarned} GP</p><p>Progress: {workspaceStats.verifiedReports} verified reports</p><p>Members: Telegram group binding is available in Network Settings when backend pool data is connected.</p><p>Rewards: {state.inventory.filter((item) => classifyAsset(item) === "Rewards").length} reward assets</p></Card><Card title="Network Settings / Assets">{["Skills", "Boxes", "Tickets", "Rewards", "Assets"].map((group) => <p key={group}>{group}: {state.inventory.filter((item) => classifyAsset(item) === group).length}</p>)}</Card></section>}
    </>}
  </main>;
}

function ResearchBriefCreate({ tasks, agent, onCreate }: { tasks: Task[]; agent: Agent | null; onCreate: (taskId: string, input: ResearchBriefInput) => void }) {
  const research = tasks.filter(isResearchTask);
  const selectableTasks = research.length ? research : tasks;
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [taskId, setTaskId] = useState(selectableTasks[0]?.id || "");
  useEffect(() => {
    const firstTask = selectableTasks[0];
    if (!taskId && firstTask) setTaskId(firstTask.id);
  }, [taskId, selectableTasks]);
  return <Card title="New Research Brief"><input placeholder="Research topic" value={topic} onChange={(e) => setTopic(e.target.value)} /><textarea placeholder="Research context, constraints, sources, or expected angle" value={context} onChange={(e) => setContext(e.target.value)} /><select value={taskId} onChange={(e) => setTaskId(e.target.value)}>{selectableTasks.map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}</select><button disabled={!agent || !taskId || !topic.trim()} onClick={() => onCreate(taskId, { topic: topic.trim(), context: context.trim() })}>Create Research Brief WorkRun</button><small>This creates a WorkRun from a Research Brief compatibility path until standalone Research Brief CRUD/list APIs exist.</small></Card>;
}

function TaskBucket({ title, tasks, action }: { title: string; tasks: Task[]; action: (task: Task) => React.ReactNode }) {
  return <Card title={title}>{tasks.map((task) => <TaskLine key={task.id} task={task} action={action(task)} />)}</Card>;
}

function RuntimeActions({ run, steps, reload }: { run: any | null; steps: any[]; reload: () => Promise<void> }) {
  if (!run) return null;
  return <div className="task-actions">
    {canApproveRun(run, steps) && <button onClick={() => apiClient.approveStep(run.id).then(reload)}>Approve Step</button>}
    {canPauseRun(run) && <button onClick={() => apiClient.pauseWorkRun(run.id).then(reload)}>Pause</button>}
    {canResumeRun(run) && <button onClick={() => apiClient.resumeWorkRun(run.id).then(reload)}>Resume</button>}
    {canCancelRun(run) && <button onClick={() => apiClient.cancelWorkRun(run.id).then(reload)}>Cancel</button>}
    {canRetryRun(run, steps) && <button onClick={() => apiClient.retryStep(run.id).then(reload)}>Retry Step</button>}
  </div>;
}

function markdownFromReport(run: any, steps: any[], report: any) {
  const sections = ["Input", "Execution", "Evidence", "Verification", "Settlement"];
  const lines = [`# Work Report`, ``, `Run: ${run?.id || "not selected"}`, `Status: ${run?.status || "unknown"}`, ``];
  for (const section of sections) {
    const key = section.toLowerCase();
    lines.push(`## ${section}`);
    lines.push(report?.[key] ? JSON.stringify(report[key], null, 2) : section === "Execution" ? `WorkRun ${run?.id || "not selected"} is ${run?.status || "unknown"}.` : "No standalone report field returned by API.");
    lines.push("");
  }
  lines.push("## Steps");
  if (steps.length) steps.forEach((step) => lines.push(`- ${step.stepOrder || "?"}. ${step.title || step.stepType}: ${step.status}${step.outputSummary ? ` — ${step.outputSummary}` : ""}`));
  else lines.push("- No WorkRun steps returned.");
  return lines.join("\n");
}

function WorkReportDetail({ run, steps, report }: { run: any; steps: any[]; report: any }) {
  const canonicalUrl = run?.id && typeof window !== "undefined" ? reportUrl(run.id) : (typeof window !== "undefined" ? window.location.href : "");
  const exportMd = () => navigator.clipboard?.writeText(markdownFromReport(run, steps, report));
  const copy = () => navigator.clipboard?.writeText(canonicalUrl);
  return <Card title="Work Report Detail" action={<><button disabled={!run?.id} onClick={() => telegramAdapter.shareUrl(canonicalUrl, "GrowthBot Work Report")}>Share</button><button disabled={!run?.id} onClick={copy}>Copy Link</button><button onClick={exportMd}>Export Markdown</button></>}>
    {["Input", "Execution", "Evidence", "Verification", "Settlement"].map((section) => <section key={section} className="report-section"><h3>{section}</h3><p>{report?.[section.toLowerCase()] ? JSON.stringify(report[section.toLowerCase()]) : section === "Execution" ? `Run ${run?.id || "not selected"} status ${run?.status || "unknown"}` : "No standalone report field returned by API."}</p></section>)}
    <RuntimeTimeline steps={steps}/>
  </Card>;
}

createRoot(document.getElementById("root")!).render(<App />);
