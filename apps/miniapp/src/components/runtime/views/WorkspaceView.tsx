import type { RuntimeState, Tab, WorkspaceStats } from "../runtimeTypes";
import { Card, StatCard } from "..";
import { isResearchTask } from "../runtimeUtils";

export function WorkspaceView({ state, workspaceStats, setTab }: { state: RuntimeState; workspaceStats: WorkspaceStats; setTab: (tab: Tab) => void }) {
  return <section className="runtime-grid"><StatCard label="Active Agents" value={workspaceStats.activeAgents}/><StatCard label="Running Tasks" value={workspaceStats.runningTasks}/><StatCard label="Verified Reports" value={workspaceStats.verifiedReports}/><StatCard label="Settlements" value={workspaceStats.settlements}/><StatCard label="GP Earned" value={workspaceStats.gpEarned}/><Card title="Recent Activity"><ul><li>Research Brief: {state.tasks.find(isResearchTask)?.name || "No research task returned"}</li><li>Verification: {state.runs.find((run) => run.status === "verifying")?.id || "No active verification"}</li><li>Settlement: {state.runs.find((run) => run.settled)?.id || "No settled runtime returned"}</li><li>Work Report: {state.runs[0]?.id || "No WorkRun history returned"}</li></ul></Card><Card title="Quick Actions"><button onClick={() => setTab("Tasks")}>New Research Brief</button><button onClick={() => setTab("Reports")}>Open Reports</button><button onClick={() => setTab("Tasks")}>Open Tasks</button></Card></section>;
}
