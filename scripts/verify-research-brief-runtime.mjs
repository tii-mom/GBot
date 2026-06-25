import crypto from "node:crypto";

const base = process.env.RESEARCH_BRIEF_API_BASE || process.env.VITE_API_BASE || "";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) {
  console.error("verify:research-brief-runtime requires an explicit local API worker base.");
  console.error("Set RESEARCH_BRIEF_API_BASE=http://127.0.0.1:8787 after starting wrangler locally; see docs/research-brief-flow.md.");
  throw new Error(`Missing or non-local API base: ${base || "<empty>"}`);
}
const testToken = process.env.TEST_ENDPOINT_TOKEN;
if (!testToken) throw new Error("TEST_ENDPOINT_TOKEN is required");
const botToken = process.env.TELEGRAM_BOT_TOKEN;
console.log(`Base: ${base}`);
console.log("Test token configured: yes");

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
  const expected = expectedStatus === undefined ? null : new Set(Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus]);
  if (expected) {
    if (!expected.has(response.status)) throw new Error(`${path}: expected ${[...expected].join("/")}, got ${response.status}: ${text}`);
  } else if (!response.ok) {
    throw new Error(`${path}: ${response.status}: ${text}`);
  }
  return { status: response.status, body: json };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, options) {
  return (await request(path, options)).body;
}

async function startBrief(marker, token = true) {
  return api("/tasks/task_research_brief_v1/run", {
    method: "POST",
    token,
    body: {
      idempotencyKey: `research_brief_${marker}_${crypto.randomUUID()}`,
      input: { project: "GrowthBot", objective: marker }
    }
  });
}

async function audit(runId) {
  return api(`/test/research-brief-runtime-audit/${runId}`);
}

function assertNoReward(auditResult, label) {
  assert(auditResult.run.settled !== 1, `${label}: run unexpectedly settled`);
  assert(Number(auditResult.run.actual_reward || 0) === 0, `${label}: actual reward is non-zero`);
  assert(Array.isArray(auditResult.rewardLedgers) && auditResult.rewardLedgers.length === 0, `${label}: task reward ledger exists`);
  assert(!auditResult.settlement || auditResult.settlement.status !== "completed", `${label}: completed settlement row exists`);
}

async function assertVerificationRejected(marker) {
  const created = await startBrief(marker);
  assert(created.run.status === "waiting_user", `${marker}: produce should finish before verify`);
  const approved = await api(`/work-runs/${created.run.id}/approve-step`, { method: "POST" });
  assert(approved.run.status === "failed", `${marker}: verification should fail`);
  const result = await audit(created.run.id);
  const verifyStep = result.steps.find((step) => step.step_type === "verify");
  assert(verifyStep?.status === "failed", `${marker}: verify step is not failed`);
  assert(verifyStep?.error_message === "research_brief_verification_failed", `${marker}: wrong verify error`);
  assertNoReward(result, marker);
}

console.log("=== Research Brief Runtime Verification ===");
await api("/me");
await api("/agents/claim", { method: "POST" });
const setup = await api("/test/research-brief-runtime-setup", { method: "POST" });
const agentId = setup.agentId;

// Shared test authorization predicate matrix.
const authMatrix = await api("/test/runtime-authorization-matrix");
const authorized = authMatrix.cases.filter((entry) => entry.authorized).map((entry) => entry.name);
assert(authorized.length === 1 && authorized[0] === "valid", `Unexpected authorization matrix: ${JSON.stringify(authMatrix.cases)}`);
console.log("PASS production/staging/disabled/unconfigured/missing/wrong-token authorization matrix");

// Normal success and strict exactly-once ledger/balance proof.
const success = await startBrief("VALID_BRIEF");
assert(success.run.executionMode === "runtime", "Research Brief must use runtime mode");
assert(success.run.status === "waiting_user", `Expected waiting_user, got ${success.run.status}`);
const preSuccessAudit = await audit(success.run.id);
const preSuccessBalance = preSuccessAudit.pendingPointsBalance;
const successApproved = await api(`/work-runs/${success.run.id}/approve-step`, { method: "POST" });
assert(successApproved.run.status === "completed", "Valid Research Brief did not complete");
assert(successApproved.run.settled === true && successApproved.run.actualReward > 0, "Valid Research Brief did not settle");
const successAudit = await audit(success.run.id);
assert(successAudit.settlement?.status === "completed", "Settlement row is not completed");
assert(successAudit.rewardLedgers.length === 1, `Expected one reward ledger, got ${successAudit.rewardLedgers.length}`);
assert(successAudit.rewardLedgers[0].amount === successApproved.run.actualReward, "Ledger amount mismatch");
assert(successAudit.pendingPointsBalance - preSuccessBalance === successApproved.run.actualReward, "Balance increment mismatch");
await api("/test/workflow-runtime-drive", { method: "POST", body: { runId: success.run.id } });
await request(`/work-runs/${success.run.id}/approve-step`, { method: "POST", expectedStatus: 400 });
await request(`/work-runs/${success.run.id}/retry-step`, { method: "POST", expectedStatus: 400 });
const successAfterReplay = await audit(success.run.id);
assert(successAfterReplay.rewardLedgers.length === 1, "Repeated requests created duplicate reward ledger");
assert(successAfterReplay.pendingPointsBalance === successAudit.pendingPointsBalance, "Repeated requests changed balance");
console.log("PASS valid runtime + verification + settlement row + one ledger + one balance increment");

