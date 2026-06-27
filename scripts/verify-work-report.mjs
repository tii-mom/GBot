import { readFileSync } from 'node:fs';

const api = readFileSync('apps/miniapp/src/apiClient.ts', 'utf8');
const main = readFileSync('apps/miniapp/src/main.tsx', 'utf8');
const runtimeUtils = readFileSync('apps/miniapp/src/components/runtime/runtimeUtils.ts', 'utf8');
const workReportDetail = readFileSync('apps/miniapp/src/components/runtime/views/WorkReportDetail.tsx', 'utf8');
const shared = readFileSync('packages/shared/src/index.ts', 'utf8');
const workflow = readFileSync('apps/api-worker/src/v1/workflow.ts', 'utf8');
const intentService = readFileSync('apps/api-worker/src/v1/intent-service.ts', 'utf8');
const apiContract = readFileSync('docs/API_CONTRACT.md', 'utf8');
const gpRemoval = readFileSync('docs/GP_REMOVAL_PLAN.md', 'utf8');

const workReportResponseMatch = shared.match(/export\s+interface\s+WorkReportResponse\s*\{(?<body>[\s\S]*?)\n\}/);
const workReportResponseBody = workReportResponseMatch?.groups?.body ?? '';
const normalizedWorkReportResponseBody = workReportResponseBody.replace(/\s+/g, ' ');
const reportAllowsNull = /\breport\s*:\s*WorkReport\s*\|\s*null\s*;/.test(workReportResponseBody);
const reportIsNonNullable = /\breport\s*:\s*WorkReport\s*;/.test(workReportResponseBody);
const sectionOrderMatch = workReportDetail.match(/\(\[\s*"input",\s*"execution",\s*"evidence",\s*"verification",\s*"settlement"\s*\]\s+as\s+const\)\.map/);
const requiredEvidenceTypes = [
  'policy_decision',
  'onchain_intent',
  'transaction_event',
  'ai_credit_purchase',
  'ai_credit_usage',
  'skill_card_capability',
  'future_transaction_placeholder',
  'legacy_settlement_compatibility'
];
const requiredEvidenceInterfaces = [
  'RealAssetEvidence',
  'PolicyDecisionEvidence',
  'OnchainIntentEvidence',
  'TransactionEventEvidence',
  'AiCreditPurchaseEvidence',
  'AiCreditUsageEvidence',
  'SkillCardCapabilityEvidence',
  'RealAssetWorkReportSummary'
];
const requiredEvidenceHelpers = [
  'workReportEvidenceDraft',
  'policyDecisionEvidenceDraft',
  'aiCreditUsageEvidenceDraft',
  'aiCreditPurchaseEvidenceDraft',
  'skillCardCapabilityEvidenceDraft',
  'futureTransactionEvidenceDraft'
];

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
  ['WorkReportDetail renders five sections in canonical order', Boolean(sectionOrderMatch) && ['Input', 'Execution', 'Evidence', 'Verification', 'Settlement'].every((section) => workReportDetail.includes(section)) && workReportDetail.includes('当前没有可分享战报') && runtimeUtils.includes('暂无可展示任务输入') && runtimeUtils.includes('暂无结算记录') && runtimeUtils.includes('暂无可展示证据')],
  ['WorkReportDetail export downloads Markdown file', workReportDetail.includes('new Blob([markdownFromReport') && workReportDetail.includes('download = `growthbot-work-report-${run?.id || "current"}.md`')],
  ['Export Markdown includes run and steps', /function\s+markdownFromReport\s*\([\s\S]*Run:\s*\$\{run\?\.id[\s\S]*## Steps/.test(runtimeUtils)],
  ['Shared real-asset evidence interfaces are exported', requiredEvidenceInterfaces.every((name) => shared.includes(`export interface ${name}`))],
  ['Shared real-asset evidence type values exist', requiredEvidenceTypes.every((type) => shared.includes(`"${type}"`))],
  ['WorkReport includes realAssetEvidence, evidenceSections, and realAssetSummary', ['realAssetEvidence?: RealAssetEvidence[]', 'evidenceSections?: RealAssetEvidenceSection[]', 'realAssetSummary?: RealAssetWorkReportSummary'].every((token) => shared.includes(token))],
  ['Intent-service evidence helper functions exist', requiredEvidenceHelpers.every((helper) => intentService.includes(`export function ${helper}`))],
  ['Intent-service helpers are simulation-only and custody-safe', intentService.includes('simulationOnly: true') && intentService.includes('liveExecution: false') && intentService.includes('privateKeyRequired: false') && intentService.includes('mainWalletControl: false')],
  ['Workflow report route returns evidence-first WorkReport', workflow.includes('app.get("/work-runs/:runId/report"') && workflow.includes('buildRealAssetWorkReport') && workflow.includes('realAssetEvidence') && workflow.includes('evidenceSections') && workflow.includes('realAssetSummary')],
  ['Mini App WorkReportDetail uses evidence-first terminology', ['Policy Decision Evidence', 'Purchase Intent Evidence', 'AI Credit Usage Evidence', 'Skill Card Capability Evidence', 'Future Transaction Evidence', 'Legacy GP Settlement Compatibility'].every((text) => workReportDetail.includes(text))],
  ['Mini App demotes legacy GP settlement', workReportDetail.includes('legacy compatibility') && workReportDetail.includes('no longer the main success metric') && workReportDetail.includes('Legacy GP')],
  ['API contract documents evidence-first Work Report', apiContract.includes('evidence-first') && apiContract.includes('realAssetEvidence') && apiContract.includes('evidenceSections') && apiContract.includes('realAssetSummary')],
  ['GP removal plan classifies Work Report GP fields as compatibility', gpRemoval.includes('evidence-first contract') && gpRemoval.includes('legacy compatibility fields') && gpRemoval.includes('Future live chain Work Reports must include tx hash')]
];

for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, pass]) => !pass)) process.exit(1);
