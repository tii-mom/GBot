#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const config = JSON.parse(readFileSync(resolve("apps/api-worker/wrangler.jsonc"), "utf8"));
const workerPackage = JSON.parse(readFileSync(resolve("apps/api-worker/package.json"), "utf8"));
const { staging, production } = config.env ?? {};
const failures = [];
const check = (condition, message) => condition ? console.log(`PASS ${message}`) : failures.push(message);
const values = (env, key, field) => (env?.[key] ?? []).map((entry) => entry?.[field]).filter(Boolean);
const queueValues = (env) => [
  ...(env?.queues?.producers ?? []).map((entry) => entry?.queue),
  ...(env?.queues?.consumers ?? []).map((entry) => entry?.queue),
].filter(Boolean);
const routeValues = (env) => (env?.routes ?? []).map((entry) => entry?.pattern).filter(Boolean);
const disjoint = (left, right) => left.every((value) => !right.includes(value));
const unique = (items) => new Set(items).size === items.length;
const sensitiveName = /(secret|token|password|api[_-]?key|private[_-]?key|ciphertext)/i;

check(Boolean(staging && production), "staging and production environments exist");
check(staging?.name === "growthbot-api-staging", "staging Worker name is fixed");
check(production?.name === "growthbot-api-prod", "production Worker name is fixed");
check(routeValues(staging).length === 1 && routeValues(staging)[0] === "staging-api.gb8.top", "staging exclusively owns staging-api.gb8.top");
check(routeValues(production).length === 1 && routeValues(production)[0] === "api.gb8.top", "production exclusively owns api.gb8.top");
check(disjoint(routeValues(staging), routeValues(production)), "route patterns are unique across environments");

const stagingD1 = values(staging, "d1_databases", "database_id");
const productionD1 = values(production, "d1_databases", "database_id");
const stagingKv = values(staging, "kv_namespaces", "id");
const productionKv = values(production, "kv_namespaces", "id");
const stagingR2 = values(staging, "r2_buckets", "bucket_name");
const productionR2 = values(production, "r2_buckets", "bucket_name");
const stagingQueues = queueValues(staging);
const productionQueues = queueValues(production);

check(productionD1.includes("e33c3b88-0874-4316-ba6e-793f040f3edb"), "production retains factual D1 authority");
check(unique(stagingD1) && unique(productionD1) && disjoint(stagingD1, productionD1), "all D1 bindings are unique across environments");
check(unique(stagingKv) && unique(productionKv) && disjoint(stagingKv, productionKv), "all KV bindings are unique across environments");
check(unique(stagingR2) && unique(productionR2) && disjoint(stagingR2, productionR2), "all R2 bindings are unique across environments");
check(disjoint(stagingQueues, productionQueues), "all Queue bindings are unique across environments");
check(new Set(stagingQueues).size === 1, "staging producer and consumer use the same queue");
check(new Set(productionQueues).size === 1, "production producer and consumer use the same queue");

check(staging?.vars?.MINIAPP_ORIGIN === "https://staging-app.gb8.top", "staging Mini App origin is isolated");
check(staging?.vars?.ADMIN_ORIGIN === "https://staging-admin.gb8.top", "staging Admin origin is isolated");
check(production?.vars?.MINIAPP_ORIGIN === "https://app.gb8.top", "production Mini App origin is fixed");
check(production?.vars?.ADMIN_ORIGIN === "https://1989.gb8.top", "production Admin origin is fixed");
check(staging?.vars?.EXPECTED_API_BASE === "https://staging-api.gb8.top", "staging API base is explicit");
check(production?.vars?.EXPECTED_API_BASE === "https://api.gb8.top", "production API base is explicit");
check(staging?.vars?.APP_ENV === "staging" && production?.vars?.APP_ENV === "production", "APP_ENV values are explicit");
check(staging?.vars?.RESOURCE_PROVISIONING_STATE === "placeholder", "staging placeholder state is explicit");
check(production?.vars?.RESOURCE_PROVISIONING_STATE === "placeholder", "production placeholder state is explicit");
check(!Object.keys(staging?.vars ?? {}).some((key) => sensitiveName.test(key)), "staging vars contain no sensitive-looking keys");
check(!Object.keys(production?.vars ?? {}).some((key) => sensitiveName.test(key)), "production vars contain no sensitive-looking keys");

check(workerPackage.scripts?.["deploy:staging"] === "wrangler deploy --env staging", "staging deploy requires explicit environment");
check(workerPackage.scripts?.["deploy:prod"] === "wrangler deploy --env production", "production deploy requires explicit environment");
check(workerPackage.scripts?.["predeploy:staging"]?.includes("assert-cloudflare-deploy-ready.mjs staging"), "staging deploy has a fail-closed predeploy guard");
check(workerPackage.scripts?.["predeploy:prod"]?.includes("assert-cloudflare-deploy-ready.mjs production"), "production deploy has a fail-closed predeploy guard");
check(!Object.values(workerPackage.scripts ?? {}).some((command) => command === "wrangler deploy"), "no generic Worker deploy script exists");

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log("Cloudflare environment isolation configuration verified. Deployment remains blocked until placeholders are replaced, state is ready, and change approval is granted.");
