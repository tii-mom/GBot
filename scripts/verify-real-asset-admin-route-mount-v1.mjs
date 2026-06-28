import fs from "node:fs";

const failures = [];

function read(path) {
  if (!fs.existsSync(path)) {
    failures.push(`${path} is missing`);
    return "";
  }
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const workerEntry = read("apps/api-worker/src/index.ts");
const realAssetAdmin = read("apps/api-worker/src/v1/real-asset-admin.ts");
const apiContract = read("docs/API_CONTRACT.md");

const requiredEndpoints = [
  "/admin/real-asset/risk-console",
  "/admin/real-asset/review-queue",
  "/admin/real-asset/executor-readiness",
  "/admin/real-asset/tx-status-tracker",
  "/admin/real-asset/rollback-readiness"
];

assert(
  realAssetAdmin.includes("export function registerV1RealAssetAdmin"),
  "real-asset-admin must export registerV1RealAssetAdmin"
);
assert(
  workerEntry.includes('import { registerV1RealAssetAdmin } from "./v1/real-asset-admin";'),
  "Worker entry must import registerV1RealAssetAdmin"
);
assert(
  /registerV1RealAssetAdmin\s*\(\s*app\s*\)/.test(workerEntry),
  "Worker entry must call registerV1RealAssetAdmin(app)"
);
assert(
  realAssetAdmin.includes('const ADMIN_PREFIX = "/admin/real-asset"'),
  "real-asset-admin must use /admin/real-asset prefix"
);

for (const endpoint of requiredEndpoints) {
  const routeSuffix = endpoint.replace("/admin/real-asset", "");
  assert(
    realAssetAdmin.includes("`${ADMIN_PREFIX}" + routeSuffix + "`"),
    `real-asset-admin must define ${endpoint}`
  );
  assert(apiContract.includes(endpoint), `API contract must document ${endpoint}`);
}

assert(
  realAssetAdmin.includes("const auth = await requireAdmin(c)") && realAssetAdmin.includes("if (auth) return auth"),
  "real-asset-admin routes must remain admin-auth gated"
);

if (failures.length > 0) {
  console.error("verify-real-asset-admin-route-mount-v1: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("verify-real-asset-admin-route-mount-v1: PASS");
