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

const canonical = read("docs/GBOT_CANONICAL_V1.md");
const docsReadme = read("docs/README.md");
const shared = read("packages/shared/src/index.ts");
const adminApi = read("apps/admin/src/apiClient.ts");
const adminUi = read("apps/admin/src/main.tsx");
const apiWorkerIndex = read("apps/api-worker/src/index.ts");
const apiWorkerRealAsset = read("apps/api-worker/src/v1/real-asset-admin.ts");
const economy = read("docs/G_TOKEN_ECONOMY_V1.md");
const realAsset = read("docs/REAL_ASSET_AGENT_V1.md");
const wallet = read("docs/TON_AGENT_WALLET_V1.md");
const aiPurchase = read("docs/AI_MODEL_TOKEN_PURCHASE_V1.md");
const apiContract = read("docs/API_CONTRACT.md");
const opsRunbook = read("docs/OPS_SUPPORT_RUNBOOK.md");
const canonicalDocs = [canonical, economy, realAsset, wallet, aiPurchase, apiContract, opsRunbook].join("\n");

assert(Boolean(canonical), "docs/GBOT_CANONICAL_V1.md must exist and be readable");
assert(docsReadme.includes("GBOT_CANONICAL_V1.md"), "docs/README.md must point to GBOT_CANONICAL_V1.md");

for (const token of [
  "export type AssetSymbol",
  "export interface AssetAmount",
  "export interface AssetBalance",
  "export interface AssetLedgerEvent",
  "export type AssetLedgerEventType",
  "export type AgentWalletType",
  "export type AgentWalletStatus",
  "export interface AgentWalletPolicy",
  "export type PolicyGuardDecisionStatus",
  "export interface PolicyGuardDecision",
  "export interface PolicyGuardInput",
  "export interface OnchainTransactionIntent",
  "export interface OnchainTransactionEvent",
  "export type OnchainIntentStatus",
  "export interface AiModelTokenProduct",
  "export interface AiModelTokenPurchaseIntent",
  "export interface AiModelTokenPurchaseResult",
  "export interface AiCreditBalance",
  "export interface AiCreditUsageEvent",
  "export interface CanonicalSkillCard",
  "export const CANONICAL_SKILL_CARDS",
  "export interface RealAssetAgentSummary",
  "export interface RealAssetEvidence",
  "export interface PolicyDecisionEvidence",
  "export interface OnchainIntentEvidence",
  "export interface TransactionEventEvidence",
  "export interface AiCreditPurchaseEvidence",
  "export interface AiCreditUsageEvidence",
  "export interface SkillCardCapabilityEvidence",
  "export interface RealAssetWorkReportSummary"
]) {
  assert(shared.includes(token), `packages/shared/src/index.ts must define ${token}`);
}

for (const evidenceType of [
  "policy_decision",
  "onchain_intent",
  "transaction_event",
  "ai_credit_purchase",
  "ai_credit_usage",
  "skill_card_capability",
  "future_transaction_placeholder",
  "legacy_settlement_compatibility"
]) {
  assert(shared.includes(`"${evidenceType}"`), `RealAssetEvidenceType must include ${evidenceType}`);
}

assert(/export type AssetSymbol = "G" \| "TON" \| "AI_CREDIT";/.test(shared), "AssetSymbol must be exactly G | TON | AI_CREDIT");

