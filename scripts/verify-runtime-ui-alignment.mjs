import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

const main = read("apps/miniapp/src/main.tsx");
const indexHtml = read("apps/miniapp/index.html");
const runtimeUtils = read("apps/miniapp/src/components/runtime/runtimeUtils.ts");
const runtimeTypes = read("apps/miniapp/src/components/runtime/runtimeTypes.ts");
const workspaceView = read("apps/miniapp/src/components/runtime/views/WorkspaceView.tsx");
const tasksView = read("apps/miniapp/src/components/runtime/views/TasksView.tsx");
const reportsView = read("apps/miniapp/src/components/runtime/views/ReportsView.tsx");
const workReportDetail = read("apps/miniapp/src/components/runtime/views/WorkReportDetail.tsx");
const agentsView = read("apps/miniapp/src/components/runtime/views/AgentsView.tsx");
const networkView = read("apps/miniapp/src/components/runtime/views/NetworkView.tsx");
const environmentBadge = read("apps/miniapp/src/components/runtime/EnvironmentBadge.tsx");
const shared = read("packages/shared/src/index.ts");
const docs = [
  "docs/frontend-production-entry-audit.md",
  "docs/frontend-product-ia-v2.md",
  "docs/frontend-api-usage-v2.md",
  "docs/frontend-runtime-product-alignment-v2.md"
].map((path) => [path, read(path)]);

const checks = [
  ["Mini app entry points to /src/main.tsx", indexHtml.includes('/src/main.tsx')],
  ["Runtime V1 shell renders Workspace / Agents / Tasks / Reports / Network", ["Workspace", "Agents", "Tasks", "Reports", "Network"].every((tab) => main.includes(tab) && runtimeTypes.includes(`"${tab}"`))],
  ["Legacy V0 primary nav labels are not present in Runtime V1 tab model", !runtimeTypes.includes('Home') && !runtimeTypes.includes('Missions') && !runtimeTypes.includes('Bag') && !runtimeTypes.includes('Market') && !runtimeTypes.includes('Crew')],
  ["EnvironmentBadge supports Production/Staging/Preview/Local", ["Production", "Staging", "Preview", "Local"].every((value) => environmentBadge.includes(value))],
  ["EnvironmentBadge supports Healthy/Degraded/Offline", ["Healthy", "Degraded", "Offline"].every((value) => environmentBadge.includes(value) || main.includes(value))],
  ["Workspace copy is productized", workspaceView.includes("Agent 工作台") && workspaceView.includes("今日可运行任务") && workspaceView.includes("最近 Work Report")],
  ["Tasks view uses productized Chinese labels", tasksView.includes("让 Agent 分析任务") && tasksView.includes("当前没有正在运行的任务") && tasksView.includes("等待确认") && tasksView.includes("等待验收") && tasksView.includes("执行操作")],
  ["Reports view exposes filter and share surface", reportsView.includes("Agent 战报中心") && reportsView.includes("筛选") && reportsView.includes("战报列表")],
  ["WorkReport detail uses five sections and empty states", ["Input", "Execution", "Evidence", "Verification", "Settlement"].every((section) => workReportDetail.includes(section)) && workReportDetail.includes("当前没有可分享战报") && runtimeUtils.includes("暂无可展示任务输入") && runtimeUtils.includes("暂无结算记录") && runtimeUtils.includes("暂无可展示证据")],
  ["Agent and Network views are productized", agentsView.includes("Agent 与技能") && networkView.includes("Network 数据暂未连接") && networkView.includes("战队 / 邀请 / 资产 / 市场")],
  ["Runtime utilities define product empty states and report markdown", runtimeUtils.includes("暂无可展示证据") && runtimeUtils.includes("ReportFilter") && runtimeUtils.includes("markdownFromReport") && runtimeUtils.includes("createWorkRun") === false],
  ["WorkReport share support exists in shared types", shared.includes("share?:") && shared.includes("blockedReason")],
  ["Frontend IA / audit docs are present", docs.every(([, content]) => content.length > 80)]
];

for (const [name, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

if (checks.some(([, pass]) => !pass)) {
  process.exit(1);
}
