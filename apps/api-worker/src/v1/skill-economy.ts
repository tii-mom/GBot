import { Hono, Context } from "hono";
import {
  Bindings,
  requireUser,
  requireTestMode,
  id,
  getAgent,
  ledger,
  parseJson,
  logActivity,
  getUpgradeBaseCost,
  getTierMultiplier,
  toSkillEconomyEvent,
  DbSkillDefinition,
  DbLearnedSkill,
  DbSynthesisPity,
  DbUpgradeOperation,
  DbSynthesisOperation,
  DbBoxProduct,
  DbBoxDropItem,
  DbInventoryItem,
  DbAgent,
  DbSkillEconomyEvent,
  toBoxProduct,
  toInventoryItem,
} from "./core";

type AppContext = Context<{ Bindings: Bindings }>;

// =====================================================================
// SECURE RANDOM
// =====================================================================

function secureRandomInt(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error("invalid_random_range");
  }
  const range = 0x1_0000_0000;
  const limit = range - (range % maxExclusive);
  const values = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(values);
  } while (values[0] === undefined || values[0] >= limit);
  return values[0]! % maxExclusive;
}

// =====================================================================
// WEIGHTED DROP WITH AUDIT
// =====================================================================

interface DropEntry {
  rewardType: string;
  weight: number;
}

const WEIGHT_TOTAL = 1_000_000;

function weightedDraw(
  entries: DropEntry[],
  testOverride?: string | null
): { rewardType: string; rollInteger: number; selectedRange: string } {
  if (testOverride) {
    return { rewardType: testOverride, rollInteger: -1, selectedRange: "test_override" };
  }

  if (entries.length === 0) {
    throw new Error("invalid_drop_config");
  }
  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  if (totalWeight <= 0) {
    throw new Error("invalid_drop_config");
  }

  const roll = secureRandomInt(totalWeight);
  let cumulative = 0;
  for (const entry of entries) {
    cumulative += entry.weight;
    if (roll < cumulative) {
      return {
        rewardType: entry.rewardType,
        rollInteger: roll,
        selectedRange: `${cumulative - entry.weight}-${cumulative}`,
      };
    }
  }

  throw new Error("invalid_drop_config");
}

// =====================================================================
// PENDING OPERATION HELPERS
// =====================================================================

const PENDING_TIMEOUT_MS = 30_000;

async function checkPendingRecovery(
  db: D1Database,
  opId: string,
  table: string,
  userId: string
): Promise<{ needsRecovery: boolean; operation: any }> {
  const row = await db.prepare(
    `SELECT * FROM ${table} WHERE id = ? AND user_id = ?`
  ).bind(opId, userId).first<any>();

  if (!row) return { needsRecovery: false, operation: null };

  if (row.status === "completed") return { needsRecovery: false, operation: row };
  if (row.status === "failed") return { needsRecovery: false, operation: row };
  if (row.status === "pending") {
    const age = Date.now() - new Date(row.created_at + "Z").getTime();
    if (age < PENDING_TIMEOUT_MS) {
      return { needsRecovery: false, operation: row };
    }
    // Timed out — check for side effects
    // If ledger or output item exist, it may have partially committed
    // For simplicity in v1: mark as failed and require retry
    await db.prepare(
      `UPDATE ${table} SET status = 'failed', last_error = 'timeout', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`
    ).bind(opId).run();
    return { needsRecovery: false, operation: { ...row, status: "failed" } };
  }
  return { needsRecovery: false, operation: row };
}

async function reservePendingOperation(
  db: D1Database,
  table: string,
  userId: string,
  idempotencyKey: string,
  requestHash: string
): Promise<{ conflict: boolean; existingStatus?: string; existingResult?: any } | null> {
  const existing = await db.prepare(
    `SELECT * FROM ${table} WHERE user_id = ? AND idempotency_key = ?`
  ).bind(userId, idempotencyKey).first<any>();

  if (existing) {
    if (existing.status === "completed") {
      return { conflict: false, existingStatus: "completed", existingResult: parseJson(existing.result_json, {}) };
    }
    if (existing.status === "failed") {
      return { conflict: false, existingStatus: "failed" };
    }
    if (existing.status === "pending") {
      // Check request hash
      if (existing.request_hash === requestHash) {
        return { conflict: false, existingStatus: "pending" };
      }
      return { conflict: true };
    }
  }

  return null; // no existing — proceed
}

// =====================================================================
// SKILL DEFINITION POOL HELPERS
// =====================================================================

async function getSkillPoolForTier(
  db: D1Database,
  tier: string,
  excludeAgentId?: string
): Promise<DbSkillDefinition[]> {
  let query = `SELECT * FROM agent_skill_definitions WHERE status = 'enabled' AND is_core = 0 AND tier = ?`;
  const params: any[] = [tier];

  if (excludeAgentId) {
    // Exclude skills already active on this agent (for Reset Core)
    query += ` AND id NOT IN (
      SELECT skill_definition_id FROM agent_learned_skills
      WHERE agent_id = ? AND status = 'active'
    )`;
    params.push(excludeAgentId);
  }

  const result = await db.prepare(query).bind(...params).all<DbSkillDefinition>();
  return result.results;
}

async function pickRandomSkillDefinition(
  db: D1Database,
  tier: string,
  excludeAgentId?: string,
  maxAttempts: number = 5
): Promise<{ skillDef: DbSkillDefinition | null; attempts: number }> {
  const pool = await getSkillPoolForTier(db, tier, excludeAgentId);
  if (!pool || pool.length === 0) return { skillDef: null, attempts: 0 };

  const idx = secureRandomInt(pool.length);
  return { skillDef: pool[idx] || null, attempts: 1 };
}

