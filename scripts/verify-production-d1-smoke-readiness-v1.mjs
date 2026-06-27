import fs from "node:fs";
import crypto from "node:crypto";

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function read(file) {
  if (!fs.existsSync(file)) {
    failures.push(`${file} is missing`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function hash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term.toLowerCase()));
}

const productionPlanPath = "docs/PRODUCTION_D1_MIGRATION_APPLY_PLAN_V1.md";
const smokePath = "docs/ONLINE_SMOKE_TEST_V1.md";
const reportPath = "docs/LAUNCH_READINESS_REPORT_TEMPLATE_V1.md";
const rootMigrationPath = "migrations/0017_real_asset_agent_persistence_v1.sql";
const workerMigrationPath = "apps/api-worker/migrations/0017_real_asset_agent_persistence_v1.sql";

const productionPlan = read(productionPlanPath);
const smoke = read(smokePath);
const report = read(reportPath);
const packageJson = read("package.json");
const rootMigration = read(rootMigrationPath);
const workerMigration = read(workerMigrationPath);

const docsJoined = [
  productionPlan,
  smoke,
  report,
  read("docs/GO_LIVE_CHECKLIST.md"),
  read("docs/OPS_SUPPORT_RUNBOOK.md"),
  read("docs/API_CONTRACT.md"),
  read("docs/DATABASE_SCHEMA.md"),
  read("docs/REAL_ASSET_DB_PERSISTENCE_PLAN_V1.md")
].join("\n").toLowerCase();

assert(Boolean(productionPlan), `${productionPlanPath} must exist`);
assert(Boolean(smoke), `${smokePath} must exist`);
assert(Boolean(report), `${reportPath} must exist`);

for (const section of [
  "purpose",
  "scope",
  "non-goals",
  "preconditions",
  "migration files included",
  "root migration sync check",
  "cloudflare d1 target confirmation",
  "backup / export requirement",
  "dry-run / local apply requirement",
  "production apply manual approval step",
  "post-apply verification",
  "rollback / mitigation plan",
  "stop conditions",
  "responsible operator checklist",
  "evidence collection checklist"
]) {
  assert(productionPlan.toLowerCase().includes(section), `production plan must include section: ${section}`);
}

assert(smoke.toLowerCase().includes("execution record template"), "online smoke doc must include execution record template");
assert(smoke.toLowerCase().includes("online smoke execution order"), "online smoke doc must include online smoke execution order");

for (const phrase of [
  "this pr does not execute production migration apply",
  "manual approval",
  "backup/export",
  "online smoke after apply",
  "post-apply",
  "executorenabled: false",
  "testnetexecutorenabled: false",
  "liveexecutorenabled: false",
  "liveexecution: false",
  "no signing",
  "no broadcasting",
  "no private keys",
  "seed phrases",
  "mnemonics",
  "no custody",
  "main wallet control"
]) {
  assert(docsJoined.includes(phrase), `docs must mention ${phrase}`);
}

assert(
  includesAny(docsJoined, ["post-apply smoke test", "run online smoke after apply", "online smoke after apply"]),
  "docs must mention post-apply smoke test"
);

for (const surface of ["mini app", "admin", "api", "telegram bot"]) {
  assert(docsJoined.includes(surface), `docs must mention ${surface} smoke`);
}

for (const reportSection of [
  "release candidate commit",
  "production environment",
  "migration status",
  "smoke test result summary",
  "admin readiness summary",
  "mini app readiness summary",
  "api readiness summary",
  "telegram readiness summary",
  "safety boundary confirmation",
  "known blockers",
  "go / no-go recommendation",
  "operator signatures / approval notes"
]) {
  assert(report.toLowerCase().includes(reportSection), `launch readiness report must include ${reportSection}`);
}

assert(fs.existsSync(rootMigrationPath), `${rootMigrationPath} must exist`);
assert(fs.existsSync(workerMigrationPath), `${workerMigrationPath} must exist`);
assert(rootMigration === workerMigration, `0017 migration hashes must match (${hash(rootMigration)} != ${hash(workerMigration)})`);

assert(
  packageJson.includes('"verify:production-d1-smoke-readiness-v1"'),
  "package.json must include verify:production-d1-smoke-readiness-v1"
);

for (const forbidden of [
  "wrangler d1 migrations apply growthbot-staging --remote --env production",
  "wrangler d1 migrations apply growthbot-prod --remote",
  "deploy:api:prod"
]) {
  assert(!productionPlan.toLowerCase().includes(forbidden.toLowerCase()), `production plan must not include executable apply/deploy command: ${forbidden}`);
}

if (failures.length > 0) {
  console.error("verify-production-d1-smoke-readiness-v1: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("verify-production-d1-smoke-readiness-v1: PASS");
console.log(`0017 migration sha256: ${hash(rootMigration)}`);
