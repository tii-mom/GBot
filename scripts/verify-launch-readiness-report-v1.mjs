import fs from "node:fs";

const failures = [];
const reportPath = process.argv[2] || process.env.LAUNCH_READINESS_REPORT || latestReportPath() || "docs/LAUNCH_READINESS_REPORT_2026-06-27.md";

function latestReportPath() {
  const docsDir = "docs";
  if (!fs.existsSync(docsDir)) return null;
  const reports = fs.readdirSync(docsDir)
    .filter((name) => /^LAUNCH_READINESS_REPORT_\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .sort();
  const latest = reports.at(-1);
  return latest ? `${docsDir}/${latest}` : null;
}

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

const report = read(reportPath);
const lower = report.toLowerCase();

assert(Boolean(report), `${reportPath} must exist`);

for (const phrase of [
  "go / no-go",
  "production d1 apply status",
  "api smoke result",
  "mini app smoke result",
  "admin smoke result",
  "telegram smoke result",
  "safety boundary confirmation",
  "known blockers",
  "required next actions"
]) {
  assert(lower.includes(phrase), `report must include ${phrase}`);
}

const goNoGoSection = report.match(/##\s+11\.\s+Go \/ No-Go Recommendation[\s\S]*?(?=\n##\s+\d+\.|\s*$)/i)?.[0] || "";
assert(/recommendation:\s*no-go/i.test(goNoGoSection), "Go / No-Go section must include a NO-GO recommendation");
assert(/production d1 apply status:\s*(not_applied|blocked|not_applied \/ blocked)/i.test(report), "report must include D1 apply status");

for (const forbidden of [
  "executorenabled: true",
  "testnetexecutorenabled: true",
  "liveexecutorenabled: true",
  "private_key",
  "seed_phrase"
]) {
  assert(!lower.includes(forbidden), `report must not include forbidden phrase: ${forbidden}`);
}

for (const line of report.split(/\r?\n/)) {
  const normalized = line.trim().toLowerCase();
  const unsafeMarketing = [
    "guaranteed profit",
    "guaranteed yield",
    "guaranteed airdrop",
    "risk-free",
    "fixed returns"
  ].some((phrase) => normalized.includes(phrase));
  const safetyContext = normalized.startsWith("- no ")
    || normalized.includes("no `")
    || normalized.includes("not found")
    || normalized.includes("unsafe copy scan")
    || normalized.includes("no claim");
  assert(!unsafeMarketing || safetyContext, `unsafe marketing phrase outside safety context: ${line}`);
}

if (failures.length > 0) {
  console.error("verify-launch-readiness-report-v1: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("verify-launch-readiness-report-v1: PASS");
