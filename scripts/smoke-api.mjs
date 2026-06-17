import { readFileSync } from "node:fs";

const envText = readFileSync(new URL("../.env", import.meta.url), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const base = process.env.VITE_API_BASE || "https://api.gb8.top";
const adminToken = process.env.ADMIN_TOKEN;
const adminLoginUser = process.env.ADMIN_LOGIN_USER || "yudeyou0118";

async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text.slice(0, 300);
  }
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function requestWithRetry(path, options = {}, retries = 3) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await request(path, options);
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function step(name, fn) {
  try {
    const result = await fn();
    console.log(`PASS ${name}`);
    return result;
  } catch (error) {
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return null;
  }
}

const health = await step("health", () => requestWithRetry("/health", {}, 2));
const meBefore = await step("me before claim", () => requestWithRetry("/me", {}, 1));
const claim = await step("claim agent", () => requestWithRetry("/agents/claim", { method: "POST" }, 1));
const inventory = await step("inventory", () => requestWithRetry("/inventory", {}, 1));

const starterBox = inventory?.items?.find((item) => item.type === "box" && item.status === "available");
const opened = starterBox
  ? await step("open starter box", () => requestWithRetry(`/boxes/${starterBox.id}/open`, { method: "POST" }, 1))
  : (console.log("SKIP open starter box: no available Starter Box for existing smoke user."), null);

const tasks = await step("available tasks", () => requestWithRetry("/tasks/available", {}, 1));
const firstTask = tasks?.tasks?.find((task) => !task.requiresWallet && !task.requiredAbility);
await step("farm task", async () => {
  const me = await requestWithRetry("/me", {}, 1);
  if (!me.agent?.id) throw new Error("No agent available after claim.");
  if (!firstTask?.id) throw new Error("No runnable task available.");
  if (Number(me.agent.energy || 0) < Number(firstTask.energyCost || 0)) {
    console.log(`SKIP farm task: smoke user energy ${me.agent.energy}/${firstTask.energyCost}.`);
    return { skipped: true };
  }
  return requestWithRetry(`/agents/${me.agent.id}/farm`, {
    method: "POST",
    body: JSON.stringify({ taskIds: [firstTask.id], abilityItemIds: [] })
  }, 1);
});

await step("leaderboard", () => requestWithRetry("/leaderboard", {}, 1));
const fomo = await step("fomo snapshot", () => requestWithRetry("/fomo/snapshot", {}, 1));
await step("marketplace listings", () => requestWithRetry("/marketplace/listings", {}, 1));

if (adminToken) {
  const adminLogin = await step("admin login", () => requestWithRetry("/admin/login", {
    method: "POST",
    body: JSON.stringify({ username: adminLoginUser, password: adminToken })
  }, 1));
  const sessionToken = adminLogin?.accessToken;
  if (sessionToken) {
    await step("admin metrics", () => requestWithRetry("/admin/metrics", { headers: { "x-admin-token": sessionToken } }, 1));
    await step("admin users", () => requestWithRetry("/admin/users", { headers: { "x-admin-token": sessionToken } }, 1));
    await step("admin tasks", () => requestWithRetry("/admin/tasks", { headers: { "x-admin-token": sessionToken } }, 1));
    await step("admin audit logs", () => requestWithRetry("/admin/audit-logs", { headers: { "x-admin-token": sessionToken } }, 1));
  }
} else {
  console.log("SKIP admin checks: ADMIN_TOKEN missing.");
}

if (process.exitCode) {
  console.error("GrowthBot API smoke test failed.");
} else {
  console.log(JSON.stringify({
    ok: true,
    base,
    env: health?.env,
    user: meBefore?.user?.username,
    openedRewards: opened?.rewards?.length ?? 0,
    fomoBoxesRemaining: fomo?.boxesRemaining?.fomo
  }, null, 2));
}
