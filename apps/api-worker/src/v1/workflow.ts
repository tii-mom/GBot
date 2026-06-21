import { Hono, Context } from "hono";
import { 
  Bindings, 
  requireUser, 
  id, 
  ledger, 
  getAgent, 
  toAgent, 
  logActivity, 
  toWorkRun, 
  toWorkStep, 
  toActivityEvent, 
  parseJson,
  DbAgent,
  DbWorkRun,
  DbWorkStep,
  DbActivityEvent
} from "./core";
import { 
  WorkRunStatus, 
  WorkStepType, 
  WorkStepStatus, 
  WorkRun, 
  WorkStep, 
  ActivityEvent, 
  TaskPlan 
} from "@growthbot/shared";

type AppContext = Context<{ Bindings: Bindings }>;

export const WORK_STEP_TEMPLATES = [
  { stepType: "analyze" as WorkStepType, title: "Analyze task requirements", description: "Read the task instructions and payload structure to understand constraints.", requiresApproval: false, toolName: "task_scanner" },
  { stepType: "qualify" as WorkStepType, title: "Check qualification", description: "Verify the Agent meets the task requirements and is not risk-restricted.", requiresApproval: false, toolName: "task_scanner" },
  { stepType: "plan" as WorkStepType, title: "Generate execution plan", description: "Break the task into ordered steps with estimated cost, reward and duration.", requiresApproval: false, toolName: "task_planner" },
  { stepType: "prepare_output" as WorkStepType, title: "Prepare output", description: "Draft the content / research summary / submission body.", requiresApproval: false, toolName: "basic_writer" },
  { stepType: "wait_user_confirm" as WorkStepType, title: "Wait for user confirmation", description: "Pause for the user to review and approve the prepared output before submission.", requiresApproval: true, toolName: null },
  { stepType: "submit" as WorkStepType, title: "Submit", description: "Package the proof and submission summary and record the submission.", requiresApproval: false, toolName: "submission_assistant" },
  { stepType: "verify" as WorkStepType, title: "Verify", description: "Run the verification rule and confirm the submission passes.", requiresApproval: false, toolName: "submission_assistant" },
  { stepType: "settle" as WorkStepType, title: "Settle reward", description: "Apply energy cost and grant reward exactly once.", requiresApproval: false, toolName: null }
];

export const WORK_RUN_TRANSITIONS: Record<WorkRunStatus, WorkRunStatus[]> = {
  discovered: ["analyzing", "paused", "cancelled"],
  analyzing: ["qualified", "rejected", "paused", "cancelled", "planning"],
  qualified: ["planning", "paused", "cancelled"],
  planning: ["waiting_user", "queued", "paused", "cancelled", "executing"],
  waiting_user: ["executing", "paused", "cancelled"],
  queued: ["executing", "paused", "cancelled"],
  executing: ["waiting_signature", "submitting", "failed", "paused", "cancelled", "waiting_user"],
  waiting_signature: ["submitting", "paused", "cancelled"],
  submitting: ["verifying", "failed", "paused", "cancelled"],
  verifying: ["settling", "completed", "failed", "disputed", "paused", "cancelled"],
  settling: ["completed", "failed"],
  rejected: [],
  disputed: ["completed", "failed", "cancelled"],
  paused: ["analyzing", "planning", "waiting_user", "queued", "executing", "waiting_signature", "submitting", "verifying", "settling", "cancelled"],
  completed: [],
  failed: [],
  cancelled: []
};