export async function pickMultiStageSkill(
  db: D1Database,
  tierWeights: DropEntry[],
  allowActiveSkill: boolean,
  excludeAgentId?: string,
  testOverride?: string | null
): Promise<{
  rewardType: string;
  skillDef: DbSkillDefinition | null;
  stage1Roll: number;
  selectedRange: string;
}> {
  // Stage 1: pick tier
  const stage1 = weightedDraw(tierWeights, testOverride);
  const drawnTier = stage1.rewardType;

  // Stage 2: pick specific skill from that tier
  const excludeId = allowActiveSkill ? undefined : excludeAgentId;
  const pool = await getSkillPoolForTier(db, drawnTier, excludeId);

  let skillDef: DbSkillDefinition | null = null;
  if (pool && pool.length > 0) {
    const idx = secureRandomInt(pool.length);
    skillDef = pool[idx] ?? null;
  }

  return {
    rewardType: drawnTier,
    skillDef: skillDef || null,
    stage1Roll: stage1.rollInteger,
    selectedRange: stage1.selectedRange,
  };
}

// =====================================================================
// REGISTER ROUTES
// =====================================================================

export function registerV1SkillEconomy(app: Hono<{ Bindings: Bindings }>) {
  const MAX_DAILY_BOXES = 10;
  const SKILL_BOX_PRODUCT_CODE = "skill_box";
  const SKILL_BOX_PRODUCT_ID = "bp_skill_box";

  // ====================================================================
  // SYNTHESIS ROUTES (user-level)
  // ====================================================================

  // POST /skills/synthesis/normal-to-advanced
  app.post("/skills/synthesis/normal-to-advanced", async (c) => {
    const user = await requireUser(c);
    const agent = await getAgent(c.env.DB, user.id);
    if (!agent) return c.json({ error: "no_agent" }, 400);

    const body = await c.req.json().catch(() => ({}));
    const inventoryItemIds: string[] = body.inventoryItemIds || [];
    const idempotencyKey = body.idempotencyKey || `${user.id}:synth_n_to_a:${Date.now()}`;
    const bodyStr = JSON.stringify(body);
    const requestHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bodyStr)).then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join(""));

    if (!Array.isArray(inventoryItemIds) || inventoryItemIds.length !== 3) {
      return c.json({ error: "need_3_normal_cards", message: "Exactly 3 Normal skill cards are required." }, 400);
    }

    // Check idempotency
    const existing = await reservePendingOperation(c.env.DB, "skill_synthesis_operations", user.id, idempotencyKey, requestHash);
    if (existing) {
      if (existing.conflict) return c.json({ error: "idempotency_conflict", message: "Different request body for same key." }, 409);
      if (existing.existingStatus === "completed") return c.json({ result: existing.existingResult, idempotent: true });
      if (existing.existingStatus === "pending") return c.json({ error: "operation_in_progress" }, 409);
      if (existing.existingStatus === "failed") return c.json({ error: "previous_operation_failed", message: "Previous operation failed. Retry with new key." }, 400);
    }

    // Verify cards
    const placeholders = inventoryItemIds.map(() => "?").join(",");
    const cards = await c.env.DB.prepare(
      `SELECT * FROM inventory_items WHERE id IN (${placeholders}) AND owner_user_id = ? AND status = 'available'`
    ).bind(...inventoryItemIds, user.id).all<DbInventoryItem>();

    if (cards.results.length !== 3) {
      return c.json({ error: "cards_not_available", message: "One or more cards are not available or not owned by you." }, 400);
    }

    // Verify all are Normal skill cards
    const skillDefs = await c.env.DB.prepare(
      `SELECT sd.* FROM agent_skill_definitions sd JOIN inventory_items ii ON ii.skill_definition_id = sd.id WHERE ii.id IN (${placeholders})`
    ).bind(...inventoryItemIds).all<DbSkillDefinition>();

    if (skillDefs.results.some((d) => d.tier !== "normal" && d.tier !== "core")) {
      return c.json({ error: "not_all_normal", message: "All input cards must be Normal tier skills." }, 400);
    }

    // Check GP
    const gpCost = 300;
    // will be caught by ledger CHECK in batch

    // Reserve operation
    const opId = id("synth");
    await c.env.DB.prepare(
      `INSERT INTO skill_synthesis_operations (id, user_id, operation_type, synthesis_type, input_item_ids, gp_cost, idempotency_key, request_hash, status)
       VALUES (?, ?, 'synthesis', 'normal_to_advanced', ?, ?, ?, ?, 'pending')`
    ).bind(opId, user.id, JSON.stringify(inventoryItemIds), gpCost, idempotencyKey, requestHash).run();

    // Pick random Advanced skill
    const advPool = await getSkillPoolForTier(c.env.DB, "advanced");
    if (!advPool || advPool.length === 0) {
      await c.env.DB.prepare(
        `UPDATE skill_synthesis_operations SET status = 'failed', last_error = 'no_advanced_skills', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(opId).run();
      return c.json({ error: "no_advanced_skills", message: "No Advanced skills available." }, 500);
    }
    const advIdx = secureRandomInt(advPool.length);
    const selectedDef: DbSkillDefinition = advPool[advIdx]!;

    // Execute batch
    const outputItemId = id("item");
    const statements: any[] = [];

    // Burn input cards
    for (const cardId of inventoryItemIds) {
      statements.push(
        c.env.DB.prepare(
          "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
        ).bind(cardId, user.id)
      );
    }

    // Create output card
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, skill_definition_id, metadata_json)
         VALUES (?, ?, 'skill_card', ?, ?, 'available', 1, 0, ?, ?)`
      ).bind(
        outputItemId, user.id,
        selectedDef.name, selectedDef.tier === "expert" ? "legendary" : selectedDef.tier === "advanced" ? "epic" : "rare",
        selectedDef.id,
        JSON.stringify({ source: "synthesis_normal_to_advanced", tier: selectedDef.tier })
      )
    );

    // GP deduction
    statements.push(
      ledger(c.env.DB, user.id, agent.id, "skill_economy_spend", "pending_points", -gpCost, null, `skill_synthesis_normal_spend|${opId}`, { operationId: opId })
    );

    // Update operation
    statements.push(
      c.env.DB.prepare(
        `UPDATE skill_synthesis_operations SET status = 'completed', output_item_id = ?, result_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(outputItemId, JSON.stringify({ outputItemId, skillDefinitionId: selectedDef.id, skillName: selectedDef.name, tier: selectedDef.tier, gpCost }), opId)
    );

    // Audit event
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO skill_economy_events (id, user_id, agent_id, event_type, inventory_item_id, before_json, after_json)
         VALUES (?, ?, ?, 'synthesis_result', ?, ?, ?)`
      ).bind(id("see"), user.id, agent.id, outputItemId,
        JSON.stringify({ inputItems: inventoryItemIds, synthesisType: "normal_to_advanced" }),
        JSON.stringify({ outputItemId, skillDefinitionId: selectedDef.id, skillName: selectedDef.name, tier: selectedDef.tier, gpCost })
      )
    );

    try {
      const results = await c.env.DB.batch(statements);
      // Verify all card burns succeeded
      for (let i = 0; i < 3; i++) {
        if (results[i]?.meta?.changes !== 1) {
          throw new Error(`Card burn failed at index ${i}`);
        }
      }
    } catch (err: any) {
      await c.env.DB.prepare(
        `UPDATE skill_synthesis_operations SET status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(err.message?.slice(0, 500) || "batch_failed", opId).run();
      return c.json({ error: "synthesis_failed", message: err.message || "Failed to synthesize." }, 500);
    }

    return c.json({
      result: {
        operationId: opId,
        outputItemId,
        skillDefinitionId: selectedDef.id,
        skillName: selectedDef.name,
        tier: selectedDef.tier,
        gpCost,
      },
    });
  });

  // ====================================================================
  // POST /skills/synthesis/advanced-to-expert
  // ====================================================================
  app.post("/skills/synthesis/advanced-to-expert", async (c) => {
    const user = await requireUser(c);
    const agent = await getAgent(c.env.DB, user.id);
    if (!agent) return c.json({ error: "no_agent" }, 400);

    const body = await c.req.json().catch(() => ({}));
    const inventoryItemIds: string[] = body.inventoryItemIds || [];
    const idempotencyKey = body.idempotencyKey || `${user.id}:synth_a_to_e:${Date.now()}`;
    const bodyStr = JSON.stringify(body);
    const requestHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bodyStr)).then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join(""));

    if (!Array.isArray(inventoryItemIds) || inventoryItemIds.length !== 5) {
      return c.json({ error: "need_5_advanced_cards", message: "Exactly 5 Advanced skill cards are required." }, 400);
    }

    // Deduplicate IDs
    const uniqueIds = [...new Set(inventoryItemIds)];
    if (uniqueIds.length !== 5) {
      return c.json({ error: "duplicate_cards", message: "All 5 cards must be distinct inventory items." }, 400);
    }

    // Check idempotency
    const existing = await reservePendingOperation(c.env.DB, "skill_synthesis_operations", user.id, idempotencyKey, requestHash);
    if (existing) {
      if (existing.conflict) return c.json({ error: "idempotency_conflict", message: "Different request body for same key." }, 409);
      if (existing.existingStatus === "completed") return c.json({ result: existing.existingResult, idempotent: true });
      if (existing.existingStatus === "pending") return c.json({ error: "operation_in_progress" }, 409);
      if (existing.existingStatus === "failed") return c.json({ error: "previous_operation_failed" }, 400);
    }

    // Verify cards
    const placeholders = inventoryItemIds.map(() => "?").join(",");
    const cards = await c.env.DB.prepare(
      `SELECT * FROM inventory_items WHERE id IN (${placeholders}) AND owner_user_id = ? AND status = 'available'`
    ).bind(...inventoryItemIds, user.id).all<DbInventoryItem>();

    if (cards.results.length !== 5) {
      return c.json({ error: "cards_not_available", message: "One or more cards are not available." }, 400);
    }

    // Verify all Advanced
    const skillDefs = await c.env.DB.prepare(
      `SELECT sd.* FROM agent_skill_definitions sd JOIN inventory_items ii ON ii.skill_definition_id = sd.id WHERE ii.id IN (${placeholders})`
    ).bind(...inventoryItemIds).all<DbSkillDefinition>();

    if (skillDefs.results.some((d) => d.tier !== "advanced")) {
      return c.json({ error: "not_all_advanced", message: "All input cards must be Advanced tier." }, 400);
    }

    // Reserve operation
    const opId = id("synth");
    const gpCost = 2000;

    await c.env.DB.prepare(
      `INSERT INTO skill_synthesis_operations (id, user_id, operation_type, synthesis_type, input_item_ids, gp_cost, idempotency_key, request_hash, status)
       VALUES (?, ?, 'synthesis', 'advanced_to_expert', ?, ?, ?, ?, 'pending')`
    ).bind(opId, user.id, JSON.stringify(inventoryItemIds), gpCost, idempotencyKey, requestHash).run();

    // Read pity with version
    let pityRow = await c.env.DB.prepare(
      "SELECT pity_count, version FROM skill_synthesis_pity WHERE user_id = ?"
    ).bind(user.id).first<DbSynthesisPity>();

    const currentPity = pityRow?.pity_count ?? 0;
    const currentVersion = pityRow?.version ?? 0;
    const isPityTriggered = currentPity >= 4;

    // Determine result
    let success: boolean;
    let pityAfter: number;

    const testOverride = await getTestDrawOverride(c, "synthesis_result");

    if (isPityTriggered) {
      success = true;
      pityAfter = 0;
    } else if (testOverride === "success") {
      success = true;
      pityAfter = 0;
    } else if (testOverride === "failure") {
      success = false;
      pityAfter = currentPity + 1;
    } else {
      success = secureRandomInt(100) < 20; // 20%
      pityAfter = success ? 0 : currentPity + 1;
    }

    // Build output
    let outputItemId: string | null = null;
    let consolationItemId: string | null = null;
    let selectedExpertDef: DbSkillDefinition | null | undefined = null;

    if (success) {
      const expPool = await getSkillPoolForTier(c.env.DB, "expert");
      if (expPool.length > 0) {
        const idx = secureRandomInt(expPool.length);
        selectedExpertDef = expPool[idx];
        outputItemId = id("item");
      }
    } else {
      // Consolation: random Advanced
      const advPool = await getSkillPoolForTier(c.env.DB, "advanced");
      if (advPool.length > 0) {
        const idx = secureRandomInt(advPool.length);
        const consDef: DbSkillDefinition | undefined = advPool[idx];
        consolationItemId = id("item");
      }
    }

    // Execute batch
    const statements: any[] = [];
    const eventAfter: any = { success, pityBefore: currentPity, pityAfter, gpCost };

    // Burn input cards
    for (const cardId of inventoryItemIds) {
      statements.push(
        c.env.DB.prepare(
          "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
        ).bind(cardId, user.id)
      );
    }

    // GP deduction
    statements.push(
      ledger(c.env.DB, user.id, agent.id, "skill_economy_spend", "pending_points", -gpCost, null, `skill_synthesis_expert_spend|${opId}`, { operationId: opId })
    );

    // Create output item (success)
    if (success && outputItemId && selectedExpertDef) {
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, skill_definition_id, metadata_json)
           VALUES (?, ?, 'skill_card', ?, 'legendary', 'available', 1, 0, ?, ?)`
        ).bind(outputItemId, user.id, selectedExpertDef.name, selectedExpertDef.id,
          JSON.stringify({ source: "synthesis_advanced_to_expert", tier: "expert" })
        )
      );
      eventAfter.outputItemId = outputItemId;
      eventAfter.skillDefinitionId = selectedExpertDef.id;
      eventAfter.skillName = selectedExpertDef.name;
    }

    // Consolation (failure)
    if (!success && consolationItemId) {
      const advPool = await getSkillPoolForTier(c.env.DB, "advanced");
      // The pool always has at least 1 entry because of the length check above
    if (advPool.length > 0) {
      const idx = secureRandomInt(advPool.length);
      const consDef: DbSkillDefinition = advPool[idx]!;
      const consStmt = c.env.DB.prepare(`INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, skill_definition_id, metadata_json) VALUES (?, ?, 'skill_card', ?, 'epic', 'available', 1, 0, ?, ?)`);
      statements.push(
        consStmt.bind(consolationItemId, user.id, consDef.name, consDef.id, JSON.stringify({ source: "synthesis_advanced_to_expert_consolation", tier: "advanced" }))
      );
      eventAfter.consolationItemId = consolationItemId;
      eventAfter.consolationSkillDefinitionId = consDef.id;
    }

    // Update pity (conditional on version)
    if (pityRow) {
      statements.push(
        c.env.DB.prepare(
          `UPDATE skill_synthesis_pity SET pity_count = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND version = ?`
        ).bind(pityAfter, user.id, currentVersion)
      );
    } else {
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO skill_synthesis_pity (user_id, pity_count, version) VALUES (?, ?, 1)`
        ).bind(user.id, pityAfter)
      );
    }

    // Update operation
    statements.push(
      c.env.DB.prepare(
        `UPDATE skill_synthesis_operations SET status = 'completed', output_item_id = ?, success = ?, pity_before = ?, pity_after = ?, result_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(outputItemId || consolationItemId, success ? 1 : 0, currentPity, pityAfter, JSON.stringify(eventAfter), opId)
    );

    // Audit events
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO skill_economy_events (id, user_id, agent_id, event_type, inventory_item_id, before_json, after_json)
         VALUES (?, ?, ?, 'synthesis_input_consumed', ?, ?, ?)`
      ).bind(id("see"), user.id, agent.id, null,
        JSON.stringify({ inputItems: inventoryItemIds }),
        JSON.stringify({ synthesisType: "advanced_to_expert" })
      )
    );

    statements.push(
      c.env.DB.prepare(
        `INSERT INTO skill_economy_events (id, user_id, agent_id, event_type, inventory_item_id, before_json, after_json)
         VALUES (?, ?, ?, 'synthesis_result', ?, ?, ?)`
      ).bind(id("see"), user.id, agent.id, outputItemId || consolationItemId,
        JSON.stringify({ pityBefore: currentPity, pityAfter: success ? 0 : currentPity + 1 }),
        JSON.stringify(eventAfter)
      )
    );

    if (isPityTriggered) {
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO skill_economy_events (id, user_id, agent_id, event_type, before_json, after_json)
           VALUES (?, ?, ?, 'pity_triggered', ?, ?)`
        ).bind(id("see"), user.id, agent.id,
          JSON.stringify({ pityBefore: currentPity }),
          JSON.stringify({ pityAfter: 0, guaranteed: true })
        )
      );
    }

    try {
      const results = await c.env.DB.batch(statements);
      for (let i = 0; i < 5; i++) {
        if (results[i]?.meta?.changes !== 1) {
          throw new Error(`Card burn failed at index ${i}`);
        }
      }
    } catch (err: any) {
      await c.env.DB.prepare(
        `UPDATE skill_synthesis_operations SET status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(err.message?.slice(0, 500) || "batch_failed", opId).run();
      return c.json({ error: "synthesis_failed", message: err.message || "Batch execution failed." }, 500);
    }

    return c.json({
      result: {
        operationId: opId,
        success,
        outputItemId: outputItemId || undefined,
        consolationItemId: consolationItemId || undefined,
        skillDefinitionId: selectedExpertDef?.id || undefined,
        skillName: selectedExpertDef?.name || undefined,
        pityBefore: currentPity,
        pityAfter,
        gpCost,
      },
    });
  }
  });

  // ====================================================================
  // GET /skills/synthesis/status
  // ====================================================================
  app.get("/skills/synthesis/status", async (c) => {
    const user = await requireUser(c);

    const pityRow = await c.env.DB.prepare(
      "SELECT pity_count FROM skill_synthesis_pity WHERE user_id = ?"
    ).bind(user.id).first<{ pity_count: number }>();

    const synthCounts = await c.env.DB.prepare(
      "SELECT synthesis_type, COUNT(*) AS count FROM skill_synthesis_operations WHERE user_id = ? AND status = 'completed' GROUP BY synthesis_type"
    ).bind(user.id).all<{ synthesis_type: string; count: number }>();

    const normalCount = synthCounts.results.find(r => r.synthesis_type === "normal_to_advanced")?.count ?? 0;
    const expertCount = synthCounts.results.find(r => r.synthesis_type === "advanced_to_expert")?.count ?? 0;

    return c.json({
      pityCount: pityRow?.pity_count ?? 0,
      totalNormalToAdvanced: normalCount,
      totalAdvancedToExpert: expertCount,
    });
  });

  // ====================================================================
  // POST /agents/:agentId/skills/:learnedSkillId/upgrade
  // ====================================================================
  app.post("/agents/:agentId/skills/:learnedSkillId/upgrade", async (c) => {
    const user = await requireUser(c);
    const { agentId, learnedSkillId } = c.req.param();

    const agent = await c.env.DB.prepare("SELECT * FROM agents WHERE id = ? AND user_id = ?").bind(agentId, user.id).first<DbAgent>();
    if (!agent) return c.json({ error: "agent_not_found" }, 404);

    const body = await c.req.json().catch(() => ({}));
    const inventoryItemId = body.inventoryItemId;
    const idempotencyKey = body.idempotencyKey || `${user.id}:${agentId}:upgrade:${learnedSkillId}`;
    const bodyStr = JSON.stringify(body);
    const requestHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bodyStr)).then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join(""));

    if (!inventoryItemId) return c.json({ error: "inventory_item_required" }, 400);

    // Check idempotency
    const existing = await reservePendingOperation(c.env.DB, "skill_upgrade_operations", user.id, idempotencyKey, requestHash);
    if (existing) {
      if (existing.conflict) return c.json({ error: "idempotency_conflict" }, 409);
      if (existing.existingStatus === "completed") return c.json({ result: existing.existingResult, idempotent: true });
      if (existing.existingStatus === "pending") return c.json({ error: "operation_in_progress" }, 409);
      if (existing.existingStatus === "failed") return c.json({ error: "previous_operation_failed" }, 400);
    }

    // Get learned skill
    const learnedSkill = await c.env.DB.prepare(
      "SELECT * FROM agent_learned_skills WHERE id = ? AND agent_id = ? AND status = 'active'"
    ).bind(learnedSkillId, agentId).first<DbLearnedSkill>();
    if (!learnedSkill) return c.json({ error: "skill_not_found" }, 404);

    if (learnedSkill.skill_level >= 5) return c.json({ error: "max_level_reached" }, 400);

    // Get skill definition for tier multiplier
    const skillDef = await c.env.DB.prepare(
      "SELECT * FROM agent_skill_definitions WHERE id = ?"
    ).bind(learnedSkill.skill_definition_id).first<DbSkillDefinition>();
    if (!skillDef) return c.json({ error: "definition_not_found" }, 500);

    if (skillDef.is_core) return c.json({ error: "cannot_upgrade_core" }, 400);

    // Verify card
    const card = await c.env.DB.prepare(
      "SELECT * FROM inventory_items WHERE id = ? AND owner_user_id = ? AND status = 'available' AND item_type = 'skill_card' AND skill_definition_id = ?"
    ).bind(inventoryItemId, user.id, learnedSkill.skill_definition_id).first<DbInventoryItem>();
    if (!card) return c.json({ error: "card_not_available", message: "Same-name skill card required." }, 400);

    // Calculate cost
    const baseCost = getUpgradeBaseCost(learnedSkill.skill_level);
    const tierMult = getTierMultiplier(skillDef.tier);
    const gpCost = baseCost * tierMult;

    // Reserve operation
    const opId = id("upg");
    await c.env.DB.prepare(
      `INSERT INTO skill_upgrade_operations (id, user_id, agent_id, operation_type, learned_skill_id, from_level, to_level, consumed_inventory_item_id, gp_cost, idempotency_key, request_hash, status)
       VALUES (?, ?, ?, 'upgrade', ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(opId, user.id, agentId, learnedSkillId, learnedSkill.skill_level, learnedSkill.skill_level + 1, inventoryItemId, gpCost, idempotencyKey, requestHash).run();

    // Execute batch
    const statements: any[] = [];

    // Burn card
    statements.push(
      c.env.DB.prepare(
        "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
      ).bind(inventoryItemId, user.id)
    );

    // Update skill level
    statements.push(
      c.env.DB.prepare(
        "UPDATE agent_learned_skills SET skill_level = skill_level + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND agent_id = ? AND status = 'active' AND skill_level = ?"
      ).bind(learnedSkillId, agentId, learnedSkill.skill_level)
    );

    // GP deduction
    statements.push(
      ledger(c.env.DB, user.id, agentId, "skill_economy_spend", "pending_points", -gpCost, null, `skill_upgrade_spend|${opId}`, { operationId: opId, learnedSkillId })
    );

    // Update operation
    const resultJson = JSON.stringify({
      operationId: opId,
      learnedSkillId,
      fromLevel: learnedSkill.skill_level,
      toLevel: learnedSkill.skill_level + 1,
      gpCost,
      tier: skillDef.tier,
      tierMultiplier: tierMult,
    });
    statements.push(
      c.env.DB.prepare(
        `UPDATE skill_upgrade_operations SET status = 'completed', result_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(resultJson, opId)
    );

    // Audit
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO skill_economy_events (id, user_id, agent_id, event_type, learned_skill_id, inventory_item_id, before_json, after_json)
         VALUES (?, ?, ?, 'upgrade', ?, ?, ?, ?)`
      ).bind(id("see"), user.id, agentId, learnedSkillId, inventoryItemId,
        JSON.stringify({ fromLevel: learnedSkill.skill_level }),
        JSON.stringify({ toLevel: learnedSkill.skill_level + 1, gpCost, tier: skillDef.tier })
      )
    );

    try {
      const results = await c.env.DB.batch(statements);
      if (results[0]?.meta?.changes !== 1) throw new Error("Card not available for upgrade");
      if (results[1]?.meta?.changes !== 1) throw new Error("Skill level conflict or not found");
    } catch (err: any) {
      await c.env.DB.prepare(
        `UPDATE skill_upgrade_operations SET status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(err.message?.slice(0, 500) || "batch_failed", opId).run();
      return c.json({ error: "upgrade_failed", message: err.message }, 500);
    }

    return c.json({ result: JSON.parse(resultJson) });
  });

  // ====================================================================
  // POST /agents/:agentId/skills/reset
  // ====================================================================
  app.post("/agents/:agentId/skills/reset", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");

    const agent = await c.env.DB.prepare("SELECT * FROM agents WHERE id = ? AND user_id = ?").bind(agentId, user.id).first<DbAgent>();
    if (!agent) return c.json({ error: "agent_not_found" }, 404);

    const body = await c.req.json().catch(() => ({}));
    const resetCoreInventoryItemId = body.resetCoreInventoryItemId;
    const protectionInventoryItemId = body.protectionInventoryItemId || null;
    const protectedLearnedSkillId = body.protectedLearnedSkillId || null;
    const idempotencyKey = body.idempotencyKey || `${user.id}:${agentId}:reset:${Date.now()}`;

    if (!resetCoreInventoryItemId) return c.json({ error: "reset_core_required" }, 400);

    // Validate protection pair
    if (protectionInventoryItemId && !protectedLearnedSkillId) {
      return c.json({ error: "protection_target_required", message: "Protection target skill ID is required when using a Protection Token." }, 400);
    }
    if (protectedLearnedSkillId && !protectionInventoryItemId) {
      return c.json({ error: "protection_token_required", message: "Protection Token is required when specifying a protected skill." }, 400);
    }

    // Verify Reset Core
    const coreItem = await c.env.DB.prepare(
      "SELECT * FROM inventory_items WHERE id = ? AND owner_user_id = ? AND status = 'available' AND item_type = 'consumable' AND name = 'Reset Core'"
    ).bind(resetCoreInventoryItemId, user.id).first<DbInventoryItem>();
    if (!coreItem) return c.json({ error: "reset_core_not_available" }, 400);

    // Verify Protection Token if provided
    if (protectionInventoryItemId) {
      const tokenItem = await c.env.DB.prepare(
        "SELECT * FROM inventory_items WHERE id = ? AND owner_user_id = ? AND status = 'available' AND item_type = 'consumable' AND name = 'Skill Protection Token'"
      ).bind(protectionInventoryItemId, user.id).first<DbInventoryItem>();
      if (!tokenItem) return c.json({ error: "protection_token_not_available" }, 400);
    }

    // Verify protected skill if provided
    if (protectedLearnedSkillId) {
      const protectedSkill = await c.env.DB.prepare(
        "SELECT * FROM agent_learned_skills WHERE id = ? AND agent_id = ? AND status = 'active'"
      ).bind(protectedLearnedSkillId, agentId).first<DbLearnedSkill>();
      if (!protectedSkill) return c.json({ error: "protected_skill_not_found" }, 400);
    }

    // Check idempotency (simple: check operations table with a unique key)
    const existingOp = await c.env.DB.prepare(
      "SELECT * FROM agent_skill_operations WHERE user_id = ? AND operation_type = 'reset' AND idempotency_key = ?"
    ).bind(user.id, idempotencyKey).first<any>();
    if (existingOp) {
      if (existingOp.status === "completed") return c.json({ result: parseJson(existingOp.result_json, {}), idempotent: true });
      if (existingOp.status === "failed") return c.json({ error: "previous_operation_failed" }, 400);
    }

    // Build candidate list: active, unlocked, not protected
    const allSkills = await c.env.DB.prepare(
      "SELECT * FROM agent_learned_skills WHERE agent_id = ? AND status = 'active'"
    ).bind(agentId).all<DbLearnedSkill>();

    const candidates = allSkills.results.filter((s) => {
      if (s.locked) return false;
      if (protectedLearnedSkillId && s.id === protectedLearnedSkillId) return false;
      return true;
    });

    if (candidates.length === 0) {
      return c.json({ error: "no_replaceable_skills", message: "No unlocked, unprotected skills to reset." }, 400);
    }

    // Select random candidate
    const targetIdx = secureRandomInt(candidates.length);
    const targetSkill: DbLearnedSkill = candidates[targetIdx]!;

    // Get current skill definition
    const oldDef = await c.env.DB.prepare("SELECT * FROM agent_skill_definitions WHERE id = ?").bind(targetSkill.skill_definition_id).first<DbSkillDefinition>();

    // Draw new skill: tier first, then specific definition
    const resetTierWeights: DropEntry[] = [
      { rewardType: "normal", weight: 750000 },
      { rewardType: "advanced", weight: 230000 },
      { rewardType: "expert", weight: 20000 },
    ];

    const testTierOverride = await getTestDrawOverride(c, "reset_tier");
    let drawnTier = "normal";
    if (testTierOverride === "normal" || testTierOverride === "advanced" || testTierOverride === "expert") {
      drawnTier = testTierOverride;
    } else {
      const tierResult = weightedDraw(resetTierWeights);
      drawnTier = tierResult.rewardType;
    }

    const newSkillPick = await pickRandomSkillDefinition(c.env.DB, drawnTier, agentId, 5);
    if (!newSkillPick.skillDef) {
      return c.json({ error: "no_valid_skill", message: "Could not find a valid replacement skill." }, 500);
    }

    // Execute batch
    const opResetId = id("sop");
    const statements: any[] = [];
    const gpCost = 200;

    // Consume Reset Core
    statements.push(
      c.env.DB.prepare(
        "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
      ).bind(resetCoreInventoryItemId, user.id)
    );

    // Consume Protection Token if provided
    if (protectionInventoryItemId) {
      statements.push(
        c.env.DB.prepare(
          "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
        ).bind(protectionInventoryItemId, user.id)
      );
    }

    // Mark old skill as replaced
    statements.push(
      c.env.DB.prepare(
        "UPDATE agent_learned_skills SET status = 'replaced', replaced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND agent_id = ? AND status = 'active'"
      ).bind(targetSkill.id, agentId)
    );

    // Insert new skill in same slot
    const newLearnedSkillId = id("ls");
    statements.push(
      c.env.DB.prepare(
        "INSERT INTO agent_learned_skills (id, agent_id, skill_definition_id, skill_level, slot_index, status, source_inventory_item_id) VALUES (?, ?, ?, 1, ?, 'active', ?)"
      ).bind(newLearnedSkillId, agentId, newSkillPick.skillDef.id, targetSkill.slot_index, resetCoreInventoryItemId)
    );

    // GP deduction
    statements.push(
      ledger(c.env.DB, user.id, agentId, "skill_economy_spend", "pending_points", -gpCost, null, `skill_reset_spend|${opResetId}`, { operationId: opResetId })
    );

    // Record operation
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO agent_skill_operations (id, user_id, agent_id, operation_type, idempotency_key, learned_skill_id, replaced_learned_skill_id, consumed_inventory_item_id, consumed_protection_item_id, result_json, status)
         VALUES (?, ?, ?, 'reset', ?, ?, ?, ?, ?, ?, 'completed')`
      ).bind(opResetId, user.id, agentId, idempotencyKey, newLearnedSkillId, targetSkill.id, resetCoreInventoryItemId,
        protectionInventoryItemId || null,
        JSON.stringify({
          operationId: opResetId,
          replacedSkillId: targetSkill.id,
          replacedSkillDefinitionId: targetSkill.skill_definition_id,
          newSkillId: newLearnedSkillId,
          newSkillDefinitionId: newSkillPick.skillDef.id,
          newSkillName: newSkillPick.skillDef.name,
          drawnTier,
          gpCost,
        })
      )
    );

    // Audit
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO skill_economy_events (id, user_id, agent_id, event_type, learned_skill_id, inventory_item_id, slot_index, before_json, after_json)
         VALUES (?, ?, ?, 'reset', ?, ?, ?, ?, ?)`
      ).bind(id("see"), user.id, agentId, newLearnedSkillId, resetCoreInventoryItemId, targetSkill.slot_index,
        JSON.stringify({ replacedSkillId: targetSkill.id, oldSkillDefId: targetSkill.skill_definition_id, oldSkillName: oldDef?.name }),
        JSON.stringify({ newSkillDefId: newSkillPick.skillDef.id, newSkillName: newSkillPick.skillDef.name, drawnTier, gpCost })
      )
    );

    try {
      const results = await c.env.DB.batch(statements);
      if (results[0]?.meta?.changes !== 1) throw new Error("Reset Core not available");
      if (results[protectionInventoryItemId ? 2 : 1]?.meta?.changes !== 1) throw new Error("Old skill not found or already replaced");
    } catch (err: any) {
      return c.json({ error: "reset_failed", message: err.message || "Reset operation failed." }, 500);
    }

    return c.json({
      result: {
        operationId: opResetId,
        replacedSkillId: targetSkill.id,
        replacedSkillName: oldDef?.name || "Unknown",
        newLearnedSkillId,
        newSkillDefinitionId: newSkillPick.skillDef.id,
        newSkillName: newSkillPick.skillDef.name,
        slotIndex: targetSkill.slot_index,
        drawnTier,
        gpCost,
        protectionTokenUsed: !!protectionInventoryItemId,
      },
    });
  });

  // ====================================================================
  // GET /agents/:agentId/skill-economy-events
  // ====================================================================
  app.get("/agents/:agentId/skill-economy-events", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");

    const agent = await c.env.DB.prepare("SELECT user_id FROM agents WHERE id = ?").bind(agentId).first<any>();
    if (!agent || agent.user_id !== user.id) return c.json({ error: "forbidden" }, 403);

    const rows = await c.env.DB.prepare(
      "SELECT * FROM skill_economy_events WHERE agent_id = ? ORDER BY created_at DESC LIMIT 50"
    ).bind(agentId).all<DbSkillEconomyEvent>();

    return c.json({ events: rows.results.map(toSkillEconomyEvent) });
  });

  // ====================================================================
  // POST /inventory/:inventoryItemId/use (Energy Recovery, etc.)
  // ====================================================================
  app.post("/inventory/:inventoryItemId/use", async (c) => {
    const user = await requireUser(c);
    const { inventoryItemId } = c.req.param();

    const item = await c.env.DB.prepare(
      "SELECT * FROM inventory_items WHERE id = ? AND owner_user_id = ? AND status = 'available'"
    ).bind(inventoryItemId, user.id).first<DbInventoryItem>();

    if (!item) return c.json({ error: "item_not_available" }, 400);

    if (item.item_type !== "consumable") {
      return c.json({ error: "not_consumable", message: "Only consumable items can be used." }, 400);
    }

    const agent = await getAgent(c.env.DB, user.id);
    if (!agent) return c.json({ error: "no_agent" }, 400);

    const meta = parseJson<Record<string, unknown>>(item.metadata_json, {});

    // Handle Energy Recovery
    if (item.name === "Energy Recovery") {
      const energyAmount = typeof meta.energyAmount === "number" ? meta.energyAmount : 50;
      const newEnergy = Math.min(agent.max_energy, agent.energy + energyAmount);

      const statements: any[] = [];

      // Burn consumable
      statements.push(
        c.env.DB.prepare(
          "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
        ).bind(inventoryItemId, user.id)
      );

      // Add energy
      statements.push(
        c.env.DB.prepare(
          "UPDATE agents SET energy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
        ).bind(newEnergy, agent.id, user.id)
      );

      // Ledger
      statements.push(
        ledger(c.env.DB, user.id, agent.id, "consumable_use", "energy", energyAmount, null, `energy_recovery|${inventoryItemId}`, { itemId: inventoryItemId })
      );

      // Audit
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO skill_economy_events (id, user_id, agent_id, event_type, inventory_item_id, before_json, after_json)
           VALUES (?, ?, ?, 'consumable_use', ?, ?, ?)`
        ).bind(id("see"), user.id, agent.id, inventoryItemId,
          JSON.stringify({ itemName: item.name, energyBefore: agent.energy }),
          JSON.stringify({ energyAdded: energyAmount, energyAfter: newEnergy })
        )
      );

      try {
        const results = await c.env.DB.batch(statements);
        if (results[0]?.meta?.changes !== 1) throw new Error("Item not available");
      } catch (err: any) {
        return c.json({ error: "use_failed", message: err.message }, 500);
      }

      return c.json({ result: { used: true, itemName: item.name, energyAdded: energyAmount, energyAfter: newEnergy } });
    }

    return c.json({ error: "unusable_item", message: "This item cannot be used." }, 400);
  });
}

