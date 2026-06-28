#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const environment = process.argv[2];
if (!environment || !["staging", "production"].includes(environment)) {
  console.error("Usage: node scripts/assert-cloudflare-deploy-ready.mjs <staging|production>");
  process.exit(2);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(resolve(repoRoot, "apps/api-worker/wrangler.jsonc"), "utf8"));
const workerEntry = readFileSync(resolve(repoRoot, "apps/api-worker/src/index.ts"), "utf8");
const provisioningInventory = readFileSync(resolve(repoRoot, "docs/CLOUDFLARE_PRODUCTION_PROVISIONING_INVENTORY_V1.md"), "utf8");
const launchReport = readFileSync(resolve(repoRoot, "docs/LAUNCH_READINESS_REPORT_2026-06-27.md"), "utf8");
const target = config.env?.[environment];
if (!target) {
  console.error(`Deployment blocked: missing wrangler environment ${environment}.`);
  process.exit(1);
}

const failures = [];
const placeholderUuid = /^0{8}-0{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-0{11}[0-9a-f]$/i;
const placeholderHex = /^0{31}[0-9a-f]$/i;
const placeholderKvNames = new Set(["00000000000000000000000000000001", "00000000000000000000000000000002"]);
const state = target.vars?.RESOURCE_PROVISIONING_STATE;
if (state !== "ready") failures.push(`RESOURCE_PROVISIONING_STATE must be ready, got ${state ?? "missing"}`);
for (const database of target.d1_databases ?? []) {
  if (!database.database_id || placeholderUuid.test(database.database_id)) failures.push(`D1 ${database.binding ?? "unknown"} uses a placeholder ID`);
}
const kvNamespaces = target.kv_namespaces ?? [];
const stagingD1Ids = new Set((config.env?.staging?.d1_databases ?? []).map((entry) => entry?.database_id).filter(Boolean));
const devD1Ids = new Set((config.d1_databases ?? []).map((entry) => entry?.database_id).filter(Boolean));
const stagingKvIds = new Set((config.env?.staging?.kv_namespaces ?? []).map((entry) => entry?.id).filter(Boolean));
const devKvIds = new Set((config.kv_namespaces ?? []).map((entry) => entry?.id).filter(Boolean));
const productionKvConfirmed = provisioningInventory.includes("Production KV status: CONFIRMED") && provisioningInventory.includes("GROWTHBOT_KV_PROD");
const productionD1Confirmed =
  provisioningInventory.includes("Production D1 status: CONFIRMED") &&
  /`?growthbot-staging`? is intentionally confirmed as the production D1 authority/.test(provisioningInventory);
const productionQueueMissing =
  provisioningInventory.includes("Production Queue status: OPEN / MISSING") &&
  provisioningInventory.includes("growthbot-jobs-prod");

async function assertRemoteQueuesExist(queueNames) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken || queueNames.length === 0) return;

  for (const queueName of queueNames) {
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${accountId}/queues`);
    url.searchParams.set("page", "1");
    url.searchParams.append("name", queueName);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      failures.push(`unable to verify remote queue ${queueName} existence`);
      continue;
    }

    const body = await response.json();
    const results = Array.isArray(body?.result) ? body.result : [];
    const found = results.some((entry) => entry?.queue_name === queueName || entry?.queueName === queueName || entry?.name === queueName);
    if (!found) {
      failures.push(`required Cloudflare Queue is missing: ${queueName}`);
    }
  }
}

if (environment === "production") {
  const routePatterns = (target.routes ?? []).map((entry) => entry?.pattern).filter(Boolean);
  if (routePatterns.length !== 1 || routePatterns[0] !== "api.gb8.top") {
    failures.push("production Worker route must be api.gb8.top");
  }
  if (!workerEntry.includes("registerV1RealAssetAdmin(app)")) {
    failures.push("Real Asset Admin routes are not mounted in Worker entry");
  }
  if (kvNamespaces.length === 0) {
    failures.push("GROWTHBOT_KV_PROD is missing or unresolved");
  }
  if (!productionKvConfirmed) {
    failures.push("GROWTHBOT_KV_PROD confirmation is missing from provisioning docs");
  }
  for (const database of target.d1_databases ?? []) {
    const name = database.database_name ?? "";
    const id = database.database_id ?? "";
    if (
      !id ||
      placeholderUuid.test(id) ||
      devD1Ids.has(id) ||
      (!productionD1Confirmed && stagingD1Ids.has(id)) ||
      (!productionD1Confirmed && /(^|[-_])staging($|[-_])/i.test(name)) ||
      (!productionD1Confirmed && !/prod|production/i.test(name))
    ) {
      failures.push("Production D1 target is missing or unresolved");
    }
  }
  if (!productionD1Confirmed) {
    failures.push("Production D1 authority confirmation is missing from provisioning docs");
  }
  if (productionQueueMissing) {
    failures.push("required Cloudflare Queue is missing: growthbot-jobs-prod");
  }
  if (/Recommendation:\s*GO\b/i.test(launchReport)) {
    failures.push("launch report must not claim full GO before deploy and smoke");
  }
  for (const [key, value] of Object.entries(target.vars ?? {})) {
    if (/executor|liveExecution/i.test(key) && String(value).toLowerCase() === "true") {
      failures.push(`${key} must not be enabled for deploy readiness`);
    }
  }
}
for (const namespace of target.kv_namespaces ?? []) {
  if (
    !namespace.id ||
    placeholderHex.test(namespace.id) ||
    placeholderKvNames.has(namespace.id) ||
    stagingKvIds.has(namespace.id) ||
    devKvIds.has(namespace.id)
  ) {
    failures.push(`GROWTHBOT_KV_PROD is missing or unresolved`);
  }
}
if (!(target.routes?.length > 0)) failures.push("an explicit route is required");
await assertRemoteQueuesExist([
  ...new Set([
    ...((target.queues?.producers ?? []).map((entry) => entry?.queue).filter(Boolean)),
    ...((target.queues?.consumers ?? []).map((entry) => entry?.queue).filter(Boolean))
  ])
]);

if (failures.length) {
  for (const failure of failures) console.error(`DEPLOY BLOCKED [${environment}] ${failure}`);
  process.exit(1);
}
console.log(`Deployment preflight passed for ${environment}. This does not replace production approval.`);
