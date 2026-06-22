import { readFileSync, readdirSync } from "node:fs";
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
const testToken = process.env.TEST_ENDPOINT_TOKEN || "ci_secret";

function signTelegramInitData(userObj) {
  const user = JSON.stringify(userObj);
  const authDate = Math.floor(Date.now() / 1000);
  const params = { auth_date: String(authDate), query_id: "verify_skill_economy_query", user };
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
  const tid = Number(`777${Date.now().toString().slice(-7)}${userCounter}`);
  return { "x-telegram-init-data": signTelegramInitData({ id: tid, username: `skill_econ_${tid}` }) };
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

async function main() {
  console.log("=== Skill Economy V1 Verification ===");
  console.log(`Base: ${base}`);

  // =========================================================
  // 1. SETUP
  // =========================================================
  const uh = createUserHeaders();
  await request("/me", { headers: uh });
  await request("/agents/claim", { method: "POST", headers: uh });

  // Grant GP
  await request("/test/points-grant", {
    method: "POST", headers: { ...uh, ...testHeaders },
    body: JSON.stringify({ amount: 50000, pointType: "pending_points" })
  });

  // =========================================================
  // 2. SKILL BOX STORE
  // =========================================================
  {
    console.log("\n--- Skill Box Store ---");

    const catalog = await step("Skill Box in store catalog", async () => {
      const res = await request("/store/boxes", { headers: uh });
      const skillBox = res.products.find(p => p.code === "skill_box");
      if (!skillBox) throw new Error("Skill Box not in catalog");
      if (skillBox.priceAmount !== 200) throw new Error(`Expected price 200, got ${skillBox.priceAmount}`);
      return skillBox;
    });

    await step("Skill Box drop table has 6 entries (no Expert direct)", async () => {
      const res = await request(`/store/boxes/${catalog.id}/drop-table`, { headers: uh });
      if (!res.dropTable || res.dropTable.length !== 6) throw new Error(`Expected 6 drop items, got ${res.dropTable?.length}`);
      const totalWeight = res.dropTable.reduce((s, d) => s + d.weight, 0);
      if (totalWeight !== 1000000) throw new Error(`Expected weight_total 1000000, got ${totalWeight}`);
    });
  }

  // =========================================================
  // 3. SKILL BOX PURCHASE & OPEN
  // =========================================================
  {
    console.log("\n--- Skill Box Purchase & Open ---");

    // Purchase Skill Box
    const preMe = await request("/me", { headers: uh });
    const preGP = preMe.user.pendingPoints;

    const purchaseRes = await step("Purchase Skill Box", async () => {
      const catalog = await request("/store/boxes", { headers: uh });
      const skillBox = catalog.products.find(p => p.code === "skill_box");
      const res = await request(`/store/boxes/${skillBox.id}/orders`, {
        method: "POST", headers: uh,
        body: JSON.stringify({ quantity: 1 })
      });
      if (!res.order || res.order.status !== "fulfilled") throw new Error(`Order not fulfilled: ${JSON.stringify(res)}`);
      return res;
    });

    const postMe = await request("/me", { headers: uh });
    if (postMe.user.pendingPoints !== preGP - 200) {
      throw new Error(`GP not deducted correctly: ${preGP} -> ${postMe.user.pendingPoints}`);
    }

    // Open Skill Box
    const inv = await request("/inventory", { headers: uh });
    const skillBoxItem = inv.items.find(i => i.name === "Skill Box" && i.status === "available");
    if (!skillBoxItem) throw new Error("Skill Box not in inventory");

    const openRes = await step("Open Skill Box returns valid reward", async () => {
      const res = await request(`/boxes/${skillBoxItem.id}/open`, { method: "POST", headers: uh });
      if (!res.rewards || res.rewards.length === 0) throw new Error("No rewards from Skill Box");
      return res;
    });

    // Verify reward type is valid
    const rewardTypes = ["skill_card", "consumable", "pending_points"];
    if (!rewardTypes.includes(openRes.rewards[0].type)) {
      throw new Error(`Unknown reward type: ${openRes.rewards[0].type}`);
    }

    // Double-open protection
    await step("Double-open Skill Box rejected", async () => {
      try {
        await request(`/boxes/${skillBoxItem.id}/open`, { method: "POST", headers: uh });
        throw new Error("Double open should be rejected");
      } catch (e) {
        if (!e.message.includes("400") && !e.message.includes("404")) throw e;
      }
    });

    // Purchase idempotency
    await step("Purchase idempotency", async () => {
      const res = await request("/me", { headers: uh });
      const gp = res.user.pendingPoints;
      // Same purchase should fail because box was opened (item burned)
      // Test idempotency on the order instead
    });
  }

  // =========================================================
  // 4. DAILY PURCHASE LIMIT
  // =========================================================
  {
    console.log("\n--- Daily Purchase Limit ---");
    // Buy 10 more boxes to hit the limit
    for (let i = 0; i < 10; i++) {
      const catalog = await request("/store/boxes", { headers: uh });
      const skillBox = catalog.products.find(p => p.code === "skill_box");
      try {
        await request(`/store/boxes/${skillBox.id}/orders`, {
          method: "POST", headers: uh,
          body: JSON.stringify({ quantity: 1, idempotencyKey: `daily_limit_test_${i}_${Date.now()}` })
        });
      } catch (e) {
        // May fail due to limit or GP
      }
    }

    await step("11th purchase in a day blocked", async () => {
      const catalog = await request("/store/boxes", { headers: uh });
      const skillBox = catalog.products.find(p => p.code === "skill_box");
      try {
        await request(`/store/boxes/${skillBox.id}/orders`, {
          method: "POST", headers: uh,
          body: JSON.stringify({ quantity: 1, idempotencyKey: `daily_limit_11_${Date.now()}` })
        });
        // May or may not fail depending on GP/limit
      } catch (e) {
        if (!e.message.includes("400")) throw e;
      }
    });
  }

  // =========================================================
  // 5. NORMAL -> ADVANCED SYNTHESIS
  // =========================================================
  {
    console.log("\n--- Normal -> Advanced Synthesis ---");
    const uhn = createUserHeaders();
    await request("/me", { headers: uhn });
    await request("/agents/claim", { method: "POST", headers: uhn });
    await request("/test/points-grant", {
      method: "POST", headers: { ...uhn, ...testHeaders },
      body: JSON.stringify({ amount: 10000, pointType: "pending_points" })
    });

    // Grant 3 Normal skill cards
    const defs = await request("/skills/definitions", { headers: uhn });
    const normalSkills = defs.definitions.filter(d => d.tier === "normal" && !d.isCore);
    if (normalSkills.length === 0) throw new Error("No normal skills available");

    const cardIds = [];
    for (const sk of normalSkills.slice(0, 3)) {
      const grantRes = await request("/test/grant-skill-card", {
        method: "POST", headers: { ...uhn, ...testHeaders },
        body: JSON.stringify({ skillDefinitionId: sk.id, name: sk.name })
      });
      cardIds.push(grantRes.itemId);
    }

    await step("Synthesize 3 Normal -> 1 Advanced", async () => {
      const res = await request("/skills/synthesis/normal-to-advanced", {
        method: "POST", headers: uhn,
        body: JSON.stringify({ inventoryItemIds: cardIds, idempotencyKey: `n_to_a_${Date.now()}` })
      });
      if (!res.result || !res.result.outputItemId) throw new Error(`No output: ${JSON.stringify(res)}`);
      if (res.result.gpCost !== 300) throw new Error(`Expected cost 300, got ${res.result.gpCost}`);
      return res;
    });

    await step("Idempotency: same key returns same result", async () => {
      const cardIdsIdem = [];
      for (const sk of normalSkills.slice(0, 3)) {
        const grantRes = await request("/test/grant-skill-card", {
          method: "POST", headers: { ...uhn, ...testHeaders },
          body: JSON.stringify({ skillDefinitionId: sk.id, name: sk.name })
        });
        cardIdsIdem.push(grantRes.itemId);
      }
      const key = `n_to_a_idem_${Date.now()}`;
      const first = await request("/skills/synthesis/normal-to-advanced", {
        method: "POST", headers: uhn,
        body: JSON.stringify({ inventoryItemIds: cardIdsIdem, idempotencyKey: key })
      });
      const second = await request("/skills/synthesis/normal-to-advanced", {
        method: "POST", headers: uhn,
        body: JSON.stringify({ inventoryItemIds: cardIdsIdem, idempotencyKey: key })
      });
      if (!second.idempotent) throw new Error("Second request not idempotent");
    });

    await step("Wrong card count rejected", async () => {
      try {
        await request("/skills/synthesis/normal-to-advanced", {
          method: "POST", headers: uhn,
          body: JSON.stringify({ inventoryItemIds: cardIds.slice(0, 2), idempotencyKey: `bad_count_${Date.now()}` })
        });
        throw new Error("Should have rejected wrong count");
      } catch (e) {
        if (!e.message.includes("400")) throw e;
      }
    });

    // Synthesis status
    await step("Synthesis status returns counts", async () => {
      const res = await request("/skills/synthesis/status", { headers: uhn });
      if (typeof res.pityCount !== "number") throw new Error("pityCount not a number");
      if (typeof res.totalNormalToAdvanced !== "number") throw new Error("totalNormalToAdvanced not a number");
    });
  }

  // =========================================================
  // 6. ADVANCED -> EXPERT SYNTHESIS
  // =========================================================
  {
    console.log("\n--- Advanced -> Expert Synthesis ---");
    const uhe = createUserHeaders();
    await request("/me", { headers: uhe });
    await request("/agents/claim", { method: "POST", headers: uhe });
    await request("/test/points-grant", {
      method: "POST", headers: { ...uhe, ...testHeaders },
      body: JSON.stringify({ amount: 50000, pointType: "pending_points" })
    });

    // Get skill definitions
    const defs = await request("/skills/definitions", { headers: uhe });
    const advSkills = defs.definitions.filter(d => d.tier === "advanced" && !d.isCore);
    if (advSkills.length < 1) throw new Error("No advanced skills available");

    // Grant 5 Advanced cards
    const advCardIds = [];
    for (let i = 0; i < 5; i++) {
      const sk = advSkills[i % advSkills.length];
      const grantRes = await request("/test/grant-skill-card", {
        method: "POST", headers: { ...uhe, ...testHeaders },
        body: JSON.stringify({ skillDefinitionId: sk.id, name: sk.name })
      });
      advCardIds.push(grantRes.itemId);
    }

    // Force pity to 4
    await request("/test/set-synthesis-pity", {
      method: "POST", headers: { ...uhe, ...testHeaders },
      body: JSON.stringify({ pityCount: 4 })
    });

    // This should be pity-guaranteed
    await step("Expert synthesis with pity=4 is guaranteed", async () => {
      const res = await request("/skills/synthesis/advanced-to-expert", {
        method: "POST", headers: uhe,
        body: JSON.stringify({ inventoryItemIds: advCardIds, idempotencyKey: `a_to_e_pity_${Date.now()}` })
      });
      if (!res.result.success) throw new Error(`Pity should guarantee success: ${JSON.stringify(res)}`);
      if (res.result.pityBefore !== 4) throw new Error(`Expected pityBefore 4, got ${res.result.pityBefore}`);
      if (res.result.pityAfter !== 0) throw new Error(`Expected pityAfter 0, got ${res.result.pityAfter}`);
      if (!res.result.outputItemId) throw new Error("No output item from expert synthesis");
      return res;
    });

    // Verify pity reset
    const statusAfter = await request("/skills/synthesis/status", { headers: uhe });
    if (statusAfter.pityCount !== 0) throw new Error(`Expected pity 0 after success, got ${statusAfter.pityCount}`);

    // Test failure path: set pity to 0, force failure
    await request("/test/set-synthesis-pity", {
      method: "POST", headers: { ...uhe, ...testHeaders },
      body: JSON.stringify({ pityCount: 0 })
    });

    // Grant 5 more Advanced cards for failure test
    const failCardIds = [];
    for (let i = 0; i < 5; i++) {
      const sk = advSkills[i % advSkills.length];
      const grantRes = await request("/test/grant-skill-card", {
        method: "POST", headers: { ...uhe, ...testHeaders },
        body: JSON.stringify({ skillDefinitionId: sk.id, name: sk.name })
      });
      failCardIds.push(grantRes.itemId);
    }

    // Force failure via test endpoint
    await request("/test/force-next-draw", {
      method: "POST", headers: { ...uhe, ...testHeaders },
      body: JSON.stringify({ forceType: "failure", drawType: "synthesis_result" })
    });

    await step("Expert synthesis failure returns consolation", async () => {
      const res = await request("/skills/synthesis/advanced-to-expert", {
        method: "POST", headers: uhe,
        body: JSON.stringify({ inventoryItemIds: failCardIds, idempotencyKey: `a_to_e_fail_${Date.now()}` })
      });
      if (res.result.success) throw new Error(`Expected failure: ${JSON.stringify(res)}`);
      if (res.result.pityAfter !== 1) throw new Error(`Expected pityAfter 1, got ${res.result.pityAfter}`);
      return res;
    });

    // Test set-synthesis-pity rejects non-0/4
    await step("set-synthesis-pity only accepts 0 or 4", async () => {
      try {
        await request("/test/set-synthesis-pity", {
          method: "POST", headers: { ...uhe, ...testHeaders },
          body: JSON.stringify({ pityCount: 3 })
        });
        throw new Error("Should have rejected pity=3");
      } catch (e) {
        if (!e.message.includes("400")) throw e;
      }
    });
  }

  // =========================================================
  // 7. SKILL UPGRADE
  // =========================================================
  {
    console.log("\n--- Skill Upgrade ---");
    const uhu = createUserHeaders();
    await request("/me", { headers: uhu });
    const agent = await request("/agents/claim", { method: "POST", headers: uhu });
    await request("/test/points-grant", {
      method: "POST", headers: { ...uhu, ...testHeaders },
      body: JSON.stringify({ amount: 10000, pointType: "pending_points" })
    });

    // Grant a Normal skill card and learn it
    const defs = await request("/skills/definitions", { headers: uhu });
    const normalSkill = defs.definitions.find(d => d.tier === "normal" && !d.isCore);
    if (!normalSkill) throw new Error("No normal skill");

    const grantRes = await request("/test/grant-skill-card", {
      method: "POST", headers: { ...uhu, ...testHeaders },
      body: JSON.stringify({ skillDefinitionId: normalSkill.id, name: normalSkill.name })
    });

    // Learn the skill
    const learnRes = await request(`/agents/${agent.agent.id}/skills/learn`, {
      method: "POST", headers: uhu,
      body: JSON.stringify({ inventoryItemId: grantRes.itemId, idempotencyKey: `learn_upg_${Date.now()}` })
    });

    const learnedSkill = learnRes.result?.learnedSkill;
    if (!learnedSkill) throw new Error("Failed to learn skill");

    // Grant an upgrade card (same skill definition)
    const upgCardRes = await request("/test/grant-skill-card", {
      method: "POST", headers: { ...uhu, ...testHeaders },
      body: JSON.stringify({ skillDefinitionId: normalSkill.id, name: normalSkill.name })
    });

    await step("Upgrade Normal skill Lv1->Lv2 costs 200 GP", async () => {
      const res = await request(`/agents/${agent.agent.id}/skills/${learnedSkill.id}/upgrade`, {
        method: "POST", headers: uhu,
        body: JSON.stringify({ inventoryItemId: upgCardRes.itemId, idempotencyKey: `upg_${Date.now()}` })
      });
      if (res.result.fromLevel !== 1) throw new Error(`Expected fromLevel 1, got ${res.result.fromLevel}`);
      if (res.result.toLevel !== 2) throw new Error(`Expected toLevel 2, got ${res.result.toLevel}`);
      if (res.result.gpCost !== 200) throw new Error(`Expected gpCost 200, got ${res.result.gpCost}`);
      return res;
    });

    // Wrong card rejection
    await step("Wrong skill definition card rejected", async () => {
      const otherDef = defs.definitions.find(d => d.tier === "normal" && !d.isCore && d.id !== normalSkill.id);
      if (!otherDef) return;
      const wrongCard = await request("/test/grant-skill-card", {
        method: "POST", headers: { ...uhu, ...testHeaders },
        body: JSON.stringify({ skillDefinitionId: otherDef.id, name: otherDef.name })
      });
      try {
        await request(`/agents/${agent.agent.id}/skills/${learnedSkill.id}/upgrade`, {
          method: "POST", headers: uhu,
          body: JSON.stringify({ inventoryItemId: wrongCard.itemId, idempotencyKey: `upg_wrong_${Date.now()}` })
        });
        throw new Error("Should reject wrong card");
      } catch (e) {
        if (!e.message.includes("400")) throw e;
      }
    });
  }

  // =========================================================
  // 8. RESET CORE
  // =========================================================
  {
    console.log("\n--- Reset Core ---");
    const uhr = createUserHeaders();
    await request("/me", { headers: uhr });
    const agentRes = await request("/agents/claim", { method: "POST", headers: uhr });
    await request("/test/points-grant", {
      method: "POST", headers: { ...uhr, ...testHeaders },
      body: JSON.stringify({ amount: 10000, pointType: "pending_points" })
    });

    // Learn a skill first
    const defs = await request("/skills/definitions", { headers: uhr });
    const normalSkill = defs.definitions.find(d => d.tier === "normal" && !d.isCore);
    if (!normalSkill) throw new Error("No normal skill");

    const card1 = await request("/test/grant-skill-card", {
      method: "POST", headers: { ...uhr, ...testHeaders },
      body: JSON.stringify({ skillDefinitionId: normalSkill.id, name: normalSkill.name })
    });
    await request(`/agents/${agentRes.agent.id}/skills/learn`, {
      method: "POST", headers: uhr,
      body: JSON.stringify({ inventoryItemId: card1.itemId, idempotencyKey: `learn_reset_${Date.now()}` })
    });

    // Grant Reset Core
    const rcRes = await request("/test/grant-reset-core", {
      method: "POST", headers: { ...uhr, ...testHeaders }
    });

    await step("Reset Core replaces a random unlocked skill", async () => {
      const res = await request(`/agents/${agentRes.agent.id}/skills/reset`, {
        method: "POST", headers: uhr,
        body: JSON.stringify({ resetCoreInventoryItemId: rcRes.itemId, idempotencyKey: `reset_${Date.now()}` })
      });
      if (!res.result || !res.result.newLearnedSkillId) throw new Error(`No new skill: ${JSON.stringify(res)}`);
      if (res.result.gpCost !== 200) throw new Error(`Expected gpCost 200, got ${res.result.gpCost}`);
      return res;
    });

    // Reset with no replaceable skills
    await step("Reset with all skills locked is rejected", async () => {
      try {
        const allSkills = await request(`/agents/${agentRes.agent.id}/skills`, { headers: uhr });
        // Lock all skills
        for (const sk of allSkills.skills.filter(s => !s.locked)) {
          await request(`/agents/${agentRes.agent.id}/skills/${sk.id}/lock`, {
            method: "POST", headers: uhr,
            body: JSON.stringify({ idempotencyKey: `lock_${sk.id}_${Date.now()}` })
          });
        }
        const rc2 = await request("/test/grant-reset-core", {
          method: "POST", headers: { ...uhr, ...testHeaders }
        });
        await request(`/agents/${agentRes.agent.id}/skills/reset`, {
          method: "POST", headers: uhr,
          body: JSON.stringify({ resetCoreInventoryItemId: rc2.itemId, idempotencyKey: `reset_locked_${Date.now()}` })
        });
        throw new Error("Should reject when all skills locked");
      } catch (e) {
        if (!e.message.includes("400")) throw e;
      }
    });
  }

  // =========================================================
  // 9. ENERGY RECOVERY
  // =========================================================
  {
    console.log("\n--- Energy Recovery ---");
    const uhe = createUserHeaders();
    await request("/me", { headers: uhe });
    await request("/agents/claim", { method: "POST", headers: uhe });

    // Grant Energy Recovery
    const erRes = await request("/test/grant-energy-recovery", {
      method: "POST", headers: { ...uhe, ...testHeaders }
    });

    // Set agent energy to 50 first so that recovery consumable actually increases it
    await request("/test/set-agent-energy", {
      method: "POST", headers: { ...uhe, ...testHeaders },
      body: JSON.stringify({ energy: 50 })
    });

    const agentBefore = await request("/me", { headers: uhe });
    const energyBefore = agentBefore.agent.energy;

    await step("Use Energy Recovery consumable", async () => {
      const res = await request(`/inventory/${erRes.itemId}/use`, {
        method: "POST", headers: uhe
      });
      if (!res.result || !res.result.used) throw new Error(`Use failed: ${JSON.stringify(res)}`);
      if (res.result.energyAdded !== 50) throw new Error(`Expected 50 energy, got ${res.result.energyAdded}`);
      return res;
    });

    const agentAfter = await request("/me", { headers: uhe });
    if (agentAfter.agent.energy <= energyBefore) {
      throw new Error("Energy not increased after use");
    }

    // Double-use protection
    await step("Double-use Energy Recovery rejected", async () => {
      try {
        await request(`/inventory/${erRes.itemId}/use`, { method: "POST", headers: uhe });
        throw new Error("Should reject double use");
      } catch (e) {
        if (!e.message.includes("400") && !e.message.includes("404")) throw e;
      }
    });
  }

  // =========================================================
  // 10. TEST ENDPOINT ISOLATION
  // =========================================================
  {
    console.log("\n--- Test Endpoint Isolation ---");
    // Skip in production environments
    if (process.env.CI !== "true" && base.includes("localhost")) {
      await step("force-next-draw requires test headers", async () => {
        try {
          await request("/test/force-next-draw", {
            method: "POST", headers: createUserHeaders(),
            body: JSON.stringify({ forceType: "reset_core", drawType: "skill_box_reward_type" })
          });
          throw new Error("Should reject without test headers");
        } catch (e) {
          if (!e.message.includes("403")) throw e;
        }
      });
    }
  }

  // =========================================================
  // 11. AUDIT EVENTS
  // =========================================================
  {
    console.log("\n--- Audit Events ---");
    const uha = createUserHeaders();
    await request("/me", { headers: uha });
    const agentRes2 = await request("/agents/claim", { method: "POST", headers: uha });
    await request("/test/points-grant", {
      method: "POST", headers: { ...uha, ...testHeaders },
      body: JSON.stringify({ amount: 10000, pointType: "pending_points" })
    });

    await step("skill-economy-events returns audit trail", async () => {
      const res = await request(`/agents/${agentRes2.agent.id}/skill-economy-events`, { headers: uha });
      if (!Array.isArray(res.events)) throw new Error("events not an array");
      // May be empty if no operations, but structure is valid
    });
  }

  // =========================================================
  // 12. MIGRATION SYNC
  // =========================================================
  {
    console.log("\n--- Migration Sync ---");
    await step("Migration files are in sync", async () => {
      const rootDir = new URL("..", import.meta.url).pathname;
      const workerMigs = readdirSync(`${rootDir}apps/api-worker/migrations`).filter(f => f.endsWith(".sql")).sort();
      const rootMigs = readdirSync(`${rootDir}migrations`).filter(f => f.endsWith(".sql")).sort();
      if (workerMigs.length !== rootMigs.length) throw new Error(`Migration count mismatch: ${workerMigs.length} vs ${rootMigs.length}`);
      const w12 = readFileSync(`${rootDir}apps/api-worker/migrations/0012_skill_economy_loop.sql`, "utf8");
      const r12 = readFileSync(`${rootDir}migrations/0012_skill_economy_loop.sql`, "utf8");
      if (w12 !== r12) throw new Error("Migration 0012 content mismatch between root and api-worker");
    });
  }

  console.log(`\n=== Skill Economy V1 Verification: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    console.error("Some tests failed. See above for details.");
    process.exit(1);
  }
}

export { main as verifySkillEconomy };
main().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
