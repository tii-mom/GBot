#!/usr/bin/env node
import { readdirSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import crypto from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workerMigrationsDir = join(root, "apps", "api-worker", "migrations");
const rootMigrationsDir = join(root, "migrations");
const tempDir = join(root, "apps", "api-worker", ".workflow-runtime-settlement-verify");
let passed = 0;
let failed = 0;
const summary = {};

function step(name, fn) {
  try {
    const result = fn();
    console.log(`[0015-VERIFY] PASS: ${name}`);
    passed++;
    return result;
  } catch (err) {
    console.error(`[0015-VERIFY] FAIL: ${name} - ${err.message}`);
    failed++;
  }
}

function sql(db, statement) {
  const output = execSync(`sqlite3 -json "${db}"`, { input: statement, encoding: "utf8" }).trim();
  return output ? JSON.parse(output) : [];
}

function expectSqlError(db, statement, snippet) {
  try {
    sql(db, statement);
  } catch (err) {
    if (!err.message.includes(snippet)) throw new Error(`Expected ${snippet}, got ${err.message}`);
    return err.message.split("\n")[0];
  }
  throw new Error("Expected statement to fail");
}

function apply(db, migrationsDir, maxPrefix, minExclusive = "0000") {
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql") && f.slice(0, 4) <= maxPrefix && f.slice(0, 4) > minExclusive)
    .sort();
  for (const file of files) execSync(`sqlite3 "${db}" < "${join(migrationsDir, file)}"`);
}

function columns(db, table) { return sql(db, `PRAGMA table_info(${table});`); }
function indexes(db, table) { return sql(db, `PRAGMA index_list(${table});`); }
function fks(db, table) { return sql(db, `PRAGMA foreign_key_list(${table});`); }

rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir, { recursive: true });

step("Migration copies are byte-identical and SHA-256 recorded", () => {
  const rootContent = readFileSync(join(rootMigrationsDir, "0015_workflow_runtime_settlement_gate.sql"));
  const workerContent = readFileSync(join(workerMigrationsDir, "0015_workflow_runtime_settlement_gate.sql"));
  const rootHash = crypto.createHash("sha256").update(rootContent).digest("hex");
  const workerHash = crypto.createHash("sha256").update(workerContent).digest("hex");
  if (!rootContent.equals(workerContent)) throw new Error(`0015 differs: root=${rootHash} worker=${workerHash}`);
  summary.rootSha256 = rootHash;
  summary.workerSha256 = workerHash;
  console.log(`[0015-VERIFY] SHA-256 root=${rootHash} worker=${workerHash}`);
});

step("Root and worker migration lists are synchronized", () => {
  const rootFiles = readdirSync(rootMigrationsDir).filter(f => f.endsWith(".sql")).sort().join("\n");
  const workerFiles = readdirSync(workerMigrationsDir).filter(f => f.endsWith(".sql")).sort().join("\n");
  if (rootFiles !== workerFiles) throw new Error("Migration filename lists differ");
});

const freshDb = join(tempDir, "fresh.sqlite");
step("Fresh database applies 0001 -> 0015 and exposes required schema", () => {
  apply(freshDb, workerMigrationsDir, "0015");
  const runCols = columns(freshDb, "agent_work_runs");
  const mode = runCols.find(c => c.name === "execution_mode");
  if (!mode) throw new Error("agent_work_runs.execution_mode missing");
  if (mode.notnull !== 1 || mode.dflt_value !== "'simulated'") throw new Error(`Bad execution_mode definition: ${JSON.stringify(mode)}`);
  const tableSql = sql(freshDb, "SELECT sql FROM sqlite_master WHERE type='table' AND name='agent_work_runs';")[0].sql;
  if (!tableSql.includes("execution_mode IN ('simulated', 'runtime', 'external')")) throw new Error("execution_mode CHECK missing");
  const relTable = sql(freshDb, "SELECT sql FROM sqlite_master WHERE type='table' AND name='work_step_runtime_executions';");
  if (relTable.length !== 1) throw new Error("work_step_runtime_executions table missing");
  const fk = fks(freshDb, "work_step_runtime_executions");
  for (const target of ["agent_work_runs", "agent_work_steps", "skill_runtime_executions"]) if (!fk.some(row => row.table === target)) throw new Error(`FK to ${target} missing`);
  const idx = indexes(freshDb, "work_step_runtime_executions").map(i => i.name);
  for (const name of ["idx_work_step_runtime_executions_run", "idx_work_step_runtime_executions_step", "idx_work_step_runtime_executions_runtime"]) if (!idx.includes(name)) throw new Error(`Index ${name} missing`);
  if (!indexes(freshDb, "work_step_runtime_executions").some(i => i.unique === 1 && i.origin === "u")) throw new Error("Unique constraints missing");
  const invalidMode = expectSqlError(freshDb, "INSERT INTO agent_work_runs (id, agent_id, user_id, task_id, idempotency_key, execution_mode) VALUES ('bad_run','missing_agent','missing_user','task','idem','invalid');", "CHECK constraint failed");
  summary.invalidExecutionMode = invalidMode;
  const fkCheck = sql(freshDb, "PRAGMA foreign_key_check;");
  if (fkCheck.length) throw new Error(`foreign_key_check failed: ${JSON.stringify(fkCheck)}`);
  summary.freshForeignKeyCheck = fkCheck;
});

