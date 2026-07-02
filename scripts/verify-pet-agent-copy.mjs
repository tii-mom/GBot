import fs from 'fs';
import path from 'path';

// Banned public-facing copy terms. Keep internal API names and legacy views compatible,
// but block active Pet Agent pages and canonical IA docs from risky positioning.
const bannedRegex = /GrowthBot HUD|Generate Execution Proposal|Agent Job Market|Processing Timeline|领取任务|claim task|guaranteed profit|guaranteed yield|guaranteed airdrop|risk-free|无风险|稳赚|保证收益|保证获利|稳定收益|零风险|躺赚|保本|必赚|必定回本|确定获利|投资回报|收益机会|帮主人打工|资金入库|召唤兽主人|等待主人确认|Developer Diagnostics|Phase 1 Preview|前端预览|嗅探|N\/A/i;

// Directories to scan
const srcDir = './apps/miniapp/src';

const activeViews = [
  'apps/miniapp/src/components/runtime/views/AgentHomeView.tsx',
  'apps/miniapp/src/components/runtime/views/TrainView.tsx',
  'apps/miniapp/src/components/runtime/views/ExploreView.tsx',
  'apps/miniapp/src/components/runtime/views/NestView.tsx',
  'apps/miniapp/src/components/runtime/views/GuildView.tsx',
  'apps/miniapp/src/components/runtime/AgentAvatarStage.tsx',
  'apps/miniapp/src/components/runtime/AgentMoodLine.tsx',
  'apps/miniapp/src/components/runtime/AgentStatusPanel.tsx',
  'apps/miniapp/src/components/runtime/petAgentAdapters.ts',
  'apps/miniapp/src/components/runtime/petAgentTypes.ts',
  'apps/miniapp/src/components/runtime/telegramPlaygroundAdapter.ts',
  'apps/miniapp/src/components/runtime/WorkReportSharePreview.tsx',
  'apps/miniapp/src/main.tsx'
];

const legacyViews = [
  'apps/miniapp/src/components/runtime/views/WorkspaceView.tsx',
  'apps/miniapp/src/components/runtime/views/AgentsView.tsx',
  'apps/miniapp/src/components/runtime/views/TasksView.tsx',
  'apps/miniapp/src/components/runtime/views/RunView.tsx',
  'apps/miniapp/src/components/runtime/views/ReportsView.tsx',
  'apps/miniapp/src/components/runtime/views/NetworkView.tsx'
];

const canonicalDocs = [
  'docs/PET_AGENT_FRONTEND_IA_V1.md',
  'docs/AGENT_PLAYGROUND_TELEGRAM_V1.md'
];

const requiredRuntimeTabs = ['Agent', 'Train', 'Explore', 'Nest', 'Guild'];
const legacyTabs = ['Workspace', 'Agents', 'Tasks', 'Run', 'Reports', 'Network'];
const requiredLegacyRedirects = {
  Workspace: 'Agent',
  Agents: 'Train',
  Tasks: 'Explore',
  Run: 'Agent',
  Reports: 'Agent',
  Network: 'Guild'
};
const expectedPrimaryActionTargets = {
  energy: 'Nest',
  plan: 'Explore',
  verify: 'Agent',
  tasks: 'Explore',
  report: 'Agent',
  retry: 'Explore'
};

function getFilesRecursively(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath));
    } else {
      results.push(fullPath.replace(/\\/g, '/')); // Normalize path
    }
  });
  return results;
}

console.log('🔍 Starting GBot Compliance Copy Verification...');

const allFiles = getFilesRecursively(srcDir);
canonicalDocs.forEach(filePath => {
  if (fs.existsSync(filePath)) allFiles.push(filePath);
});
let hasErrors = false;

allFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(bannedRegex);

  if (match) {
    const normalizedPath = filePath.startsWith('src/') ? `apps/miniapp/${filePath}` : filePath;
    const isActive = activeViews.some(av => av.endsWith(normalizedPath) || av === normalizedPath);
    const isLegacy = legacyViews.some(lv => lv.endsWith(normalizedPath) || lv === normalizedPath);

    const isCanonicalDoc = canonicalDocs.includes(normalizedPath);

    if (isActive || isCanonicalDoc) {
      console.error(`❌ ERROR: Banned copy found in ${isActive ? 'ACTIVE file' : 'CANONICAL doc'}: [${filePath}] at match: "${match[0]}"`);
      hasErrors = true;
    } else if (isLegacy) {
      // Confirm legacy files have the legacy header comment
      if (content.includes('Legacy runtime dashboard view. Not part of Pet Agent V1 primary navigation.')) {
        console.log(`⚠️ WARNING: Banned copy found in LEGACY view [${filePath}] (Safely marked as legacy).`);
      } else {
        console.error(`❌ ERROR: Legacy file [${filePath}] has banned copy but is MISSING the legacy comment!`);
        hasErrors = true;
      }
    } else {
      // General file check
      console.log(`⚠️ WARNING: Copy found in general src file [${filePath}] at match: "${match[0]}"`);
    }
  }
});

