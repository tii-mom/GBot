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
    query_id: "verify_store_query_id",
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

const testUserId = Number(`993${Date.now().toString().slice(-9)}`);
const telegramInitData = signTelegramInitData({ id: testUserId, username: `verify_store_${testUserId}` });

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
    console.log(`[STORE] PASS: ${name}`);
    return result;
  } catch (error) {
    console.error(`[STORE] FAIL: ${name} - ${error.message}`);
    process.exit(1);
  }
}

async function run() {
  console.log("=== Starting Box Store V1 Verification ===");

  // 1. Setup user and agent
  await runStep("Register user", () => request("/me"));
  await runStep("Claim free Agent", () => request("/agents/claim", { method: "POST" }));

  // 2. Fetch store boxes catalog
  const catalog = await runStep("Get store boxes catalog", () => request("/store/boxes"));
  const starterProduct = catalog.products.find(p => p.boxType === "starter" || p.code === "starter");
  const alphaProduct = catalog.products.find(p => p.boxType === "fomo" || p.boxType === "alpha" || p.code === "alpha");

  if (!starterProduct) {
    throw new Error("Starter Box product not found in catalog");
  }

  // 3. Try to purchase Starter Box from store (MUST FAIL)
  await runStep("Assert Starter Box cannot be purchased from store catalog", async () => {
    try {
      await request(`/store/boxes/${starterProduct.id}/orders`, {
        method: "POST",
        body: JSON.stringify({ quantity: 1 })
      });
      throw new Error("Starter Box purchase should have been blocked");
    } catch (e) {
      if (!e.message.includes("400") && !e.message.includes("starter_box_not_purchasable")) {
        throw e;
      }
    }
  });

  // 4. Try to purchase paid box with 0 GP (MUST FAIL with insufficient balance)
  if (alphaProduct) {
    await runStep("Assert insufficient GP points error when buying premium box", async () => {
      try {
        await request(`/store/boxes/${alphaProduct.id}/orders`, {
          method: "POST",
          body: JSON.stringify({ quantity: 1 })
        });
        throw new Error("Premium box purchase should have failed due to zero GP balance");
      } catch (e) {
        if (!e.message.includes("400") && !e.message.includes("insufficient_balance") && !e.message.includes("insufficient_funds")) {
          throw e;
        }
      }
    });
  }

  // 5. Verify Starter Box is in user inventory and open it
  const invBefore = await runStep("Get inventory", () => request("/inventory"));
  const boxItem = invBefore.items.find(i => i.type === "box" && i.status === "available");
  if (!boxItem) {
    throw new Error("Starter Box not found in user inventory after claiming agent");
  }

  // 6. Open box
  const openRes = await runStep(`Open box ${boxItem.id}`, () => request(`/boxes/${boxItem.id}/open`, { method: "POST" }));
  if (!openRes.rewards || openRes.rewards.length === 0) {
    throw new Error("Opening box should yield rewards");
  }

  // 7. Try to open the same box again (double open protection, MUST FAIL)
  await runStep("Assert double open protection", async () => {
    try {
      await request(`/boxes/${boxItem.id}/open`, { method: "POST" });
      throw new Error("Double open should be blocked");
    } catch (e) {
      if (!e.message.includes("400") && !e.message.includes("not_found") && !e.message.includes("already_opened") && !e.message.includes("already_used")) {
        throw e;
      }
    }
  });

  console.log("[STORE] Box Store V1 Verification completed successfully.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(err => {
    console.error("Unhandle store verification error:", err);
    process.exit(1);
  });
}

export { run as verifyBoxStore };
