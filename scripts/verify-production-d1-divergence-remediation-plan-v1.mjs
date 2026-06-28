import fs from "node:fs";

const docPath = process.argv[2] || "docs/PRODUCTION_D1_DIVERGENCE_REMEDIATION_PLAN_2026-06-28.md";
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

const text = read(docPath);
const lower = text.toLowerCase();

assert(Boolean(text), `${docPath} must exist`);

for (const phrase of [
  "current status",
  "remote d1 inventory summary",
  "migration-by-migration status table",
  "divergence explanation",
  "option a",
  "option b",
  "option c",
  "recommended option",
  "why direct apply is unsafe",
  "exact command drafts",
  "approval checklist",
  "rollback plan",
  "post-remediation smoke plan",
  "final recommendation"
]) {
  assert(lower.includes(phrase), `document must include: ${phrase}`);
}

assert(/final recommendation:\s*`?(ready_for_separate_approval|blocked)`?/i.test(text), "final recommendation must be READY_FOR_SEPARATE_APPROVAL or BLOCKED");
assert(lower.includes("no production d1 apply was executed"), "document must clearly state that production D1 apply was not executed");
assert(lower.includes("no remote d1 writes were executed"), "document must clearly state that remote D1 writes were not executed");
assert(lower.includes("no production deploy was executed"), "document must clearly state that no deploy was executed");
assert(lower.includes("direct apply is unsafe") || lower.includes("direct production migration apply remains `blocked`"), "document must say direct apply is unsafe");
assert(lower.includes("backup / export commands"), "document must include a backup plan");
assert(lower.includes("rollback plan"), "document must include a rollback plan");
assert(lower.includes("post-remediation smoke plan"), "document must include a post-remediation smoke plan");

for (const forbidden of [
  "-----begin",
  "private_key",
  "private key:",
  "seed phrase:",
  "mnemonic:",
  "api_token="
]) {
  assert(!lower.includes(forbidden), `document must not contain secret-like material: ${forbidden}`);
}

if (failures.length > 0) {
  console.error("verify-production-d1-divergence-remediation-plan-v1: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("verify-production-d1-divergence-remediation-plan-v1: PASS");
