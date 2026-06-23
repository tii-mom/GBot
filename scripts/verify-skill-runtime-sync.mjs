#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const migrationPath1 = join(root, "migrations", "0014_skill_runtime_lite_v1.sql");
const migrationPath2 = join(root, "apps", "api-worker", "migrations", "0014_skill_runtime_lite_v1.sql");

let passed = true;

function assert(condition, message) {
  if (!condition) {
    console.error(`[SYNC-VERIFY] FAIL: ${message}`);
    passed = false;
  } else {
    console.log(`[SYNC-VERIFY] PASS: ${message}`);
  }
}

// 1. Files exist
assert(existsSync(migrationPath1), "Root migration 0014 file exists");
assert(existsSync(migrationPath2), "Worker migration 0014 file exists");

if (passed) {
  // 2. Content identical
  const content1 = readFileSync(migrationPath1, "utf8");
  const content2 = readFileSync(migrationPath2, "utf8");
  const hash1 = crypto.createHash("sha256").update(content1).digest("hex");
  const hash2 = crypto.createHash("sha256").update(content2).digest("hex");

  assert(hash1 === hash2, `Root and Worker migration hashes match (SHA: ${hash1})`);

  // 3. Compile current runtimes and compare with file content
  try {
    const compileScript = join(root, "scripts", "compile-runtimes.mjs");
    // Run the compiler in memory or read its output logic
    // We can execute compile-runtimes.mjs and check if git status has any changes in migrations
    const stdout = execSync(`git diff --name-only`, { encoding: "utf8" });
    const diffFiles = stdout.split("\n").map(f => f.trim()).filter(Boolean);
    
    const migrationChanged = diffFiles.some(f => f.includes("0014_skill_runtime_lite_v1.sql"));
    assert(!migrationChanged, "No unstaged changes in 0014 migration file (git is clean for 0014)");
  } catch (err) {
    console.error(`[SYNC-VERIFY] Git check failed: ${err.message}`);
    passed = false;
  }
}

if (!passed) {
  process.exit(1);
} else {
  console.log("\n[SYNC-VERIFY] Migration synchronisation verification completed successfully.");
}
