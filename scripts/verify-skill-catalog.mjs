#!/usr/bin/env node
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

let envText = "";
try {
  envText = readFileSync(new URL("../.env", import.meta.url), "utf8");
} catch (_) {}
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const base = process.env.VITE_API_BASE || "http://127.0.0.1:8787";
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const testToken = process.env.TEST_ENDPOINT_TOKEN || "ci_test_secret";

function signTelegramInitData(userObj) {
  const user = JSON.stringify(userObj);
  const authDate = Math.floor(Date.now() / 1000);
  const params = { auth_date: String(authDate), query_id: "verify_skill_catalog_query", user };
  if (!botToken) {
    return new URLSearchParams({ ...params, hash: "mockhash" }).toString();
  }
  const dataCheckString = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
}

let userCounter = 0;
function createUserHeaders() {
  userCounter++;
  const tid = Number(`888${Date.now().toString().slice(-7)}${userCounter}`);
  return { "x-telegram-init-data": signTelegramInitData({ id: tid, username: `skill_cat_${tid}` }) };
}

const testHeaders = { "x-test-endpoint-token": testToken };

async function request(path, options = {}, expectedStatus = 200) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${base}${path}`, { ...options, headers, signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (response.status !== expectedStatus) {
    throw new Error(`${options.method || "GET"} ${path} returned ${response.status}, expected ${expectedStatus}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}

let passed = 0;
let failed = 0;

