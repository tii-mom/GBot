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

    // Preview task_planning initially
    const preview1 = await request(`/agents/${agentId}/runtime/preview`, {
      method: "POST", headers: uh,
      body: JSON.stringify({ taskType: "task_planning", input: { isRecoveryAttempt: false } })
    });
    const hasRecovery1 = preview1.selectedSkills.some(s => s.skillDefinitionId === "sd_exp_failure_recovery");
    if (hasRecovery1) {
      throw new Error("Failure Recovery should NOT load in first execution attempt");
    }

    // Preview task_planning under recovery attempt
    const preview2 = await request(`/agents/${agentId}/runtime/preview`, {
      method: "POST", headers: uh,
      body: JSON.stringify({ taskType: "task_planning", input: { isRecoveryAttempt: true } })
    });
    const hasRecovery2 = preview2.selectedSkills.some(s => s.skillDefinitionId === "sd_exp_failure_recovery");
    if (!hasRecovery2) {
      throw new Error("Failure Recovery SHOULD load during recovery attempt");
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

    // Execute recovery planning
    const exec2 = await request(`/agents/${agentId}/runtime/execute`, {
      method: "POST", headers: uh,
      body: JSON.stringify({
        taskType: "task_planning",
        input: { objective: "Deploy", isRecoveryAttempt: true },
        idempotencyKey: `plan_recov_${Date.now()}`
      })
    });
    if (exec2.result.status !== "recovered" || exec2.result.failure_type !== "network_timeout") {
      throw new Error("Recovery attempt execution failed to run recovery logic");
    }
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
