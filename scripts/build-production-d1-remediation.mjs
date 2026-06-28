#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const migrationsDir = join(root, 'migrations');
const outputDir = join(root, 'ops', 'remediation');

function readMigration(name) {
  return readFileSync(join(migrationsDir, name), 'utf8').trim();
}

function sliceBefore(text, marker, label) {
  const index = text.indexOf(marker);
  if (index === -1) throw new Error(`Unable to locate marker for ${label}`);
  return text.slice(0, index).trimEnd();
}

function sliceFrom(text, marker, label) {
  const index = text.indexOf(marker);
  if (index === -1) throw new Error(`Unable to locate marker for ${label}`);
  return text.slice(index).trimStart();
}

function assertionTable(tableName, assertions) {
  const rows = assertions.map(({ name, expr, reason }) => [
    `INSERT INTO ${tableName} VALUES (`,
    `  '${name}',`,
    `  CASE WHEN ${expr} THEN 1 ELSE 0 END,`,
    `  '${reason}'`,
    `);`
  ].join('\n')).join('\n\n');

  return [
    `CREATE TABLE ${tableName} (`,
    '  assertion_name TEXT PRIMARY KEY,',
    '  is_valid INTEGER NOT NULL CHECK (is_valid = 1),',
    '  reason TEXT NOT NULL',
    ');',
    '',
    rows
  ].join('\n');
}

const migration0012 = readMigration('0012_skill_economy_loop.sql');
const migration0013 = readMigration('0013_skill_catalog_acquisition_v1.sql');
const migration0014 = readMigration('0014_skill_runtime_lite_v1.sql');
const migration0015 = readMigration('0015_workflow_runtime_settlement_gate.sql');
const migration0016 = readMigration('0016_research_brief_runtime_v1.sql');
const migration0017 = readMigration('0017_real_asset_agent_persistence_v1.sql');

const migration0012BeforeRequestHash = sliceBefore(
  migration0012,
  'ALTER TABLE box_orders ADD COLUMN request_hash TEXT;',
  '0012 box_orders request_hash split'
);
const migration0015RuntimeExecutionTable = sliceFrom(
  migration0015,
  'CREATE TABLE IF NOT EXISTS work_step_runtime_executions (',
  '0015 runtime execution table'
);
const migration0016TaskSeed = sliceFrom(
  migration0016,
  'INSERT OR IGNORE INTO tasks (',
  '0016 research brief task seed'
);

const schemaAssertions = assertionTable('production_remediation_schema_assertions', [
  {
    name: 'history table exists',
    expr: "EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='d1_migrations')",
    reason: 'schema remediation blocked: d1_migrations table is missing'
  },
  {
    name: 'history row count is 5',
    expr: '(SELECT COUNT(*) FROM d1_migrations) = 5',
    reason: 'schema remediation blocked: expected exactly 5 migration history rows before remediation'
  },
  {
    name: 'history max id is 5',
    expr: '(SELECT COALESCE(MAX(id), 0) FROM d1_migrations) = 5',
    reason: 'schema remediation blocked: expected migration history max id 5 before remediation'
  },
  {
    name: '0006 agents columns already present',
    expr: "EXISTS (SELECT 1 FROM pragma_table_info('agents') WHERE name='profession')",
    reason: 'schema remediation blocked: production no longer matches the expected 0006-partial state'
  },
  {
    name: '0011 inventory skill column already present',
    expr: "EXISTS (SELECT 1 FROM pragma_table_info('inventory_items') WHERE name='skill_definition_id')",
    reason: 'schema remediation blocked: inventory_items.skill_definition_id is missing'
  },
  {
    name: '0010 box_openings target column already present',
    expr: "EXISTS (SELECT 1 FROM pragma_table_info('box_openings') WHERE name='user_id')",
    reason: 'schema remediation blocked: box_openings.user_id is missing'
  },
  {
    name: '0012 request_hash still missing',
    expr: "NOT EXISTS (SELECT 1 FROM pragma_table_info('box_orders') WHERE name='request_hash')",
    reason: 'schema remediation blocked: box_orders.request_hash already exists or state drifted'
  },
  {
    name: '0012 updated_at still missing',
    expr: "NOT EXISTS (SELECT 1 FROM pragma_table_info('agent_skill_operations') WHERE name='updated_at')",
    reason: 'schema remediation blocked: agent_skill_operations.updated_at already exists or state drifted'
  },
  {
    name: '0012 skill economy tables still absent',
    expr: "NOT EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='skill_economy_events')",
    reason: 'schema remediation blocked: 0012 tables already exist or partial remediation is present'
  },
  {
    name: '0013 acquisition rules absent',
    expr: "NOT EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='skill_acquisition_rules')",
    reason: 'schema remediation blocked: skill_acquisition_rules already exists'
  },
  {
    name: '0014 runtime tables absent',
    expr: "NOT EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='skill_runtime_versions')",
    reason: 'schema remediation blocked: skill_runtime_versions already exists'
  },
  {
    name: '0015 execution_mode absent',
    expr: "NOT EXISTS (SELECT 1 FROM pragma_table_info('agent_work_runs') WHERE name='execution_mode')",
    reason: 'schema remediation blocked: agent_work_runs.execution_mode already exists'
  },
  {
    name: '0016 research brief column absent',
    expr: "NOT EXISTS (SELECT 1 FROM pragma_table_info('agent_work_runs') WHERE name='research_brief_result_json')",
    reason: 'schema remediation blocked: agent_work_runs.research_brief_result_json already exists'
  },
  {
    name: '0017 persistence tables absent',
    expr: "NOT EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='admin_risk_audit_events')",
    reason: 'schema remediation blocked: admin_risk_audit_events already exists'
  }
]);

