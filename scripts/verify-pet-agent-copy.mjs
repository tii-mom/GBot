import fs from 'fs';
import path from 'path';

// Banned copy terms
const bannedRegex = /GrowthBot HUD|Generate Execution Proposal|Agent Job Market|Processing Timeline|领取任务|claim task|guaranteed profit|guaranteed yield|guaranteed airdrop|risk-free|无风险|稳赚|保证收益|零风险|躺赚|保本|必赚|必定回本|确定获利|投资回报提升/i;

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
let hasErrors = false;

allFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(bannedRegex);

  if (match) {
    const normalizedPath = filePath.startsWith('src/') ? `apps/miniapp/${filePath}` : filePath;
    const isActive = activeViews.some(av => av.endsWith(normalizedPath) || av === normalizedPath);
    const isLegacy = legacyViews.some(lv => lv.endsWith(normalizedPath) || lv === normalizedPath);

    if (isActive) {
      console.error(`❌ ERROR: Banned copy found in ACTIVE file: [${filePath}] at match: "${match[0]}"`);
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
} else {
  console.log('\n✅ Compliance copy check PASSED successfully! All active files are clean.');
  process.exit(0);
}
