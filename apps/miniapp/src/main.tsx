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
const tabs: Tab[] = ["Workspace", "Agents", "Tasks", "Reports", "Network"];

type RuntimeState = { user: User | null; agent: Agent | null; tasks: Task[]; inventory: InventoryItem[]; skills: any[]; runs: any[]; activeRun: any | null; selectedRun: any | null; selectedSteps: any[]; selectedReport: any | null; apiStatus: ApiStatus; error: string | null; };
const initialState: RuntimeState = { user: null, agent: null, tasks: [], inventory: [], skills: [], runs: [], activeRun: null, selectedRun: null, selectedSteps: [], selectedReport: null, apiStatus: "Degraded", error: null };
const isResearchTask = (task: Task) => [task.name, task.taskType, task.code].filter(Boolean).join(" ").toLowerCase().includes("research");
const classifyAsset = (item: InventoryItem) => item.type === "ability" || item.type === "skill_card" || item.category === "skill" ? "Skills" : item.type === "box" ? "Boxes" : item.type === "ticket" ? "Tickets" : item.type === "energy_pack" || item.type === "badge" || item.type === "consumable" ? "Rewards" : "Assets";

function App() {
  const [tab, setTab] = useState<Tab>("Workspace");
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [showStudio, setShowStudio] = useState(false);
  const loadRuntime = useCallback(async () => {
    setLoading(true); clearFallbackOccurred();
    try {
      const initData = typeof window !== "undefined" ? window.Telegram?.WebApp?.initData || "" : "";
      const me = initData ? await apiClient.loginOrRegister(initData, telegramAdapter.getStartParam()) : await apiClient.getMe();
      const [tasksRes, invRes] = await Promise.all([apiClient.getTasks(), apiClient.getInventory()]);
      let skills:any[] = [], runs:any[] = [], activeRun:any|null = null;
      if (me.agent) {
        const [skillRes, runRes, activeRes] = await Promise.all([apiClient.getAgentSkills(me.agent.id), apiClient.getWorkRuns(me.agent.id), apiClient.getActiveWorkRun(me.agent.id)]);
        skills = skillRes.skills || []; runs = runRes.workRuns || []; activeRun = activeRes.run || null;
      }
      setState(s => ({ ...s, user: me.user, agent: me.agent, tasks: tasksRes.tasks, inventory: invRes.items, skills, runs, activeRun, apiStatus: fallbackOccurred ? "Degraded" : "Healthy", error: null }));
    } catch (err:any) { setState(s => ({ ...s, apiStatus: "Offline", error: err?.message || "Runtime API request failed" })); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { telegramAdapter.init(); telegramAdapter.expand(); telegramAdapter.setHeaderColor("#090a0f"); telegramAdapter.setBackgroundColor("#090a0f"); loadRuntime(); }, [loadRuntime]);
  const openReport = async (runId: string) => { const [runRes, stepsRes, reportRes] = await Promise.all([apiClient.getWorkRun(runId), apiClient.getWorkRunSteps(runId), apiClient.getWorkReport(runId).catch(() => ({ report: null }))]); setState(s => ({ ...s, selectedRun: runRes.run, selectedSteps: stepsRes.steps || [], selectedReport: reportRes.report })); setTab("Reports"); };
  const createResearchRun = async (taskId: string) => { const res = await apiClient.createWorkRun(taskId); await loadRuntime(); if (res.run?.id) await openReport(res.run.id); };
  const workspaceStats = useMemo(() => ({ activeAgents: state.agent ? 1 : 0, runningTasks: state.runs.filter(r => !["completed","failed","cancelled"].includes(r.status)).length, verifiedReports: state.runs.filter(r => r.status === "completed" || r.settled).length, settlements: state.runs.filter(r => r.settled).length, gpEarned: state.agent?.pendingPoints || state.user?.pendingPoints || 0 }), [state]);
  const skillNames = state.skills.map((s:any) => s.name || s.skillName || s.capabilityKey || s.id).filter(Boolean);
  return <main className="runtime-shell"><header className="runtime-top"><div><h1>GrowthBot Runtime</h1><p>Research Brief → WorkRun → Verification → Work Report → Settlement</p></div><EnvironmentBadge apiStatus={state.apiStatus} /></header>{state.error && <Card><StatusBadge status="offline" /> {state.error}</Card>}<nav className="runtime-nav">{tabs.map(name => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}</button>)}</nav>{loading ? <Card>Loading Runtime V1 from GrowthBot API…</Card> : <>{tab === "Workspace" && <section className="runtime-grid"><StatCard label="Active Agents" value={workspaceStats.activeAgents}/><StatCard label="Running Tasks" value={workspaceStats.runningTasks}/><StatCard label="Verified Reports" value={workspaceStats.verifiedReports}/><StatCard label="Settlements" value={workspaceStats.settlements}/><StatCard label="GP Earned" value={workspaceStats.gpEarned}/><Card title="Recent Activity"><ul><li>Research Brief: {state.tasks.find(isResearchTask)?.name || "No research task returned"}</li><li>Verification: {state.runs.find(r=>r.status === "verifying")?.id || "No active verification"}</li><li>Settlement: {state.runs.find(r=>r.settled)?.id || "No settled runtime returned"}</li><li>Work Report: {state.runs[0]?.id || "No WorkRun history returned"}</li></ul></Card><Card title="Quick Actions"><button onClick={()=>setTab("Tasks")}>New Research Brief</button><button onClick={()=>setTab("Reports")}>Open Reports</button><button onClick={()=>setTab("Tasks")}>Open Tasks</button></Card></section>}{tab === "Agents" && <section><Card title="Agent Center" action={<button onClick={()=>setShowStudio(true)}>Open Studio</button>}>{state.agent ? <AgentCard agent={state.agent} skills={skillNames} lastRuntime={state.runs[0]?.id}/> : <p>No agent returned by /me.</p>}</Card><Card title="Overview / Runtime / Skills / History"><p>Overview: {state.agent?.profession || "No profession"}</p><p>Runtime: <RuntimeBadge status={state.activeRun?.status || state.agent?.status} progress={state.activeRun?.progress}/></p><p>Skills: {skillNames.join(", ") || "No skills returned"}</p><p>History: {state.runs.length} WorkRuns</p></Card>{showStudio && <AgentStudioView onClose={()=>setShowStudio(false)} t={(k:string,d?:string)=>d || k} />}</section>}{tab === "Tasks" && <section><ResearchBriefCreate tasks={state.tasks} agent={state.agent} onCreate={createResearchRun}/><TaskBucket title="Available" tasks={state.tasks} action={(task)=><button onClick={()=>createResearchRun(task.id)}>Start WorkRun</button>} /><Card title="Running / Pending Verification / Completed">{state.runs.map(run => <ProgressCard key={run.id} label={`${run.taskId} · ${run.status}`} progress={run.progress || 0} detail={`${run.estimatedReward || 0} GP · runtime ${run.id}`} />)}{state.activeRun && <div className="task-actions"><button onClick={()=>apiClient.approveStep(state.activeRun.id).then(loadRuntime)}>Approve Step</button><button onClick={()=>apiClient.pauseWorkRun(state.activeRun.id).then(loadRuntime)}>Pause</button><button onClick={()=>apiClient.resumeWorkRun(state.activeRun.id).then(loadRuntime)}>Resume</button><button onClick={()=>apiClient.cancelWorkRun(state.activeRun.id).then(loadRuntime)}>Cancel</button><button onClick={()=>apiClient.retryStep(state.activeRun.id).then(loadRuntime)}>Retry Step</button></div>}</Card></section>}{tab === "Reports" && <section><Card title="Reports">{state.runs.map(run => <ReportCard key={run.id} title={`Work Report · ${run.taskId}`} runId={run.id} status={run.status} onOpen={()=>openReport(run.id)} />)}</Card><WorkReportDetail run={state.selectedRun} steps={state.selectedSteps} report={state.selectedReport}/></section>}{tab === "Network" && <section><Card title="Team / Contribution / Progress / Members / Rewards"><p>Team: {state.user?.username || "Current Telegram user"}</p><p>Contribution: {workspaceStats.gpEarned} GP</p><p>Progress: {workspaceStats.verifiedReports} verified reports</p><p>Members: Telegram group binding is available in Network Settings when backend pool data is connected.</p><p>Rewards: {state.inventory.filter(i=>classifyAsset(i)==="Rewards").length} reward assets</p></Card><Card title="Network Settings / Assets">{["Skills","Boxes","Tickets","Rewards","Assets"].map(group => <p key={group}>{group}: {state.inventory.filter(i=>classifyAsset(i)===group).length}</p>)}</Card></section>}</>}</main>;
}
function ResearchBriefCreate({ tasks, agent, onCreate }: { tasks: Task[]; agent: Agent | null; onCreate: (taskId: string)=>void }) {
  const research = tasks.filter(isResearchTask);
  const selectableTasks = research.length ? research : tasks;
  const [topic,setTopic]=useState("");
  const [context,setContext]=useState("");
  const [taskId,setTaskId]=useState(selectableTasks[0]?.id || "");
  useEffect(()=>{
    const firstTask = selectableTasks[0];
    if(!taskId && firstTask) setTaskId(firstTask.id);
  },[taskId, selectableTasks]);
  return <Card title="New Research Brief"><input placeholder="Research topic" value={topic} onChange={e=>setTopic(e.target.value)} /><textarea placeholder="Context for the selected runtime task (kept in UI until standalone CRUD exists)" value={context} onChange={e=>setContext(e.target.value)} /><select value={taskId} onChange={e=>setTaskId(e.target.value)}>{selectableTasks.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><button disabled={!agent || !taskId} onClick={()=>onCreate(taskId)}>Create WorkRun</button><small>Standalone Research Brief CRUD/list APIs are not exposed; this uses createWorkRun(taskId).</small></Card>;
}
function TaskBucket({ title, tasks, action }: { title:string; tasks:Task[]; action:(task:Task)=>React.ReactNode }) { return <Card title={title}>{tasks.map(task => <TaskLine key={task.id} task={task} action={action(task)} />)}</Card>; }
function WorkReportDetail({ run, steps, report }: { run:any; steps:any[]; report:any }) { const md = `# Work Report\n\nRun: ${run?.id || "not selected"}\nStatus: ${run?.status || "unknown"}`; const copy = () => navigator.clipboard?.writeText(location.href); const exportMd = () => navigator.clipboard?.writeText(md); return <Card title="Work Report Detail" action={<><button onClick={()=>telegramAdapter.shareUrl(location.href,"GrowthBot Work Report")}>Share</button><button onClick={copy}>Copy Link</button><button onClick={exportMd}>Export Markdown</button></>}>{["Input","Execution","Evidence","Verification","Settlement"].map(section => <section key={section} className="report-section"><h3>{section}</h3><p>{report?.[section.toLowerCase()] ? JSON.stringify(report[section.toLowerCase()]) : section === "Execution" ? `Run ${run?.id || "not selected"} status ${run?.status || "unknown"}` : "No standalone report field returned by API."}</p></section>)}<RuntimeTimeline steps={steps}/></Card>; }

createRoot(document.getElementById("root")!).render(<App />);
