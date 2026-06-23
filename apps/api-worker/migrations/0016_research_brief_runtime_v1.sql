-- 0016_research_brief_runtime_v1.sql
-- Adds one structured Research Brief result field and one active task template.

ALTER TABLE agent_work_runs
  ADD COLUMN research_brief_result_json TEXT;

INSERT OR IGNORE INTO tasks (
  id, project_id, code, name, description, task_type,
  energy_cost, base_pending_points, requires_wallet, auto_executable,
  requires_user_confirmation, risk_level, status, metadata_json
) VALUES (
  'task_research_brief_v1',
  NULL,
  'research_brief_v1',
  'Research Brief',
  'Produce a verified project research brief with sources, facts, judgments, risks, and actions.',
  'research_brief',
  25,
  100,
  0,
  1,
  1,
  'low',
  'active',
  '{"runtime":true,"version":1}'
);
