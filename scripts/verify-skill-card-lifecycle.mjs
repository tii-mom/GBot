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
    query_id: "verify_skill_lifecycle_query_id",
    user
  };
  const dataCheckString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
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

const telegramId = Number(`887${Date.now().toString().slice(-9)}`);
const userHeaders = {
  "x-telegram-init-data": signTelegramInitData({ id: telegramId, username: `skill_lifecycle_${telegramId}` })
};

async function run() {
  console.log("=== Starting Skill Card Lifecycle Verification ===");
  console.log(`[INFO] Target API Base URL: ${base}`);

  const login = await step("Admin Login", () => request("/admin/login", {
    method: "POST",
    body: JSON.stringify({ username: adminLoginUser, password: adminToken })
  }));
  const adminHeaders = { "x-admin-token": login.accessToken };

  await step("Initialize User", () => request("/me", { headers: userHeaders }));
  await step("Claim Agent", () => request("/agents/claim", { method: "POST", headers: userHeaders }));

  const taskId = `skill_lifecycle_${Date.now()}`;
  const rewardAssetName = `Lifecycle Alpha Radar ${Date.now()}`;
  await step("Admin creates skill-card bounty", () => request("/admin/bounty/tasks", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      id: taskId,
      title: "Skill Lifecycle Verification Task",
      description: "Internal verification task for skill card lifecycle.",
      category: "qa",
      platform: "twitter",
      targetUrl: "https://x.com/growthbot",
      budgetTotal: 10,
      rewardPoints: 0,
      rewardAssetName,
      verificationRule: "^https?://(www\\.)?x\\.com/\\w+/status/\\d+",
      submissionType: "link",
      riskLevel: "low",
      ownerType: "official",
      ownerName: "GrowthBot",
      maxCompletions: 1
    })
  }));

  await step("User submits valid bounty link", () => request(`/bounty/tasks/${taskId}/submit`, {
    method: "POST",
    headers: userHeaders,
    body: JSON.stringify({ link: `https://x.com/skill_lifecycle/status/${Date.now()}` })
  }));

  await step("User verifies bounty and receives skill card", async () => {
    const res = await request(`/bounty/tasks/${taskId}/verify`, { method: "POST", headers: userHeaders });
    if (res.status !== "approved") throw new Error(`Expected approved, got ${res.status}`);
    return res;
  });

  const mintedCard = await step("Verify rewarded card is available and tradable", async () => {
    const res = await request("/inventory", { headers: userHeaders });
    const card = res.items.find((item) => item.name === rewardAssetName);
    if (!card) throw new Error("Reward skill card not found in inventory");
    if (card.type !== "ability") throw new Error(`Expected ability, got ${card.type}`);
    if (card.status !== "available") throw new Error(`Expected available, got ${card.status}`);
    if (card.transferable !== true) throw new Error("Reward skill card should be transferable before equip");
    if (card.soulbound === true) throw new Error("Reward skill card should not be soulbound");
    return card;
  });

  await step("Equip skill card", async () => {
    const res = await request(`/inventory/${mintedCard.id}/learn`, { method: "POST", headers: userHeaders });
    if (res.item.status !== "active") throw new Error(`Expected active, got ${res.item.status}`);
    if (res.item.transferable !== false) throw new Error("Equipped skill card should not be transferable");
    if (res.item.soulbound === true) throw new Error("Equipping a transferable card must not permanently soulbind it");
  });

  await step("Equipped card cannot be listed", async () => {
    await request("/marketplace/listings", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ inventoryItemId: mintedCard.id, price: "10", currency: "POINT_TEST" })
    }, 400);
  });

  const cooledCard = await step("Unequip skill card into 24h cooldown", async () => {
    const res = await request(`/inventory/${mintedCard.id}/unequip`, { method: "POST", headers: userHeaders });
    if (res.item.status !== "cooling_down") throw new Error(`Expected cooling_down, got ${res.item.status}`);
    if (res.item.transferable !== false) throw new Error("Cooling skill card should not be transferable");
    if (!res.item.cooldownUntil) throw new Error("cooldownUntil is missing");
    const remainingMs = new Date(res.item.cooldownUntil).getTime() - Date.now();
    if (remainingMs < 23 * 60 * 60 * 1000 || remainingMs > 25 * 60 * 60 * 1000) {
      throw new Error(`Cooldown should be about 24h, got ${Math.round(remainingMs / 60000)} minutes`);
    }
    return res.item;
  });

  await step("Cooling card cannot be listed", async () => {
    await request("/marketplace/listings", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ inventoryItemId: cooledCard.id, price: "10", currency: "POINT_TEST" })
    }, 400);
  });

  await step("Inventory exposes cooldown state", async () => {
    const res = await request("/inventory", { headers: userHeaders });
    const card = res.items.find((item) => item.id === cooledCard.id);
    if (!card) throw new Error("Cooling skill card not found");
    if (card.status !== "cooling_down") throw new Error(`Expected cooling_down, got ${card.status}`);
    if (!card.cooldownUntil) throw new Error("cooldownUntil missing from inventory response");
  });

  console.log("=== Skill Card Lifecycle Verification PASSED ===");
}

run().catch(() => {
  console.error("Skill card lifecycle verification failed.");
  process.exit(1);
});
