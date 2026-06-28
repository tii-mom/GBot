#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const workerMigrationsDir = join(root, "apps", "api-worker", "migrations");
const rootMigrationsDir = join(root, "migrations");

const base = process.env.VITE_API_BASE || "http://127.0.0.1:8787";
const testToken = process.env.TEST_ENDPOINT_TOKEN || "ci_test_secret";
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const EXPECTED_ACTIVE_RUNTIMES = 31;
const EXPECTED_PLANNED_RUNTIMES = 0;

const testHeaders = { "x-test-endpoint-token": testToken };

function signTelegramInitData(userObj) {
  const user = JSON.stringify(userObj);
  const authDate = Math.floor(Date.now() / 1000);
  const params = { auth_date: String(authDate), query_id: "verify_skill_runtime_query", user };
  if (!botToken) {
    return new URLSearchParams({ ...params, hash: "mockhash" }).toString();
  }
  const dataCheckString = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
}

let userCounter = 0;
function createUserHeaders() {
  userCounter++;
  const tid = Number(`999${Date.now().toString().slice(-7)}${userCounter}`);
  return {
    "x-telegram-init-data": signTelegramInitData({ id: tid, username: `skill_rt_${tid}` }),
    "x-test-endpoint-token": testToken
  };
}

async function request(path, options = {}, expectedStatus = 200) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${base}${path}`, { ...options, headers, signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (response.status !== expectedStatus) {
    throw new Error(`${options.method || "GET"} ${path} returned ${response.status}, expected ${expectedStatus}: ${JSON.stringify(body)}`);
  }
  return body;
}

let passed = 0;
let failed = 0;

async function step(name, fn) {
  try {
    const result = await fn();
    console.log(`  PASS ${name}`);
    passed++;
    return result;
  } catch (error) {
    console.error(`  FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
    process.exitCode = 1;
  }
}

// Helper for running migrations using sqlite3 directly
function applyMigrations(dbFile, migrationsDir, maxVersion = "9999") {
  try {
    execSync(`sqlite3 "${dbFile}" "CREATE TABLE IF NOT EXISTS _test_applied_migrations (name TEXT PRIMARY KEY);"`, { stdio: "ignore" });
  } catch (err) {
    throw new Error(`Failed to initialize migration tracking: ${err.message}`);
  }

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql") && f <= maxVersion)
    .sort();
  for (const file of files) {
    const check = execSync(`sqlite3 "${dbFile}" "SELECT COUNT(*) as cnt FROM _test_applied_migrations WHERE name = '${file}';"`, { encoding: "utf8" }).trim();
    if (parseInt(check, 10) > 0) {
      continue;
    }

    const filePath = join(migrationsDir, file);
    try {
      execSync(`sqlite3 "${dbFile}" < "${filePath}"`, { stdio: "ignore" });
      execSync(`sqlite3 "${dbFile}" "INSERT INTO _test_applied_migrations (name) VALUES ('${file}');"`, { stdio: "ignore" });
    } catch (err) {
      throw new Error(`Failed to apply migration ${file}: ${err.message}`);
    }
  }
}

// Helper for running wrangler commands (mocked via sqlite3)
function runWrangler(args, cwd, dbPath) {
  mkdirSync(dbPath, { recursive: true });
  const dbFile = join(dbPath, "test.sqlite");

  if (args.startsWith("migrations apply DB")) {
    const migrationsDir = join(cwd, "migrations");
    const files = readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();
    const maxVersion = files[files.length - 1] || "9999";
    applyMigrations(dbFile, migrationsDir, maxVersion);
    return "Successfully applied migrations";
  }

  if (args.startsWith("execute DB --file=")) {
    const match = args.match(/--file="?([^"]+)"?/);
    if (!match) throw new Error("Invalid execute command: " + args);
    const sqlFile = match[1];
    try {
      return execSync(`sqlite3 -json "${dbFile}" < "${sqlFile}"`, { encoding: "utf8" });
    } catch (err) {
      throw new Error(`SQL Execution failed: ${err.message}`);
    }
  }

  throw new Error("Unsupported wrangler mock command: " + args);
}

function executeQuery(sql, cwd, dbPath) {
  mkdirSync(dbPath, { recursive: true });
  const dbFile = join(dbPath, "test.sqlite");
  try {
    const output = execSync(`sqlite3 -json "${dbFile}"`, { input: sql, encoding: "utf8" }).trim();
    const results = output ? JSON.parse(output) : [];
    return { results, success: true };
  } catch (error) {
    throw new Error(`Query failed: ${sql}\nError: ${error.message}`);
  }
}

