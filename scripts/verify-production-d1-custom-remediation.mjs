#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = new URL('..', import.meta.url).pathname;
const migrationsDir = join(root, 'migrations');
const files = readdirSync(migrationsDir).filter((file) => /^\d{4}.*\.sql$/.test(file)).sort();
const schemaSqlPath = join(root, 'ops', 'remediation', 'production-d1-remediation-schema-v1.sql');
const historySqlPath = join(root, 'ops', 'remediation', 'production-d1-remediation-history-v1.sql');

function execSqlite(db, sqlText) {
  return execFileSync('sqlite3', ['-batch', '-bail', db], {
    input: sqlText,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim();
}

function scalar(db, sqlText) {
  return execSqlite(db, sqlText);
}

function applyRange(db, from, to) {
  for (const file of files.filter((entry) => entry.slice(0, 4) >= from && entry.slice(0, 4) <= to)) {
    execSqlite(db, readFileSync(join(migrationsDir, file), 'utf8'));
  }
}

function seedHistory(db, maxId) {
  execSqlite(db, `
    CREATE TABLE d1_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  for (const file of files.filter((entry) => Number(entry.slice(0, 4)) <= maxId)) {
    const id = Number(file.slice(0, 4));
    execSqlite(db, `
      INSERT INTO d1_migrations (id, name, applied_at)
      VALUES (${id}, '${file}', '2026-06-28 00:00:00');
    `);
  }
  execSqlite(db, 'DELETE FROM d1_migrations WHERE id > 5;');
}

function runPreflight(db, expectedMax, expectFailure = false) {
  try {
    execFileSync(process.execPath, [
      join(root, 'scripts', 'preflight-production-migrations-0006-0016.mjs'),
      '--db',
      db,
      '--expected-max',
      String(expectedMax),
      '--environment',
      'synthetic-custom-remediation'
    ], { stdio: 'pipe' });
    if (expectFailure) throw new Error(`expected preflight max=${expectedMax} to fail`);
  } catch (error) {
    if (expectFailure && !String(error.message).includes('expected preflight')) return;
    throw error;
  }
}

execFileSync(process.execPath, [join(root, 'scripts', 'build-production-d1-remediation.mjs')], { stdio: 'inherit' });

const dir = mkdtempSync(join(tmpdir(), 'growthbot-production-remediation-'));
const db = join(dir, 'production-remediation.sqlite');

try {
  applyRange(db, '0001', '0011');
  seedHistory(db, 11);
  execSqlite(db, `
    INSERT INTO users(id, telegram_id, username) VALUES('u_remediate', 'synthetic_remediation', 'synthetic_remediation');
    INSERT INTO agents(id, user_id, name) VALUES('a_remediate', 'u_remediate', 'Synthetic Remediation Agent');
    INSERT INTO agent_skill_operations(id, user_id, agent_id, operation_type, idempotency_key, result_json, status)
    VALUES('op_remediate', 'u_remediate', 'a_remediate', 'learn', 'idem_remediate', '{}', 'completed');
  `);

  runPreflight(db, 5, true);

  execSqlite(db, readFileSync(schemaSqlPath, 'utf8'));

  assert.equal(scalar(db, "SELECT COUNT(*) FROM agent_skill_operations WHERE id='op_remediate' AND updated_at IS NOT NULL;"), '1');
  assert.equal(scalar(db, "SELECT COUNT(*) FROM pragma_table_info('box_orders') WHERE name='request_hash';"), '1');
  assert.equal(scalar(db, "SELECT COUNT(*) FROM skill_acquisition_rules WHERE is_canonical=1;"), '31');
  assert.equal(scalar(db, "SELECT COUNT(*) FROM skill_runtime_versions WHERE runtime_status='active';"), '31');
  assert.equal(scalar(db, "SELECT COUNT(*) FROM pragma_table_info('agent_work_runs') WHERE name='execution_mode';"), '1');
  assert.equal(scalar(db, "SELECT COUNT(*) FROM pragma_table_info('agent_work_runs') WHERE name='research_brief_result_json';"), '1');
  assert.equal(scalar(db, "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='admin_risk_audit_events';"), '1');
  assert.equal(scalar(db, "SELECT COUNT(*) FROM tasks WHERE id='task_research_brief_v1';"), '1');

  runPreflight(db, 5, true);

  execSqlite(db, readFileSync(historySqlPath, 'utf8'));

  runPreflight(db, 17, false);

  assert.equal(scalar(db, 'SELECT COUNT(*) FROM d1_migrations;'), '17');
  assert.equal(scalar(db, 'SELECT COALESCE(MAX(id), 0) FROM d1_migrations;'), '17');
  assert.equal(scalar(db, "SELECT COUNT(*) FROM d1_migrations WHERE name='0017_real_asset_agent_persistence_v1.sql';"), '1');

  console.log('PASS production custom remediation package: divergent clone -> schema patch -> history backfill -> preflight 17.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
