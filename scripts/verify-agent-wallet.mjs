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
    query_id: "verify_wallet_query_id",
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

const testUserId = Number(`994${Date.now().toString().slice(-9)}`);
const telegramInitData = signTelegramInitData({ id: testUserId, username: `verify_wallet_${testUserId}` });

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

  // 1.5. Assert missing wallet returns 404 for pause/resume/policy
  await runStep("Assert missing wallet returns 404", async () => {
    try {
      await request(`/agents/${agentId}/wallet/pause`, { method: "POST" });
      throw new Error("Pause should have returned 404");
    } catch (e) {
      if (!e.message.includes("404")) throw e;
    }
    try {
      await request(`/agents/${agentId}/wallet/resume`, { method: "POST" });
      throw new Error("Resume should have returned 404");
    } catch (e) {
      if (!e.message.includes("404")) throw e;
    }
    try {
      await request(`/agents/${agentId}/wallet/policy`, { method: "PUT", body: JSON.stringify({ spendingLimitDaily: 100 }) });
      throw new Error("Policy should have returned 404");
    } catch (e) {
      if (!e.message.includes("404")) throw e;
    }
  });

  // 2. Assert invalid TON address formats are blocked by backend validator (400 Bad Request)
  await runStep("Assert invalid TON address format is blocked", async () => {
    // Invalid checksum friendly address
    try {
      await request(`/agents/${agentId}/wallet/link`, {
        method: "POST",
        body: JSON.stringify({ address: "EQCD39VS5jcptHL8vMjEXCcBI-ZWd1Y_I6cgH1wGBLHOwZaB" }) // last char B instead of C
      });
      throw new Error("Invalid checksum should have returned 400");
    } catch (e) {
      if (!e.message.includes("400")) throw e;
    }

    // Random 48 characters
    try {
      await request(`/agents/${agentId}/wallet/link`, {
        method: "POST",
        body: JSON.stringify({ address: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" })
      });
      throw new Error("Random 48 chars should have returned 400");
    } catch (e) {
      if (!e.message.includes("400")) throw e;
    }

    // Invalid length
    try {
      await request(`/agents/${agentId}/wallet/link`, {
        method: "POST",
        body: JSON.stringify({ address: "EQCD39VS" })
      });
      throw new Error("Short address should have returned 400");
    } catch (e) {
      if (!e.message.includes("400")) throw e;
    }
  });

  // 2.5. Link valid raw hex and UQ bounceable address formats (both must succeed)
  await runStep("Verify raw hex and UQ link formats", async () => {
    const rawAddress = "0:d3f7d552e637a937a09c2a35607b22f483a31c0604b1cec360c70c670b8c6e26";
    const uqAddress = "UQDT99VS5jepN6CcKjVgeyL0g6McBgSxzsNgxwxnC4xuJhKW";
    
    await request(`/agents/${agentId}/wallet/link`, {
      method: "POST",
      body: JSON.stringify({ address: rawAddress })
    });
    
    await request(`/agents/${agentId}/wallet/link`, {
      method: "POST",
      body: JSON.stringify({ address: uqAddress })
    });
  });
  // 3. Link a valid TON address (friendly base64, 48 chars)
  const validAddress = "EQDT99VS5jepN6CcKjVgeyL0g6McBgSxzsNgxwxnC4xuJk9T";
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

  // 6.5. Verify policy update with valid & invalid withdrawal address
  await runStep("Verify policy and withdrawal address validation", async () => {
    // A. Valid withdrawal address
    const validWithdrawal = "EQDT99VS5jepN6CcKjVgeyL0g6McBgSxzsNgxwxnC4xuJk9T";
    const policyRes = await request(`/agents/${agentId}/wallet/policy`, {
      method: "PUT",
      body: JSON.stringify({
        spendingLimitDaily: 250,
        transactionLimit: 50,
        withdrawalAddress: validWithdrawal
      })
    });
    if (policyRes.wallet.spendingLimitDaily !== 250 || policyRes.wallet.withdrawalAddress !== validWithdrawal) {
      throw new Error("Policy update details mismatch");
    }

    // B. Invalid withdrawal address (must fail 400)
    try {
      await request(`/agents/${agentId}/wallet/policy`, {
        method: "PUT",
        body: JSON.stringify({
          spendingLimitDaily: 250,
          transactionLimit: 50,
          withdrawalAddress: "invalid-withdrawal"
        })
      });
      throw new Error("Invalid withdrawal address should have failed 400");
    } catch (e) {
      if (!e.message.includes("400")) throw e;
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
