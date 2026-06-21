import { readFileSync } from "node:fs";

let envText = "";
try {
  envText = readFileSync(new URL("../.env", import.meta.url), "utf8");
} catch (_) {}
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const base = process.env.VITE_API_BASE || "https://api.gb8.top";
const adminToken = process.env.ADMIN_TOKEN;
const adminLoginUser = process.env.ADMIN_LOGIN_USER || "yudeyou0118";

if (!adminToken) throw new Error("ADMIN_TOKEN is missing.");

async function request(path, options = {}, expectedStatus = 200) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (response.status !== expectedStatus) {
    throw new Error(`${path} returned ${response.status}, expected ${expectedStatus}: ${JSON.stringify(body)}`);
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
    return null;
  }
}

await step("raw ADMIN_TOKEN cannot access admin metrics", () => request("/admin/metrics", {
  headers: { "x-admin-token": adminToken }
}, 401));

const login = await step("admin login returns session", () => request("/admin/login", {
  method: "POST",
  body: JSON.stringify({ username: adminLoginUser, password: adminToken })
}));
const session = login?.accessToken;
if (!session) throw new Error("Admin login did not return accessToken.");
const adminHeaders = { "x-admin-token": session };

await step("session can read metrics", () => request("/admin/metrics", { headers: adminHeaders }));
await step("session can read audit logs", () => request("/admin/audit-logs", { headers: adminHeaders }));

const marker = `验收任务 ${Date.now()}`;
const createdTasks = await step("create task writes D1", () => request("/admin/tasks", {
  method: "POST",
  headers: adminHeaders,
  body: JSON.stringify({ name: marker, energyCost: 1, basePendingPoints: 1 })
}));
const task = createdTasks?.tasks?.find((item) => item.name === marker);
if (!task) throw new Error("Created task was not returned after write.");

const pausedTasks = await step("pause task reads back", () => request(`/admin/tasks/${task.id}/status`, {
  method: "POST",
  headers: adminHeaders,
  body: JSON.stringify({ status: "paused" })
}));
if (!pausedTasks?.tasks?.some((item) => item.id === task.id && item.status === "paused")) {
  throw new Error("Paused task status was not readable after write.");
}

await step("restore task reads back", () => request(`/admin/tasks/${task.id}/status`, {
  method: "POST",
  headers: adminHeaders,
  body: JSON.stringify({ status: "active" })
}));

const audits = await step("audit contains task mutation", () => request("/admin/audit-logs", { headers: adminHeaders }));
if (!audits?.auditLogs?.some((log) => String(log.targetObject || "").includes(task.id))) {
  throw new Error("Audit logs did not include the test task mutation.");
}

if (process.exitCode) {
  console.error("GrowthBot admin API verification failed.");
} else {
  console.log(JSON.stringify({ ok: true, base, createdTaskId: task.id }, null, 2));
}