// Exhaustive text-field matrix: each required field missing, empty, blank, and non-string.
const textFields = ["summary", "core_product", "target_users", "business_model", "team_background", "competition", "risks"];
for (const field of textFields) {
  for (const mode of ["MISSING", "EMPTY", "BLANK", "NON_STRING"]) {
    await assertVerificationRejected(`FORCE_BRIEF_TEXT_${mode}_${field}`);
  }
}

// Structured field negative matrix.
for (const marker of [
  "FORCE_BRIEF_BAD_SOURCES_TYPE",
  "FORCE_BRIEF_EMPTY_SOURCES",
  "FORCE_BRIEF_BAD_URL",
  "FORCE_BRIEF_JAVASCRIPT_URL",
  "FORCE_BRIEF_NON_STRING_SOURCE",
  "FORCE_BRIEF_FACT_ARRAY_TYPE",
  "FORCE_BRIEF_FACT_NON_OBJECT",
  "FORCE_BRIEF_EMPTY_STATEMENT",
  "FORCE_BRIEF_BAD_FACT_TYPE",
  "FORCE_BRIEF_RECOMMENDATIONS_TYPE",
  "FORCE_BRIEF_EMPTY_RECOMMENDATIONS",
  "FORCE_BRIEF_EMPTY_RECOMMENDATION"
]) {
  await assertVerificationRejected(marker);
}
console.log("PASS exhaustive Research Brief verification rejection matrix");

// Fake provider cannot be selected by APP_ENV=test alone.
const noToken = await startBrief("NO_TEST_TOKEN", false);
assert(noToken.run.status === "failed", "Request without test token unexpectedly used Fake Provider");
const noTokenAudit = await audit(noToken.run.id);
const failedLink = noTokenAudit.links.find((link) => link.purpose === "produce");
assert(failedLink?.runtime_status === "failed", "No-token execution was not audited as failed");
const failedRuntimeAudit = await api(`/test/runtime/executions/${failedLink.runtime_execution_id}/audit`);
assert(Array.isArray(failedRuntimeAudit.usages) && failedRuntimeAudit.usages.length > 0, "Failed runtime usages were not recorded");
assert(failedRuntimeAudit.usages.every((usage) => usage.status === "failed"), "Failed runtime usage status mismatch");
assertNoReward(noTokenAudit, "no-token");
console.log("PASS no-token Fake Provider isolation + failed usage audit");

// Recovery failed: original and child remain failed, retry remains failed, no reward.
const failedRecoveryRun = await startBrief("FORCE_TIMEOUT");
assert(failedRecoveryRun.run.status === "failed", "FORCE_TIMEOUT original should fail");
const failedRecoveryBefore = await audit(failedRecoveryRun.run.id);
const failedOriginal = failedRecoveryBefore.links.find((link) => link.purpose === "produce");
const failedRecoveryResponse = await request(
  `/agents/${agentId}/runtime/executions/${failedOriginal.runtime_execution_id}/recover`,
  { method: "POST", expectedStatus: 408 }
);
assert(failedRecoveryResponse.body.executionId, "Failed recovery child id missing");
const failedRetry = await api(`/work-runs/${failedRecoveryRun.run.id}/retry-step`, { method: "POST" });
assert(failedRetry.run.status === "failed", "Run with failed recovery should remain failed");
const failedRecoveryAudit = await audit(failedRecoveryRun.run.id);
assertNoReward(failedRecoveryAudit, "failed-recovery");
console.log("PASS failed recovery produces no settlement or GP");

