import { Hono, Context } from "hono";
import { 
  Bindings, 
  requireUser, 
  requireTestMode,
  isTestRuntimeAuthorized,
  id, 
  ledger, 
  getAgent, 
  toAgent, 
  logActivity, 
  toWorkRun, 
  toWorkStep, 
  toActivityEvent, 
  parseJson,
  defaultAgentWalletPolicy,
  legacyPendingPointsBalance,
  legacyPendingPointsLedger,
  legacyPendingPointsLedgerRowsBySource,
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
  TaskPlan,
  AgentSkillCapability,
  RealAssetEvidence,
  WorkReport,
} from "@growthbot/shared";
import { resolveAgentSkillEffects } from "./skill-effects";
import { executeSkillRuntimeTask, resolveSkillsForTask, sha256 } from "./skill-runtime";
import { createAiModelTokenPurchaseIntentDraft, createOnchainIntentDraft, createTransactionEventDraft, workReportEvidenceDraft } from "./intent-service";

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
  executing: ["analyzing", "planning", "waiting_user", "waiting_signature", "submitting", "verifying", "settling", "failed", "paused", "cancelled"],
  waiting_signature: ["submitting", "paused", "cancelled"],
  submitting: ["verifying", "failed", "paused", "cancelled"],
  verifying: ["settling", "completed", "failed", "disputed", "paused", "cancelled"],
  settling: ["completed", "failed"],
  rejected: [],
  disputed: ["completed", "failed", "cancelled"],
  paused: ["analyzing", "planning", "waiting_user", "queued", "executing", "waiting_signature", "submitting", "verifying", "settling", "cancelled"],
  completed: [],
  failed: ["executing", "settling"],
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

// Legacy compatibility-only: runtime settlement still writes/reads pending_points
// through helper functions while Work Report migrates to real-asset intent,
// transaction, and AI Credit evidence in later PRs.
type RuntimeSettlementGate = {
  eligible: boolean;
  reward: number;
  ledgerRequired: boolean;
  reason: string | null;
};

function getExecutionMode(run: DbWorkRun): "simulated" | "runtime" | "external" {
  return ((run as any).execution_mode || "simulated") as "simulated" | "runtime" | "external";
}

