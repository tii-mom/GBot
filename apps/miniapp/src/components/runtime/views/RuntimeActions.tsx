import { apiClient } from "../../../apiClient";
import { canApproveRun, canCancelRun, canPauseRun, canResumeRun, canRetryRun } from "../runtimeUtils";

export function RuntimeActions({ run, steps, reload }: { run: any | null; steps: any[]; reload: () => Promise<void> }) {
  if (!run) return null;
  return <div className="task-actions">
    {canApproveRun(run, steps) && <button onClick={() => apiClient.approveStep(run.id).then(reload)}>Approve Step</button>}
    {canPauseRun(run) && <button onClick={() => apiClient.pauseWorkRun(run.id).then(reload)}>Pause</button>}
    {canResumeRun(run) && <button onClick={() => apiClient.resumeWorkRun(run.id).then(reload)}>Resume</button>}
    {canCancelRun(run) && <button onClick={() => apiClient.cancelWorkRun(run.id).then(reload)}>Cancel</button>}
    {canRetryRun(run, steps) && <button onClick={() => apiClient.retryStep(run.id).then(reload)}>Retry Step</button>}
  </div>;
}
