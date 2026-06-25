import type { RuntimeState } from "../runtimeTypes";
import { Card, ReportCard } from "..";
import { WorkReportDetail } from "./WorkReportDetail";

export function ReportsView({ state, openReport }: { state: RuntimeState; openReport: (runId: string) => Promise<void> }) {
  return <section><Card title="Reports">{state.runs.map((run) => <ReportCard key={run.id} title={`Work Report · ${run.taskId}`} runId={run.id} status={run.status} onOpen={() => openReport(run.id)} />)}</Card><WorkReportDetail run={state.selectedRun} steps={state.selectedSteps} report={state.selectedReport}/></section>;
}
