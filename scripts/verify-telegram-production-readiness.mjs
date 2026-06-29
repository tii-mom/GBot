/**
 * verify-telegram-production-readiness.mjs
 * V2.2-G Verification Script: Telegram Ingestion Production Readiness & Admin Console
 */

import { isTelegramIngestionEnabled } from "../apps/api-worker/src/v1/telegram.ts";
import fs from "fs";
import path from "path";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`✅ [PASS] ${label}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${label}`);
    failed++;
  }
}

console.log("🧪 Starting Telegram Ingestion Production Readiness Verification...\n");

// ─── 1. Ingestion Kill Switch Helper ───
console.log("1. Testing isTelegramIngestionEnabled helper...");
assert(isTelegramIngestionEnabled({ TELEGRAM_INGESTION_ENABLED: "1" }) === true, "Enabled via '1'");
assert(isTelegramIngestionEnabled({ TELEGRAM_INGESTION_ENABLED: "true" }) === true, "Enabled via 'true'");
assert(isTelegramIngestionEnabled({ TELEGRAM_INGESTION_ENABLED: "0" }) === false, "Disabled via '0'");
assert(isTelegramIngestionEnabled({ TELEGRAM_INGESTION_ENABLED: "false" }) === false, "Disabled via 'false'");
assert(isTelegramIngestionEnabled({}) === false, "Disabled by default when undefined");

// ─── 2. Code audits for outbound actions ───
console.log("\n2. Auditing changed code for outbound Telegram replies / WorkRuns / Wallet intents...");
const apiWorkerTelegramPath = path.resolve("apps/api-worker/src/v1/telegram.ts");
const adminPath = path.resolve("apps/api-worker/src/v1/admin.ts");
const codeContent = fs.readFileSync(apiWorkerTelegramPath, "utf-8") + fs.readFileSync(adminPath, "utf-8");

assert(!codeContent.includes("sendMessage") && !codeContent.includes("sendPhoto"), "No outbound Telegram bot replies / messages sent");
assert(!codeContent.includes("createWorkRun") && !codeContent.includes("executeWorkRun"), "No WorkRun creation or execution logic in changed routes");
assert(!codeContent.includes("createWalletIntent") && !codeContent.includes("executeTransfer"), "No wallet transaction / intent logic in changed routes");

// ─── 3. Documentation checks ───
console.log("\n3. Auditing documentation for kill switch instructions...");
const docPath = path.resolve("docs/PET_AGENT_V22G_TELEGRAM_PRODUCTION_READINESS.md");
const docExists = fs.existsSync(docPath);
assert(docExists, "Production readiness documentation file exists");

if (docExists) {
  const docContent = fs.readFileSync(docPath, "utf-8");
  assert(docContent.includes("TELEGRAM_INGESTION_ENABLED"), "TELEGRAM_INGESTION_ENABLED variable is documented");
  assert(docContent.includes("熔断") || docContent.includes("kill switch") || docContent.includes("Kill Switch"), "Kill switch operational runbook documented");
  assert(docContent.includes("回滚") || docContent.includes("rollback") || docContent.includes("Rollback"), "Rollback / emergency operations documented");
}

// ─── Summary ───
console.log(`\n${"=".repeat(50)}`);
if (failed > 0) {
  console.error(`❌ ${failed} check(s) FAILED, ${passed} passed`);
  process.exit(1);
} else {
  console.log(`🎉 All ${passed} Telegram production readiness checks PASSED successfully!`);
}
