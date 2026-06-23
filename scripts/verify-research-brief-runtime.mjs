import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const base = process.env.RESEARCH_BRIEF_API_BASE || process.env.VITE_API_BASE || "";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) {
  throw new Error(`verify:research-brief-runtime requires an explicit local API base, got: ${base || "<empty>"}`);
}
const testToken = process.env.TEST_ENDPOINT_TOKEN;
if (!testToken) throw new Error("TEST_ENDPOINT_TOKEN is required");
const botToken = process.env.TELEGRAM_BOT_TOKEN;

function signTelegramInitData(userObj) {
  const user = JSON.stringify(userObj);
  const authDate = Math.floor(Date.now() / 1000);
  const params = { auth_date: String(authDate), query_id: `research_brief_${Date.now()}`, user };
  if (!botToken) return new URLSearchParams({ ...params, hash: "mockhash" }).toString();
  const dataCheckString = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
}

const telegramId = Number(`997${Date.now().toString().slice(-9)}`);
const authHeader = signTelegramInitData({ id: telegramId, username: `research_brief_${telegramId}` });

async function request(path, { method = "GET", body, token = true, expectedStatus } = {}) {
  const headers = { "x-telegram-init-data": authHeader };
  if (token) headers["x-test-endpoint-token"] = testToken;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (expectedStatus !== undefined) {
    if (response.status !== expectedStatus) throw new Error(`${path}: expected ${expectedStatus}, got ${response.status}: ${text}`);
  } else if (!response.ok) {
    throw new Error(`${path}: ${response.status}: ${text}`);
  }
  return json;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function startBrief(agentId, marker, token = true) {
  return request("/tasks/task_research_brief_v1/run", {
    method: "POST",
    token,
    body: {
      idempotencyKey: `research_brief_${marker}_${crypto.randomUUID()}`,
      input: { project: "GrowthBot", objective: marker }
    }
  });
}

console.log(`=== Research Brief Runtime Verification (${base}) ===`);
await request("/me");
await request("/agents/claim", { method: "POST" });
const setup = await request("/test/research-brief-runtime-setup", { method: "POST" });
const agentId = setup.agentId;

// Normal success and exactly-once settlement.
const success = await startBrief(agentId, "VALID_BRIEF");
assert(success.run.executionMode === "runtime", "Research Brief must use runtime mode");
assert(success.run.status === "waiting_user", `Expected waiting_user, got ${success.run.status}`);
const successApproved = await request(`/work-runs/${success.run.id}/approve-step`, { method: "POST" });
assert(successApproved.run.status === "completed", "Valid Research Brief did not complete");
assert(successApproved.run.settled === true && successApproved.run.actualReward > 0, "Valid Research Brief did not settle");
const settledReward = successApproved.run.actualReward;
const repeatedDrive = await request("/test/workflow-runtime-drive", {
  method: "POST",
  body: { runId: success.run.id }
});
assert(repeatedDrive.run.actualReward === settledReward && repeatedDrive.run.settled === true, "Repeated drive changed settlement");
console.log("PASS valid runtime + verification + exactly-once settlement");

// Strict server verification cases.
for (const marker of [
  "FORCE_BRIEF_MISSING_FIELD",
  "FORCE_BRIEF_BAD_SOURCES_TYPE",
  "FORCE_BRIEF_EMPTY_SOURCES",
  "FORCE_BRIEF_BAD_URL",
  "FORCE_BRIEF_BAD_FACT_TYPE"
]) {
  const created = await startBrief(agentId, marker);
  assert(created.run.status === "waiting_user", `${marker}: produce should finish before verify`);
  const approved = await request(`/work-runs/${created.run.id}/approve-step`, { method: "POST" });
  assert(approved.run.status === "failed", `${marker}: verification should fail`);
  assert(approved.run.settled !== true && Number(approved.run.actualReward || 0) === 0, `${marker}: invalid brief settled`);
}
console.log("PASS strict schema, URL, evidence type, and empty-source rejection");

// Fake provider requires all test gates, not APP_ENV=test alone.
const noToken = await startBrief(agentId, "NO_TEST_TOKEN", false);
assert(noToken.run.status === "failed", "Request without test token unexpectedly used Fake Provider");
const noTokenAudit = await request(`/test/research-brief-runtime-audit/${noToken.run.id}`);
const failedLink = noTokenAudit.links.find((link) => link.purpose === "produce");
assert(failedLink?.runtime_status === "failed", "No-token execution was not audited as failed");
const failedRuntimeAudit = await request(`/test/runtime/executions/${failedLink.runtime_execution_id}/audit`);
assert(Array.isArray(failedRuntimeAudit.usages) && failedRuntimeAudit.usages.length > 0, "Failed runtime usages were not recorded");
assert(failedRuntimeAudit.usages.every((usage) => usage.status === "failed"), "Failed runtime usage status mismatch");
assert(noTokenAudit.run.settled !== 1 && Number(noTokenAudit.run.actual_reward || 0) === 0, "No-token execution settled");
console.log("PASS Fake Provider triple-gate isolation + failed usage audit");

// Immutable recovery, scoped reuse, and exactly-once settlement after recovery.
const failed = await startBrief(agentId, "FORCE_TIMEOUT_ONCE");
assert(failed.run.status === "failed", "Timeout-once run should fail before recovery");
const beforeRecovery = await request(`/test/research-brief-runtime-audit/${failed.run.id}`);
const originalLink = beforeRecovery.links.find((link) => link.purpose === "produce");
assert(originalLink?.runtime_status === "failed", "Original failed execution missing");
const originalExecutionId = originalLink.runtime_execution_id;
const recovery = await request(`/agents/${agentId}/runtime/executions/${originalExecutionId}/recover`, { method: "POST" });
assert(recovery.recoveryOfExecutionId === originalExecutionId, "Recovery child points to wrong original");
assert(recovery.attemptNumber === 2, "Recovery attempt number is not 2");
await request(`/agents/${agentId}/runtime/executions/${originalExecutionId}/recover`, { method: "POST", expectedStatus: 409 });
const retried = await request(`/work-runs/${failed.run.id}/retry-step`, { method: "POST" });
assert(retried.run.status === "waiting_user", `Recovered run did not resume: ${retried.run.status}`);
const recoveredApproved = await request(`/work-runs/${failed.run.id}/approve-step`, { method: "POST" });
assert(recoveredApproved.run.status === "completed" && recoveredApproved.run.settled === true, "Recovered run did not settle");
const afterRecovery = await request(`/test/research-brief-runtime-audit/${failed.run.id}`);
const originalAfter = afterRecovery.links.find((link) => link.runtime_execution_id === originalExecutionId);
const recoveryLink = afterRecovery.links.find((link) => link.purpose === "recover");
assert(originalAfter?.runtime_status === "failed", "Original execution was mutated");
assert(recoveryLink?.runtime_status === "completed", "Completed recovery child was not bound");
assert(recoveryLink.runtime_user_id === afterRecovery.run.user_id, "Recovery user mismatch");
assert(recoveryLink.runtime_agent_id === afterRecovery.run.agent_id, "Recovery agent mismatch");
assert(recoveryLink.recovery_of_execution_id === originalExecutionId, "Recovery audit linkage mismatch");
console.log("PASS immutable recovery + scoped binding + single recovery claim + settlement");

console.log("ALL RESEARCH BRIEF RUNTIME VERIFICATIONS PASSED");
