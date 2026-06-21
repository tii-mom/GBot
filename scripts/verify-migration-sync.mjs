#!/usr/bin/env node
/**
 * Verify that root migrations/ directory stays in sync with apps/api-worker/migrations/.
 * This prevents schema drift between the two copies.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const workerMigrationsDir = join(root, "apps", "api-worker", "migrations");
const rootMigrationsDir = join(root, "migrations");

let pass = 0;
let fail = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`[SYNC] PASS: ${name}`);
    pass++;
  } catch (err) {
    console.error(`[SYNC] FAIL: ${name} - ${err.message}`);
    fail++;
  }
}

const workerFiles = readdirSync(workerMigrationsDir).filter(f => f.endsWith(".sql")).sort();
const rootFiles = readdirSync(rootMigrationsDir).filter(f => f.endsWith(".sql")).sort();

check("Same number of migration files", () => {
  if (workerFiles.length !== rootFiles.length) {
    throw new Error(`Worker has ${workerFiles.length} files, root has ${rootFiles.length} files`);
  }
});

check("Same filenames", () => {
  const workerSet = workerFiles.join(",");
  const rootSet = rootFiles.join(",");
  if (workerSet !== rootSet) {
    const missing = workerFiles.filter(f => !rootFiles.includes(f));
    const extra = rootFiles.filter(f => !workerFiles.includes(f));
    throw new Error(`Mismatch. Missing in root: [${missing}]. Extra in root: [${extra}]`);
  }
});

for (const file of workerFiles) {
  check(`File content identical: ${file}`, () => {
    const workerContent = readFileSync(join(workerMigrationsDir, file), "utf8");
    const rootContent = readFileSync(join(rootMigrationsDir, file), "utf8");
    if (workerContent !== rootContent) {
      throw new Error(`Content differs for ${file}`);
    }
  });
}

console.log(`\n=== Migration Sync: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
