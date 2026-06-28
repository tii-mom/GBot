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
  for (const database of target.d1_databases ?? []) {
    const name = database.database_name ?? "";
    const id = database.database_id ?? "";
    if (
      !id ||
      placeholderUuid.test(id) ||
      stagingD1Ids.has(id) ||
      devD1Ids.has(id) ||
      /(^|[-_])dev($|[-_])|(^|[-_])staging($|[-_])/i.test(name) ||
      !/prod|production/i.test(name)
    ) {
      failures.push("Production D1 target is missing or unresolved");
    }
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

if (failures.length) {
  for (const failure of failures) console.error(`DEPLOY BLOCKED [${environment}] ${failure}`);
  process.exit(1);
}
console.log(`Deployment preflight passed for ${environment}. This does not replace production approval.`);
