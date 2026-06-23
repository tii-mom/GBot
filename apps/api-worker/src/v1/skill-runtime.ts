import { Hono, Context } from "hono";
import {
  Bindings,
  requireUser,
  id,
  parseJson,
} from "./core";
import { SKILL_RUNTIME_SEED } from "./skill-runtime-seed";

type AppContext = Context<{ Bindings: Bindings }>;

export interface SelectedSkillInfo {
  learnedSkillId: string;
  skillDefinitionId: string;
  code: string;
  name: string;
  level: number;
  runtimeVersionId: string;
  runtimeVersion: number;
  runtimeChecksum: string;
  selectionRole: "required" | "recommended" | "fallback";
}

export interface ModelCallResult {
  result: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsdMicros: number;
  modelName: string;
  retryCount: number;
}

export interface RuntimeModelProvider {
  execute(prompt: string, timeoutMs: number): Promise<ModelCallResult>;
  modelName: string;
}

// Global System Tools Whitelist
const SYSTEM_TOOLS = ["task_scanner", "task_planner", "basic_writer", "submission_assistant", "web_search", "web_browser"];

// Task Template Mappings
export interface TaskTemplate {
  required: string[];
  recommended: string[];
  fallback?: string[];
}

export const TASK_TEMPLATES: Record<string, TaskTemplate> = {
  project_research: {
    required: ["sd_res_project_research"],
    recommended: ["sd_ver_source_verification", "sd_res_information_summary"],
  },
  risk_review: {
    required: ["sd_ver_advanced_verification"],
    recommended: ["sd_ver_source_verification", "sd_ver_submission_checker"],
  },
  structured_content: {
    required: ["sd_con_structured_writing"],
    recommended: ["sd_res_information_summary"],
  },
  task_planning: {
    required: ["sd_aut_task_decomposition"],
    recommended: [],
    fallback: ["sd_exp_failure_recovery"],
  },
};

