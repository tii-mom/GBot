import type { InventoryItem, Task, WorkReport, WorkRun, WorkStep } from "@growthbot/shared";
import type { ReportFilter, WorkspacePrimaryAction, WorkspaceStats } from "./runtimeTypes";
import type { ApiStatus, RuntimeEnvironment } from "./EnvironmentBadge";

export const tabs = ["Workspace", "Agents", "Tasks", "Reports", "Network"] as const;

export const workRunStatusLabels: Record<string, string> = {
  idle: "空闲",
  active: "运行中",
  analyzing: "分析中",
  working: "执行中",
  discovered: "发现任务",
  qualified: "符合条件",
  rejected: "不符合条件",
  planning: "生成计划",
  waiting_user: "等待你确认",
  queued: "排队执行",
  executing: "执行中",
  waiting_signature: "等待授权",
  submitting: "提交验收",
  verifying: "验收中",
  settling: "完成结算",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
  paused: "已暂停",
  disputed: "需要复核",
  pending: "待处理",
  in_progress: "进行中",
  waiting_approval: "等待确认",
  task_planning: "任务规划",
  structured_content: "结构化任务",
  project_research: "项目研究",
  risk_review: "风险复核",
  runtime_task: "任务",
  skipped: "已跳过",
  unknown: "未知状态"
};

export const reportFilterLabels: Record<ReportFilter, string> = {
  All: "全部",
  Verified: "已验证",
  Failed: "失败",
  Shared: "已分享",
  "Pending Verification": "待验收"
};

export const reportFilters: ReportFilter[] = ["All", "Verified", "Failed", "Shared", "Pending Verification"];

export const stateEmptyCopy = {
  noAgent: "当前还没有 Agent，先激活 Agent 后才能开始运行任务。",
  noTasks: "当前没有正在运行的任务。",
  noReport: "当前没有可分享战报。",
  noInput: "暂无可展示任务输入。",
  noExecution: "暂无可展示执行过程。",
  noEvidence: "暂无可展示证据。",
  noSettlement: "暂无结算记录。",
  noNetwork: "Network 数据暂未连接。",
  noVerification: "暂无验收进度可展示。",
  noSkills: "当前没有已加载的技能。",
  noWorkRun: "当前没有正在执行的任务。"
} as const;

export const classifyAsset = (item: InventoryItem) =>
  item.type === "ability" || item.type === "skill_card" || item.category === "skill"
    ? "Skills"
    : item.type === "box"
      ? "Boxes"
      : item.type === "ticket"
        ? "Tickets"
        : item.type === "energy_pack" || item.type === "badge" || item.type === "consumable"
          ? "Rewards"
          : "Assets";

export const isResearchTask = (task: Task) =>
  [task.name, task.taskType, task.code].filter(Boolean).join(" ").toLowerCase().includes("research");

export const isRunningStatus = (status?: string | null) =>
  !!status && ["discovered", "analyzing", "qualified", "planning", "queued", "executing", "waiting_signature", "submitting", "verifying", "settling", "waiting_user"].includes(status);

export const activeExecutionStatuses = ["discovered", "analyzing", "qualified", "planning", "queued", "executing", "settling"] as const;

export const isCompletedStatus = (status?: string | null) => status === "completed";
export const isFailedStatus = (status?: string | null) => status === "failed" || status === "disputed";
export const isVerificationStatus = (status?: string | null) => status === "verifying" || status === "waiting_user" || status === "waiting_signature";

export const canPauseRun = (run: WorkRun | null) => !!run && isRunningStatus(run.status) && run.status !== "waiting_user";
export const canCancelRun = (run: WorkRun | null) => !!run && isRunningStatus(run.status);
export const canResumeRun = (run: WorkRun | null) => run?.status === "paused";
export const canApproveRun = (run: WorkRun | null, steps: WorkStep[]) =>
  !!run && (run.status === "waiting_user" || steps.some((step) => step.status === "waiting_approval" || step.requiresApproval));
export const canRetryRun = (run: WorkRun | null, steps: WorkStep[]) =>
  !!run && (isFailedStatus(run.status) || steps.some((step) => step.status === "failed"));

export function statusLabel(status?: string | null) {
  return workRunStatusLabels[status || "unknown"] || status || "未知状态";
}

export function reportUrl(runId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "Reports");
  url.searchParams.set("runId", runId);
  return url.toString();
}