// Safe state transition
async function transitionWorkRun(
  db: D1Database,
  run: DbWorkRun,
  nextStatus: WorkRunStatus,
  failedReason: string | null = null
): Promise<void> {
  const allowed = WORK_RUN_TRANSITIONS[run.status as WorkRunStatus] || [];
  if (run.status !== nextStatus && !allowed.includes(nextStatus)) {
    throw new Error(`Invalid state transition from ${run.status} to ${nextStatus}`);
  }

  const failedReasonToSave = failedReason || run.failed_reason;
  await db.prepare(
    "UPDATE agent_work_runs SET status = ?, failed_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(nextStatus, failedReasonToSave, run.id).run();
}

// Check and reset daily limit using UTC
async function checkAndResetDailyLimit(db: D1Database, agent: DbAgent): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
  if (agent.daily_run_date !== today) {
    await db.prepare(
      "UPDATE agents SET daily_run_count = 0, daily_run_date = ? WHERE id = ?"
    ).bind(today, agent.id).run();
    agent.daily_run_count = 0;
    agent.daily_run_date = today;
  }
}

// Drive steps synchronously
async function driveWorkflow(db: D1Database, runId: string, userId: string): Promise<DbWorkRun> {
  let run = await db.prepare("SELECT * FROM agent_work_runs WHERE id = ?").bind(runId).first<DbWorkRun>();
  if (!run) throw new Error("Work run not found");

  if (run.status === "completed" || run.status === "failed" || run.status === "cancelled" || run.status === "paused") {
    return run;
  }

  const steps = await db.prepare(
    "SELECT * FROM agent_work_steps WHERE run_id = ? ORDER BY step_order ASC"
  ).bind(runId).all<DbWorkStep>();

  const user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<any>();
  if (!user) throw new Error("User not found");

  const agent = await db.prepare("SELECT * FROM agents WHERE id = ?").bind(run.agent_id).first<DbAgent>();
  if (!agent) throw new Error("Agent not found");

  for (const step of steps.results) {
    if (step.status === "completed" || step.status === "skipped") {
      continue;
    }

    // Determine target run status based on step type
    let targetStatus: WorkRunStatus = "executing";
    if (step.step_type === "analyze") targetStatus = "analyzing";
    else if (step.step_type === "qualify") targetStatus = "analyzing";
    else if (step.step_type === "plan") targetStatus = "planning";
    else if (step.step_type === "wait_user_confirm") targetStatus = "waiting_user";
    else if (step.step_type === "submit") targetStatus = "submitting";
    else if (step.step_type === "verify") targetStatus = "verifying";

    if (run.status !== targetStatus && run.status !== "settling") {
      await transitionWorkRun(db, run, targetStatus);
      run.status = targetStatus;
    }

    if (step.requires_approval === 1 && step.status !== "waiting_approval") {
      // Pause execution for approval
      await db.prepare(
        "UPDATE agent_work_steps SET status = 'waiting_approval', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(step.id).run();
      await db.prepare(
        "UPDATE agent_work_runs SET requires_user_action = 1, current_step = ?, progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(step.step_order, Math.round((step.step_order / run.total_steps) * 100), run.id).run();
      await logActivity(db, run.agent_id, run.id, "wait_confirm", step.title, "Waiting for user verification to continue.", null);
      
      run = await db.prepare("SELECT * FROM agent_work_runs WHERE id = ?").bind(runId).first<DbWorkRun>();
      return run!;
    }

    if (step.status === "waiting_approval") {
      // Must wait for user to call approve-step
      return run;
    }

    // Execute step
    await db.prepare(
      "UPDATE agent_work_steps SET status = 'in_progress', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(step.id).run();
    await logActivity(db, run.agent_id, run.id, "step_start", step.title, step.description, null);

    // Mock processing outcome
    if (step.step_type === "qualify") {
      if (user.risk_status === "restricted") {
        const errorMsg = "账户受限，反女巫验证未通过。";
        await db.prepare(
          "UPDATE agent_work_steps SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(errorMsg, step.id).run();
        await transitionWorkRun(db, run, "failed", errorMsg);
        await logActivity(db, run.agent_id, run.id, "step_failed", step.title, `Qualification failed: ${errorMsg}`, null);
        run.status = "failed";
        return run;
      }
    }

    // Normal execution completion
    let outputSummary: string | null = null;
    if (step.step_type === "analyze") outputSummary = "Task payload scanned. Requirements mapped.";
    else if (step.step_type === "qualify") outputSummary = "Agent is eligible. Safe risk rating.";
    else if (step.step_type === "plan") outputSummary = JSON.stringify({ stepsLeft: 5, estEnergy: run.estimated_energy });
    else if (step.step_type === "prepare_output") outputSummary = "Draft: Task completed successfully under observing mode.";
    else if (step.step_type === "submit") outputSummary = "Execution Mode: simulation. Proof: null. Reward: Test Points Only.";
    else if (step.step_type === "verify") outputSummary = "Verification check passed. Ready to settle.";

    if (step.step_type === "settle") {
      // Check work_run_settlements status for idempotency
      const existingSettlement = await db.prepare("SELECT * FROM work_run_settlements WHERE run_id = ?").bind(run.id).first<any>();
      if (existingSettlement && existingSettlement.status === "completed") {
        await db.prepare(
          "UPDATE agent_work_runs SET status = 'completed', progress = 100, settled = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(run.id).run();
        run.status = "completed";
        return run;
      }

      if (!existingSettlement) {
        await db.prepare("INSERT OR IGNORE INTO work_run_settlements (run_id, status) VALUES (?, 'pending')").bind(run.id).run();
      }

      await transitionWorkRun(db, run, "settling");
      run.status = "settling";

      const ledgerId = id("ledger");

      try {
        const settleBatch = [
          db.prepare(
            "UPDATE agent_work_runs SET settled = 1, settled_at = CURRENT_TIMESTAMP, settlement_ledger_id = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP, progress = 100, actual_reward = ?, actual_energy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND settled = 0"
          ).bind(ledgerId, run.estimated_reward, run.estimated_energy, run.id),

          ledger(db, run.user_id, run.agent_id, "task_reward", "pending_points", run.estimated_reward, null, run.id, { runId: run.id }),

          db.prepare(
            "UPDATE agents SET energy = MAX(0, energy - ?), daily_run_count = daily_run_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(run.estimated_energy, run.agent_id),

          db.prepare(
            "UPDATE agent_work_steps SET status = 'completed', completed_at = CURRENT_TIMESTAMP, output_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind("Reward settled. GP granted.", step.id),

          db.prepare(
            "UPDATE work_run_settlements SET status = 'completed', reward_applied = 1, energy_applied = 1, updated_at = CURRENT_TIMESTAMP WHERE run_id = ?"
          ).bind(run.id)
        ];

        await db.batch(settleBatch);

        await logActivity(db, run.agent_id, run.id, "settle_success", step.title, `Settled +${run.estimated_reward} GP. Energy spent: ${run.estimated_energy}.`, null);
        
        run.status = "completed";
        return run;

      } catch (err: any) {
        await db.prepare("UPDATE work_run_settlements SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE run_id = ?").bind(run.id).run();
        await transitionWorkRun(db, run, "failed", err.message || "Settlement failed");
        run.status = "failed";
        throw err;
      }
    }

    await db.prepare(
      "UPDATE agent_work_steps SET status = 'completed', completed_at = CURRENT_TIMESTAMP, output_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(outputSummary, step.id).run();
    await logActivity(db, run.agent_id, run.id, "step_success", step.title, `Completed: ${outputSummary}`, null);
  }

  return run;
}

export function registerV1Workflow(app: Hono<{ Bindings: Bindings }>) {
  // 1. Plan task
  app.post("/tasks/:taskId/plan", async (c) => {
    const user = await requireUser(c);
    const taskId = c.req.param("taskId");

    let task = await c.env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(taskId).first<any>();
    let taskKind: "basic" | "bounty" = "basic";
    if (!task) {
      task = await c.env.DB.prepare("SELECT * FROM bounty_tasks WHERE id = ?").bind(taskId).first<any>();
      taskKind = "bounty";
    }

    if (!task) {
      return c.json({ error: "task_not_found", message: "Task not found" }, 404);
    }

    const agent = await getAgent(c.env.DB, user.id);
    let qualified = true;
    let rejectionReason: string | null = null;

    if (user.risk_status === "restricted") {
      qualified = false;
      rejectionReason = "User account restricted";
    }

    const plan: TaskPlan = {
      taskId: task.id,
      taskName: task.name || task.title || "Unnamed Task",
      taskKind,
      qualified,
      rejectionReason,
      riskLevel: task.risk_level || "low",
      estimatedReward: task.reward_points || task.base_pending_points || 100,
      estimatedEnergy: task.energy_cost || 25,
      estimatedDurationSeconds: 120,
      requiresUserAction: true,
      requiresWallet: !!(task.requires_wallet || task.requiresWallet),
      steps: WORK_STEP_TEMPLATES.map((tmpl) => ({
        stepType: tmpl.stepType,
        title: tmpl.title,
        description: tmpl.description,
        requiresApproval: tmpl.requiresApproval,
        toolName: tmpl.toolName
      }))
    };

    return c.json(plan);
  });

  // 2. Run task
  app.post("/tasks/:taskId/run", async (c) => {
    const user = await requireUser(c);
    const taskId = c.req.param("taskId");
    const body = await c.req.json().catch(() => ({}));
    
    const idempotencyKey = body.idempotencyKey || `${user.id}:${taskId}`;

    // 1. Check idempotency
    const existingRun = await c.env.DB.prepare(
      "SELECT * FROM agent_work_runs WHERE user_id = ? AND idempotency_key = ?"
    ).bind(user.id, idempotencyKey).first<DbWorkRun>();

    if (existingRun) {
      const mappedRun = toWorkRun(existingRun);
      return c.json({ run: mappedRun });
    }

    // 2. Check active agent
    const agent = await getAgent(c.env.DB, user.id);
    if (!agent) {
      return c.json({ error: "no_active_agent", message: "No active agent found for user" }, 400);
    }

    // 3. Check daily limits
    await checkAndResetDailyLimit(c.env.DB, agent);
    if ((agent.daily_run_count ?? 0) >= (agent.daily_run_limit ?? 0)) {
      return c.json({ error: "daily_run_limit_exceeded", message: "Agent has reached its daily limit" }, 400);
    }

    let task = await c.env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(taskId).first<any>();
    let taskKind: "basic" | "bounty" = "basic";
    if (!task) {
      task = await c.env.DB.prepare("SELECT * FROM bounty_tasks WHERE id = ?").bind(taskId).first<any>();
      taskKind = "bounty";
    }

    if (!task) {
      return c.json({ error: "task_not_found", message: "Task not found" }, 404);
    }

    // 5. Energy check
    const estEnergy = task.energy_cost || 25;
    if (agent.energy < estEnergy) {
      return c.json({ error: "not_enough_energy", message: "Not enough energy to execute this task" }, 400);
    }

    const runId = id("run");
    const estReward = task.reward_points || task.base_pending_points || 100;
    const riskLevel = task.risk_level || "low";

    // 6. Create run and steps inside batch
    const runStatements = [
      c.env.DB.prepare(
        `INSERT INTO agent_work_runs (id, agent_id, user_id, task_id, task_kind, status, current_step, total_steps, progress, estimated_reward, estimated_energy, risk_level, requires_user_action, idempotency_key)
         VALUES (?, ?, ?, ?, ?, 'discovered', 1, ?, 0, ?, ?, ?, 0, ?)`
      ).bind(runId, agent.id, user.id, task.id, taskKind, WORK_STEP_TEMPLATES.length, estReward, estEnergy, riskLevel, idempotencyKey),
      
      ...WORK_STEP_TEMPLATES.map((tmpl, index) =>
        c.env.DB.prepare(
          `INSERT INTO agent_work_steps (id, run_id, step_order, step_type, title, description, status, requires_approval, tool_name)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
        ).bind(id("step"), runId, index + 1, tmpl.stepType, tmpl.title, tmpl.description, tmpl.requiresApproval ? 1 : 0, tmpl.toolName)
      ),

      c.env.DB.prepare("UPDATE agents SET status = 'working', active_work_run_id = ? WHERE id = ?").bind(runId, agent.id)
    ];

    await c.env.DB.batch(runStatements);
    await logActivity(c.env.DB, agent.id, runId, "run_created", `Started task: ${task.name || task.title}`, `Execution plan generated with ${WORK_STEP_TEMPLATES.length} steps.`, null);

    // 7. Drive the workflow steps
    const finalRun = await driveWorkflow(c.env.DB, runId, user.id);
    return c.json({ run: toWorkRun(finalRun) });
  });

  // 3. List work runs
  app.get("/agents/:agentId/work-runs", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");

    // Validate ownership
    const agent = await c.env.DB.prepare("SELECT user_id FROM agents WHERE id = ?").bind(agentId).first<any>();
    if (!agent || agent.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "You do not own this agent" }, 403);
    }

    const status = c.req.query("status");
    let query = "SELECT * FROM agent_work_runs WHERE agent_id = ? ";
    const params: any[] = [agentId];

    if (status) {
      query += "AND status = ? ";
      params.push(status);
    }
    query += "ORDER BY created_at DESC LIMIT 50";

    const rows = await c.env.DB.prepare(query).bind(...params).all<DbWorkRun>();
    return c.json({ workRuns: rows.results.map(toWorkRun) });
  });

  // 4. Get active run
  app.get("/agents/:agentId/work-runs/active", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");

    const agent = await c.env.DB.prepare("SELECT user_id, active_work_run_id FROM agents WHERE id = ?").bind(agentId).first<any>();
    if (!agent || agent.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "You do not own this agent" }, 403);
    }

    if (!agent.active_work_run_id) {
      return c.json({ run: null });
    }

    const run = await c.env.DB.prepare("SELECT * FROM agent_work_runs WHERE id = ?").bind(agent.active_work_run_id).first<DbWorkRun>();
    if (!run || run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
      return c.json({ run: null });
    }

    return c.json({ run: toWorkRun(run) });
  });

  // 5. Run details
  app.get("/work-runs/:runId", async (c) => {
    const user = await requireUser(c);
    const runId = c.req.param("runId");

    const run = await c.env.DB.prepare("SELECT * FROM agent_work_runs WHERE id = ?").bind(runId).first<DbWorkRun>();
    if (!run) {
      return c.json({ error: "not_found", message: "Work run not found" }, 404);
    }

    if (run.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "You do not own this work run" }, 403);
    }

    return c.json({ run: toWorkRun(run) });
  });

  // 6. Run steps
  app.get("/work-runs/:runId/steps", async (c) => {
    const user = await requireUser(c);
    const runId = c.req.param("runId");

    const run = await c.env.DB.prepare("SELECT user_id FROM agent_work_runs WHERE id = ?").bind(runId).first<any>();
    if (!run) {
      return c.json({ error: "not_found", message: "Work run not found" }, 404);
    }
    if (run.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "You do not own this work run" }, 403);
    }

    const steps = await c.env.DB.prepare("SELECT * FROM agent_work_steps WHERE run_id = ? ORDER BY step_order ASC").bind(runId).all<DbWorkStep>();
    return c.json({ steps: steps.results.map(toWorkStep) });
  });

  // 7. Run events
  app.get("/work-runs/:runId/events", async (c) => {
    const user = await requireUser(c);
    const runId = c.req.param("runId");

    const run = await c.env.DB.prepare("SELECT user_id FROM agent_work_runs WHERE id = ?").bind(runId).first<any>();
    if (!run) {
      return c.json({ error: "not_found", message: "Work run not found" }, 404);
    }
    if (run.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "You do not own this work run" }, 403);
    }

    const events = await c.env.DB.prepare("SELECT * FROM agent_activity_events WHERE run_id = ? ORDER BY created_at ASC").bind(runId).all<DbActivityEvent>();
    return c.json({ events: events.results.map(toActivityEvent) });
  });

  // 8. Approve step
  app.post("/work-runs/:runId/approve-step", async (c) => {
    const user = await requireUser(c);
    const runId = c.req.param("runId");

    const run = await c.env.DB.prepare("SELECT * FROM agent_work_runs WHERE id = ?").bind(runId).first<DbWorkRun>();
    if (!run) {
      return c.json({ error: "not_found", message: "Work run not found" }, 404);
    }
    if (run.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }

    if (run.status !== "waiting_user") {
      return c.json({ error: "invalid_state", message: "Work run is not waiting for user approval" }, 400);
    }

    // Complete the wait_user_confirm step
    const currentStepRow = await c.env.DB.prepare(
      "SELECT * FROM agent_work_steps WHERE run_id = ? AND status = 'waiting_approval' ORDER BY step_order ASC"
    ).bind(runId).first<DbWorkStep>();

    if (currentStepRow) {
      await c.env.DB.prepare(
        "UPDATE agent_work_steps SET status = 'completed', approved_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(currentStepRow.id).run();
      await logActivity(c.env.DB, run.agent_id, run.id, "user_approve", currentStepRow.title, "User approved step execution.", null);
    }

    // Set requires_user_action = 0 and transition back to executing
    await c.env.DB.prepare(
      "UPDATE agent_work_runs SET requires_user_action = 0, status = 'executing', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(runId).run();
    run.status = "executing";

    const updated = await driveWorkflow(c.env.DB, runId, user.id);
    return c.json({ run: toWorkRun(updated) });
  });

  // 9. Pause
  app.post("/work-runs/:runId/pause", async (c) => {
    const user = await requireUser(c);
    const runId = c.req.param("runId");

    const run = await c.env.DB.prepare("SELECT * FROM agent_work_runs WHERE id = ?").bind(runId).first<DbWorkRun>();
    if (!run) {
      return c.json({ error: "not_found", message: "Work run not found" }, 404);
    }
    if (run.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }

    const terminalStates = ["completed", "failed", "cancelled", "paused"];
    if (terminalStates.includes(run.status)) {
      return c.json({ error: "invalid_state", message: `Cannot pause from terminal state: ${run.status}` }, 400);
    }

    const pausedFromStr = `PAUSED_FROM:${run.status}`;
    await transitionWorkRun(c.env.DB, run, "paused", pausedFromStr);
    
    await c.env.DB.prepare("UPDATE agents SET status = 'idle' WHERE id = ?").bind(run.agent_id).run();
    await logActivity(c.env.DB, run.agent_id, run.id, "run_paused", "Workflow paused", `Execution suspended. Paused from state: ${run.status}`, null);

    const updated = await c.env.DB.prepare("SELECT * FROM agent_work_runs WHERE id = ?").bind(runId).first<DbWorkRun>();
    return c.json({ run: toWorkRun(updated!) });
  });

  // 10. Resume
  app.post("/work-runs/:runId/resume", async (c) => {
    const user = await requireUser(c);
    const runId = c.req.param("runId");

    const run = await c.env.DB.prepare("SELECT * FROM agent_work_runs WHERE id = ?").bind(runId).first<DbWorkRun>();
    if (!run) {
      return c.json({ error: "not_found", message: "Work run not found" }, 404);
    }
    if (run.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }

    if (run.status !== "paused") {
      return c.json({ error: "invalid_state", message: "Work run is not paused" }, 400);
    }

    let recoveryState: WorkRunStatus = "queued";
    if (run.failed_reason && run.failed_reason.startsWith("PAUSED_FROM:")) {
      recoveryState = run.failed_reason.replace("PAUSED_FROM:", "") as WorkRunStatus;
    } else {
      const steps = await c.env.DB.prepare("SELECT status FROM agent_work_steps WHERE run_id = ?").bind(runId).all<any>();
      if (steps.results.some((s) => s.status === "waiting_approval")) {
        recoveryState = "waiting_user";
      } else if (steps.results.some((s) => s.status === "in_progress")) {
        recoveryState = "executing";
      }
    }

    await c.env.DB.prepare(
      "UPDATE agent_work_runs SET status = ?, failed_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(recoveryState, run.id).run();
    run.status = recoveryState;

    await c.env.DB.prepare("UPDATE agents SET status = 'working' WHERE id = ?").bind(run.agent_id).run();
    await logActivity(c.env.DB, run.agent_id, run.id, "run_resumed", "Workflow resumed", `Execution resumed back to: ${recoveryState}`, null);

    const updated = await driveWorkflow(c.env.DB, runId, user.id);
    return c.json({ run: toWorkRun(updated) });
  });

  // 11. Cancel
  app.post("/work-runs/:runId/cancel", async (c) => {
    const user = await requireUser(c);
    const runId = c.req.param("runId");

    const run = await c.env.DB.prepare("SELECT * FROM agent_work_runs WHERE id = ?").bind(runId).first<DbWorkRun>();
    if (!run) {
      return c.json({ error: "not_found", message: "Work run not found" }, 404);
    }
    if (run.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }

    const terminalStates = ["completed", "failed", "cancelled"];
    if (terminalStates.includes(run.status)) {
      return c.json({ error: "invalid_state", message: `Cannot cancel from terminal state: ${run.status}` }, 400);
    }

    await transitionWorkRun(c.env.DB, run, "cancelled");
    await c.env.DB.prepare("UPDATE agents SET status = 'idle', active_work_run_id = NULL WHERE id = ?").bind(run.agent_id).run();
    await logActivity(c.env.DB, run.agent_id, run.id, "run_cancelled", "Workflow cancelled", "Execution cancelled by user.", null);

    const updated = await c.env.DB.prepare("SELECT * FROM agent_work_runs WHERE id = ?").bind(runId).first<DbWorkRun>();
    return c.json({ run: toWorkRun(updated!) });
  });

  // 12. Retry step
  app.post("/work-runs/:runId/retry-step", async (c) => {
    const user = await requireUser(c);
    const runId = c.req.param("runId");

    const run = await c.env.DB.prepare("SELECT * FROM agent_work_runs WHERE id = ?").bind(runId).first<DbWorkRun>();
    if (!run) {
      return c.json({ error: "not_found", message: "Work run not found" }, 404);
    }
    if (run.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }

    if (run.status !== "failed") {
      return c.json({ error: "invalid_state", message: "Work run is not in failed state" }, 400);
    }

    // Find the failed step
    const failedStep = await c.env.DB.prepare(
      "SELECT * FROM agent_work_steps WHERE run_id = ? AND status = 'failed' ORDER BY step_order ASC"
    ).bind(runId).first<DbWorkStep>();

    if (!failedStep) {
      return c.json({ error: "no_failed_step", message: "No failed step found to retry" }, 400);
    }

    // Reset step status
    await c.env.DB.prepare(
      "UPDATE agent_work_steps SET status = 'pending', error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(failedStep.id).run();

    // Reset work run state
    await c.env.DB.prepare(
      "UPDATE agent_work_runs SET status = 'executing', failed_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(runId).run();
    run.status = "executing";

    await c.env.DB.prepare("UPDATE agents SET status = 'working' WHERE id = ?").bind(run.agent_id).run();
    await logActivity(c.env.DB, run.agent_id, run.id, "retry_step", `Retrying: ${failedStep.title}`, `User initiated retry for step order ${failedStep.step_order}.`, null);

    const updated = await driveWorkflow(c.env.DB, runId, user.id);
    return c.json({ run: toWorkRun(updated) });
  });
}