const requestHashAssertions = assertionTable('production_remediation_request_hash_assertions', [
  {
    name: 'box_orders table exists',
    expr: "EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='box_orders')",
    reason: 'schema remediation blocked: box_orders table is missing'
  },
  {
    name: 'request_hash absent before add',
    expr: "NOT EXISTS (SELECT 1 FROM pragma_table_info('box_orders') WHERE name='request_hash')",
    reason: 'schema remediation blocked: box_orders.request_hash already exists'
  }
]);

const executionModeAssertions = assertionTable('production_remediation_execution_mode_assertions', [
  {
    name: 'agent_work_runs table exists',
    expr: "EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='agent_work_runs')",
    reason: 'schema remediation blocked: agent_work_runs table is missing'
  },
  {
    name: 'execution_mode absent before add',
    expr: "NOT EXISTS (SELECT 1 FROM pragma_table_info('agent_work_runs') WHERE name='execution_mode')",
    reason: 'schema remediation blocked: agent_work_runs.execution_mode already exists'
  }
]);

const researchBriefAssertions = assertionTable('production_remediation_research_brief_assertions', [
  {
    name: 'agent_work_runs table exists',
    expr: "EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='agent_work_runs')",
    reason: 'schema remediation blocked: agent_work_runs table is missing'
  },
  {
    name: 'research brief column absent before add',
    expr: "NOT EXISTS (SELECT 1 FROM pragma_table_info('agent_work_runs') WHERE name='research_brief_result_json')",
    reason: 'schema remediation blocked: agent_work_runs.research_brief_result_json already exists'
  }
]);

const historyAssertions = assertionTable('production_remediation_history_assertions', [
  {
    name: 'history table exists',
    expr: "EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='d1_migrations')",
    reason: 'history remediation blocked: d1_migrations table is missing'
  },
  {
    name: 'history count still 5 before backfill',
    expr: '(SELECT COUNT(*) FROM d1_migrations) = 5',
    reason: 'history remediation blocked: expected exactly 5 rows before backfill'
  },
  {
    name: 'history max still 5 before backfill',
    expr: '(SELECT COALESCE(MAX(id), 0) FROM d1_migrations) = 5',
    reason: 'history remediation blocked: expected max id 5 before backfill'
  },
  {
    name: '0012 updated_at present',
    expr: "EXISTS (SELECT 1 FROM pragma_table_info('agent_skill_operations') WHERE name='updated_at')",
    reason: 'history remediation blocked: 0012 schema is incomplete'
  },
  {
    name: '0012 request_hash present',
    expr: "EXISTS (SELECT 1 FROM pragma_table_info('box_orders') WHERE name='request_hash')",
    reason: 'history remediation blocked: box_orders.request_hash is still missing'
  },
  {
    name: '0013 canonical rules complete',
    expr: "(SELECT COUNT(*) FROM skill_acquisition_rules WHERE is_canonical=1) = 31",
    reason: 'history remediation blocked: canonical acquisition rules are incomplete'
  },
  {
    name: '0014 active runtimes complete',
    expr: "(SELECT COUNT(*) FROM skill_runtime_versions WHERE runtime_status='active') = 31",
    reason: 'history remediation blocked: active runtime versions are incomplete'
  },
  {
    name: '0015 execution_mode present',
    expr: "EXISTS (SELECT 1 FROM pragma_table_info('agent_work_runs') WHERE name='execution_mode')",
    reason: 'history remediation blocked: execution_mode column is missing'
  },
  {
    name: '0016 research brief column present',
    expr: "EXISTS (SELECT 1 FROM pragma_table_info('agent_work_runs') WHERE name='research_brief_result_json')",
    reason: 'history remediation blocked: research_brief_result_json column is missing'
  },
  {
    name: '0017 audit table present',
    expr: "EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='admin_risk_audit_events')",
    reason: 'history remediation blocked: admin_risk_audit_events table is missing'
  }
]);

