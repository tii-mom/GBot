import type { WorkRun, WorkStep } from "@growthbot/shared";
import { apiClient } from "../../../apiClient";
import { canApproveRun, canCancelRun, canPauseRun, canResumeRun, canRetryRun, statusLabel } from "../runtimeUtils";

export function RuntimeActions({ run, steps, reload }: { run: WorkRun | null; steps: WorkStep[]; reload: () => Promise<void> }) {
  if (!run) {
    return <div className="runtime-inline-note">当前没有正在执行的任务。</div>;
  }

  return (
    <div className="task-actions">
      {canApproveRun(run, steps) && <button onClick={() => apiClient.approveStep(run.id).then(reload)}>确认执行</button>}
      {canPauseRun(run) && <button onClick={() => apiClient.pauseWorkRun(run.id).then(reload)}>暂停 Agent</button>}
      {canResumeRun(run) && <button onClick={() => apiClient.resumeWorkRun(run.id).then(reload)}>继续执行</button>}
      {canCancelRun(run) && <button onClick={() => apiClient.cancelWorkRun(run.id).then(reload)}>取消任务</button>}
      {canRetryRun(run, steps) && <button onClick={() => apiClient.retryStep(run.id).then(reload)}>重试失败步骤</button>}
      <span className="runtime-inline-note">当前状态：{statusLabel(run.status)}</span>
    </div>
  );
}
