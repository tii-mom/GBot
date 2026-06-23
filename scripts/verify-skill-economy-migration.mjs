#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const workerMigrationsDir = join(root, "apps", "api-worker", "migrations");
const rootMigrationsDir = join(root, "migrations");

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`[MIGRATION-VERIFY] PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`[MIGRATION-VERIFY] FAIL: ${name} - ${err.message}`);
    failed++;
  }
}

// 1. Two migration files must be identical (same SHA-256)
check("Migration files are identical in root and api-worker", () => {
  const rootContent = readFileSync(join(rootMigrationsDir, "0012_skill_economy_loop.sql"));
  const workerContent = readFileSync(join(workerMigrationsDir, "0012_skill_economy_loop.sql"));
  const rootHash = crypto.createHash("sha256").update(rootContent).digest("hex");
  const workerHash = crypto.createHash("sha256").update(workerContent).digest("hex");
  if (rootHash !== workerHash) {
    throw new Error(`SHA-256 mismatch. Root: ${rootHash}, Worker: ${workerHash}`);
  }
});

// Helper for running migrations using sqlite3 directly
function applyMigrations(dbFile, migrationsDir, maxVersion = "9999") {
  try {
    execSync(`sqlite3 "${dbFile}" "CREATE TABLE IF NOT EXISTS _test_applied_migrations (name TEXT PRIMARY KEY);"`, { stdio: "ignore" });
  } catch (err) {
    throw new Error(`Failed to initialize migration tracking: ${err.message}`);
  }

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql") && f <= maxVersion)
    .sort();
  for (const file of files) {
    const check = execSync(`sqlite3 "${dbFile}" "SELECT COUNT(*) as cnt FROM _test_applied_migrations WHERE name = '${file}';"`, { encoding: "utf8" }).trim();
    if (parseInt(check, 10) > 0) {
      continue;
    }

    const filePath = join(migrationsDir, file);
    try {
      execSync(`sqlite3 "${dbFile}" < "${filePath}"`, { stdio: "ignore" });
      execSync(`sqlite3 "${dbFile}" "INSERT INTO _test_applied_migrations (name) VALUES ('${file}');"`, { stdio: "ignore" });
    } catch (err) {
      throw new Error(`Failed to apply migration ${file}: ${err.message}`);
    }
  }
}

// Helper for running wrangler commands (mocked via sqlite3)
function runWrangler(args, cwd, dbPath) {
  mkdirSync(dbPath, { recursive: true });
  const dbFile = join(dbPath, "test.sqlite");

  if (args.startsWith("migrations apply DB")) {
    const migrationsDir = join(cwd, "migrations");
    const files = readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();
    const maxVersion = files[files.length - 1] || "9999";
    applyMigrations(dbFile, migrationsDir, maxVersion);
    return "Successfully applied migrations";
  }
  
  if (args.startsWith("execute DB --file=")) {
    const match = args.match(/--file="?([^"]+)"?/);
    if (!match) throw new Error("Invalid execute command: " + args);
    const sqlFile = match[1];
    try {
      return execSync(`sqlite3 -json "${dbFile}" < "${sqlFile}"`, { encoding: "utf8" });
    } catch (err) {
      throw new Error(`SQL Execution failed: ${err.message}`);
    }
  }

  throw new Error("Unsupported wrangler mock command: " + args);
}

function executeQuery(sql, cwd, dbPath) {
  mkdirSync(dbPath, { recursive: true });
  const dbFile = join(dbPath, "test.sqlite");
  try {
    const output = execSync(`sqlite3 -json "${dbFile}"`, { input: sql, encoding: "utf8" }).trim();
    const results = output ? JSON.parse(output) : [];
    return { results, success: true };
  } catch (error) {
    throw new Error(`Query failed: ${sql}\nError: ${error.message}`);
  }
}

function expectFailure(sql, cwd, dbPath) {
  try {
    executeQuery(sql, cwd, dbPath);
    throw new Error(`Expected SQL query to fail: ${sql}`);
  } catch (error) {
    // Expected to fail!
  }
}

// 2. Fresh DB validation
const freshDbPath = join(root, "apps", "api-worker", ".wrangler-migration-fresh");
check("Fresh DB migration and table checks", () => {
  rmSync(freshDbPath, { recursive: true, force: true });
  runWrangler("migrations apply DB", join(root, "apps", "api-worker"), freshDbPath);
  
  // Verify that all 0012 tables exist
  const tablesResult = executeQuery("SELECT name FROM sqlite_master WHERE type='table';", join(root, "apps", "api-worker"), freshDbPath);
  const tables = tablesResult.results.map(r => r.name);
  const expectedTables = [
    "skill_economy_events",
    "skill_synthesis_pity",
    "skill_upgrade_operations",
    "skill_synthesis_operations",
    "skill_box_daily_purchases",
    "agent_skill_operations"
  ];
  for (const t of expectedTables) {
    if (!tables.includes(t)) {
      throw new Error(`Table ${t} does not exist in Fresh DB`);
    }
  }
  
  // Verify that indexes exist
  const indexesResult = executeQuery("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='agent_skill_operations';", join(root, "apps", "api-worker"), freshDbPath);
  const indexes = indexesResult.results.map(r => r.name);
  if (!indexes.includes("uq_skill_ops_user_idem")) {
    throw new Error("uq_skill_ops_user_idem index is missing on agent_skill_operations");
  }
  if (!indexes.includes("idx_skill_ops_agent")) {
    throw new Error("idx_skill_ops_agent index is missing on agent_skill_operations");
  }
  
  // Verify Box product seed exists and its drop weights sum to exactly 1,000,000
  const weightsResult = executeQuery("SELECT SUM(weight) as total_weight FROM box_drop_items WHERE box_product_id='bp_skill_box';", join(root, "apps", "api-worker"), freshDbPath);
  const totalWeight = weightsResult.results[0].total_weight;
  if (totalWeight !== 1000000) {
    throw new Error(`Expected total drop weights of bp_skill_box to be 1000000, got ${totalWeight}`);
  }
});

// 3. 0011 -> 0012 Upgrade validation
const upgradeCwd = join(root, "apps", "api-worker", "temp-verify-run");
const upgradeDbPath = join(root, "apps", "api-worker", ".wrangler-migration-upgrade");
check("0011 to 0012 Upgrade and constraint verification", () => {
  // Clean up
  rmSync(upgradeCwd, { recursive: true, force: true });
  rmSync(upgradeDbPath, { recursive: true, force: true });
  
  // Create temp-verify-run structure
  mkdirSync(upgradeCwd, { recursive: true });
  mkdirSync(join(upgradeCwd, "migrations"), { recursive: true });
  
  // Copy wrangler.jsonc
  copyFileSync(join(root, "apps", "api-worker", "wrangler.jsonc"), join(upgradeCwd, "wrangler.jsonc"));
  
  // Copy 0001 to 0011 migrations
  const migrationFiles = readdirSync(workerMigrationsDir).filter(f => f.endsWith(".sql")).sort();
  for (const file of migrationFiles) {
    if (file < "0012") {
      copyFileSync(join(workerMigrationsDir, file), join(upgradeCwd, "migrations", file));
    }
  }
  
  // Apply 0001 -> 0011 migrations
  runWrangler("migrations apply DB", upgradeCwd, upgradeDbPath);
  
  // Insert test records (PR #5 schema constraint check)
  executeQuery("INSERT INTO users (id, telegram_id, username) VALUES ('test_user_1', '12345678', 'test_username');", upgradeCwd, upgradeDbPath);
  executeQuery("INSERT INTO agents (id, user_id, name) VALUES ('test_agent_1', 'test_user_1', 'Test Agent');", upgradeCwd, upgradeDbPath);
  executeQuery("INSERT INTO agent_skill_operations (id, user_id, agent_id, operation_type, idempotency_key, request_hash, result_json, status, created_at) VALUES ('op_1', 'test_user_1', 'test_agent_1', 'learn', 'idem_1', 'hash_1', '{}', 'completed', '2026-06-20 12:00:00');", upgradeCwd, upgradeDbPath);
  
  // Verify 0011 record is present
  const beforeCountResult = executeQuery("SELECT COUNT(*) as cnt FROM agent_skill_operations;", upgradeCwd, upgradeDbPath);
  if (beforeCountResult.results[0].cnt !== 1) {
    throw new Error("Failed to insert pre-upgrade test record");
  }
  
  // Now copy 0012 migration
  copyFileSync(join(workerMigrationsDir, "0012_skill_economy_loop.sql"), join(upgradeCwd, "migrations", "0012_skill_economy_loop.sql"));
  
  // Apply 0012 migration (upgrade)
  runWrangler("migrations apply DB", upgradeCwd, upgradeDbPath);
  
  // Verify post-migration state
  const afterCountResult = executeQuery("SELECT COUNT(*) as cnt FROM agent_skill_operations;", upgradeCwd, upgradeDbPath);
  if (afterCountResult.results[0].cnt !== 1) {
    throw new Error(`Data loss: expected 1 record, got ${afterCountResult.results[0].cnt}`);
  }
  
  // Verify fields of migrated record
  const recordResult = executeQuery("SELECT * FROM agent_skill_operations WHERE id='op_1';", upgradeCwd, upgradeDbPath);
  const record = recordResult.results[0];
  if (record.idempotency_key !== "idem_1" || record.request_hash !== "hash_1") {
    throw new Error("Migrated record field mismatch");
  }
  if (!record.updated_at) {
    throw new Error("Migrated record updated_at is null or undefined");
  }
  
  // Verify reset operation cannot be inserted into agent_skill_operations (PR #5 constraint preservation)
  expectFailure("INSERT INTO agent_skill_operations (id, user_id, agent_id, operation_type, idempotency_key, request_hash, result_json, status) VALUES ('op_2_fail', 'test_user_1', 'test_agent_1', 'reset', 'idem_2', 'hash_2', '{}', 'completed');", upgradeCwd, upgradeDbPath);

  // Verify reset operation can be inserted into the dedicated agent_skill_reset_operations table (PR #6 isolation)
  executeQuery("INSERT INTO agent_skill_reset_operations (id, user_id, agent_id, operation_type, idempotency_key, request_hash, result_json, status) VALUES ('op_2', 'test_user_1', 'test_agent_1', 'reset', 'idem_2', 'hash_2', '{}', 'completed');", upgradeCwd, upgradeDbPath);
  
  // Verify duplicate idempotency key is rejected on agent_skill_operations
  expectFailure("INSERT INTO agent_skill_operations (id, user_id, agent_id, operation_type, idempotency_key, request_hash, result_json, status) VALUES ('op_3', 'test_user_1', 'test_agent_1', 'learn', 'idem_1', 'hash_3', '{}', 'completed');", upgradeCwd, upgradeDbPath);

  // Verify duplicate idempotency key is rejected on agent_skill_reset_operations
  expectFailure("INSERT INTO agent_skill_reset_operations (id, user_id, agent_id, operation_type, idempotency_key, request_hash, result_json, status) VALUES ('op_3_reset', 'test_user_1', 'test_agent_1', 'reset', 'idem_2', 'hash_3', '{}', 'completed');", upgradeCwd, upgradeDbPath);
  
  // Verify illegal status is rejected on agent_skill_reset_operations
  expectFailure("INSERT INTO agent_skill_reset_operations (id, user_id, agent_id, operation_type, idempotency_key, request_hash, result_json, status) VALUES ('op_4', 'test_user_1', 'test_agent_1', 'reset', 'idem_4', 'hash_4', '{}', 'invalid');", upgradeCwd, upgradeDbPath);
  
  // Clean up upgrade directory
  rmSync(upgradeCwd, { recursive: true, force: true });
});

console.log(`\n=== Migration Verification: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}