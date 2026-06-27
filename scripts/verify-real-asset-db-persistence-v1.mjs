import fs from "node:fs";
import path from "node:path";

const failures = [];
function assert(condition, message) {
  if (!condition) failures.push(message);
}
function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

const requiredTables = [
  "agent_wallet_policies",
  "wallet_asset_snapshots",
  "asset_ledger_events",
  "onchain_transaction_intents",
  "onchain_transaction_events",
  "ai_model_token_products",
  "ai_model_token_purchase_intents",
  "ai_model_token_purchase_results",
  "ai_credit_balances",
  "ai_credit_usage_events",
  "work_report_evidence_events",
  "admin_risk_audit_events"
];

const prohibitedTerms = ["private_key", "seed_phrase", "mnemonic", "secret_key", "main_wallet_private_key"];
const destructiveStatements = ["DROP TABLE", "DROP COLUMN", "DELETE FROM", "TRUNCATE"];
const mapperNames = [
  "toAgentWalletPolicyRow",
  "fromAgentWalletPolicyRow",
  "toWalletAssetSnapshotRow",
  "fromWalletAssetSnapshotRow",
  "toAssetLedgerEventRow",
  "fromAssetLedgerEventRow",
  "toOnchainIntentRow",
  "fromOnchainIntentRow",
  "toOnchainTransactionEventRow",
  "fromOnchainTransactionEventRow",
  "toAiModelTokenProductRow",
  "fromAiModelTokenProductRow",
  "toAiModelTokenPurchaseIntentRow",
  "fromAiModelTokenPurchaseIntentRow",
  "toAiModelTokenPurchaseResultRow",
  "fromAiModelTokenPurchaseResultRow",
  "toAiCreditBalanceRow",
  "fromAiCreditBalanceRow",
  "toAiCreditUsageEventRow",
  "fromAiCreditUsageEventRow",
  "toWorkReportEvidenceRow",
  "fromWorkReportEvidenceRow",
  "toAdminRiskAuditEventRow",
  "fromAdminRiskAuditEventRow"
];

const planPath = "docs/REAL_ASSET_DB_PERSISTENCE_PLAN_V1.md";
const mapperPath = "apps/api-worker/src/v1/real-asset-db.ts";
const plan = read(planPath);
const mapper = read(mapperPath);
const pkg = read("package.json");
const docs = [
  plan,
  read("docs/API_CONTRACT.md"),
  read("docs/DATABASE_SCHEMA.md"),
  read("docs/OPS_SUPPORT_RUNBOOK.md"),
  read("docs/GO_LIVE_CHECKLIST.md")
].join("\n").toLowerCase();

assert(fs.existsSync(planPath), "docs/REAL_ASSET_DB_PERSISTENCE_PLAN_V1.md must exist");
for (const table of requiredTables) {
  assert(plan.includes(table), `plan doc must mention ${table}`);
}

const migrationDir = "apps/api-worker/migrations";
const migrationFiles = fs.existsSync(migrationDir)
  ? fs.readdirSync(migrationDir).filter((name) => name.includes("real_asset_agent_persistence_v1"))
  : [];
assert(migrationFiles.length > 0, "migration file with real_asset_agent_persistence_v1 must exist");
const migrationPath = migrationFiles.length > 0 ? path.join(migrationDir, migrationFiles[0]) : "";
const migration = read(migrationPath);
assert(migrationPath.includes("real_asset_agent_persistence_v1") || migration.includes("real_asset_agent_persistence_v1"), "migration must include real_asset_agent_persistence_v1 in filename or body");
for (const table of requiredTables) {
  assert(migration.includes(table), `migration must include ${table}`);
}
assert(migration.includes("CREATE TABLE IF NOT EXISTS"), "migration must use CREATE TABLE IF NOT EXISTS");
assert(migration.includes("CREATE INDEX IF NOT EXISTS"), "migration must use CREATE INDEX IF NOT EXISTS");
for (const term of prohibitedTerms) {
  assert(!migration.toLowerCase().includes(term), `migration must not include prohibited term ${term}`);
}
for (const statement of destructiveStatements) {
  assert(!migration.toUpperCase().includes(statement), `migration must not include destructive statement ${statement}`);
}

assert(docs.includes("production d1 is not mutated") || docs.includes("does not mutate production d1"), "docs must mention no production D1 mutation");
assert(docs.includes("local scaffold") || docs.includes("local/planning"), "docs must mention local scaffold only");
assert(docs.includes("no custody") || docs.includes("custody data"), "docs must mention no custody");
assert(docs.includes("no seed phrase") || docs.includes("seed phrases"), "docs must mention no seed phrase");
assert(docs.includes("no user main wallet control") || docs.includes("no main wallet control"), "docs must mention no main wallet control");
assert(docs.includes("testnet executor remains blocked"), "docs must mention testnet executor remains blocked");

assert(fs.existsSync(mapperPath), "apps/api-worker/src/v1/real-asset-db.ts must exist");
for (const name of mapperNames) {
  assert(mapper.includes(name), `mapper file must include ${name}`);
}
assert(pkg.includes('"verify:real-asset-db-persistence-v1"'), "package.json must include verify:real-asset-db-persistence-v1");

if (failures.length > 0) {
  console.error("verify-real-asset-db-persistence-v1: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("verify-real-asset-db-persistence-v1: PASS");
console.log(`tables covered: ${requiredTables.length}`);
console.log(`migration: ${migrationPath}`);
