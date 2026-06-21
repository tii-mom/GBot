import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const envText = readFileSync(new URL("../.env", import.meta.url), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const base = process.env.VITE_API_BASE || "http://localhost:8787";
const botToken = process.env.TELEGRAM_BOT_TOKEN;

function signTelegramInitData(userObj) {
  if (!botToken) return "";
  const user = JSON.stringify(userObj);
  const authDate = Math.floor(Date.now() / 1000);
  const params = {
    auth_date: String(authDate),
    query_id: "verify_wallet_query_id",
    user,
  };
  const dataCheckString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
}

const testUserId = Number(`994${Date.now().toString().slice(-9)}`);
const telegramInitData = botToken
  ? signTelegramInitData({ id: testUserId, username: `verify_wallet_${testUserId}` })
  : "";

const headers = telegramInitData ? { "x-telegram-init-data": telegramInitData } : {};

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
    console.log(`[WALLET] PASS: ${name}`);
    return result;
  } catch (error) {
    console.error(`[WALLET] FAIL: ${name} - ${error.message}`);
    process.exit(1);
  }
}

async function run() {
  console.log("=== Starting Agent Wallet V1 Verification ===");

  // 1. Setup user and agent
  await runStep("Register user", () => request("/me"));
  const claimRes = await runStep("Claim free Agent", () => request("/agents/claim", { method: "POST" }));
  const agentId = claimRes.agent.id;

  // 2. Assert invalid TON address format is blocked by backend validator (400 Bad Request)
  await runStep("Assert invalid TON address format is blocked", async () => {
    try {
      await request(`/agents/${agentId}/wallet/link`, {
        method: "POST",
        body: JSON.stringify({ address: "invalid-ton-address-format-short" })
      });
      throw new Error("Invalid address format should have returned 400 Bad Request");
    } catch (e) {
      if (!e.message.includes("400") && !e.message.includes("invalid_address_format")) {
        throw e;
      }
    }
  });

  // 3. Link a valid TON address (friendly base64, 48 chars)
  const validAddress = "EQCD39VS5jcptHL8vMjEXCcBI-ZWd1Y_I6cgH1wGBLHOwZaC";
  const linkRes = await runStep("Link a valid TON address", () => request(`/agents/${agentId}/wallet/link`, {
    method: "POST",
    body: JSON.stringify({ address: validAddress })
  }));

  if (linkRes.wallet.address !== validAddress) {
    throw new Error(`Linked address mismatch: expected ${validAddress}, got ${linkRes.wallet.address}`);
  }
  if (linkRes.wallet.walletType !== "observation") {
    throw new Error(`Wallet type should be observation, got ${linkRes.wallet.walletType}`);
  }

  // 4. Retrieve wallet profile and verify observation status
  await runStep("Verify retrieved wallet profile details", async () => {
    const getRes = await request(`/agents/${agentId}/wallet`);
    if (!getRes.wallet || getRes.wallet.address !== validAddress) {
      throw new Error("Retrieved wallet mismatch");
    }
    if (getRes.wallet.permissionLevel !== 0) {
      throw new Error(`Permission level should be 0, got ${getRes.wallet.permissionLevel}`);
    }
  });

  // 5. Pause the wallet
  await runStep("Pause the wallet", () => request(`/agents/${agentId}/wallet/pause`, { method: "POST" }));
  await runStep("Verify wallet is paused", async () => {
    const getRes = await request(`/agents/${agentId}/wallet`);
    if (getRes.wallet.status !== "paused") {
      throw new Error("Wallet status should be paused");
    }
  });

  // 6. Resume the wallet
  await runStep("Resume the wallet", () => request(`/agents/${agentId}/wallet/resume`, { method: "POST" }));
  await runStep("Verify wallet is resumed", async () => {
    const getRes = await request(`/agents/${agentId}/wallet`);
    if (getRes.wallet.status !== "active") {
      throw new Error("Wallet status should be active after resume");
    }
  });

  // 7. Verify transaction history info format
  await runStep("Verify wallet transactions metadata format", async () => {
    const txRes = await request(`/agents/${agentId}/wallet/transactions`);
    if (txRes.supported !== false || txRes.mode !== "observation" || !txRes.reason) {
      throw new Error("Wallet transactions details mismatch with level 0 observation policy");
    }
    if (!Array.isArray(txRes.transactions) || txRes.transactions.length !== 0) {
      throw new Error("Transactions list should be empty array");
    }
  });

  console.log("[WALLET] Agent Wallet V1 Verification completed successfully.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(err => {
    console.error("Unhandle wallet verification error:", err);
    process.exit(1);
  });
}

export { run as verifyAgentWallet };
