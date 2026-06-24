#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const configPath = resolve("apps/api-worker/wrangler.jsonc");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const { staging, production } = config.env ?? {};
const failures = [];
const check = (condition, message) => condition ? console.log(`PASS ${message}`) : failures.push(message);
const only = (env, key) => env[key]?.[0];
const queue = (env) => env.queues?.producers?.[0]?.queue;
const consumer = (env) => env.queues?.consumers?.[0]?.queue;

check(Boolean(staging && production), "staging and production environments exist");
check(staging?.name === "growthbot-api-staging", "staging Worker name is fixed");
check(production?.name === "growthbot-api-prod", "production Worker name is fixed");
check(staging?.routes?.[0]?.pattern === "staging-api.gb8.top", "staging API route is isolated");
check(production?.routes?.[0]?.pattern === "api.gb8.top", "production exclusively owns api.gb8.top");
check(only(production, "d1_databases")?.database_id === "e33c3b88-0874-4316-ba6e-793f040f3edb", "production retains factual D1 authority");
check(only(staging, "d1_databases")?.database_id !== only(production, "d1_databases")?.database_id, "D1 IDs are unique");
check(only(staging, "kv_namespaces")?.id !== only(production, "kv_namespaces")?.id, "KV IDs are unique");
check(queue(staging) === consumer(staging), "staging producer and consumer use the same queue");
check(queue(production) === consumer(production), "production producer and consumer use the same queue");
check(queue(staging) !== queue(production), "Queue names are unique");
check(only(staging, "r2_buckets")?.bucket_name !== only(production, "r2_buckets")?.bucket_name, "R2 bucket names are unique");
check(staging?.vars?.EXPECTED_API_BASE === "https://staging-api.gb8.top", "staging API base is fail-closed");
check(production?.vars?.EXPECTED_API_BASE === "https://api.gb8.top", "production API base is fail-closed");
check(staging?.vars?.APP_ENV === "staging" && production?.vars?.APP_ENV === "production", "APP_ENV values are explicit");
check(staging?.vars?.RESOURCE_PROVISIONING_STATE === "placeholder", "staging resources remain non-deployable placeholders");
check(production?.vars?.RESOURCE_PROVISIONING_STATE === "placeholder", "production dedicated resources remain non-deployable placeholders");

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log("Cloudflare environment isolation configuration verified. Deployment remains blocked until placeholder resources are replaced and separately approved.");
