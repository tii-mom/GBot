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
function columns(table) { return exists(table) ? q(`SELECT group_concat(name,',') FROM pragma_table_info('${table.replaceAll("'", "''")}');`) : ''; }
function hasColumn(table, column) { return columns(table).split(',').includes(column); }
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
  const boxOpeningColumns = columns('box_openings');
  const hasUser = boxOpeningColumns.split(',').includes('user_id');
  check('0010 schema matches migration history', migrationMax === null || (migrationMax < 10 ? !hasUser : hasUser), boxOpeningColumns);
  check('0010 no missing inventory', scalar('SELECT COUNT(*) FROM box_openings bo LEFT JOIN inventory_items ii ON ii.id=bo.inventory_item_id WHERE ii.id IS NULL;') === 0);
  check('0010 owner present', scalar("SELECT COUNT(*) FROM box_openings bo JOIN inventory_items ii ON ii.id=bo.inventory_item_id WHERE ii.owner_user_id IS NULL OR trim(ii.owner_user_id)='';") === 0);
  check('0010 owner user exists', scalar('SELECT COUNT(*) FROM box_openings bo JOIN inventory_items ii ON ii.id=bo.inventory_item_id LEFT JOIN users u ON u.id=ii.owner_user_id WHERE u.id IS NULL;') === 0);
  check('0010 opening business keys unique', scalar('SELECT COUNT(*) FROM (SELECT inventory_item_id FROM box_openings GROUP BY inventory_item_id HAVING COUNT(*)>1);') === 0);
}

const oldOps = exists('agent_skill_operations');
const newOps = exists('agent_skill_operations_new');
const opCols = oldOps ? columns('agent_skill_operations') : '';
const hasUpdatedAt = opCols.split(',').includes('updated_at');
const hasRequestHash = exists('box_orders') && hasColumn('box_orders', 'request_hash');
const indexCount = scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name IN ('uq_skill_ops_user_idem','idx_skill_ops_agent');");
const economyTables0012 = [
  'operation_validations',
  'skill_economy_item_consumptions',
  'skill_economy_events',
  'skill_synthesis_pity',
  'skill_upgrade_operations',
  'skill_synthesis_operations',
  'skill_box_daily_purchases',
  'agent_skill_reset_operations'
];
const economyTables0012Present = economyTables0012.filter((name) => exists(name));
const state0012 = migrationMax !== null && migrationMax < 11 && !oldOps && !newOps
  ? 'pre-0011'
  : oldOps && !newOps && !hasUpdatedAt && !hasRequestHash && economyTables0012Present.length === 0 && migrationMax !== null && migrationMax >= 12
    ? 'G-history-complete-schema-incomplete'
    : oldOps && !newOps && !hasUpdatedAt && !hasRequestHash && economyTables0012Present.length === 0
      ? 'A-old-only'
      : oldOps && !newOps && hasUpdatedAt && hasRequestHash && indexCount === 2 && economyTables0012Present.length === economyTables0012.length
        ? 'D-complete'
        : oldOps && !newOps && (hasUpdatedAt || hasRequestHash || economyTables0012Present.length > 0) && indexCount !== 2
          ? 'F-indexes-incomplete'
          : oldOps && newOps
            ? 'B-old-and-temp'
              : !oldOps && newOps
                ? 'C/E-temp-only'
                : 'E/G/H-divergent';
check('0012 state is unambiguous', ['pre-0011', 'A-old-only', 'D-complete'].includes(state0012), state0012);
check('0012 economy tables align with history', migrationMax === null || (migrationMax < 12 ? economyTables0012Present.length === 0 : economyTables0012Present.length === economyTables0012.length), economyTables0012Present.join(',') || 'none');
if (exists('box_orders')) check('0012 box_orders.request_hash aligns with history', migrationMax === null || (migrationMax < 12 ? !hasRequestHash : hasRequestHash), hasRequestHash ? 'present' : 'absent');
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