// =====================================================================
// TEST DRAW OVERRIDE HELPERS
// =====================================================================

export async function getTestDrawOverride(
  c: AppContext,
  type: string
): Promise<string | null> {
  const user = await requireUser(c).catch(() => null);
  if (!user) return null;

  const allowedTypes = ["skill_box_reward_type", "skill_definition", "reset_tier", "synthesis_result"];
  if (!allowedTypes.includes(type)) return null;

  const key = `test:force_draw:${user.id}:${type}`;
  const value = await c.env.KV.get(key);
  if (value) {
    await c.env.KV.delete(key); // one-time use
    return value;
  }
  return null;
}

// =====================================================================
// SKILL BOX TWO-STAGE DRAW (called from store.ts)
// =====================================================================

export async function resolveSkillBoxReward(
  db: D1Database,
  userId: string,
  agentId: string,
  openingId: string,
  dropEntries: DbBoxDropItem[],
  testOverride?: string | null
): Promise<{
  statements: any[];
  rewards: Array<{ type: string; name: string; rarity: string; itemId?: string; amount?: number }>;
  auditData: Record<string, any>;
}> {
  const statements: any[] = [];
  const rewards: Array<{ type: string; name: string; rarity: string; itemId?: string; amount?: number }> = [];
  const auditData: Record<string, any> = {};

  // Parse drop entries into reward type weights
  const dropTypeEntries: DropEntry[] = (dropEntries || [])
    .filter((d: any) => d.guaranteed === 0)
    .map((d: any) => {
      const meta = parseJson<{ rewardType?: string }>(d.metadata_json, {});
      return {
        rewardType: meta.rewardType || d.asset_name,
        weight: d.weight,
      };
    });

  if (dropTypeEntries.length === 0) {
    throw new Error("invalid_drop_config");
  }

  // Stage 1: weighted draw on reward type
  const stage1 = weightedDraw(dropTypeEntries, testOverride);
  const rewardType = stage1.rewardType;

  auditData.rollInteger = stage1.rollInteger;
  auditData.weightTotal = dropTypeEntries.reduce((s: number, e: DropEntry) => s + e.weight, 0);
  auditData.selectedRange = stage1.selectedRange;
  auditData.selectedRewardType = rewardType;
  auditData.testOverrideUsed = !!testOverride;

  switch (rewardType) {
    case "normal_skill":
    case "advanced_skill": {
      const tier = rewardType === "normal_skill" ? "normal" : "advanced";
      const pool = await db.prepare(
        `SELECT * FROM agent_skill_definitions WHERE status = 'enabled' AND is_core = 0 AND tier = ?`
      ).bind(tier).all<DbSkillDefinition>();

      if (!pool.results || pool.results.length === 0) throw new Error("no_skills_available");

      const idx = secureRandomInt(pool.results.length);
      const def: DbSkillDefinition = pool.results[idx]!;
      const itemId = id("item");

      // Do NOT exclude agent's active skills — same-name cards needed for upgrade

      statements.push(
        db.prepare(
          `INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, skill_definition_id, metadata_json)
           VALUES (?, ?, 'skill_card', ?, ?, 'available', 1, 0, ?, ?)`
        ).bind(
          itemId, userId,
          def.name, tier === "advanced" ? "epic" : "rare",
          def.id,
          JSON.stringify({ source: "skill_box", tier, category: def.category })
        )
      );

      rewards.push({ type: "skill_card", name: def.name, rarity: tier === "advanced" ? "epic" : "rare", itemId });
      auditData.selectedSkillDefinitionId = def.id;
      auditData.skillName = def.name;
      break;
    }

    case "reset_core": {
      const itemId = id("item");
      statements.push(
        db.prepare(
          `INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, metadata_json)
           VALUES (?, ?, 'consumable', 'Reset Core', 'rare', 'available', 0, 1, ?)`
        ).bind(itemId, userId, JSON.stringify({ source: "skill_box", rewardType: "reset_core" }))
      );
      rewards.push({ type: "consumable", name: "Reset Core", rarity: "rare", itemId });
      break;
    }

    case "protection_token": {
      const itemId = id("item");
      statements.push(
        db.prepare(
          `INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, metadata_json)
           VALUES (?, ?, 'consumable', 'Skill Protection Token', 'rare', 'available', 0, 1, ?)`
        ).bind(itemId, userId, JSON.stringify({ source: "skill_box", rewardType: "protection_token" }))
      );
      rewards.push({ type: "consumable", name: "Skill Protection Token", rarity: "rare", itemId });
      break;
    }

    case "energy_recovery": {
      const itemId = id("item");
      statements.push(
        db.prepare(
          `INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, metadata_json)
           VALUES (?, ?, 'consumable', 'Energy Recovery', 'common', 'available', 0, 0, ?)`
        ).bind(itemId, userId, JSON.stringify({ source: "skill_box", rewardType: "energy_recovery", energyAmount: 50 }))
      );
      rewards.push({ type: "consumable", name: "Energy Recovery", rarity: "common", itemId });
      break;
    }

    case "gp_small": {
      const pointAmount = 50;
      statements.push(
        ledger(db, userId, agentId, "skill_box_reward", "pending_points", pointAmount, null, `skill_box_gp_small|${openingId}`, { openingId, rewardType: "gp_small" })
      );
      rewards.push({ type: "pending_points", name: `${pointAmount} GP`, amount: pointAmount, rarity: "common" });
      auditData.pointAmount = pointAmount;
      break;
    }

    default:
      throw new Error("invalid_drop_config");
  }

  return { statements, rewards, auditData };
}
