#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const migrations = join(root, 'migrations');
const files = readdirSync(migrations).filter((f) => /^\d{4}.*\.sql$/.test(f)).sort();
let passed = 0;

function sqlite(db, sql, { expectFailure = false } = {}) {
  try {
    const output = execFileSync('sqlite3', ['-batch', '-bail', db], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (expectFailure) throw new Error('expected sqlite statement to fail');
    return output.trim();
  } catch (error) {
    if (expectFailure && !String(error.message).includes('expected sqlite')) return String(error.stderr || error.message);
    throw error;
  }
}

function apply(db, from, to, { expectFailure = false } = {}) {
  const selected = files.filter((f) => f.slice(0, 4) >= from && f.slice(0, 4) <= to);
  for (const file of selected) {
    const sql = readFileSync(join(migrations, file), 'utf8');
    const isLast = file.slice(0, 4) === to;
    if (expectFailure && isLast) return sqlite(db, sql, { expectFailure: true });
    sqlite(db, sql);
  }
  if (expectFailure) throw new Error(`migration ${to} unexpectedly succeeded`);
}

function preflight(db, expectedMax, { expectFailure = false } = {}) {
  try {
    execFileSync(process.execPath, [join(root, 'scripts', 'preflight-production-migrations-0006-0016.mjs'), '--db', db, '--expected-max', String(expectedMax), '--environment', 'failure-injection'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (expectFailure) throw new Error('expected preflight to fail');
  } catch (error) {
    if (expectFailure && !String(error.message).includes('expected preflight')) return;
    throw error;
  }
}

function setHistory(db, max) {
  sqlite(db, 'CREATE TABLE IF NOT EXISTS _test_applied_migrations(name TEXT PRIMARY KEY); DELETE FROM _test_applied_migrations;');
  for (let i = 1; i <= max; i += 1) sqlite(db, `INSERT INTO _test_applied_migrations(name) VALUES('${String(i).padStart(4, '0')}_fixture.sql');`);
}

function test(name, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'growthbot-d1-remediation-'));
  const db = join(dir, 'test.sqlite');
  try {
    fn(db);
    console.log(`PASS ${name}`);
    passed += 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function seedOpening(db, { inventory = true, owner = 'u1', user = true, openedAt = '2026-06-24T00:00:00Z' } = {}) {
  if (user) sqlite(db, "INSERT INTO users(id,telegram_id) VALUES('u1','synthetic-1');");
  if (inventory) sqlite(db, `PRAGMA foreign_keys=OFF; INSERT INTO inventory_items(id,owner_user_id,item_type,name,status) VALUES('box1','${owner}','box','Synthetic Box','available'); PRAGMA foreign_keys=ON;`);
  sqlite(db, `PRAGMA foreign_keys=OFF; DROP TRIGGER IF EXISTS trg_box_openings_validation; INSERT INTO box_openings(inventory_item_id,user_id,opened_at) VALUES('box1','${owner}',${openedAt === null ? 'NULL' : `'${openedAt}'`}); PRAGMA foreign_keys=ON;`);
}

test('0010 migrates valid ownership without unknown_migrated', (db) => {
  apply(db, '0001', '0009');
  seedOpening(db);
  apply(db, '0010', '0010');
  assert.equal(sqlite(db, "SELECT user_id FROM box_openings WHERE inventory_item_id='box1';"), 'u1');
  assert.equal(sqlite(db, "SELECT COUNT(*) FROM box_openings WHERE user_id='unknown_migrated';"), '0');
});

for (const scenario of [
  ['missing inventory', { inventory: false }],
  ['missing owner', { owner: '' }],
  ['missing user', { owner: 'ghost', user: false }],
]) {
  test(`0010 fails closed: ${scenario[0]}`, (db) => {
    apply(db, '0001', '0009');
    seedOpening(db, scenario[1]);
    const before = sqlite(db, 'SELECT COUNT(*) FROM box_openings;');
    apply(db, '0010', '0010', { expectFailure: true });
    assert.equal(sqlite(db, "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='box_openings';"), '1');
    assert.equal(sqlite(db, 'SELECT COUNT(*) FROM box_openings;'), before);
  });
}

test('0010 supports multiple valid openings and preserves data on rerun', (db) => {
  apply(db, '0001', '0009');
  sqlite(db, "INSERT INTO users(id,telegram_id) VALUES('u1','synthetic-1'),('u2','synthetic-2');");
  sqlite(db, "INSERT INTO inventory_items(id,owner_user_id,item_type,name,status) VALUES('box1','u1','box','B1','available'),('box2','u2','box','B2','available');");
  sqlite(db, "INSERT INTO box_openings(inventory_item_id,user_id,opened_at) VALUES('box1','u1','2026-06-24T00:00:00Z'),('box2','u2','2026-06-24T00:00:01Z');");
  apply(db, '0010', '0010');
  assert.equal(sqlite(db, 'SELECT COUNT(*) FROM box_openings;'), '2');
  apply(db, '0010', '0010');
  assert.equal(sqlite(db, 'SELECT COUNT(*) FROM box_openings;'), '2');
});

test('0012 preserves operation data and creates both indexes', (db) => {
  apply(db, '0001', '0011');
  sqlite(db, "INSERT INTO users(id,telegram_id) VALUES('u1','synthetic-1'); INSERT INTO agents(id,user_id,name) VALUES('a1','u1','A1'); INSERT INTO agent_skill_operations(id,user_id,agent_id,operation_type,idempotency_key,result_json,status) VALUES('op1','u1','a1','learn','idem1','{}','completed');");
  apply(db, '0012', '0012');
  assert.equal(sqlite(db, "SELECT COUNT(*) FROM agent_skill_operations WHERE id='op1' AND updated_at IS NOT NULL;"), '1');
  assert.equal(sqlite(db, "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name IN ('uq_skill_ops_user_idem','idx_skill_ops_agent');"), '2');
});

test('0012 stops when old and temporary tables coexist', (db) => {
  apply(db, '0001', '0011');
  sqlite(db, 'CREATE TABLE agent_skill_operations_new(id TEXT);');
  apply(db, '0012', '0012', { expectFailure: true });
  assert.equal(sqlite(db, "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('agent_skill_operations','agent_skill_operations_new');"), '2');
});

test('0012 stops when source table is missing', (db) => {
  apply(db, '0001', '0011');
  sqlite(db, 'DROP TABLE agent_skill_operations;');
  apply(db, '0012', '0012', { expectFailure: true });
});

test('0012 stops on malformed operation row', (db) => {
  apply(db, '0001', '0011');
  sqlite(db, "PRAGMA ignore_check_constraints=ON; INSERT INTO agent_skill_operations(id,user_id,agent_id,operation_type,idempotency_key,result_json,status) VALUES('bad','','','invalid','','{}','broken'); PRAGMA ignore_check_constraints=OFF;");
  apply(db, '0012', '0012', { expectFailure: true });
  assert.equal(sqlite(db, "SELECT COUNT(*) FROM agent_skill_operations WHERE id='bad';"), '1');
});

test('0010 duplicate opening business key fails before source drop', (db) => {
  apply(db, '0001', '0009');
  sqlite(db, "DROP TRIGGER IF EXISTS trg_box_openings_validation; DROP TABLE box_openings; CREATE TABLE box_openings(inventory_item_id TEXT,user_id TEXT,opened_at TEXT); INSERT INTO users(id,telegram_id) VALUES('u1','synthetic-1'); INSERT INTO inventory_items(id,owner_user_id,item_type,name,status) VALUES('box1','u1','box','B1','available'); INSERT INTO box_openings VALUES('box1','u1','2026-06-24T00:00:00Z'),('box1','u1','2026-06-24T00:00:01Z');");
  apply(db, '0010', '0010', { expectFailure: true });
  assert.equal(sqlite(db, 'SELECT COUNT(*) FROM box_openings;'), '2');
});

test('0012 only temporary table is fail-closed', (db) => {
  apply(db, '0001', '0011');
  sqlite(db, 'DROP TABLE agent_skill_operations; CREATE TABLE agent_skill_operations_new(id TEXT);');
  setHistory(db, 11);
  preflight(db, 11, { expectFailure: true });
  assert.equal(sqlite(db, "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='agent_skill_operations_new';"), '1');
});

test('0012 UNIQUE conflict is found before rebuild', (db) => {
  apply(db, '0001', '0011');
  sqlite(db, "DROP INDEX uq_skill_ops_user_idem; INSERT INTO users(id,telegram_id) VALUES('u1','synthetic-1'); INSERT INTO agents(id,user_id,name) VALUES('a1','u1','A1'); INSERT INTO agent_skill_operations(id,user_id,agent_id,operation_type,idempotency_key,result_json,status) VALUES('op1','u1','a1','learn','same','{}','completed'),('op2','u1','a1','learn','same','{}','completed');");
  apply(db, '0012', '0012', { expectFailure: true });
  assert.equal(sqlite(db, 'SELECT COUNT(*) FROM agent_skill_operations;'), '2');
});

test('0012 CHECK conflict is found before rebuild', (db) => {
  apply(db, '0001', '0011');
  sqlite(db, "PRAGMA ignore_check_constraints=ON; INSERT INTO agent_skill_operations(id,user_id,agent_id,operation_type,idempotency_key,result_json,status) VALUES('bad-check','u','a','learn','idem','{}','invalid'); PRAGMA ignore_check_constraints=OFF;");
  apply(db, '0012', '0012', { expectFailure: true });
  assert.equal(sqlite(db, "SELECT status FROM agent_skill_operations WHERE id='bad-check';"), 'invalid');
});

test('0012 completed schema with missing index is fail-closed', (db) => {
  apply(db, '0001', '0012');
  sqlite(db, 'DROP INDEX idx_skill_ops_agent;');
  setHistory(db, 12);
  preflight(db, 12, { expectFailure: true });
});

test('0012 complete schema with missing history is fail-closed', (db) => {
  apply(db, '0001', '0012');
  preflight(db, 12, { expectFailure: true });
  assert.equal(sqlite(db, "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='agent_skill_operations';"), '1');
});

test('0012 history complete with incomplete schema is fail-closed', (db) => {
  apply(db, '0001', '0011');
  setHistory(db, 12);
  preflight(db, 12, { expectFailure: true });
  assert.equal(sqlite(db, "SELECT COUNT(*) FROM pragma_table_info('agent_skill_operations') WHERE name='updated_at';"), '0');
});

test('0012 repeat execution preserves operation rows', (db) => {
  apply(db, '0001', '0011');
  sqlite(db, "INSERT INTO users(id,telegram_id) VALUES('u1','synthetic-1'); INSERT INTO agents(id,user_id,name) VALUES('a1','u1','A1'); INSERT INTO agent_skill_operations(id,user_id,agent_id,operation_type,idempotency_key,result_json,status) VALUES('op1','u1','a1','learn','idem1','{}','completed');");
  apply(db, '0012', '0012');
  apply(db, '0012', '0012', { expectFailure: true });
  assert.equal(sqlite(db, "SELECT COUNT(*) FROM agent_skill_operations WHERE id='op1';"), '1');
});

test('0013 accepts a legal extension row', (db) => {
  apply(db, '0001', '0013');
  sqlite(db, "INSERT INTO agent_skill_definitions(id,code,name,description,tier,category,is_core,max_level,required_agent_level,effect_type,effect_config_json,status) VALUES('ext1','extension_skill','Extension','Legal production extension','normal','research',0,5,1,'research','{}','enabled'); INSERT INTO skill_acquisition_rules(skill_definition_id,canonical_code,catalog_category,is_canonical,release_status) VALUES('ext1',NULL,'research',0,'internal');");
  assert.equal(sqlite(db, "SELECT COUNT(*) FROM skill_acquisition_rules WHERE skill_definition_id='ext1';"), '1');
});

test('0013 fails on same canonical ID with different definition semantics', (db) => {
  apply(db, '0001', '0012');
  sqlite(db, "INSERT INTO agent_skill_definitions(id,code,name,description,tier,category,is_core,max_level,required_agent_level,effect_type,effect_config_json,status) VALUES('sd_res_project_research','skill_res_project_research','Project Research','Conflicting production meaning','normal','social',0,5,1,'growth_propagation','{\"depthBonus\":1,\"sourceBonus\":1}','enabled');");
  apply(db, '0013', '0013', { expectFailure: true });
});

test('0013 fails on canonical key mapped to another ID', (db) => {
  apply(db, '0001', '0012');
  sqlite(db, "INSERT INTO agent_skill_definitions(id,code,name,description,tier,category,is_core,max_level,required_agent_level,effect_type,effect_config_json,status) VALUES('conflict','skill_res_project_research','Conflict','Conflict','normal','research',0,5,1,'research','{}','enabled');");
  apply(db, '0013', '0013', { expectFailure: true });
});

test('0013 accepts same canonical ID with identical semantics and partial seed', (db) => {
  apply(db, '0001', '0012');
  sqlite(db, "INSERT INTO agent_skill_definitions(id,code,name,description,tier,category,is_core,max_level,required_agent_level,effect_type,effect_config_json,status) VALUES('sd_res_project_research','skill_res_project_research','Project Research','Improves project context gathering.','normal','research',0,5,1,'growth_propagation','{\"depthBonus\":1,\"sourceBonus\":1}','enabled');");
  apply(db, '0013', '0013');
  assert.equal(sqlite(db, "SELECT COUNT(*) FROM skill_acquisition_rules WHERE is_canonical=1;"), '31');
});

test('0013 missing canonical rule is detected', (db) => {
  apply(db, '0001', '0013');
  sqlite(db, "DELETE FROM skill_acquisition_rules WHERE skill_definition_id='sd_res_project_research';");
  setHistory(db, 13);
  preflight(db, 13, { expectFailure: true });
  assert.equal(sqlite(db, "SELECT COUNT(*) FROM skill_acquisition_rules WHERE is_canonical=1;"), '30');
});

test('0013 duplicate canonical rule is detected', (db) => {
  apply(db, '0001', '0013');
  sqlite(db, "ALTER TABLE skill_acquisition_rules RENAME TO skill_acquisition_rules_original; CREATE TABLE skill_acquisition_rules AS SELECT * FROM skill_acquisition_rules_original; INSERT INTO skill_acquisition_rules SELECT * FROM skill_acquisition_rules_original WHERE skill_definition_id='sd_res_project_research'; DROP TABLE skill_acquisition_rules_original;");
  setHistory(db, 13);
  preflight(db, 13, { expectFailure: true });
  assert.equal(sqlite(db, "SELECT COUNT(*) FROM skill_acquisition_rules WHERE skill_definition_id='sd_res_project_research';"), '2');
});

test('0013 repeat execution fails closed without changing canonical count', (db) => {
  apply(db, '0001', '0013');
  const before = sqlite(db, "SELECT COUNT(*) FROM skill_acquisition_rules WHERE is_canonical=1;");
  apply(db, '0013', '0013', { expectFailure: true });
  assert.equal(sqlite(db, "SELECT COUNT(*) FROM skill_acquisition_rules WHERE is_canonical=1;"), before);
});

test('0001-0016 fresh migration closes with foreign-key and integrity checks', (db) => {
  apply(db, '0001', '0016');
  assert.equal(sqlite(db, 'PRAGMA integrity_check;'), 'ok');
  assert.equal(sqlite(db, 'PRAGMA foreign_key_check;'), '');
});

console.log(`Production migration remediation verification passed: ${passed} scenarios.`);
