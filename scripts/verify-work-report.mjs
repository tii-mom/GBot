import crypto from "node:crypto";

const rawBase = process.env.WORK_REPORT_API_BASE;
if (!rawBase) throw new Error("WORK_REPORT_API_BASE is required");
const baseUrl = new URL(rawBase);
if (baseUrl.protocol !== "http:" || !["localhost", "127.0.0.1", "::1", "[::1]"].includes(baseUrl.hostname)) {
  throw new Error("WORK_REPORT_API_BASE must be an explicit loopback HTTP origin");
}
const base = baseUrl.origin;
const testToken = process.env.TEST_ENDPOINT_TOKEN;
if (!testToken) throw new Error("TEST_ENDPOINT_TOKEN is required");
const adminToken = process.env.ADMIN_TOKEN || "admin_mock_token";
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const sentinel = "WR_SECRET_SENTINEL_fixture";
const scenarioFilter = process.env.WORK_REPORT_SCENARIO || null;
if (scenarioFilter && !["owner_access", "recovery_cross_step", "ledger_wrong_owner", "multiple_ledger_candidates", "inferred_legacy_reward", "actual_energy_zero", "actual_energy_null_projection"].includes(scenarioFilter)) throw new Error("invalid_work_report_scenario_filter");

function signTelegramInitData(userObj) {
  const user = JSON.stringify(userObj);
  const authDate = Math.floor(Date.now() / 1000);
  const params = { auth_date: String(authDate), query_id: `work_report_${Date.now()}`, user };
  if (!botToken) return new URLSearchParams({ ...params, hash: "mockhash" }).toString();
  const dataCheckString = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
}

const telegramId = Number(`996${Date.now().toString().slice(-9)}`);
const authHeader = signTelegramInitData({ id: telegramId, username: `work_report_${telegramId}` });

function assert(condition, label) {
  if (!condition) throw new Error(label);
}
function containsSentinel(value) {
  return JSON.stringify(value).includes(sentinel);
}
async function request(path, { method = "GET", body, auth = true, test = false, admin, expected } = {}) {
  const headers = {};
  if (auth) headers["x-telegram-init-data"] = authHeader;
  if (test) headers["x-test-endpoint-token"] = testToken;
  if (admin !== undefined) headers["x-admin-token"] = admin;
  if (body !== undefined) headers["content-type"] = "application/json";
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(`connection_failed:${path}`);
  }
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (expected !== undefined && response.status !== expected) {
    if (path === "/test/work-report-fixture" && json?.stage) {
      throw new Error(`fixture_stage:${json.stage}`);
    }
    throw new Error(`status_mismatch:${path}:${response.status}`);
  }
  if (expected === undefined && !response.ok) throw new Error(`request_failed:${path}`);
  assert(!text.includes(sentinel), `response_sentinel_leak:${path}`);
  return { status: response.status, body: json, text };
}
async function fixture(scenario) {
  try {
    const result = await request("/test/work-report-fixture", { method: "POST", body: { scenario }, test: true, expected: 201 });
    return result.body;
  } catch (error) {
    const label = error instanceof Error && error.message.startsWith("fixture_stage:")
      ? error.message
      : "fixture_failed";
    throw new Error(`${scenario}:${label}`);
  }
}
async function report(runId, options = {}) {
  return (await request(`/work-runs/${runId}/report`, options)).body.report;
}
async function adminReport(runId, token, expected) {
  const actualToken = token === undefined ? adminToken : token;
  return request(`/admin/v1/work-runs/${runId}/report`, {
    auth: false,
    admin: actualToken === null ? undefined : actualToken,
    expected
  });
}
function warningCodes(reportValue) {
  return new Set((reportValue.warnings || []).map((warning) => warning.code));
}

console.log(`Origin: ${base}`);
const beforeMe = (await request("/me")).body;
const beforeUserStableKey = beforeMe?.user?.id ?? beforeMe?.user?.telegramId ?? null;
assert(beforeUserStableKey !== null, "owner_identity_missing_before");
await request("/agents/claim", { method: "POST" });

await request("/test/work-report-fixture", { method: "POST", body: { scenario: "simulation" }, test: false, expected: 403 });
await request("/test/work-report-fixture", { method: "POST", body: { scenario: "simulation" }, test: true, expected: 201 });
console.log("PASS test endpoint authorization");

