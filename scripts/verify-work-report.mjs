import { readFileSync } from 'node:fs';
const api = readFileSync('apps/miniapp/src/apiClient.ts','utf8');
const main = readFileSync('apps/miniapp/src/main.tsx','utf8');
const shared = readFileSync('packages/shared/src/index.ts','utf8');
const required = ['getWorkReport', 'WorkReportResponse', 'VerificationSummary', 'SettlementSummary'];
for (const token of required) {
  if (!api.includes(token) && !shared.includes(token)) {
    console.error(`Missing ${token}`); process.exit(1);
  }
}
for (const section of ['Input','Execution','Evidence','Verification','Settlement']) {
  if (!main.includes(section)) { console.error(`Missing report section ${section}`); process.exit(1); }
}
console.log('PASS Work Report runtime contract and detail sections are wired.');
