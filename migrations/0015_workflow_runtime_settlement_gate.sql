-- 0015_workflow_runtime_settlement_gate.sql
-- Workflow runtime settlement gate schema.
-- Adds an execution-mode guard to work runs and an audit relation from
-- workflow steps to skill runtime executions. Settlement policy/business
-- logic is intentionally left to application code in a later PR.

ALTER TABLE agent_work_runs
  ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'simulated'
  CHECK (execution_mode IN ('simulated', 'runtime', 'external'));

CREATE TABLE IF NOT EXISTS work_step_runtime_executions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  runtime_execution_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('plan', 'produce', 'verify', 'recover')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES agent_work_runs(id),
  FOREIGN KEY (step_id) REFERENCES agent_work_steps(id),
  FOREIGN KEY (runtime_execution_id) REFERENCES skill_runtime_executions(id),
  UNIQUE(step_id, runtime_execution_id),
  UNIQUE(runtime_execution_id)
);

CREATE INDEX IF NOT EXISTS idx_work_step_runtime_executions_run
  ON work_step_runtime_executions(run_id);

CREATE INDEX IF NOT EXISTS idx_work_step_runtime_executions_step
  ON work_step_runtime_executions(step_id);

CREATE INDEX IF NOT EXISTS idx_work_step_runtime_executions_runtime
  ON work_step_runtime_executions(runtime_execution_id);