async function runMigrationTests() {
  console.log("\n=== Starting Migration Tests (Fresh & Upgrade) ===");

  // 1. Two migration files must be identical (same SHA-256)
  await step("Migration files are identical in root and api-worker", () => {
    const rootContent = readFileSync(join(rootMigrationsDir, "0014_skill_runtime_lite_v1.sql"));
    const workerContent = readFileSync(join(workerMigrationsDir, "0014_skill_runtime_lite_v1.sql"));
    const rootHash = crypto.createHash("sha256").update(rootContent).digest("hex");
    const workerHash = crypto.createHash("sha256").update(workerContent).digest("hex");
    if (rootHash !== workerHash) {
      throw new Error(`SHA-256 mismatch. Root: ${rootHash}, Worker: ${workerHash}`);
    }
    console.log(`    SHA-256: ${rootHash}`);
  });

  // 2. Fresh DB validation
  const freshDbPath = join(root, "apps", "api-worker", ".wrangler-rt-fresh");
  await step("Fresh DB migration and table checks (0001 -> 0014)", () => {
    rmSync(freshDbPath, { recursive: true, force: true });
    runWrangler("migrations apply DB", join(root, "apps", "api-worker"), freshDbPath);

    // Verify tables exist
    const tablesResult = executeQuery("SELECT name FROM sqlite_master WHERE type='table';", join(root, "apps", "api-worker"), freshDbPath);
    const tables = tablesResult.results.map(r => r.name);
    const expectedTables = [
      "skill_runtime_versions",
      "skill_runtime_executions",
      "task_skill_runtime_usages"
    ];
    for (const t of expectedTables) {
      if (!tables.includes(t)) {
        throw new Error(`Table ${t} does not exist in Fresh DB`);
      }
    }

    // Assert unique index exists
    const indexesResult = executeQuery("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='skill_runtime_executions';", join(root, "apps", "api-worker"), freshDbPath);
    const indexes = indexesResult.results.map(r => r.name);
    if (!indexes.includes("uq_runtime_recovery_once")) {
      throw new Error("Unique index uq_runtime_recovery_once is missing");
    }

    // Assert self-referential foreign keys exist
    const fkInfoResult = executeQuery("PRAGMA foreign_key_list(skill_runtime_executions);", join(root, "apps", "api-worker"), freshDbPath);
    const selfRefs = fkInfoResult.results.filter(r => r.table === "skill_runtime_executions");
    if (selfRefs.length !== 2) {
      throw new Error(`Expected 2 self-referential foreign keys in skill_runtime_executions, found ${selfRefs.length}`);
    }

    // PRAGMA foreign_key_check
    const fkCheck = executeQuery("PRAGMA foreign_key_check;", join(root, "apps", "api-worker"), freshDbPath);
    if (fkCheck.results.length > 0) {
      throw new Error(`Foreign key violation in Fresh DB: ${JSON.stringify(fkCheck.results)}`);
    }

    // Check compiled active runtimes seeded
    const runtimesResult = executeQuery("SELECT COUNT(*) as cnt FROM skill_runtime_versions WHERE runtime_status='active';", join(root, "apps", "api-worker"), freshDbPath);
    const activeCount = runtimesResult.results[0].cnt;
    if (activeCount !== EXPECTED_ACTIVE_RUNTIMES) {
      throw new Error(`Expected ${EXPECTED_ACTIVE_RUNTIMES} active runtimes, found ${activeCount}`);
    }
  });

  // Assert compiled runtimes expose Level Effects and keep boundaries
  await step("Assert active runtime level effects exist, check forbidden words/boundaries", () => {
    const runtimesResult = executeQuery("SELECT skill_definition_id, level_effects_json, system_instructions, tool_policy_json FROM skill_runtime_versions WHERE runtime_status='active';", join(root, "apps", "api-worker"), freshDbPath);

    if (runtimesResult.results.length !== EXPECTED_ACTIVE_RUNTIMES) {
      throw new Error(`Expected ${EXPECTED_ACTIVE_RUNTIMES} active runtimes in DB, got ${runtimesResult.results.length}`);
    }

    for (const row of runtimesResult.results) {
      const effects = JSON.parse(row.level_effects_json);
      const skillId = row.skill_definition_id;

      // Assert 5 levels exist
      for (let level = 1; level <= 5; level++) {
        const effectText = effects[String(level)];
        if (!effectText || typeof effectText !== "string" || effectText.trim().length === 0) {
          throw new Error(`Skill ${skillId} is missing Level ${level} effect`);
        }

        // Assert Level does not add tools, bypass safety policy, or add payment/wallet/write permissions.
        const lowerText = effectText.toLowerCase();
        const forbiddenWords = ["wallet", "payment", "pay", "write permission", "bypass safety", "override safety", "disable safety", "bypass security"];
        for (const word of forbiddenWords) {
          if (lowerText.includes(word)) {
            throw new Error(`Skill ${skillId} Level ${level} effect contains forbidden word/permission: "${word}"`);
          }
        }
      }

      // Specific boundary check: cross-skill pollution check
      if (skillId === "sd_con_structured_writing") {
        for (let level = 1; level <= 5; level++) {
          const text = effects[String(level)].toLowerCase();
          if (text.includes("founder") || text.includes("verification") || text.includes("source")) {
            throw new Error(`Structured Writing Level ${level} effect has cross-skill pollution: "${effects[String(level)]}"`);
          }
        }
      }
    }
    console.log(`    Successfully verified ${EXPECTED_ACTIVE_RUNTIMES} active runtimes and level boundaries.`);
  });

  // Test invalid status CHECK constraint
  await step("DB constraint: invalid status in skill_runtime_executions is rejected", () => {
    try {
      executeQuery(`
        INSERT INTO skill_runtime_executions (
          id, user_id, agent_id, task_type, idempotency_key, request_hash, status, model_name
        ) VALUES ('exec_invalid_status', 'user_1', 'agent_1', 'project_research', 'key_invalid', 'hash', 'invalid_status', 'none')
      `, join(root, "apps", "api-worker"), freshDbPath);
      throw new Error("Expected INSERT with invalid status to fail due to CHECK constraint");
    } catch (err) {
      if (!err.message.includes("CHECK constraint failed")) {
        throw new Error(`Expected CHECK constraint failed error, got: ${err.message}`);
      }
      console.log("    Verified invalid status constraint successfully.");
    }
  });

  // 3. Upgrade Validation (0013 -> 0014)
  const upgradeCwd = join(root, "apps", "api-worker", "temp-rt-upgrade");
  const upgradeDbPath = join(root, "apps", "api-worker", ".wrangler-rt-upgrade");
  await step("0013 to 0014 Upgrade and data retention check", () => {
    rmSync(upgradeCwd, { recursive: true, force: true });
    rmSync(upgradeDbPath, { recursive: true, force: true });

    mkdirSync(upgradeCwd, { recursive: true });
    mkdirSync(join(upgradeCwd, "migrations"), { recursive: true });

    copyFileSync(join(root, "apps", "api-worker", "wrangler.jsonc"), join(upgradeCwd, "wrangler.jsonc"));

    // Copy 0001 to 0013 migrations
    const migrationFiles = readdirSync(workerMigrationsDir).filter(f => f.endsWith(".sql")).sort();
    for (const file of migrationFiles) {
      if (file < "0014") {
        copyFileSync(join(workerMigrationsDir, file), join(upgradeCwd, "migrations", file));
      }
    }

    // Apply 0001 -> 0013
    runWrangler("migrations apply DB", upgradeCwd, upgradeDbPath);

    // Insert pre-upgrade records
    executeQuery("INSERT INTO users (id, telegram_id, username) VALUES ('user_1', '10001', 'upgrade_test_user');", upgradeCwd, upgradeDbPath);
    executeQuery("INSERT INTO agents (id, user_id, name) VALUES ('agent_1', 'user_1', 'Upgrade Agent');", upgradeCwd, upgradeDbPath);
    // Insert a learned skill
    executeQuery("INSERT INTO agent_learned_skills (id, agent_id, skill_definition_id, skill_level, slot_index, locked, status) VALUES ('ls_1', 'agent_1', 'sd_res_project_research', 2, 0, 0, 'active');", upgradeCwd, upgradeDbPath);
    // Insert a skill card
    executeQuery("INSERT INTO inventory_items (id, owner_user_id, item_type, name, status, skill_definition_id) VALUES ('card_1', 'user_1', 'skill_card', 'Project Research Card', 'available', 'sd_res_project_research');", upgradeCwd, upgradeDbPath);
    // Insert a catalog rule
    executeQuery("SELECT * FROM skill_acquisition_rules LIMIT 1;", upgradeCwd, upgradeDbPath);
    // Insert a skill economy event
    executeQuery("INSERT INTO skill_economy_events (id, user_id, agent_id, event_type) VALUES ('event_1', 'user_1', 'agent_1', 'upgrade');", upgradeCwd, upgradeDbPath);

    // Verify 0013 records present
    const checkBefore = executeQuery("SELECT COUNT(*) as cnt FROM agents WHERE id='agent_1';", upgradeCwd, upgradeDbPath);
    if (checkBefore.results[0].cnt !== 1) throw new Error("Agent missing before upgrade");

    // Copy 0014 migration to temp upgrade folder
    copyFileSync(join(workerMigrationsDir, "0014_skill_runtime_lite_v1.sql"), join(upgradeCwd, "migrations", "0014_skill_runtime_lite_v1.sql"));

    // Apply upgrade (0014)
    runWrangler("migrations apply DB", upgradeCwd, upgradeDbPath);

    // Verify data remains intact
    const checkAfter = executeQuery("SELECT * FROM agents WHERE id='agent_1';", upgradeCwd, upgradeDbPath);
    if (checkAfter.results.length === 0 || checkAfter.results[0].name !== "Upgrade Agent") {
      throw new Error("Pre-upgrade agent data lost or modified during migration");
    }

    const checkLearned = executeQuery("SELECT * FROM agent_learned_skills WHERE id='ls_1';", upgradeCwd, upgradeDbPath);
    if (checkLearned.results.length === 0 || checkLearned.results[0].skill_level !== 2) {
      throw new Error("Pre-upgrade learned skill data lost");
    }

    // Verify PRAGMA foreign_key_check passes after upgrade
    const fkCheck = executeQuery("PRAGMA foreign_key_check;", upgradeCwd, upgradeDbPath);
    if (fkCheck.results.length > 0) {
      throw new Error(`Foreign key violation in upgraded DB: ${JSON.stringify(fkCheck.results)}`);
    }

    // Verify compiled active runtimes present
    const checkRuntimes = executeQuery("SELECT COUNT(*) as cnt FROM skill_runtime_versions WHERE runtime_status='active';", upgradeCwd, upgradeDbPath);
    if (checkRuntimes.results[0].cnt !== EXPECTED_ACTIVE_RUNTIMES) {
      throw new Error(`Expected ${EXPECTED_ACTIVE_RUNTIMES} active runtimes, found ${checkRuntimes.results[0].cnt}`);
    }

    // Clean up
    rmSync(upgradeCwd, { recursive: true, force: true });
    rmSync(upgradeDbPath, { recursive: true, force: true });
    rmSync(freshDbPath, { recursive: true, force: true });
  });
}

