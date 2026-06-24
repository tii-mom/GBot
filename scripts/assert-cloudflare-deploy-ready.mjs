#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const environment = process.argv[2];
if (!environment || !["staging", "production"].includes(environment)) {
  console.error("Usage: node scripts/assert-cloudflare-deploy-ready.mjs <staging|production>");
  process.exit(2);
}

const config = JSON.parse(readFileSync(resolve("apps/api-worker/wrangler.jsonc"), "utf8"));
const target = config.env?.[environment];
if (!target) {
  console.error(`Deployment blocked: missing wrangler environment ${environment}.`);
  process.exit(1);
}

const failures = [];
const placeholderUuid = /^0{8}-0{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-0{11}[0-9a-f]$/i;
const placeholderHex = /^0{31}[0-9a-f]$/i;
const state = target.vars?.RESOURCE_PROVISIONING_STATE;
if (state !== "ready") failures.push(`RESOURCE_PROVISIONING_STATE must be ready, got ${state ?? "missing"}`);
for (const database of target.d1_databases ?? []) {
  if (!database.database_id || placeholderUuid.test(database.database_id)) failures.push(`D1 ${database.binding ?? "unknown"} uses a placeholder ID`);
}
for (const namespace of target.kv_namespaces ?? []) {
  if (!namespace.id || placeholderHex.test(namespace.id)) failures.push(`KV ${namespace.binding ?? "unknown"} uses a placeholder ID`);
}
if (!(target.routes?.length > 0)) failures.push("an explicit route is required");

if (failures.length) {
  for (const failure of failures) console.error(`DEPLOY BLOCKED [${environment}] ${failure}`);
  process.exit(1);
}
console.log(`Deployment preflight passed for ${environment}. This does not replace production approval.`);
