import type { RealAssetEvidence, WorkReport, WorkRun, WorkStep } from "@growthbot/shared";
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
      return report?.realAssetEvidence?.length
        ? JSON.stringify(report.realAssetEvidence, null, 2)
        : report?.evidence?.length ? JSON.stringify(report.evidence, null, 2) : stateEmptyCopy.noEvidence;
    case "verification":
      return report?.verification ? JSON.stringify(report.verification, null, 2) : stateEmptyCopy.noVerification;
    case "settlement":
      return report?.settlement ? JSON.stringify({ legacyCompatibility: true, ...report.settlement }, null, 2) : stateEmptyCopy.noSettlement;
  }
}

function evidenceLabel(type: RealAssetEvidence["type"]) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function EvidenceEntry({ entry }: { entry: RealAssetEvidence }) {
  const amount = entry.amount ? `${entry.amount.amount} ${entry.amount.symbol}` : null;
  return (
    <article className="report-section evidence-entry">
      <h3>{entry.title || evidenceLabel(entry.type)}</h3>
      <p>{entry.summary}</p>
      <p className="muted font-11">
        {evidenceLabel(entry.type)} · status: {entry.status}
        {amount ? ` · amount: ${amount}` : ""}
        {entry.provider ? ` · provider: ${entry.provider}` : ""}
        {entry.modelId ? ` · model: ${entry.modelId}` : ""}
      </p>
      {entry.relatedIntentId && <p className="muted font-11">Intent: {entry.relatedIntentId}</p>}
      {entry.relatedPurchaseIntentId && <p className="muted font-11">Purchase intent: {entry.relatedPurchaseIntentId}</p>}
      {entry.relatedTransactionId && <p className="muted font-11">Transaction event: {entry.relatedTransactionId}</p>}
      {entry.skillCardCodes?.length ? <p className="muted font-11">Skill Cards: {entry.skillCardCodes.join(", ")}</p> : null}
    </article>
  );
}

export function WorkReportDetail({ run, steps, report }: { run: WorkRun | null; steps: WorkStep[]; report: WorkReport | null }) {
  const canonicalUrl = run?.id && typeof window !== "undefined" ? reportUrl(run.id) : (typeof window !== "undefined" ? window.location.href : "");
  const shareText = report?.share?.text || "GrowthBot Work Report";
  const canShare = report?.share?.allowed === true && !!run?.id;
  const realAssetEvidence = report?.realAssetEvidence || [];
  const evidenceByType = (type: RealAssetEvidence["type"]) => realAssetEvidence.filter((entry) => entry.type === type);
  const exportMd = () => {
    if (typeof document === "undefined") return;
    const blob = new Blob([markdownFromReport(run, steps, report)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `growthbot-work-report-${run?.id || "current"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const copy = async () => navigator.clipboard?.writeText(canonicalUrl);

  return (
    <Card
      title="Real Asset Evidence Report"
      action={
        <>
          <button disabled={!canShare} onClick={() => telegramAdapter.shareUrl(canonicalUrl, shareText)}>分享</button>
          <button disabled={!run?.id} onClick={() => void copy()}>复制链接</button>
          <button onClick={() => void exportMd()}>导出 Markdown</button>
        </>
      }
    >
      <SectionHeader
        eyebrow="Evidence-first Work Report"
        title={run?.taskId || "当前没有可分享战报"}
        description={report?.share?.blockedReason || (report ? "Work Report 现在优先展示 Real Asset Agent evidence：policy decision、purchase intent、AI Credit usage、Skill Card capability 与 future transaction evidence；Legacy GP settlement 仅作为 legacy compatibility，no longer the main success metric." : stateEmptyCopy.noReport)}
      />

      {!run && <EmptyState title="当前没有可分享战报" description={stateEmptyCopy.noReport} />}

      {report?.realAssetSummary && (
        <section className="report-section">
          <h3>Real Asset Summary</h3>
          <p>{JSON.stringify(report.realAssetSummary, null, 2)}</p>
        </section>
      )}

      <section className="report-section">
        <h3>Policy Decision Evidence</h3>
        {evidenceByType("policy_decision").map((entry, index) => <EvidenceEntry key={`${entry.type}-${index}`} entry={entry} />)}
        {!evidenceByType("policy_decision").length && <p>{stateEmptyCopy.noEvidence}</p>}
      </section>

      <section className="report-section">
        <h3>Purchase Intent Evidence</h3>
        {[...evidenceByType("onchain_intent"), ...evidenceByType("ai_credit_purchase")].map((entry, index) => <EvidenceEntry key={`${entry.type}-${index}`} entry={entry} />)}
      </section>

      <section className="report-section">
        <h3>AI Credit Usage Evidence</h3>
        {evidenceByType("ai_credit_usage").map((entry, index) => <EvidenceEntry key={`${entry.type}-${index}`} entry={entry} />)}
      </section>

      <section className="report-section">
        <h3>Skill Card Capability Evidence</h3>
        {evidenceByType("skill_card_capability").map((entry, index) => <EvidenceEntry key={`${entry.type}-${index}`} entry={entry} />)}
      </section>

      <section className="report-section">
        <h3>Future Transaction Evidence</h3>
        {[...evidenceByType("future_transaction_placeholder"), ...evidenceByType("transaction_event")].map((entry, index) => <EvidenceEntry key={`${entry.type}-${index}`} entry={entry} />)}
      </section>

      <section className="report-section legacy-compatibility">
        <h3>Legacy GP Settlement Compatibility</h3>
        <p>{sectionContent(report, "settlement")}</p>
        <p className="muted font-11">Legacy reward fields remain readable for old clients, but they are no longer the main success metric of the Work Report.</p>
      </section>

      {(["input", "execution", "evidence", "verification", "settlement"] as const).map((section) => (
        <section key={section} className="report-section compatibility-json">
          <h3>{section === "input" ? "Input" : section === "execution" ? "Execution" : section === "evidence" ? "Evidence" : section === "verification" ? "Verification" : "Settlement"}</h3>
          <p>{sectionContent(report, section)}</p>
        </section>
      ))}

      <div className="report-status-grid">
        <StatusExplainer title="Evidence" description={`${realAssetEvidence.length} Real Asset evidence entries`} status={realAssetEvidence.length ? "approved" : "unknown"} />
        <StatusExplainer title="验收" description={formatVerificationLabel(report?.verification?.status || null)} status={report?.verification?.status || statusLabel(run?.status)} />
        <StatusExplainer title="Legacy settlement" description={formatSettlementLabel(report?.settlement?.status || null)} status={report?.settlement?.status || "unknown"} />
        <StatusExplainer title="分享" description={report?.share?.allowed ? "当前可以分享这份战报。" : report?.share?.blockedReason || "当前没有可分享战报。"} status={report?.share?.allowed ? "shared" : "unavailable"} />
      </div>

      <RuntimeTimeline steps={steps} />
      {report?.share?.allowed === false && <div className="runtime-inline-note">{report.share?.blockedReason || stateEmptyCopy.noReport}</div>}
    </Card>
  );
}
