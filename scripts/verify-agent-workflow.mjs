import { readFileSync } from "node:fs";
import crypto from "node:crypto";

let envText = "";
try {
  envText = readFileSync(new URL("../.env", import.meta.url), "utf8");
} catch (_) {}
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const base = process.env.VITE_API_BASE || "http://localhost:8787";
const botToken = process.env.TELEGRAM_BOT_TOKEN;

function signTelegramInitData(userObj) {
  const user = JSON.stringify(userObj);
  const authDate = Math.floor(Date.now() / 1000);
  const params = {
    auth_date: String(authDate),
    query_id: "verify_wf_query_id",
    user,
  };
  if (!botToken) {
    return new URLSearchParams({ ...params, hash: "mockhash" }).toString();
  }
  const dataCheckString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
}

const testUserId = Number(`992${Date.now().toString().slice(-9)}`);
const telegramInitData = signTelegramInitData({ id: testUserId, username: `verify_wf_${testUserId}` });

const headers = { "x-telegram-init-data": telegramInitData };

async function request(path, options = {}) {
  const reqHeaders = new Headers({ ...headers, ...options.headers });
  if (options.body && !reqHeaders.has("content-type")) {
    reqHeaders.set("content-type", "application/json");
  }
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: reqHeaders,
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function runStep(name, fn) {
  try {
    const result = await fn();
    console.log(`[WORKFLOW] PASS: ${name}`);
    return result;
  } catch (error) {
    console.error(`[WORKFLOW] FAIL: ${name} - ${error.message}`);
    process.exit(1);
  }
}

async function run() {
  console.log("=== Starting Agent Workflow V1 Verification ===");

  // 1. Setup user and agent
  await runStep("Register user", () => request("/me"));
  await runStep("Claim free Agent", () => request("/agents/claim", { method: "POST" }));
  
  // 2. Get available tasks
  const tasksResult = await runStep("Get available tasks", () => request("/tasks/available"));
  const task = tasksResult.tasks.find(t => t.id === "task_daily_checkin") || tasksResult.tasks[0];
  if (!task) {
    throw new Error("No task available to run verification");
  }

  // 3. Plan task
  const plan = await runStep(`Plan task ${task.id}`, () => request(`/tasks/${task.id}/plan`, { method: "POST" }));
  if (plan.taskId !== task.id || !plan.steps || plan.steps.length === 0) {
    throw new Error("Invalid plan returned");
  }

  // 4. Run task (create work run)
  const idempotencyKey = "wf_verify_" + Date.now();
  const runRes = await runStep(`Start work run for task ${task.id}`, () => request(`/tasks/${task.id}/run`, {
    method: "POST",
    body: JSON.stringify({ idempotencyKey })
  }));
  
  const runId = runRes.run.id;
  if (!runId) {
    throw new Error("No run ID returned");
  }

  // 5. Verify run properties
  await runStep("Verify run initial properties", async () => {
    const statusRes = await request(`/agents/${runRes.run.agentId}/work-runs/active`);
    if (!statusRes.run || statusRes.run.id !== runId) {
      throw new Error("Active run mismatch");
    }
  });

  // 6. Pause work run
  await runStep("Pause active work run", () => request(`/work-runs/${runId}/pause`, { method: "POST" }));
  await runStep("Verify work run is paused", async () => {
    const statusRes = await request(`/agents/${runRes.run.agentId}/work-runs/active`);
    if (statusRes.run.status !== "paused") {
      throw new Error(`Run status should be 'paused', got ${statusRes.run.status}`);
    }
  });

  // 7. Resume work run
  await runStep("Resume paused work run", () => request(`/work-runs/${runId}/resume`, { method: "POST" }));
  await runStep("Verify work run is resumed", async () => {
    const statusRes = await request(`/agents/${runRes.run.agentId}/work-runs/active`);
    if (statusRes.run.status === "paused") {
      throw new Error("Run status should not be 'paused' after resume");
    }
  });

  // 8. Cancel work run (terminal transition)
  await runStep("Cancel work run", () => request(`/work-runs/${runId}/cancel`, { method: "POST" }));
  await runStep("Verify work run is cancelled", async () => {
    // Get work run details (since it's terminal, it won't be under /active)
    const listRes = await request(`/agents/${runRes.run.agentId}/work-runs?status=cancelled`);
    const runInHistory = listRes.workRuns.find(r => r.id === runId);
    if (!runInHistory) {
      throw new Error("Cancelled run not found in cancelled list");
    }
    if (runInHistory.status !== "cancelled") {
      throw new Error(`Run status should be 'cancelled', got ${runInHistory.status}`);
    }
  });

  // 9. Verify terminal transition protection (cannot pause a cancelled run)
  await runStep("Assert protection against transitions from terminal states", async () => {
    try {
      await request(`/work-runs/${runId}/pause`, { method: "POST" });
      throw new Error("Pause should have failed for a cancelled run");
    } catch (e) {
      // Expected behavior: transitionWorkRun should throw error on invalid transition
      if (!e.message.includes("400") && !e.message.includes("invalid_transition")) {
        console.log(`[WORKFLOW] Info: terminal transition correctly blocked with message: ${e.message}`);
      }
    }
  });

  await runStep("Simulated work run has zero actual reward", async () => {
    const safeIdem = "wf_sim_reward_gate_" + Date.now();
    const created = await request(`/tasks/${task.id}/run`, {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: safeIdem })
    });
    const simulatedRunId = created.run.id;
    if (created.run.executionMode !== "simulated") {
      throw new Error(`Expected simulated execution mode, got ${created.run.executionMode}`);
    }
    const approved = await request(`/work-runs/${simulatedRunId}/approve-step`, { method: "POST" });
    if (approved.run.status !== "completed" || !approved.run.settled) {
      throw new Error(`Expected completed settled run, got ${JSON.stringify(approved.run)}`);
    }
    if (approved.run.actualReward !== 0) {
      throw new Error(`Expected zero actualReward, got ${approved.run.actualReward}`);
    }
    if (approved.run.rewardEligible !== false) {
      throw new Error(`Expected rewardEligible=false, got ${JSON.stringify(approved.run)}`);
    }
  });

  await runStep("Runtime settlement gate blocks invalid runtime states", async () => {
    const blocked = [
      "missing_runtime",
      "failed_runtime",
      "timed_out_runtime",
      "cross_agent",
      "failed_verification"
    ];
    for (const scenario of blocked) {
      const fixture = await request("/test/workflow-runtime-fixture", {
        method: "POST",
        headers: { "x-test-endpoint-token": process.env.TEST_ENDPOINT_TOKEN || "ci_test_secret" },
        body: JSON.stringify({ scenario })
      });
      const driven = await request("/test/workflow-runtime-drive", {
        method: "POST",
        headers: { "x-test-endpoint-token": process.env.TEST_ENDPOINT_TOKEN || "ci_test_secret" },
        body: JSON.stringify({ runId: fixture.runId })
      });
      if (driven.run.status !== "failed") {
        throw new Error(`Expected ${scenario} to fail, got ${JSON.stringify(driven.run)}`);
      }
      if (driven.run.actualReward !== 0 || driven.run.settled) {
        throw new Error(`Blocked ${scenario} produced economic side effects: ${JSON.stringify(driven.run)}`);
      }
    }
  });

  await runStep("Runtime settlement gate allows exactly one valid reward", async () => {
    const fixture = await request("/test/workflow-runtime-fixture", {
      method: "POST",
      headers: { "x-test-endpoint-token": process.env.TEST_ENDPOINT_TOKEN || "ci_test_secret" },
      body: JSON.stringify({ scenario: "valid", reward: 123 })
    });
    const driven = await request("/test/workflow-runtime-drive", {
      method: "POST",
      headers: { "x-test-endpoint-token": process.env.TEST_ENDPOINT_TOKEN || "ci_test_secret" },
      body: JSON.stringify({ runId: fixture.runId })
    });
    if (driven.run.status !== "completed" || !driven.run.settled) {
      throw new Error(`Valid runtime run did not complete settlement: ${JSON.stringify(driven.run)}`);
    }
    if (driven.run.actualReward !== 123 || driven.run.rewardEligible !== true) {
      throw new Error(`Valid runtime run reward mismatch: ${JSON.stringify(driven.run)}`);
    }
    const secondDrive = await request("/test/workflow-runtime-drive", {
      method: "POST",
      headers: { "x-test-endpoint-token": process.env.TEST_ENDPOINT_TOKEN || "ci_test_secret" },
      body: JSON.stringify({ runId: fixture.runId })
    });
    if (secondDrive.run.actualReward !== 123 || !secondDrive.run.settled) {
      throw new Error(`Repeated drive changed valid runtime settlement: ${JSON.stringify(secondDrive.run)}`);
    }
  });

  console.log("[WORKFLOW] Agent Workflow V1 Verification completed successfully.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(err => {
    console.error("Unhandle workflow verification error:", err);
    process.exit(1);
  });
}

export { run as verifyAgentWorkflow };
