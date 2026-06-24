import type {
  AdminWorkReportAudit,
  RecoverySummary,
  ResearchBriefResult,
  SafeSourceReference,
  RuntimeExecutionPurpose,
  RuntimeExecutionSummary,
  SettlementSummary,
  SkillUsageSummary,
  VerificationSummary,
  WorkReportShare,
  WorkReportStructuredResult,
  WorkReport,
  WorkReportKind,
  WorkReportOverallStatus,
  WorkReportStep,
  WorkReportWarning,
  WorkReportWarningCode,
} from "@growthbot/shared";
import { Hono } from "hono";
import { Bindings, requireAdmin, requireTestMode, requireUser } from "./core";

export const MAX_RECOVERY_GRAPH_DEPTH = 2;
export const MAX_REPORT_STEPS = 32;
export const MAX_RUNTIME_EXECUTIONS = 32;
export const MAX_RUNTIME_LINKS = MAX_RUNTIME_EXECUTIONS * 2;
export const MAX_RECOVERY_CHILDREN = MAX_RUNTIME_EXECUTIONS * 2;
export const MAX_SKILL_USAGES = 64;
export const MAX_WARNINGS = 32;
export const MAX_SOURCES = 20;
export const MAX_RECOMMENDATIONS = 20;
export const MAX_FACT_JUDGMENT_ITEMS = 40;
export const MAX_TITLE_CHARS = 200;
export const MAX_DESCRIPTION_CHARS = 2_000;
export const MAX_SUMMARY_CHARS = 4_000;
export const MAX_ERROR_MESSAGE_CHARS = 500;
export const MAX_WARNING_MESSAGE_CHARS = 500;
export const MAX_REASON_CODE_CHARS = 100;
export const MAX_SAFE_URL_CHARS = 2_048;
export const MAX_MODEL_NAME_CHARS = 200;
export const MAX_SKILL_NAME_CHARS = 200;

const RECOVERABLE_ERROR_CODES = new Set(["timeout", "model_execution_error"]);
const VALID_LINK_PURPOSES = new Set(["plan", "produce", "verify", "recover"]);
const VALID_STEP_STATUSES = new Set([
  "pending",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
  "skipped",
]);
const VALID_EXECUTION_STATUSES = new Set([
  "pending",
  "running",
  "completed",
  "failed",
  "timed_out",
  "cancelled",
]);

const NOT_FOUND_RESPONSE = {
  error: {
    code: "WORK_RUN_NOT_FOUND",
    message: "Work run not found",
  },
} as const;

const INTERNAL_ERROR_RESPONSE = {
  error: {
    code: "WORK_REPORT_QUERY_FAILED",
    message: "Unable to load Work Report",
  },
} as const;

function sanitizeText(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  if (!cleaned) return null;
  return Array.from(cleaned).slice(0, maxChars).join("");
}

function validateWorkRunId(value: string): boolean {
  return value.length >= 1 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value);
}

function addWarning(
  warnings: WorkReportWarning[],
  code: WorkReportWarningCode,
  message: string,
): void {
  if (warnings.length >= MAX_WARNINGS) return;
  const safeMessage = sanitizeText(message, MAX_WARNING_MESSAGE_CHARS);
  if (!safeMessage) return;
  warnings.push({ code, message: safeMessage });
}

function resolveActualEnergy(
  value: number | null,
  warnings: WorkReportWarning[],
): number | null {
  if (value === null) {
    addWarning(
      warnings,
      "ACTUAL_ENERGY_MISSING",
      "Actual energy is unavailable",
    );
    return null;
  }
  return value;
}

function mapStepStatus(
  value: string,
  warnings: WorkReportWarning[],
): WorkReportStep["status"] {
  if (VALID_STEP_STATUSES.has(value)) return value as WorkReportStep["status"];
  addWarning(warnings, "UNRECOGNIZED_STATUS", "A work step has an unrecognized status");
  return "unknown";
}

function mapExecutionStatus(
  value: string,
  warnings: WorkReportWarning[],
): RuntimeExecutionSummary["status"] {
  if (VALID_EXECUTION_STATUSES.has(value)) return value as RuntimeExecutionSummary["status"];
  addWarning(warnings, "UNRECOGNIZED_STATUS", "A runtime execution has an unrecognized status");
  return "unknown";
}

function mapSkillUsageStatus(
  value: string,
  warnings: WorkReportWarning[],
): SkillUsageSummary["status"] {
  switch (value) {
    case "selected":
    case "loaded":
    case "completed":
    case "failed":
    case "skipped":
      return value;
    default:
      addWarning(warnings, "UNRECOGNIZED_STATUS", "A skill usage has an unrecognized status");
      return "unknown";
  }
}

function mapSelectionRole(value: string): SkillUsageSummary["selectionRole"] {
  if (value === "required" || value === "recommended" || value === "fallback") return value;
  return "unknown";
}

function mapKind(executionMode: string | null): WorkReportKind {
  if (executionMode === "simulated") return "simulation";
  if (executionMode === "external") return "external_verification_unknown";
  return "runtime_work";
}

function mapOverallStatus(
  status: string,
  warnings: WorkReportWarning[],
): WorkReportOverallStatus {
  switch (status) {
    case "queued":
    case "analyzing":
    case "planning":
    case "executing":
    case "verifying":
    case "settling":
    case "in_progress":
      return "in_progress";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      addWarning(warnings, "UNRECOGNIZED_STATUS", "The work run has an unrecognized status");
      return "data_incomplete";
  }
}

function safeNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function durationMs(startedAt: string | null, completedAt: string | null): number | null {
  if (!startedAt || !completedAt) return null;
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return end - start;
}


function projectSafeSourceUrl(rawUrl: string): SafeSourceReference | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname) return null;
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    const safeUrl = parsed.toString();
    if (Array.from(safeUrl).length > MAX_SAFE_URL_CHARS) return null;
    return {
      displayDomain: parsed.hostname.toLowerCase(),
      safeUrl,
    };
  } catch {
    return null;
  }
}

function parseResearchBriefResult(
  raw: string | null,
  warnings: WorkReportWarning[],
): WorkReportStructuredResult | null {
  if (raw === null) return null;

  const unavailable = (): WorkReportStructuredResult => {
    addWarning(
      warnings,
      "STRUCTURED_RESULT_UNAVAILABLE",
      "Structured result is unavailable",
    );
    return {
      type: "unavailable",
      reasonCode: "STRUCTURED_RESULT_UNAVAILABLE",
    };
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return unavailable();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return unavailable();
  const input = parsed as Record<string, unknown>;

  const requiredText = (
    key: string,
    maxChars: number,
  ): string | null => {
    const value = input[key];
    if (typeof value !== "string" || value.trim().length === 0) return null;
    return sanitizeText(value.trim(), maxChars);
  };

  const summary = requiredText("summary", MAX_SUMMARY_CHARS);
  const coreProduct = requiredText("core_product", MAX_DESCRIPTION_CHARS);
  const targetUsers = requiredText("target_users", MAX_DESCRIPTION_CHARS);
  const businessModel = requiredText("business_model", MAX_DESCRIPTION_CHARS);
  const teamBackground = requiredText("team_background", MAX_DESCRIPTION_CHARS);
  const competition = requiredText("competition", MAX_DESCRIPTION_CHARS);
  const risks = requiredText("risks", MAX_DESCRIPTION_CHARS);
  if (
    !summary
    || !coreProduct
    || !targetUsers
    || !businessModel
    || !teamBackground
    || !competition
    || !risks
  ) return unavailable();

  if (!Array.isArray(input.sources) || input.sources.length === 0) return unavailable();
  const sourceMap = new Map<string, SafeSourceReference>();
  for (const source of input.sources) {
    if (typeof source !== "string") continue;
    const projected = projectSafeSourceUrl(source);
    if (projected && !sourceMap.has(projected.safeUrl)) sourceMap.set(projected.safeUrl, projected);
  }
  const allSources = Array.from(sourceMap.values());
  if (allSources.length === 0) return unavailable();
  if (allSources.length > MAX_SOURCES) {
    addWarning(warnings, "DATA_TRUNCATED", "Research Brief sources were truncated");
  }
  const sources = allSources.slice(0, MAX_SOURCES);

  if (!Array.isArray(input.fact_vs_judgment)) return unavailable();
  const factMap = new Map<string, ResearchBriefResult["factVsJudgment"][number]>();
  for (const item of input.fact_vs_judgment) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return unavailable();
    const record = item as Record<string, unknown>;
    if (
      typeof record.statement !== "string"
      || record.statement.trim().length === 0
      || (record.type !== "fact" && record.type !== "judgment")
    ) return unavailable();
    const statement = sanitizeText(record.statement.trim(), MAX_DESCRIPTION_CHARS);
    if (!statement) return unavailable();
    const key = `${record.type}\u0000${statement}`;
    if (!factMap.has(key)) factMap.set(key, { statement, type: record.type });
  }
  const allFactVsJudgment = Array.from(factMap.values());
  if (allFactVsJudgment.length > MAX_FACT_JUDGMENT_ITEMS) {
    addWarning(warnings, "DATA_TRUNCATED", "Research Brief fact and judgment items were truncated");
  }
  const factVsJudgment = allFactVsJudgment.slice(0, MAX_FACT_JUDGMENT_ITEMS);

  if (!Array.isArray(input.recommendations) || input.recommendations.length === 0) {
    return unavailable();
  }
  const recommendationMap = new Map<string, string>();
  for (const item of input.recommendations) {
    if (typeof item !== "string" || item.trim().length === 0) return unavailable();
    const recommendation = sanitizeText(item.trim(), MAX_DESCRIPTION_CHARS);
    if (!recommendation) return unavailable();
    if (!recommendationMap.has(recommendation)) recommendationMap.set(recommendation, recommendation);
  }
  const allRecommendations = Array.from(recommendationMap.values());
  if (allRecommendations.length > MAX_RECOMMENDATIONS) {
    addWarning(warnings, "DATA_TRUNCATED", "Research Brief recommendations were truncated");
  }
  const recommendations = allRecommendations.slice(0, MAX_RECOMMENDATIONS);

  return {
    type: "research_brief",
    value: {
      summary,
      coreProduct,
      targetUsers,
      businessModel,
      teamBackground,
      competition,
      risks,
      sources,
      factVsJudgment,
      recommendations,
    },
  };
}

