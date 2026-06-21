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
    query_id: "verify_concurrency_query_id",
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

async function request(initData, path, options = {}) {
  const reqHeaders = new Headers({
    "x-telegram-init-data": initData,
    ...options.headers
  });
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
    console.log(`[CONCURRENCY_TEST] PASS: ${name}`);
    return result;
  } catch (error) {
    console.error(`[CONCURRENCY_TEST] FAIL: ${name} - ${error.message}`);
    process.exit(1);
  }
}

async function run() {
  console.log("=== Starting Box Store Concurrency & Settlement Recovery Verification ===");

  // Create unique user IDs for three users A, B and C (for workflow retry)
  const idA = Number(`997${Date.now().toString().slice(-9)}`);
  const initDataA = signTelegramInitData({ id: idA, username: `user_a_${idA}` });

  const idB = Number(`998${Date.now().toString().slice(-9)}`);
  const initDataB = signTelegramInitData({ id: idB, username: `user_b_${idB}` });

  const idC = Number(`999${Date.now().toString().slice(-9)}`);
  const initDataC = signTelegramInitData({ id: idC, username: `user_c_${idC}` });

  // --- 1. GP Single Charge (GP单次扣款差值) & Idempotency Testing ---
  await runStep("Register User A", () => request(initDataA, "/me"));
  await runStep("Claim Agent User A", () => request(initDataA, "/agents/claim", { method: "POST" }));
  await runStep("Grant 1000 GP to User A", () => request(initDataA, "/test/points-grant", {
    method: "POST",
    body: JSON.stringify({ amount: 1000, pointType: "pending_points" })
  }));

  const catalog = await request(initDataA, "/store/boxes");
  const alphaProduct = catalog.products.find(p => p.boxType === "worker" || p.code === "worker");
  if (!alphaProduct) {
    throw new Error("Worker Box product not found in catalog");
  }

  // Reset stock of alpha box product to 50000 to ensure clean runs
  await request(initDataA, "/test/update-stock", {
    method: "POST",
    body: JSON.stringify({ boxId: alphaProduct.id, supply: 50000 })
  });

  const preMe = await request(initDataA, "/me");
  const preSnapshotGP = preMe.user.pendingPoints; // snapshot balance from /me
  console.log(`[CONCURRENCY_TEST] User A Initial GP Snapshot: ${preSnapshotGP}`);

  const idempotencyKey = `idem_purchase_${Date.now()}`;
  const purchaseRes = await runStep("Buy premium box (price 250 GP) with User A", () => request(initDataA, `/store/boxes/${alphaProduct.id}/orders`, {
    method: "POST",
    body: JSON.stringify({ quantity: 1, idempotencyKey })
  }));

  const postMe = await request(initDataA, "/me");
  const postSnapshotGP = postMe.user.pendingPoints;
  const difference = preSnapshotGP - postSnapshotGP;
  console.log(`[CONCURRENCY_TEST] User A Post-Purchase GP Snapshot: ${postSnapshotGP} (Diff: ${difference})`);
  if (difference !== 250) {
    throw new Error(`GP snapshot deduction mismatch. Expected 250, got ${difference}`);
  }

  // Double-request idempotency check
  const purchaseRes2 = await runStep("Repeat purchase with identical idempotencyKey", () => request(initDataA, `/store/boxes/${alphaProduct.id}/orders`, {
    method: "POST",
    body: JSON.stringify({ quantity: 1, idempotencyKey })
  }));
  if (purchaseRes2.order.id !== purchaseRes.order.id || purchaseRes2.order.status !== "fulfilled") {
    throw new Error("Idempotent purchase request did not return the original fulfilled order");
  }

  // --- 2. Concurrency on Last Stock (最后一个库存并发测试) ---
  await runStep("Register User B", () => request(initDataB, "/me"));
  await runStep("Claim Agent User B", () => request(initDataB, "/agents/claim", { method: "POST" }));
  await runStep("Grant 1000 GP to User B", () => request(initDataB, "/test/points-grant", {
    method: "POST",
    body: JSON.stringify({ amount: 1000, pointType: "pending_points" })
  }));

  // We have User A and User B. They both have enough balance.
  // Let's find remaining supply of alpha box. We can check it and if it's 0, we update it via admin endpoint if available,
  // or we can test with whatever remaining supply. But since we need to assert remaining_supply = 1, let's look at the database.
  // Wait, is there a way to update the stock of the product? We don't have an admin endpoint to change product stock,
  // but wait! If we do concurrent purchases, we can try to buy until remaining_supply is 1, or we can just send concurrent requests.
  // Let's find current remaining supply of alpha product.
  const currentCatalog = await request(initDataA, "/store/boxes");
  const freshAlpha = currentCatalog.products.find(p => p.id === alphaProduct.id);
  console.log(`[CONCURRENCY_TEST] Current Alpha Box Remaining Supply: ${freshAlpha.remainingSupply}`);

  // Set the remaining supply to exactly 1 using the test endpoint
  console.log(`[CONCURRENCY_TEST] Setting remaining supply to exactly 1 via test endpoint`);
  await request(initDataA, "/test/update-stock", {
    method: "POST",
    body: JSON.stringify({ boxId: alphaProduct.id, supply: 1 })
  });

  console.log(`[CONCURRENCY_TEST] Stock is now exactly 1. Launching concurrent purchase from User A and User B...`);
  const purchasePromises = [
    request(initDataA, `/store/boxes/${alphaProduct.id}/orders`, {
      method: "POST",
      body: JSON.stringify({ quantity: 1, idempotencyKey: `race_a_${Date.now()}` })
    }).catch(err => ({ error: true, message: err.message })),
    request(initDataB, `/store/boxes/${alphaProduct.id}/orders`, {
      method: "POST",
      body: JSON.stringify({ quantity: 1, idempotencyKey: `race_b_${Date.now()}` })
    }).catch(err => ({ error: true, message: err.message }))
  ];

  const results = await Promise.all(purchasePromises);
  const successResults = results.filter(r => !r.error && r.order?.status === "fulfilled");
  const failResults = results.filter(r => r.error || r.order?.status === "failed");

  console.log(`[CONCURRENCY_TEST] Concurrent Purchase Results: Successes: ${successResults.length}, Failures: ${failResults.length}`);
  if (successResults.length !== 1 || failResults.length !== 1) {
    throw new Error(`Concurrency check failed. Exactly one request must succeed and one must fail. Successes: ${successResults.length}, Failures: ${failResults.length}`);
  }

  // --- 3. Concurrency on Opening the Same Box (同一盒子并发开盒测试) ---
  const invA = await request(initDataA, "/inventory");
  const boxesA = invA.items.filter(i => i.type === "box" && i.status === "available");
  if (boxesA.length === 0) {
    throw new Error("User A does not have any available boxes to test concurrent open");
  }
  const targetBoxId = boxesA[0].id;
  console.log(`[CONCURRENCY_TEST] Target Box ID for concurrent open: ${targetBoxId}`);

  const openPromises = [
    request(initDataA, `/boxes/${targetBoxId}/open`, { method: "POST" }).catch(err => ({ error: true, message: err.message })),
    request(initDataA, `/boxes/${targetBoxId}/open`, { method: "POST" }).catch(err => ({ error: true, message: err.message }))
  ];

  const openResults = await Promise.all(openPromises);
  const openSuccesses = openResults.filter(r => !r.error && r.rewards);
  const openFailures = openResults.filter(r => r.error);

  console.log(`[CONCURRENCY_TEST] Concurrent Open Results: Successes: ${openSuccesses.length}, Failures: ${openFailures.length}`);
  if (openSuccesses.length !== 1 || openFailures.length !== 1) {
    throw new Error(`Concurrent open check failed. Exactly one request must succeed and one must fail. Successes: ${openSuccesses.length}, Failures: ${openFailures.length}`);
  }

  // --- 4. Work Settlement Failure/Retry Fault Injection (Settlement recovery test) ---
  await runStep("Register User C", () => request(initDataC, "/me"));
  await runStep("Claim Agent User C", () => request(initDataC, "/agents/claim", { method: "POST" }));

  const tasksRes = await request(initDataC, "/tasks/available");
  const testTask = tasksRes.tasks.find(t => t.id === "task_daily_checkin") || tasksRes.tasks[0];
  if (!testTask) {
    throw new Error("No tasks available to run verification");
  }

  console.log(`[CONCURRENCY_TEST] Planning and running task ${testTask.id} for User C...`);
  await request(initDataC, `/tasks/${testTask.id}/plan`, { method: "POST" });
  
  const wfIdempotencyKey = `wf_retry_test_${Date.now()}`;
  let firstRunRes = await request(initDataC, `/tasks/${testTask.id}/run`, {
    method: "POST",
    body: JSON.stringify({ idempotencyKey: wfIdempotencyKey })
  });

  const runId = firstRunRes.run.id;
  console.log(`[CONCURRENCY_TEST] Work Run started. Run ID: ${runId}, Initial Status: ${firstRunRes.run.status}`);

  if (firstRunRes.run.status === "waiting_user") {
    console.log(`[CONCURRENCY_TEST] Approving confirmation step with fault injection...`);
    firstRunRes = await request(initDataC, `/work-runs/${runId}/approve-step`, {
      method: "POST",
      headers: { "x-test-fail-settle": "true" }
    });
  }

  if (firstRunRes.run.status !== "failed") {
    throw new Error(`Run (with fault injection) should have failed, got ${firstRunRes.run.status}`);
  }

  // Verify failure status of steps and settlement
  const stepsRes = await request(initDataC, `/work-runs/${runId}/steps`);
  const settleStep = stepsRes.steps.find(s => s.stepType === "settle");
  console.log(`[CONCURRENCY_TEST] Settle step status after failure: ${settleStep?.status}`);
  if (settleStep?.status !== "failed") {
    throw new Error("Settle step status should be failed");
  }

  // Retry settlement WITHOUT fault injection
  console.log(`[CONCURRENCY_TEST] Retrying work run ${runId} without fault injection...`);
  const retryRes = await request(initDataC, `/work-runs/${runId}/retry-step`, {
    method: "POST"
  });

  console.log(`[CONCURRENCY_TEST] Work Run status after retry: ${retryRes.run.status}`);
  if (retryRes.run.status !== "completed") {
    throw new Error(`Workflow should have completed after retry, got ${retryRes.run.status}`);
  }

  // Verify that it can't be retried again
  try {
    await request(initDataC, `/work-runs/${runId}/retry-step`, { method: "POST" });
    throw new Error("Should not be allowed to retry an already completed run");
  } catch (e) {
    if (!e.message.includes("400") && !e.message.includes("invalid_state")) {
      throw e;
    }
  }

  console.log("[CONCURRENCY_TEST] All concurrency and settlement recovery checks completed successfully!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(err => {
    console.error("Unhandled concurrency verification error:", err);
    process.exit(1);
  });
}

export { run as verifyBoxStoreConcurrency };
