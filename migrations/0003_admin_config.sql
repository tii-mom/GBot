CREATE TABLE IF NOT EXISTS box_definitions (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  rarity TEXT NOT NULL DEFAULT 'common',
  total_supply INTEGER NOT NULL DEFAULT 0,
  remaining_supply INTEGER NOT NULL DEFAULT 0,
  daily_release INTEGER NOT NULL DEFAULT 0,
  acquisition_route TEXT NOT NULL DEFAULT '',
  starts_at TEXT,
  ends_at TEXT,
  transferable_before_open INTEGER NOT NULL DEFAULT 0,
  binding_strategy TEXT NOT NULL DEFAULT 'soulbound',
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset_definitions (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'common',
  status TEXT NOT NULL DEFAULT 'enabled',
  transferable INTEGER NOT NULL DEFAULT 0,
  default_expiry_hours INTEGER,
  default_uses INTEGER,
  effect TEXT NOT NULL DEFAULT '',
  applicable_tasks_json TEXT NOT NULL DEFAULT '[]',
  applicable_boxes_json TEXT NOT NULL DEFAULT '[]',
  requires_wallet INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS box_drop_pool_items (
  id TEXT PRIMARY KEY,
  box_id TEXT NOT NULL,
  asset_id TEXT,
  asset_name TEXT NOT NULL,
  category TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'common',
  weight REAL NOT NULL,
  min_quantity INTEGER NOT NULL DEFAULT 1,
  max_quantity INTEGER NOT NULL DEFAULT 1,
  uses_remaining INTEGER,
  expiry_hours INTEGER,
  transferable INTEGER NOT NULL DEFAULT 0,
  soulbound INTEGER NOT NULL DEFAULT 0,
  effect TEXT NOT NULL DEFAULT '',
  requires_wallet INTEGER NOT NULL DEFAULT 0,
  project_id TEXT,
  metadata_json TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (box_id) REFERENCES box_definitions(id),
  FOREIGN KEY (asset_id) REFERENCES asset_definitions(id)
);

CREATE INDEX IF NOT EXISTS idx_box_drop_pool_box ON box_drop_pool_items(box_id, status);

CREATE TABLE IF NOT EXISTS market_rules (
  id TEXT PRIMARY KEY,
  platform_fee_percent REAL NOT NULL DEFAULT 2.5,
  min_price TEXT NOT NULL DEFAULT '0.1',
  max_price TEXT NOT NULL DEFAULT '1000.0',
  listing_expiry_days INTEGER NOT NULL DEFAULT 7,
  allow_starter_box_trade INTEGER NOT NULL DEFAULT 0,
  allow_project_box_trade INTEGER NOT NULL DEFAULT 1,
  market_paused INTEGER NOT NULL DEFAULT 0,
  cancel_rules TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_config_audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO box_definitions (id, key, name, status, rarity, total_supply, remaining_supply, daily_release, acquisition_route, starts_at, ends_at, transferable_before_open, binding_strategy)
VALUES
  ('box_starter', 'starter', '启动盒', 'active', 'common', 2047, 1488, 150, '启动赠送', '2026-06-16T00:00:00Z', NULL, 0, 'soulbound'),
  ('box_alpha', 'alpha', 'Alpha 盒', 'active', 'rare', 333, 221, 20, '任务产出与市场交易', '2026-06-16T00:00:00Z', NULL, 1, 'transferable'),
  ('box_crew', 'crew', '战队盒', 'active', 'epic', 88, 57, 5, '战队活跃达标解锁', '2026-06-16T00:00:00Z', NULL, 1, 'transferable'),
  ('box_project', 'project', '项目盒', 'draft', 'legendary', 47, 47, 10, '合作项目活动', '2026-06-16T00:00:00Z', '2026-07-16T00:00:00Z', 1, 'transferable'),
  ('box_wallet', 'wallet', '钱包盒', 'draft', 'legendary', 100, 100, 0, '链上任务准入', NULL, NULL, 1, 'transferable');

INSERT OR IGNORE INTO asset_definitions (id, key, name, category, rarity, status, transferable, default_expiry_hours, default_uses, effect, applicable_tasks_json, applicable_boxes_json, requires_wallet)
VALUES
  ('ast_1', 'mission_runner', '任务执行员', 'profession', 'common', 'enabled', 1, NULL, NULL, '提升基础任务执行稳定性', '["task_daily_checkin"]', '["box_starter"]', 0),
  ('ast_2', 'alpha_scout', 'Alpha 侦察员', 'profession', 'rare', 'enabled', 1, NULL, NULL, '发现 Alpha 高价值任务', '["task_launch_sniper"]', '["box_alpha"]', 0),
  ('ast_3', 'crew_captain', '战队队长', 'profession', 'epic', 'enabled', 1, NULL, NULL, '激活战队协同加成', '["task_group_pool"]', '["box_crew"]', 0),
  ('ast_4', 'wallet_operator', '钱包操作员', 'profession', 'legendary', 'enabled', 1, NULL, NULL, '执行用户授权的钱包任务', '["task_onchain_snipe"]', '["box_alpha"]', 1),
  ('ast_5', 'market_scout', '市场侦察员', 'profession', 'rare', 'enabled', 1, NULL, NULL, '监控市场挂单异动', '[]', '[]', 0),
  ('ast_6', 'project_hunter', '项目猎人', 'profession', 'legendary', 'enabled', 1, NULL, NULL, '获取合作项目专属任务入口', '[]', '["box_project"]', 0),
  ('ast_7', 'alpha_radar', 'Alpha 雷达', 'skill', 'rare', 'enabled', 1, 72, 5, '扫描高权重 Alpha 任务', '["task_launch_sniper"]', '["box_alpha"]', 0),
  ('ast_8', 'crew_boost', '战队加速', 'skill', 'epic', 'enabled', 1, 24, 3, '提升战队解锁进度', '["task_group_pool"]', '["box_starter","box_crew"]', 0),
  ('ast_9', 'task_reroll', '任务重掷', 'skill', 'common', 'enabled', 1, NULL, 1, '刷新一次任务结果预览', '[]', '["box_starter","box_crew"]', 0),
  ('ast_10', 'energy_recovery', '能量恢复', 'skill', 'common', 'enabled', 1, NULL, 1, '恢复 Agent 执行能量', '[]', '["box_starter"]', 0),
  ('ast_11', 'project_access_pass', '项目准入通行证', 'access', 'legendary', 'enabled', 1, 168, NULL, '增加合作项目奖励资格权重', '[]', '["box_project"]', 0),
  ('ast_12', 'wallet_task_permit', '钱包任务许可证', 'permit', 'legendary', 'enabled', 1, 24, 1, '授权一次高安全等级钱包任务', '["task_onchain_snipe"]', '["box_alpha"]', 1),
  ('ast_13', 'partner_quest_pass', '合作任务通行证', 'permit', 'rare', 'enabled', 1, 48, 3, '执行合作方联名任务', '[]', '[]', 0),
  ('ast_14', 'allowlist_weight', '白名单权重', 'access', 'genesis', 'enabled', 0, NULL, NULL, '增加未来奖励资格权重', '[]', '["box_project"]', 0);

INSERT OR IGNORE INTO box_drop_pool_items (id, box_id, asset_id, asset_name, category, rarity, weight, min_quantity, max_quantity, uses_remaining, expiry_hours, transferable, soulbound, effect, requires_wallet)
VALUES
  ('dp_s1', 'box_starter', 'ast_9', '任务重掷', 'skill', 'common', 45, 1, 1, 1, NULL, 0, 1, '刷新一次任务结果预览', 0),
  ('dp_s2', 'box_starter', 'ast_10', '能量恢复', 'skill', 'common', 20, 1, 1, 1, NULL, 0, 1, '恢复 Agent 执行能量', 0),
  ('dp_s3', 'box_starter', 'ast_1', '任务执行员', 'profession', 'common', 25, 1, 1, NULL, NULL, 0, 1, '提升基础任务执行稳定性', 0),
  ('dp_s4', 'box_starter', 'ast_8', '战队加速', 'skill', 'epic', 10, 1, 1, 3, 24, 0, 1, '提升战队解锁进度', 0),
  ('dp_a1', 'box_alpha', 'ast_2', 'Alpha 侦察员', 'profession', 'rare', 40, 1, 1, NULL, NULL, 1, 0, '发现 Alpha 高价值任务', 0),
  ('dp_a2', 'box_alpha', 'ast_7', 'Alpha 雷达', 'skill', 'rare', 30, 1, 1, 5, 72, 1, 0, '扫描高权重 Alpha 任务', 0),
  ('dp_a3', 'box_alpha', 'ast_12', '钱包任务许可证', 'permit', 'legendary', 20, 1, 1, 1, 24, 1, 0, '授权一次高安全等级钱包任务', 1),
  ('dp_a4', 'box_alpha', 'ast_4', '钱包操作员', 'profession', 'legendary', 10, 1, 1, NULL, NULL, 1, 0, '执行用户授权的钱包任务', 1),
  ('dp_c1', 'box_crew', 'ast_3', '战队队长', 'profession', 'epic', 40, 1, 1, NULL, NULL, 1, 0, '激活战队协同加成', 0),
  ('dp_c2', 'box_crew', 'ast_8', '战队加速', 'skill', 'epic', 40, 1, 1, 3, 24, 1, 0, '提升战队解锁进度', 0),
  ('dp_c3', 'box_crew', 'ast_9', '任务重掷', 'skill', 'common', 20, 1, 1, 1, NULL, 1, 0, '刷新一次任务结果预览', 0),
  ('dp_p1', 'box_project', 'ast_6', '项目猎人', 'profession', 'legendary', 30, 1, 1, NULL, NULL, 1, 0, '获取合作项目专属任务入口', 0),
  ('dp_p2', 'box_project', 'ast_11', '项目准入通行证', 'access', 'legendary', 40, 1, 1, NULL, 168, 1, 0, '增加合作项目奖励资格权重', 0),
  ('dp_p3', 'box_project', 'ast_14', '白名单权重', 'access', 'genesis', 30, 1, 1, NULL, NULL, 0, 1, '增加未来奖励资格权重', 0);

INSERT OR IGNORE INTO market_rules (id, platform_fee_percent, min_price, max_price, listing_expiry_days, allow_starter_box_trade, allow_project_box_trade, market_paused, cancel_rules)
VALUES ('default', 2.5, '0.1', '1000.0', 7, 0, 1, 0, '挂单可由发布者取消；取消后资产退回背包，已成交订单不可撤销。');