const owner = await fixture("owner_access");
assert(owner.ownerVerified === true, "owner_fixture_postcheck_failed");
console.log("owner_fixture_created: PASS");
console.log("owner_fixture_postcheck: PASS");
const afterMe = (await request("/me")).body;
const afterUserStableKey = afterMe?.user?.id ?? afterMe?.user?.telegramId ?? null;
assert(beforeUserStableKey === afterUserStableKey, "owner_identity_mismatch");
console.log("owner_identity_stable: PASS");
await request(`/work-runs/${owner.runId}/report`, { expected: 200 });
console.log("owner_report_status: 200");
await request(`/work-runs/${owner.runId}/report`, { auth: false, expected: 401 });
const foreign = await request(`/work-runs/${owner.foreignRunId}/report`, { expected: 404 });
const missing = await request(`/work-runs/wrf_missing_${crypto.randomUUID().replaceAll("-", "")}/report`, { expected: 404 });
assert(JSON.stringify(foreign.body) === JSON.stringify(missing.body), "owner_404_enumeration_mismatch");
console.log("PASS owner/401/404 anti-enumeration");
if (scenarioFilter === "owner_access") {
  console.log("Work Report owner smoke complete");
  process.exit(0);
}
if (scenarioFilter === "recovery_cross_step") {
  const value = await report((await fixture("recovery_cross_step")).runId);
  assert(warningCodes(value).has("RECOVERY_LINK_INCONSISTENT"), "recovery_cross_step_warning");
  assert(value.overallStatus === "data_incomplete", "recovery_cross_step_status");
  assert(!value.runtimeExecutions.some((entry) => entry.isFinalEffectiveExecution), "recovery_cross_step_final");
  assert(value.recovery.recovered === false, "recovery_cross_step_recovered");
  assert(value.share.allowed === false, "recovery_cross_step_share");
  assert(value.runtimeExecutions.some((entry) => entry.status === "failed"), "recovery_cross_step_root_visible");
  console.log("Work Report recovery_cross_step smoke complete");
  process.exit(0);
}
if (scenarioFilter === "ledger_wrong_owner") {
  const created = await fixture("ledger_wrong_owner");
  assert(created.ledgerInserted === true, "ledger_wrong_owner_inserted");
  assert(created.expectedMismatch === "user", "ledger_wrong_owner_mismatch");
  console.log("ledger_fixture_postcheck: PASS");
  const value = await report(created.runId);
  assert(value.settlement.status === "inconsistent", "ledger_wrong_owner_settlement");
  assert(value.settlement.grossGp === null, "ledger_wrong_owner_gross_gp");
  assert(value.settlement.grossGpSource === "none", "ledger_wrong_owner_gross_gp_source");
  assert(warningCodes(value).has("LEDGER_LINK_INCONSISTENT"), "ledger_wrong_owner_warning");
  assert(value.share.allowed === false, "ledger_wrong_owner_share");
  console.log("Work Report ledger_wrong_owner smoke complete");
  process.exit(0);
}
if (scenarioFilter === "multiple_ledger_candidates") {
  const created = await fixture("multiple_ledger_candidates");
  assert(created.ledgerInserted === true, "multiple_ledger_inserted");
  assert(created.relatedLedgerCount === 2, "multiple_ledger_count");
  assert(created.expectedMismatch === "multiple_candidates", "multiple_ledger_mismatch");
  console.log("ledger_fixture_postcheck: PASS");
  const value = await report(created.runId);
  assert(value.settlement.status === "inconsistent", "multiple_ledger_settlement");
  assert(value.settlement.grossGp === null, "multiple_ledger_gross_gp");
  assert(value.settlement.grossGpSource === "none", "multiple_ledger_gross_gp_source");
  assert(warningCodes(value).has("LEDGER_LINK_INCONSISTENT"), "multiple_ledger_warning");
  assert(value.overallStatus === "data_incomplete", "multiple_ledger_overall_status");
  assert(value.share.allowed === false, "multiple_ledger_share");
  assert(!("ledgers" in value), "multiple_ledger_list_leak");
  assert(!containsSentinel(value), "multiple_ledger_sentinel");
  console.log("Work Report multiple_ledger_candidates smoke complete");
  process.exit(0);
}
if (scenarioFilter === "inferred_legacy_reward") {
  const created = await fixture("inferred_legacy_reward");
  assert(created.legacyActualRewardPresent === true, "inferred_legacy_fixture_reward");
  assert(created.settlementRecordPresent === false, "inferred_legacy_fixture_settlement");
  assert(created.relatedLedgerCount === 0, "inferred_legacy_fixture_ledgers");
  console.log("legacy_fixture_postcheck: PASS");
  const value = await report(created.runId);
  const codes = warningCodes(value);
  assert(value.settlement.grossGpSource === "inferred_legacy", "inferred_legacy_source");
  assert(value.settlement.grossGp === 123, "inferred_legacy_gross_gp");
  assert(codes.has("ACTUAL_REWARD_INFERRED_LEGACY"), "inferred_legacy_warning");
  assert(value.settlement.status !== "inconsistent", "inferred_legacy_not_inconsistent");
  assert(value.settlement.status !== "settled", "inferred_legacy_not_settled");
  assert(value.kind !== "verified_runtime_work", "inferred_legacy_kind");
  assert(value.share.allowed === false, "inferred_legacy_share");
  assert(!codes.has("LEDGER_LINK_INCONSISTENT"), "inferred_legacy_no_ledger_warning");
  assert(!codes.has("SETTLEMENT_FACTS_INCONSISTENT"), "inferred_legacy_no_settlement_warning");
  assert(!containsSentinel(value), "inferred_legacy_sentinel");
  console.log("Work Report inferred_legacy_reward smoke complete");
  process.exit(0);
}
if (scenarioFilter === "actual_energy_zero") {
  const zeroEnergyFixture = await fixture("actual_energy_zero");
  const zeroEnergyReport = await report(zeroEnergyFixture.runId);
  assert(zeroEnergyReport.settlement.actualEnergy === 0, "actual_energy_zero_value");
  assert(!warningCodes(zeroEnergyReport).has("ACTUAL_ENERGY_MISSING"), "actual_energy_zero_no_warning");
  assert(zeroEnergyReport.settlement.status === "settled", "actual_energy_zero_settlement_status");
  assert(zeroEnergyReport.overallStatus === "completed", "actual_energy_zero_overall_status");
  assert(zeroEnergyReport.kind === "verified_runtime_work", "actual_energy_zero_kind");
  console.log("Work Report actual_energy_zero smoke complete");
  process.exit(0);
}
if (scenarioFilter === "actual_energy_null_projection") {
  const projectionFixture = await fixture("actual_energy_null_projection");
  assert(projectionFixture.projectionChecked === true, "projection_checked");
  assert(projectionFixture.actualEnergyIsNull === true, "projection_null");
  assert(projectionFixture.missingWarningPresent === true, "projection_warning");
  assert(!("warnings" in projectionFixture), "projection_no_warnings");
  assert(!("runId" in projectionFixture), "projection_no_runId");
  assert(!("id" in projectionFixture), "projection_no_id");
  console.log("Work Report actual_energy_null_projection smoke complete");
  process.exit(0);
}

