import { readFileSync } from "node:fs";
import crypto from "node:crypto";

// 1. Load Environment Variables
const envText = readFileSync(new URL("../.env", import.meta.url), "utf8");
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

function signTelegramInitData(userObj) {
  const user = JSON.stringify(userObj);
  const authDate = Math.floor(Date.now() / 1000);
  const params = {
    auth_date: String(authDate),
    query_id: "verify_agent_model_query_id",
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

const testTelegramId = Number(`999${Date.now().toString().slice(-9)}`);
const userInit = signTelegramInitData({ id: testTelegramId, username: `agent_studio_tester_${testTelegramId}` });
const userHeaders = { "x-telegram-init-data": userInit };

async function runTests() {
  console.log("=== Starting Agent Bot Studio V1 Verification ===");
  console.log(`[INFO] Target API Base URL: ${base}`);

  // Step 1: Admin Login
  const login = await step("Admin Login", () => request("/admin/login", {
    method: "POST",
    body: JSON.stringify({ username: adminLoginUser, password: adminToken })
  }));
  const adminHeaders = { "x-admin-token": login.accessToken };

  // Step 2: Initialize User & Claim Agent
  const meBefore = await step("Initialize User", () => request("/me", { headers: userHeaders }));
  const userId = meBefore.user.id;
  await step("Claim Agent", () => request("/agents/claim", { method: "POST", headers: userHeaders }));

  // Step 3: Verify studio is disabled by default & rejects configs
  await step("Verify Studio access denied by default", async () => {
    await request("/agent/model-config", { headers: userHeaders }, 403);
  });

  // Step 4: Admin whitelist the user
  await step("Verify whitelisting non-existent user returns 404", async () => {
    await request("/admin/users/non_existent_user_id_123456/studio", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ enabled: true })
    }, 404);
  });

  await step("Admin enable studio whitelist for user", () => request(`/admin/users/${userId}/studio`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ enabled: true })
  }));

  const meAfter = await step("Verify user now has studioEnabled: true", async () => {
    const res = await request("/me", { headers: userHeaders });
    if (res.user.studioEnabled !== true) {
      throw new Error(`Expected studioEnabled to be true, got ${res.user.studioEnabled}`);
    }
    return res;
  });

  // Step 5: Test Base URL validation & allowlist
  await step("Verify non-https Base URL rejected", async () => {
    await request("/agent/model-config", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        profileName: "My Custom Agent",
        provider: "OpenAI",
        baseUrl: "http://api.openai.com",
        modelId: "gpt-4o"
      })
    }, 400);
  });

  await step("Verify SSRF loopback Base URL rejected", async () => {
    await request("/agent/model-config", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        profileName: "My Custom Agent",
        provider: "OpenAI",
        baseUrl: "https://127.0.0.1",
        modelId: "gpt-4o"
      })
    }, 400);
  });

  await step("Verify non-allowlist host rejected", async () => {
    await request("/agent/model-config", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        profileName: "My Custom Agent",
        provider: "EvilProvider",
        baseUrl: "https://evil.domain.com",
        modelId: "evil-model"
      })
    }, 400);
  });

  // Step 6: Test dynamic allowlist update by admin
  await step("Verify Admin provider SSRF base URL validation", async () => {
    const badUrls = [
      "http://localhost",
      "https://localhost",
      "https://127.0.0.1",
      "https://192.168.1.1",
      "https://169.254.169.254",
      "https://[2001:db8::1]"
    ];
    for (const badUrl of badUrls) {
      await request("/admin/agent/providers", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          name: `Bad Provider ${badUrl}`,
          baseUrl: badUrl,
          status: "active"
        })
      }, 400);
    }
  });

  await step("Admin add custom provider to allowlist", () => request("/admin/agent/providers", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Custom Testing Provider",
      baseUrl: "https://custom-testing-llm.com",
      status: "active"
    })
  }));

  // Step 7: Test secret key requirements (missing secret rejects saving)
  await step("Verify saving API key with missing secret is rejected", async () => {
    await request("/agent/model-config", {
      method: "POST",
      headers: { ...userHeaders, "x-test-no-secret": "true" },
      body: JSON.stringify({
        profileName: "My Custom Agent",
        provider: "Custom Testing Provider",
        baseUrl: "https://custom-testing-llm.com",
        modelId: "custom-model-1",
        apiKey: "sk-abcdef123456789"
      })
    }, 500);
  });

  // Step 8: Save successfully with secret and verify key does not echo
  const saveRes = await step("Save custom model config successfully", () => request("/agent/model-config", {
    method: "POST",
    headers: userHeaders,
    body: JSON.stringify({
      profileName: "My Custom Agent",
      provider: "Custom Testing Provider",
      baseUrl: "https://custom-testing-llm.com",
      modelId: "custom-model-1",
      apiKey: "sk-abcdef123456789",
      isDefault: true
    })
  }));
  const configId = saveRes.id;

  const getRes = await step("Verify key Last4 is returned and plaintext API Key is hidden", async () => {
    const res = await request("/agent/model-config", { headers: userHeaders });
    if (!res.config) throw new Error("Config not found.");
    if (res.config.keyLast4 !== "6789") throw new Error(`Expected keyLast4 to be '6789', got ${res.config.keyLast4}`);
    if (res.config.encryptedApiKey !== undefined && res.config.encryptedApiKey !== null) {
      throw new Error("encryptedApiKey should not be returned to client.");
    }
    return res;
  });

  // Step 9: Call AI Guide and verify economic isolation (points/status unchanged)
  // Get active tasks to find one
  const tasksRes = await request("/tasks/available", { headers: userHeaders });
  const task = tasksRes.tasks[0];
  if (!task) throw new Error("No available tasks to run test.");

  const pointsBefore = meAfter.agent ? meAfter.agent.pendingPoints : 0;
  
  const guideRes = await step("Call AI Guide and verify structured response", async () => {
    const res = await request(`/agent/tasks/${task.id}/ai-guide`, {
      method: "POST",
      headers: userHeaders
    });
    if (!res.summary || !Array.isArray(res.steps) || !res.submissionHint || !res.riskLevel) {
      throw new Error(`Invalid AI Guide structure: ${JSON.stringify(res)}`);
    }
    return res;
  });

  await step("Verify AI Guide call did not affect points", async () => {
    const res = await request("/me", { headers: userHeaders });
    const pointsAfter = res.agent ? res.agent.pendingPoints : 0;
    if (pointsBefore !== pointsAfter) {
      throw new Error(`Points changed from ${pointsBefore} to ${pointsAfter}`);
    }
  });

  // Step 10: Test configuration disabled block / fallback
  await step("Admin disable config", () => request(`/admin/agent/model-configs/${configId}/disable`, {
    method: "POST",
    headers: adminHeaders
  }));

  await step("Verify fallback works when config is disabled", async () => {
    // Calling guide should still succeed by falling back to static template/platform agent
    const res = await request(`/agent/tasks/${task.id}/ai-guide`, {
      method: "POST",
      headers: userHeaders
    });
    if (!res.summary || !Array.isArray(res.steps) || res.riskLevel !== "low") {
      throw new Error(`Expected valid fallback response, got: ${JSON.stringify(res)}`);
    }
  });

  // Step 11: Admin call logs desensitization check
  await step("Verify call logs in Admin console and ensure no API key or prompt leaks", async () => {
    const res = await request("/admin/agent/model-call-logs", { headers: adminHeaders });
    if (!res.logs || res.logs.length === 0) {
      throw new Error("No call logs found in admin console.");
    }
    const log = res.logs[0];
    const logStr = JSON.stringify(log);
    if (logStr.includes("sk-abcdef") || logStr.includes("sk-1234")) {
      throw new Error("Sensitive API Key leaked in admin call logs.");
    }
    console.log(`[INFO] Masked Log Input Summary: ${log.input_summary}`);
    console.log(`[INFO] Masked Log Output Summary: ${log.output_summary}`);
  });

  // Step 12: Delete config and verify key cleared
  await step("Delete custom model config", () => request("/agent/model-config", {
    method: "DELETE",
    headers: userHeaders
  }));

  await step("Verify config is null after deletion", async () => {
    const res = await request("/agent/model-config", { headers: userHeaders });
    if (res.config !== null) {
      throw new Error(`Expected config to be null after deletion, got ${JSON.stringify(res.config)}`);
    }
  });

  console.log("=== Agent Bot Studio V1 Verification Completed Successfully! ===");
}

runTests().catch((err) => {
  console.error("Verification failed", err);
  process.exit(1);
});