const historyRows = [
  '0006_agent_workflow_box_store_wallet.sql',
  '0007_seed_v1_catalog_and_store.sql',
  '0008_v1_rigorous_constraints.sql',
  '0009_v1_constraints_and_reservations.sql',
  '0010_box_openings_owner_constraint.sql',
  '0011_agent_skill_core.sql',
  '0012_skill_economy_loop.sql',
  '0013_skill_catalog_acquisition_v1.sql',
  '0014_skill_runtime_lite_v1.sql',
  '0015_workflow_runtime_settlement_gate.sql',
  '0016_research_brief_runtime_v1.sql',
  '0017_real_asset_agent_persistence_v1.sql'
];

const historyInserts = historyRows.map((name, index) => [
  'INSERT INTO d1_migrations (id, name, applied_at)',
  `SELECT ${index + 6}, '${name}', CURRENT_TIMESTAMP`,
  `WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE id = ${index + 6});`
].join('\n')).join('\n\n');

const historyFinalAssertions = assertionTable('production_remediation_history_post_assertions', [
  {
    name: 'history row count is 17',
    expr: '(SELECT COUNT(*) FROM d1_migrations) = 17',
    reason: 'history remediation blocked: expected exactly 17 history rows after backfill'
  },
  {
    name: 'history max id is 17',
    expr: '(SELECT COALESCE(MAX(id), 0) FROM d1_migrations) = 17',
    reason: 'history remediation blocked: expected max id 17 after backfill'
  }
]);

const schemaSql = [
  '-- production-d1-remediation-schema-v1.sql',
  '-- Generated by scripts/build-production-d1-remediation.mjs - DO NOT EDIT MANUALLY',
  '-- Purpose: patch the exact production history/schema divergence observed on 2026-06-28.',
  '-- This file is intentionally fail-closed and should only be executed after clone verification.',
  '',
  schemaAssertions,
  '',
  '-- 0012 custom remediation: preserve upstream guarded rebuild, but split request_hash',
  migration0012BeforeRequestHash,
  '',
  requestHashAssertions,
  '',
  'ALTER TABLE box_orders ADD COLUMN request_hash TEXT;',
  'DROP TABLE production_remediation_request_hash_assertions;',
  '',
  '-- 0013 canonical acquisition rules',
  migration0013,
  '',
  '-- 0014 runtime catalog and execution tables',
  migration0014,
  '',
  '-- 0015 workflow runtime settlement gate with guarded execution_mode add',
  executionModeAssertions,
  '',
  "ALTER TABLE agent_work_runs ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'simulated' CHECK (execution_mode IN ('simulated', 'runtime', 'external'));",
  migration0015RuntimeExecutionTable,
  'DROP TABLE production_remediation_execution_mode_assertions;',
  '',
  '-- 0016 research brief runtime with guarded column add',
  researchBriefAssertions,
  '',
  'ALTER TABLE agent_work_runs ADD COLUMN research_brief_result_json TEXT;',
  migration0016TaskSeed,
  'DROP TABLE production_remediation_research_brief_assertions;',
  '',
  '-- 0017 real-asset persistence tables',
  migration0017,
  '',
  'DROP TABLE production_remediation_schema_assertions;'
].join('\n\n');

const historySql = [
  '-- production-d1-remediation-history-v1.sql',
  '-- Generated by scripts/build-production-d1-remediation.mjs - DO NOT EDIT MANUALLY',
  '-- Purpose: backfill d1_migrations only after the custom remediation schema post-state is verified.',
  '',
  historyAssertions,
  '',
  historyInserts,
  '',
  historyFinalAssertions,
  '',
  'DROP TABLE production_remediation_history_post_assertions;',
  'DROP TABLE production_remediation_history_assertions;'
].join('\n\n');

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'production-d1-remediation-schema-v1.sql'), schemaSql);
writeFileSync(join(outputDir, 'production-d1-remediation-history-v1.sql'), historySql);

console.log(`Generated remediation SQL in ${outputDir}`);
