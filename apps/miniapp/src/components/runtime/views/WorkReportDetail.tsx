import { telegramAdapter } from "../../../telegramAdapter";
import { Card, RuntimeTimeline } from "..";
import { markdownFromReport, reportUrl } from "../runtimeUtils";

export function WorkReportDetail({ run, steps, report }: { run: any; steps: any[]; report: any }) {
  const canonicalUrl = run?.id && typeof window !== "undefined" ? reportUrl(run.id) : (typeof window !== "undefined" ? window.location.href : "");
  const exportMd = () => navigator.clipboard?.writeText(markdownFromReport(run, steps, report));
  const copy = () => navigator.clipboard?.writeText(canonicalUrl);
  return <Card title="Work Report Detail" action={<><button disabled={!run?.id} onClick={() => telegramAdapter.shareUrl(canonicalUrl, "GrowthBot Work Report")}>Share</button><button disabled={!run?.id} onClick={copy}>Copy Link</button><button onClick={exportMd}>Export Markdown</button></>}>
    {["Input", "Execution", "Evidence", "Verification", "Settlement"].map((section) => <section key={section} className="report-section"><h3>{section}</h3><p>{report?.[section.toLowerCase()] ? JSON.stringify(report[section.toLowerCase()]) : section === "Execution" ? `Run ${run?.id || "not selected"} status ${run?.status || "unknown"}` : "No standalone report field returned by API."}</p></section>)}
    <RuntimeTimeline steps={steps}/>
  </Card>;
}
