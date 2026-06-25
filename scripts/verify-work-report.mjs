import { readFileSync } from 'node:fs';

const api = readFileSync('apps/miniapp/src/apiClient.ts', 'utf8');
const main = readFileSync('apps/miniapp/src/main.tsx', 'utf8');
const runtimeUtils = readFileSync('apps/miniapp/src/components/runtime/runtimeUtils.ts', 'utf8');
const workReportDetail = readFileSync('apps/miniapp/src/components/runtime/views/WorkReportDetail.tsx', 'utf8');
const shared = readFileSync('packages/shared/src/index.ts', 'utf8');

const workReportResponseMatch = shared.match(/export\s+interface\s+WorkReportResponse\s*\{(?<body>[\s\S]*?)\n\}/);
const workReportResponseBody = workReportResponseMatch?.groups?.body ?? '';
const normalizedWorkReportResponseBody = workReportResponseBody.replace(/\s+/g, ' ');
const reportAllowsNull = /\breport\s*:\s*WorkReport\s*\|\s*null\s*;/.test(workReportResponseBody);
const reportIsNonNullable = /\breport\s*:\s*WorkReport\s*;/.test(workReportResponseBody);

const checks = [
  ['WorkReportResponse interface is exported', Boolean(workReportResponseMatch)],
  ['WorkReportResponse.report explicitly allows null', reportAllowsNull && normalizedWorkReportResponseBody.includes('report: WorkReport | null')],
  ['WorkReportResponse.report is not non-nullable WorkReport only', !reportIsNonNullable],
  ['WorkReport interface is exported', /export\s+interface\s+WorkReport\s*\{[\s\S]*?verification:\s*VerificationSummary;[\s\S]*?settlement:\s*SettlementSummary;/.test(shared)],
  ['VerificationSummary interface is exported', /export\s+interface\s+VerificationSummary\s*\{/.test(shared)],
  ['SettlementSummary interface is exported', /export\s+interface\s+SettlementSummary\s*\{/.test(shared)],
  ['apiClient getWorkReport method calls report endpoint', /getWorkReport:\s*async\s*\(runId:\s*string\):\s*Promise<WorkReportResponse>[\s\S]*request<WorkReportResponse>\(`\/work-runs\/\$\{runId\}\/report`\)/.test(api)],
  ['apiClient getWorkReport fallback may return null report', /getWorkReport:[\s\S]*return\s*\{\s*report:\s*null\s*\}/.test(api)],
  ['WorkReportDetail component is declared', /function\s+WorkReportDetail\s*\(/.test(workReportDetail)],
  ['WorkReportDetail uses canonical report URL', /function\s+reportUrl\s*\([\s\S]*runId/.test(runtimeUtils) && /telegramAdapter\.shareUrl\(canonicalUrl/.test(workReportDetail)],
  ['WorkReportDetail includes required sections', ['Input', 'Execution', 'Evidence', 'Verification', 'Settlement'].every((section) => workReportDetail.includes(section)) && workReportDetail.includes('当前没有可分享战报') && runtimeUtils.includes('暂无可展示任务输入') && runtimeUtils.includes('暂无结算记录') && runtimeUtils.includes('暂无可展示证据')],
  ['Export Markdown includes run and steps', /function\s+markdownFromReport\s*\([\s\S]*Run:\s*\$\{run\?\.id[\s\S]*## Steps/.test(runtimeUtils)]
];

for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, pass]) => !pass)) process.exit(1);
