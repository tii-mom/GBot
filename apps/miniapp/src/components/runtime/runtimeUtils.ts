import type { InventoryItem, Task } from "@growthbot/shared";
import type { Tab } from "./runtimeTypes";

export const tabs: Tab[] = ["Workspace", "Agents", "Tasks", "Reports", "Network"];
export const runningStatuses = new Set(["discovered", "analyzing", "qualified", "planning", "queued", "executing", "submitting", "verifying", "settling"]);

export const isResearchTask = (task: Task) => [task.name, task.taskType, task.code].filter(Boolean).join(" ").toLowerCase().includes("research");
export const classifyAsset = (item: InventoryItem) => item.type === "ability" || item.type === "skill_card" || item.category === "skill" ? "Skills" : item.type === "box" ? "Boxes" : item.type === "ticket" ? "Tickets" : item.type === "energy_pack" || item.type === "badge" || item.type === "consumable" ? "Rewards" : "Assets";
export const canPauseRun = (run: any | null) => !!run && runningStatuses.has(run.status);
export const canCancelRun = (run: any | null) => !!run && runningStatuses.has(run.status);
export const canResumeRun = (run: any | null) => run?.status === "paused";
export const canApproveRun = (run: any | null, steps: any[]) => !!run && (run.status === "waiting_user" || steps.some((step) => step.status === "waiting_approval" || step.requiresApproval));
export const canRetryRun = (run: any | null, steps: any[]) => !!run && (run.status === "failed" || steps.some((step) => step.status === "failed"));

export function reportUrl(runId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "Reports");
  url.searchParams.set("runId", runId);
  return url.toString();
}

export function markdownFromReport(run: any, steps: any[], report: any) {
  const sections = ["Input", "Execution", "Evidence", "Verification", "Settlement"];
  const lines = [`# Work Report`, ``, `Run: ${run?.id || "not selected"}`, `Status: ${run?.status || "unknown"}`, ``];
  for (const section of sections) {
    const key = section.toLowerCase();
    lines.push(`## ${section}`);
    lines.push(report?.[key] ? JSON.stringify(report[key], null, 2) : section === "Execution" ? `WorkRun ${run?.id || "not selected"} is ${run?.status || "unknown"}.` : "No standalone report field returned by API.");
    lines.push("");
  }
  lines.push("## Steps");
  if (steps.length) steps.forEach((step) => lines.push(`- ${step.stepOrder || "?"}. ${step.title || step.stepType}: ${step.status}${step.outputSummary ? ` — ${step.outputSummary}` : ""}`));
  else lines.push("- No WorkRun steps returned.");
  return lines.join("\n");
}
