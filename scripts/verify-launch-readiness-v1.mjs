import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    failures.push(`${rel} is missing`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const shared = read("packages/shared/src/index.ts");
const tracker = read("apps/api-worker/src/v1/tx-status-tracker.ts");
const adminApi = read("apps/api-worker/src/v1/real-asset-admin.ts");
const adminClient = read("apps/admin/src/apiClient.ts");
const adminUi = read("apps/admin/src/main.tsx");
const miniappHome = read("apps/miniapp/src/components/HomeView.tsx");
const miniappRuntimeUtils = read("apps/miniapp/src/components/runtime/runtimeUtils.ts");
const miniappWorkspace = read("apps/miniapp/src/components/runtime/views/WorkspaceView.tsx");
const miniappI18n = read("apps/miniapp/src/i18n.ts");
const miniappOther = [
  read("apps/miniapp/src/components/AgentWorkView.tsx"),
  read("apps/miniapp/src/components/StoreView.tsx"),
  read("apps/miniapp/src/components/GroupPoolView.tsx"),
  read("apps/miniapp/src/main.tsx")
].join("\n");
const packageJson = read("package.json");
const rollbackDoc = read("docs/TON_TESTNET_EXECUTOR_ROLLBACK_RUNBOOK_V1.md");
const smokeDoc = read("docs/ONLINE_SMOKE_TEST_V1.md");
const docsJoined = [
  read("docs/API_CONTRACT.md"),
  read("docs/GO_LIVE_CHECKLIST.md"),
  read("docs/OPS_SUPPORT_RUNBOOK.md"),
  read("docs/REAL_ASSET_DB_PERSISTENCE_PLAN_V1.md"),
  rollbackDoc,
  smokeDoc
].join("\n");
const docsLower = docsJoined.toLowerCase();
const miniappUserFacing = [miniappHome, miniappRuntimeUtils, miniappWorkspace, miniappI18n, miniappOther].join("\n");
const miniappUserFacingLower = miniappUserFacing.toLowerCase();

for (const token of [
  "ExecutorReadinessStatus",
  "ExecutorReadinessGateStatus",
  "ExecutorReadinessGateKey",
  "ExecutorReadinessGate",
  "GlobalPauseReadiness",
  "RollbackReadinessSummary",
  "TxStatusTrackerLifecycleStatus",
  "TxStatusTrackerEventDraft",
  "TxStatusTrackerSummary",
  "ExecutorReadinessSummary"
]) {
  assert(shared.includes(token), `shared contract must include ${token}`);
}

for (const token of [
  "buildTxStatusTrackerSummary",
  "buildTxStatusTrackerEventDraft",
  "listSimulatedTxStatusEvents",
  "classifyTxStatusReadiness",
  "\"submitted_testnet_placeholder\"",
  "\"blocked\""
]) {
  assert(tracker.includes(token), `tx-status-tracker must include ${token}`);
}

for (const route of [
  '`${ADMIN_PREFIX}/executor-readiness`',
  '`${ADMIN_PREFIX}/tx-status-tracker`',
  '`${ADMIN_PREFIX}/rollback-readiness`'
]) {
  assert(adminApi.includes(route), `admin API must expose ${route}`);
}

for (const flag of [
  "executorEnabled: false",
  "testnetExecutorEnabled: false",
  "liveExecutorEnabled: false",
  "liveExecution: false",
  "custody: false",
  "mainWalletControl: false"
]) {
  assert(adminApi.includes(flag), `admin API must include ${flag}`);
}

for (const token of [
  "getExecutorReadiness",
  "getTxStatusTracker",
  "getRollbackReadiness",
  "ExecutorReadinessSummary",
  "TxStatusTrackerSummary",
  "RollbackReadinessSummary"
]) {
  assert(adminClient.includes(token), `admin client must include ${token}`);
}

for (const token of [
  "Executor Readiness Gate",
  "executor disabled",
  "testnet executor disabled",
  "live executor disabled",
  "no signing",
  "no broadcasting",
  "Tx Status Tracker",
  "Global Pause & Rollback"
]) {
  assert(adminUi.includes(token), `admin UI must include ${token}`);
}

assert(Boolean(rollbackDoc), "rollback runbook must exist");
assert(Boolean(smokeDoc), "online smoke test doc must exist");

for (const phrase of [
  "testnet executor remains disabled",
  "live executor remains disabled",
  "no signing",
  "no broadcasting",
  "no private keys",
  "no seed phrases",
  "no mnemonics",
  "no main wallet control"
]) {
  assert(docsLower.includes(phrase), `docs must mention ${phrase}`);
}

for (const forbidden of [
  "领取免费 agent",
  "免费领取 agent",
  "claim agent",
  "guaranteed airdrop",
  "guaranteed profit",
  "guaranteed yield",
  "risk-free",
  "fixed returns"
]) {
  assert(!miniappUserFacingLower.includes(forbidden), `miniapp user-facing paths must not include: ${forbidden}`);
}

for (const required of [
  "激活 Agent",
  "启动技能包",
  "Activate Agent"
]) {
  assert(miniappUserFacing.includes(required) || miniappUserFacingLower.includes(required.toLowerCase()), `miniapp user-facing copy should include ${required}`);
}

assert(packageJson.includes('"verify:launch-readiness-v1"'), "package.json must include verify:launch-readiness-v1");

if (failures.length > 0) {
  console.error("verify-launch-readiness-v1: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("verify-launch-readiness-v1: PASS");