async function step(name, fn) {
  try {
    const result = await fn();
    console.log(`  PASS ${name}`);
    passed++;
    return result;
  } catch (error) {
    console.error(`  FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
    process.exitCode = 1;
  }
}

const RELEASED_SKILLS = [
  // Normal
  "sd_res_project_research",
  "sd_res_information_summary",
  "sd_con_social_copywriter",
  "sd_con_structured_writing",
  "sd_ver_submission_checker",
  "sd_ver_evidence_organizer",
  "sd_onc_transaction_reader",
  "sd_soc_telegram_promoter",
  "sd_aut_task_decomposition",
  "sd_aut_tool_selection",
  "sd_aut_progress_tracking",
  "sd_biz_budget_management",
  // Advanced
  "sd_res_competitive_intelligence",
  "sd_res_user_market_research",
  "sd_con_technical_documentation",
  "sd_con_content_strategist",
  "sd_ver_advanced_verification",
  "sd_onc_ton_chain_analyst",
  "sd_onc_smart_contract_reader",
  "sd_soc_viral_pattern_analysis",
  "sd_soc_audience_targeting",
  "sd_aut_workflow_planning",
  "sd_biz_task_profit_analysis",
  "sd_biz_client_delivery_management"
];

const NORMAL_RELEASED_SKILLS = [
  "sd_res_project_research",
  "sd_res_information_summary",
  "sd_con_social_copywriter",
  "sd_con_structured_writing",
  "sd_ver_submission_checker",
  "sd_ver_evidence_organizer",
  "sd_onc_transaction_reader",
  "sd_soc_telegram_promoter",
  "sd_aut_task_decomposition",
  "sd_aut_tool_selection",
  "sd_aut_progress_tracking",
  "sd_biz_budget_management"
];

const ADVANCED_RELEASED_SKILLS = [
  "sd_res_competitive_intelligence",
  "sd_res_user_market_research",
  "sd_con_technical_documentation",
  "sd_con_content_strategist",
  "sd_ver_advanced_verification",
  "sd_onc_ton_chain_analyst",
  "sd_onc_smart_contract_reader",
  "sd_soc_viral_pattern_analysis",
  "sd_soc_audience_targeting",
  "sd_aut_workflow_planning",
  "sd_biz_task_profit_analysis",
  "sd_biz_client_delivery_management"
];

const EXPERT_UNLOCKED_SKILLS = [
  "sd_exp_deep_research",
  "sd_exp_multilingual_director",
  "sd_exp_chief_verification_officer",
  "sd_exp_onchain_intelligence",
  "sd_exp_master_growth_strategist",
  "sd_exp_task_orchestration",
  "sd_biz_agent_service_procurement"
];

const CORE_MODULES = [
  "sd_core_task_scanner",
  "sd_core_task_planner",
  "sd_core_basic_writer",
  "sd_core_submission_assistant"
];

async function main() {
  console.log("=== Skill Catalog V1 Integration Verification ===");
  console.log(`Base: ${base}`);

  // Setup user and agent
  const uh = createUserHeaders();
  await request("/me", { headers: uh });
  const agent = await request("/agents/claim", { method: "POST", headers: uh });
  
  // Grant GP
  await request("/test/points-grant", {
    method: "POST", headers: { ...uh, ...testHeaders },
    body: JSON.stringify({ amount: 100000, pointType: "pending_points" })
  });

  // 1. GET /skills/catalog Checks
  await step("Catalog endpoint properties and constraints", async () => {
    const catalog = await request("/skills/catalog", { headers: uh });
    if (catalog.catalogVersion !== 1) throw new Error("Expected catalogVersion 1");
    if (catalog.totalCanonicalSkills !== 31) throw new Error(`Expected 31 total canonical skills, got ${catalog.totalCanonicalSkills}`);
    if (catalog.releasedSkills !== 24) throw new Error(`Expected 24 released skills, got ${catalog.releasedSkills}`);
    if (catalog.advancedUnlockSkills !== 7) throw new Error(`Expected 7 advanced unlock skills, got ${catalog.advancedUnlockSkills}`);
    
    // Core and internal excluded
    for (const skill of catalog.skills) {
      if (CORE_MODULES.includes(skill.id)) throw new Error(`Core module ${skill.id} should not be in catalog`);
      if (skill.releaseStatus === "internal") throw new Error(`Internal skill ${skill.id} should not be in catalog`);
    }

    // Categories
    const expectedCats = ["research", "content", "verification", "onchain", "social", "automation", "business"];
    for (const cat of expectedCats) {
      if (!catalog.categories.includes(cat)) throw new Error(`Missing category ${cat}`);
    }
  });

  // 2. Skill Box drops only released skills (normal/advanced)
  await step("Skill Box drop pool checks", async () => {
    const catalog = await request("/store/boxes", { headers: uh });
    const skillBox = catalog.products.find(p => p.code === "skill_box");

    // Buy and open 10 boxes
    for (let i = 0; i < 10; i++) {
      await request(`/store/boxes/${skillBox.id}/orders`, {
        method: "POST", headers: uh,
        body: JSON.stringify({ quantity: 1, idempotencyKey: `box_buy_${i}_${Date.now()}` })
      });
      const inv = await request("/inventory", { headers: uh });
      const boxItem = inv.items.find(item => item.name === "Skill Box" && item.status === "available");
      
      const openRes = await request(`/boxes/${boxItem.id}/open`, { method: "POST", headers: uh });
      const reward = openRes.rewards[0];
      
      if (reward.type === "skill_card") {
        const itemDetail = await request("/inventory", { headers: uh });
        const card = itemDetail.items.find(c => c.id === reward.itemId);
        if (!RELEASED_SKILLS.includes(card.skill_definition_id)) {
          throw new Error(`Drawn non-released skill ${card.skill_definition_id} from box`);
        }
      }
    }
  });

  // 3. Normal Synthesis targets advanced released skills
  await step("Normal-to-Advanced synthesis pool and audit checks", async () => {
    // Grant 3 normal skill cards
    const cardIds = [];
    for (let i = 0; i < 3; i++) {
      const g = await request("/test/grant-skill-card", {
        method: "POST", headers: { ...uh, ...testHeaders },
        body: JSON.stringify({ skillDefinitionId: "sd_res_project_research" })
      });
      cardIds.push(g.itemId);
    }

    const synthRes = await request("/skills/synthesis/normal-to-advanced", {
      method: "POST", headers: uh,
      body: JSON.stringify({ inventoryItemIds: cardIds, idempotencyKey: `synth_normal_${Date.now()}` })
    });

    const result = synthRes.result;
    if (!ADVANCED_RELEASED_SKILLS.includes(result.skillDefinitionId)) {
      throw new Error(`Synthesized non-released advanced skill: ${result.skillDefinitionId}`);
    }

    // Inspect Audit Event
    const econEvents = await request(`/agents/${agent.id}/skill-economy-events`, { headers: uh });
    const synthEvent = econEvents.events.find(e => e.operationId === result.operationId && e.eventType === "synthesis_result");
    if (!synthEvent) throw new Error("Synthesis audit event missing");
    if (synthEvent.poolCode !== "normal_synthesis_advanced_v1") throw new Error(`Wrong poolCode: ${synthEvent.poolCode}`);
    if (synthEvent.poolVersion !== 1) throw new Error(`Wrong poolVersion: ${synthEvent.poolVersion}`);
    if (synthEvent.selectedSkillDefinitionId !== result.skillDefinitionId) throw new Error("Selected definition mismatch in audit");
    if (synthEvent.rollInteger === null || synthEvent.weightTotal === null || !synthEvent.selectedRange) {
      throw new Error("Audit missing random rolls information");
    }
  });

  // 4. Expert Synthesis success and consolation targets expert advanced_unlock and advanced released skills
  await step("Advanced-to-Expert synthesis success and consolation pool checks", async () => {
    // Case A: Success (force)
    {
      const cardIds = [];
      for (let i = 0; i < 5; i++) {
        const g = await request("/test/grant-skill-card", {
          method: "POST", headers: { ...uh, ...testHeaders },
          body: JSON.stringify({ skillDefinitionId: "sd_res_user_market_research" })
        });
        cardIds.push(g.itemId);
      }

      await request("/test/force-next-draw", {
        method: "POST", headers: { ...uh, ...testHeaders },
        body: JSON.stringify({ drawType: "synthesis_result", forceType: "success" })
      });

      const synthRes = await request("/skills/synthesis/advanced-to-expert", {
        method: "POST", headers: uh,
        body: JSON.stringify({ inventoryItemIds: cardIds, idempotencyKey: `synth_expert_s_${Date.now()}` })
      });

      const result = synthRes.result;
      if (!result.success) throw new Error("Forced synthesis success failed");
      if (!EXPERT_UNLOCKED_SKILLS.includes(result.skillDefinitionId)) {
        throw new Error(`Expert synthesis output not in unlocked expert pool: ${result.skillDefinitionId}`);
      }

      // Check Audit
      const econEvents = await request(`/agents/${agent.id}/skill-economy-events`, { headers: uh });
      const event = econEvents.events.find(e => e.operationId === result.operationId && e.eventType === "synthesis_result");
      if (!event) throw new Error("Expert synthesis result audit event missing");
      if (event.poolCode !== "expert_synthesis_expert_v1") throw new Error(`Wrong poolCode: ${event.poolCode}`);
      if (event.poolVersion !== 1) throw new Error("Wrong poolVersion");
    }

    // Case B: Failure (force)
    {
      const cardIds = [];
      for (let i = 0; i < 5; i++) {
        const g = await request("/test/grant-skill-card", {
          method: "POST", headers: { ...uh, ...testHeaders },
          body: JSON.stringify({ skillDefinitionId: "sd_res_user_market_research" })
        });
        cardIds.push(g.itemId);
      }

      await request("/test/force-next-draw", {
        method: "POST", headers: { ...uh, ...testHeaders },
        body: JSON.stringify({ drawType: "synthesis_result", forceType: "failure" })
      });

      const synthRes = await request("/skills/synthesis/advanced-to-expert", {
        method: "POST", headers: uh,
        body: JSON.stringify({ inventoryItemIds: cardIds, idempotencyKey: `synth_expert_f_${Date.now()}` })
      });

      const result = synthRes.result;
      if (result.success) throw new Error("Forced synthesis failure succeeded");
      
      const inv = await request("/inventory", { headers: uh });
      const consCard = inv.items.find(item => item.id === result.consolationItemId);
      if (!ADVANCED_RELEASED_SKILLS.includes(consCard.skill_definition_id)) {
        throw new Error(`Consolation card not in allowed advanced pool: ${consCard.skill_definition_id}`);
      }

      // Check Audit
      const econEvents = await request(`/agents/${agent.id}/skill-economy-events`, { headers: uh });
      const event = econEvents.events.find(e => e.operationId === result.operationId && e.eventType === "synthesis_result");
      if (!event) throw new Error("Expert synthesis result audit event missing");
      if (event.poolCode !== "expert_failure_consolation_v1") throw new Error(`Wrong poolCode: ${event.poolCode}`);
      if (event.poolVersion !== 1) throw new Error("Wrong poolVersion");
    }
  });

  // 5. Reset Core checks
  await step("Reset Core pools and retry logic verification", async () => {
    // 5.1 Reset Normal
    {
      await request("/test/force-next-draw", {
        method: "POST", headers: { ...uh, ...testHeaders },
        body: JSON.stringify({ drawType: "reset_tier", forceType: "normal" })
      });
      const resetCore = await request("/test/grant-reset-core", { method: "POST", headers: { ...uh, ...testHeaders } });
      const resetRes = await request(`/agents/${agent.id}/skills/reset`, {
        method: "POST", headers: uh,
        body: JSON.stringify({ resetCoreInventoryItemId: resetCore.itemId, idempotencyKey: `reset_n_${Date.now()}` })
      });
      const result = resetRes.result;
      if (!NORMAL_RELEASED_SKILLS.includes(result.newSkillDefinitionId)) {
        throw new Error(`Reset normal tier selected non-normal skill ${result.newSkillDefinitionId}`);
      }
      // Check Audit
      const econEvents = await request(`/agents/${agent.id}/skill-economy-events`, { headers: uh });
      const event = econEvents.events.find(e => e.operationId === result.operationId && e.eventType === "reset");
      if (!event) throw new Error("Reset event missing");
      if (event.poolCode !== "reset_normal_v1") throw new Error(`Wrong poolCode: ${event.poolCode}`);
    }

    // 5.2 Reset Advanced
    {
      await request("/test/force-next-draw", {
        method: "POST", headers: { ...uh, ...testHeaders },
        body: JSON.stringify({ drawType: "reset_tier", forceType: "advanced" })
      });
      const resetCore = await request("/test/grant-reset-core", { method: "POST", headers: { ...uh, ...testHeaders } });
      const resetRes = await request(`/agents/${agent.id}/skills/reset`, {
        method: "POST", headers: uh,
        body: JSON.stringify({ resetCoreInventoryItemId: resetCore.itemId, idempotencyKey: `reset_a_${Date.now()}` })
      });
      const result = resetRes.result;
      if (!ADVANCED_RELEASED_SKILLS.includes(result.newSkillDefinitionId)) {
        throw new Error(`Reset advanced tier selected non-advanced skill ${result.newSkillDefinitionId}`);
      }
      // Check Audit
      const econEvents = await request(`/agents/${agent.id}/skill-economy-events`, { headers: uh });
      const event = econEvents.events.find(e => e.operationId === result.operationId && e.eventType === "reset");
      if (!event) throw new Error("Reset event missing");
      if (event.poolCode !== "reset_advanced_v1") throw new Error(`Wrong poolCode: ${event.poolCode}`);
    }

    // 5.3 Reset Expert
    {
      await request("/test/force-next-draw", {
        method: "POST", headers: { ...uh, ...testHeaders },
        body: JSON.stringify({ drawType: "reset_tier", forceType: "expert" })
      });
      const resetCore = await request("/test/grant-reset-core", { method: "POST", headers: { ...uh, ...testHeaders } });
      const resetRes = await request(`/agents/${agent.id}/skills/reset`, {
        method: "POST", headers: uh,
        body: JSON.stringify({ resetCoreInventoryItemId: resetCore.itemId, idempotencyKey: `reset_e_${Date.now()}` })
      });
      const result = resetRes.result;
      if (!EXPERT_UNLOCKED_SKILLS.includes(result.newSkillDefinitionId)) {
        throw new Error(`Reset expert tier selected non-expert skill ${result.newSkillDefinitionId}`);
      }
      // Check Audit
      const econEvents = await request(`/agents/${agent.id}/skill-economy-events`, { headers: uh });
      const event = econEvents.events.find(e => e.operationId === result.operationId && e.eventType === "reset");
      if (!event) throw new Error("Reset event missing");
      if (event.poolCode !== "reset_expert_v1") throw new Error(`Wrong poolCode: ${event.poolCode}`);
    }
  });

  // 6. Compatibility with internal legacy skills
  await step("Internal legacy card learning and upgrading compatibility", async () => {
    // Grant historical internal card (e.g. sd_res_opportunity_scanner)
    const card = await request("/test/grant-skill-card", {
      method: "POST", headers: { ...uh, ...testHeaders },
      body: JSON.stringify({ skillDefinitionId: "sd_res_opportunity_scanner", name: "Opportunity Scanner" })
    });

    // Learn skill card
    const learnRes = await request(`/agents/${agent.id}/skills/learn`, {
      method: "POST", headers: uh,
      body: JSON.stringify({ inventoryItemId: card.itemId, slotIndex: 1, idempotencyKey: `learn_internal_${Date.now()}` })
    });

    const result = learnRes.result;
    if (result.skillDefinitionId !== "sd_res_opportunity_scanner") throw new Error("Failed to learn internal legacy card");

    // Upgrade skill card
    const cardToUpgrade = await request("/test/grant-skill-card", {
      method: "POST", headers: { ...uh, ...testHeaders },
      body: JSON.stringify({ skillDefinitionId: "sd_res_opportunity_scanner", name: "Opportunity Scanner" })
    });

    const upgradeRes = await request(`/agents/${agent.id}/skills/${result.learnedSkillId}/upgrade`, {
      method: "POST", headers: uh,
      body: JSON.stringify({ consumedInventoryItemId: cardToUpgrade.itemId, idempotencyKey: `upgrade_internal_${Date.now()}` })
    });

    if (upgradeRes.result.toLevel !== 2) {
      throw new Error(`Expected level 2 after upgrade, got ${upgradeRes.result.toLevel}`);
    }
  });

  console.log(`\n=== Catalog Verification Complete: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
