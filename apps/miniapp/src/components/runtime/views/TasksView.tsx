import type { RuntimeState, ResearchBriefInput } from "../runtimeTypes";
import { Card, ProgressCard } from "..";
import { ResearchBriefCreateView, TaskBucket } from "./ResearchBriefCreateView";
import { RuntimeActions } from "./RuntimeActions";

export function TasksView({ state, createResearchRun, loadRuntime }: { state: RuntimeState; createResearchRun: (taskId: string, input: ResearchBriefInput) => void; loadRuntime: () => Promise<void> }) {
  return <section><ResearchBriefCreateView tasks={state.tasks} agent={state.agent} onCreate={createResearchRun}/><TaskBucket title="Available" tasks={state.tasks} action={(task) => <button onClick={() => createResearchRun(task.id, { topic: task.name, context: "Started from available task list." })}>Start WorkRun</button>} /><Card title="Running / Verification Awaiting / Completed">{state.runs.map((run) => <ProgressCard key={run.id} label={`${run.taskId} · ${run.status}`} progress={run.progress || 0} detail={`${run.estimatedReward || 0} GP · runtime ${run.id}`} />)}<RuntimeActions run={state.activeRun} steps={state.selectedRun?.id === state.activeRun?.id ? state.selectedSteps : []} reload={loadRuntime}/></Card></section>;
}
