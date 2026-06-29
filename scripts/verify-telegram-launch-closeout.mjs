/**
 * verify-telegram-launch-closeout.mjs
 * V2.2-H Verification Script: Launch Closeout & Staging Readiness Checks
 */

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

console.log("🧪 Starting Telegram Launch Closeout Verification...\n");

// ─── 1. Check Doc Existence ───
const docPath = path.resolve("docs/PET_AGENT_V22H_LAUNCH_CLOSEOUT_STAGING_READINESS.md");
const docExists = fs.existsSync(docPath);
assert(docExists, "Launch closeout documentation exists");

if (docExists) {
  const content = fs.readFileSync(docPath, "utf-8");

  // ─── 2. Required env vars ───
  assert(content.includes("TELEGRAM_WEBHOOK_SECRET"), "TELEGRAM_WEBHOOK_SECRET documented");
  assert(content.includes("TELEGRAM_INGESTION_ENABLED"), "TELEGRAM_INGESTION_ENABLED documented");
  assert(content.includes("TELEGRAM_IDENTIFIER_HASH_SALT"), "TELEGRAM_IDENTIFIER_HASH_SALT documented");
  assert(content.includes("TELEGRAM_INGESTION_ENABLED=0"), "TELEGRAM_INGESTION_ENABLED=0 safe default documented");

  // ─── 3. D1 migration checklist ───
  assert(content.includes("D1 数据库迁移检查") || content.includes("D1 Migration Checklist"), "D1 migration checklist documented");

  // ─── 4. Webhook smoke checklist ───
  assert(content.includes("Webhook 接口烟雾测试") || content.includes("Webhook Smoke Checklist"), "Webhook smoke checklist documented");

  // ─── 5. Admin smoke checklist ───
  assert(content.includes("管理后台烟雾测试") || content.includes("Admin Smoke Checklist"), "Admin smoke checklist documented");

  // ─── 6. Mini App smoke checklist ───
  assert(content.includes("Mini App 游乐园烟雾测试") || content.includes("Mini App Smoke Checklist"), "Mini App smoke checklist documented");

  // ─── 7. Rollback / Emergency ───
  assert(content.includes("应急与回退方案") || content.includes("Rollback / Emergency"), "Rollback / emergency procedures documented");

  // ─── 8. Go / No-Go Matrix ───
  assert(content.includes("Go / No-Go 验收决策矩阵") || content.includes("Go / No-Go Matrix"), "Go/No-Go matrix documented");

  // ─── 9. Non-goals ───
  assert(content.includes("非目标") || content.includes("Non-goals"), "Non-goals section documented");
  assert(!content.includes("WorkRun proposal created") && !content.includes("Proposal creation"), "Non-goals correctly states no WorkRun Proposal creation");

  // ─── 10. No live/production status claims ───
  assert(!content.includes("production is live") && !content.includes("public launch complete"), "No premature claims that production is live / public launch complete");

  // ─── 11. Cross-reference V2.2-G doc ───
  assert(content.includes("PET_AGENT_V22G_TELEGRAM_PRODUCTION_READINESS.md"), "References V2.2-G production readiness doc");
}

// ─── 12. Check Staging Execution Report ───
const reportPath = path.resolve("docs/PET_AGENT_STAGING_GO_NO_GO_EXECUTION_REPORT.md");
const reportExists = fs.existsSync(reportPath);
assert(reportExists, "Staging Go/No-Go Execution Report exists");

if (reportExists) {
  const content = fs.readFileSync(reportPath, "utf-8");
  assert(content.includes("BLOCKED") || content.includes("GO"), "Report status is correctly marked as BLOCKED or GO");
  assert(content.includes("NO-GO"), "Report status for public launch is correctly marked as NO-GO");
  assert(!content.includes("production is live") && !content.includes("staging is live") && !content.includes("public launch complete"), "Report has no premature staging/production live claims");
}

// ─── 13. Check Staging UAT Evidence Report ───
const uatPath = path.resolve("docs/PET_AGENT_V22_STAGING_UAT_EVIDENCE_REPORT.md");
const uatExists = fs.existsSync(uatPath);
assert(uatExists, "Staging UAT Evidence Report exists");

if (uatExists) {
  const content = fs.readFileSync(uatPath, "utf-8");
  assert(content.includes("Controlled staging UAT: BLOCKED"), "UAT report status is correctly marked as Controlled staging UAT: BLOCKED");
  assert(content.includes("Public launch: NO-GO"), "UAT report status for public launch is correctly marked as Public launch: NO-GO");
  assert(!content.includes("production is live") && !content.includes("staging is live") && !content.includes("public launch complete"), "UAT report has no premature staging/production live claims");
  assert(uatExists && content.includes("REDACTED_API_TOKEN_ROTATED_ON_CF"), "UAT report records Cloudflare API Token rotation");
}



// ─── Summary ───
console.log(`\n${"-".repeat(50)}`);
if (failed > 0) {
  console.error(`❌ ${failed} check(s) FAILED, ${passed} passed`);
  process.exit(1);
} else {
  console.log(`🎉 All ${passed} Telegram launch closeout checks PASSED successfully!`);
}
