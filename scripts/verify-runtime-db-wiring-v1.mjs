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

function containsUnsafeClaim(line) {
  return ["guaranteed profit", "guaranteed yield", "guaranteed airdrop", "risk-free", "fixed returns"].some((term) => line.includes(term));
}

function isSafetyLine(line) {
  const trimmed = line.trim();
  return ["do not", "must not", "no ", "- do not", "- must not", "- no "].some((prefix) => trimmed.startsWith(prefix))
    || trimmed.includes("avoid any copy that promises");
}

const repository = read("apps/api-worker/src/v1/real-asset-repository.ts");
const wallet = read("apps/api-worker/src/v1/wallet.ts");
const workflow = read("apps/api-worker/src/v1/workflow.ts");
const admin = read("apps/api-worker/src/v1/real-asset-admin.ts");
const shared = read("packages/shared/src/index.ts");
const adminUi = read("apps/admin/src/main.tsx");
const adminClient = read("apps/admin/src/apiClient.ts");
const packageJson = read("package.json");
const docsJoined = [
  read("docs/API_CONTRACT.md"),
  read("docs/DATABASE_SCHEMA.md"),
  read("docs/REAL_ASSET_DB_PERSISTENCE_PLAN_V1.md"),
  read("docs/OPS_SUPPORT_RUNBOOK.md"),
  read("docs/GO_LIVE_CHECKLIST.md"),
  read("docs/GP_REMOVAL_PLAN.md")
].join("\n");
const docsLower = docsJoined.toLowerCase();

assert(fs.existsSync("apps/api-worker/src/v1/real-asset-repository.ts"), "repository file must exist");
for (const helper of [
  "getAgentWalletPolicyFromDb",
  "upsertAgentWalletPolicyToDb",
  "getEffectiveAgentWalletPolicy",
  "listWalletAssetSnapshots",
  "appendWalletAssetSnapshot",
  "getLatestWalletAssetSnapshot",
  "appendAssetLedgerEvent",
  "listAssetLedgerEvents",
  "appendOnchainTransactionIntent",
  "listOnchainTransactionIntents",
  "updateOnchainTransactionIntentStatusSimulated",
  "appendAiModelTokenPurchaseIntent",
  "listAiModelTokenPurchaseIntents",
  "updateAiModelTokenPurchaseIntentStatusSimulated",
  "appendAiCreditUsageEvent",
  "listAiCreditUsageEvents",
  "appendWorkReportEvidenceEvent",
  "listWorkReportEvidenceEvents",
  "listWorkReportEvidenceByReport",
  "appendAdminRiskAuditEvent",
  "listAdminRiskAuditEvents"
]) {
  assert(repository.includes(helper), `repository must include ${helper}`);
}

assert(admin.includes("`${ADMIN_PREFIX}/review-queue`"), "admin routes must include review-queue");
assert(admin.includes("`${ADMIN_PREFIX}/review-queue/:itemId`"), "admin routes must include review-queue item route");
assert(admin.includes("`${ADMIN_PREFIX}/review-queue/:itemId/review-simulated`"), "admin routes must include review-queue simulated review route");

for (const token of [
  "AdminReviewQueueItemType",
  "AdminReviewQueueItemStatus",
  "AdminReviewQueueResponse",
  "AdminReviewActionRequest",
  "AdminReviewActionResponse",
  "RealAssetPersistenceSource = \"db\" | \"fallback\" | \"simulated\""
]) {
  assert(shared.includes(token), `shared types must include ${token}`);
}

for (const token of [
  "Review Queue",
  "data source:",
  "persistence:",
  "simulation-only",
  "no live execution",
  "no custody",
  "no main wallet control"
]) {
  assert(adminUi.includes(token), `admin UI must include ${token}`);
}

for (const token of [
  "getReviewQueue",
  "getReviewQueueItem",
  "reviewQueueItemSimulated"
]) {
  assert(adminClient.includes(token), `admin client must include ${token}`);
}

assert(wallet.includes("walletPolicySource"), "wallet routes must expose walletPolicySource");
assert(wallet.includes("appendOnchainTransactionIntent"), "wallet routes must persist onchain intents when available");
assert(wallet.includes("appendAiModelTokenPurchaseIntent"), "wallet routes must persist purchase intents when available");
assert(workflow.includes("/work-runs/:runId/report"), "workflow must expose /work-runs/:runId/report");
assert(workflow.includes("appendWorkReportEvidenceEvent"), "workflow must append work report evidence");

for (const phrase of [
  "fallback-first",
  "simulated-only",
  "review-only",
  "production migration apply",
  "live chain execution",
  "no private keys",
  "seed phrases",
  "main wallet control",
  "testnet executor remains blocked"
]) {
  assert(docsLower.includes(phrase), `docs must mention ${phrase}`);
}

for (const line of docsLower.split(/\r?\n/)) {
  assert(!containsUnsafeClaim(line) || isSafetyLine(line), `unsafe claim found outside safety context: ${line}`);
}

assert(packageJson.includes('"verify:runtime-db-wiring-v1"'), "package.json must include verify:runtime-db-wiring-v1");

if (failures.length > 0) {
  console.error("verify-runtime-db-wiring-v1: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("verify-runtime-db-wiring-v1: PASS");
