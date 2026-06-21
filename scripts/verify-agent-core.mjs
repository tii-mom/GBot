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
    query_id: "verify_core_query_id",
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

const testUserId = Number(`991${Date.now().toString().slice(-9)}`);
const telegramInitData = signTelegramInitData({ id: testUserId, username: `verify_core_${testUserId}` });

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
    console.log(`[CORE] PASS: ${name}`);
    return result;
  } catch (error) {
    console.error(`[CORE] FAIL: ${name} - ${error.message}`);
    process.exit(1);
  }
}

async function run() {
  console.log("=== Starting Agent Core V1 Verification ===");
  
  // 1. Get Me (initial unauthenticated or freshly authenticated state)
  const meBefore = await runStep("Get initial profile status", () => request("/me"));
  if (meBefore.user.hasAgent) {
    throw new Error("New user should not have an agent initially");
  }

  // 2. Claim Agent
  const claimResult = await runStep("Claim free Agent", () => request("/agents/claim", { method: "POST" }));
  if (!claimResult.agent || !claimResult.agent.id) {
    throw new Error("Claim agent should return valid agent details");
  }
  
  // 3. Verify Agent Properties
  await runStep("Verify claimed Agent properties", async () => {
    const meAfter = await request("/me");
    if (!meAfter.user.hasAgent || !meAfter.agent) {
      throw new Error("User profile hasAgent should be true, and agent should be set");
    }
    const agent = meAfter.agent;
    if (agent.level !== 1) {
      throw new Error(`Agent level should be 1, got ${agent.level}`);
    }
    if (agent.status !== "idle") {
      throw new Error(`Agent initial status should be 'idle', got ${agent.status}`);
    }
    if (agent.energy !== agent.maxEnergy) {
      throw new Error(`Agent initial energy should be full, got ${agent.energy}/${agent.maxEnergy}`);
    }
  });

  console.log("[CORE] Agent Core V1 Verification completed successfully.");
}

// Check if running directly or imported
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(err => {
    console.error("Unhandle core verification error:", err);
    process.exit(1);
  });
}

export { run as verifyAgentCore, testUserId, headers };