// Recovery completed with invalid schema: retry reaches approval, verify rejects, no reward.
const invalidRecoveryRun = await startBrief("FORCE_TIMEOUT_ONCE FORCE_BRIEF_JAVASCRIPT_URL");
const invalidBefore = await audit(invalidRecoveryRun.run.id);
const invalidOriginal = invalidBefore.links.find((link) => link.purpose === "produce");
await api(`/agents/${agentId}/runtime/executions/${invalidOriginal.runtime_execution_id}/recover`, { method: "POST" });
const invalidRetried = await api(`/work-runs/${invalidRecoveryRun.run.id}/retry-step`, { method: "POST" });
assert(invalidRetried.run.status === "waiting_user", "Invalid recovered brief should reach user approval before verify");
const invalidApproved = await api(`/work-runs/${invalidRecoveryRun.run.id}/approve-step`, { method: "POST" });
assert(invalidApproved.run.status === "failed", "Invalid recovered brief passed verification");
const invalidRecoveryAudit = await audit(invalidRecoveryRun.run.id);
assertNoReward(invalidRecoveryAudit, "invalid-recovery");
console.log("PASS completed recovery with invalid schema cannot settle");

// Recovery scope attack fixtures must never be adopted.
for (const scenario of ["wrong_user", "wrong_agent", "wrong_run", "wrong_step", "wrong_purpose"]) {
  const scopedRun = await startBrief(`FORCE_TIMEOUT_ONCE ${scenario}`);
  assert(scopedRun.run.status === "failed", `${scenario}: original should fail`);
  await api("/test/research-brief-recovery-scope-fixture", {
    method: "POST",
    body: { runId: scopedRun.run.id, scenario }
  });
  const scopedRetry = await api(`/work-runs/${scopedRun.run.id}/retry-step`, { method: "POST" });
  assert(scopedRetry.run.status === "failed", `${scenario}: rogue recovery was adopted`);
  const scopedAudit = await audit(scopedRun.run.id);
  assertNoReward(scopedAudit, `scope-${scenario}`);
}
console.log("PASS cross-user/cross-agent/cross-run/cross-step/wrong-purpose recovery isolation");

// Valid immutable recovery and exactly-once settlement after replay attempts.
const recoveredRun = await startBrief("FORCE_TIMEOUT_ONCE");
const recoveredBefore = await audit(recoveredRun.run.id);
const originalLink = recoveredBefore.links.find((link) => link.purpose === "produce");
const originalExecutionId = originalLink.runtime_execution_id;
const recovery = await api(`/agents/${agentId}/runtime/executions/${originalExecutionId}/recover`, { method: "POST" });
assert(recovery.recoveryOfExecutionId === originalExecutionId, "Recovery child points to wrong original");
assert(recovery.attemptNumber === 2, "Recovery attempt number is not 2");
await request(`/agents/${agentId}/runtime/executions/${originalExecutionId}/recover`, { method: "POST", expectedStatus: 409 });
const recoveredPreRetryAudit = await audit(recoveredRun.run.id);
const recoveredBalanceBefore = recoveredPreRetryAudit.pendingPointsBalance;
const retried = await api(`/work-runs/${recoveredRun.run.id}/retry-step`, { method: "POST" });
assert(retried.run.status === "waiting_user", `Recovered run did not resume: ${retried.run.status}`);
const recoveredApproved = await api(`/work-runs/${recoveredRun.run.id}/approve-step`, { method: "POST" });
assert(recoveredApproved.run.status === "completed" && recoveredApproved.run.settled === true, "Recovered run did not settle");
await api("/test/workflow-runtime-drive", { method: "POST", body: { runId: recoveredRun.run.id } });
await request(`/work-runs/${recoveredRun.run.id}/retry-step`, { method: "POST", expectedStatus: 400 });
await request(`/work-runs/${recoveredRun.run.id}/approve-step`, { method: "POST", expectedStatus: 400 });
const afterRecovery = await audit(recoveredRun.run.id);
const originalAfter = afterRecovery.links.find((link) => link.runtime_execution_id === originalExecutionId);
const recoveryLink = afterRecovery.links.find((link) => link.purpose === "recover");
assert(originalAfter?.runtime_status === "failed", "Original execution was mutated");
assert(recoveryLink?.runtime_status === "completed", "Completed recovery child was not bound");
assert(recoveryLink.runtime_user_id === afterRecovery.run.user_id, "Recovery user mismatch");
assert(recoveryLink.runtime_agent_id === afterRecovery.run.agent_id, "Recovery agent mismatch");
assert(recoveryLink.recovery_of_execution_id === originalExecutionId, "Recovery audit linkage mismatch");
assert(afterRecovery.rewardLedgers.length === 1, "Recovered run created duplicate reward ledgers");
assert(afterRecovery.settlement?.status === "completed", "Recovered settlement row not completed");
assert(afterRecovery.pendingPointsBalance - recoveredBalanceBefore === recoveredApproved.run.actualReward, "Recovered balance increment mismatch");
console.log("PASS immutable recovery + scoped binding + one claim + one ledger + one balance increment");

console.log("ALL RESEARCH BRIEF RUNTIME VERIFICATIONS PASSED");