// Cryptographic hash helper using Web Crypto API
export async function sha256(text: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Decryption helper
async function decryptData(cipherText: string, secretKeyStr: string = "growthbot-secret"): Promise<string> {
  if (!cipherText) return "";
  if (!cipherText.endsWith("=") && cipherText.length % 4 !== 0) {
    if (cipherText.startsWith("enc:")) return cipherText.slice(4);
    return cipherText;
  }
  try {
    const binaryStr = atob(cipherText);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    if (bytes.length < 12) return cipherText;
    const iv = bytes.slice(0, 12);
    const encrypted = bytes.slice(12);
    const encoder = new TextEncoder();
    const keyHash = await crypto.subtle.digest("SHA-256", encoder.encode(secretKeyStr));
    const key = await crypto.subtle.importKey("raw", keyHash, { name: "AES-GCM" }, false, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    if (cipherText.startsWith("enc:")) return cipherText.slice(4);
    return cipherText;
  }
}

// Level Effect Instructions Mapping
function getLevelEffectInstruction(level: number): string {
  switch (level) {
    case 1:
      return "Level 1 Effect: Execute basic workflow steps.";
    case 2:
      return "Level 2 Effect: Add founder/source background verification check.";
    case 3:
      return "Level 3 Effect: Increase structural completeness and detail level.";
    case 4:
      return "Level 4 Effect: Add cross-source conflict detection and risk validation.";
    case 5:
      return "Level 5 Effect: Add final self-consistency and validation scan.";
    default:
      return "Execute basic workflow steps.";
  }
}

// Deterministic Mock Provider for Testing
export class DeterministicFakeProvider implements RuntimeModelProvider {
  constructor(private taskType: string, private isRecoveryAttempt: boolean) {}

  get modelName(): string {
    return "deterministic-test-model";
  }

  async execute(prompt: string, timeoutMs: number): Promise<ModelCallResult> {
    if (prompt.includes("FORCE_TIMEOUT")) {
      await new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout executing model task")), 150));
    }

    let result = "";
    if (this.taskType === "project_research") {
      result = JSON.stringify({
        overview: "Deterministic Project Research Overview",
        product: "Deterministic Product Features",
        team: "Deterministic Founders",
        business_model: "Deterministic Business Model",
        market: "Deterministic Market Size",
        risks: "Deterministic Risk Factors",
        unknowns: "Deterministic Unknowns",
        sources: ["https://example.com/project"]
      });
    } else if (this.taskType === "risk_review") {
      result = JSON.stringify({
        results: [
          {
            claim: "Fact verification check",
            status: "supported",
            type: "fact",
            evidence: "Verified via source documents",
            sources: ["https://example.com/source"]
          }
        ],
        status: "pass",
        issues: [],
        missing_items: [],
        revision_actions: []
      });
    } else if (this.taskType === "structured_content") {
      result = JSON.stringify({
        title: "Deterministic Structured Content Title",
        outline: ["Introduction", "Analysis", "Conclusion"],
        sections: [
          {
            header: "Introduction",
            text: "Content body text."
          }
        ],
        unverified_facts: [],
        formatted_content: "Full formatted content body."
      });
    } else if (this.taskType === "task_planning") {
      if (this.isRecoveryAttempt) {
        result = JSON.stringify({
          failure_type: "network_timeout",
          recovery_action: "retry",
          retry_attempted: true,
          status: "recovered",
          user_action_required: null,
          notes: "Recovered successfully on retry",
          steps: [
            {
              step_id: "step_1",
              goal: "Retry task action",
              dependencies: [],
              inputs: {},
              expected_output: "Success",
              verification: "Check exit code",
              risk: "low"
            }
          ]
        });
      } else {
        result = JSON.stringify({
          steps: [
            {
              step_id: "step_1",
              goal: "Decompose task objective",
              dependencies: [],
              inputs: {},
              expected_output: "Decomposed list",
              verification: "Verify all subtasks",
              risk: "low"
            }
          ]
        });
      }
    } else {
      throw new Error(`Unsupported task type: ${this.taskType}`);
    }

    return {
      result,
      inputTokens: 800,
      outputTokens: 350,
      estimatedCostUsdMicros: 330,
      modelName: this.modelName,
      retryCount: 0
    };
  }
}

// Live LLM Provider using user agent configurations
export class LlmProxyModelProvider implements RuntimeModelProvider {
  constructor(
    private db: any,
    private userId: string,
    private config: any,
    private secretKey?: string
  ) {}

  get modelName(): string {
    return this.config.model_id;
  }

  async execute(prompt: string, timeoutMs: number): Promise<ModelCallResult> {
    let apiKey: string | null = null;
    if (this.config.encrypted_api_key && this.secretKey) {
      try {
        apiKey = await decryptData(this.config.encrypted_api_key, this.secretKey);
      } catch (e) {
        console.error("Failed to decrypt API key", e);
      }
    }

    if (!this.config.base_url.startsWith("https://")) {
      throw new Error("Only https protocol is allowed.");
    }

    // Check dynamic provider allowlist
    const allowlist = (await this.db.prepare("SELECT * FROM agent_provider_allowlist WHERE status = 'active'").all()) as any;
    const inputUrl = new URL(this.config.base_url);
    const isAllowed = allowlist.results.some((item: any) => {
      try {
        return new URL(item.base_url).origin === inputUrl.origin;
      } catch {
        return false;
      }
    });
    if (!isAllowed) {
      throw new Error("Base URL not in allowlist.");
    }

    let targetUrl = this.config.base_url;
    if (!targetUrl.endsWith("/chat/completions") && !targetUrl.endsWith("/chat/completions/")) {
      targetUrl = targetUrl.replace(/\/+$/, "") + "/chat/completions";
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    let res: Response;
    try {
      res = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.config.model_id,
          messages: [
            { role: "system", content: "You are an AI assistant executing a task with specific skill runtime instructions." },
            { role: "user", content: prompt }
          ],
          temperature: 0.2
        }),
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.message?.includes("timeout") || err.message?.includes("aborted")) {
        throw new Error("Timeout executing model task");
      }
      throw err;
    }

    if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
      throw new Error("Redirects are forbidden to prevent SSRF.");
    }

    if (!res.ok) {
      throw new Error(`LLM API returned status ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error("No response body.");
    }

    let receivedLength = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedLength += value.length;
      if (receivedLength > 32 * 1024) {
        throw new Error("Response body exceeded maximum size limit of 32KB.");
      }
    }

    const responseBodyText = new TextDecoder().decode(
      new Uint8Array(chunks.reduce((acc, chunk) => acc.concat(Array.from(chunk)), [] as number[]))
    );

    const parsedJson = JSON.parse(responseBodyText);
    const content = parsedJson.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in response choices.");
    }

    const result = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const inputTokens = parsedJson.usage?.prompt_tokens || 0;
    const outputTokens = parsedJson.usage?.completion_tokens || 0;
    const estimatedCostUsdMicros = Math.ceil(inputTokens * 0.15 + outputTokens * 0.60);

    return {
      result,
      inputTokens,
      outputTokens,
      estimatedCostUsdMicros,
      modelName: this.config.model_id,
      retryCount: 0
    };
  }
}

export async function ensureSkillRuntimeSeedData(db: any): Promise<void> {
  const count = (await db.prepare("SELECT COUNT(*) AS cnt FROM skill_runtime_versions WHERE runtime_status = 'active'").first()) as any;
  if (count && Number(count.cnt) >= 8) return;

  const stmts = SKILL_RUNTIME_SEED.map(row =>
    db.prepare(`
      INSERT OR IGNORE INTO skill_runtime_versions
        (id, skill_definition_id, runtime_version, runtime_status, runtime_type, system_instructions, tool_policy_json, level_effects_json, checksum, created_at, activated_at)
      VALUES (?, ?, ?, 'active', 'prompt', ?, ?, ?, ?, '2026-06-22 00:00:00', '2026-06-22 00:00:00')
    `).bind(row.id, row.skill_definition_id, row.runtime_version, row.system_instructions, row.tool_policy_json, row.level_effects_json, row.checksum)
  );
  if (stmts.length > 0) await db.batch(stmts);
}

// Helper function to resolve skill selection
export async function resolveSkillsForTask(
  db: any,
  agentId: string,
  taskType: string,
  input: any
): Promise<{ selectedSkills: SelectedSkillInfo[]; missingRequiredSkills: string[] }> {
  const template = TASK_TEMPLATES[taskType];
  if (!template) {
    throw new Error(`Invalid task type: ${taskType}`);
  }

  // Fetch agent's active learned skills
  const learnedRows = (await db.prepare(`
    SELECT ls.*, d.code, d.name
    FROM agent_learned_skills ls
    JOIN agent_skill_definitions d ON ls.skill_definition_id = d.id
    WHERE ls.agent_id = ? AND ls.status = 'active'
  `).bind(agentId).all()) as any;

  // Fetch all active runtime versions
  const runtimeRows = (await db.prepare(`
    SELECT * FROM skill_runtime_versions WHERE runtime_status = 'active'
  `).all()) as any;

  const activeRuntimes = new Map<string, any>();
  for (const r of runtimeRows.results) {
    activeRuntimes.set(r.skill_definition_id, r);
  }

  let selectedSkills: SelectedSkillInfo[] = [];
  const missingRequiredSkills: string[] = [];

  // 1. Resolve Required
  for (const reqId of template.required) {
    const learned = learnedRows.results.find((s: any) => s.skill_definition_id === reqId);
    if (learned) {
      const runtime = activeRuntimes.get(reqId);
      if (!runtime) {
        throw new Error("runtime_configuration_missing");
      }
      const computed = await sha256(runtime.system_instructions);
      if (computed !== runtime.checksum) {
        throw new Error("runtime_checksum_mismatch");
      }
      selectedSkills.push({
        learnedSkillId: learned.id,
        skillDefinitionId: reqId,
        code: learned.code,
        name: learned.name,
        level: learned.skill_level,
        runtimeVersionId: runtime.id,
        runtimeVersion: runtime.runtime_version,
        runtimeChecksum: runtime.checksum,
        selectionRole: "required"
      });
    } else {
      missingRequiredSkills.push(reqId);
    }
  }

  // 2. Resolve Recommended (only if we are not executing recovery fallback)
  const isRecoveryAttempt = !!input?.isRecoveryAttempt;
  if (!isRecoveryAttempt) {
    for (const recId of template.recommended) {
      const learned = learnedRows.results.find((s: any) => s.skill_definition_id === recId);
      if (learned) {
        const runtime = activeRuntimes.get(recId);
        if (!runtime) {
          throw new Error("runtime_configuration_missing");
        }
        const computed = await sha256(runtime.system_instructions);
        if (computed !== runtime.checksum) {
          throw new Error("runtime_checksum_mismatch");
        }
        selectedSkills.push({
          learnedSkillId: learned.id,
          skillDefinitionId: recId,
          code: learned.code,
          name: learned.name,
          level: learned.skill_level,
          runtimeVersionId: runtime.id,
          runtimeVersion: runtime.runtime_version,
          runtimeChecksum: runtime.checksum,
          selectionRole: "recommended"
        });
      }
    }
  }

  // 3. Resolve Fallback (only if recovery attempt is triggered)
  if (isRecoveryAttempt && template.fallback) {
    for (const fbId of template.fallback) {
      const learned = learnedRows.results.find((s: any) => s.skill_definition_id === fbId);
      if (learned) {
        const runtime = activeRuntimes.get(fbId);
        if (!runtime) {
          throw new Error("runtime_configuration_missing");
        }
        const computed = await sha256(runtime.system_instructions);
        if (computed !== runtime.checksum) {
          throw new Error("runtime_checksum_mismatch");
        }
        selectedSkills.push({
          learnedSkillId: learned.id,
          skillDefinitionId: fbId,
          code: learned.code,
          name: learned.name,
          level: learned.skill_level,
          runtimeVersionId: runtime.id,
          runtimeVersion: runtime.runtime_version,
          runtimeChecksum: runtime.checksum,
          selectionRole: "fallback"
        });
      }
    }
  }

  // Enforce load limits
  if (selectedSkills.length > 3) {
    selectedSkills = selectedSkills.slice(0, 3);
  }

  return { selectedSkills, missingRequiredSkills };
}

export function registerV1SkillRuntime(app: Hono<{ Bindings: Bindings }>) {

  // GET /skills/runtime-status — Get runtime status of all 31 canonical skills
  app.get("/skills/runtime-status", async (c) => {
    const user = await requireUser(c);

    // Fetch active runtimes from database
    const runtimeRows = (await c.env.DB.prepare(`
      SELECT *
      FROM skill_runtime_versions
      WHERE runtime_status = 'active'
    `).all()) as any;

    if (runtimeRows.results.length < 8) {
      return c.json({ error: "runtime_configuration_missing", message: "Active skill runtimes are missing in the database" }, 400);
    }

    const runtimesMap = new Map<string, any>();
    for (const r of runtimeRows.results) {
      const computed = await sha256(r.system_instructions);
      if (computed !== r.checksum) {
        return c.json({ error: "runtime_checksum_mismatch", message: `Checksum mismatch for skill runtime: ${r.skill_definition_id}` }, 400);
      }
      runtimesMap.set(r.skill_definition_id, r);
    }

    // Fetch the 31 canonical skills from catalog acquisition rules
    const canonicalRows = (await c.env.DB.prepare(`
      SELECT d.id AS skillDefinitionId, r.canonical_code AS canonicalCode, r.catalog_name AS catalogName
      FROM agent_skill_definitions d
      JOIN skill_acquisition_rules r ON r.skill_definition_id = d.id
      WHERE r.is_canonical = 1
      ORDER BY r.catalog_name ASC
    `).all()) as any;

    const skills = canonicalRows.results.map((row: any) => {
      const active = runtimesMap.get(row.skillDefinitionId);
      return {
        skillDefinitionId: row.skillDefinitionId,
        canonicalCode: row.canonicalCode,
        catalogName: row.catalogName,
        runtimeStatus: active ? "active" : "planned",
        activeRuntimeVersion: active ? active.runtime_version : null
      };
    });

    const activeSkillsCount = skills.filter((s: any) => s.runtimeStatus === "active").length;
    const plannedSkillsCount = skills.filter((s: any) => s.runtimeStatus === "planned").length;

    return c.json({
      runtimeVersion: 1,
      activeRuntimeSkills: activeSkillsCount,
      plannedRuntimeSkills: plannedSkillsCount,
      skills
    });
  });

  // POST /agents/:agentId/runtime/preview — Preview runtime loading selection for a task type
  app.post("/agents/:agentId/runtime/preview", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");

    // Verify Agent ownership
    const agent = (await c.env.DB.prepare("SELECT * FROM agents WHERE id = ?").bind(agentId).first()) as any;
    if (!agent) {
      return c.json({ error: "agent_not_found", message: "Agent not found" }, 404);
    }
    if (agent.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "Access denied" }, 403);
    }

    const body = await c.req.json<any>().catch(() => ({}));
    const { taskType, input } = body;
    if (!taskType || !TASK_TEMPLATES[taskType]) {
      return c.json({ error: "invalid_task_type", message: `Invalid task type: ${taskType}` }, 400);
    }

    let resolution;
    try {
      resolution = await resolveSkillsForTask(c.env.DB, agentId, taskType, input || {});
    } catch (err: any) {
      if (err.message === "runtime_configuration_missing" || err.message === "runtime_checksum_mismatch") {
        return c.json({ error: err.message, message: `Skill runtime error: ${err.message}` }, 400);
      }
      throw err;
    }
    const { selectedSkills, missingRequiredSkills } = resolution;

    // Return public preview details only
    const publicSelected = selectedSkills.map((s) => ({
      skillDefinitionId: s.skillDefinitionId,
      canonicalCode: s.code,
      name: s.name,
      selectionRole: s.selectionRole,
      level: s.level,
      runtimeVersion: s.runtimeVersion
    }));

    return c.json({
      taskType,
      selectedSkills: publicSelected,
      missingRequiredSkills
    });
  });

  // POST /agents/:agentId/runtime/execute — Execute model task loading corresponding skill runtimes
  app.post("/agents/:agentId/runtime/execute", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");

    // Verify Agent ownership
    const agent = (await c.env.DB.prepare("SELECT * FROM agents WHERE id = ?").bind(agentId).first()) as any;
    if (!agent) {
      return c.json({ error: "agent_not_found", message: "Agent not found" }, 404);
    }
    if (agent.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "Access denied" }, 403);
    }

    const body = await c.req.json<any>();
    const { taskType, input, idempotencyKey } = body;

    if (!taskType || !TASK_TEMPLATES[taskType]) {
      return c.json({ error: "invalid_task_type", message: `Invalid task type: ${taskType}` }, 400);
    }
    if (!idempotencyKey) {
      return c.json({ error: "missing_idempotency_key", message: "Idempotency key is required" }, 400);
    }

    // Stable request hash calculation based on input & taskType
    const requestHash = await sha256(JSON.stringify({ taskType, input: input || {} }));

    // 1. Idempotency Check
    const existing = (await c.env.DB.prepare("SELECT * FROM skill_runtime_executions WHERE user_id = ? AND agent_id = ? AND idempotency_key = ?").bind(user.id, agentId, idempotencyKey).first()) as any;
    if (existing) {
      if (existing.request_hash === requestHash) {
        if (existing.status === "failed") {
          return c.json({
            error: "execution_failed",
            message: "Previous execution with this idempotency key failed",
            errorCode: existing.error_code
          }, 400);
        }
        return c.json({
          executionId: existing.id,
          taskType: existing.task_type,
          selectedSkills: parseJson(existing.selected_skills_json, []),
          missingRequiredSkills: [],
          result: parseJson(existing.result_json, {}),
          usage: {
            inputTokens: existing.input_tokens,
            outputTokens: existing.output_tokens,
            estimatedCostUsdMicros: existing.estimated_cost_usd_micros,
            modelName: existing.model_name,
            retryCount: existing.retry_count
          }
        });
      } else {
        return c.json({ error: "idempotency_conflict", message: "Idempotency key conflict with different parameters" }, 409);
      }
    }

    // 2. Resolve Skill selection
    let resolution;
    const executionId = id("exec");
    const startTime = new Date().toISOString();

    try {
      resolution = await resolveSkillsForTask(c.env.DB, agentId, taskType, input || {});
    } catch (err: any) {
      if (err.message === "runtime_configuration_missing" || err.message === "runtime_checksum_mismatch") {
        // Record failure in audit
        await c.env.DB.prepare(`
          INSERT INTO skill_runtime_executions
          (id, user_id, agent_id, task_type, idempotency_key, request_hash, status, error_code, created_at, started_at, completed_at, model_name)
          VALUES (?, ?, ?, ?, ?, ?, 'failed', ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, 'none')
        `).bind(executionId, user.id, agentId, taskType, idempotencyKey, requestHash, err.message, startTime).run();

        return c.json({ error: err.message, message: `Skill runtime error: ${err.message}` }, 400);
      }
      throw err;
    }
    const { selectedSkills, missingRequiredSkills } = resolution;

    // Reject if Required Skill is missing
    if (missingRequiredSkills.length > 0) {
      return c.json({
        error: "missing_required_skill",
        message: "Missing required skill for task execution",
        missingRequiredSkills
      }, 400);
    }

    const loadedSkillsWithInstructions: Array<{
      info: SelectedSkillInfo;
      instructions: string;
      allowedTools: string[];
    }> = [];

    for (const skill of selectedSkills) {
      const row = (await c.env.DB.prepare("SELECT * FROM skill_runtime_versions WHERE id = ?").bind(skill.runtimeVersionId).first()) as any;
      if (!row) {
        return c.json({ error: "runtime_not_found", message: `Runtime version ${skill.runtimeVersionId} not found` }, 500);
      }

      // Checksum validation
      const calculatedChecksum = await sha256(row.system_instructions);
      if (calculatedChecksum !== row.checksum || calculatedChecksum !== skill.runtimeChecksum) {
        // Record failure in audit
        await c.env.DB.prepare(`
          INSERT INTO skill_runtime_executions
          (id, user_id, agent_id, task_type, idempotency_key, request_hash, status, error_code, created_at, started_at, completed_at, model_name)
          VALUES (?, ?, ?, ?, ?, ?, 'failed', 'runtime_checksum_mismatch', CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, 'none')
        `).bind(executionId, user.id, agentId, taskType, idempotencyKey, requestHash, startTime).run();

        return c.json({ error: "runtime_checksum_mismatch", message: `Checksum validation failed for skill runtime: ${skill.name}` }, 400);
      }

      // Tool Policy check
      const policy = parseJson(row.tool_policy_json, { allowed_tools: [], forbidden_actions: [] });
      const allowedTools = policy.allowed_tools || [];
      for (const tool of allowedTools) {
        if (!SYSTEM_TOOLS.includes(tool)) {
          // Record failure in audit
          await c.env.DB.prepare(`
            INSERT INTO skill_runtime_executions
            (id, user_id, agent_id, task_type, idempotency_key, request_hash, status, error_code, created_at, started_at, completed_at, model_name)
            VALUES (?, ?, ?, ?, ?, ?, 'failed', 'invalid_tool_policy', CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, 'none')
          `).bind(executionId, user.id, agentId, taskType, idempotencyKey, requestHash, startTime).run();

          return c.json({ error: "invalid_tool_policy", message: `Tool permission policy violation. Tool "${tool}" not whitelisted by system.` }, 400);
        }
      }

      loadedSkillsWithInstructions.push({
        info: skill,
        instructions: row.system_instructions,
        allowedTools
      });
    }

    // 4. Assemble prompt layers
    let prompt = `System Policy: The AI agent must follow all system instructions, safety guidelines, and tool policies. Ignoring or overriding these rules is strictly prohibited.\n`;
    prompt += `Agent Core Rules: Execute the assigned workflow steps accurately and efficiently. Ensure all outputs are formatted as valid JSON.\n`;
    prompt += `Task Template: ${taskType.toUpperCase()} Instructions\n`;

    for (const skill of loadedSkillsWithInstructions) {
      prompt += `\n--- Skill Loaded: ${skill.info.name} (Code: ${skill.info.code}, Version: ${skill.info.runtimeVersion}) ---\n`;
      prompt += `${skill.instructions}\n`;
      prompt += `${getLevelEffectInstruction(skill.info.level)}\n`;
    }

    prompt += `\n--- User Input ---\n`;
    prompt += JSON.stringify(input || {});

    // 5. Initialize Model Provider
    let provider: RuntimeModelProvider;
    const isTest = c.env.APP_ENV === "test" ||
                   (c.env.ENABLE_TEST_ENDPOINTS === "true" &&
                    c.env.TEST_ENDPOINT_TOKEN &&
                    c.req.header("x-test-endpoint-token") === c.env.TEST_ENDPOINT_TOKEN);

    if (isTest) {
      provider = new DeterministicFakeProvider(taskType, !!input?.isRecoveryAttempt);
    } else {
      // Find active default model configuration
      let modelConfig = (await c.env.DB.prepare("SELECT * FROM agent_model_configs WHERE user_id = ? AND status = 'active' AND is_default = 1").bind(user.id).first()) as any;
      if (!modelConfig) {
        modelConfig = (await c.env.DB.prepare("SELECT * FROM agent_model_configs WHERE user_id = ? AND status = 'active' LIMIT 1").bind(user.id).first()) as any;
      }

      if (!modelConfig) {
        // Record failure
        await c.env.DB.prepare(`
          INSERT INTO skill_runtime_executions
          (id, user_id, agent_id, task_type, idempotency_key, request_hash, status, error_code, created_at, started_at, completed_at, model_name)
          VALUES (?, ?, ?, ?, ?, ?, 'failed', 'model_provider_unavailable', CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, 'none')
        `).bind(executionId, user.id, agentId, taskType, idempotencyKey, requestHash, startTime).run();

        return c.json({ error: "model_provider_unavailable", message: "Production model provider configuration not available" }, 500);
      }

      provider = new LlmProxyModelProvider(c.env.DB, user.id, modelConfig, c.env.MODEL_CONFIG_SECRET);
    }

    // 6. Execute Model call with timeout checking
    const timeoutMs = 15000;
    let callResult: ModelCallResult;
    try {
      callResult = await provider.execute(prompt, timeoutMs);
    } catch (err: any) {
      const isTimeout = err.message?.includes("Timeout");
      const errorCode = isTimeout ? "timeout" : "model_execution_error";

      // Save failed audit
      await c.env.DB.prepare(`
        INSERT INTO skill_runtime_executions
        (id, user_id, agent_id, task_type, idempotency_key, request_hash, status, error_code, created_at, started_at, completed_at, model_name)
        VALUES (?, ?, ?, ?, ?, ?, 'failed', ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, ?)
      `).bind(executionId, user.id, agentId, taskType, idempotencyKey, requestHash, errorCode, startTime, provider.modelName).run();

      // Insert usages as failed
      for (const skill of selectedSkills) {
        const usageId = id("usage");
        await c.env.DB.prepare(`
          INSERT INTO task_skill_runtime_usages (
            id, task_execution_id, user_id, agent_id, learned_skill_id, skill_definition_id,
            runtime_version_id, runtime_version, learned_skill_level, selection_role,
            runtime_checksum, status, error_code, created_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'failed', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(
          usageId, executionId, user.id, agentId, skill.learnedSkillId, skill.skillDefinitionId,
          skill.runtimeVersionId, skill.runtimeVersion, skill.level, skill.selectionRole,
          skill.runtimeChecksum, errorCode
        ).run();
      }

      return c.json({ error: errorCode, message: err.message }, isTimeout ? 408 : 500);
    }

    // 7. Save Successful Execution
    const completedTime = new Date().toISOString();
    const publicSelectedPublicInfo = selectedSkills.map((s) => ({
      skillDefinitionId: s.skillDefinitionId,
      canonicalCode: s.code,
      name: s.name,
      selectionRole: s.selectionRole,
      level: s.level,
      runtimeVersion: s.runtimeVersion
    }));

    await c.env.DB.prepare(`
      INSERT INTO skill_runtime_executions (
        id, user_id, agent_id, task_type, idempotency_key, request_hash, status,
        selected_skills_json, input_json, result_json, input_tokens, output_tokens,
        estimated_cost_usd_micros, model_name, retry_count, created_at, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).bind(
      executionId, user.id, agentId, taskType, idempotencyKey, requestHash,
      JSON.stringify(publicSelectedPublicInfo), JSON.stringify(input || {}), callResult.result,
      callResult.inputTokens, callResult.outputTokens, callResult.estimatedCostUsdMicros,
      callResult.modelName, startTime, startTime, completedTime
    ).run();

    // Save individual skill usages
    for (const skill of selectedSkills) {
      const usageId = id("usage");
      await c.env.DB.prepare(`
        INSERT INTO task_skill_runtime_usages (
          id, task_execution_id, user_id, agent_id, learned_skill_id, skill_definition_id,
          runtime_version_id, runtime_version, learned_skill_level, selection_role,
          runtime_checksum, status, input_tokens, output_tokens, estimated_cost_usd_micros, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        usageId, executionId, user.id, agentId, skill.learnedSkillId, skill.skillDefinitionId,
        skill.runtimeVersionId, skill.runtimeVersion, skill.level, skill.selectionRole,
        skill.runtimeChecksum, Math.ceil(callResult.inputTokens / selectedSkills.length),
        Math.ceil(callResult.outputTokens / selectedSkills.length),
        Math.ceil(callResult.estimatedCostUsdMicros / selectedSkills.length)
      ).run();
    }

    // Return result structure
    return c.json({
      executionId,
      taskType,
      selectedSkills: publicSelectedPublicInfo,
      missingRequiredSkills: [],
      result: JSON.parse(callResult.result),
      usage: {
        inputTokens: callResult.inputTokens,
        outputTokens: callResult.outputTokens,
        estimatedCostUsdMicros: callResult.estimatedCostUsdMicros,
        modelName: callResult.modelName,
        retryCount: 0
      }
    });
  });
}
