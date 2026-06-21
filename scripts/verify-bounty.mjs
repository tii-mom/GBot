import { readFileSync } from "node:fs";
import crypto from "node:crypto";

// 1. Load Environment Variables
let envText = "";
try {
  envText = readFileSync(new URL("../.env", import.meta.url), "utf8");
} catch (_) {}
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const base = process.env.VITE_API_BASE || "http://127.0.0.1:8787";
const adminToken = process.env.ADMIN_TOKEN;
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const adminLoginUser = process.env.ADMIN_LOGIN_USER || "yudeyou0118";

if (!adminToken) throw new Error("ADMIN_TOKEN is missing in .env");
if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is missing in .env");

// 2. Helper Functions
function signTelegramInitData(userObj) {
  const user = JSON.stringify(userObj);
  const authDate = Math.floor(Date.now() / 1000);
  const params = {
    auth_date: String(authDate),
    query_id: "verify_bounty_query_id",
    user: user,
  };
  const dataCheckString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const urlParams = new URLSearchParams({
    ...params,
    hash,
  });
  return urlParams.toString();
}

async function request(path, options = {}, expectedStatus = 200) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (response.status !== expectedStatus) {
    throw new Error(`${options.method || "GET"} ${path} returned ${response.status}, expected ${expectedStatus}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function step(name, fn) {
  try {
    const result = await fn();
    console.log(`PASS ${name}`);
    return result;
  } catch (error) {
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    throw error;
  }
}

// 3. Define Test Users
const user1Init = signTelegramInitData({ id: 888001, username: "bounty_user_one" });
const user2Init = signTelegramInitData({ id: 888002, username: "bounty_user_two" });

const user1Headers = { "x-telegram-init-data": user1Init };
const user2Headers = { "x-telegram-init-data": user2Init };

async function runTests() {
  console.log("=== Starting Bounty Task Network V1 Verification ===");
  console.log(`[INFO] Target API Base URL: ${base}`);
  console.log(`[INFO] Test Running Environment: ${base.includes("localhost") || base.includes("127.0.0.1") ? "Local wrangler dev (Miniflare)" : "Cloudflare remote staging/production"}`);

  // Step 1: Admin Login
  const login = await step("Admin Login", () => request("/admin/login", {
    method: "POST",
    body: JSON.stringify({ username: adminLoginUser, password: adminToken })
  }));
  const adminSession = login.accessToken;
  const adminHeaders = { "x-admin-token": adminSession };

  // Initialize users in DB
  await step("Initialize User 1", () => request("/me", { headers: user1Headers }));
  await step("Initialize User 2", () => request("/me", { headers: user2Headers }));

  // Claim Agents for users so they can earn points
  await step("Claim Agent for User 1", () => request("/agents/claim", { method: "POST", headers: user1Headers }));
  await step("Claim Agent for User 2", () => request("/agents/claim", { method: "POST", headers: user2Headers }));

  // Step 2: Verify side restrictions (User side cannot create bounty tasks)
  await step("Public / User side POST /bounty/tasks is forbidden", async () => {
    // Try posting to admin endpoint without token
    await request("/admin/bounty/tasks", { method: "POST", body: JSON.stringify({}) }, 401);
    // Try posting to user endpoint (non-existent route for creation)
    await request("/bounty/tasks", { method: "POST", body: JSON.stringify({}) }, 404);
  });

  // Step 3: Admin creates a Bounty Task
  const taskId = `bounty_test_${Date.now()}`;
  await step("Admin creates a Bounty Task", () => request("/admin/bounty/tasks", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      id: taskId,
      title: "Bounty Auto & Manual Test Task",
      description: "Test description",
      category: "social",
      platform: "twitter",
      targetUrl: "https://x.com/growthbot",
      budgetTotal: 500, // POINT_TEST budget
      rewardPoints: 100,
      verificationRule: "^https?://(www\\.)?x\\.com/\\w+/status/\\d+",
      submissionType: "link",
      riskLevel: "low",
      ownerType: "partner",
      ownerName: "GrowthBotPartner",
      maxCompletions: 3
    })
  }));

  // Verify task was created with correct fields
  const getTasks = await step("Verify Task fields in GET /bounty/tasks", async () => {
    const res = await request("/bounty/tasks");
    const task = res.tasks.find(t => t.id === taskId);
    if (!task) throw new Error("Created task not found in list");
    if (task.completed_count !== 0) throw new Error("completed_count should be 0");
    if (task.budget_remaining !== 500) throw new Error("budget_remaining should be 500");
    if (task.max_completions !== 3) throw new Error("max_completions should be 3");
    if (task.paused_reason !== null) throw new Error("paused_reason should be null");
    if (task.created_by_admin !== 1) throw new Error("created_by_admin should be 1");
    if (!task.created_at || !task.updated_at) throw new Error("timestamps missing");
    return task;
  });

  // Step 4: User 1 submits verification link. Check budget is NOT deducted on submission
  await step("User 1 submits verification link", () => request(`/bounty/tasks/${taskId}/submit`, {
    method: "POST",
    headers: user1Headers,
    body: JSON.stringify({ link: "https://google.com" })
  }));

  await step("Verify budget not deducted on submission", async () => {
    const res = await request("/bounty/tasks");
    const task = res.tasks.find(t => t.id === taskId);
    if (task.budget_remaining !== 500) throw new Error(`budget should still be 500, got ${task.budget_remaining}`);
  });

  // Step 5: Duplicate link interception
  await step("Intercept duplicate link submission (User 2)", async () => {
    // User 2 tries to submit same link
    await request(`/bounty/tasks/${taskId}/submit`, {
      method: "POST",
      headers: user2Headers,
      body: JSON.stringify({ link: "https://google.com" })
    }, 409);
  });

  await step("Intercept duplicate submission from same user (User 1)", async () => {
    // User 1 tries to submit same link again
    await request(`/bounty/tasks/${taskId}/submit`, {
      method: "POST",
      headers: user1Headers,
      body: JSON.stringify({ link: "https://google.com" })
    }, 409);
  });

  // Step 6: Auto-verification rules & Rejection
  const verifyReject = await step("User 1 verifies invalid format -> Rejected", async () => {
    const res = await request(`/bounty/tasks/${taskId}/verify`, { method: "POST", headers: user1Headers });
    if (res.status !== "rejected") throw new Error(`Expected rejected, got ${res.status}`);
    if (!res.feedback.includes("格式")) throw new Error("Expected feedback on format invalid");
    return res;
  });

  // Now that it's rejected, User 1 can submit a new link
  await new Promise(resolve => setTimeout(resolve, 1100)); // wait for CURRENT_TIMESTAMP second tick
  await step("User 1 submits valid format link", () => request(`/bounty/tasks/${taskId}/submit`, {
    method: "POST",
    headers: user1Headers,
    body: JSON.stringify({ link: "https://x.com/user1/status/88888" })
  }));

  // Step 7: Auto-verification approve & Payout
  const meBefore = await request("/me", { headers: user1Headers });
  const pointsBefore = meBefore.agent?.pendingPoints || 0;

  const verifyApprove = await step("User 1 verifies valid format -> Approved & Payout", async () => {
    const res = await request(`/bounty/tasks/${taskId}/verify`, { method: "POST", headers: user1Headers });
    if (res.status !== "approved") throw new Error(`Expected approved, got ${res.status}`);
    return res;
  });

  await step("Verify budget deducted and points paid out after approval", async () => {
    const res = await request("/bounty/tasks");
    const task = res.tasks.find(t => t.id === taskId);
    if (task.budget_remaining !== 400) throw new Error(`budget should be 400, got ${task.budget_remaining}`);
    if (task.completed_count !== 1) throw new Error(`completed_count should be 1, got ${task.completed_count}`);

    const meAfter = await request("/me", { headers: user1Headers });
    const pointsAfter = meAfter.agent?.pendingPoints || 0;
    if (pointsAfter - pointsBefore !== 100) {
      throw new Error(`User points should have increased by 100, went from ${pointsBefore} to ${pointsAfter}`);
    }

    const statusRes = await request(`/bounty/tasks/${taskId}/status`, { headers: user1Headers });
    if (!statusRes.rewardGrantedAt) throw new Error("rewardGrantedAt timestamp missing");
  });

  // Step 8: Idempotency (Approved user cannot submit or verify again)
  await step("Approved user cannot submit again", async () => {
    await request(`/bounty/tasks/${taskId}/submit`, {
      method: "POST",
      headers: user1Headers,
      body: JSON.stringify({ link: "https://x.com/user1/status/99999" })
    }, 409);
  });

  await step("Approved user cannot verify/reward again", async () => {
    await request(`/bounty/tasks/${taskId}/verify`, {
      method: "POST",
      headers: user1Headers
    }, 400);
  });

  // Step 9: Admin Audit Logs verification
  await step("Verify Admin Audit Log for Task Creation", async () => {
    const auditRes = await request("/admin/audit-logs", { headers: adminHeaders });
    const createLog = auditRes.auditLogs.find(log => String(log.targetObject || "").includes(taskId));
    if (!createLog) throw new Error("Task creation audit log not found");
  });

  // Step 10: Admin pause / resume task & adjust budget
  await step("Admin pauses the bounty task", async () => {
    await request(`/admin/bounty/tasks/${taskId}/pause`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ paused: true, reason: "Manual Test Pause" })
    });
    // Check if status is paused
    const res = await request("/bounty/tasks");
    const task = res.tasks.find(t => t.id === taskId);
    if (task.status !== "paused") throw new Error("Expected status to be paused");
    if (task.paused_reason !== "Manual Test Pause") throw new Error("paused_reason incorrect");

    // Verify user cannot submit while paused
    await request(`/bounty/tasks/${taskId}/submit`, {
      method: "POST",
      headers: user2Headers,
      body: JSON.stringify({ link: "https://x.com/user2/status/98765" })
    }, 400);
  });

  await step("Admin resumes the bounty task", async () => {
    await request(`/admin/bounty/tasks/${taskId}/pause`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ paused: false })
    });
    const res = await request("/bounty/tasks");
    const task = res.tasks.find(t => t.id === taskId);
    if (task.status !== "active") throw new Error("Expected status to be active");
    if (task.paused_reason !== null) throw new Error("paused_reason should be null");
  });

  await step("Admin adjusts budget of the bounty task", async () => {
    await request(`/admin/bounty/tasks/${taskId}/budget`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ budgetTotal: 1000 })
    });
    const res = await request("/bounty/tasks");
    const task = res.tasks.find(t => t.id === taskId);
    if (task.budget_total !== 1000) throw new Error("budgetTotal should be 1000");
    if (task.budget_remaining !== 900) throw new Error(`budgetRemaining should be 900, got ${task.budget_remaining}`);
  });

  // Step 11: Admin manual review / approval workflow
  await step("User 2 submits risk-flagged link", () => request(`/bounty/tasks/${taskId}/submit`, {
    method: "POST",
    headers: user2Headers,
    body: JSON.stringify({ link: "https://x.com/test_user/status/777777" })
  }));

  const verifStatus = await step("User 2 verifies risk-flagged link -> verifying status", async () => {
    const res = await request(`/bounty/tasks/${taskId}/verify`, { method: "POST", headers: user2Headers });
    if (res.status !== "verifying") throw new Error(`Expected verifying, got ${res.status}`);
    if (res.riskFlagged !== 1) throw new Error("Expected riskFlagged to be 1");
    return res;
  });

  // Get verification list and find User 2's verification
  const verificationsRes = await request("/admin/bounty/verifications", { headers: adminHeaders });
  const verifRow = verificationsRes.verifications.find(v => v.bounty_task_id === taskId && v.status === "verifying");
  if (!verifRow) throw new Error("User 2 verification row not found in admin list");

  const user2Before = await request("/me", { headers: user2Headers });
  const user2PointsBefore = user2Before.agent?.pendingPoints || 0;

  await step("Admin manual approves User 2 verification", () => request(`/admin/bounty/verifications/${verifRow.id}/approve`, {
    method: "POST",
    headers: adminHeaders
  }));

  await step("Verify User 2 rewarded and budget updated", async () => {
    const user2After = await request("/me", { headers: user2Headers });
    const user2PointsAfter = user2After.agent?.pendingPoints || 0;
    if (user2PointsAfter - user2PointsBefore !== 100) {
      throw new Error(`User 2 points should have increased by 100, went from ${user2PointsBefore} to ${user2PointsAfter}`);
    }

    const res = await request("/bounty/tasks");
    const task = res.tasks.find(t => t.id === taskId);
    if (task.budget_remaining !== 800) throw new Error(`budget should be 800, got ${task.budget_remaining}`);
    if (task.completed_count !== 2) throw new Error(`completed_count should be 2, got ${task.completed_count}`);
  });

  await step("Admin cannot approve already rewarded verification", async () => {
    await request(`/admin/bounty/verifications/${verifRow.id}/approve`, {
      method: "POST",
      headers: adminHeaders
    }, 400);
  });

  // Step 12: Insufficient budget test
  const insufficientTaskId = `bounty_insufficient_${Date.now()}`;
  await step("Admin creates an insufficient budget task (Budget: 50, Reward: 100)", () => request("/admin/bounty/tasks", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      id: insufficientTaskId,
      title: "Insufficient Budget Test Task",
      category: "social",
      platform: "twitter",
      targetUrl: "https://x.com/growthbot",
      budgetTotal: 50, // Only 50 points budget
      rewardPoints: 100, // Payout requires 100 points
      verificationRule: "^https?://(www\\.)?x\\.com/\\w+/status/\\d+",
      submissionType: "link",
      riskLevel: "low",
      ownerType: "official",
      maxCompletions: 3
    })
  }));

  await step("User 1 submits link to insufficient budget task", () => request(`/bounty/tasks/${insufficientTaskId}/submit`, {
    method: "POST",
    headers: user1Headers,
    body: JSON.stringify({ link: "https://x.com/user1/status/99999" })
  }));

  await step("User 1 verifies -> Fails automatic approval, task is paused", async () => {
    const res = await request(`/bounty/tasks/${insufficientTaskId}/verify`, { method: "POST", headers: user1Headers });
    if (res.status !== "verifying") throw new Error(`Expected verifying, got ${res.status}`);
    if (!res.feedback.includes("budget_insufficient")) throw new Error(`Expected budget_insufficient feedback, got ${res.feedback}`);

    // Verify task is now paused
    const tasksRes = await request("/bounty/tasks");
    const task = tasksRes.tasks.find(t => t.id === insufficientTaskId);
    if (task.status !== "paused") throw new Error(`Expected task status paused, got ${task.status}`);
    if (task.paused_reason !== "预算积分不足") throw new Error(`Expected paused_reason '预算积分不足', got ${task.paused_reason}`);
  });

  await step("Submit to paused insufficient task is blocked", async () => {
    await request(`/bounty/tasks/${insufficientTaskId}/submit`, {
      method: "POST",
      headers: user2Headers,
      body: JSON.stringify({ link: "https://x.com/user2/status/12345" })
    }, 400);
  });

  console.log("=== All Bounty Task Network V1 tests PASSED successfully! ===");
}

runTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
