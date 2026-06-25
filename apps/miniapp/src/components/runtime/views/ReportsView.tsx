import { useMemo, useState } from "react";
import type { WorkReport, WorkRun } from "@growthbot/shared";
import type { ReportFilter, RuntimeState } from "../runtimeTypes";
import { Card, EmptyState, ReportCard, SectionHeader } from "..";
import { reportFilterLabels, reportFilters, stateEmptyCopy, statusLabel } from "../runtimeUtils";
import { WorkReportDetail } from "./WorkReportDetail";

function runMatchesFilter(run: WorkRun, report: WorkReport | null, filter: ReportFilter) {
  switch (filter) {
    case "Verified":
      return report?.verification?.status === "approved";
    case "Failed":
      return run.status === "failed" || report?.verification?.status === "rejected";
    case "Shared":
      return report?.share?.allowed === true;
    case "Pending Verification":
      return run.status === "verifying" || run.status === "waiting_signature" || report?.verification?.status === "verifying" || report?.verification?.status === "pending";
    default:
      return true;
  }
}

function emptyCopyForFilter(filter: ReportFilter) {
  switch (filter) {
    case "Failed":
      return { title: "暂无失败战报", description: "当前没有失败或验收未通过的战报。" };
    case "Shared":
      return { title: "当前没有可分享战报", description: stateEmptyCopy.noReport };
    case "Pending Verification":
      return { title: "暂无待验收战报", description: stateEmptyCopy.noVerification };
    case "Verified":
      return { title: "暂无已验证战报", description: "验收通过后会出现在这里。" };
    default:
      return { title: "当前没有可分享战报", description: stateEmptyCopy.noReport };
  }
}

export function ReportsView({ state, openReport }: { state: RuntimeState; openReport: (runId: string) => Promise<void> }) {
  const [filter, setFilter] = useState<ReportFilter>("All");
  const reports = useMemo(() => state.runs.filter((run) => runMatchesFilter(run, state.reportCache[run.id] || (state.selectedRun?.id === run.id ? state.selectedReport : null), filter)), [filter, state.reportCache, state.runs, state.selectedReport, state.selectedRun]);
  const emptyCopy = emptyCopyForFilter(filter);

  return (
    <section className="runtime-stack">
      <SectionHeader
        eyebrow="Reports"
        title="Agent 战报中心"
        description="战报是只读投影，支持查看、分享、复制链接和导出 Markdown。"
      />

      <Card title="筛选">
        <div className="filter-row">
          {reportFilters.map((item) => <button key={item} className={item === filter ? "active" : ""} onClick={() => setFilter(item)}>{reportFilterLabels[item]}</button>)}
        </div>
      </Card>

      <Card title="战报列表">
        {reports.length ? reports.map((run) => (
          <ReportCard
            key={run.id}
            report={state.reportCache[run.id] || (state.selectedRun?.id === run.id ? state.selectedReport || run : run)}
            filter={filter}
            onOpen={() => openReport(run.id)}
          />
        )) : <EmptyState title={emptyCopy.title} description={emptyCopy.description} />}
      </Card>

      <WorkReportDetail run={state.selectedRun} steps={state.selectedSteps} report={state.selectedReport} />
      {state.selectedRun && <div className="runtime-inline-note">当前选中战报：{state.selectedRun.taskId} · {statusLabel(state.selectedRun.status)}</div>}
    </section>
  );
}
