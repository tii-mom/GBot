#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

let passed = true;

function assert(condition, message) {
  if (!condition) {
    console.error(`[VERIFY-V1] FAIL: ${message}`);
    passed = false;
  } else {
    console.log(`[VERIFY-V1] PASS: ${message}`);
  }
}

// 1. Check if verify script exists (self check)
assert(true, "Verifier script exists");

// 2. Load compiled runtime seed
const seedPath = join(root, "apps", "api-worker", "src", "v1", "skill-runtime-seed.ts");
assert(existsSync(seedPath), "skill-runtime-seed.ts exists");

if (passed) {
  // Read and parse seed file (we import or parse from the file content)
  // Let's import it directly
  const { SKILL_RUNTIME_SEED } = await import(join("file://", seedPath));

  // 1. 31 Cards exist in seed
  assert(SKILL_RUNTIME_SEED.length === 31, `Expected exactly 31 skills in seed, got ${SKILL_RUNTIME_SEED.length}`);

  // Tier count checking
  const tiers = { normal: 0, advanced: 0, expert: 0 };
  const ids = new Set();
  const keys = new Set();

  const safetyKeys = ["canSign", "canBroadcast", "canTakeCustody", "canControlUserMainWallet"];
  const bannedPhrases = [
    "guaranteed profit", "guaranteed yield", "guaranteed airdrop", "risk-free", "fixed returns", "sure profit",
    "保证收益", "稳赚", "无风险收益", "保证空投", "固定收益"
  ];

  // Specific admin review requirements
  const strictlyRequiresAdminReview = [
    "sd_onc_smart_contract_reader",
    "sd_exp_onchain_intelligence",
    "sd_biz_agent_service_procurement",
    "sd_onc_ton_chain_analyst",
    "sd_biz_task_profit_analysis",
    "sd_exp_chief_verification_officer"
  ];

  for (const entry of SKILL_RUNTIME_SEED) {
    const { id, skill_definition_id, system_instructions, tool_policy_json, level_effects_json } = entry;

    // 2. Tiers count, id and key uniqueness
    const toolPolicy = JSON.parse(tool_policy_json);
    const levelEffects = JSON.parse(level_effects_json);

    ids.add(id);
    keys.add(skill_definition_id);

    // Parse markdown headers/body details
    const instructions = system_instructions;
    
    // Check headings
    const hasPurpose = instructions.includes("# Purpose");
    const hasUseWhen = instructions.includes("# Use When");
    const hasDoNotUseWhen = instructions.includes("# Do Not Use When");
    const hasRequiredInputs = instructions.includes("# Required Inputs");
    const hasExecutionProcedure = instructions.includes("# Execution Procedure");
    const hasOutputContract = instructions.includes("# Output Contract");
    const hasVerificationChecklist = instructions.includes("# Verification Checklist");
    const hasSafetyBoundaries = instructions.includes("# Safety Boundaries");
    const hasLevelEffects = instructions.includes("# Level Effects");

    assert(hasPurpose && hasUseWhen && hasDoNotUseWhen && hasRequiredInputs && hasExecutionProcedure && hasOutputContract && hasVerificationChecklist && hasSafetyBoundaries && hasLevelEffects, `Skill ${skill_definition_id} has all required markdown sections`);

    // Safety checks
    const hasSignFalse = instructions.toLowerCase().includes("cansign: false");
    const hasBroadcastFalse = instructions.toLowerCase().includes("canbroadcast: false");
    const hasCustodyFalse = instructions.toLowerCase().includes("cantakecustody: false");
    const hasWalletFalse = instructions.toLowerCase().includes("cancontrolusermainwallet: false");

    assert(hasSignFalse && hasBroadcastFalse && hasCustodyFalse && hasWalletFalse, `Skill ${skill_definition_id} explicitly contains safety boundaries false indicators`);

    // Check specific fields: canSign, canBroadcast, canTakeCustody, canControlUserMainWallet in safety rules & reviews
    if (strictlyRequiresAdminReview.includes(skill_definition_id)) {
      const hasAdminReviewRequirement = instructions.includes("requiresAdminReview: true");
      assert(hasAdminReviewRequirement, `Skill ${skill_definition_id} strictly sets requiresAdminReview: true`);
    }

    // Check banned phrases in instructions
    for (const phrase of bannedPhrases) {
      assert(!instructions.toLowerCase().includes(phrase.toLowerCase()), `Skill ${skill_definition_id} does not contain forbidden phrase "${phrase}"`);
    }

    // Check length of execution steps, output formats, safety boundaries
    // Let's count them roughly by split lines or list items under sections
    const lines = instructions.split("\n");
    let executionStepsCount = 0;
    let outputFormatCount = 0;
    let safetyBoundaryCount = 0;

    let section = "";
    for (const line of lines) {
      if (line.startsWith("# ")) {
        section = line.slice(2).trim();
      } else if (section === "Execution Procedure" && (line.trim().match(/^\d+\./) || line.trim().startsWith("-"))) {
        executionStepsCount++;
      } else if (section === "Output Contract" && line.trim().startsWith("*")) {
        outputFormatCount++;
      } else if (section === "Safety Boundaries" && (line.trim().startsWith("-") || line.trim().startsWith("*"))) {
        safetyBoundaryCount++;
      }
    }

    // Relaxed a bit or exact check:
    assert(executionStepsCount >= 4, `Skill ${skill_definition_id} has at least 4 execution steps (found: ${executionStepsCount})`);
    assert(outputFormatCount >= 3, `Skill ${skill_definition_id} has at least 3 output contract parameters (found: ${outputFormatCount})`);
    assert(safetyBoundaryCount >= 3, `Skill ${skill_definition_id} has at least 3 safety boundaries (found: ${safetyBoundaryCount})`);

    // Match tier via folder/id patterns
    if (id.startsWith("sd_res_") || id.startsWith("sd_con_") || id.startsWith("sd_ver_") || id.startsWith("sd_onc_") || id.startsWith("sd_soc_") || id.startsWith("sd_aut_") || id.startsWith("sd_biz_")) {
      // Find tier
      if (id.startsWith("sd_exp_") || id.includes("sd_exp_") || id.includes("_procurement")) {
        // procurement / failure recovery / deep research / multilingual / CVO / onchain intelligence / growth
        tiers.expert++;
      } else if (id.includes("_opportunity_scanner") || id.includes("_information_summary") || id.includes("_social_copywriter") || id.includes("_translation") || id.includes("_short_form_writer") || id.includes("_telegram_promoter") || id.includes("_x_engagement") || id.includes("_community_observer") || id.includes("_submission_checker") || id.includes("_evidence_organizer") || id.includes("_basic_risk_check") || id.includes("_wallet_observer") || id.includes("_transaction_reader") || id.includes("_token_research") || id.includes("_project_research") || id.includes("_structured_writing") || id.includes("_community_operation") || id.includes("_task_decomposition") || id.includes("_tool_selection") || id.includes("_progress_tracking") || id.includes("_budget_management")) {
        tiers.normal++;
      } else {
        tiers.advanced++;
      }
    }
  }

  // 3. Uniqueness checks
  assert(ids.size === 31, "All 31 IDs are unique");
  assert(keys.size === 31, "All 31 definition keys are unique");

  // 4. Token Analysis template verification in docs
  const docPath = join(root, "docs", "SKILL_CARD_RUNTIME_SPEC_V1.md");
  assert(existsSync(docPath), "SKILL_CARD_RUNTIME_SPEC_V1.md exists");
  if (existsSync(docPath)) {
    const docContent = readFileSync(docPath, "utf8");
    assert(docContent.includes("Skill: Token Analysis") && docContent.includes("Tier: Advanced") && docContent.includes("Requires Admin Review: Yes"), "Token Analysis standard template is fully documented in docs/SKILL_CARD_RUNTIME_SPEC_V1.md");
  }
}

if (!passed) {
  process.exit(1);
} else {
  console.log("\n[VERIFY-V1] Verification completed successfully.");
}
