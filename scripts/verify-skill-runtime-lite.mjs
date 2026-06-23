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
  return { "x-telegram-init-data": signTelegramInitData({ id: tid, username: `skill_rt_${tid}` }) };
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

    // Check 8 active runtimes seeded
    const runtimesResult = executeQuery("SELECT COUNT(*) as cnt FROM skill_runtime_versions WHERE runtime_status='active';", join(root, "apps", "api-worker"), freshDbPath);
    const activeCount = runtimesResult.results[0].cnt;
    if (activeCount !== 8) {
      throw new Error(`Expected 8 active runtimes, found ${activeCount}`);
    }
  });

  // Assert 8 x 5 Level Effects exist, check forbidden words/boundaries
  await step("Assert 8 x 5 Level Effects exist, check forbidden words/boundaries", () => {
    const runtimesResult = executeQuery("SELECT skill_definition_id, level_effects_json, system_instructions, tool_policy_json FROM skill_runtime_versions WHERE runtime_status='active';", join(root, "apps", "api-worker"), freshDbPath);

    const expectedSkillIds = [
      "sd_ver_advanced_verification",
      "sd_exp_failure_recovery",
      "sd_res_information_summary",
      "sd_res_project_research",
      "sd_ver_source_verification",
      "sd_con_structured_writing",
      "sd_ver_submission_checker",
      "sd_aut_task_decomposition"
    ];

    if (runtimesResult.results.length !== 8) {
      throw new Error(`Expected 8 active runtimes in DB, got ${runtimesResult.results.length}`);
    }

    const seenIds = runtimesResult.results.map(r => r.skill_definition_id);
    for (const id of expectedSkillIds) {
      if (!seenIds.includes(id)) {
        throw new Error(`Expected active runtime ${id} is missing`);
      }
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
    console.log("    Successfully verified 8 x 5 level effects and boundaries.");
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

    // Verify 8 active runtimes present
    const checkRuntimes = executeQuery("SELECT COUNT(*) as cnt FROM skill_runtime_versions WHERE runtime_status='active';", upgradeCwd, upgradeDbPath);
    if (checkRuntimes.results[0].cnt !== 8) {
      throw new Error(`Expected 8 active runtimes, found ${checkRuntimes.results[0].cnt}`);
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
  const agentOwnerQuery = await request("/test/query", {
    method: "POST", headers: testHeaders,
    body: JSON.stringify({
      sql: `SELECT user_id FROM agents WHERE id = ?`,
      params: [agentId]
    })
  });
  const agentUserId = agentOwnerQuery.results[0]?.user_id;
  if (!agentUserId) throw new Error("Agent owner user_id not found");

  // Set agent level to 10 so we can learn expert/advanced skills
  await request("/test/set-agent-level", {
    method: "POST", headers: { ...uh, ...testHeaders },
    body: JSON.stringify({ level: 10 })
  });

  // Step 1: GET /skills/runtime-status returns 31 catalog skills
  await step("GET /skills/runtime-status returns 8 active and 23 planned skills", async () => {
    const status = await request("/skills/runtime-status", { headers: uh });
    if (status.activeRuntimeSkills !== 8) {
      throw new Error(`Expected 8 active skills, got ${status.activeRuntimeSkills}`);
    }
    if (status.plannedRuntimeSkills !== 23) {
      throw new Error(`Expected 23 planned skills, got ${status.plannedRuntimeSkills}`);
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
    // Learn Task Decomposition
    await grantAndLearnSkill("sd_aut_task_decomposition");
    // Learn Failure Recovery
    await grantAndLearnSkill("sd_exp_failure_recovery");

    // Preview task_planning initially (without isRecoveryAttempt)
    const preview1 = await request(`/agents/${agentId}/runtime/preview`, {
      method: "POST", headers: uh,
      body: JSON.stringify({ taskType: "task_planning", input: {} })
    });
    const hasRecovery1 = preview1.selectedSkills.some(s => s.skillDefinitionId === "sd_exp_failure_recovery");
    if (hasRecovery1) {
      throw new Error("Failure Recovery should NOT load in first execution attempt");
    }

    // Assert client cannot pass isRecoveryAttempt
    try {
      await request(`/agents/${agentId}/runtime/preview`, {
        method: "POST", headers: uh,
        body: JSON.stringify({ taskType: "task_planning", isRecoveryAttempt: true })
      }, 400);
    } catch (err) {
      if (!err.message.includes("invalid_field")) {
        throw new Error("Expected preview to reject root isRecoveryAttempt with invalid_field");
      }
    }

    try {
      await request(`/agents/${agentId}/runtime/preview`, {
        method: "POST", headers: uh,
        body: JSON.stringify({ taskType: "task_planning", input: { isRecoveryAttempt: true } })
      }, 400);
    } catch (err) {
      if (!err.message.includes("invalid_field")) {
        throw new Error("Expected preview to reject input.isRecoveryAttempt with invalid_field");
      }
    }

    try {
      await request(`/agents/${agentId}/runtime/execute`, {
        method: "POST", headers: uh,
        body: JSON.stringify({ taskType: "task_planning", input: { isRecoveryAttempt: true }, idempotencyKey: `err_exec_${Date.now()}` })
      }, 400);
    } catch (err) {
      if (!err.message.includes("invalid_field")) {
        throw new Error("Expected execute to reject isRecoveryAttempt with invalid_field");
      }
    }

    // Execute normal planning
    const exec1 = await request(`/agents/${agentId}/runtime/execute`, {
      method: "POST", headers: uh,
      body: JSON.stringify({
        taskType: "task_planning",
        input: { objective: "Deploy" },
        idempotencyKey: `plan_norm_${Date.now()}`
      })
    });
    if (!exec1.result.steps || exec1.result.failure_type) {
      throw new Error("Normal planning should return only steps and no failure recovery outcomes");
    }

    // Try to recover a successful execution (should fail)
    try {
      await request(`/agents/${agentId}/runtime/executions/${exec1.executionId}/recover`, {
        method: "POST", headers: uh,
        body: JSON.stringify({})
      }, 400);
    } catch (err) {
      if (!err.message.includes("execution_not_failed")) {
        throw new Error("Expected recover on successful execution to fail with execution_not_failed");
      }
    }

    // Execute planning with timeout mock to get timeoutExecId
    let timeoutExecId;
    try {
      const execFailObj = await request(`/agents/${agentId}/runtime/execute`, {
        method: "POST", headers: uh,
        body: JSON.stringify({
          taskType: "task_planning",
          input: { objective: "FORCE_TIMEOUT" },
          idempotencyKey: `plan_timeout_${Date.now()}`
        })
      }, 408);
      timeoutExecId = execFailObj.executionId;
    } catch (err) {
      if (!err.message.includes("408") && !err.message.includes("timeout")) {
        throw err;
      }
      const match = err.message.match(/"executionId":"([^"]+)"/);
      if (match) {
        timeoutExecId = match[1];
      }
    }

    if (!timeoutExecId) {
      throw new Error("Could not retrieve timeout execution ID for recover test");
    }

    // Try to recover non-existent execution (should fail)
    try {
      await request(`/agents/${agentId}/runtime/executions/exec_nonexistent/recover`, {
        method: "POST", headers: uh,
        body: JSON.stringify({})
      }, 404);
    } catch (err) {
      if (!err.message.includes("404")) {
        throw err;
      }
    }

    // Try to recover other user's execution (should fail)
    const anotherUh = createUserHeaders();
    try {
      await request(`/agents/${agentId}/runtime/executions/${timeoutExecId}/recover`, {
        method: "POST", headers: anotherUh,
        body: JSON.stringify({})
      }, 403);
    } catch (err) {
      if (!err.message.includes("403")) {
        throw err;
      }
    }

    // Try to recover by replacing the input (should fail)
    try {
      await request(`/agents/${agentId}/runtime/executions/${timeoutExecId}/recover`, {
        method: "POST", headers: uh,
        body: JSON.stringify({ input: { replaced: true } })
      }, 400);
    } catch (err) {
      if (!err.message.includes("invalid_field")) {
        throw new Error("Expected input replacement to be rejected with invalid_field");
      }
    }

    // A. 原始审计不可变 (Immutable original audit test)
    const testExecId = `exec_failed_${Date.now()}`;
    const testIdemKey = `idem_failed_${Date.now()}`;

    // Insert a failed execution and its initial usage record
    await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `
          INSERT INTO skill_runtime_executions (
            id, user_id, agent_id, task_type, idempotency_key, request_hash, status,
            selected_skills_json, input_json, result_json, model_name, retry_count, error_code, attempt_number
          ) VALUES (?, ?, ?, 'task_planning', ?, 'hash', 'failed', '[]', ?, '{}', 'deterministic-test-model', 0, 'timeout', 1)
        `,
        params: [testExecId, agentUserId, agentId, testIdemKey, JSON.stringify({ objective: "RecoverMe" })]
      })
    });

    const learnedSkillQuery = await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `SELECT id FROM agent_learned_skills WHERE agent_id = ? AND skill_definition_id = 'sd_aut_task_decomposition' AND status = 'active'`,
        params: [agentId]
      })
    });
    const taskDecompositionLearnedSkillId = learnedSkillQuery.results[0]?.id;
    if (!taskDecompositionLearnedSkillId) throw new Error("Task Decomposition learned skill not found");

    const runtimeChecksumQuery = await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `SELECT checksum FROM skill_runtime_versions WHERE id = 'sd_aut_task_decomposition_v1'`,
        params: []
      })
    });
    const taskDecompositionChecksum = runtimeChecksumQuery.results[0]?.checksum;
    if (!taskDecompositionChecksum) throw new Error("Task Decomposition runtime checksum not found");

    const testUsageId = `usage_failed_${Date.now()}`;
    await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `
          INSERT INTO task_skill_runtime_usages (
            id, task_execution_id, user_id, agent_id, learned_skill_id, skill_definition_id,
            runtime_version_id, runtime_version, learned_skill_level, selection_role,
            runtime_checksum, status, error_code
          ) VALUES (?, ?, ?, ?, ?, 'sd_aut_task_decomposition', 'sd_aut_task_decomposition_v1', 1, 1, 'required', ?, 'failed', 'timeout')
        `,
        params: [testUsageId, testExecId, agentUserId, agentId, taskDecompositionLearnedSkillId, taskDecompositionChecksum]
      })
    });

    // Query and save original execution state
    const originalQuery = await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `SELECT * FROM skill_runtime_executions WHERE id = ?`,
        params: [testExecId]
      })
    });
    const origExec = originalQuery.results[0];
    if (!origExec) throw new Error("Original execution row not found");

    const originalUsageQuery = await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `SELECT * FROM task_skill_runtime_usages WHERE task_execution_id = ?`,
        params: [testExecId]
      })
    });
    const origUsages = originalUsageQuery.results;

    // Call recover endpoint
    const recovered = await request(`/agents/${agentId}/runtime/executions/${testExecId}/recover`, {
      method: "POST", headers: uh,
      body: JSON.stringify({})
    });

    const recoveryExecutionId = recovered.executionId;
    if (!recoveryExecutionId) throw new Error("Missing recovery execution ID");
    if (recoveryExecutionId === testExecId) throw new Error("Recovery returned original execution ID instead of a new one");

    // Query original execution again and verify immutable
    const originalQueryAfter = await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `SELECT * FROM skill_runtime_executions WHERE id = ?`,
        params: [testExecId]
      })
    });
    const origExecAfter = originalQueryAfter.results[0];
    for (const key of Object.keys(origExec)) {
      if (origExec[key] !== origExecAfter[key]) {
        throw new Error(`Field ${key} on original execution was modified: before="${origExec[key]}", after="${origExecAfter[key]}"`);
      }
    }

    // Assert original usage row still exists and is unchanged
    const originalUsageQueryAfter = await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `SELECT * FROM task_skill_runtime_usages WHERE task_execution_id = ?`,
        params: [testExecId]
      })
    });
    const origUsagesAfter = originalUsageQueryAfter.results;
    if (JSON.stringify(origUsagesAfter) !== JSON.stringify(origUsages)) {
      throw new Error("Original usages were modified or removed");
    }

    // Query recovery execution details and verify fields
    const recoveryQuery = await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `SELECT * FROM skill_runtime_executions WHERE id = ?`,
        params: [recoveryExecutionId]
      })
    });
    const recExec = recoveryQuery.results[0];
    if (!recExec) throw new Error("Recovery execution not found in DB");
    if (recExec.recovery_of_execution_id !== testExecId) throw new Error("Incorrect recovery_of_execution_id");
    if (recExec.parent_execution_id !== testExecId) throw new Error("Incorrect parent_execution_id");
    if (recExec.attempt_number !== 2) throw new Error(`Incorrect attempt_number: expected 2, got ${recExec.attempt_number}`);
    if (recExec.status !== "completed") throw new Error(`Incorrect recovery status: expected completed, got ${recExec.status}`);
    if (recExec.input_tokens === 0 || recExec.output_tokens === 0 || recExec.estimated_cost_usd_micros === 0) {
      throw new Error("Recovery execution failed to record independent tokens/cost");
    }

    // Verify recovery usages are bound to recovery execution ID
    const recUsageQuery = await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `SELECT * FROM task_skill_runtime_usages WHERE task_execution_id = ?`,
        params: [recoveryExecutionId]
      })
    });
    const recUsages = recUsageQuery.results;
    if (recUsages.length === 0) throw new Error("No usages created for recovery execution");
    const hasFallbackUsage = recUsages.some(u => u.selection_role === "fallback" && u.trigger_reason === `failed_execution:${testExecId}`);
    if (!hasFallbackUsage) {
      throw new Error("Missing Failure Recovery fallback usage bound to recovery execution");
    }
    console.log(`    EVIDENCE immutable_recovery=${JSON.stringify({
      originalBefore: origExec,
      originalAfter: origExecAfter,
      originalUsagesBefore: origUsages,
      originalUsagesAfter: origUsagesAfter,
      recovery: recExec,
      recoveryUsages: recUsages
    })}`);

    // B. 并发恢复 (Concurrent recovery test)
    await request("/test/reset-fake-provider-call-count", { method: "POST", headers: testHeaders });
    const concurrentExecId = `exec_failed_conc_${Date.now()}`;
    const concurrentIdemKey = `idem_failed_conc_${Date.now()}`;

    // Insert another failed execution
    await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `
          INSERT INTO skill_runtime_executions (
            id, user_id, agent_id, task_type, idempotency_key, request_hash, status,
            selected_skills_json, input_json, result_json, model_name, retry_count, error_code, attempt_number
          ) VALUES (?, ?, ?, 'task_planning', ?, 'hash', 'failed', '[]', ?, '{}', 'deterministic-test-model', 0, 'timeout', 1)
        `,
        params: [concurrentExecId, agentUserId, agentId, concurrentIdemKey, JSON.stringify({ objective: "RecoverConcurrent" })]
      })
    });

    // Concurrently trigger recover twice
    const [concA, concB] = await Promise.allSettled([
      request(`/agents/${agentId}/runtime/executions/${concurrentExecId}/recover`, { method: "POST", headers: uh }),
      request(`/agents/${agentId}/runtime/executions/${concurrentExecId}/recover`, { method: "POST", headers: uh })
    ]);

    let successCount = 0;
    let claimedCount = 0;
    for (const res of [concA, concB]) {
      if (res.status === "fulfilled") {
        successCount++;
      } else {
        if (res.reason.message.includes("recovery_already_claimed") || res.reason.message.includes("409")) {
          claimedCount++;
        } else {
          throw res.reason;
        }
      }
    }

    if (successCount !== 1 || claimedCount !== 1) {
      throw new Error(`Concurrent recovery failed: expected 1 success and 1 claimed, got success=${successCount}, claimed=${claimedCount}`);
    }
    const successfulConcurrentResponse = [concA, concB].find(res => res.status === "fulfilled")?.value;
    if (!successfulConcurrentResponse) throw new Error("Concurrent recovery success response missing");
    const concurrentResponses = [concA, concB].map(res => res.status === "fulfilled"
      ? { status: "fulfilled", value: res.value }
      : { status: "rejected", reason: res.reason.message });

    // Verify DB states: only 1 recovery execution and 1 fake provider call
    const concExecCountQuery = await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `SELECT COUNT(*) as cnt FROM skill_runtime_executions WHERE recovery_of_execution_id = ?`,
        params: [concurrentExecId]
      })
    });
    if (concExecCountQuery.results[0].cnt !== 1) {
      throw new Error(`Expected exactly 1 recovery execution in DB, found ${concExecCountQuery.results[0].cnt}`);
    }

    const providerCallQuery = await request("/test/fake-provider-call-count", { headers: testHeaders });
    if (providerCallQuery.callCount !== 1) {
      throw new Error(`Expected exactly 1 fake provider call, found ${providerCallQuery.callCount}`);
    }

    const concAuditQuery = await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `
          SELECT
            e.id, e.recovery_of_execution_id, e.input_tokens, e.output_tokens, e.estimated_cost_usd_micros,
            (SELECT COUNT(*) FROM task_skill_runtime_usages u WHERE u.task_execution_id = e.id) AS usage_count,
            (SELECT COUNT(*) FROM task_skill_runtime_usages u WHERE u.task_execution_id = e.id AND u.selection_role = 'fallback') AS fallback_usage_count
          FROM skill_runtime_executions e
          WHERE e.recovery_of_execution_id = ?
        `,
        params: [concurrentExecId]
      })
    });
    if (concAuditQuery.results.length !== 1) {
      throw new Error(`Concurrent recovery created duplicate execution rows: ${JSON.stringify(concAuditQuery.results)}`);
    }
    const concAudit = concAuditQuery.results[0];
    if (concAudit.fallback_usage_count !== 1) {
      throw new Error(`Concurrent recovery created duplicate fallback usages: ${JSON.stringify(concAudit)}`);
    }
    if (concAudit.input_tokens !== successfulConcurrentResponse.usage.inputTokens
      || concAudit.output_tokens !== successfulConcurrentResponse.usage.outputTokens
      || concAudit.estimated_cost_usd_micros !== successfulConcurrentResponse.usage.estimatedCostUsdMicros) {
      throw new Error(`Concurrent recovery duplicated or lost token/cost accounting: ${JSON.stringify({ concAudit, responseUsage: successfulConcurrentResponse.usage })}`);
    }
    console.log(`    EVIDENCE concurrent_recovery=${JSON.stringify({
      responses: concurrentResponses,
      recoveryCount: concExecCountQuery.results[0].cnt,
      providerCallCount: providerCallQuery.callCount,
      audit: concAudit
    })}`);

    // C. 恢复失败 (Recovery failure test)
    const timeoutExecId2 = `exec_failed_timeout_${Date.now()}`;
    const timeoutIdemKey2 = `idem_failed_timeout_${Date.now()}`;

    // Insert a failed execution with FORCE_TIMEOUT input so the recovery will timeout and fail
    await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `
          INSERT INTO skill_runtime_executions (
            id, user_id, agent_id, task_type, idempotency_key, request_hash, status,
            selected_skills_json, input_json, result_json, model_name, retry_count, error_code, attempt_number
          ) VALUES (?, ?, ?, 'task_planning', ?, 'hash', 'failed', '[]', ?, '{}', 'deterministic-test-model', 0, 'timeout', 1)
        `,
        params: [timeoutExecId2, agentUserId, agentId, timeoutIdemKey2, JSON.stringify({ objective: "FORCE_TIMEOUT" })]
      })
    });
    const timeoutOriginalUsageId = `usage_failed_timeout_${Date.now()}`;
    await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `
          INSERT INTO task_skill_runtime_usages (
            id, task_execution_id, user_id, agent_id, learned_skill_id, skill_definition_id,
            runtime_version_id, runtime_version, learned_skill_level, selection_role,
            runtime_checksum, status, error_code
          ) VALUES (?, ?, ?, ?, ?, 'sd_aut_task_decomposition', 'sd_aut_task_decomposition_v1', 1, 1, 'required', ?, 'failed', 'timeout')
        `,
        params: [timeoutOriginalUsageId, timeoutExecId2, agentUserId, agentId, taskDecompositionLearnedSkillId, taskDecompositionChecksum]
      })
    });

    // Try to recover (it should fail with 408 because of timeout mock)
    const failedRecovery = await request(`/agents/${agentId}/runtime/executions/${timeoutExecId2}/recover`, {
      method: "POST", headers: uh,
      body: JSON.stringify({})
    }, 408);
    const recoveryTimeoutExecId = failedRecovery.executionId;
    if (!recoveryTimeoutExecId) {
      throw new Error("Failed recovery response did not include its independent execution ID");
    }

    // Verify both failed executions exist in DB
    const origTimeoutQuery = await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `SELECT * FROM skill_runtime_executions WHERE id = ?`,
        params: [timeoutExecId2]
      })
    });
    const recTimeoutQuery = await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `SELECT * FROM skill_runtime_executions WHERE id = ?`,
        params: [recoveryTimeoutExecId]
      })
    });

    if (origTimeoutQuery.results[0].status !== "failed" || origTimeoutQuery.results[0].error_code !== "timeout") {
      throw new Error("Original execution state was incorrectly modified");
    }
    if (recTimeoutQuery.results[0].status !== "failed" || recTimeoutQuery.results[0].error_code !== "timeout") {
      throw new Error("Recovery execution was not correctly saved as failed");
    }

    // Verify original and recovery usages are independently preserved
    const origTimeoutUsageQuery = await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `SELECT * FROM task_skill_runtime_usages WHERE task_execution_id = ?`,
        params: [timeoutExecId2]
      })
    });
    if (origTimeoutUsageQuery.results.length !== 1 || origTimeoutUsageQuery.results[0].id !== timeoutOriginalUsageId) {
      throw new Error("Original failed usage was modified or removed during recovery failure");
    }

    const recTimeoutUsageQuery = await request("/test/query", {
      method: "POST", headers: testHeaders,
      body: JSON.stringify({
        sql: `SELECT * FROM task_skill_runtime_usages WHERE task_execution_id = ?`,
        params: [recoveryTimeoutExecId]
      })
    });
    if (recTimeoutUsageQuery.results.length === 0 || recTimeoutUsageQuery.results.some(u => u.status !== "failed")) {
      throw new Error("Recovery usages for failed recovery were not saved as failed");
    }
    const originalUsageIds = new Set(origTimeoutUsageQuery.results.map(u => u.id));
    if (recTimeoutUsageQuery.results.some(u => originalUsageIds.has(u.id) || u.task_execution_id !== recoveryTimeoutExecId)) {
      throw new Error("Original and recovery usage audits are not independent");
    }

    // Try to recover the same execution again: should return recovery_already_claimed
    const secondRecovery = await request(`/agents/${agentId}/runtime/executions/${timeoutExecId2}/recover`, {
      method: "POST", headers: uh,
      body: JSON.stringify({})
    }, 409);
    if (secondRecovery.error !== "recovery_already_claimed") {
      throw new Error(`Expected recovery_already_claimed, got ${JSON.stringify(secondRecovery)}`);
    }
    console.log(`    EVIDENCE failed_recovery=${JSON.stringify({
      original: origTimeoutQuery.results[0],
      recovery: recTimeoutQuery.results[0],
      originalUsages: origTimeoutUsageQuery.results,
      recoveryUsages: recTimeoutUsageQuery.results,
      secondRecovery
    })}`);
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