const upgradeDb = join(tempDir, "upgrade.sqlite");
step("Upgrade database preserves 0014 data and enforces 0015 constraints", () => {
  apply(upgradeDb, workerMigrationsDir, "0014");
  sql(upgradeDb, "PRAGMA foreign_keys=ON; INSERT INTO users (id, telegram_id, username) VALUES ('u_0015', '15015', 'workflow_upgrade'); INSERT INTO agents (id, user_id, name) VALUES ('a_0015', 'u_0015', 'Workflow Agent'); INSERT INTO agent_work_runs (id, agent_id, user_id, task_id, task_kind, status, idempotency_key) VALUES ('run_0015', 'a_0015', 'u_0015', 'legacy_task', 'basic', 'running', 'idem_0015'); INSERT INTO agent_work_steps (id, run_id, step_order, step_type, title) VALUES ('step_0015', 'run_0015', 1, 'produce', 'Legacy step');");
  apply(upgradeDb, workerMigrationsDir, "0015", "0014");
  const row = sql(upgradeDb, "SELECT r.id, r.execution_mode, s.id AS step_id FROM agent_work_runs r JOIN agent_work_steps s ON s.run_id = r.id WHERE r.id='run_0015';")[0];
  if (!row || row.execution_mode !== "simulated" || row.step_id !== "step_0015") throw new Error(`Legacy data not preserved: ${JSON.stringify(row)}`);
  summary.legacyRow = row;
  sql(upgradeDb, "PRAGMA foreign_keys=ON; INSERT INTO skill_runtime_executions (id, user_id, agent_id, task_type, idempotency_key, request_hash, status, model_name) VALUES ('exec_0015', 'u_0015', 'a_0015', 'workflow', 'exec_idem_0015', 'hash_0015', 'completed', 'test-model'); INSERT INTO work_step_runtime_executions (id, run_id, step_id, runtime_execution_id, purpose) VALUES ('bind_0015', 'run_0015', 'step_0015', 'exec_0015', 'produce');");
  summary.invalidPurpose = expectSqlError(upgradeDb, "PRAGMA foreign_keys=ON; INSERT INTO work_step_runtime_executions (id, run_id, step_id, runtime_execution_id, purpose) VALUES ('bad_purpose', 'run_0015', 'step_0015', 'exec_0015', 'invalid');", "CHECK constraint failed");
  summary.duplicateRuntime = expectSqlError(upgradeDb, "PRAGMA foreign_keys=ON; INSERT INTO work_step_runtime_executions (id, run_id, step_id, runtime_execution_id, purpose) VALUES ('dup_runtime', 'run_0015', 'step_0015', 'exec_0015', 'verify');", "UNIQUE constraint failed");
  sql(upgradeDb, "PRAGMA foreign_keys=ON; INSERT INTO skill_runtime_executions (id, user_id, agent_id, task_type, idempotency_key, request_hash, status, model_name) VALUES ('exec_bad_run', 'u_0015', 'a_0015', 'workflow', 'exec_idem_bad_run', 'hash_bad_run', 'completed', 'test-model'), ('exec_bad_step', 'u_0015', 'a_0015', 'workflow', 'exec_idem_bad_step', 'hash_bad_step', 'completed', 'test-model');");
  summary.badRunFk = expectSqlError(upgradeDb, "PRAGMA foreign_keys=ON; INSERT INTO work_step_runtime_executions (id, run_id, step_id, runtime_execution_id, purpose) VALUES ('bad_run_fk', 'missing_run', 'step_0015', 'exec_bad_run', 'verify');", "FOREIGN KEY constraint failed");
  summary.badStepFk = expectSqlError(upgradeDb, "PRAGMA foreign_keys=ON; INSERT INTO work_step_runtime_executions (id, run_id, step_id, runtime_execution_id, purpose) VALUES ('bad_step_fk', 'run_0015', 'missing_step', 'exec_bad_step', 'verify');", "FOREIGN KEY constraint failed");
  summary.badRuntimeFk = expectSqlError(upgradeDb, "PRAGMA foreign_keys=ON; INSERT INTO work_step_runtime_executions (id, run_id, step_id, runtime_execution_id, purpose) VALUES ('bad_exec_fk', 'run_0015', 'step_0015', 'missing_exec', 'verify');", "FOREIGN KEY constraint failed");
  const fkCheck = sql(upgradeDb, "PRAGMA foreign_key_check;");
  if (fkCheck.length) throw new Error(`foreign_key_check failed: ${JSON.stringify(fkCheck)}`);
  summary.upgradeForeignKeyCheck = fkCheck;
});

step("Settlement audit fields remain minimal", () => {
  const runNames = columns(freshDb, "agent_work_runs").map(c => c.name);
  for (const field of ["reward_eligible", "verification_status", "settled_runtime_execution_id"]) {
    if (runNames.includes(field)) throw new Error(`Unexpected field added: ${field}`);
  }
});

console.log(`[0015-VERIFY] SUMMARY ${JSON.stringify(summary, null, 2)}`);
rmSync(tempDir, { recursive: true, force: true });
console.log(`\n=== Workflow Runtime Settlement Migration: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
