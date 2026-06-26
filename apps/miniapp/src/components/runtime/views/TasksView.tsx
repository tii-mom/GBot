import type { WorkRun } from "@growthbot/shared";
import type { RuntimeState, ResearchBriefInput } from "../runtimeTypes";
import { Card, EmptyState, ProgressCard, SectionHeader, StatusExplainer } from "..";
import { ResearchBriefCreateView, TaskBucket } from "./ResearchBriefCreateView";
import { RuntimeActions } from "./RuntimeActions";
import { activeExecutionStatuses, isCompletedStatus, isFailedStatus, stateEmptyCopy, statusLabel } from "../runtimeUtils";

function bucketRuns(runs: WorkRun[], predicate: (run: WorkRun) => boolean) {
  return runs.filter(predicate);
}

export function TasksView({ state, createResearchRun, loadRuntime }: { state: RuntimeState; createResearchRun: (taskId: string, input: ResearchBriefInput) => void; loadRuntime: () => Promise<void> }) {
  const availableTasks = state.tasks;
  const runningRuns = bucketRuns(state.runs, (run) => activeExecutionStatuses.includes(run.status as (typeof activeExecutionStatuses)[number]));
  const waitingRuns = bucketRuns(state.runs, (run) => run.status === "waiting_user");
  const verifyingRuns = bucketRuns(state.runs, (run) => run.status === "verifying" || run.status === "waiting_signature" || run.status === "submitting");
  const completedRuns = bucketRuns(state.runs, (run) => isCompletedStatus(run.status));
  const failedRuns = bucketRuns(state.runs, (run) => isFailedStatus(run.status));

  return (
    <section className="runtime-stack">
      <SectionHeader
        eyebrow="任务"
        title="任务执行中心"
        description="按 Runtime 状态组织任务，先分析、再确认、再执行、再验收。"
      />

      <ResearchBriefCreateView tasks={state.tasks} agent={state.agent} onCreate={createResearchRun} />

      <TaskBucket
        title="可用任务"
        tasks={availableTasks}
        action={(task) => <button onClick={() => createResearchRun(task.id, { topic: task.name, context: "从可运行任务列表开始。" })}>让 Agent 分析任务</button>}
      />

      <Card title="运行中">
        {runningRuns.length ? runningRuns.map((run) => <ProgressCard key={run.id} label={run.taskId} progress={run.progress || 0} detail={`${statusLabel(run.status)} · ${run.estimatedReward || 0} 积分 · ${run.estimatedEnergy || 0} Energy`} />) : <EmptyState title="当前没有正在运行的任务" description={stateEmptyCopy.noWorkRun} />}
      </Card>

      <Card title="等待确认">
        {waitingRuns.length ? waitingRuns.map((run) => <StatusExplainer key={run.id} title={run.taskId} description="Agent 已生成计划，等待你的确认。" status={statusLabel(run.status)} />) : <EmptyState title="暂无等待确认的任务" description="Agent 还没有生成需要你确认的计划。" />}
      </Card>

      <Card title="等待验收">
        {verifyingRuns.length ? verifyingRuns.map((run) => <StatusExplainer key={run.id} title={run.taskId} description="任务正在进入验收流程。" status={statusLabel(run.status)} />) : <EmptyState title="暂无待验收任务" description={stateEmptyCopy.noVerification} />}
      </Card>

      <Card title="已完成">
        {completedRuns.length ? completedRuns.map((run) => <StatusExplainer key={run.id} title={run.taskId} description="任务已经完成，可以在 Reports 里查看战报。" status={statusLabel(run.status)} />) : <EmptyState title="暂无完成任务" description="等 Agent 运行结束后，这里会出现已完成战报。" />}
      </Card>

      <Card title="失败 / 可重试">
        {failedRuns.length ? failedRuns.map((run) => <StatusExplainer key={run.id} title={run.taskId} description={run.failedReason || "任务失败后可重试。"} status={statusLabel(run.status)} />) : <EmptyState title="暂无失败任务" description="当前没有失败任务需要重试。" />}
      </Card>

      <Card title="执行操作">
        <RuntimeActions run={state.activeRun} steps={state.selectedRun?.id === state.activeRun?.id ? state.selectedSteps : []} reload={loadRuntime} />
      </Card>
    </section>
  );
}