if (hasErrors) {
  console.error('\n❌ Compliance copy check FAILED. Active files contain banned copy or legacy files missing headers.');
  process.exit(1);
}

function assertCheck(name, pass, detail = '') {
  if (pass) {
    console.log(`✅ PASS: ${name}`);
    return;
  }
  console.error(`❌ FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  hasErrors = true;
}

function read(pathName) {
  return fs.readFileSync(pathName, 'utf-8');
}

function includesAll(content, values) {
  return values.every((value) => content.includes(value));
}

const main = read('apps/miniapp/src/main.tsx');
const runtimeUtils = read('apps/miniapp/src/components/runtime/runtimeUtils.ts');
const runtimeTypes = read('apps/miniapp/src/components/runtime/runtimeTypes.ts');
const bottomTabBar = read('apps/miniapp/src/components/runtime/BottomTabBar.tsx');
const petAgentTypes = read('apps/miniapp/src/components/runtime/petAgentTypes.ts');
const docsText = canonicalDocs.map(read).join('\n');

assertCheck(
  'RuntimeTab exposes the approved Pet Agent primary tabs',
  requiredRuntimeTabs.every((tab) => petAgentTypes.includes(`"${tab}"`))
    && runtimeTypes.includes('export type Tab = RuntimeTab')
);

assertCheck(
  'BottomTabBar renders only the approved primary navigation',
  requiredRuntimeTabs.every((tab) => bottomTabBar.includes(`key: "${tab}"`) && bottomTabBar.includes(`label: "${tab}"`))
    && !legacyTabs.some((tab) => bottomTabBar.includes(`key: "${tab}"`) || bottomTabBar.includes(`label: "${tab}"`))
);

assertCheck(
  'Main route renders Pet Agent primary views and not legacy views',
  requiredRuntimeTabs.every((tab) => main.includes(`tab === "${tab}"`))
    && !legacyTabs.some((tab) => main.includes(`tab === "${tab}"`))
);

for (const [legacyTab, runtimeTab] of Object.entries(requiredLegacyRedirects)) {
  assertCheck(
    `Legacy tab ${legacyTab} redirects to ${runtimeTab}`,
    runtimeUtils.includes(`${legacyTab}: "${runtimeTab}"`)
  );
}

assertCheck(
  'Report deep links resolve through Agent tab',
  runtimeUtils.includes('url.searchParams.set("tab", "Agent")')
    && !runtimeUtils.includes('url.searchParams.set("tab", "Reports")')
);

for (const [action, targetTab] of Object.entries(expectedPrimaryActionTargets)) {
  const caseIndex = main.indexOf(`case "${action}":`);
  const nextCaseIndex = main.indexOf('case "', caseIndex + 1);
  const actionBlock = caseIndex === -1
    ? ''
    : main.slice(caseIndex, nextCaseIndex === -1 ? main.length : nextCaseIndex);
  assertCheck(
    `Primary action ${action} routes to ${targetTab}`,
    actionBlock.includes(`setTab("${targetTab}")`)
  );
}

assertCheck(
  'Primary flow does not target legacy tabs',
  !/setTab\("(Workspace|Agents|Tasks|Run|Reports|Network)"\)/.test(main + runtimeUtils)
    && !/searchParams\.set\("tab",\s*"(Workspace|Agents|Tasks|Run|Reports|Network)"\)/.test(main + runtimeUtils)
);

assertCheck(
  'Canonical docs describe current Pet Agent surfaces',
  includesAll(docsText, ['AgentHomeView', 'TrainView', 'ExploreView', 'NestView', 'GuildView', 'Telegram Plaza', 'Policy Guard'])
);

assertCheck(
  'Canonical docs avoid old positioning language',
  !/召唤兽主人|收益带回|Phase 1 Preview|投资回报|保证收益|稳定收益|稳赚|保本/.test(docsText)
);

assertCheck(
  'Active Pet Agent views contain Telegram, Nest, and Guild production surfaces',
  read('apps/miniapp/src/components/runtime/views/ExploreView.tsx').includes('Telegram 授权源')
    && read('apps/miniapp/src/components/runtime/views/NestView.tsx').includes('已授权的数据来源')
    && read('apps/miniapp/src/components/runtime/views/GuildView.tsx').includes('Telegram 公会 Agent')
);

if (hasErrors) {
  console.error('\n❌ Pet Agent IA verification FAILED.');
  process.exit(1);
}

console.log('\n✅ Pet Agent IA verification PASSED. Active copy, routing, docs, and navigation are aligned.');
