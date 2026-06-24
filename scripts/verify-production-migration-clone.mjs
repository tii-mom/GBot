#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), 'growthbot-production-clone-'));
const db = join(dir, 'clone.sqlite');
const files = readdirSync(join(root, 'migrations')).filter((f) => /^\d{4}.*\.sql$/.test(f)).sort();
const sql = (text) => execFileSync('sqlite3', ['-batch', '-bail', db], { input: text, encoding: 'utf8' }).trim();
const apply = (from, to) => {
  sql('CREATE TABLE IF NOT EXISTS _test_applied_migrations(name TEXT PRIMARY KEY);');
  for (const file of files.filter((f) => f.slice(0,4) >= from && f.slice(0,4) <= to)) {
    sql(readFileSync(join(root, 'migrations', file), 'utf8'));
    sql(`INSERT OR REPLACE INTO _test_applied_migrations(name) VALUES('${file}');`);
  }
};
const values = (n, make) => Array.from({ length: n }, (_, i) => make(i + 1)).join(',');
const count = (table) => Number(sql(`SELECT COUNT(*) FROM ${table};`));

try {
  apply('0001', '0005');
  sql('DELETE FROM marketplace_trades; DELETE FROM marketplace_listings; DELETE FROM bounty_task_verifications; DELETE FROM bounty_tasks; DELETE FROM task_executions; DELETE FROM point_ledger_events; DELETE FROM inventory_items; DELETE FROM agents; DELETE FROM users; DELETE FROM admin_config_audit_logs;');
  sql(`INSERT INTO users(id,telegram_id,username) VALUES ${values(61, i => `('u${i}','synthetic_tg_${i}','synthetic_user_${i}')`)};`);
  sql(`INSERT INTO agents(id,user_id,name) VALUES ${values(58, i => `('a${i}','u${i}','Synthetic Agent ${i}')`)};`);
  sql(`INSERT INTO inventory_items(id,owner_user_id,item_type,name,status,metadata_json) VALUES ${values(79, i => `('inv${i}','u${((i-1)%61)+1}','${i <= 10 ? 'box' : 'skill_card'}','Synthetic Item ${i}','available','{"fixture":true,"legacyVersion":${i%3}}')`)};`);
  sql(`INSERT INTO task_executions(id,task_id,user_id,agent_id,status,verification_status) VALUES ${values(45, i => `('te${i}','task_fixture','u${((i-1)%58)+1}','a${((i-1)%58)+1}','completed','${i <= 16 ? 'verified' : 'pending'}')`)};`);
  sql(`INSERT INTO point_ledger_events(id,user_id,agent_id,event_type,point_type,amount,metadata_json) VALUES ${values(206, i => `('le${i}','u${((i-1)%61)+1}',${i <= 58 ? `'a${i}'` : 'NULL'},'fixture','GP',${i%2 ? 10 : -3},'{"synthetic":true}')`)};`);
  sql(`INSERT INTO bounty_tasks(id,title,category,platform,target_url,owner_type,status) VALUES ${values(14, i => `('bt${i}','Synthetic Bounty ${i}','research','synthetic','https://example.invalid/bounty/${i}','platform','${i===14 ? 'paused' : 'active'}')`)};`);
  sql(`INSERT INTO bounty_task_verifications(id,bounty_task_id,user_id,link,submission_hash,status) VALUES ${values(16, i => `('bv${i}','bt${((i-1)%14)+1}','u${i}','https://example.invalid/proof/${i}','synthetic_hash_${i}','${i%2 ? 'verified' : 'submitted'}')`)};`);
  sql("INSERT INTO marketplace_listings(id,seller_user_id,inventory_item_id,price,currency,status) VALUES('ml1','u1','inv1','100','GP','sold');");
  sql("INSERT INTO marketplace_trades(id,listing_id,seller_user_id,buyer_user_id,inventory_item_id,price,currency,fee_amount,status) VALUES('mt1','ml1','u1','u2','inv1','100','GP','5','settled');");
  if (sql("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='admin_config_audit_logs';") === '1') {
    const cols = sql("SELECT group_concat(name,',') FROM pragma_table_info('admin_config_audit_logs');");
    if (cols.includes('id') && cols.includes('action')) {
      for (let i=1;i<=62;i++) sql(`INSERT INTO admin_config_audit_logs(id,action,target_type,target_id,metadata_json) VALUES('audit${i}','synthetic','fixture','row${i}','{\"synthetic\":true}');`);
    }
  }

  for (const [table, expected] of [['users',61],['agents',58],['inventory_items',79],['task_executions',45],['bounty_task_verifications',16],['point_ledger_events',206],['bounty_tasks',14],['marketplace_listings',1],['marketplace_trades',1]]) assert.equal(count(table), expected, `${table} fixture count`);
  execFileSync(process.execPath, [join(root,'scripts','preflight-production-migrations-0006-0016.mjs'),'--db',db,'--expected-max','5','--environment','synthetic-production-clone'], { stdio:'inherit' });
  apply('0006','0016');
  assert.equal(sql('PRAGMA integrity_check;'),'ok');
  assert.equal(sql('PRAGMA foreign_key_check;'),'');
  assert.equal(Number(sql("SELECT MAX(CAST(substr(name,1,4) AS INTEGER)) FROM _test_applied_migrations;")),16);
  assert.equal(count('users'),61); assert.equal(count('agents'),58); assert.equal(count('inventory_items'),79); assert.equal(count('point_ledger_events'),206);
  assert.equal(Number(sql('SELECT COALESCE(SUM(amount),0) FROM point_ledger_events;')),721);
  assert.equal(Number(sql("SELECT COUNT(*) FROM skill_acquisition_rules WHERE is_canonical=1;")),31);
  console.log('PASS production-shaped synthetic clone: 0006-0016, counts, ownership, FK, ledger, marketplace/bounty, skill/runtime schema.');

  const bad = join(dir,'bad.sqlite');
  execFileSync('cp',[db,bad]);
  execFileSync('sqlite3',['-batch',bad,"UPDATE _test_applied_migrations SET name='0005_fake.sql' WHERE name LIKE '0016%';"],{stdio:'ignore'});
  let blocked=false;
  try { execFileSync(process.execPath,[join(root,'scripts','preflight-production-migrations-0006-0016.mjs'),'--db',bad,'--expected-max','5'],{stdio:'ignore'}); } catch { blocked=true; }
  assert.equal(blocked,true,'schema/history divergence must fail closed');
  console.log('PASS abnormal clone is blocked by read-only preflight.');
} finally {
  rmSync(dir,{recursive:true,force:true});
}