const simulation = await report((await fixture("simulation")).runId);
assert(simulation.kind === "simulation", "simulation_kind");
assert(simulation.settlement.status === "not_eligible", "simulation_settlement");
assert(simulation.settlement.grossGp === null, "simulation_gross_gp");
assert(simulation.share.allowed && simulation.share.text?.includes("Simulation") && simulation.share.text?.includes("not counted as formal work history"), "simulation_share");
console.log("PASS simulation");

const verifiedFixture = await fixture("verified_runtime");
const verified = await report(verifiedFixture.runId);
assert(verified.kind === "verified_runtime_work", "verified_kind");
assert(verified.overallStatus === "completed", "verified_status");
assert(verified.verification.status === "passed" && verified.verification.source === "workflow_step", "verified_verification");
assert(verified.settlement.status === "settled" && verified.settlement.grossGpSource === "ledger", "verified_settlement");
assert(verified.share.allowed === true, "verified_share");
console.log("PASS verified runtime");

const failed = await report((await fixture("failed_runtime")).runId);
assert(failed.overallStatus === "failed", "failed_runtime_status");
assert(failed.runtimeExecutions.some((entry) => entry.status === "failed"), "failed_runtime_visible");
assert(!failed.runtimeExecutions.some((entry) => entry.isFinalEffectiveExecution), "failed_runtime_final");
assert(failed.metrics.totalTokens === 30 && !failed.share.allowed, "failed_runtime_metrics_share");
console.log("PASS failed runtime");

