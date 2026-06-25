import { readFileSync } from 'node:fs';

const api = readFileSync('apps/miniapp/src/apiClient.ts', 'utf8');
const main = readFileSync('apps/miniapp/src/main.tsx', 'utf8');
const shared = readFileSync('packages/shared/src/index.ts', 'utf8');

const checks = [
  ['WorkReportResponse interface is exported', /export\s+interface\s+WorkReportResponse\s*\{[\s\S]*?report:\s*WorkReport\s*\|\s*null/.test(shared)],
  ['WorkReport interface is exported', /export\s+interface\s+WorkReport\s*\{[\s\S]*?verification:\s*VerificationSummary;[\s\S]*?settlement:\s*SettlementSummary;/.test(shared)],
  ['VerificationSummary interface is exported', /export\s+interface\s+VerificationSummary\s*\{/.test(shared)],
  ['SettlementSummary interface is exported', /export\s+interface\s+SettlementSummary\s*\{/.test(shared)],
  ['apiClient getWorkReport method calls report endpoint', /getWorkReport:\s*async\s*\(runId:\s*string\):\s*Promise<WorkReportResponse>[\s\S]*request<WorkReportResponse>\(`\/work-runs\/\$\{runId\}\/report`\)/.test(api)],
  ['WorkReportDetail component is declared', /function\s+WorkReportDetail\s*\(/.test(main)],
  ['WorkReportDetail uses canonical report URL', /function\s+reportUrl\s*\([\s\S]*runId/.test(main) && /telegramAdapter\.shareUrl\(canonicalUrl/.test(main)],
  ['WorkReportDetail includes required sections', /\["Input",\s*"Execution",\s*"Evidence",\s*"Verification",\s*"Settlement"\]/.test(main)],
  ['Export Markdown includes run and steps', /function\s+markdownFromReport\s*\([\s\S]*Run:\s*\$\{run\?\.id[\s\S]*## Steps/.test(main)]
];

for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, pass]) => !pass)) process.exit(1);
