import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const migrationPath = join(root, "apps", "api-worker", "migrations", "0018_telegram_permissioned_ingestion_v1.sql");

console.log("🧪 Starting Telegram D1 Schema Migration Verification...");

let sqlContent;
try {
  sqlContent = readFileSync(migrationPath, "utf8");
  console.log(`✅ Loaded migration: 0018_telegram_permissioned_ingestion_v1.sql`);
} catch (err) {
  console.error(`❌ FAILED to load migration at: ${migrationPath}`);
  process.exit(1);
}

let failed = false;

function assertContains(substring, message) {
  if (!sqlContent.includes(substring)) {
    console.error(`❌ [FAIL] ${message}`);
    failed = true;
  } else {
    console.log(`✅ [PASS] ${message}`);
  }
}

function assertNotContains(substring, message) {
  if (sqlContent.includes(substring)) {
    console.error(`❌ [FAIL] ${message}`);
    failed = true;
  } else {
    console.log(`✅ [PASS] ${message}`);
  }
}

// 1. Assert required tables exist
assertContains("CREATE TABLE telegram_authorized_sources", "telegram_authorized_sources table creation exists");
assertContains("CREATE TABLE telegram_ingestion_events", "telegram_ingestion_events table creation exists");
assertContains("CREATE TABLE telegram_opportunity_signals", "telegram_opportunity_signals table creation exists");
assertContains("CREATE TABLE policy_guard_external_action_events", "policy_guard_external_action_events table creation exists");

// 2. Assert key columns exist
assertContains("telegram_chat_id_hash TEXT", "telegram_chat_id_hash column exists");
assertContains("telegram_chat_title_preview TEXT", "telegram_chat_title_preview column exists");
assertContains("telegram_update_id_hash TEXT", "telegram_update_id_hash column exists");
assertContains("content_preview TEXT", "content_preview column exists");
assertContains("policy_decision TEXT", "policy_decision column exists");
assertContains("budget_snapshot TEXT", "budget_snapshot column exists");

// 3. Assert raw telegram_chat_id TEXT is NOT used
const rawChatIdRegex = /^\s*telegram_chat_id\s+TEXT/m;
if (rawChatIdRegex.test(sqlContent)) {
  console.error("❌ [FAIL] Raw telegram_chat_id TEXT column detected (Should use telegram_chat_id_hash for privacy)");
  failed = true;
} else {
  console.log("✅ [PASS] No raw telegram_chat_id TEXT column detected");
}

// 4. Assert indexes exist
assertContains("CREATE INDEX idx_telegram_sources_owner", "idx_telegram_sources_owner index exists");
assertContains("CREATE INDEX idx_telegram_sources_chat_hash", "idx_telegram_sources_chat_hash index exists");
assertContains("CREATE INDEX idx_telegram_events_update_hash", "idx_telegram_events_update_hash index exists");
assertContains("CREATE INDEX idx_policy_external_decision", "idx_policy_external_decision index exists");

// 5. Assert no table implies direct wallet execution (No automatic transactions)
assertNotContains("wallet_transaction_hash", "No wallet_transaction_hash in event/signal tables");
assertNotContains("auto_execute_transfer", "No auto_execute_transfer in event/signal tables");

if (failed) {
  console.error("\n❌ Telegram D1 Schema Verification FAILED!");
  process.exit(1);
} else {
  console.log("\n🎉 All Telegram D1 schema checks PASSED successfully!");
  process.exit(0);
}