type WorkRunRow = {
  id: string;
  user_id: string;
  agent_id: string;
  task_id: string;
  status: string;
  execution_mode: string | null;
  started_at: string | null;
  completed_at: string | null;
  estimated_reward: number;
  actual_reward: number | null;
  estimated_energy: number;
  actual_energy: number | null;
  settled: number;
  settlement_ledger_id: string | null;
  settled_at: string | null;
  research_brief_result_json: string | null;
};

type WorkStepRow = {
  id: string;
  run_id: string;
  step_order: number;
  step_type: string;
  title: string;
  description: string | null;
  status: string;
  output_summary: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
};

type RuntimeLinkRow = {
  id: string;
  run_id: string;
  step_id: string;
  runtime_execution_id: string;
  purpose: string;
  created_at: string;
};

type RuntimeExecutionRow = {
  id: string;
  user_id: string;
  agent_id: string;
  status: string;
  error_code: string | null;
  parent_execution_id: string | null;
  recovery_of_execution_id: string | null;
  attempt_number: number;
  model_name: string | null;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd_micros: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type SkillUsageRow = {
  id: string;
  task_execution_id: string;
  user_id: string;
  agent_id: string;
  skill_definition_id: string;
  skill_name: string | null;
  runtime_version: number;
  learned_skill_level: number;
  selection_role: string;
  runtime_checksum: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd_micros: number;
  status: string;
  error_code: string | null;
  created_at: string;
};

type SettlementRow = {
  run_id: string;
  status: string;
  reward_applied: number;
  energy_applied: number;
  created_at: string;
  updated_at: string;
};

type LedgerRow = {
  id: string;
  user_id: string;
  agent_id: string | null;
  event_type: string;
  point_type: string;
  amount: number;
  source_id: string | null;
  created_at: string;
};

type LinkFact = {
  purpose: RuntimeExecutionPurpose;
  stepId: string | null;
  purposes: Set<string>;
  stepIds: Set<string>;
  runIds: Set<string>;
};

async function queryRuntimeExecutions(
  db: D1Database,
  executionIds: string[],
): Promise<RuntimeExecutionRow[]> {
  const rows: RuntimeExecutionRow[] = [];
  const uniqueIds = Array.from(new Set(executionIds));
  const chunkSize = 50;
  for (let offset = 0; offset < uniqueIds.length; offset += chunkSize) {
    const chunk = uniqueIds.slice(offset, offset + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");
    const result = await db
      .prepare(
        `SELECT id, user_id, agent_id, status, error_code, parent_execution_id,
                recovery_of_execution_id, attempt_number, model_name,
                input_tokens, output_tokens, estimated_cost_usd_micros,
                started_at, completed_at, created_at
         FROM skill_runtime_executions
         WHERE id IN (${placeholders})
         ORDER BY created_at ASC, id ASC`,
      )
      .bind(...chunk)
      .all<RuntimeExecutionRow>();
    rows.push(...result.results);
  }
  return rows;
}

async function queryRecoveryChildren(
  db: D1Database,
  rootIds: string[],
): Promise<RuntimeExecutionRow[]> {
  if (rootIds.length === 0) return [];
  const placeholders = rootIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT id, user_id, agent_id, status, error_code, parent_execution_id,
              recovery_of_execution_id, attempt_number, model_name,
              input_tokens, output_tokens, estimated_cost_usd_micros,
              started_at, completed_at, created_at
       FROM skill_runtime_executions
       WHERE recovery_of_execution_id IN (${placeholders})
       ORDER BY created_at ASC, attempt_number ASC, id ASC
       LIMIT ?`,
    )
    .bind(...rootIds, MAX_RECOVERY_CHILDREN + 1)
    .all<RuntimeExecutionRow>();
  return result.results;
}

async function queryLinksForExecutions(
  db: D1Database,
  executionIds: string[],
): Promise<RuntimeLinkRow[]> {
  if (executionIds.length === 0) return [];
  const placeholders = executionIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT id, run_id, step_id, runtime_execution_id, purpose, created_at
       FROM work_step_runtime_executions
       WHERE runtime_execution_id IN (${placeholders})
       ORDER BY created_at ASC, id ASC
       LIMIT ?`,
    )
    .bind(...executionIds, MAX_RUNTIME_LINKS + 1)
    .all<RuntimeLinkRow>();
  return result.results;
}

async function querySkillUsages(
  db: D1Database,
  executionIds: string[],
): Promise<SkillUsageRow[]> {
  if (executionIds.length === 0) return [];
  const placeholders = executionIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT u.id, u.task_execution_id, u.user_id, u.agent_id,
              u.skill_definition_id, d.name AS skill_name,
              u.runtime_version, u.learned_skill_level, u.selection_role,
              u.runtime_checksum, u.input_tokens, u.output_tokens,
              u.estimated_cost_usd_micros, u.status, u.error_code, u.created_at
       FROM task_skill_runtime_usages u
       LEFT JOIN agent_skill_definitions d ON d.id = u.skill_definition_id
       WHERE u.task_execution_id IN (${placeholders})
       ORDER BY u.created_at ASC, u.id ASC
       LIMIT ?`,
    )
    .bind(...executionIds, MAX_SKILL_USAGES + 1)
    .all<SkillUsageRow>();
  return result.results;
}

function buildLinkFacts(
  links: RuntimeLinkRow[],
  warnings: WorkReportWarning[],
): Map<string, LinkFact> {
  const grouped = new Map<string, LinkFact>();
  for (const link of links) {
    let fact = grouped.get(link.runtime_execution_id);
    if (!fact) {
      fact = {
        purpose: "unknown",
        stepId: null,
        purposes: new Set<string>(),
        stepIds: new Set<string>(),
        runIds: new Set<string>(),
      };
      grouped.set(link.runtime_execution_id, fact);
    }
    fact.purposes.add(link.purpose);
    fact.stepIds.add(link.step_id);
    fact.runIds.add(link.run_id);
  }
  for (const fact of grouped.values()) {
    if (fact.purposes.size === 1) {
      const purpose = Array.from(fact.purposes)[0] ?? "";
      fact.purpose = VALID_LINK_PURPOSES.has(purpose)
        ? (purpose as RuntimeExecutionPurpose)
        : "unknown";
    }
    if (fact.stepIds.size === 1) fact.stepId = Array.from(fact.stepIds)[0] ?? null;
    if (fact.purposes.size > 1 || fact.stepIds.size > 1 || fact.purpose === "unknown") {
      addWarning(warnings, "RUNTIME_LINK_INCONSISTENT", "Runtime execution links are inconsistent");
    }
  }
  return grouped;
}

type WorkReportAudience = "user" | "admin";

type BuiltWorkReport = {
  report: WorkReport;
  audit: AdminWorkReportAudit | null;
};

async function buildWorkReport(
  db: D1Database,
  run: WorkRunRow,
  audience: WorkReportAudience,
): Promise<BuiltWorkReport> {
  const warnings: WorkReportWarning[] = [];
  let dataIncomplete = false;
  const mappedOverallStatus = mapOverallStatus(run.status, warnings);
  if (mappedOverallStatus === "data_incomplete") dataIncomplete = true;
  if (!run.execution_mode) {
    addWarning(warnings, "EXECUTION_MODE_MISSING", "Work run execution mode is missing");
    dataIncomplete = true;
  }

  const stepResult = await db.prepare(
    `SELECT id, run_id, step_order, step_type, title, description, status,
            output_summary, started_at, completed_at, error_message
     FROM agent_work_steps
     WHERE run_id = ?
     ORDER BY step_order ASC, id ASC
     LIMIT ?`,
  )
    .bind(run.id, MAX_REPORT_STEPS + 1)
    .all<WorkStepRow>();
  const uniqueSteps = new Map<string, WorkStepRow>();
  for (const step of stepResult.results) if (!uniqueSteps.has(step.id)) uniqueSteps.set(step.id, step);
  const stepRows = Array.from(uniqueSteps.values());
  if (stepRows.length > MAX_REPORT_STEPS) {
    addWarning(warnings, "DATA_TRUNCATED", "Work report steps were truncated");
    dataIncomplete = true;
  }
  const limitedStepRows = stepRows.slice(0, MAX_REPORT_STEPS);
  const stepIds = new Set(limitedStepRows.map((step) => step.id));

  const linkResult = await db.prepare(
    `SELECT id, run_id, step_id, runtime_execution_id, purpose, created_at
     FROM work_step_runtime_executions
     WHERE run_id = ?
     ORDER BY created_at ASC, id ASC
     LIMIT ?`,
  )
    .bind(run.id, MAX_RUNTIME_LINKS + 1)
    .all<RuntimeLinkRow>();
  if (linkResult.results.length > MAX_RUNTIME_LINKS) {
    addWarning(warnings, "DATA_TRUNCATED", "Runtime links were truncated");
    dataIncomplete = true;
  }

  const uniqueLinkIds = new Set<string>();
  const businessLinks = new Set<string>();
  const validInitialLinks: RuntimeLinkRow[] = [];
  for (const link of linkResult.results.slice(0, MAX_RUNTIME_LINKS)) {
    if (uniqueLinkIds.has(link.id)) continue;
    uniqueLinkIds.add(link.id);
    const businessKey = `${link.step_id}\u0000${link.runtime_execution_id}\u0000${link.purpose}`;
    if (businessLinks.has(businessKey)) {
      addWarning(warnings, "RUNTIME_LINK_INCONSISTENT", "A duplicate runtime link was found");
      dataIncomplete = true;
      continue;
    }
    businessLinks.add(businessKey);
    if (!stepIds.has(link.step_id) || !VALID_LINK_PURPOSES.has(link.purpose)) {
      addWarning(warnings, "RUNTIME_LINK_INCONSISTENT", "A runtime link is inconsistent with the work run");
      dataIncomplete = true;
      continue;
    }
    validInitialLinks.push(link);
  }

  const initialExecutionIds = Array.from(new Set(validInitialLinks.map((link) => link.runtime_execution_id)));
  if (initialExecutionIds.length > MAX_RUNTIME_EXECUTIONS) {
    addWarning(warnings, "DATA_TRUNCATED", "Runtime executions were truncated");
    dataIncomplete = true;
  }
  const requestedExecutionIds = initialExecutionIds.slice(0, MAX_RUNTIME_EXECUTIONS);
  const initialRows = await queryRuntimeExecutions(db, requestedExecutionIds);
  const initialById = new Map(initialRows.map((row) => [row.id, row]));
  for (const id of requestedExecutionIds) {
    if (!initialById.has(id)) {
      addWarning(warnings, "RUNTIME_LINK_MISSING", "A linked runtime execution is missing");
      dataIncomplete = true;
    }
  }

  const safeInitialRows = initialRows.filter((row) => {
    if (row.user_id !== run.user_id || row.agent_id !== run.agent_id) {
      addWarning(warnings, "RUNTIME_LINK_INCONSISTENT", "A runtime execution does not match the work run owner or agent");
      dataIncomplete = true;
      return false;
    }
    return true;
  });
  const initialFacts = buildLinkFacts(validInitialLinks, warnings);
  if (warnings.some((warning) => warning.code === "RUNTIME_LINK_INCONSISTENT")) dataIncomplete = true;

  const produceRoots = safeInitialRows.filter((row) => {
    const fact = initialFacts.get(row.id);
    return fact?.purpose === "produce" && row.recovery_of_execution_id === null;
  });
  const produceRootsByStep = new Map<string, RuntimeExecutionRow[]>();
  for (const root of produceRoots) {
    const stepId = initialFacts.get(root.id)?.stepId;
    if (!stepId) continue;
    const roots = produceRootsByStep.get(stepId) ?? [];
    roots.push(root);
    produceRootsByStep.set(stepId, roots);
  }

  if (run.execution_mode === "runtime" && produceRoots.length === 0) {
    addWarning(warnings, "RUNTIME_LINK_MISSING", "Runtime work has no produce execution");
    dataIncomplete = true;
  }
  for (const roots of produceRootsByStep.values()) {
    if (roots.length > 1) {
      addWarning(warnings, "RUNTIME_LINK_INCONSISTENT", "A produce step has multiple original executions");
      dataIncomplete = true;
    }
    for (const root of roots) {
      if (!Number.isInteger(root.attempt_number) || root.attempt_number < 1) {
        addWarning(warnings, "RECOVERY_LINK_INCONSISTENT", "Original execution attempt numbering is invalid");
        dataIncomplete = true;
      }
    }
  }

  const childRowsRaw = await queryRecoveryChildren(db, produceRoots.map((row) => row.id));
  if (childRowsRaw.length > MAX_RECOVERY_CHILDREN) {
    addWarning(warnings, "DATA_TRUNCATED", "Recovery executions were truncated");
    dataIncomplete = true;
  }
  const childRows = childRowsRaw.slice(0, MAX_RECOVERY_CHILDREN);
  const childIds = Array.from(new Set(childRows.map((row) => row.id)));
  const childLinksRaw = await queryLinksForExecutions(db, childIds);
  if (childLinksRaw.length > MAX_RUNTIME_LINKS) {
    addWarning(warnings, "DATA_TRUNCATED", "Recovery links were truncated");
    dataIncomplete = true;
  }
  const childLinks = childLinksRaw.slice(0, MAX_RUNTIME_LINKS);
  const childFacts = buildLinkFacts(childLinks, warnings);

  const observedChildrenByRoot = new Map<string, RuntimeExecutionRow[]>();
  for (const child of childRows) {
    const rootId = child.recovery_of_execution_id;
    if (!rootId) continue;
    const observed = observedChildrenByRoot.get(rootId) ?? [];
    observed.push(child);
    observedChildrenByRoot.set(rootId, observed);
  }

  const childrenByRoot = new Map<string, RuntimeExecutionRow[]>();
  const seenChildRoots = new Map<string, string>();
  const validChildren: RuntimeExecutionRow[] = [];
  for (const child of childRows) {
    const rootId = child.recovery_of_execution_id;
    if (!rootId) continue;
    const root = produceRoots.find((candidate) => candidate.id === rootId);
    const rootFact = root ? initialFacts.get(root.id) : undefined;
    const childFact = childFacts.get(child.id);
    let valid = Boolean(root && rootFact && childFact);

    if (child.id === rootId || child.recovery_of_execution_id === child.id) {
      addWarning(warnings, "RECOVERY_GRAPH_CYCLE", "Recovery graph contains a self-reference");
      valid = false;
    }
    const previousRoot = seenChildRoots.get(child.id);
    if (previousRoot && previousRoot !== rootId) {
      addWarning(warnings, "RECOVERY_LINK_INCONSISTENT", "A recovery execution is referenced by multiple roots");
      valid = false;
    }
    seenChildRoots.set(child.id, rootId);
    if (child.user_id !== run.user_id || child.agent_id !== run.agent_id) {
      addWarning(warnings, "RECOVERY_LINK_INCONSISTENT", "A recovery execution crosses owner or agent boundaries");
      valid = false;
    }
    if (!childFact || !childFact.runIds.has(run.id) || childFact.runIds.size !== 1) {
      addWarning(warnings, "RECOVERY_LINK_INCONSISTENT", "A recovery execution is not uniquely linked to the work run");
      valid = false;
    }
    if (childFact && childFact.purposes.has("produce") && childFact.purposes.has("recover")) {
      addWarning(warnings, "RECOVERY_LINK_INCONSISTENT", "A recovery execution is linked as both produce and recover");
      valid = false;
    }
    if (rootFact && childFact) {
      const rootStepId = rootFact.stepId;
      const hasSingleChildStep = childFact.stepIds.size === 1;
      const sameStep = rootStepId !== null
        && hasSingleChildStep
        && childFact.stepIds.has(rootStepId);
      const recoverPurposeIsValid = childFact.purpose === "recover"
        && childFact.purposes.size === 1;
      if (!recoverPurposeIsValid) {
        addWarning(warnings, "RECOVERY_LINK_INCONSISTENT", "A recovery execution has an invalid purpose");
        valid = false;
      }
      if (!sameStep) {
        addWarning(warnings, "RECOVERY_LINK_INCONSISTENT", "A recovery execution crosses work steps");
        valid = false;
      }
    }
    if (child.parent_execution_id && child.parent_execution_id !== rootId) {
      addWarning(warnings, "RECOVERY_LINK_INCONSISTENT", "Recovery parent and recovery target are inconsistent");
      valid = false;
    }
    if (!Number.isInteger(child.attempt_number) || !root || child.attempt_number <= root.attempt_number) {
      addWarning(warnings, "RECOVERY_LINK_INCONSISTENT", "Recovery attempt numbering is invalid");
      valid = false;
    }
    if (root && (root.status === "completed" || !RECOVERABLE_ERROR_CODES.has(root.error_code ?? ""))) {
      addWarning(warnings, "RECOVERY_LINK_INCONSISTENT", "Recovery exists for an execution that is not recoverable");
      valid = false;
    }

    if (!valid) {
      dataIncomplete = true;
      continue;
    }
    validChildren.push(child);
    const children = childrenByRoot.get(rootId) ?? [];
    children.push(child);
    childrenByRoot.set(rootId, children);
  }

  for (const children of observedChildrenByRoot.values()) {
    if (children.length > 1) {
      addWarning(warnings, "RECOVERY_MULTIPLE_CHILDREN", "A runtime execution has multiple direct recovery children");
      dataIncomplete = true;
    }
  }

  const grandchildRows = await queryRecoveryChildren(db, childRows.map((row) => row.id));
  if (grandchildRows.length > 0) {
    addWarning(warnings, "RECOVERY_GRAPH_DEPTH_EXCEEDED", "Recovery graph exceeds the supported depth");
    dataIncomplete = true;
  }
  const rootIds = new Set(produceRoots.map((row) => row.id));
  const childIdSet = new Set(childRows.map((row) => row.id));
  for (const grandchild of grandchildRows) {
    if (
      grandchild.id === grandchild.recovery_of_execution_id
      || rootIds.has(grandchild.id)
      || (grandchild.recovery_of_execution_id !== null && rootIds.has(grandchild.recovery_of_execution_id))
    ) {
      addWarning(warnings, "RECOVERY_GRAPH_CYCLE", "Recovery graph contains a cycle or self-reference");
      dataIncomplete = true;
    }
    if (grandchild.recovery_of_execution_id && !childIdSet.has(grandchild.recovery_of_execution_id)) {
      addWarning(warnings, "RECOVERY_LINK_INCONSISTENT", "Recovery graph contains an inconsistent depth-three link");
      dataIncomplete = true;
    }
  }

  const recoveryGraphRows = [...safeInitialRows, ...childRows, ...grandchildRows];
  const recoveryTargetById = new Map(
    recoveryGraphRows.map((row) => [row.id, row.recovery_of_execution_id] as const),
  );
  for (const row of recoveryGraphRows) {
    if (row.recovery_of_execution_id === row.id) {
      addWarning(warnings, "RECOVERY_GRAPH_CYCLE", "Recovery graph contains a self-reference");
      dataIncomplete = true;
      continue;
    }
    const visited = new Set<string>([row.id]);
    let current = row.recovery_of_execution_id;
    while (current && recoveryTargetById.has(current)) {
      if (visited.has(current)) {
        addWarning(warnings, "RECOVERY_GRAPH_CYCLE", "Recovery graph contains a cycle");
        dataIncomplete = true;
        break;
      }
      visited.add(current);
      current = recoveryTargetById.get(current) ?? null;
    }
  }

  const finalExecutionIds = new Set<string>();
  let recoveryAttempted = false;
  let recoveryRecovered = false;
  let recoveryInProgress = false;
  let recoveryFailed = false;
  const recoveryRootIds: string[] = [];
  const recoveryFinalIds: string[] = [];

  for (const [stepId, roots] of produceRootsByStep) {
    if (roots.length !== 1) continue;
    const root = roots[0]!;
    const children = childrenByRoot.get(root.id) ?? [];
    const observedChildren = observedChildrenByRoot.get(root.id) ?? [];
    if (root.status === "completed") {
      if (observedChildren.length === 0) finalExecutionIds.add(root.id);
      else {
        addWarning(warnings, "RECOVERY_LINK_INCONSISTENT", "A completed produce execution has a recovery child");
        dataIncomplete = true;
      }
      continue;
    }
    if (root.status === "failed" && RECOVERABLE_ERROR_CODES.has(root.error_code ?? "")) {
      if (children.length === 1) {
        recoveryAttempted = true;
        recoveryRootIds.push(root.id);
        const child = children[0]!;
        if (child.status === "completed") {
          finalExecutionIds.add(child.id);
          recoveryRecovered = true;
          recoveryFinalIds.push(child.id);
        } else if (child.status === "pending" || child.status === "running") {
          recoveryInProgress = true;
        } else {
          recoveryFailed = true;
        }
      }
    }
    void stepId;
  }

  const recoveryInvalid = warnings.some((warning) =>
    warning.code === "RECOVERY_LINK_INCONSISTENT"
    || warning.code === "RECOVERY_GRAPH_CYCLE"
    || warning.code === "RECOVERY_GRAPH_DEPTH_EXCEEDED"
    || warning.code === "RECOVERY_MULTIPLE_CHILDREN",
  );
  if (recoveryInvalid) {
    finalExecutionIds.clear();
    recoveryRecovered = false;
    recoveryFinalIds.length = 0;
  }

  const allExecutionRowsById = new Map<string, RuntimeExecutionRow>();
  const nonRecoveryInitialRows = safeInitialRows.filter(
    (row) => row.recovery_of_execution_id === null,
  );
  for (const row of [...nonRecoveryInitialRows, ...validChildren]) {
    if (!allExecutionRowsById.has(row.id)) allExecutionRowsById.set(row.id, row);
  }
  const allExecutionRows = Array.from(allExecutionRowsById.values());
  const allExecutionIds = new Set(allExecutionRows.map((row) => row.id));
  const allLinks = [...validInitialLinks, ...childLinks.filter((link) => link.run_id === run.id)];
  const allFacts = buildLinkFacts(allLinks, warnings);
  if (warnings.some((warning) => warning.code === "RUNTIME_LINK_INCONSISTENT")) dataIncomplete = true;

  const usageRows = await querySkillUsages(db, Array.from(allExecutionIds));
  if (usageRows.length > MAX_SKILL_USAGES) {
    addWarning(warnings, "DATA_TRUNCATED", "Skill usages were truncated");
    dataIncomplete = true;
  }
  const limitedUsageRows = usageRows.slice(0, MAX_SKILL_USAGES).filter((row) => {
    const valid = allExecutionIds.has(row.task_execution_id)
      && row.user_id === run.user_id
      && row.agent_id === run.agent_id;
    if (!valid) {
      addWarning(warnings, "RUNTIME_LINK_INCONSISTENT", "A skill usage does not match the work run owner, agent, or runtime execution");
      dataIncomplete = true;
    }
    return valid;
  });

  let verification: VerificationSummary = {
    status: "unknown",
    source: "legacy_unknown",
    reasonCode: null,
    verifiedAt: null,
  };
  const verifySteps = limitedStepRows.filter((step) => step.step_type === "verify");
  if (run.execution_mode === "runtime") {
    if (verifySteps.length > 1) {
      addWarning(warnings, "VERIFICATION_FACTS_INCONSISTENT", "Multiple verification steps were found");
      dataIncomplete = true;
    } else if (verifySteps.length === 1) {
      const verifyStep = verifySteps[0]!;
      const output = verifyStep.output_summary ?? "";
      const passedOutput = output === "Verification check passed."
        || output.startsWith("Verification check passed. Level: ")
        || output === "Verification check passed. Research Brief schema and evidence fields validated by server.";
      const failedOutput = output === "Verification failed."
        || output.startsWith("Verification failed. Missing or invalid fields: ");
      if (verifyStep.status === "failed" || failedOutput) {
        verification = {
          status: "failed",
          source: "workflow_step",
          reasonCode: sanitizeText(verifyStep.error_message, MAX_REASON_CODE_CHARS) ?? "VERIFY_STEP_FAILED",
          verifiedAt: verifyStep.completed_at,
        };
      } else if (verifyStep.status === "completed" && passedOutput) {
        verification = {
          status: "passed",
          source: "workflow_step",
          reasonCode: null,
          verifiedAt: verifyStep.completed_at,
        };
      } else if (
        verifyStep.status === "pending"
        || verifyStep.status === "in_progress"
      ) {
        verification = {
          status: "pending",
          source: "workflow_step",
          reasonCode: null,
          verifiedAt: null,
        };
      } else {
        addWarning(warnings, "VERIFICATION_UNKNOWN", "Verification facts could not be interpreted safely");
      }
    } else {
      addWarning(warnings, "VERIFICATION_UNKNOWN", "No trusted verification step was found");
    }
  }

  const settlementResult = await db.prepare(
    `SELECT run_id, status, reward_applied, energy_applied, created_at, updated_at
     FROM work_run_settlements
     WHERE run_id = ?
     LIMIT 2`,
  )
    .bind(run.id)
    .all<SettlementRow>();

  let settlementConflict = settlementResult.results.length > 1;
  if (settlementConflict) {
    addWarning(warnings, "SETTLEMENT_FACTS_INCONSISTENT", "Multiple settlement records were found");
    dataIncomplete = true;
  }

  let exactLedger: LedgerRow | null = null;
  let ledgerConflict = false;
  if (run.settlement_ledger_id) {
    const exactLedgerResult = await db.prepare(
      `SELECT id, user_id, agent_id, event_type, point_type, amount, source_id, created_at
       FROM point_ledger_events
       WHERE id = ?
       LIMIT 2`,
    )
      .bind(run.settlement_ledger_id)
      .all<LedgerRow>();
    if (exactLedgerResult.results.length === 1) exactLedger = exactLedgerResult.results[0] ?? null;
    else ledgerConflict = true;
  }

  const relatedLedgersResult = await db.prepare(
    `SELECT id, user_id, agent_id, event_type, point_type, amount, source_id, created_at
     FROM point_ledger_events
     WHERE source_id = ?
     ORDER BY created_at ASC, id ASC
     LIMIT 4`,
  )
    .bind(run.id)
    .all<LedgerRow>();
  const relatedLedgers = relatedLedgersResult.results;
  const exactRelatedLedger = run.settlement_ledger_id
    ? relatedLedgers.find((ledger) => ledger.id === run.settlement_ledger_id) ?? null
    : null;
  if (run.settlement_ledger_id && relatedLedgers.length !== 1) ledgerConflict = true;
  if (run.settlement_ledger_id && exactRelatedLedger === null) ledgerConflict = true;
  if (!run.settlement_ledger_id && relatedLedgers.length > 0) ledgerConflict = true;

  const exactLedgerValid = exactLedger !== null
    && exactLedger.id === run.settlement_ledger_id
    && exactLedger.source_id === run.id
    && exactLedger.user_id === run.user_id
    && exactLedger.agent_id === run.agent_id
    && exactLedger.event_type === "task_reward"
    && exactLedger.point_type === "pending_points"
    && Number.isFinite(exactLedger.amount)
    && exactLedger.amount > 0
    && relatedLedgers.length === 1
    && exactRelatedLedger?.id === exactLedger.id;
  if (exactLedger && !exactLedgerValid) ledgerConflict = true;
  if (run.settlement_ledger_id && !exactLedgerValid) ledgerConflict = true;
  if (ledgerConflict) {
    addWarning(warnings, "LEDGER_LINK_INCONSISTENT", "Settlement ledger linkage is inconsistent");
    dataIncomplete = true;
  }

  const trustedActualReward = typeof run.actual_reward === "number"
    && Number.isFinite(run.actual_reward)
    && run.actual_reward >= 0;
  let grossGp: number | null = null;
  let grossGpSource: SettlementSummary["grossGpSource"] = "none";
  if (exactLedgerValid && exactLedger) {
    grossGp = exactLedger.amount;
    grossGpSource = "ledger";
  } else if (
    run.execution_mode === "runtime"
    && !run.settlement_ledger_id
    && relatedLedgers.length === 0
    && !ledgerConflict
    && trustedActualReward
  ) {
    grossGp = run.actual_reward;
    grossGpSource = "inferred_legacy";
    addWarning(warnings, "ACTUAL_REWARD_INFERRED_LEGACY", "Actual reward was inferred from legacy work run facts");
  }

  const resolvedActualEnergy = resolveActualEnergy(run.actual_energy, warnings);

  let settlementStatus: SettlementSummary["status"] = "unknown";
  const settlementRow = settlementResult.results.length === 1 ? settlementResult.results[0] ?? null : null;
  if (run.execution_mode === "simulated") {
    settlementStatus = "not_eligible";
    grossGp = null;
    grossGpSource = "none";
  } else if (run.execution_mode === "external") {
    settlementStatus = "unknown";
  } else if (settlementConflict || ledgerConflict) {
    settlementStatus = "inconsistent";
    grossGp = null;
    grossGpSource = "none";
  } else if (!settlementRow) {
    settlementStatus = verification.status === "passed" || run.status === "completed"
      ? "unsettled"
      : "unknown";
  } else if (settlementRow.status === "completed") {
    const flagsValid = settlementRow.reward_applied === 1 && settlementRow.energy_applied === 1;
    const runFactsValid = run.settled === 1
      && run.settled_at !== null
      && run.actual_energy !== null
      && exactLedgerValid
      && exactLedger !== null
      && run.actual_reward === exactLedger.amount;
    if (flagsValid && runFactsValid) {
      settlementStatus = "settled";
    } else if (!run.settlement_ledger_id && settlementRow.reward_applied === 0) {
      settlementStatus = "unsettled";
    } else {
      settlementStatus = "inconsistent";
      settlementConflict = true;
      grossGp = null;
      grossGpSource = "none";
      addWarning(warnings, "SETTLEMENT_FACTS_INCONSISTENT", "Settlement completion facts are inconsistent");
      dataIncomplete = true;
    }
  } else if (settlementRow.status === "pending" || settlementRow.status === "failed") {
    settlementStatus = "unsettled";
  } else {
    settlementStatus = "unknown";
  }

  const steps: WorkReportStep[] = limitedStepRows.map((step) => ({
    id: step.id,
    sequence: step.step_order,
    name: sanitizeText(step.title, MAX_TITLE_CHARS)
      ?? sanitizeText(step.step_type, MAX_TITLE_CHARS)
      ?? "Work step",
    description: sanitizeText(step.description, MAX_DESCRIPTION_CHARS),
    status: mapStepStatus(step.status, warnings),
    startedAt: step.started_at,
    completedAt: step.completed_at,
    errorMessage: sanitizeText(step.error_message, MAX_ERROR_MESSAGE_CHARS),
  }));

  const runtimeExecutions: RuntimeExecutionSummary[] = allExecutionRows.map((row) => {
    const fact = allFacts.get(row.id);
    const inputTokens = safeNonNegative(row.input_tokens);
    const outputTokens = safeNonNegative(row.output_tokens);
    return {
      executionId: row.id,
      purpose: fact?.purpose ?? "unknown",
      stepId: fact?.stepId ?? null,
      parentExecutionId: row.parent_execution_id,
      recoveryOfExecutionId: row.recovery_of_execution_id,
      attemptNumber: row.attempt_number,
      status: mapExecutionStatus(row.status, warnings),
      modelName: sanitizeText(row.model_name, MAX_MODEL_NAME_CHARS),
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCostUsdMicros: safeNonNegative(row.estimated_cost_usd_micros),
      startedAt: row.started_at,
      completedAt: row.completed_at,
      durationMs: durationMs(row.started_at, row.completed_at),
      errorCode: sanitizeText(row.error_code, MAX_REASON_CODE_CHARS),
      errorMessage: null,
      isFinalEffectiveExecution: finalExecutionIds.has(row.id),
    };
  });

  const skillUsages: SkillUsageSummary[] = limitedUsageRows.map((row) => ({
    usageId: row.id,
    executionId: row.task_execution_id,
    skillDefinitionId: row.skill_definition_id,
    skillName: sanitizeText(row.skill_name, MAX_SKILL_NAME_CHARS)
      ?? sanitizeText(row.skill_definition_id, MAX_SKILL_NAME_CHARS)
      ?? "Skill",
    status: mapSkillUsageStatus(row.status, warnings),
    selectionRole: mapSelectionRole(row.selection_role),
    learnedLevel: Number.isInteger(row.learned_skill_level) ? row.learned_skill_level : null,
    runtimeVersion: Number.isInteger(row.runtime_version) ? row.runtime_version : null,
    inputTokens: safeNonNegative(row.input_tokens),
    outputTokens: safeNonNegative(row.output_tokens),
    estimatedCostUsdMicros: safeNonNegative(row.estimated_cost_usd_micros),
    errorCode: sanitizeText(row.error_code, MAX_REASON_CODE_CHARS),
    checksum: sanitizeText(row.runtime_checksum, MAX_SUMMARY_CHARS),
  }));

  const metrics = runtimeExecutions.reduce(
    (total, row) => ({
      inputTokens: total.inputTokens + row.inputTokens,
      outputTokens: total.outputTokens + row.outputTokens,
      totalTokens: total.totalTokens + row.totalTokens,
      estimatedCostUsdMicros: total.estimatedCostUsdMicros + row.estimatedCostUsdMicros,
    }),
    { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsdMicros: 0 },
  );

  if (warnings.some((warning) => warning.code === "UNRECOGNIZED_STATUS")) dataIncomplete = true;

  const recovery: RecoverySummary = {
    attempted: recoveryAttempted,
    recovered: recoveryRecovered,
    rootExecutionId: recoveryRootIds.length === 1 ? recoveryRootIds[0] ?? null : null,
    finalExecutionId: recoveryFinalIds.length === 1 ? recoveryFinalIds[0] ?? null : null,
    maxDepthObserved: grandchildRows.length > 0 ? 3 : recoveryAttempted ? 2 : produceRoots.length > 0 ? 1 : 0,
    status: dataIncomplete
      ? "unknown"
      : recoveryRecovered
        ? "succeeded"
        : recoveryInProgress
          ? "in_progress"
          : recoveryFailed
            ? "failed"
            : "not_needed",
  };

  const structuredResult = parseResearchBriefResult(
    run.research_brief_result_json,
    warnings,
  );
  const structuredResultUnavailable = structuredResult?.type === "unavailable";

  const finalEffectiveExecution = runtimeExecutions.find(
    (execution) => execution.isFinalEffectiveExecution && execution.status === "completed",
  ) ?? null;
  const fullRuntimeClosure = run.execution_mode === "runtime"
    && run.status === "completed"
    && finalEffectiveExecution !== null
    && verification.status === "passed"
    && verification.source === "workflow_step"
    && settlementStatus === "settled"
    && grossGpSource === "ledger"
    && !dataIncomplete
    && !recoveryInvalid;

  let kind = mapKind(run.execution_mode);
  if (fullRuntimeClosure) kind = "verified_runtime_work";
  else if (
    run.execution_mode === "runtime"
    && finalEffectiveExecution !== null
    && verification.status === "passed"
    && settlementStatus !== "settled"
    && settlementStatus !== "inconsistent"
    && !dataIncomplete
  ) kind = "runtime_unsettled";

  let overallStatus: WorkReportOverallStatus = mappedOverallStatus;
  if (dataIncomplete || settlementStatus === "inconsistent") overallStatus = "data_incomplete";
  else if (mappedOverallStatus === "in_progress" || recoveryInProgress) overallStatus = "in_progress";
  else if (mappedOverallStatus === "cancelled") overallStatus = "cancelled";
  else if (recoveryFailed) overallStatus = "recovery_failed";
  else if (
    run.execution_mode === "runtime"
    && finalEffectiveExecution === null
    && (run.status === "failed" || run.status === "completed")
  ) overallStatus = "failed";
  else if (verification.status === "failed") overallStatus = "verification_failed";
  else if (verification.status === "passed" && settlementStatus !== "settled") overallStatus = "unsettled";
  else if (fullRuntimeClosure) overallStatus = "completed";

  const safeTitle = sanitizeText(run.task_id, MAX_TITLE_CHARS) ?? "Work Report";
  let share: WorkReportShare = {
    allowed: false,
    text: null,
    blockedReason: "SAFE_SHARE_TEXT_UNAVAILABLE",
  };
  if (structuredResultUnavailable) share.blockedReason = "SAFE_SHARE_TEXT_UNAVAILABLE";
  else if (overallStatus === "data_incomplete") share.blockedReason = "DATA_INCOMPLETE";
  else if (run.execution_mode === "external") share.blockedReason = "EXTERNAL_VERIFICATION_UNKNOWN";
  else if (overallStatus === "in_progress") share.blockedReason = "WORK_IN_PROGRESS";
  else if (overallStatus === "recovery_failed") share.blockedReason = "RECOVERY_FAILED";
  else if (verification.status === "failed") share.blockedReason = "VERIFICATION_FAILED";
  else if (verification.status === "pending") share.blockedReason = "VERIFICATION_PENDING";
  else if (run.execution_mode === "runtime" && verification.status === "unknown") share.blockedReason = "VERIFICATION_UNKNOWN";
  else if (settlementStatus === "inconsistent") share.blockedReason = "SETTLEMENT_INCONSISTENT";
  else if (run.execution_mode === "runtime" && settlementStatus !== "settled") share.blockedReason = "SETTLEMENT_UNSETTLED";

  if (
    !structuredResultUnavailable
    && fullRuntimeClosure
    && overallStatus === "completed"
    && grossGp !== null
  ) {
    const text = sanitizeText(
      `Verified Runtime Work\nTask: ${safeTitle}\nVerification: passed\nGross GP: ${grossGp}\nTokens processed: ${metrics.totalTokens}`,
      MAX_SUMMARY_CHARS,
    );
    if (text) share = { allowed: true, text, blockedReason: null };
  } else if (
    !structuredResultUnavailable
    && run.execution_mode === "simulated"
    && overallStatus === "completed"
    && !dataIncomplete
  ) {
    const estimatedRewardLine = Number.isFinite(run.estimated_reward)
      ? `\nEstimated reward: ${Math.max(0, run.estimated_reward)} GP`
      : "";
    const text = sanitizeText(
      `Simulation Work Report\nTask: ${safeTitle}\nStatus: completed\nTokens processed: ${metrics.totalTokens}${estimatedRewardLine}\nSimulation only — not counted as formal work history.`,
      MAX_SUMMARY_CHARS,
    );
    if (text) share = { allowed: true, text, blockedReason: null };
  }

  const report: WorkReport = {
    version: "v1",
    runId: run.id,
    kind,
    overallStatus,
    title: safeTitle,
    description: null,
    outcomeSummary: null,
    startedAt: run.started_at,
    completedAt: run.completed_at,
    steps,
    runtimeExecutions,
    skillUsages,
    metrics,
    verification,
    recovery,
    settlement: {
      status: settlementStatus,
      settlementKey: run.id,
      grossGp,
      grossGpSource,
      actualReward: run.actual_reward,
      actualEnergy: resolvedActualEnergy,
      settledAt: run.settled_at,
    },
    structuredResult,
    warnings,
    share,
  };

  const warningCodes = Array.from(new Set(warnings.map((warning) => warning.code)));
  const audit: AdminWorkReportAudit | null = audience === "admin" ? {
    schemaVersion: "v1",
    generatedAt: new Date().toISOString(),
    userId: run.user_id,
    agentId: run.agent_id,
    runId: run.id,
    stepIds: steps.map((step) => step.id),
    executionIds: runtimeExecutions.map((execution) => execution.executionId),
    parentExecutionIds: Array.from(new Set(
      runtimeExecutions
        .map((execution) => execution.parentExecutionId)
        .filter((value): value is string => value !== null),
    )),
    recoveryOfExecutionIds: Array.from(new Set(
      runtimeExecutions
        .map((execution) => execution.recoveryOfExecutionId)
        .filter((value): value is string => value !== null),
    )),
    settlementKey: report.settlement.settlementKey,
    ledgerEventId: exactLedgerValid && exactLedger ? exactLedger.id : null,
    grossGpSource: report.settlement.grossGpSource,
    dataIncomplete: report.overallStatus === "data_incomplete",
    warningCodes,
    consistencyChecks: {
      runtime: warningCodes.some((code) =>
        code === "RUNTIME_LINK_MISSING" || code === "RUNTIME_LINK_INCONSISTENT"
      ) ? "inconsistent" : "consistent",
      recovery: warningCodes.some((code) => code.startsWith("RECOVERY_"))
        ? "inconsistent"
        : "consistent",
      verification: verification.source === "legacy_unknown"
        ? "unknown"
        : warningCodes.includes("VERIFICATION_FACTS_INCONSISTENT")
          ? "inconsistent"
          : "consistent",
      settlement: settlementStatus === "inconsistent"
        ? "inconsistent"
        : settlementStatus === "unknown"
          ? "unknown"
          : "consistent",
    },
  } : null;

  return { report, audit };
}


type WorkReportFixtureScenario =
  | "owner_access"
  | "simulation"
  | "verified_runtime"
  | "failed_runtime"
  | "direct_recovery_success"
  | "recovery_child_failed"
  | "recovery_self_reference"
  | "recovery_cycle"
  | "recovery_depth_three"
  | "recovery_cross_owner"
  | "recovery_cross_agent"
  | "recovery_cross_run"
  | "recovery_cross_step"
  | "verification_unknown"
  | "verification_failed"
  | "multiple_verify_steps"
  | "settlement_unsettled"
  | "ledger_wrong_owner"
  | "ledger_wrong_agent"
  | "ledger_wrong_source"
  | "ledger_wrong_event_type"
  | "ledger_wrong_point_type"
  | "ledger_invalid_amount"
  | "multiple_ledger_candidates"
  | "inferred_legacy_reward"
  | "actual_energy_zero"
  | "actual_energy_null_projection"
  | "research_brief_valid"
  | "research_brief_invalid_json"
  | "research_brief_invalid_root"
  | "research_brief_missing_summary"
  | "research_brief_blank_summary"
  | "research_brief_non_string_summary"
  | "research_brief_bad_sources"
  | "research_brief_javascript_url"
  | "research_brief_bad_fact"
  | "research_brief_bad_recommendations"
  | "research_brief_sources_20"
  | "research_brief_sources_21"
  | "research_brief_facts_40"
  | "research_brief_facts_41"
  | "research_brief_recommendations_20"
  | "research_brief_recommendations_21";

const WORK_REPORT_FIXTURE_SCENARIOS = new Set<WorkReportFixtureScenario>([
  "owner_access", "simulation", "verified_runtime", "failed_runtime",
  "direct_recovery_success", "recovery_child_failed", "recovery_self_reference",
  "recovery_cycle", "recovery_depth_three", "recovery_cross_owner",
  "recovery_cross_agent", "recovery_cross_run", "recovery_cross_step",
  "verification_unknown", "verification_failed", "multiple_verify_steps",
  "settlement_unsettled", "ledger_wrong_owner", "ledger_wrong_agent",
  "ledger_wrong_source", "ledger_wrong_event_type", "ledger_wrong_point_type",
  "ledger_invalid_amount", "multiple_ledger_candidates", "inferred_legacy_reward",
  "actual_energy_zero", "actual_energy_null_projection", "research_brief_valid", "research_brief_invalid_json",
  "research_brief_invalid_root", "research_brief_missing_summary",
  "research_brief_blank_summary", "research_brief_non_string_summary",
  "research_brief_bad_sources", "research_brief_javascript_url",
  "research_brief_bad_fact", "research_brief_bad_recommendations",
  "research_brief_sources_20", "research_brief_sources_21",
  "research_brief_facts_40", "research_brief_facts_41",
  "research_brief_recommendations_20", "research_brief_recommendations_21",
]);

function fixtureResearchBrief(scenario: WorkReportFixtureScenario): string | null {
  if (!scenario.startsWith("research_brief_")) return null;
  if (scenario === "research_brief_invalid_json") return '{"summary":"WR_SECRET_SENTINEL_fixture"';
  if (scenario === "research_brief_invalid_root") return '[]';
  const brief: Record<string, unknown> = {
    summary: "Safe summary",
    core_product: "Core product",
    target_users: "Target users",
    business_model: "Business model",
    team_background: "Team background",
    competition: "Competition",
    risks: "Risks",
    sources: ["https://username:password@example.com/path?token=WR_SECRET_SENTINEL_fixture#fragment"],
    fact_vs_judgment: [{ statement: "A fact", type: "fact" }],
    recommendations: ["Recommendation"],
  };
  if (scenario === "research_brief_missing_summary") delete brief.summary;
  if (scenario === "research_brief_blank_summary") brief.summary = "   ";
  if (scenario === "research_brief_non_string_summary") brief.summary = 7;
  if (scenario === "research_brief_bad_sources") brief.sources = [];
  if (scenario === "research_brief_javascript_url") brief.sources = ["javascript:WR_SECRET_SENTINEL_fixture"];
  if (scenario === "research_brief_bad_fact") brief.fact_vs_judgment = [{ statement: "", type: "other" }];
  if (scenario === "research_brief_bad_recommendations") brief.recommendations = ["   "];
  if (scenario === "research_brief_sources_20" || scenario === "research_brief_sources_21") {
    const count = scenario.endsWith("21") ? 21 : 20;
    brief.sources = Array.from({ length: count }, (_, i) => `https://example${i}.com/path?secret=WR_SECRET_SENTINEL_fixture#x`);
  }
  if (scenario === "research_brief_facts_40" || scenario === "research_brief_facts_41") {
    const count = scenario.endsWith("41") ? 41 : 40;
    brief.fact_vs_judgment = Array.from({ length: count }, (_, i) => ({ statement: `Fact ${i}`, type: i % 2 ? "judgment" : "fact" }));
  }
  if (scenario === "research_brief_recommendations_20" || scenario === "research_brief_recommendations_21") {
    const count = scenario.endsWith("21") ? 21 : 20;
    brief.recommendations = Array.from({ length: count }, (_, i) => `Recommendation ${i}`);
  }
  return JSON.stringify(brief);
}