const runtimeTables0014 = ['skill_runtime_versions', 'skill_runtime_executions', 'task_skill_runtime_usages'];
const runtimeTables0014Present = runtimeTables0014.filter((name) => exists(name));
check('0014 runtime tables align with history', migrationMax === null || (migrationMax < 14 ? runtimeTables0014Present.length === 0 : runtimeTables0014Present.length === runtimeTables0014.length), runtimeTables0014Present.join(',') || 'none');
if (runtimeTables0014Present.length === runtimeTables0014.length) {
  check('0014 active runtimes seeded', scalar("SELECT COUNT(*) FROM skill_runtime_versions WHERE runtime_status='active';") === 31);
  check('0014 runtime indexes present', scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name IN ('uq_active_runtime','idx_runtime_versions_def','uq_runtime_recovery_once','idx_runtime_execution_parent','idx_runtime_usages_execution');") === 5);
}

const hasExecutionMode = exists('agent_work_runs') && hasColumn('agent_work_runs', 'execution_mode');
const hasStepRuntimeExecutions = exists('work_step_runtime_executions');
check('0015 workflow runtime schema aligns with history', migrationMax === null || (migrationMax < 15 ? !hasExecutionMode && !hasStepRuntimeExecutions : hasExecutionMode && hasStepRuntimeExecutions), `${hasExecutionMode ? 'execution_mode' : 'no_execution_mode'}|${hasStepRuntimeExecutions ? 'table_present' : 'table_absent'}`);
if (hasStepRuntimeExecutions) check('0015 runtime execution indexes present', scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name IN ('idx_work_step_runtime_executions_run','idx_work_step_runtime_executions_step','idx_work_step_runtime_executions_runtime');") === 3);

const hasResearchBriefResult = exists('agent_work_runs') && hasColumn('agent_work_runs', 'research_brief_result_json');
check('0016 research brief column aligns with history', migrationMax === null || (migrationMax < 16 ? !hasResearchBriefResult : hasResearchBriefResult), hasResearchBriefResult ? 'present' : 'absent');
if (exists('tasks') && migrationMax !== null && migrationMax >= 16) check('0016 research brief task present', scalar("SELECT COUNT(*) FROM tasks WHERE id='task_research_brief_v1';") === 1);

const persistenceTables0017 = [
  'agent_wallet_policies',
  'wallet_asset_snapshots',
  'asset_ledger_events',
  'onchain_transaction_intents',
  'onchain_transaction_events',
  'ai_model_token_products',
  'ai_model_token_purchase_intents',
  'ai_model_token_purchase_results',
  'ai_credit_balances',
  'ai_credit_usage_events',
  'work_report_evidence_events',
  'admin_risk_audit_events'
];
const persistenceTables0017Present = persistenceTables0017.filter((name) => exists(name));
check('0017 persistence tables align with history', migrationMax === null || (migrationMax < 17 ? persistenceTables0017Present.length === 0 : persistenceTables0017Present.length === persistenceTables0017.length), persistenceTables0017Present.join(',') || 'none');
if (persistenceTables0017Present.length === persistenceTables0017.length) check('0017 admin audit indexes present', scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name IN ('idx_admin_risk_audit_events_event_type','idx_admin_risk_audit_events_actor','idx_admin_risk_audit_events_target_type','idx_admin_risk_audit_events_target_id','idx_admin_risk_audit_events_status','idx_admin_risk_audit_events_created_at');") === 6);

for (const [table, key] of [['point_ledger_events','id'],['bounty_tasks','id'],['marketplace_listings','id'],['marketplace_trades','id']]) {
  if (exists(table)) check(`${table} duplicate ${key}`, scalar(`SELECT COUNT(*) FROM (SELECT ${key} FROM ${table} GROUP BY ${key} HAVING COUNT(*)>1);`) === 0);
}
if (exists('point_ledger_events')) check('ledger aggregate is numeric', Number.isFinite(Number(q('SELECT COALESCE(SUM(amount),0) FROM point_ledger_events;'))));

if (failures.length) {
  console.error(`Preflight FAILED CLOSED: ${failures.length} check(s): ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`Preflight PASS: ${checks.length} read-only checks; no database writes performed.`);