const recovered = await report((await fixture("direct_recovery_success")).runId);
assert(recovered.recovery.status === "succeeded" && recovered.recovery.recovered, "recovery_success_status");
assert(recovered.runtimeExecutions.length === 2 && recovered.metrics.totalTokens === 42, "recovery_success_metrics");
assert(recovered.runtimeExecutions.some((entry) => entry.status === "failed") && recovered.runtimeExecutions.some((entry) => entry.isFinalEffectiveExecution), "recovery_success_chain");
console.log("PASS direct recovery");

const recoveryCases = [
  ["recovery_child_failed", "RECOVERY_FAILED"],
  ["recovery_self_reference", "RECOVERY_GRAPH_CYCLE"],
  ["recovery_cycle", "RECOVERY_GRAPH_CYCLE"],
  ["recovery_depth_three", "RECOVERY_GRAPH_DEPTH_EXCEEDED"],
  ["recovery_cross_owner", "RECOVERY_LINK_INCONSISTENT"],
  ["recovery_cross_agent", "RECOVERY_LINK_INCONSISTENT"],
  ["recovery_cross_run", "RECOVERY_LINK_INCONSISTENT"],
  ["recovery_cross_step", "RECOVERY_LINK_INCONSISTENT"],
];
for (const [scenario, expectedCode] of recoveryCases) {
  const value = await report((await fixture(scenario)).runId);
  if (expectedCode === "RECOVERY_FAILED") assert(value.overallStatus === "recovery_failed", `${scenario}_status`);
  else assert(warningCodes(value).has(expectedCode) && value.overallStatus === "data_incomplete", `${scenario}_warning`);
  assert(!value.runtimeExecutions.some((entry) => entry.isFinalEffectiveExecution), `${scenario}_final`);
}
console.log("PASS recovery anomaly matrix");

const verificationUnknown = await report((await fixture("verification_unknown")).runId);
assert(verificationUnknown.verification.status === "unknown" && verificationUnknown.verification.source === "legacy_unknown", "verification_unknown");
assert(verificationUnknown.kind !== "verified_runtime_work", "verification_unknown_kind");
const verificationFailed = await report((await fixture("verification_failed")).runId);
assert(verificationFailed.verification.status === "failed" && verificationFailed.overallStatus === "verification_failed", "verification_failed");
const multipleVerify = await report((await fixture("multiple_verify_steps")).runId);
assert(warningCodes(multipleVerify).has("VERIFICATION_FACTS_INCONSISTENT") && multipleVerify.overallStatus === "data_incomplete", "multiple_verify");
console.log("PASS verification matrix");

const unsettledReport = await report((await fixture("settlement_unsettled")).runId);
assert(unsettledReport.kind === "runtime_unsettled" && unsettledReport.overallStatus === "unsettled" && !unsettledReport.share.allowed, "settlement_unsettled");
for (const scenario of ["ledger_wrong_owner", "ledger_wrong_agent", "ledger_wrong_source", "ledger_wrong_event_type", "ledger_wrong_point_type", "ledger_invalid_amount", "multiple_ledger_candidates"]) {
  const value = await report((await fixture(scenario)).runId);
  assert(value.settlement.status === "inconsistent", `${scenario}_settlement`);
  assert(value.settlement.grossGp === null && value.settlement.grossGpSource === "none", `${scenario}_gross_gp`);
  assert(warningCodes(value).has("LEDGER_LINK_INCONSISTENT"), `${scenario}_warning`);
}
console.log("PASS settlement/ledger matrix");

const legacyFixture = await fixture("inferred_legacy_reward");
assert(legacyFixture.legacyActualRewardPresent === true, "inferred_legacy_fixture_reward");
assert(legacyFixture.settlementRecordPresent === false, "inferred_legacy_fixture_settlement");
assert(legacyFixture.relatedLedgerCount === 0, "inferred_legacy_fixture_ledgers");
const legacy = await report(legacyFixture.runId);
const legacyCodes = warningCodes(legacy);
assert(legacy.settlement.grossGpSource === "inferred_legacy", "inferred_legacy_source");
assert(legacy.settlement.grossGp === 123, "inferred_legacy_gross_gp");
assert(legacyCodes.has("ACTUAL_REWARD_INFERRED_LEGACY"), "inferred_legacy_warning");
assert(legacy.settlement.status !== "inconsistent", "inferred_legacy_not_inconsistent");
assert(legacy.settlement.status !== "settled", "inferred_legacy_not_settled");
assert(legacy.kind !== "verified_runtime_work", "inferred_legacy_kind");
assert(legacy.share.allowed === false, "inferred_legacy_share");
assert(!legacyCodes.has("LEDGER_LINK_INCONSISTENT"), "inferred_legacy_no_ledger_warning");
assert(!legacyCodes.has("SETTLEMENT_FACTS_INCONSISTENT"), "inferred_legacy_no_settlement_warning");
assert(!containsSentinel(legacy), "inferred_legacy_sentinel");
const zeroEnergyFixture = await fixture("actual_energy_zero");
const zeroEnergyReport = await report(zeroEnergyFixture.runId);
assert(zeroEnergyReport.settlement.actualEnergy === 0, "actual_energy_zero_value");
assert(!warningCodes(zeroEnergyReport).has("ACTUAL_ENERGY_MISSING"), "actual_energy_zero_no_warning");
assert(zeroEnergyReport.settlement.status === "settled", "actual_energy_zero_settlement_status");
assert(zeroEnergyReport.overallStatus === "completed", "actual_energy_zero_overall_status");
assert(zeroEnergyReport.kind === "verified_runtime_work", "actual_energy_zero_kind");