type WorkReportFixtureStage =
  | "prerequisites"
  | "scenario_facts"
  | "postcheck";

class WorkReportFixtureError extends Error {
  constructor(readonly stage: WorkReportFixtureStage) {
    super("work_report_fixture_failed");
  }
}

async function createWorkReportFixture(
  db: D1Database,
  userId: string,
  agentId: string,
  scenario: WorkReportFixtureScenario,
): Promise<{
  runId: string;
  foreignRunId: string | null;
  ownerVerified: true;
  ledgerInserted?: true;
  relatedLedgerCount?: number;
  legacyActualRewardPresent?: true;
  settlementRecordPresent?: false;
  expectedMismatch?: "user" | "agent" | "source" | "event_type" | "point_type" | "amount" | "multiple_candidates";
}> {
  const suffix = crypto.randomUUID().replace(/-/g, "");
  const prefix = `wrf_${scenario}_${suffix}`;
  const runId = `${prefix}_run`;
  const foreignRunId = scenario === "owner_access" ? `${prefix}_foreign_run` : null;
  const produceStepId = `${prefix}_produce`;
  const verifyStepId = `${prefix}_verify`;
  const settleStepId = `${prefix}_settle`;
  const rootId = `${prefix}_root`;
  const childId = `${prefix}_child`;
  const grandchildId = `${prefix}_grandchild`;
  const ledgerId = `${prefix}_ledger`;
  const otherUserId = `${prefix}_other_user`;
  const otherAgentId = `${prefix}_other_agent`;
  const otherRunId = `${prefix}_other_run`;
  const otherStepId = `${prefix}_other_step`;
  const t0 = "2026-01-01T00:00:00.000Z";
  const t1 = "2026-01-01T00:01:00.000Z";
  const t2 = "2026-01-01T00:02:00.000Z";
  const simulation = scenario === "simulation";
  const failedRuntime = scenario === "failed_runtime";
  const recoveryScenario = scenario.startsWith("recovery_") || scenario === "direct_recovery_success";
  const childFailed = scenario === "recovery_child_failed";
  const verifyUnknown = scenario === "verification_unknown" || failedRuntime || recoveryScenario;
  const verifyFailed = scenario === "verification_failed";
  const inferredLegacy = scenario === "inferred_legacy_reward";
  const unsettled = scenario === "settlement_unsettled" || verifyUnknown || verifyFailed || failedRuntime || recoveryScenario;
  const shouldCreateCompletedSettlement = !simulation
    && !unsettled
    && !inferredLegacy;
  const executionMode = simulation ? "simulated" : "runtime";
  const runStatus = failedRuntime || childFailed ? "failed" : "completed";
  const actualEnergy = scenario === "actual_energy_zero" ? 0 : 5;
  const brief = fixtureResearchBrief(scenario);

  const prerequisiteStatements: D1PreparedStatement[] = [];
  const statements: D1PreparedStatement[] = [];
  const needsOtherIdentity = [
    "owner_access",
    "recovery_cross_owner",
    "recovery_cross_agent",
    "recovery_cross_run",
    "ledger_wrong_owner",
    "ledger_wrong_agent",
  ].includes(scenario);
  if (needsOtherIdentity) {
    prerequisiteStatements.push(
      db.prepare("INSERT INTO users (id, telegram_id, username) VALUES (?, ?, 'wr_fixture_other')")
        .bind(otherUserId, `${Date.now()}_${suffix}`),
      db.prepare("INSERT INTO agents (id, user_id, name) VALUES (?, ?, 'WR Fixture Other Agent')")
        .bind(otherAgentId, otherUserId),
    );
  }
  if (prerequisiteStatements.length > 0) {
    try {
      await db.batch(prerequisiteStatements);
      const otherUser = await db.prepare(
        "SELECT id FROM users WHERE id = ? LIMIT 1",
      ).bind(otherUserId).first<{ id: string }>();
      const otherAgent = await db.prepare(
        "SELECT id FROM agents WHERE id = ? AND user_id = ? LIMIT 1",
      ).bind(otherAgentId, otherUserId).first<{ id: string }>();
      if (!otherUser || !otherAgent) throw new WorkReportFixtureError("prerequisites");
    } catch (error) {
      if (error instanceof WorkReportFixtureError) throw error;
      throw new WorkReportFixtureError("prerequisites");
    }
  }
  if (scenario === "recovery_cross_run") {
    statements.push(
      db.prepare(`INSERT INTO agent_work_runs
        (id, agent_id, user_id, task_id, task_kind, execution_mode, status, current_step, total_steps, progress, estimated_reward, estimated_energy, actual_reward, actual_energy, settled, idempotency_key, started_at, completed_at)
        VALUES (?, ?, ?, 'wr_other_task', 'basic', 'runtime', 'completed', 1, 1, 100, 1, 1, 0, 1, 0, ?, ?, ?)`)
        .bind(otherRunId, agentId, userId, `${prefix}_other_idem`, t0, t2),
      db.prepare(`INSERT INTO agent_work_steps
        (id, run_id, step_order, step_type, title, status, started_at, completed_at)
        VALUES (?, ?, 1, 'produce', 'Other produce', 'completed', ?, ?)`)
        .bind(otherStepId, otherRunId, t0, t1),
    );
  }

  const ledgerScenario = scenario.startsWith("ledger_") || scenario === "multiple_ledger_candidates" || scenario === "verified_runtime" || scenario === "actual_energy_zero";
  const hasLedger = ledgerScenario;
  statements.push(
    db.prepare(`INSERT INTO agent_work_runs
      (id, agent_id, user_id, task_id, task_kind, execution_mode, status, current_step, total_steps, progress,
       estimated_reward, estimated_energy, actual_reward, actual_energy, settled, settled_at, settlement_ledger_id,
       idempotency_key, started_at, completed_at, research_brief_result_json)
      VALUES (?, ?, ?, ?, 'basic', ?, ?, 3, 3, 100, 123, 5, 123, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(runId, agentId, userId, `WR ${scenario}`, executionMode, runStatus, actualEnergy,
        hasLedger && !unsettled ? 1 : 0, hasLedger && !unsettled ? t2 : null,
        hasLedger ? ledgerId : null, `${prefix}_idem`, t0, t2, brief),
    db.prepare(`INSERT INTO agent_work_steps
      (id, run_id, step_order, step_type, title, description, status, output_summary, started_at, completed_at)
      VALUES (?, ?, 1, 'produce', 'Produce', 'Fixture produce', ?, NULL, ?, ?)`)
      .bind(produceStepId, runId, failedRuntime || recoveryScenario ? "failed" : "completed", t0, t1),
  );

  if (!verifyUnknown && !simulation) {
    statements.push(db.prepare(`INSERT INTO agent_work_steps
      (id, run_id, step_order, step_type, title, status, output_summary, error_message, started_at, completed_at)
      VALUES (?, ?, 2, 'verify', 'Verify', ?, ?, ?, ?, ?)`)
      .bind(verifyStepId, runId, verifyFailed ? "failed" : "completed",
        verifyFailed ? "Verification failed." : "Verification check passed.",
        verifyFailed ? "verification_failed" : null, t1, t2));
    if (scenario === "multiple_verify_steps") {
      statements.push(db.prepare(`INSERT INTO agent_work_steps
        (id, run_id, step_order, step_type, title, status, output_summary, started_at, completed_at)
        VALUES (?, ?, 3, 'verify', 'Verify duplicate', 'completed', 'Verification check passed.', ?, ?)`)
        .bind(`${prefix}_verify2`, runId, t1, t2));
    }
  }
  if (!simulation) {
    statements.push(db.prepare(`INSERT INTO agent_work_steps
      (id, run_id, step_order, step_type, title, status, started_at, completed_at)
      VALUES (?, ?, 4, 'settle', 'Settle', ?, ?, ?)`)
      .bind(settleStepId, runId, unsettled || inferredLegacy ? "pending" : "completed", t1, t2));
  }

  if (!simulation) {
    const rootStatus = failedRuntime || recoveryScenario ? "failed" : "completed";
    const rootError = recoveryScenario ? "timeout" : failedRuntime ? "model_execution_error" : null;
    statements.push(
      db.prepare(`INSERT INTO skill_runtime_executions
        (id, user_id, agent_id, task_type, idempotency_key, request_hash, status, input_tokens, output_tokens,
         estimated_cost_usd_micros, model_name, error_code, attempt_number, created_at, started_at, completed_at)
        VALUES (?, ?, ?, 'work_report_fixture', ?, ?, ?, 10, 20, 30, 'fixture-model', ?, 1, ?, ?, ?)`)
        .bind(rootId, userId, agentId, `${prefix}_root_idem`, `${prefix}_hash`, rootStatus, rootError, t0, t0, t1),
      db.prepare(`INSERT INTO work_step_runtime_executions
        (id, run_id, step_id, runtime_execution_id, purpose, created_at)
        VALUES (?, ?, ?, ?, 'produce', ?)`)
        .bind(`${prefix}_root_link`, runId, produceStepId, rootId, t0),
    );
  }

  if (recoveryScenario) {
    const crossOwner = scenario === "recovery_cross_owner";
    const crossAgent = scenario === "recovery_cross_agent";
    const crossRun = scenario === "recovery_cross_run";
    const crossStep = scenario === "recovery_cross_step";
    const selfRef = scenario === "recovery_self_reference";
    const childUser = crossOwner ? otherUserId : userId;
    const childAgent = crossAgent ? otherAgentId : agentId;
    const recoveryOf = selfRef ? childId : rootId;
    const childStatus = childFailed ? "timed_out" : "completed";
    statements.push(
      db.prepare(`INSERT INTO skill_runtime_executions
        (id, user_id, agent_id, task_type, idempotency_key, request_hash, status, input_tokens, output_tokens,
         estimated_cost_usd_micros, model_name, error_code, parent_execution_id, recovery_of_execution_id,
         attempt_number, created_at, started_at, completed_at)
        VALUES (?, ?, ?, 'work_report_fixture', ?, ?, ?, 5, 7, 11, 'fixture-model', ?, ?, ?, 2, ?, ?, ?)`)
        .bind(childId, childUser, childAgent, `${prefix}_child_idem`, `${prefix}_child_hash`, childStatus,
          childFailed ? "timeout" : null, rootId, recoveryOf, t1, t1, t2),
      db.prepare(`INSERT INTO work_step_runtime_executions
        (id, run_id, step_id, runtime_execution_id, purpose, created_at)
        VALUES (?, ?, ?, ?, 'recover', ?)`)
        .bind(`${prefix}_child_link`, crossRun ? otherRunId : runId,
          crossStep ? settleStepId : produceStepId, childId, t1),
    );
    if (scenario === "recovery_depth_three") {
      statements.push(
        db.prepare(`INSERT INTO skill_runtime_executions
          (id, user_id, agent_id, task_type, idempotency_key, request_hash, status, input_tokens, output_tokens,
           estimated_cost_usd_micros, model_name, parent_execution_id, recovery_of_execution_id,
           attempt_number, created_at, started_at, completed_at)
          VALUES (?, ?, ?, 'work_report_fixture', ?, ?, 'completed', 1, 1, 1, 'fixture-model', ?, ?, 3, ?, ?, ?)`)
          .bind(grandchildId, userId, agentId, `${prefix}_grand_idem`, `${prefix}_grand_hash`, childId, childId, t2, t2, t2),
      );
    }
    if (scenario === "recovery_cycle") {
      statements.push(db.prepare("UPDATE skill_runtime_executions SET recovery_of_execution_id = ? WHERE id = ?")
        .bind(childId, rootId));
    }
  }

  if (shouldCreateCompletedSettlement) {
    statements.push(db.prepare(`INSERT INTO work_run_settlements
      (run_id, status, reward_applied, energy_applied, created_at, updated_at)
      VALUES (?, 'completed', 1, 1, ?, ?)`)
      .bind(runId, t1, t2));
  } else if (!simulation && scenario === "settlement_unsettled") {
    statements.push(db.prepare(`INSERT INTO work_run_settlements
      (run_id, status, reward_applied, energy_applied, created_at, updated_at)
      VALUES (?, 'pending', 0, 0, ?, ?)`)
      .bind(runId, t1, t2));
  }

  if (hasLedger) {
    let ledgerUser = userId;
    let ledgerAgent = agentId;
    let ledgerSource = runId;
    let eventType = "task_reward";
    let pointType = "pending_points";
    let amount = 123;
    if (scenario === "ledger_wrong_owner") ledgerUser = otherUserId;
    if (scenario === "ledger_wrong_agent") ledgerAgent = otherAgentId;
    if (scenario === "ledger_wrong_source") ledgerSource = `${prefix}_wrong_source`;
    if (scenario === "ledger_wrong_event_type") eventType = "other";
    if (scenario === "ledger_wrong_point_type") pointType = "other_points";
    if (scenario === "ledger_invalid_amount") amount = 0;
    statements.push(db.prepare(`INSERT INTO point_ledger_events
      (id, user_id, agent_id, event_type, point_type, amount, source_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(ledgerId, ledgerUser, ledgerAgent, eventType, pointType, amount, ledgerSource, t2));
    if (scenario === "multiple_ledger_candidates") {
      statements.push(db.prepare(`INSERT INTO point_ledger_events
        (id, user_id, agent_id, event_type, point_type, amount, source_id, created_at)
        VALUES (?, ?, ?, 'task_reward', 'user_score', 1, ?, ?)`)
        .bind(`${prefix}_ledger2`, userId, agentId, runId, t2));
    }
  }

  if (foreignRunId) {
    statements.push(db.prepare(`INSERT INTO agent_work_runs
      (id, agent_id, user_id, task_id, task_kind, execution_mode, status, current_step, total_steps, progress,
       estimated_reward, estimated_energy, actual_reward, actual_energy, settled, idempotency_key, started_at, completed_at)
      VALUES (?, ?, ?, 'Foreign work', 'basic', 'simulated', 'completed', 0, 0, 100, 0, 0, 0, 0, 0, ?, ?, ?)`)
      .bind(foreignRunId, otherAgentId, otherUserId, `${prefix}_foreign_idem`, t0, t2));
  }

  try {
    await db.batch(statements);
  } catch {
    throw new WorkReportFixtureError("scenario_facts");
  }

  try {
    const ownerRow = await db.prepare(
      "SELECT id FROM agent_work_runs WHERE id = ? AND user_id = ? LIMIT 1",
    ).bind(runId, userId).first<{ id: string }>();
    if (!ownerRow) throw new WorkReportFixtureError("postcheck");

    if (inferredLegacy) {
      const settlementCount = await db.prepare(
        "SELECT COUNT(*) AS count FROM work_run_settlements WHERE run_id = ?",
      ).bind(runId).first<{ count: number }>();
      const relatedCount = await db.prepare(
        "SELECT COUNT(*) AS count FROM point_ledger_events WHERE source_id = ?",
      ).bind(runId).first<{ count: number }>();
      const legacyRun = await db.prepare(
        "SELECT actual_reward, settled, settled_at, settlement_ledger_id FROM agent_work_runs WHERE id = ? LIMIT 1",
      ).bind(runId).first<{
        actual_reward: number | null;
        settled: number;
        settled_at: string | null;
        settlement_ledger_id: string | null;
      }>();
      if (
        !legacyRun
        || typeof legacyRun.actual_reward !== "number"
        || legacyRun.settled !== 0
        || legacyRun.settled_at !== null
        || legacyRun.settlement_ledger_id !== null
        || Number(settlementCount?.count ?? 0) !== 0
        || Number(relatedCount?.count ?? 0) !== 0
      ) {
        throw new WorkReportFixtureError("postcheck");
      }
      return {
        runId,
        foreignRunId,
        ownerVerified: true,
        legacyActualRewardPresent: true,
        settlementRecordPresent: false,
        relatedLedgerCount: 0,
      };
    }

    if (hasLedger) {
      const ledgerCheck = await db.prepare(`
        SELECT
          CASE WHEN user_id = ? THEN 1 ELSE 0 END AS owner_matches,
          CASE WHEN agent_id = ? THEN 1 ELSE 0 END AS agent_matches,
          CASE WHEN source_id = ? THEN 1 ELSE 0 END AS source_matches
        FROM point_ledger_events
        WHERE id = ?
        LIMIT 1
      `).bind(userId, agentId, runId, ledgerId).first<{
        owner_matches: number;
        agent_matches: number;
        source_matches: number;
      }>();
      if (!ledgerCheck) throw new WorkReportFixtureError("postcheck");
      if (scenario === "ledger_wrong_owner") {
        if (ledgerCheck.owner_matches !== 0 || ledgerCheck.agent_matches !== 1 || ledgerCheck.source_matches !== 1) {
          throw new WorkReportFixtureError("postcheck");
        }
        return {
          runId,
          foreignRunId,
          ownerVerified: true,
          ledgerInserted: true,
          expectedMismatch: "user",
        };
      }
      if (scenario === "multiple_ledger_candidates") {
        const relatedCount = await db.prepare(
          "SELECT COUNT(*) AS count FROM point_ledger_events WHERE source_id = ?",
        ).bind(runId).first<{ count: number }>();
        if (Number(relatedCount?.count ?? 0) !== 2) {
          throw new WorkReportFixtureError("postcheck");
        }
        return {
          runId,
          foreignRunId,
          ownerVerified: true,
          ledgerInserted: true,
          relatedLedgerCount: 2,
          expectedMismatch: "multiple_candidates",
        };
      }
    }

    return { runId, foreignRunId, ownerVerified: true };
  } catch (error) {
    if (error instanceof WorkReportFixtureError) throw error;
    throw new WorkReportFixtureError("postcheck");
  }
}

export function registerV1WorkReport(
  app: Hono<{ Bindings: Bindings }>,
): void {
  app.post("/test/work-report-fixture", async (c) => {
    const testErr = requireTestMode(c);
    if (testErr) return testErr;
    const user = await requireUser(c);
    const agent = await c.env.DB.prepare(
      "SELECT id FROM agents WHERE user_id = ? LIMIT 1",
    ).bind(user.id).first<{ id: string }>();
    if (!agent) return c.json({ error: "agent_not_found" }, 404);
    const body = await c.req.json().catch(() => ({}));
    const scenario = typeof body.scenario === "string" ? body.scenario : "";
    if (!WORK_REPORT_FIXTURE_SCENARIOS.has(scenario as WorkReportFixtureScenario)) {
      return c.json({ error: "invalid_scenario" }, 400);
    }
    if (scenario === "actual_energy_null_projection") {
      const warnings: WorkReportWarning[] = [];
      const res = resolveActualEnergy(null, warnings);
      const isNull = res === null;
      const hasWarning = warnings.some(w => w.code === "ACTUAL_ENERGY_MISSING");
      return c.json({
        scenario: "actual_energy_null_projection",
        projectionChecked: true,
        actualEnergyIsNull: isNull,
        missingWarningPresent: hasWarning,
      }, 201);
    }
    try {
      const fixture = await createWorkReportFixture(
        c.env.DB,
        user.id,
        agent.id,
        scenario as WorkReportFixtureScenario,
      );
      return c.json({ scenario, ...fixture }, 201);
    } catch (error) {
      return c.json({
        error: "fixture_creation_failed",
        stage: error instanceof WorkReportFixtureError ? error.stage : "scenario_facts",
      }, 500);
    }
  });

  app.get("/work-runs/:runId/report", async (c) => {
    if (!c.req.header("x-telegram-init-data")) {
      return c.json({
        error: "telegram_auth_required",
        message: "Telegram authentication required",
      }, 401);
    }
    const user = await requireUser(c);
    const runId = c.req.param("runId");
    if (!validateWorkRunId(runId)) return c.json(NOT_FOUND_RESPONSE, 404);

    try {
      const run = await c.env.DB.prepare(
        `SELECT id, user_id, agent_id, task_id, status, execution_mode,
                started_at, completed_at, estimated_reward, actual_reward,
                estimated_energy, actual_energy, settled, settlement_ledger_id,
                settled_at, research_brief_result_json
         FROM agent_work_runs
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
      )
        .bind(runId, user.id)
        .first<WorkRunRow>();
      if (!run) return c.json(NOT_FOUND_RESPONSE, 404);
      const built = await buildWorkReport(c.env.DB, run, "user");
      return c.json({ report: built.report });
    } catch {
      return c.json(INTERNAL_ERROR_RESPONSE, 500);
    }
  });

  app.get("/admin/v1/work-runs/:runId/report", async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;
    const runId = c.req.param("runId");
    if (!validateWorkRunId(runId)) return c.json(NOT_FOUND_RESPONSE, 404);

    try {
      const run = await c.env.DB.prepare(
        `SELECT id, user_id, agent_id, task_id, status, execution_mode,
                started_at, completed_at, estimated_reward, actual_reward,
                estimated_energy, actual_energy, settled, settlement_ledger_id,
                settled_at, research_brief_result_json
         FROM agent_work_runs
         WHERE id = ?
         LIMIT 1`,
      )
        .bind(runId)
        .first<WorkRunRow>();
      if (!run) return c.json(NOT_FOUND_RESPONSE, 404);
      const built = await buildWorkReport(c.env.DB, run, "admin");
      if (!built.audit) return c.json(INTERNAL_ERROR_RESPONSE, 500);
      return c.json({ report: built.report, audit: built.audit });
    } catch {
      return c.json(INTERNAL_ERROR_RESPONSE, 500);
    }
  });
}