const skillBlock = shared.match(/export const CANONICAL_SKILL_CARDS = \[([\s\S]*?)\] as const satisfies readonly CanonicalSkillCard\[];/)?.[1] ?? "";
const cardCount = (skillBlock.match(/skillCard\(/g) || []).length;
const normalCount = (skillBlock.match(/"normal"/g) || []).length;
const advancedCount = (skillBlock.match(/"advanced"/g) || []).length;
const expertCount = (skillBlock.match(/"expert"/g) || []).length;
assert(cardCount === 31, `CANONICAL_SKILL_CARDS must contain exactly 31 cards; found ${cardCount}`);
assert(normalCount === 12, `CANONICAL_SKILL_CARDS must contain 12 normal cards; found ${normalCount}`);
assert(advancedCount === 12, `CANONICAL_SKILL_CARDS must contain 12 advanced cards; found ${advancedCount}`);
assert(expertCount === 7, `CANONICAL_SKILL_CARDS must contain 7 expert cards; found ${expertCount}`);

const requiredCards = [
  "Project Research",
  "Information Synthesis",
  "Social Content",
  "Structured Writing",
  "Submission Review",
  "Source Verification",
  "Transaction Reader",
  "Community Operation",
  "Task Decomposition",
  "Tool Selection",
  "Progress Tracking",
  "Budget Management",
  "Competitive Intelligence",
  "User & Market Research",
  "Technical Documentation",
  "Long-form Writing",
  "Fact Checking",
  "Token Analysis",
  "Smart Contract Reader",
  "Social Listening",
  "Lead Discovery",
  "Workflow Planning",
  "Task Profit Analysis",
  "Client Delivery Management",
  "Deep Research",
  "Multilingual Adaptation",
  "Risk & Fraud Detection",
  "Onchain Risk Review",
  "Growth Campaign",
  "Failure Recovery",
  "Agent Service Procurement"
];
for (const name of requiredCards) {
  assert(skillBlock.includes(`"${name}"`), `Missing canonical skill card: ${name}`);
}

assert(!/GP\s+is\s+the\s+(real|current|canonical|spendable|on-chain)/i.test(canonicalDocs), "Canonical docs must not define GP as a current spending asset");
assert(/`G` is the real on-chain spending asset/.test(economy), "G_TOKEN_ECONOMY_V1.md must define G as the real on-chain spending asset");
assert(/`GP` is removed from canonical product economics/.test(economy), "G_TOKEN_ECONOMY_V1.md must state GP is removed from canonical economics");

const unsafeClaimTerms = [/guaranteed profit/i, /guaranteed yield/i, /risk-free/i, /fixed returns?/i];
const allowedSafetyPrefixes = [
  /^[-* ]*Do not promise/i,
  /^[-* ]*Do not imply/i,
  /^[-* ]*No copy may promise/i,
  /^[-* ]*Support must not/i,
  /^[-* ]*Real Asset Agent support language must/i
];
for (const line of canonicalDocs.split(/\r?\n/)) {
  const mentionsUnsafeTerm = unsafeClaimTerms.some((pattern) => pattern.test(line));
  const isSafetyRule = allowedSafetyPrefixes.some((pattern) => pattern.test(line));
  assert(!mentionsUnsafeTerm || isSafetyRule, `Canonical docs contain unsafe claim line: ${line}`);
}

for (const token of [
  "autoPurchaseEnabled",
  "perTransactionLimit",
  "dailyLimit",
  "minimumReserve",
  "allowedAssets",
  "allowedContracts",
  "allowedProviders",
  "allowedPurchaseTypes",
  "requireConfirmationAbove",
  "adminGlobalPause",
  "userPaused",
  "riskMode",
  "status"
]) {
  assert(shared.includes(token), `AgentWalletPolicy must include ${token}`);
}

for (const token of [
  "export type RealAssetConsoleSource",
  "export interface RealAssetEvidence",
  "export interface RealAssetEvidenceSection",
  "export interface RealAssetSummary",
  "export interface AdminRealAssetAuditEvent",
  "export interface AdminRealAssetRiskConsoleAgent",
  "export interface RealAssetConsoleResponse",
  "export interface AdminRealAssetRiskConsole"
]) {
  assert(shared.includes(token), `packages/shared/src/index.ts must define ${token}`);
}

assert(shared.includes("requiredConfirmation: boolean"), "PolicyGuardDecision must include requiredConfirmation");
assert(shared.includes("riskMode: AgentWalletRiskMode"), "PolicyGuardDecision must include riskMode");

for (const token of [
  'const ADMIN_PREFIX = "/admin/real-asset";',
  'risk-console',
  'agents/:agentId/wallet-policy',
  'agents/:agentId/intents',
  'agents/:agentId/evidence',
  'audit-events',
  'intents/:intentId/review-simulated'
]) {
  assert(apiWorkerRealAsset.includes(token), `apps/api-worker/src/v1/real-asset-admin.ts must expose ${token}`);
}

for (const token of [
  "requestApi<AdminRealAssetRiskConsoleResponse>",
  "buildRealAssetFallbackResponse",
  "realAssetRiskConsole: AdminRealAssetRiskConsole",
  "fallbackReason",
  "source: \"fallback_mock\""
]) {
  assert(adminApi.includes(token), `apps/admin/src/apiClient.ts must include ${token}`);
}

for (const token of [
  "data source:",
  "fallback mock",
  "realAssetConsole?.realAssetSummary",
  "realAssetConsole?.evidenceSections",
  "Audit Event Timeline"
]) {
  assert(adminUi.includes(token), `apps/admin/src/main.tsx must include ${token}`);
}

for (const status of ["proposed", "allowed", "denied", "queued", "executing", "succeeded", "failed", "cancelled", "paused"]) {
  assert(shared.includes(`"${status}"`), `Onchain intent status must include ${status}`);
}

assert(shared.includes("export interface AiModelTokenPurchaseIntent"), "AI Model Token purchase intent type must exist");
assert(shared.includes("purchaseAsset: \"G\""), "AI Model Token products must be G-denominated in the shared contract");
assert(apiContract.includes("Admin Risk Console V1 is a review surface"), "API contract must document the Admin Risk Console");
assert(opsRunbook.includes("Admin Risk Console V1 can be used"), "Ops runbook must document the Admin Risk Console");
assert(opsRunbook.includes("seed phrase or private-key"), "Ops runbook must forbid seed phrase and private-key handling");
assert(opsRunbook.includes("Policy Guard"), "Ops runbook must mention Policy Guard gating");
assert(apiWorkerRealAsset.includes("liveExecution: false"), "API worker must keep liveExecution false for the admin risk console");
assert(apiWorkerRealAsset.includes("custody: false"), "API worker must keep custody false for the admin risk console");
assert(apiWorkerRealAsset.includes("mainWalletControl: false"), "API worker must keep mainWalletControl false for the admin risk console");

if (failures.length > 0) {
  console.error("verify-real-asset-agent-v1: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("verify-real-asset-agent-v1: PASS");
console.log(`canonical skill cards: ${cardCount} total (${normalCount} normal, ${advancedCount} advanced, ${expertCount} expert)`);
