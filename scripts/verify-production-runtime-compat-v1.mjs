import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    failures.push(`${rel} is missing`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const skill = read("apps/api-worker/src/v1/skill.ts");
const skillRuntime = read("apps/api-worker/src/v1/skill-runtime.ts");
const skillEconomy = read("apps/api-worker/src/v1/skill-economy.ts");
const packageJson = read("package.json");

assert(skill.includes("async function hasSkillAcquisitionRules"), "skill.ts must define hasSkillAcquisitionRules");
assert(skill.includes("const hasAcquisitionRules = await hasSkillAcquisitionRules(db);"), "ensureSkillSeedData must check skill_acquisition_rules existence");
assert(skill.includes("if (count && Number(count.cnt) >= 62 && hasAcquisitionRules) return;"), "ensureSkillSeedData must remain compatible with partial production schemas");
assert(skill.includes('error: "skill_catalog_unavailable"'), "/skills/catalog must fail closed with explicit compatibility error");
assert(skill.includes('Skill catalog requires production migration 0013 or compatible acquisition rules.'), "/skills/catalog compatibility message must mention migration 0013");
assert(skill.includes("export { SKILL_DEFINITION_SEED, ensureSkillSeedData, hasSkillAcquisitionRules"), "skill.ts must export hasSkillAcquisitionRules");

assert(skillRuntime.includes('import { hasSkillAcquisitionRules } from "./skill";'), "skill-runtime.ts must import hasSkillAcquisitionRules");
assert(skillRuntime.includes("if (!(await hasSkillAcquisitionRules(c.env.DB)))"), "/skills/runtime-status must guard missing skill_acquisition_rules");
assert(skillRuntime.includes('error: "runtime_catalog_unavailable"'), "/skills/runtime-status must fail closed with explicit compatibility error");

assert(skillEconomy.includes('import { hasSkillAcquisitionRules } from "./skill";'), "skill-economy.ts must import hasSkillAcquisitionRules");
assert(skillEconomy.includes("if (!(await hasSkillAcquisitionRules(db)))"), "skill pool resolution must guard missing skill_acquisition_rules");
assert(skillEconomy.includes("return [];"), "skill pool compatibility guard must fail open without crashing");

assert(packageJson.includes('"verify:production-runtime-compat-v1"'), "package.json must include verify:production-runtime-compat-v1");

if (failures.length > 0) {
  console.error("verify-production-runtime-compat-v1: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("verify-production-runtime-compat-v1: PASS");