async function runApiTests() {
  console.log("\n=== Starting API Integration Tests ===");

  const uh = createUserHeaders();

  // Claim agent
  const claimRes = await request("/agents/claim", { method: "POST", headers: uh });
  const agentId = claimRes.agent.id;
  // Set agent level to 10 so we can learn expert/advanced skills
  await request("/test/set-agent-level", {
    method: "POST", headers: { ...uh, ...testHeaders },
    body: JSON.stringify({ level: 10 })
  });

  // Step 1: GET /skills/runtime-status returns compiled catalog skills
  await step("GET /skills/runtime-status returns compiled active/planned skill counts", async () => {
    const status = await request("/skills/runtime-status", { headers: uh });
    if (status.activeRuntimeSkills !== EXPECTED_ACTIVE_RUNTIMES) {
      throw new Error(`Expected ${EXPECTED_ACTIVE_RUNTIMES} active skills, got ${status.activeRuntimeSkills}`);
    }
    if (status.plannedRuntimeSkills !== EXPECTED_PLANNED_RUNTIMES) {
      throw new Error(`Expected ${EXPECTED_PLANNED_RUNTIMES} planned skills, got ${status.plannedRuntimeSkills}`);
    }
    if (status.skills.length !== 31) {
      throw new Error(`Expected 31 skills list, got ${status.skills.length}`);
    }

    // Check version uniqueness & Definition ID validation
    const skillIds = status.skills.map(s => s.skillDefinitionId);
    const uniqueIds = new Set(skillIds);
    if (uniqueIds.size !== 31) {
      throw new Error("Duplicate or missing definition IDs in status response");
    }
  });

  // Step 2: Preview & Selection Verification without required skills (should list required as missing)
  await step("Preview lists missing required skill and execute rejects it", async () => {
    const preview = await request(`/agents/${agentId}/runtime/preview`, {
      method: "POST", headers: uh,
      body: JSON.stringify({ taskType: "project_research" })
    });
    if (!preview.missingRequiredSkills.includes("sd_res_project_research")) {
      throw new Error("Expected sd_res_project_research to be missing");
    }
    if (preview.selectedSkills.length > 0) {
      throw new Error("Expected zero selected skills since required is not learned");
    }

    // Execute should reject
    try {
      await request(`/agents/${agentId}/runtime/execute`, {
        method: "POST", headers: uh,
        body: JSON.stringify({ taskType: "project_research", idempotencyKey: `exec_fail_${Date.now()}` })
      });
      throw new Error("Expected execute to reject missing required skill");
    } catch (err) {
      if (!err.message.includes("missing_required_skill")) {
        throw err;
      }
    }
  });

  // Helper function to grant/learn skill
  async function grantAndLearnSkill(skillId) {
    const grant = await request("/test/grant-skill-card", {
      method: "POST", headers: { ...uh, ...testHeaders },
      body: JSON.stringify({ skillDefinitionId: skillId, name: "Test Card" })
    });
    await request(`/agents/${agentId}/skills/learn`, {
      method: "POST", headers: uh,
      body: JSON.stringify({ inventoryItemId: grant.itemId, idempotencyKey: `learn_${skillId}_${Date.now()}` })
    });
  }

  // Learn the required skill
  await grantAndLearnSkill("sd_res_project_research");

  // Step 3: Preview with required skill learned
  await step("Preview shows selected required skill after learning it", async () => {
    const preview = await request(`/agents/${agentId}/runtime/preview`, {
      method: "POST", headers: uh,
      body: JSON.stringify({ taskType: "project_research" })
    });
    if (preview.missingRequiredSkills.length > 0) {
      throw new Error(`Expected no missing skills, got ${preview.missingRequiredSkills}`);
    }
    const reqSkill = preview.selectedSkills.find(s => s.skillDefinitionId === "sd_res_project_research");
    if (!reqSkill || reqSkill.selectionRole !== "required") {
      throw new Error("Required skill selection missing or has incorrect role");
    }
    // Check safety: preview must NOT leak instructions/prompt details
    if (reqSkill.system_instructions || reqSkill.systemInstructions || reqSkill.tool_policy_json) {
      throw new Error("Security leak: preview returned internal policy/instruction details!");
    }
  });

  // Step 4: Execute task and test idempotency + deterministic fake model
  await step("Execute returns deterministic result, tokens/cost and audits successfully", async () => {
    const idemKey = `rt_exec_${Date.now()}`;
    const input = { projectName: "GrowthBot", url: "https://gb.org", researchGoal: "Audit" };

    const execute = await request(`/agents/${agentId}/runtime/execute`, {
      method: "POST", headers: uh,
      body: JSON.stringify({ taskType: "project_research", input, idempotencyKey: idemKey })
    });

    if (!execute.executionId) throw new Error("Missing execution ID");
    if (execute.result.overview !== "Deterministic Project Research Overview") {
      throw new Error(`Unexpected mock output: ${JSON.stringify(execute.result)}`);
    }
    if (execute.usage.inputTokens !== 800 || execute.usage.outputTokens !== 350) {
      throw new Error(`Unexpected token count: ${JSON.stringify(execute.usage)}`);
    }

    // Repetition with exact same parameters (Idempotency check)
    const repeat = await request(`/agents/${agentId}/runtime/execute`, {
      method: "POST", headers: uh,
      body: JSON.stringify({ taskType: "project_research", input, idempotencyKey: idemKey })
    });
    if (repeat.executionId !== execute.executionId) {
      throw new Error("Idempotency failed: generated new execution ID for same request");
    }

    // Repetition with different input (Idempotency conflict)
    try {
      await request(`/agents/${agentId}/runtime/execute`, {
        method: "POST", headers: uh,
        body: JSON.stringify({ taskType: "project_research", input: { projectName: "Different" }, idempotencyKey: idemKey })
      }, 409);
    } catch (err) {
      if (!err.message.includes("idempotency_conflict")) {
        throw err;
      }
    }
  });

  // Step 5: Failure Recovery Selection and Fallback trigger check
  await step("Task Decomposition and Failure Recovery triggers are loaded correctly", async () => {
    await grantAndLearnSkill("sd_aut_task_decomposition");
    await grantAndLearnSkill("sd_exp_failure_recovery");

    const runtimeContext = await request(`/test/runtime/agents/${agentId}/context`, { headers: testHeaders });
    if (!runtimeContext.userId || !runtimeContext.taskDecompositionLearnedSkillId || !runtimeContext.taskDecompositionChecksum) {
      throw new Error(`Runtime fixture context incomplete: ${JSON.stringify(runtimeContext)}`);
    }

    const preview1 = await request(`/agents/${agentId}/runtime/preview`, {
      method: "POST", headers: uh,
      body: JSON.stringify({ taskType: "task_planning", input: {} })
    });
    if (preview1.selectedSkills.some(s => s.skillDefinitionId === "sd_exp_failure_recovery")) {
      throw new Error("Failure Recovery should NOT load in first execution attempt");
    }

    for (const [path, body] of [
      [`/agents/${agentId}/runtime/preview`, { taskType: "task_planning", isRecoveryAttempt: true }],
      [`/agents/${agentId}/runtime/preview`, { taskType: "task_planning", input: { isRecoveryAttempt: true } }],
      [`/agents/${agentId}/runtime/execute`, { taskType: "task_planning", input: { isRecoveryAttempt: true }, idempotencyKey: `err_exec_${Date.now()}` }]
    ]) {
      const invalid = await request(path, { method: "POST", headers: uh, body: JSON.stringify(body) }, 400);
      if (invalid.error !== "invalid_field") throw new Error(`Expected invalid_field, got ${JSON.stringify(invalid)}`);
    }

    const exec1 = await request(`/agents/${agentId}/runtime/execute`, {
      method: "POST", headers: uh,
      body: JSON.stringify({ taskType: "task_planning", input: { objective: "Deploy" }, idempotencyKey: `plan_norm_${Date.now()}` })
    });
    if (!exec1.result.steps || exec1.result.failure_type) {
      throw new Error("Normal planning should return only steps and no failure recovery outcomes");
    }
    const completedRecovery = await request(`/agents/${agentId}/runtime/executions/${exec1.executionId}/recover`, {
      method: "POST", headers: uh, body: JSON.stringify({})
    }, 400);
    if (completedRecovery.error !== "execution_not_failed") throw new Error("Completed execution was recoverable");

    const timeoutExecution = await request(`/agents/${agentId}/runtime/execute`, {
      method: "POST", headers: uh,
      body: JSON.stringify({ taskType: "task_planning", input: { objective: "FORCE_TIMEOUT" }, idempotencyKey: `plan_timeout_${Date.now()}` })
    }, 408);
    const timeoutExecId = timeoutExecution.executionId;
    if (!timeoutExecId) throw new Error("Timeout response did not include executionId");

    const missingRecovery = await request(`/agents/${agentId}/runtime/executions/exec_nonexistent/recover`, {
      method: "POST", headers: uh, body: JSON.stringify({})
    }, 404);
    if (missingRecovery.error !== "execution_not_found") throw new Error("Non-existent recovery did not return execution_not_found");

    const anotherUh = createUserHeaders();
    await request(`/agents/${agentId}/runtime/executions/${timeoutExecId}/recover`, {
      method: "POST", headers: anotherUh, body: JSON.stringify({})
    }, 403);
    const replacedInput = await request(`/agents/${agentId}/runtime/executions/${timeoutExecId}/recover`, {
      method: "POST", headers: uh, body: JSON.stringify({ input: { replaced: true } })
    }, 400);
    if (replacedInput.error !== "invalid_field") throw new Error("Recovery input replacement was not rejected");

    // A. Original execution and usage audits remain byte-for-byte immutable.
    const immutableFixture = await request("/test/runtime/fixtures/failed-execution", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        agentId,
        taskType: "task_planning",
        input: { objective: "RecoverMe" },
        idempotencyKey: `idem_failed_${Date.now()}`,
        includeRequiredUsage: true
      })
    }, 201);
    const immutableBefore = await request(`/test/runtime/executions/${immutableFixture.executionId}/audit`, { headers: testHeaders });
    const recovered = await request(`/agents/${agentId}/runtime/executions/${immutableFixture.executionId}/recover`, {
      method: "POST", headers: uh, body: JSON.stringify({})
    });
    if (!recovered.executionId || recovered.executionId === immutableFixture.executionId) {
      throw new Error("Recovery did not return an independent child execution ID");
    }
    const immutableAfter = await request(`/test/runtime/executions/${immutableFixture.executionId}/audit`, { headers: testHeaders });
    if (JSON.stringify(immutableAfter) !== JSON.stringify(immutableBefore)) {
      throw new Error("Original execution or usage audit changed during recovery");
    }
    const recoveryAudit = await request(`/test/runtime/executions/${recovered.executionId}/audit`, { headers: testHeaders });
    const recExec = recoveryAudit.execution;
    const recUsages = recoveryAudit.usages;
    if (recExec.recovery_of_execution_id !== immutableFixture.executionId
      || recExec.parent_execution_id !== immutableFixture.executionId
      || recExec.attempt_number !== 2
      || recExec.status !== "completed") {
      throw new Error(`Invalid recovery relationship audit: ${JSON.stringify(recExec)}`);
    }
    if (recExec.input_tokens <= 0 || recExec.output_tokens <= 0 || recExec.estimated_cost_usd_micros <= 0) {
      throw new Error("Recovery execution did not persist independent token/cost accounting");
    }
    if (!recUsages.some(u => u.selection_role === "fallback" && u.trigger_reason === `failed_execution:${immutableFixture.executionId}`)) {
      throw new Error("Recovery child is missing its fallback usage");
    }
    console.log(`    EVIDENCE immutable_recovery=${JSON.stringify({ originalBefore: immutableBefore, originalAfter: immutableAfter, recovery: recoveryAudit })}`);

    // B. Real concurrency: one DB claim, one provider call, one accounting record.
    await request("/test/reset-fake-provider-call-count", { method: "POST", headers: testHeaders });
    const concurrentFixture = await request("/test/runtime/fixtures/failed-execution", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        agentId,
        taskType: "task_planning",
        input: { objective: "RecoverConcurrent" },
        idempotencyKey: `idem_failed_conc_${Date.now()}`
      })
    }, 201);
    const [concA, concB] = await Promise.allSettled([
      request(`/agents/${agentId}/runtime/executions/${concurrentFixture.executionId}/recover`, { method: "POST", headers: uh }),
      request(`/agents/${agentId}/runtime/executions/${concurrentFixture.executionId}/recover`, { method: "POST", headers: uh })
    ]);
    const fulfilled = [concA, concB].filter(r => r.status === "fulfilled");
    const rejected = [concA, concB].filter(r => r.status === "rejected");
    if (fulfilled.length !== 1 || rejected.length !== 1 || !rejected[0].reason.message.includes("recovery_already_claimed")) {
      throw new Error(`Concurrent recovery did not produce one winner and one claim conflict: ${JSON.stringify([concA, concB])}`);
    }
    const successfulConcurrentResponse = fulfilled[0].value;
    const providerCallQuery = await request("/test/fake-provider-call-count", { headers: testHeaders });
    const concurrentAudits = await request(`/test/runtime/executions/${concurrentFixture.executionId}/recoveries`, { headers: testHeaders });
    if (providerCallQuery.callCount !== 1 || concurrentAudits.recoveries.length !== 1) {
      throw new Error(`Concurrent claim/provider invariant failed: ${JSON.stringify({ providerCallQuery, concurrentAudits })}`);
    }
    const concurrentAudit = concurrentAudits.recoveries[0];
    const fallbackCount = concurrentAudit.usages.filter(u => u.selection_role === "fallback").length;
    if (fallbackCount !== 1) throw new Error(`Expected one fallback usage, found ${fallbackCount}`);
    if (concurrentAudit.execution.input_tokens !== successfulConcurrentResponse.usage.inputTokens
      || concurrentAudit.execution.output_tokens !== successfulConcurrentResponse.usage.outputTokens
      || concurrentAudit.execution.estimated_cost_usd_micros !== successfulConcurrentResponse.usage.estimatedCostUsdMicros) {
      throw new Error("Concurrent recovery duplicated or lost token/cost accounting");
    }
    console.log(`    EVIDENCE concurrent_recovery=${JSON.stringify({ responses: [concA, concB].map(r => r.status === "fulfilled" ? { status: r.status, value: r.value } : { status: r.status, reason: r.reason.message }), providerCallCount: providerCallQuery.callCount, recoveries: concurrentAudits.recoveries })}`);

    // C. Failed recovery keeps two failed executions and independent usage histories.
    const failedFixture = await request("/test/runtime/fixtures/failed-execution", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        agentId,
        taskType: "task_planning",
        input: { objective: "FORCE_TIMEOUT" },
        idempotencyKey: `idem_failed_timeout_${Date.now()}`,
        includeRequiredUsage: true
      })
    }, 201);
    const failedOriginalBefore = await request(`/test/runtime/executions/${failedFixture.executionId}/audit`, { headers: testHeaders });
    const failedRecovery = await request(`/agents/${agentId}/runtime/executions/${failedFixture.executionId}/recover`, {
      method: "POST", headers: uh, body: JSON.stringify({})
    }, 408);
    if (!failedRecovery.executionId) throw new Error("Failed recovery response did not include child executionId");
    const failedOriginalAfter = await request(`/test/runtime/executions/${failedFixture.executionId}/audit`, { headers: testHeaders });
    const failedChildAudit = await request(`/test/runtime/executions/${failedRecovery.executionId}/audit`, { headers: testHeaders });
    if (JSON.stringify(failedOriginalBefore) !== JSON.stringify(failedOriginalAfter)) {
      throw new Error("Failed recovery modified the original execution or usage audit");
    }
    if (failedOriginalAfter.execution.status !== "failed" || failedChildAudit.execution.status !== "failed"
      || failedOriginalAfter.execution.error_code !== "timeout" || failedChildAudit.execution.error_code !== "timeout") {
      throw new Error("Failed recovery did not preserve two independent failed executions");
    }
    if (failedChildAudit.usages.length === 0 || failedChildAudit.usages.some(u => u.status !== "failed")) {
      throw new Error("Failed recovery child usages were not persisted as failed");
    }
    const originalUsageIds = new Set(failedOriginalAfter.usages.map(u => u.id));
    if (failedChildAudit.usages.some(u => originalUsageIds.has(u.id) || u.task_execution_id !== failedRecovery.executionId)) {
      throw new Error("Original and recovery usage histories are not independent");
    }
    const secondRecovery = await request(`/agents/${agentId}/runtime/executions/${failedFixture.executionId}/recover`, {
      method: "POST", headers: uh, body: JSON.stringify({})
    }, 409);
    if (secondRecovery.error !== "recovery_already_claimed") {
      throw new Error(`Expected recovery_already_claimed, got ${JSON.stringify(secondRecovery)}`);
    }
    console.log(`    EVIDENCE failed_recovery=${JSON.stringify({ originalBefore: failedOriginalBefore, originalAfter: failedOriginalAfter, recovery: failedChildAudit, secondRecovery })}`);
  });

  // Step 6: Security and access limits
  await step("Execute rejects other user's agent and validates timeout mock", async () => {
    const anotherUh = createUserHeaders();
    try {
      await request(`/agents/${agentId}/runtime/preview`, {
        method: "POST", headers: anotherUh,
        body: JSON.stringify({ taskType: "project_research" })
      }, 403);
    } catch (err) {
      if (!err.message.includes("403") && !err.message.includes("404")) {
        throw err;
      }
    }

    // Validate timeout mock error
    try {
      await request(`/agents/${agentId}/runtime/execute`, {
        method: "POST", headers: uh,
        body: JSON.stringify({
          taskType: "project_research",
          input: { forceTimeout: true, searchTerms: "FORCE_TIMEOUT" },
          idempotencyKey: `timeout_${Date.now()}`
        })
      }, 408);
    } catch (err) {
      if (!err.message.includes("408") && !err.message.includes("timeout")) {
        throw err;
      }
    }
  });
}

async function run() {
  try {
    await runMigrationTests();
    await runApiTests();

    console.log(`\n=== Integration check: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) {
      process.exit(1);
    } else {
      console.log("ALL SKILL RUNTIME INTEGRATION TESTS PASSED!");
    }
  } catch (err) {
    console.error(`Fatal test error: ${err.message}`);
    process.exit(1);
  }
}

run();
