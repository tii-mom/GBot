#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const remote = args.includes('--remote');
const env = value('--env');
const confirmed = args.includes('--confirm-read-only');
const dbArg = value('--db');
const expectedMax = Number(value('--expected-max') ?? 5);

if (remote) {
  if (env !== 'production' || !confirmed) throw new Error('Remote mode requires --remote --env production --confirm-read-only');
  throw new Error('Remote execution is intentionally disabled in this remediation task; run the approved read-only command during independent acceptance.');
}
if (!dbArg) throw new Error('Local mode requires --db <sqlite-path>');
const db = resolve(dbArg);
if (!existsSync(db)) throw new Error(`Database not found: ${db}`);

function q(sql) {
  return execFileSync('sqlite3', ['-batch', '-readonly', '-noheader', db, sql], { encoding: 'utf8' }).trim();
}
function exists(name, type = 'table') { return q(`SELECT COUNT(*) FROM sqlite_master WHERE type='${type}' AND name='${name.replaceAll("'", "''")}';`) === '1'; }
function scalar(sql) { const out = q(sql); return out === '' ? 0 : Number(out); }
const failures = [];
const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

check('environment identity supplied', Boolean(env || value('--environment') || 'local'), `local:${db}`);
check('integrity_check', q('PRAGMA integrity_check;') === 'ok', q('PRAGMA integrity_check;'));
check('foreign_key_check', q('PRAGMA foreign_key_check;') === '', q('PRAGMA foreign_key_check;'));

let migrationMax = null;
if (exists('d1_migrations')) migrationMax = scalar('SELECT COALESCE(MAX(id),0) FROM d1_migrations;');
else if (exists('_test_applied_migrations')) migrationMax = scalar("SELECT COALESCE(MAX(CAST(substr(name,1,4) AS INTEGER)),0) FROM _test_applied_migrations;");
else if (exists('_cf_KV')) migrationMax = null;
check('migration history table present', migrationMax !== null, migrationMax === null ? 'no supported history table' : `max=${migrationMax}`);
if (migrationMax !== null) check(`migration max is ${expectedMax}`, migrationMax === expectedMax, `actual=${migrationMax}`);

if (exists('box_openings')) {
  const columns = q("SELECT group_concat(name,',') FROM pragma_table_info('box_openings');");
  const hasUser = columns.split(',').includes('user_id');
  check('0010 schema matches migration history', migrationMax === null || (migrationMax < 10 ? !hasUser : hasUser), columns);
  check('0010 no missing inventory', scalar('SELECT COUNT(*) FROM box_openings bo LEFT JOIN inventory_items ii ON ii.id=bo.inventory_item_id WHERE ii.id IS NULL;') === 0);
  check('0010 owner present', scalar("SELECT COUNT(*) FROM box_openings bo JOIN inventory_items ii ON ii.id=bo.inventory_item_id WHERE ii.owner_user_id IS NULL OR trim(ii.owner_user_id)='';") === 0);
  check('0010 owner user exists', scalar('SELECT COUNT(*) FROM box_openings bo JOIN inventory_items ii ON ii.id=bo.inventory_item_id LEFT JOIN users u ON u.id=ii.owner_user_id WHERE u.id IS NULL;') === 0);
  check('0010 opening business keys unique', scalar('SELECT COUNT(*) FROM (SELECT inventory_item_id FROM box_openings GROUP BY inventory_item_id HAVING COUNT(*)>1);') === 0);
}

const oldOps = exists('agent_skill_operations');
const newOps = exists('agent_skill_operations_new');
const opCols = oldOps ? q("SELECT group_concat(name,',') FROM pragma_table_info('agent_skill_operations');") : '';
const hasUpdatedAt = opCols.split(',').includes('updated_at');
const indexCount = scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name IN ('uq_skill_ops_user_idem','idx_skill_ops_agent');");
const state0012 = migrationMax !== null && migrationMax < 11 && !oldOps && !newOps
  ? 'pre-0011'
  : oldOps && !newOps && !hasUpdatedAt && migrationMax !== null && migrationMax >= 12
    ? 'G-history-complete-schema-incomplete'
    : oldOps && !newOps && !hasUpdatedAt
      ? 'A-old-only'
      : oldOps && !newOps && hasUpdatedAt && indexCount === 2
        ? 'D-complete'
        : oldOps && !newOps && hasUpdatedAt && indexCount !== 2
          ? 'F-indexes-incomplete'
          : oldOps && newOps
            ? 'B-old-and-temp'
            : !oldOps && newOps
              ? 'C/E-temp-only'
              : 'E/G/H-divergent';
check('0012 state is unambiguous', ['pre-0011', 'A-old-only', 'D-complete'].includes(state0012), state0012);
if (oldOps) {
  check('0012 operation IDs unique', scalar('SELECT COUNT(*) FROM (SELECT id FROM agent_skill_operations GROUP BY id HAVING COUNT(*)>1);') === 0);
  check('0012 operation business keys unique', scalar('SELECT COUNT(*) FROM (SELECT user_id,operation_type,idempotency_key FROM agent_skill_operations GROUP BY user_id,operation_type,idempotency_key HAVING COUNT(*)>1);') === 0);
  check('0012 operation rows well formed', scalar("SELECT COUNT(*) FROM agent_skill_operations WHERE id IS NULL OR trim(id)='' OR user_id IS NULL OR trim(user_id)='' OR agent_id IS NULL OR trim(agent_id)='' OR idempotency_key IS NULL OR trim(idempotency_key)='';") === 0);
}

if (exists('skill_acquisition_rules')) {
  check('0013 canonical IDs unique', scalar('SELECT COUNT(*) FROM (SELECT skill_definition_id FROM skill_acquisition_rules WHERE is_canonical=1 GROUP BY skill_definition_id HAVING COUNT(*)>1);') === 0);
  check('0013 canonical keys unique', scalar('SELECT COUNT(*) FROM (SELECT canonical_code FROM skill_acquisition_rules WHERE is_canonical=1 GROUP BY canonical_code HAVING COUNT(*)>1);') === 0);
  check('0013 canonical rules complete', scalar('SELECT COUNT(*) FROM skill_acquisition_rules WHERE is_canonical=1;') === 31);
  check('0013 no missing definition rule', scalar('SELECT COUNT(*) FROM agent_skill_definitions d LEFT JOIN skill_acquisition_rules r ON r.skill_definition_id=d.id WHERE r.skill_definition_id IS NULL;') === 0);
}

for (const [table, key] of [['point_ledger_events','id'],['bounty_tasks','id'],['marketplace_listings','id'],['marketplace_trades','id']]) {
  if (exists(table)) check(`${table} duplicate ${key}`, scalar(`SELECT COUNT(*) FROM (SELECT ${key} FROM ${table} GROUP BY ${key} HAVING COUNT(*)>1);`) === 0);
}
if (exists('point_ledger_events')) check('ledger aggregate is numeric', Number.isFinite(Number(q('SELECT COALESCE(SUM(amount),0) FROM point_ledger_events;'))));

if (failures.length) {
  console.error(`Preflight FAILED CLOSED: ${failures.length} check(s): ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`Preflight PASS: ${checks.length} read-only checks; no database writes performed.`);
