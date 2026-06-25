import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

const docs = [
  'docs/frontend-audit.md',
  'docs/frontend-ia-v1.md',
  'docs/frontend-components.md',
  'docs/research-brief-flow.md',
  'docs/runtime-contract-lock.md',
  'docs/frontend-runtime-gap.md',
  'docs/api-alignment-report.md'
];
const read = (p) => readFileSync(p, 'utf8');
const checks = [];
const ok = (name, pass) => checks.push({ name, pass });
const hash = (content) => createHash('sha256').update(content).digest('hex');
const main = read('apps/miniapp/src/main.tsx');
const index = read('apps/miniapp/index.html');
const env = read('apps/miniapp/src/components/runtime/EnvironmentBadge.tsx');
const componentIndex = read('apps/miniapp/src/components/runtime/index.tsx');

ok('Runtime V1 official entry is connected', index.includes('/src/main.tsx') && main.includes('GrowthBot Runtime'));
ok('Workspace / Agents / Tasks / Reports / Network nav exists', ['Workspace','Agents','Tasks','Reports','Network'].every((n) => main.includes(`"${n}"`)));
ok('EnvironmentBadge file is non-empty and importable', statSync('apps/miniapp/src/components/runtime/EnvironmentBadge.tsx').size > 200 && /export\s+function\s+EnvironmentBadge/.test(env));
ok('Runtime pages exist', ['Agent Center','New Research Brief','Work Report Detail','Network Settings'].every((n) => main.includes(n)));
ok('runFarm absent from Runtime V1 entry', !main.includes('runFarm'));
ok('Research Brief compatibility copy is present', main.includes('Research Brief compatibility path') && main.includes('standalone Research Brief CRUD/list APIs'));
ok('Research Brief input payload is passed to createWorkRun', /createWorkRun\(taskId,\s*\{\s*input:\s*\{\s*type:\s*"research_brief"/.test(main));
ok('WorkReport detail sections exist', ['Input','Execution','Evidence','Verification','Settlement'].every((section) => main.includes(section)));
ok('Shareable URL support exists', /searchParams\.set\("tab",\s*"Reports"\)/.test(main) && /searchParams\.set\("runId"/.test(main) && /getInitialRoute/.test(main));
ok('Runtime action gating helpers exist', ['canPauseRun','canCancelRun','canResumeRun','canApproveRun','canRetryRun'].every((fn) => main.includes(`const ${fn}`)));
ok('AgentCard is non-interactive without onOpen', /return\s+onOpen\s*\?/.test(componentIndex) && /<article className="agent-card">/.test(componentIndex));

const docContents = docs.map((file) => [file, read(file)]);
ok('Docs files are all present', docContents.length === docs.length);
ok('Docs files are not duplicate copies', new Set(docContents.map(([, content]) => hash(content.trim()))).size === docs.length);
for (const [file, content] of docContents) {
  ok(`${file} has no unresolved Draft/Pending/TODO markers`, !/\b(Draft|Pending|TODO|Audit Deliverables Pending)\b/.test(content));
  ok(`${file} has topic-specific content`, content.trim().split(/\s+/).length > 80);
}
const audit = read('docs/frontend-audit.md');
ok('frontend-audit covers required audit sections', ['Current pages','Current components','Current state management','Current API calls','Backend capability mapping','Frontend used / unused API mapping','Gap matrix'].every((section) => audit.includes(section)));
const ia = read('docs/frontend-ia-v1.md');
ok('frontend-ia-v1 matches nav', ['Workspace','Agents','Tasks','Reports','Network'].every((section) => ia.includes(section)));
const api = read('docs/api-alignment-report.md');
ok('api-alignment-report covers required buckets', ['Used APIs','Unused APIs','Deprecated APIs','Missing APIs'].every((section) => api.includes(section)));
ok('api-alignment-report lists required missing APIs', ['Research Brief standalone CRUD / GET / LIST','Batch Settlement Query','API Health endpoint'].every((item) => api.includes(item)));

for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.name}`);
if (checks.some((c) => !c.pass)) process.exit(1);
