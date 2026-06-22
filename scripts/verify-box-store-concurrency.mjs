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
const testToken = process.env.TEST_ENDPOINT_TOKEN || "ci_secret";

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
    "x-test-endpoint-token": testToken,
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

async function inspect(initData, type, userId) {
  const body = { type };
  if (userId) body.userId = userId;
  const res = await request(initData, "/test/inspect", {
    method: "POST",
    body: JSON.stringify(body)
  });
  return res.results;
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

  await request(initDataA, "/test/update-stock", {
    method: "POST",
    body: JSON.stringify({ boxId: alphaProduct.id, supply: 50000 })
  });

  const preMe = await request(initDataA, "/me");
  const preSnapshotGP = preMe.user.pendingPoints;
  console.log(`[CONCURRENCY_TEST] User A Initial GP Snapshot: ${preSnapshotGP}`);

  // Assert starting snapshot in DB matches 1000
  const balanceBefore = await inspect(initDataA, "user_balance");
  if (balanceBefore[0]?.pending_points_balance !== 1000) {
    throw new Error(`Expected DB snapshot to be 1000, got ${balanceBefore[0]?.pending_points_balance}`);
  }

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

  // Database Verification for Purchase 1
  const balanceAfter1 = await inspect(initDataA, "user_balance");
  if (balanceAfter1[0]?.pending_points_balance !== 750) {
    throw new Error(`Expected DB snapshot after purchase to be 750, got ${balanceAfter1[0]?.pending_points_balance}`);
  }

  const ordersAfter1 = await inspect(initDataA, "purchase_state");
  const fulfilledOrders = ordersAfter1.filter(o => o.status === "fulfilled");
  if (fulfilledOrders.length !== 1) {
    throw new Error(`Expected exactly 1 fulfilled order in DB, got ${fulfilledOrders.length}`);
  }

  const invAfter1 = await request(initDataA, "/inventory");
  const boxesAfter1 = invAfter1.items.filter(i => i.type === "box" && i.name !== "Starter Box");
  if (boxesAfter1.length !== 1) {
    throw new Error(`Expected exactly 1 inventory box, got ${boxesAfter1.length}`);
  }

  // Double-request idempotency check
  const purchaseRes2 = await runStep("Repeat purchase with identical idempotencyKey", () => request(initDataA, `/store/boxes/${alphaProduct.id}/orders`, {
    method: "POST",
    body: JSON.stringify({ quantity: 1, idempotencyKey })
  }));
  if (purchaseRes2.order.id !== purchaseRes.order.id || purchaseRes2.order.status !== "fulfilled") {
    throw new Error("Idempotent purchase request did not return the original fulfilled order");
  }

  // Database verification after idempotent repeat
  const balanceAfter2 = await inspect(initDataA, "user_balance");
  if (balanceAfter2[0]?.pending_points_balance !== 750) {
    throw new Error(`Expected DB snapshot to remain 750 after retry, got ${balanceAfter2[0]?.pending_points_balance}`);
  }

  const ordersAfter2 = await inspect(initDataA, "purchase_state");
  const fulfilledOrders2 = ordersAfter2.filter(o => o.status === "fulfilled");
  if (fulfilledOrders2.length !== 1) {
    throw new Error(`Expected still exactly 1 fulfilled order in DB, got ${fulfilledOrders2.length}`);
  }

  const invAfter2 = await request(initDataA, "/inventory");
  const boxesAfter2 = invAfter2.items.filter(i => i.type === "box" && i.name !== "Starter Box");
  if (boxesAfter2.length !== 1) {
    throw new Error(`Expected inventory boxes to remain 1, got ${boxesAfter2.length}`);
  }

  // --- 2. Concurrency on Last Stock (最后一个库存并发测试) ---
  await runStep("Register User B", () => request(initDataB, "/me"));
  await runStep("Claim Agent User B", () => request(initDataB, "/agents/claim", { method: "POST" }));
  await runStep("Grant 1000 GP to User B", () => request(initDataB, "/test/points-grant", {
    method: "POST",
    body: JSON.stringify({ amount: 1000, pointType: "pending_points" })
  }));

  console.log(`[CONCURRENCY_TEST] Setting remaining supply to exactly 1 via test endpoint`);
  await request(initDataA, "/test/update-stock", {
    method: "POST",
    body: JSON.stringify({ boxId: alphaProduct.id, supply: 1 })
  });

  const raceToken = `race_${Date.now()}`;
  console.log(`[CONCURRENCY_TEST] Stock is now exactly 1. Launching concurrent purchase from User A and User B...`);
  const purchasePromises = [
    request(initDataA, `/store/boxes/${alphaProduct.id}/orders`, {
      method: "POST",
      body: JSON.stringify({ quantity: 1, idempotencyKey: `race_a_${raceToken}` })
    }).catch(err => ({ error: true, message: err.message })),
    request(initDataB, `/store/boxes/${alphaProduct.id}/orders`, {
      method: "POST",
      body: JSON.stringify({ quantity: 1, idempotencyKey: `race_b_${raceToken}` })
    }).catch(err => ({ error: true, message: err.message }))
  ];

  const results = await Promise.all(purchasePromises);
  const successResults = results.filter(r => !r.error && r.order?.status === "fulfilled");
  const failResults = results.filter(r => r.error || r.order?.status === "failed");

  console.log(`[CONCURRENCY_TEST] Concurrent Purchase Results: Successes: ${successResults.length}, Failures: ${failResults.length}`);
  if (successResults.length !== 1 || failResults.length !== 1) {
    throw new Error(`Concurrency check failed. Exactly one request must succeed and one must fail.`);
  }

  // Database verification for Concurrency on Last Stock
  const stockInspect = await inspect(initDataA, "product_stock");
  const alphaStock = stockInspect.find(s => s.id === alphaProduct.id);
  if (alphaStock?.remaining_supply !== 0) {
    throw new Error(`Expected remaining supply to be 0, got ${alphaStock?.remaining_supply}`);
  }

  // Determine who won and who lost
  const winData = successResults[0];
  const winUserId = winData.order.userId;
  const isAWinner = winUserId === preMe.user.id;
  const winInitData = isAWinner ? initDataA : initDataB;
  const loseInitData = isAWinner ? initDataB : initDataA;

  // Assert winner is charged once and has order
  const winBalance = await inspect(winInitData, "user_balance");
  const expectedWinBal = isAWinner ? 500 : 750; // User A starts at 750, User B starts at 1000
  if (winBalance[0]?.pending_points_balance !== expectedWinBal) {
    throw new Error(`Expected winner balance to be ${expectedWinBal}, got ${winBalance[0]?.pending_points_balance}`);
  }

  const winOrders = await inspect(winInitData, "purchase_state");
  const winFulfilled = winOrders.filter(o => o.status === "fulfilled");
  if (winFulfilled.length !== (isAWinner ? 2 : 1)) {
    throw new Error(`Expected winner to have correct fulfilled orders count`);
  }

  // Assert loser is fully rolled back (no charge, no inventory, no order records due to database batch rollback)
  const loseBalance = await inspect(loseInitData, "user_balance");
  const expectedLoseBal = isAWinner ? 1000 : 750;
  if (loseBalance[0]?.pending_points_balance !== expectedLoseBal) {
    throw new Error(`Expected loser balance to remain ${expectedLoseBal}, got ${loseBalance[0]?.pending_points_balance}`);
  }

  const loseOrders = await inspect(loseInitData, "purchase_state");
  const loseFulfilled = loseOrders.filter(o => o.status === "fulfilled");
  if (loseFulfilled.length !== (isAWinner ? 0 : 1)) {
    throw new Error(`Expected loser to have no new fulfilled orders`);
  }

  // Due to INSERT-first pending reservation, failed request produces a failed box order
  const loseAllOrders = loseOrders.filter(o => o.idempotency_key.includes(`race_`));
  if (loseAllOrders.length !== 1) {
    throw new Error(`Expected exactly 1 race order record for loser, found ${loseAllOrders.length}`);
  }
  if (loseAllOrders[0].status !== "failed") {
    throw new Error(`Expected loser order status to be 'failed', got ${loseAllOrders[0].status}`);
  }

  // --- 3. Concurrency on Opening the Same Box (同一盒子并发开盒测试) ---
  const winnerInv = await request(winInitData, "/inventory");
  const winnerBoxes = winnerInv.items.filter(i => i.type === "box" && i.status === "available" && i.name !== "Starter Box");
  if (winnerBoxes.length === 0) {
    throw new Error("Winner does not have any available boxes to test concurrent open");
  }
  const targetBoxId = winnerBoxes[0].id;
  console.log(`[CONCURRENCY_TEST] Target Box ID for concurrent open: ${targetBoxId}`);

  // Inspect pre-open drop tables to track issued counts
  const dropCatalog = await request(winInitData, `/store/boxes/${alphaProduct.id}/drop-table`);
  const initialIssuedCounts = {};
  dropCatalog.dropTable.forEach(item => {
    initialIssuedCounts[item.id] = item.issuedCount;
  });

  const preOpenBalance = await inspect(winInitData, "user_balance");
  const preOpenGP = preOpenBalance[0]?.pending_points_balance || 0;

  // Open concurrently
  const openPromises = [
    request(winInitData, `/boxes/${targetBoxId}/open`, { method: "POST" }).catch(err => ({ error: true, message: err.message })),
    request(winInitData, `/boxes/${targetBoxId}/open`, { method: "POST" }).catch(err => ({ error: true, message: err.message }))
  ];

  const openResults = await Promise.all(openPromises);
  const openSuccesses = openResults.filter(r => !r.error && r.rewards);
  const openFailures = openResults.filter(r => r.error);

  console.log(`[CONCURRENCY_TEST] Concurrent Open Results: Successes: ${openSuccesses.length}, Failures: ${openFailures.length}`);
  if (openSuccesses.length !== 1 || openFailures.length !== 1) {
    throw new Error(`Concurrent open check failed. Exactly one request must succeed and one must fail.`);
  }

  // Database verification for Concurrency on Opening the Same Box
  const boxOpenState = await inspect(winInitData, "box_open_state");
  const openRecord = boxOpenState.filter(r => r.inventory_item_id === targetBoxId);
  if (openRecord.length !== 1) {
    throw new Error(`Expected exactly 1 box opening reservation in DB, got ${openRecord.length}`);
  }

  // Validate the reservation has the correct user_id owner attribute
  if (openRecord[0]?.user_id !== winUserId) {
    throw new Error(`Expected reservation owner to be ${winUserId}, got ${openRecord[0]?.user_id}`);
  }

  const postOpenBalance = await inspect(winInitData, "user_balance");
  const postOpenGP = postOpenBalance[0]?.pending_points_balance || 0;
  const gpDiff = postOpenGP - preOpenGP;

  const rewardItem = openSuccesses[0].rewards[0];
  const expectedGP = rewardItem?.pointAmount || 0;
  if (gpDiff !== expectedGP) {
    throw new Error(`GP increase mismatch. Expected +${expectedGP}, got +${gpDiff}`);
  }

  // Verify drop item issued count increased by exactly 1
  const postDropCatalog = await request(winInitData, `/store/boxes/${alphaProduct.id}/drop-table`);
  let issuedCountDiffSum = 0;
  postDropCatalog.dropTable.forEach(item => {
    const initial = initialIssuedCounts[item.id] || 0;
    issuedCountDiffSum += (item.issuedCount - initial);
  });
  if (issuedCountDiffSum !== 1) {
    throw new Error(`Expected drop table issued_count sum diff to be 1, got ${issuedCountDiffSum}`);
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
      headers: { 
        "x-test-fail-settle": "true",
        "x-test-endpoint-token": testToken
      }
    });
  }

  if (firstRunRes.run.status !== "failed") {
    throw new Error(`Run (with fault injection) should have failed, got ${firstRunRes.run.status}`);
  }

  // Verify failure status of steps and settlement in DB
  const stepsRes = await request(initDataC, `/work-runs/${runId}/steps`);
  const settleStep = stepsRes.steps.find(s => s.stepType === "settle");
  if (settleStep?.status !== "failed") {
    throw new Error("Settle step status should be failed");
  }

  const settleStates = await inspect(initDataC, "settlement_state");
  const runSettle = settleStates.find(s => s.run_id === runId);
  if (runSettle?.status !== "failed") {
    throw new Error(`Expected DB settlement status to be failed, got ${runSettle?.status}`);
  }

  // GP balance, Energy and daily_run_count check after fault
  const userCBalanceBefore = await inspect(initDataC, "user_balance");
  if ((userCBalanceBefore[0]?.pending_points_balance || 0) !== 0) {
    throw new Error(`Expected User C points to be 0, got ${userCBalanceBefore[0]?.pending_points_balance}`);
  }

  const agentCBefore = await request(initDataC, "/me");
  const energyBefore = agentCBefore.agent.energy;
  const runCountBefore = agentCBefore.agent.dailyRunCount;

  // Retry settlement WITHOUT fault injection
  console.log(`[CONCURRENCY_TEST] Retrying work run ${runId} without fault injection...`);
  const retryRes = await request(initDataC, `/work-runs/${runId}/retry-step`, {
    method: "POST"
  });

  console.log(`[CONCURRENCY_TEST] Work Run status after retry: ${retryRes.run.status}`);
  if (retryRes.run.status !== "completed") {
    throw new Error(`Workflow should have completed after retry, got ${retryRes.run.status}`);
  }

  // Database verification after successful retry
  const settleStatesAfter = await inspect(initDataC, "settlement_state");
  const runSettleAfter = settleStatesAfter.find(s => s.run_id === runId);
  if (runSettleAfter?.status !== "completed") {
    throw new Error(`Expected DB settlement status to be completed, got ${runSettleAfter?.status}`);
  }

  const userCBalanceAfter = await inspect(initDataC, "user_balance");
  if (userCBalanceAfter[0]?.pending_points_balance !== testTask.basePendingPoints) {
    throw new Error(`Expected User C reward to be ${testTask.basePendingPoints}, got ${userCBalanceAfter[0]?.pending_points_balance}`);
  }

  const agentCAfter = await request(initDataC, "/me");
  const energyDiff = energyBefore - agentCAfter.agent.energy;
  const runCountDiff = agentCAfter.agent.dailyRunCount - runCountBefore;

  if (energyDiff !== testTask.energyCost) {
    throw new Error(`Expected Energy cost to be ${testTask.energyCost}, got ${energyDiff}`);
  }
  if (runCountDiff !== 1) {
    throw new Error(`Expected daily_run_count increase to be 1, got ${runCountDiff}`);
  }

  // Verify that a second retry attempt produces no updates or state changes
  try {
    await request(initDataC, `/work-runs/${runId}/retry-step`, { method: "POST" });
    throw new Error("Should not be allowed to retry an already completed run");
  } catch (e) {
    if (!e.message.includes("400") && !e.message.includes("invalid_state")) {
      throw e;
    }
  }

  // Assert state remains identical
  const userCBalanceAfter2 = await inspect(initDataC, "user_balance");
  if (userCBalanceAfter2[0]?.pending_points_balance !== testTask.basePendingPoints) {
    throw new Error(`Expected User C reward to remain unchanged`);
  }
  const agentCAfter2 = await request(initDataC, "/me");
  if (agentCAfter2.agent.energy !== agentCAfter.agent.energy || agentCAfter2.agent.dailyRunCount !== agentCAfter.agent.dailyRunCount) {
    throw new Error(`Expected agent stats to remain unchanged`);
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
