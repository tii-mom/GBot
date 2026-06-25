import type { WorkReport, WorkRun, WorkStep } from "@growthbot/shared";
import { telegramAdapter } from "../../../telegramAdapter";
import { Card, EmptyState, RuntimeTimeline, SectionHeader, StatusExplainer } from "..";
import { formatSettlementLabel, formatVerificationLabel, markdownFromReport, reportUrl, stateEmptyCopy, statusLabel } from "../runtimeUtils";

function sectionContent(report: WorkReport | null, section: "input" | "execution" | "evidence" | "verification" | "settlement") {
  switch (section) {
    case "input":
      return report?.input ? JSON.stringify(report.input, null, 2) : stateEmptyCopy.noInput;
    case "execution":
      return report?.execution ? JSON.stringify(report.execution, null, 2) : stateEmptyCopy.noExecution;
    case "evidence":
      return report?.evidence?.length ? JSON.stringify(report.evidence, null, 2) : stateEmptyCopy.noEvidence;
    case "verification":
      return report?.verification ? JSON.stringify(report.verification, null, 2) : stateEmptyCopy.noVerification;
    case "settlement":
      return report?.settlement ? JSON.stringify(report.settlement, null, 2) : stateEmptyCopy.noSettlement;
  }
}

export function WorkReportDetail({ run, steps, report }: { run: WorkRun | null; steps: WorkStep[]; report: WorkReport | null }) {
  const canonicalUrl = run?.id && typeof window !== "undefined" ? reportUrl(run.id) : (typeof window !== "undefined" ? window.location.href : "");
  const shareText = report?.share?.text || "GrowthBot Work Report";
  const canShare = report?.share?.allowed !== false && !!run?.id;
  const exportMd = async () => navigator.clipboard?.writeText(markdownFromReport(run, steps, report));
  const copy = async () => navigator.clipboard?.writeText(canonicalUrl);

  return (
    <Card
      title="战报详情"
      action={
        <>
          <button disabled={!canShare} onClick={() => telegramAdapter.shareUrl(canonicalUrl, shareText)}>分享</button>
          <button disabled={!run?.id} onClick={() => void copy()}>复制链接</button>
          <button onClick={() => void exportMd()}>导出 Markdown</button>
        </>
      }
    >
      <SectionHeader
        eyebrow="战报"
        title={run?.taskId || "当前没有可分享战报"}
        description={report?.share?.blockedReason || (report ? "这是只读的 Work Report 投影。" : stateEmptyCopy.noReport)}
      />

      {!run && <EmptyState title="当前没有可分享战报" description={stateEmptyCopy.noReport} />}

      {(["input", "execution", "evidence", "verification", "settlement"] as const).map((section) => (
        <section key={section} className="report-section">
          <h3>{section === "input" ? "Input" : section === "execution" ? "Execution" : section === "evidence" ? "Evidence" : section === "verification" ? "Verification" : "Settlement"}</h3>
          <p>{sectionContent(report, section)}</p>
        </section>
      ))}

      <div className="report-status-grid">
        <StatusExplainer title="验收" description={formatVerificationLabel(report?.verification?.status || null)} status={report?.verification?.status || statusLabel(run?.status)} />
        <StatusExplainer title="结算" description={formatSettlementLabel(report?.settlement?.status || null)} status={report?.settlement?.status || "unknown"} />
        <StatusExplainer title="分享" description={report?.share?.allowed ? "当前可以分享这份战报。" : report?.share?.blockedReason || "当前没有可分享战报。"} status={report?.share?.allowed ? "shared" : "unavailable"} />
      </div>

      <RuntimeTimeline steps={steps} />
      {report?.share?.allowed === false && <div className="runtime-inline-note">{report.share?.blockedReason || stateEmptyCopy.noReport}</div>}
    </Card>
  );
}