export function markdownFromReport(run: WorkRun | null, steps: WorkStep[], report: WorkReport | null) {
  const lines = [
    "# Work Report",
    "",
    `Run: ${run?.id || "not selected"}`,
    `Status: ${run?.status || "unknown"}`,
    `Task: ${run?.taskId || "unknown"}`,
    ""
  ];

  const sections: Array<["Input" | "Execution" | "Evidence" | "Verification" | "Settlement", string]> = [
    ["Input", report?.input ? JSON.stringify(report.input, null, 2) : stateEmptyCopy.noInput],
    [
      "Execution",
      report?.execution
        ? JSON.stringify(report.execution, null, 2)
        : run
          ? `WorkRun ${run.id} is ${run.status || "unknown"}.`
          : stateEmptyCopy.noExecution
    ],
    [
      "Evidence",
      report?.evidence?.length
        ? JSON.stringify(report.evidence, null, 2)
        : stateEmptyCopy.noEvidence
    ],
    [
      "Verification",
      report?.verification ? JSON.stringify(report.verification, null, 2) : stateEmptyCopy.noVerification
    ],
    [
      "Settlement",
      report?.settlement ? JSON.stringify(report.settlement, null, 2) : stateEmptyCopy.noSettlement
    ]
  ];

  for (const [section, content] of sections) {
    lines.push(`## ${section}`);
    lines.push(content);
    lines.push("");
  }

  lines.push("## Steps");
  if (steps.length) {
    steps.forEach((step) => {
      lines.push(`- ${step.stepOrder || "?"}. ${step.title || step.stepType}: ${statusLabel(step.status)}${step.outputSummary ? ` — ${step.outputSummary}` : ""}`);
    });
  } else {
    lines.push(`- ${stateEmptyCopy.noWorkRun}`);
  }

  return lines.join("\n");
}

export function getWorkspacePrimaryAction(stats: WorkspaceStats, hasAgent: boolean, activeRun: WorkRun | null, runs: WorkRun[]): WorkspacePrimaryAction {
  if (!hasAgent) return { label: "激活 Agent", hint: "先绑定你的 Agent 工作台", kind: "claim" };
  if (activeRun?.status === "waiting_user") return { label: "查看计划并确认", hint: "Agent 已生成计划，等你确认", kind: "plan" };
  if (activeRun && isVerificationStatus(activeRun.status)) return { label: "查看验收进度", hint: "当前任务正在进入验收流程", kind: "verify" };
  if (activeRun && isRunningStatus(activeRun.status)) return { label: "继续查看执行进度", hint: "Agent 正在推进当前任务", kind: "tasks" };
  if (!stats.energy) return { label: "打开补能或资产入口", hint: "先补充能量再继续", kind: "energy" };
  if (runs.some((run) => isCompletedStatus(run.status))) return { label: "查看战报 / 分享战报", hint: "回看最近完成的 Work Report", kind: "report" };
  if (runs.some((run) => isFailedStatus(run.status))) return { label: "查看失败原因 / 重试", hint: "定位失败步骤并重试", kind: "retry" };
  if (stats.todayTasks > 0) return { label: "开始今日任务", hint: "从可运行任务里挑一个", kind: "tasks" };
  return { label: "开始今日任务", hint: "先选择一个任务让 Agent 开始", kind: "tasks" };
}

export function formatTaskStatus(task: Task) {
  if (task.endsAt && new Date(task.endsAt).getTime() < Date.now()) return "已结束";
  if (task.autoExecutable) return "可自动执行";
  return "需要确认";
}

export function formatWorkRunSummary(run: WorkRun) {
  return {
    label: statusLabel(run.status),
    gp: `${run.actualEnergy || run.estimatedEnergy || 0} AI Credits est.`,
    energy: `${run.actualEnergy || run.estimatedEnergy || 0} AI capacity`,
    progress: Math.max(0, Math.min(100, run.progress || 0))
  };
}

export function formatVerificationLabel(status?: string | null) {
  switch (status) {
    case "approved":
      return "验收通过";
    case "verifying":
      return "验收中";
    case "rejected":
      return "验收失败";
    case "pending":
      return "待验收";
    case "submitted":
      return "已提交验收";
    default:
      return stateEmptyCopy.noVerification;
  }
}

export function formatSettlementLabel(status?: string | null) {
  switch (status) {
    case "settled":
      return "已结算";
    case "failed":
      return "结算失败";
    case "pending":
      return stateEmptyCopy.noSettlement;
    default:
      return stateEmptyCopy.noSettlement;
  }
}

export function apiStatusLabel(apiStatus: ApiStatus) {
  switch (apiStatus) {
    case "Healthy":
      return "连接正常";
    case "Degraded":
      return "部分数据暂时不可用";
    case "Offline":
      return "Agent 网络连接异常，正在重试";
    default:
      return "状态未知";
  }
}

export function skillStatusLabel(status?: string | null) {
  switch (status) {
    case "active":
      return "已学习";
    case "equipped":
      return "可用中";
    case "learned":
      return "已学习";
    case "unlearned":
      return "未学习";
    case "replaced":
      return "已替换";
    case "disabled":
      return "已停用";
    default:
      return "未学习";
  }
}

export function environmentDescription(environment: RuntimeEnvironment) {
  switch (environment) {
    case "Production":
      return "Production";
    case "Staging":
      return "Staging";
    case "Preview":
      return "Preview";
    case "Local":
      return "Local";
  }
}