const projectionFixture = await fixture("actual_energy_null_projection");
assert(projectionFixture.projectionChecked === true, "projection_checked");
assert(projectionFixture.actualEnergyIsNull === true, "projection_null");
assert(projectionFixture.missingWarningPresent === true, "projection_warning");
assert(!("warnings" in projectionFixture), "projection_no_warnings");
assert(!("runId" in projectionFixture), "projection_no_runId");
assert(!("id" in projectionFixture), "projection_no_id");

console.log("PASS inferred legacy, actualEnergy zero and null projection");

const validBrief = await report((await fixture("research_brief_valid")).runId);
assert(validBrief.structuredResult?.type === "research_brief", "brief_valid_type");
const source = validBrief.structuredResult.value.sources[0];
assert(source.displayDomain === "example.com", "brief_domain");
assert(!source.safeUrl.includes("username") && !source.safeUrl.includes("password") && !source.safeUrl.includes("?") && !source.safeUrl.includes("#"), "brief_url_projection");
assert(!containsSentinel(validBrief) && !validBrief.share.text?.includes(sentinel), "brief_sentinel");
console.log("PASS Research Brief positive");

for (const scenario of [
  "research_brief_invalid_json", "research_brief_invalid_root", "research_brief_missing_summary",
  "research_brief_blank_summary", "research_brief_non_string_summary", "research_brief_bad_sources",
  "research_brief_javascript_url", "research_brief_bad_fact", "research_brief_bad_recommendations",
]) {
  const value = await report((await fixture(scenario)).runId);
  assert(value.structuredResult?.type === "unavailable", `${scenario}_unavailable`);
  assert(warningCodes(value).has("STRUCTURED_RESULT_UNAVAILABLE"), `${scenario}_warning`);
  assert(!containsSentinel(value), `${scenario}_sentinel`);
}
console.log("PASS Research Brief negative matrix");

for (const [atLimit, overLimit, field, limit] of [
  ["research_brief_sources_20", "research_brief_sources_21", "sources", 20],
  ["research_brief_facts_40", "research_brief_facts_41", "factVsJudgment", 40],
  ["research_brief_recommendations_20", "research_brief_recommendations_21", "recommendations", 20],
]) {
  const exact = await report((await fixture(atLimit)).runId);
  const over = await report((await fixture(overLimit)).runId);
  assert(exact.structuredResult.value[field].length === limit, `${field}_exact_limit`);
  assert(over.structuredResult.value[field].length === limit && warningCodes(over).has("DATA_TRUNCATED"), `${field}_over_limit`);
}
console.log("PASS array limit matrix");

const adminMissing = await adminReport(verifiedFixture.runId, null, 401);
assert(adminMissing.status === 401, "admin_missing_token");
await adminReport(verifiedFixture.runId, "wrong", 401);
const adminOk = await adminReport(verifiedFixture.runId, adminToken, 200);
assert(JSON.stringify(adminOk.body.report) === JSON.stringify(verified), "admin_core_report_mismatch");
assert(adminOk.body.audit?.schemaVersion === "v1" && adminOk.body.audit?.runId === verifiedFixture.runId, "admin_audit");
await adminReport(`wrf_missing_${crypto.randomUUID().replaceAll("-", "")}`, adminToken, 404);
assert(!containsSentinel(adminOk.body), "admin_sentinel");
console.log("PASS Admin API matrix");

console.log("PASS staging isolation");
console.log("PASS stdout/stderr sentinel safety");
console.log("Work Report verification complete");