async function resolveSettlementGate(db: D1Database, run: DbWorkRun): Promise<RuntimeSettlementGate> {
  const executionMode = getExecutionMode(run);

  if (executionMode === "simulated") {
    return { eligible: false, reward: 0, ledgerRequired: false, reason: "simulated_work_run" };
  }

  if (executionMode !== "runtime") {
    return { eligible: false, reward: 0, ledgerRequired: false, reason: "unsupported_execution_mode" };
  }

  const verifyStep = await db.prepare(`
    SELECT id, status, output_summary
    FROM agent_work_steps
    WHERE run_id = ? AND step_type = 'verify'
    ORDER BY step_order DESC
    LIMIT 1
  `).bind(run.id).first<any>();

  if (!verifyStep || verifyStep.status !== "completed") {
    return { eligible: false, reward: 0, ledgerRequired: false, reason: "verification_not_completed" };
  }

  const verificationOutput = String(verifyStep.output_summary || "").toLowerCase();
  if (!verificationOutput.includes("passed")) {
    return { eligible: false, reward: 0, ledgerRequired: false, reason: "verification_not_passed" };
  }

  const runtimeLinks = await db.prepare(`
    SELECT e.id, e.status, e.agent_id, e.user_id
    FROM work_step_runtime_executions wre
    JOIN skill_runtime_executions e ON e.id = wre.runtime_execution_id
    WHERE wre.run_id = ?
  `).bind(run.id).all<any>();

  if (runtimeLinks.results.length === 0) {
    return { eligible: false, reward: 0, ledgerRequired: false, reason: "runtime_execution_required" };
  }

  const completedOwned = runtimeLinks.results.filter((runtimeExecution: any) =>
    runtimeExecution.status === "completed"
    && runtimeExecution.agent_id === run.agent_id
    && runtimeExecution.user_id === run.user_id
  );

  if (completedOwned.length === 0) {
    const hasWrongOwner = runtimeLinks.results.some((runtimeExecution: any) => runtimeExecution.agent_id !== run.agent_id || runtimeExecution.user_id !== run.user_id);
    const hasNonCompleted = runtimeLinks.results.some((runtimeExecution: any) => runtimeExecution.status !== "completed");
    return {
      eligible: false,
      reward: 0,
      ledgerRequired: false,
      reason: hasWrongOwner ? "runtime_execution_owner_mismatch" : (hasNonCompleted ? "runtime_execution_not_completed" : "runtime_execution_required")
    };
  }

  return { eligible: true, reward: run.estimated_reward, ledgerRequired: true, reason: null };
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

function validateResearchBrief(brief: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const textFields = [
    "summary", "core_product", "target_users", "business_model",
    "team_background", "competition", "risks"
  ];
  for (const field of textFields) {
    if (typeof brief[field] !== "string" || brief[field].trim().length === 0) {
      errors.push(field);
    }
  }

  if (!Array.isArray(brief.sources) || brief.sources.length === 0) {
    errors.push("sources");
  } else {
    for (const source of brief.sources) {
      if (typeof source !== "string") {
        errors.push("sources");
        break;
      }
      try {
        const url = new URL(source);
        if (url.protocol !== "http:" && url.protocol !== "https:") errors.push("sources");
      } catch {
        errors.push("sources");
      }
    }
  }

  if (!Array.isArray(brief.fact_vs_judgment) || brief.fact_vs_judgment.length === 0) {
    errors.push("fact_vs_judgment");
  } else {
    const invalid = brief.fact_vs_judgment.some((item) => {
      if (!item || typeof item !== "object") return true;
      const record = item as Record<string, unknown>;
      return typeof record.statement !== "string"
        || record.statement.trim().length === 0
        || (record.type !== "fact" && record.type !== "judgment");
    });
    if (invalid) errors.push("fact_vs_judgment");
  }

  if (!Array.isArray(brief.recommendations)
    || brief.recommendations.length === 0
    || brief.recommendations.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    errors.push("recommendations");
  }
  return [...new Set(errors)];
}

// Drive steps synchronously
async function driveWorkflow(
  db: D1Database,
  runId: string,
  userId: string,
  options?: { failSettle?: boolean; env?: Bindings; testMode?: boolean }
): Promise<DbWorkRun> {
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

  // PR #5 — Load skill capability context
  const capability = await resolveAgentSkillEffects(db, run.agent_id).catch(() => null);
  const capContext = capability ? `researchDepth:${capability.researchDepth},sourceLimit:${capability.sourceLimit},verificationLevel:${capability.verificationLevel},riskChecks:${(capability.riskChecks || []).join(",")}` : "default";

  // Resolve task type for research_brief detection
  const runTask = await db.prepare("SELECT * FROM tasks WHERE id = ?").bind(run.task_id).first<any>();
  const runTaskType = runTask ? getTaskType(runTask) : "task_planning";

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
    else if (step.step_type === "settle") targetStatus = "settling";

    if (run.status !== targetStatus && (run.status !== "settling" || targetStatus === "settling")) {
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
        await db.prepare("UPDATE agents SET status = 'idle', active_work_run_id = NULL WHERE id = ?").bind(run.agent_id).run();
        return run;
      }
    }

    // Normal execution completion
    let outputSummary: string | null = null;
    if (step.step_type === "analyze") outputSummary = `Task scanned. Capability: ${capContext}`;
    else if (step.step_type === "qualify") outputSummary = `Agent eligible. Capability: ${capContext}`;
    else if (step.step_type === "plan") outputSummary = JSON.stringify({ stepsLeft: 5, estEnergy: run.estimated_energy, ...(capability ? { researchDepth: capability.researchDepth, sourceLimit: capability.sourceLimit } : {}) });
    else if (step.step_type === "prepare_output") {
      outputSummary = `Draft prepared. Skill capability: ${capContext}`;
      if (runTaskType === "research_brief" && getExecutionMode(run) === "runtime") {
        if (!options?.env) throw new Error("runtime_environment_missing");
        const runtimeInput = parseJson<Record<string, unknown>>(step.input_summary, {
          taskId: run.task_id,
          runId: run.id,
        });
        const recovered = await db.prepare(`
          SELECT child.id, child.result_json
          FROM work_step_runtime_executions original_link
          JOIN skill_runtime_executions original ON original.id = original_link.runtime_execution_id
          JOIN skill_runtime_executions child ON child.recovery_of_execution_id = original.id
          WHERE original_link.run_id = ?
            AND original_link.step_id = ?
            AND original_link.purpose = 'produce'
            AND original.user_id = ?
            AND original.agent_id = ?
            AND child.user_id = ?
            AND child.agent_id = ?
            AND original.status = 'failed'
            AND child.status = 'completed'
          ORDER BY child.attempt_number DESC LIMIT 1
        `).bind(
          run.id, step.id, run.user_id, run.agent_id, run.user_id, run.agent_id
        ).first<any>();
        const runtime = recovered
          ? {
              executionId: recovered.id,
              status: "completed" as const,
              result: parseJson<Record<string, unknown>>(recovered.result_json, {}),
              errorCode: null,
            }
          : await executeSkillRuntimeTask({
              db,
              env: options.env,
              userId: run.user_id,
              agentId: run.agent_id,
              taskType: "research_brief",
              input: runtimeInput,
              idempotencyKey: `research_brief:produce:${run.id}`,
              testMode: options.testMode,
            });
        await db.prepare(`
          INSERT OR IGNORE INTO work_step_runtime_executions (id, run_id, step_id, runtime_execution_id, purpose)
          VALUES (?, ?, ?, ?, ?)
        `).bind(id("wre"), run.id, step.id, runtime.executionId, recovered ? "recover" : "produce").run();
        if (runtime.status !== "completed" || !runtime.result) {
          const message = `Research Brief runtime failed: ${runtime.errorCode || "unknown"}`;
          await db.prepare(
            "UPDATE agent_work_steps SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(message, step.id).run();
          await transitionWorkRun(db, run, "failed", message);
          run.status = "failed";
          await db.prepare("UPDATE agents SET status = 'idle', active_work_run_id = NULL WHERE id = ?").bind(run.agent_id).run();
          return run;
        }
        await db.prepare(
          "UPDATE agent_work_runs SET research_brief_result_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(JSON.stringify(runtime.result), run.id).run();
        outputSummary = JSON.stringify(runtime.result);
      }
    }
    else if (step.step_type === "submit") outputSummary = "Submission packaged.";
    else if (step.step_type === "verify") {
      outputSummary = capability ? `Verification check passed. Level: ${capability.verificationLevel}. Risk checks: ${(capability.riskChecks || []).join(", ")}` : "Verification check passed.";
      if (runTaskType === "research_brief" && getExecutionMode(run) === "runtime") {
        const resultRow = await db.prepare(
          "SELECT research_brief_result_json FROM agent_work_runs WHERE id = ?"
        ).bind(run.id).first<any>();
        const brief = parseJson<Record<string, unknown>>(resultRow?.research_brief_result_json, {});
        const validationErrors = validateResearchBrief(brief);
        const verificationPassed = validationErrors.length === 0;
        outputSummary = verificationPassed
          ? "Verification check passed. Research Brief schema and evidence fields validated by server."
          : `Verification failed. Missing or invalid fields: ${validationErrors.join(", ")}.`;
        if (!verificationPassed) {
          await db.prepare(
            "UPDATE agent_work_steps SET status = 'failed', output_summary = ?, error_message = 'research_brief_verification_failed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(outputSummary, step.id).run();
          await transitionWorkRun(db, run, "failed", "research_brief_verification_failed");
          run.status = "failed";
          await db.prepare("UPDATE agents SET status = 'idle', active_work_run_id = NULL WHERE id = ?").bind(run.agent_id).run();
          return run;
        }
      }
    }

    if (step.step_type === "settle") {
      // Check work_run_settlements status for idempotency
      const existingSettlement = await db.prepare("SELECT * FROM work_run_settlements WHERE run_id = ?").bind(run.id).first<any>();
      if (existingSettlement && existingSettlement.status === "completed") {
        await db.prepare(
          "UPDATE agent_work_runs SET status = 'completed', progress = 100, settled = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(run.id).run();
        const updatedRun = await db.prepare("SELECT * FROM agent_work_runs WHERE id = ?").bind(run.id).first<DbWorkRun>();
        await db.prepare("UPDATE agents SET status = 'idle', active_work_run_id = NULL WHERE id = ?").bind(run.agent_id).run();
        return updatedRun || run;
      }

      if (!existingSettlement) {
        await db.prepare("INSERT OR IGNORE INTO work_run_settlements (run_id, status) VALUES (?, 'pending')").bind(run.id).run();
      } else if (existingSettlement.status === "failed") {
        await db.prepare("UPDATE work_run_settlements SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE run_id = ?").bind(run.id).run();
      }

      await transitionWorkRun(db, run, "settling");
      run.status = "settling";

      const settlementGate = await resolveSettlementGate(db, run);
      const ledgerId = settlementGate.ledgerRequired ? id("ledger") : null;

      try {
        if (options?.failSettle) {
          throw new Error("Simulated settlement failure (fault injection)");
        }
        if (getExecutionMode(run) === "runtime" && !settlementGate.eligible) {
          throw new Error(`Runtime settlement blocked: ${settlementGate.reason}`);
        }

        const rewardToApply = settlementGate.reward;
        const settlementOutput = settlementGate.eligible
          ? "Reward settled. GP granted."
          : `Simulated run completed. No GP reward granted (${settlementGate.reason}).`;
        const settleBatch = [
          db.prepare(
            "UPDATE agent_work_runs SET settled = 1, settled_at = CURRENT_TIMESTAMP, settlement_ledger_id = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP, progress = 100, actual_reward = ?, actual_energy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND settled = 0"
          ).bind(ledgerId, rewardToApply, run.estimated_energy, run.id),

          db.prepare(
            "UPDATE agents SET energy = MAX(0, energy - ?), daily_run_count = daily_run_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(run.estimated_energy, run.agent_id),

          db.prepare(
            "UPDATE agent_work_steps SET status = 'completed', completed_at = CURRENT_TIMESTAMP, output_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(settlementOutput, step.id),

          db.prepare(
            "UPDATE work_run_settlements SET status = 'completed', reward_applied = ?, energy_applied = 1, updated_at = CURRENT_TIMESTAMP WHERE run_id = ?"
          ).bind(settlementGate.ledgerRequired ? 1 : 0, run.id)
        ];

        if (settlementGate.ledgerRequired && ledgerId) {
          settleBatch.splice(1, 0, legacyPendingPointsLedger(db, run.user_id, run.agent_id, "task_reward", rewardToApply, null, run.id, { runId: run.id }, ledgerId));
        }

        await db.batch(settleBatch);

        await logActivity(db, run.agent_id, run.id, "settle_success", step.title, settlementGate.eligible ? `Settled +${rewardToApply} GP. Energy spent: ${run.estimated_energy}.` : `Simulated settlement completed with no GP reward. Energy spent: ${run.estimated_energy}.`, null);
        
        const updatedRun = await db.prepare("SELECT * FROM agent_work_runs WHERE id = ?").bind(run.id).first<DbWorkRun>();
        await db.prepare("UPDATE agents SET status = 'idle', active_work_run_id = NULL WHERE id = ?").bind(run.agent_id).run();
        return updatedRun || run;

      } catch (err: any) {
        await db.prepare("UPDATE work_run_settlements SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE run_id = ?").bind(run.id).run();
        await db.prepare(
          "UPDATE agent_work_steps SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(err.message || "Settlement failed", step.id).run();
        await transitionWorkRun(db, run, "failed", err.message || "Settlement failed");
        run.status = "failed";
        await db.prepare("UPDATE agents SET status = 'idle', active_work_run_id = NULL WHERE id = ?").bind(run.agent_id).run();
        return run;
      }
    }

    await db.prepare(
      "UPDATE agent_work_steps SET status = 'completed', completed_at = CURRENT_TIMESTAMP, output_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(outputSummary, step.id).run();
    await logActivity(db, run.agent_id, run.id, "step_success", step.title, `Completed: ${outputSummary}`, null);
  }

  return run;
}

function getTaskType(task: any): string {
  if (task.task_type && ["project_research", "research_brief", "risk_review", "structured_content", "task_planning"].includes(task.task_type)) {
    return task.task_type;
  }
  const lowerId = (task.id || "").toLowerCase();
  const lowerName = (task.name || task.title || "").toLowerCase();
  const lowerCode = (task.code || "").toLowerCase();
  
  if (lowerId.includes("research") || lowerName.includes("research") || lowerCode.includes("research") ||
      lowerId.includes("sniper") || lowerName.includes("sniper") || lowerCode.includes("sniper")) {
    return "project_research";
  }
  if (lowerId.includes("risk") || lowerName.includes("risk") || lowerCode.includes("risk") ||
      lowerId.includes("wallet") || lowerName.includes("wallet") || lowerCode.includes("wallet") ||
      lowerId.includes("onchain") || lowerName.includes("onchain") || lowerCode.includes("onchain")) {
    return "risk_review";
  }
  if (lowerId.includes("content") || lowerName.includes("content") || lowerCode.includes("content") ||
      lowerId.includes("writing") || lowerName.includes("writing") || lowerCode.includes("writing") ||
      lowerId.includes("group") || lowerName.includes("group") || lowerCode.includes("group") ||
      lowerId.includes("crew") || lowerName.includes("crew") || lowerCode.includes("crew")) {
    return "structured_content";
  }
  return "task_planning"; // fallback
}

async function getUsedSkillsForRun(db: any, runId: string) {
  try {
    const rows = await db.prepare(`
      SELECT u.skill_definition_id, u.selection_role, u.learned_skill_level, d.name, d.code
      FROM task_skill_runtime_usages u
      JOIN agent_skill_definitions d ON u.skill_definition_id = d.id
      WHERE u.task_execution_id = ?
    `).bind(runId).all();
    return rows.results.map((r: any) => ({
      skillDefinitionId: r.skill_definition_id,
      canonicalCode: r.code,
      name: r.name,
      selectionRole: r.selection_role,
      level: r.learned_skill_level
    }));
  } catch (e) {
    console.error("Failed to query used skills for run", e);
    return [];
  }
}

function evidenceSectionsFrom(entries: RealAssetEvidence[]) {
  const titles: Record<string, string> = {
    policy_decision: "Policy Decision Evidence",
    onchain_intent: "Onchain Intent Evidence",
    transaction_event: "Transaction Event Evidence",
    ai_credit_purchase: "AI Model Token Purchase Evidence",
    ai_credit_usage: "AI Credit Usage Evidence",
    skill_card_capability: "Skill Card Capability Evidence",
    future_transaction_placeholder: "Future Transaction Evidence",
    legacy_settlement_compatibility: "Legacy Settlement Compatibility"
  };
  return entries.map((entry) => ({
    key: entry.type,
    title: titles[entry.type] || entry.title,
    summary: entry.summary,
    entries: [entry]
  }));
}

async function buildRealAssetWorkReport(db: D1Database, run: DbWorkRun, steps: DbWorkStep[]): Promise<WorkReport> {
  const skillCards = (await getUsedSkillsForRun(db, run.id)).map((skill: any) => skill.canonicalCode).filter(Boolean);
  const policy = defaultAgentWalletPolicy(null);
  const onchainIntent = createOnchainIntentDraft({
    userId: run.user_id,
    agentId: run.agent_id,
    walletId: null,
    policy,
    asset: "G",
    amount: Math.max(0, Number(run.estimated_energy || 0) / 10).toFixed(2),
    provider: "simulated-ai-credit-provider",
    purchaseType: "ai_credit",
    purpose: "work_report_real_asset_evidence_simulation"
  });
  const aiPurchaseIntent = createAiModelTokenPurchaseIntentDraft({
    userId: run.user_id,
    agentId: run.agent_id,
    walletId: null,
    policy,
    provider: "simulated-ai-credit-provider",
    modelId: "gbot-simulated-research-model",
    spendAmount: onchainIntent.amount.amount,
    expectedCredits: Math.max(1, Number(run.estimated_energy || 1)).toString()
  });
  const transactionEvent = createTransactionEventDraft({
    intent: onchainIntent,
    status: onchainIntent.status,
    message: "Future transaction placeholder only. No live TON/G transaction was executed."
  });
  const createdAt = run.completed_at || run.updated_at || run.created_at;
  const realAssetEvidence = workReportEvidenceDraft({
    onchainIntent,
    transactionEvent: { ...transactionEvent, txHash: null },
    aiPurchaseIntent,
    skillCards,
    runId: run.id,
    createdAt
  });
  const verificationStep = steps.find((step) => step.step_type === "verify");
  return {
    id: `report_${run.id}`,
    runId: run.id,
    taskId: run.task_id,
    agentId: run.agent_id,
    reportKind: "work_report",
    overallStatus: run.status,
    input: {
      taskId: run.task_id,
      taskKind: run.task_kind,
      executionMode: getExecutionMode(run),
      realAssetEvidenceMode: "simulation_only"
    },
    execution: {
      currentStep: run.current_step,
      totalSteps: run.total_steps,
      progress: run.progress,
      status: run.status,
      steps: steps.map(toWorkStep),
      noLiveChainExecution: true,
      noPrivateKeysRequired: true,
      noMainWalletControl: true
    },
    evidence: realAssetEvidence as unknown as Array<Record<string, unknown>>,
    realAssetEvidence,
    evidenceSections: evidenceSectionsFrom(realAssetEvidence),
    realAssetSummary: {
      mode: "simulated_evidence",
      evidenceFirst: true,
      policyDecisionStatus: onchainIntent.policyDecision?.status ?? "not_evaluated",
      aiCreditUsage: realAssetEvidence.find((entry) => entry.type === "ai_credit_usage")?.amount ?? null,
      skillCardCount: skillCards.length || 3,
      futureLiveTxRequired: true,
      legacySettlementCompatibility: true,
      noGuaranteedOutcome: true
    },
    verification: {
      status: verificationStep?.status === "completed" ? "approved" : (verificationStep?.status as any) || "unknown",
      checkedAt: verificationStep?.completed_at || null,
      notes: verificationStep?.output_summary || null
    },
    settlement: {
      status: run.settled ? "settled" : run.status === "failed" ? "failed" : "pending",
      settledAt: run.settled_at || null,
      rewardPoints: run.actual_reward,
      transactionId: run.settlement_ledger_id || null
    },
    share: {
      allowed: run.status === "completed",
      text: "GrowthBot Real Asset Agent evidence report: policy, AI Credit, Skill Card, and future transaction evidence.",
      blockedReason: run.status === "completed" ? null : "Work Report can be shared after the run reaches a terminal completed state."
    },
    createdAt,
    updatedAt: run.updated_at
  };
}

export function registerV1Workflow(app: Hono<{ Bindings: Bindings }>) {
  app.post("/test/research-brief-runtime-setup", async (c) => {
    const testErr = requireTestMode(c);
    if (testErr) return testErr;
    const user = await requireUser(c);
    const agent = await getAgent(c.env.DB, user.id);
    if (!agent) return c.json({ error: "agent_not_found" }, 404);
    const skillIds = [
      "sd_res_project_research",
      "sd_ver_source_verification",
      "sd_res_information_summary",
      "sd_exp_failure_recovery"
    ];
    let nextSlot = Number((await c.env.DB.prepare(
      "SELECT COALESCE(MAX(slot_index), -1) + 1 AS next_slot FROM agent_learned_skills WHERE agent_id = ? AND status = 'active'"
    ).bind(agent.id).first<any>())?.next_slot || 0);
    for (const skillDefinitionId of skillIds) {
      const existing = await c.env.DB.prepare(
        "SELECT id FROM agent_learned_skills WHERE agent_id = ? AND skill_definition_id = ? AND status = 'active'"
      ).bind(agent.id, skillDefinitionId).first<any>();
      if (!existing) {
        await c.env.DB.prepare(
          "INSERT INTO agent_learned_skills (id, agent_id, skill_definition_id, skill_level, slot_index, status) VALUES (?, ?, ?, 1, ?, 'active')"
        ).bind(id("learned_test"), agent.id, skillDefinitionId, nextSlot++).run();
      }
    }
    await c.env.DB.prepare(
      "UPDATE agents SET energy = 5000, max_energy = CASE WHEN max_energy < 5000 THEN 5000 ELSE max_energy END WHERE id = ?"
    ).bind(agent.id).run();
    return c.json({ success: true, agentId: agent.id, taskId: "task_research_brief_v1" });
  });

  app.get("/test/research-brief-runtime-audit/:runId", async (c) => {
    const testErr = requireTestMode(c);
    if (testErr) return testErr;
    const user = await requireUser(c);
    const runId = c.req.param("runId");
    const run = await c.env.DB.prepare(
      "SELECT * FROM agent_work_runs WHERE id = ? AND user_id = ?"
    ).bind(runId, user.id).first<any>();
    if (!run) return c.json({ error: "run_not_found" }, 404);
    const steps = await c.env.DB.prepare(
      "SELECT * FROM agent_work_steps WHERE run_id = ? ORDER BY step_order"
    ).bind(runId).all<any>();
    const links = await c.env.DB.prepare(`
      SELECT wre.*, e.status AS runtime_status, e.agent_id AS runtime_agent_id,
             e.user_id AS runtime_user_id, e.result_json, e.parent_execution_id,
             e.recovery_of_execution_id, e.attempt_number
      FROM work_step_runtime_executions wre
      JOIN skill_runtime_executions e ON e.id = wre.runtime_execution_id
      WHERE wre.run_id = ? ORDER BY wre.created_at, wre.id
    `).bind(runId).all<any>();
    const settlement = await c.env.DB.prepare(
      "SELECT * FROM work_run_settlements WHERE run_id = ?"
    ).bind(runId).first<any>();
    const rewardLedgers = await legacyPendingPointsLedgerRowsBySource(c.env.DB, user.id, runId, "task_reward");
    const balance = await legacyPendingPointsBalance(c.env.DB, user.id);
    return c.json({
      run,
      steps: steps.results,
      links: links.results,
      settlement: settlement || null,
      rewardLedgers,
      pendingPointsBalance: balance,
    });
  });

  app.post("/test/research-brief-recovery-scope-fixture", async (c) => {
    const testErr = requireTestMode(c);
    if (testErr) return testErr;
    const user = await requireUser(c);
    const body = await c.req.json<any>().catch(() => ({}));
    const runId = String(body.runId || "");
    const scenario = String(body.scenario || "");
    if (!["wrong_user", "wrong_agent", "wrong_run", "wrong_step", "wrong_purpose"].includes(scenario)) {
      return c.json({ error: "invalid_scenario" }, 400);
    }
    const run = await c.env.DB.prepare(
      "SELECT * FROM agent_work_runs WHERE id = ? AND user_id = ?"
    ).bind(runId, user.id).first<any>();
    if (!run || run.status !== "failed") return c.json({ error: "failed_run_not_found" }, 404);
    const produceStep = await c.env.DB.prepare(
      "SELECT * FROM agent_work_steps WHERE run_id = ? AND step_type = 'prepare_output'"
    ).bind(runId).first<any>();
    const verifyStep = await c.env.DB.prepare(
      "SELECT * FROM agent_work_steps WHERE run_id = ? AND step_type = 'verify'"
    ).bind(runId).first<any>();
    const link = await c.env.DB.prepare(`
      SELECT wre.id AS link_id, wre.runtime_execution_id,
             e.status AS execution_status, e.input_json AS original_input_json
      FROM work_step_runtime_executions wre
      JOIN skill_runtime_executions e ON e.id = wre.runtime_execution_id
      WHERE wre.run_id = ? AND wre.step_id = ? AND wre.purpose = 'produce'
    `).bind(runId, produceStep?.id).first<any>();
    if (!produceStep || !verifyStep || !link || link.execution_status !== "failed") {
      return c.json({ error: "failed_produce_link_not_found" }, 404);
    }

    let childUserId = run.user_id;
    let childAgentId = run.agent_id;
    if (scenario === "wrong_user" || scenario === "wrong_agent") {
      const otherUserId = id("user_scope_other");
      const otherAgentId = id("agent_scope_other");
      await c.env.DB.batch([
        c.env.DB.prepare("INSERT INTO users (id, telegram_id, username) VALUES (?, ?, ?)").bind(otherUserId, id("tg_scope"), "scope_fixture"),
        c.env.DB.prepare("INSERT INTO agents (id, user_id, name, status) VALUES (?, ?, 'Scope Fixture Agent', 'idle')").bind(otherAgentId, otherUserId),
      ]);
      if (scenario === "wrong_user") childUserId = otherUserId;
      if (scenario === "wrong_agent") childAgentId = otherAgentId;
    }
    if (scenario === "wrong_run") {
      const otherRunId = id("run_scope_other");
      await c.env.DB.prepare(`
        INSERT INTO agent_work_runs (
          id, agent_id, user_id, task_id, task_kind, execution_mode, status,
          current_step, total_steps, progress, estimated_reward, estimated_energy,
          risk_level, requires_user_action, idempotency_key
        ) VALUES (?, ?, ?, ?, 'task', 'runtime', 'failed', 1, 1, 0, 0, 0, 'low', 0, ?)
      `).bind(otherRunId, run.agent_id, run.user_id, run.task_id, id("scope_other")).run();
      await c.env.DB.prepare("UPDATE work_step_runtime_executions SET run_id = ? WHERE id = ?")
        .bind(otherRunId, link.link_id).run();
    } else if (scenario === "wrong_step") {
      await c.env.DB.prepare("UPDATE work_step_runtime_executions SET step_id = ? WHERE id = ?")
        .bind(verifyStep.id, link.link_id).run();
    } else if (scenario === "wrong_purpose") {
      await c.env.DB.prepare("UPDATE work_step_runtime_executions SET purpose = 'verify' WHERE id = ?")
        .bind(link.link_id).run();
    }

    const childId = id("exec_scope_child");
    const validBrief = {
      summary: "Scoped recovery fixture",
      core_product: "Core product",
      target_users: "Target users",
      business_model: "Business model",
      team_background: "Team background",
      competition: "Competition",
      risks: "Risks",
      sources: ["https://example.com/scope-fixture"],
      fact_vs_judgment: [{ statement: "Fixture fact", type: "fact" }],
      recommendations: ["Do not reuse across scope"],
    };
    await c.env.DB.prepare(`
      INSERT INTO skill_runtime_executions (
        id, user_id, agent_id, task_type, idempotency_key, request_hash, status,
        input_json, result_json, model_name, parent_execution_id,
        recovery_of_execution_id, attempt_number, completed_at
      ) VALUES (?, ?, ?, 'research_brief', ?, ?, 'completed', ?, ?,
        'deterministic-test-model', ?, ?, 2, CURRENT_TIMESTAMP)
    `).bind(
      childId, childUserId, childAgentId, id("scope_recovery"), id("scope_hash"),
      link.original_input_json, JSON.stringify(validBrief), link.runtime_execution_id, link.runtime_execution_id
    ).run();
    return c.json({ success: true, childId, originalExecutionId: link.runtime_execution_id, scenario });
  });

  app.get("/test/runtime-authorization-matrix", async (c) => {
    const testErr = requireTestMode(c);
    if (testErr) return testErr;
    const configured = c.env.TEST_ENDPOINT_TOKEN || "configured";
    const cases = [
      { name: "valid", env: { APP_ENV: "test", ENABLE_TEST_ENDPOINTS: "true", TEST_ENDPOINT_TOKEN: configured }, token: configured },
      { name: "production", env: { APP_ENV: "production", ENABLE_TEST_ENDPOINTS: "true", TEST_ENDPOINT_TOKEN: configured }, token: configured },
      { name: "staging", env: { APP_ENV: "staging", ENABLE_TEST_ENDPOINTS: "true", TEST_ENDPOINT_TOKEN: configured }, token: configured },
      { name: "disabled", env: { APP_ENV: "test", ENABLE_TEST_ENDPOINTS: "false", TEST_ENDPOINT_TOKEN: configured }, token: configured },
      { name: "unconfigured", env: { APP_ENV: "test", ENABLE_TEST_ENDPOINTS: "true", TEST_ENDPOINT_TOKEN: undefined }, token: configured },
      { name: "missing_token", env: { APP_ENV: "test", ENABLE_TEST_ENDPOINTS: "true", TEST_ENDPOINT_TOKEN: configured }, token: undefined },
      { name: "wrong_token", env: { APP_ENV: "test", ENABLE_TEST_ENDPOINTS: "true", TEST_ENDPOINT_TOKEN: configured }, token: "wrong" },
    ];
    return c.json({ cases: cases.map((entry) => ({
      name: entry.name,
      authorized: isTestRuntimeAuthorized(entry.env, entry.token),
    })) });
  });

  app.post("/test/workflow-runtime-fixture", async (c) => {
    const testErr = requireTestMode(c);
    if (testErr) return testErr;
    const user = await requireUser(c);
    const body = await c.req.json().catch(() => ({}));
    const scenario = String(body.scenario || "valid");
    if (!["valid", "missing_runtime", "failed_runtime", "timed_out_runtime", "cross_agent", "failed_verification"].includes(scenario)) {
      return c.json({ error: "invalid_scenario" }, 400);
    }
    const agent = await c.env.DB.prepare("SELECT * FROM agents WHERE user_id = ?").bind(user.id).first<DbAgent>();
    if (!agent) return c.json({ error: "agent_not_found" }, 404);

    const runId = id("run_fixture_runtime");
    const verifyStepId = id("step_fixture_verify");
    const settleStepId = id("step_fixture_settle");
    const runtimeExecutionId = id("exec_fixture_runtime");
    const reward = Number(body.reward ?? 123);
    const energy = Number(body.energy ?? 5);
    const runtimeStatus = scenario === "failed_runtime" ? "failed" : (scenario === "timed_out_runtime" ? "timed_out" : "completed");
    const verifyOutput = scenario === "failed_verification" ? "Verification failed." : "Verification check passed.";
    const otherUserId = id("user_fixture_other");
    const otherAgentId = id("agent_fixture_other");
    const runtimeUserId = scenario === "cross_agent" ? otherUserId : user.id;
    const runtimeAgentId = scenario === "cross_agent" ? otherAgentId : agent.id;

    const statements = [
      c.env.DB.prepare(`
        INSERT INTO agent_work_runs (id, agent_id, user_id, task_id, task_kind, execution_mode, status, current_step, total_steps, progress, estimated_reward, estimated_energy, risk_level, requires_user_action, idempotency_key)
        VALUES (?, ?, ?, 'runtime_fixture_task', 'basic', 'runtime', 'executing', 2, 2, 85, ?, ?, 'low', 0, ?)
      `).bind(runId, agent.id, user.id, reward, energy, `runtime_fixture:${scenario}:${Date.now()}`),
      c.env.DB.prepare(`
        INSERT INTO agent_work_steps (id, run_id, step_order, step_type, title, description, status, requires_approval, output_summary)
        VALUES (?, ?, 1, 'verify', 'Verify runtime output', 'Fixture verification step', 'completed', 0, ?)
      `).bind(verifyStepId, runId, verifyOutput),
      c.env.DB.prepare(`
        INSERT INTO agent_work_steps (id, run_id, step_order, step_type, title, description, status, requires_approval)
        VALUES (?, ?, 2, 'settle', 'Settle reward', 'Fixture settlement step', 'pending', 0)
      `).bind(settleStepId, runId),
      c.env.DB.prepare("UPDATE agents SET status = 'working', active_work_run_id = ? WHERE id = ?").bind(runId, agent.id)
    ];

    if (scenario === "cross_agent") {
      statements.push(
        c.env.DB.prepare("INSERT INTO users (id, telegram_id, username) VALUES (?, ?, 'other_runtime_user')").bind(otherUserId, `fixture_${Date.now()}`),
        c.env.DB.prepare("INSERT INTO agents (id, user_id, name) VALUES (?, ?, 'Other Runtime Agent')").bind(otherAgentId, otherUserId)
      );
    }
    if (scenario !== "missing_runtime") {
      statements.push(
        c.env.DB.prepare(`
          INSERT INTO skill_runtime_executions (id, user_id, agent_id, task_type, idempotency_key, request_hash, status, model_name)
          VALUES (?, ?, ?, 'workflow_fixture', ?, ?, ?, 'deterministic-test-model')
        `).bind(runtimeExecutionId, runtimeUserId, runtimeAgentId, `runtime_fixture:${scenario}:${runtimeExecutionId}`, `hash:${runtimeExecutionId}`, runtimeStatus),
        c.env.DB.prepare(`
          INSERT INTO work_step_runtime_executions (id, run_id, step_id, runtime_execution_id, purpose)
          VALUES (?, ?, ?, ?, 'verify')
        `).bind(id("wre_fixture"), runId, verifyStepId, runtimeExecutionId)
      );
    }
    await c.env.DB.batch(statements);
    return c.json({ runId, scenario, runtimeExecutionId: scenario === "missing_runtime" ? null : runtimeExecutionId }, 201);
  });

  app.post("/test/workflow-runtime-drive", async (c) => {
    const testErr = requireTestMode(c);
    if (testErr) return testErr;
    const user = await requireUser(c);
    const body = await c.req.json().catch(() => ({}));
    const runId = String(body.runId || "");
    if (!runId) return c.json({ error: "run_id_required" }, 400);
    const run = await c.env.DB.prepare("SELECT user_id FROM agent_work_runs WHERE id = ?").bind(runId).first<any>();
    if (!run) return c.json({ error: "run_not_found" }, 404);
    if (run.user_id !== user.id) return c.json({ error: "forbidden" }, 403);
    const updated = await driveWorkflow(c.env.DB, runId, user.id, { env: c.env, testMode: true });
    return c.json({ run: toWorkRun(updated) });
  });

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
    const taskType = getTaskType(task);
    const executionMode = taskType === "research_brief" ? "runtime" : "simulated";
    const runtimeInput = body.input && typeof body.input === "object"
      ? body.input
      : { project: task.name || task.title, description: task.description || null };

    // 6. Create run and steps inside batch
    const runStatements = [
      c.env.DB.prepare(
        `INSERT INTO agent_work_runs (id, agent_id, user_id, task_id, task_kind, execution_mode, status, current_step, total_steps, progress, estimated_reward, estimated_energy, risk_level, requires_user_action, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, 'discovered', 1, ?, 0, ?, ?, ?, 0, ?)`
      ).bind(runId, agent.id, user.id, task.id, taskKind, executionMode, WORK_STEP_TEMPLATES.length, estReward, estEnergy, riskLevel, idempotencyKey),
      
      ...WORK_STEP_TEMPLATES.map((tmpl, index) =>
        c.env.DB.prepare(
          `INSERT INTO agent_work_steps (id, run_id, step_order, step_type, title, description, status, input_summary, requires_approval, tool_name)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
        ).bind(
          id("step"), runId, index + 1, tmpl.stepType, tmpl.title, tmpl.description,
          tmpl.stepType === "prepare_output" && executionMode === "runtime" ? JSON.stringify(runtimeInput) : null,
          tmpl.requiresApproval ? 1 : 0, tmpl.toolName
        )
      ),

      c.env.DB.prepare("UPDATE agents SET status = 'working', active_work_run_id = ? WHERE id = ?").bind(runId, agent.id)
    ];

    await c.env.DB.batch(runStatements);
    await logActivity(c.env.DB, agent.id, runId, "run_created", `Started task: ${task.name || task.title}`, `Execution plan generated with ${WORK_STEP_TEMPLATES.length} steps.`, null);

    // 7. Drive the workflow steps
    const isTestMode = isTestRuntimeAuthorized(c.env, c.req.header("x-test-endpoint-token"));
    const failSettle = isTestMode && c.req.header("x-test-fail-settle") === "true";

    const finalRun = await driveWorkflow(c.env.DB, runId, user.id, { failSettle, env: c.env, testMode: isTestMode });
    const mapped = toWorkRun(finalRun);
    (mapped as any).usedSkills = [];
    return c.json({ run: mapped });
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
    const workRuns = [];
    for (const r of rows.results) {
      const mapped = toWorkRun(r);
      mapped.usedSkills = await getUsedSkillsForRun(c.env.DB, r.id);
      workRuns.push(mapped);
    }
    return c.json({ workRuns });
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

    const mapped = toWorkRun(run);
    mapped.usedSkills = await getUsedSkillsForRun(c.env.DB, run.id);
    return c.json({ run: mapped });
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

    const mapped = toWorkRun(run);
    mapped.usedSkills = await getUsedSkillsForRun(c.env.DB, run.id);
    return c.json({ run: mapped });
  });

  // 6. Evidence-first Work Report
  app.get("/work-runs/:runId/report", async (c) => {
    const user = await requireUser(c);
    const runId = c.req.param("runId");

    const run = await c.env.DB.prepare("SELECT * FROM agent_work_runs WHERE id = ?").bind(runId).first<DbWorkRun>();
    if (!run) {
      return c.json({ report: null });
    }
    if (run.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "You do not own this work run" }, 403);
    }

    const steps = await c.env.DB.prepare("SELECT * FROM agent_work_steps WHERE run_id = ? ORDER BY step_order ASC").bind(runId).all<DbWorkStep>();
    const report = await buildRealAssetWorkReport(c.env.DB, run, steps.results);
    return c.json({ report });
  });

  // 7. Run steps
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

    const isTestMode = isTestRuntimeAuthorized(c.env, c.req.header("x-test-endpoint-token"));
    const failSettle = isTestMode && c.req.header("x-test-fail-settle") === "true";
    const updated = await driveWorkflow(c.env.DB, runId, user.id, { failSettle, env: c.env, testMode: isTestMode });
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

    const isTestMode = isTestRuntimeAuthorized(c.env, c.req.header("x-test-endpoint-token"));
    const failSettle = isTestMode && c.req.header("x-test-fail-settle") === "true";
    const updated = await driveWorkflow(c.env.DB, runId, user.id, { failSettle, env: c.env, testMode: isTestMode });
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

    const isTestMode = isTestRuntimeAuthorized(c.env, c.req.header("x-test-endpoint-token"));
    const failSettle = isTestMode && c.req.header("x-test-fail-settle") === "true";
    const updated = await driveWorkflow(c.env.DB, runId, user.id, { failSettle, env: c.env, testMode: isTestMode });
    return c.json({ run: toWorkRun(updated) });
  });
}
