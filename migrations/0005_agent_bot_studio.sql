-- 增加用户白名单权限字段与订阅等级字段 (已移至 ensureAdminConfigData 幂等执行，此处仅保留注释说明)
-- ALTER TABLE users ADD COLUMN studio_enabled INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN plan_tier TEXT NOT NULL DEFAULT 'free';

-- 新增服务商白名单表
CREATE TABLE IF NOT EXISTS agent_provider_allowlist (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  base_url TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 新增 Agent 模型配置表
CREATE TABLE IF NOT EXISTS agent_model_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  base_url TEXT NOT NULL,
  model_id TEXT NOT NULL,
  encrypted_api_key TEXT,
  key_last4 TEXT,
  prompt_template TEXT,
  task_preferences_json TEXT,
  risk_preferences_json TEXT,
  daily_call_limit INTEGER NOT NULL DEFAULT 100,
  daily_call_count INTEGER NOT NULL DEFAULT 0,
  last_call_date TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 新增 Prompt 模板表
CREATE TABLE IF NOT EXISTS agent_prompt_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 新增模型调用审计日志表
CREATE TABLE IF NOT EXISTS agent_model_call_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  config_id TEXT,
  purpose TEXT NOT NULL,
  input_summary TEXT,
  output_summary TEXT,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_model_configs_user ON agent_model_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_model_call_logs_user ON agent_model_call_logs(user_id);

-- 初始化默认白名单提供商
INSERT OR IGNORE INTO agent_provider_allowlist (id, name, base_url, status) VALUES
('prov_openai', 'OpenAI', 'https://api.openai.com', 'active'),
('prov_anthropic', 'Anthropic', 'https://api.anthropic.com', 'active'),
('prov_deepseek', 'DeepSeek', 'https://api.deepseek.com', 'active'),
('prov_groq', 'Groq', 'https://api.groq.com', 'active'),
('prov_dashscope', 'Aliyuncs DashScope', 'https://dashscope.aliyuncs.com', 'active'),
('prov_openrouter', 'OpenRouter', 'https://openrouter.ai', 'active');

-- 预设系统默认 Prompt 模板
INSERT OR IGNORE INTO agent_prompt_templates (id, name, scope, content) VALUES
('tmpl_task_analysis', 'task_analysis', 'system', 'You are an AI Assistant analyzing a task for GrowthBot. Determine steps, check for requirements/rules, and assess risk. Answer only in JSON matching the schema.'),
('tmpl_task_recommendation', 'task_recommendation', 'system', 'Analyze the list of tasks and recommend them according to preferences. Output a JSON array containing objects with taskId and reason.');
