import { Hono, Context } from "hono";
import {
  Bindings,
  requireUser,
  requireTestMode,
  id,
  getAgent,
  ledger,
  legacyPendingPointsLedger,
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
// Legacy compatibility-only: these recovery paths still inspect GP-era
// point_ledger_events and gp_cost columns so existing skill operations can be
// reconciled. New real-asset work must use AssetLedgerEvent / intent evidence.
// =====================================================================

const PENDING_TIMEOUT_MS = 30_000;

async function recoverSynthesisOperation(db: D1Database, op: any): Promise<any> {
  const opId = op.id;
  const userId = op.user_id;

  const ledgerRow = await db.prepare(
    "SELECT * FROM point_ledger_events WHERE user_id = ? AND (source_id = ? OR source_id = ?)"
  ).bind(userId, `skill_synthesis_normal_spend|${opId}`, `skill_synthesis_expert_spend|${opId}`).first<any>();

  const matchingSee = await db.prepare(
    "SELECT * FROM skill_economy_events WHERE operation_id = ? AND event_type = 'synthesis_result'"
  ).bind(opId).first<any>();

  const inputIds = parseJson<string[]>(op.input_item_ids, []);
  const inputItems = inputIds.length > 0 ? (await db.prepare(
    `SELECT id, status FROM inventory_items WHERE id IN (${inputIds.map(() => "?").join(",")})`
  ).bind(...inputIds).all<any>()).results : [];

  const allInputsAvailable = inputItems.length > 0 && inputItems.every((item: any) => item.status === "available");
  const allInputsBurned = inputItems.length > 0 && inputItems.every((item: any) => item.status === "burned");

  const claimRows = await db.prepare(
    "SELECT * FROM skill_economy_item_consumptions WHERE operation_id = ?"
  ).bind(opId).all<any>();
  const expectedClaimsCount = op.synthesis_type === "normal_to_advanced" ? 3 : 5;
  const claimsMatch = claimRows.results.length === expectedClaimsCount;
  const noClaims = claimRows.results.length === 0;

  const afterObj = matchingSee ? parseJson<any>(matchingSee.after_json, {}) : {};
  const outputItemId = op.output_item_id || afterObj.outputItemId || afterObj.consolationItemId || null;
  const outputRow = outputItemId ? await db.prepare(
    "SELECT * FROM inventory_items WHERE id = ? AND owner_user_id = ?"
  ).bind(outputItemId, userId).first<any>() : null;
  const outputExists = !!outputRow;

  const isFullSuccess = ledgerRow && matchingSee && allInputsBurned && claimsMatch && outputExists;
  const isFullFailure = !ledgerRow && !matchingSee && allInputsAvailable && noClaims && !outputExists;

  if (isFullSuccess) {
    const resultJson = matchingSee.after_json;
    const afterObj = parseJson<any>(resultJson, {});
    const outputItemId = afterObj.outputItemId || afterObj.consolationItemId || null;
    const successVal = afterObj.success !== undefined ? (afterObj.success ? 1 : 0) : 1;
    const pityBeforeVal = afterObj.pityBefore || 0;
    const pityAfterVal = afterObj.pityAfter || 0;

    await db.prepare(
      `UPDATE skill_synthesis_operations
       SET status = 'completed', output_item_id = ?, success = ?, pity_before = ?, pity_after = ?, result_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(outputItemId, successVal, pityBeforeVal, pityAfterVal, resultJson, opId).run();
    return { ...op, status: "completed", result_json: resultJson };
  } else if (isFullFailure) {
    await db.prepare(
      `UPDATE skill_synthesis_operations
       SET status = 'failed', last_error = 'timeout', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(opId).run();
    return { ...op, status: "failed" };
  } else {
    await db.prepare(
      `UPDATE skill_synthesis_operations
       SET status = 'reconciliation_required', last_error = 'mismatched_side_effects', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(opId).run();
    return { ...op, status: "reconciliation_required" };
  }
}

async function recoverUpgradeOperation(db: D1Database, op: any): Promise<any> {
  const opId = op.id;
  const userId = op.user_id;

  const ledgerRow = await db.prepare(
    "SELECT * FROM point_ledger_events WHERE user_id = ? AND source_id = ?"
  ).bind(userId, `skill_upgrade_spend|${opId}`).first<any>();

  const matchingSee = await db.prepare(
    "SELECT * FROM skill_economy_events WHERE operation_id = ? AND event_type = 'upgrade'"
  ).bind(opId).first<any>();

  const cardItem = op.consumed_inventory_item_id ? await db.prepare(
    "SELECT status FROM inventory_items WHERE id = ?"
  ).bind(op.consumed_inventory_item_id).first<any>() : null;
  const cardAvailable = !cardItem || cardItem.status === "available";
  const cardBurned = cardItem && cardItem.status === "burned";

  const claimRows = await db.prepare(
    "SELECT * FROM skill_economy_item_consumptions WHERE operation_id = ?"
  ).bind(opId).all<any>();
  const claimsMatch = claimRows.results.length === 1 && claimRows.results[0].inventory_item_id === op.consumed_inventory_item_id;
  const noClaims = claimRows.results.length === 0;

  const isFullSuccess = ledgerRow && matchingSee && cardBurned && claimsMatch;
  const isFullFailure = !ledgerRow && !matchingSee && cardAvailable && noClaims;

  if (isFullSuccess) {
    const afterObj = parseJson<any>(matchingSee.after_json, {});
    const beforeObj = parseJson<any>(matchingSee.before_json, {});
    
    const resultJson = JSON.stringify({
      operationId: opId,
      learnedSkillId: op.learned_skill_id,
      fromLevel: beforeObj.fromLevel || op.from_level,
      toLevel: afterObj.toLevel || op.to_level,
      gpCost: op.gp_cost,
      tier: afterObj.tier,
      tierMultiplier: afterObj.tierMultiplier,
    });

    await db.prepare(
      `UPDATE skill_upgrade_operations
       SET status = 'completed', result_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(resultJson, opId).run();
    return { ...op, status: "completed", result_json: resultJson };
  } else if (isFullFailure) {
    await db.prepare(
      `UPDATE skill_upgrade_operations
       SET status = 'failed', last_error = 'timeout', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(opId).run();
    return { ...op, status: "failed" };
  } else {
    await db.prepare(
      `UPDATE skill_upgrade_operations
       SET status = 'reconciliation_required', last_error = 'mismatched_side_effects', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(opId).run();
    return { ...op, status: "reconciliation_required" };
  }
}

async function recoverResetOperation(db: D1Database, op: any): Promise<any> {
  const opId = op.id;
  const userId = op.user_id;

  const ledgerRow = await db.prepare(
    "SELECT * FROM point_ledger_events WHERE user_id = ? AND source_id = ?"
  ).bind(userId, `skill_reset_spend|${opId}`).first<any>();

  const matchingSee = await db.prepare(
    "SELECT * FROM skill_economy_events WHERE operation_id = ? AND event_type = 'reset'"
  ).bind(opId).first<any>();

  const coreItem = await db.prepare(
    "SELECT status FROM inventory_items WHERE id = ?"
  ).bind(op.consumed_inventory_item_id).first<any>();
  const coreAvailable = coreItem && coreItem.status === "available";
  const coreBurned = coreItem && coreItem.status === "burned";

  const protItem = op.consumed_protection_item_id ? await db.prepare(
    "SELECT status FROM inventory_items WHERE id = ?"
  ).bind(op.consumed_protection_item_id).first<any>() : null;
  const protAvailable = !protItem || protItem.status === "available";
  const protBurned = protItem && protItem.status === "burned";

  const claimRows = await db.prepare(
    "SELECT * FROM skill_economy_item_consumptions WHERE operation_id = ?"
  ).bind(opId).all<any>();
  const expectedClaimsCount = op.consumed_protection_item_id ? 2 : 1;
  const claimsMatch = claimRows.results.length === expectedClaimsCount;
  const noClaims = claimRows.results.length === 0;

  const isFullSuccess = ledgerRow && matchingSee && coreBurned && (!op.consumed_protection_item_id || protBurned) && claimsMatch;
  const isFullFailure = !ledgerRow && !matchingSee && coreAvailable && protAvailable && noClaims;

  if (isFullSuccess) {
    const beforeObj = parseJson<any>(matchingSee.before_json, {});
    const afterObj = parseJson<any>(matchingSee.after_json, {});
    
    const resultJson = JSON.stringify({
      operationId: opId,
      replacedSkillId: beforeObj.replacedSkillId,
      replacedSkillDefinitionId: beforeObj.oldSkillDefId,
      newSkillId: matchingSee.learned_skill_id,
      newSkillDefinitionId: afterObj.newSkillDefId,
      newSkillName: afterObj.newSkillName,
      drawnTier: afterObj.drawnTier,
      gpCost: afterObj.gpCost || 200,
    });

    await db.prepare(
      `UPDATE agent_skill_reset_operations
       SET status = 'completed', result_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(resultJson, opId).run();
    return { ...op, status: "completed", result_json: resultJson };
  } else if (isFullFailure) {
    await db.prepare(
      `UPDATE agent_skill_reset_operations
       SET status = 'failed', last_error = 'timeout', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(opId).run();
    return { ...op, status: "failed" };
  } else {
    await db.prepare(
      `UPDATE agent_skill_reset_operations
       SET status = 'reconciliation_required', last_error = 'mismatched_side_effects', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(opId).run();
    return { ...op, status: "reconciliation_required" };
  }
}

async function recoverPendingOperation(db: D1Database, tableName: string, op: any): Promise<any> {
  if (tableName === "skill_synthesis_operations") {
    return recoverSynthesisOperation(db, op);
  } else if (tableName === "skill_upgrade_operations") {
    return recoverUpgradeOperation(db, op);
  } else if (tableName === "agent_skill_reset_operations") {
    return recoverResetOperation(db, op);
  }
  return op;
}

async function reservePendingOperation(
  db: D1Database,
  tableName: string,
  insertQuery: string,
  insertParams: any[],
  selectQuery: string,
  selectParams: any[],
  requestHash: string
): Promise<{
  conflict: boolean;
  reserved: boolean;
  status?: string;
  result?: any;
  error?: string;
}> {
  try {
    await db.prepare(insertQuery).bind(...insertParams).run();
    return { conflict: false, reserved: true };
  } catch (err: any) {
    const existing = await db.prepare(selectQuery).bind(...selectParams).first<any>();
    if (!existing) {
      throw err;
    }
    const opStatus = existing.status;
    if (existing.request_hash !== requestHash) {
      return { conflict: true, reserved: false, error: "idempotency_conflict" };
    }
    if (opStatus === "completed") {
      return { conflict: false, reserved: false, status: "completed", result: parseJson(existing.result_json, {}) };
    }
    if (opStatus === "pending") {
      const age = Date.now() - new Date(existing.created_at + "Z").getTime();
      if (age >= PENDING_TIMEOUT_MS) {
        const recovered = await recoverPendingOperation(db, tableName, existing);
        if (recovered.status === "completed") {
          return { conflict: false, reserved: false, status: "completed", result: parseJson(recovered.result_json, {}) };
        }
        if (recovered.status === "failed") {
          return { conflict: false, reserved: false, status: "failed", error: "previous_operation_failed" };
        }
        if (recovered.status === "reconciliation_required") {
          return { conflict: true, reserved: false, status: "reconciliation_required", error: "reconciliation_required" };
        }
      }
      return { conflict: true, reserved: false, status: "pending", error: "operation_in_progress" };
    }
    if (opStatus === "failed") {
      return { conflict: false, reserved: false, status: "failed", error: "previous_operation_failed" };
    }
    if (opStatus === "reconciliation_required") {
      return { conflict: true, reserved: false, status: "reconciliation_required", error: "reconciliation_required" };
    }
    return { conflict: true, reserved: false, error: "unknown_status" };
  }
}

// =====================================================================
// SKILL DEFINITION POOL HELPERS
// =====================================================================

async function getSkillPoolForPoolCode(
  db: D1Database,
  poolCode: string,
  excludeAgentId?: string
): Promise<Array<DbSkillDefinition & { drop_weight: number; synthesis_weight: number }>> {
  let query = "";
  const params: any[] = [];

  if (poolCode === "normal_synthesis_advanced_v1" || poolCode === "expert_failure_consolation_v1") {
    query = `
      SELECT sd.*, r.drop_weight, r.synthesis_weight
      FROM agent_skill_definitions sd
      JOIN skill_acquisition_rules r ON r.skill_definition_id = sd.id
      WHERE sd.tier = 'advanced'
        AND sd.status = 'enabled'
        AND r.release_status = 'released'
        AND r.available_in_normal_synthesis = 1
    `;
  } else if (poolCode === "expert_synthesis_expert_v1") {
    query = `
      SELECT sd.*, r.drop_weight, r.synthesis_weight
      FROM agent_skill_definitions sd
      JOIN skill_acquisition_rules r ON r.skill_definition_id = sd.id
      WHERE sd.tier = 'expert'
        AND sd.status = 'enabled'
        AND r.release_status IN ('released', 'advanced_unlock')
        AND r.available_in_expert_synthesis = 1
    `;
  } else if (poolCode.startsWith("reset_")) {
    const tier = poolCode.split("_")[1];
    query = `
      SELECT sd.*, r.drop_weight, r.synthesis_weight
      FROM agent_skill_definitions sd
      JOIN skill_acquisition_rules r ON r.skill_definition_id = sd.id
      WHERE sd.tier = ?
        AND sd.status = 'enabled'
        AND r.release_status IN ('released', 'advanced_unlock')
        AND r.available_in_reset_pool = 1
    `;
    params.push(tier);
  } else if (poolCode === "skill_box_normal_v1") {
    query = `
      SELECT sd.*, r.drop_weight, r.synthesis_weight
      FROM agent_skill_definitions sd
      JOIN skill_acquisition_rules r ON r.skill_definition_id = sd.id
      WHERE sd.tier = 'normal'
        AND sd.status = 'enabled'
        AND r.release_status = 'released'
        AND r.available_in_skill_box = 1
    `;
  } else if (poolCode === "skill_box_advanced_v1") {
    query = `
      SELECT sd.*, r.drop_weight, r.synthesis_weight
      FROM agent_skill_definitions sd
      JOIN skill_acquisition_rules r ON r.skill_definition_id = sd.id
      WHERE sd.tier = 'advanced'
        AND sd.status = 'enabled'
        AND r.release_status = 'released'
        AND r.available_in_skill_box = 1
    `;
  } else {
    throw new Error(`invalid_pool_code: ${poolCode}`);
  }

  if (excludeAgentId) {
    query += ` AND sd.id NOT IN (
      SELECT skill_definition_id FROM agent_learned_skills
      WHERE agent_id = ? AND status = 'active'
    )`;
    params.push(excludeAgentId);
  }

  const result = await db.prepare(query).bind(...params).all<any>();
  return result.results || [];
}

function drawSkillFromPool(
  skills: any[],
  weightField: "drop_weight" | "synthesis_weight"
): {
  skill: any;
  rollInteger: number;
  weightTotal: number;
  selectedRange: string;
} {
  if (skills.length === 0) {
    throw new Error("invalid_skill_pool_config");
  }
  const totalWeight = skills.reduce((s, e) => s + (e[weightField] ?? 1), 0);
  if (totalWeight <= 0) {
    throw new Error("invalid_skill_pool_config");
  }
  const roll = secureRandomInt(totalWeight);
  let cumulative = 0;
  for (const skill of skills) {
    const w = skill[weightField] ?? 1;
    cumulative += w;
    if (roll < cumulative) {
      return {
        skill,
        rollInteger: roll,
        weightTotal: totalWeight,
        selectedRange: `${cumulative - w}-${cumulative}`,
      };
    }
  }
  return {
    skill: skills[0]!,
    rollInteger: 0,
    weightTotal: totalWeight,
    selectedRange: `0-${skills[0]![weightField] ?? 1}`,
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

    const opId = id("synth");
    const gpCost = 300;

    // Check/Reserve operation using INSERT-first
    const reserve = await reservePendingOperation(
      c.env.DB,
      "skill_synthesis_operations",
      `INSERT INTO skill_synthesis_operations (id, user_id, operation_type, synthesis_type, input_item_ids, gp_cost, idempotency_key, request_hash, status)
       VALUES (?, ?, 'synthesis', 'normal_to_advanced', ?, ?, ?, ?, 'pending')`,
      [opId, user.id, JSON.stringify(inventoryItemIds), gpCost, idempotencyKey, requestHash],
      `SELECT * FROM skill_synthesis_operations WHERE user_id = ? AND idempotency_key = ?`,
      [user.id, idempotencyKey],
      requestHash
    );

    if (!reserve.reserved) {
      if (reserve.error === "idempotency_conflict") {
        return c.json({ error: "idempotency_conflict", message: "Different request body for same key." }, 409);
      }
      if (reserve.error === "reconciliation_required") {
        return c.json({ error: "reconciliation_required", message: "Operation in reconciliation_required state. Retry is blocked." }, 409);
      }
      if (reserve.status === "completed") {
        return c.json({ result: reserve.result, idempotent: true });
      }
      if (reserve.status === "pending") {
        return c.json({ error: "operation_in_progress" }, 409);
      }
      if (reserve.status === "failed") {
        return c.json({ error: "previous_operation_failed", message: "Previous operation failed. Retry with new key." }, 400);
      }
      return c.json({ error: reserve.error || "reserve_failed" }, 400);
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

    // Pick random Advanced skill
    const advPool = await getSkillPoolForPoolCode(c.env.DB, "normal_synthesis_advanced_v1");
    if (!advPool || advPool.length === 0) {
      await c.env.DB.prepare(
        `UPDATE skill_synthesis_operations SET status = 'failed', last_error = 'invalid_skill_pool_config', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(opId).run();
      return c.json({ error: "invalid_skill_pool_config", message: "No Advanced skills available in the synthesis pool." }, 500);
    }
    const drawResult = drawSkillFromPool(advPool, "synthesis_weight");
    const selectedDef: DbSkillDefinition = drawResult.skill;

    // Execute batch
    const outputItemId = id("item");
    const statements: any[] = [];

    // 1. Claim items
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO skill_economy_item_consumptions (inventory_item_id, operation_id, user_id, consumption_type)
         SELECT id, ?, owner_user_id, 'burn' FROM inventory_items
         WHERE id IN (${placeholders}) AND owner_user_id = ? AND status = 'available'`
      ).bind(opId, ...inventoryItemIds, user.id)
    );

    // 2. Assert claimed count
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
         SELECT ?, 3, COUNT(*) FROM skill_economy_item_consumptions WHERE operation_id = ?`
      ).bind(opId, opId)
    );

    // 3. Assert GP balance
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
         SELECT ?, 1, COUNT(*) FROM user_balance_snapshots WHERE user_id = ? AND pending_points_balance >= ?`
      ).bind(opId, user.id, gpCost)
    );

    // 4. Burn input cards
    for (const cardId of inventoryItemIds) {
      statements.push(
        c.env.DB.prepare(
          "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
        ).bind(cardId, user.id)
      );
    }

    // 5. Create output card
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, skill_definition_id, metadata_json)
         VALUES (?, ?, 'skill_card', ?, ?, 'available', 1, 0, ?, ?)`
      ).bind(
        outputItemId, user.id,
        selectedDef.name, selectedDef.tier === "expert" ? "legendary" : selectedDef.tier === "advanced" ? "epic" : "rare",
        selectedDef.id,
        JSON.stringify({ source: "synthesis_normal_to_advanced", tier: selectedDef.tier, operationId: opId })
      )
    );

    // 6. GP deduction
    statements.push(
      legacyPendingPointsLedger(c.env.DB, user.id, agent.id, "skill_economy_spend", -gpCost, null, `skill_synthesis_normal_spend|${opId}`, { operationId: opId })
    );

    // 7. Update operation
    statements.push(
      c.env.DB.prepare(
        `UPDATE skill_synthesis_operations SET status = 'completed', output_item_id = ?, success = 1, result_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(outputItemId, JSON.stringify({ outputItemId, skillDefinitionId: selectedDef.id, skillName: selectedDef.name, tier: selectedDef.tier, gpCost }), opId)
    );

    // 8. Audit event
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO skill_economy_events (
          id, user_id, agent_id, event_type, inventory_item_id, operation_id,
          pool_code, pool_version, roll_integer, weight_total, selected_range, selected_skill_definition_id,
          before_json, after_json
        ) VALUES (?, ?, ?, 'synthesis_result', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id("see"), user.id, agent.id, outputItemId, opId,
        "normal_synthesis_advanced_v1",
        1,
        drawResult.rollInteger,
        drawResult.weightTotal,
        drawResult.selectedRange,
        selectedDef.id,
        JSON.stringify({ inputItems: inventoryItemIds, synthesisType: "normal_to_advanced", operationId: opId }),
        JSON.stringify({ outputItemId, skillDefinitionId: selectedDef.id, skillName: selectedDef.name, tier: selectedDef.tier, gpCost })
      )
    );

    // 9. Clean validations
    statements.push(
      c.env.DB.prepare("DELETE FROM operation_validations WHERE operation_id = ?").bind(opId)
    );

    try {
      await c.env.DB.batch(statements);
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

    const opId = id("synth");
    const gpCost = 2000;

    // Check/Reserve operation using INSERT-first
    const reserve = await reservePendingOperation(
      c.env.DB,
      "skill_synthesis_operations",
      `INSERT INTO skill_synthesis_operations (id, user_id, operation_type, synthesis_type, input_item_ids, gp_cost, idempotency_key, request_hash, status)
       VALUES (?, ?, 'synthesis', 'advanced_to_expert', ?, ?, ?, ?, 'pending')`,
      [opId, user.id, JSON.stringify(inventoryItemIds), gpCost, idempotencyKey, requestHash],
      `SELECT * FROM skill_synthesis_operations WHERE user_id = ? AND idempotency_key = ?`,
      [user.id, idempotencyKey],
      requestHash
    );

    if (!reserve.reserved) {
      if (reserve.error === "idempotency_conflict") {
        return c.json({ error: "idempotency_conflict", message: "Different request body for same key." }, 409);
      }
      if (reserve.error === "reconciliation_required") {
        return c.json({ error: "reconciliation_required", message: "Operation in reconciliation_required state. Retry is blocked." }, 409);
      }
      if (reserve.status === "completed") {
        return c.json({ result: reserve.result, idempotent: true });
      }
      if (reserve.status === "pending") {
        return c.json({ error: "operation_in_progress" }, 409);
      }
      if (reserve.status === "failed") {
        return c.json({ error: "previous_operation_failed" }, 400);
      }
      return c.json({ error: reserve.error || "reserve_failed" }, 400);
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
    let selectedExpertDef: DbSkillDefinition | null = null;
    let consDef: DbSkillDefinition | null = null;
    let drawResult: any = null;

    if (success) {
      const expPool = await getSkillPoolForPoolCode(c.env.DB, "expert_synthesis_expert_v1");
      if (!expPool || expPool.length === 0) {
        await c.env.DB.prepare(
          `UPDATE skill_synthesis_operations SET status = 'failed', last_error = 'invalid_skill_pool_config', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(opId).run();
        return c.json({ error: "invalid_skill_pool_config", message: "No Expert skills available in the synthesis pool." }, 500);
      }
      drawResult = drawSkillFromPool(expPool, "synthesis_weight");
      selectedExpertDef = drawResult.skill;
      outputItemId = id("item");
    } else {
      // Consolation: random Advanced
      const advPool = await getSkillPoolForPoolCode(c.env.DB, "expert_failure_consolation_v1");
      if (!advPool || advPool.length === 0) {
        await c.env.DB.prepare(
          `UPDATE skill_synthesis_operations SET status = 'failed', last_error = 'invalid_skill_pool_config', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(opId).run();
        return c.json({ error: "invalid_skill_pool_config", message: "No Advanced skills available for consolation." }, 500);
      }
      drawResult = drawSkillFromPool(advPool, "synthesis_weight");
      consDef = drawResult.skill;
      consolationItemId = id("item");
    }

    // Execute batch
    const statements: any[] = [];
    const eventAfter: any = { success, pityBefore: currentPity, pityAfter, gpCost };

    // 1. Claim items
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO skill_economy_item_consumptions (inventory_item_id, operation_id, user_id, consumption_type)
         SELECT id, ?, owner_user_id, 'burn' FROM inventory_items
         WHERE id IN (${placeholders}) AND owner_user_id = ? AND status = 'available'`
      ).bind(opId, ...inventoryItemIds, user.id)
    );

    // 2. Assert claimed count
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
         SELECT ?, 5, COUNT(*) FROM skill_economy_item_consumptions WHERE operation_id = ?`
      ).bind(opId, opId)
    );

    // 3. Assert GP balance
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
         SELECT ?, 1, COUNT(*) FROM user_balance_snapshots WHERE user_id = ? AND pending_points_balance >= ?`
      ).bind(opId, user.id, gpCost)
    );

    // 4. Burn input cards
    for (const cardId of inventoryItemIds) {
      statements.push(
        c.env.DB.prepare(
          "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
        ).bind(cardId, user.id)
      );
    }

    // 5. GP deduction
    statements.push(
      legacyPendingPointsLedger(c.env.DB, user.id, agent.id, "skill_economy_spend", -gpCost, null, `skill_synthesis_expert_spend|${opId}`, { operationId: opId })
    );

    // 6. Create output item (success)
    if (success && outputItemId && selectedExpertDef) {
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, skill_definition_id, metadata_json)
           VALUES (?, ?, 'skill_card', ?, 'legendary', 'available', 1, 0, ?, ?)`
        ).bind(outputItemId, user.id, selectedExpertDef.name, selectedExpertDef.id,
          JSON.stringify({ source: "synthesis_advanced_to_expert", tier: "expert", operationId: opId })
        )
      );
      eventAfter.outputItemId = outputItemId;
      eventAfter.skillDefinitionId = selectedExpertDef.id;
      eventAfter.skillName = selectedExpertDef.name;
    }

    // Consolation (failure)
    if (!success && consolationItemId && consDef) {
      const consStmt = c.env.DB.prepare(`INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, skill_definition_id, metadata_json) VALUES (?, ?, 'skill_card', ?, 'epic', 'available', 1, 0, ?, ?)`);
      statements.push(
        consStmt.bind(consolationItemId, user.id, consDef.name, consDef.id, JSON.stringify({ source: "synthesis_advanced_to_expert_consolation", tier: "advanced", operationId: opId }))
      );
      eventAfter.consolationItemId = consolationItemId;
      eventAfter.consolationSkillDefinitionId = consDef.id;
    }

    // 7. Update pity with version and last_operation_id (pity CAS)
    if (pityRow) {
      statements.push(
        c.env.DB.prepare(
          `UPDATE skill_synthesis_pity SET pity_count = ?, version = version + 1, last_operation_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND version = ?`
        ).bind(pityAfter, opId, user.id, currentVersion)
      );
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
           SELECT ?, 1, COUNT(*) FROM skill_synthesis_pity WHERE user_id = ? AND last_operation_id = ? AND version = ?`
        ).bind(opId, user.id, opId, currentVersion + 1)
      );
    } else {
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO skill_synthesis_pity (user_id, pity_count, version, last_operation_id) VALUES (?, ?, 1, ?)`
        ).bind(user.id, pityAfter, opId)
      );
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
           SELECT ?, 1, COUNT(*) FROM skill_synthesis_pity WHERE user_id = ? AND last_operation_id = ? AND version = 1`
        ).bind(opId, user.id, opId)
      );
    }

    // 8. Update operation
    statements.push(
      c.env.DB.prepare(
        `UPDATE skill_synthesis_operations SET status = 'completed', output_item_id = ?, success = ?, pity_before = ?, pity_after = ?, result_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(outputItemId || consolationItemId, success ? 1 : 0, currentPity, pityAfter, JSON.stringify(eventAfter), opId)
    );

    // 9. Audit events
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO skill_economy_events (id, user_id, agent_id, event_type, inventory_item_id, operation_id, before_json, after_json)
         VALUES (?, ?, ?, 'synthesis_input_consumed', ?, ?, ?, ?)`
      ).bind(id("see"), user.id, agent.id, null, opId,
        JSON.stringify({ inputItems: inventoryItemIds, operationId: opId }),
        JSON.stringify({ synthesisType: "advanced_to_expert" })
      )
    );

    statements.push(
      c.env.DB.prepare(
        `INSERT INTO skill_economy_events (
          id, user_id, agent_id, event_type, inventory_item_id, operation_id,
          pool_code, pool_version, roll_integer, weight_total, selected_range, selected_skill_definition_id,
          before_json, after_json
        ) VALUES (?, ?, ?, 'synthesis_result', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id("see"), user.id, agent.id, outputItemId || consolationItemId, opId,
        success ? "expert_synthesis_expert_v1" : "expert_failure_consolation_v1",
        1,
        drawResult.rollInteger,
        drawResult.weightTotal,
        drawResult.selectedRange,
        success ? selectedExpertDef!.id : consDef!.id,
        JSON.stringify({ pityBefore: currentPity, pityAfter: success ? 0 : currentPity + 1, operationId: opId }),
        JSON.stringify(eventAfter)
      )
    );

    if (isPityTriggered) {
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO skill_economy_events (id, user_id, agent_id, event_type, operation_id, before_json, after_json)
           VALUES (?, ?, ?, 'pity_triggered', ?, ?, ?)`
        ).bind(id("see"), user.id, agent.id, opId,
          JSON.stringify({ pityBefore: currentPity, operationId: opId }),
          JSON.stringify({ pityAfter: 0, guaranteed: true })
        )
      );
    }

    // 10. Clean validations
    statements.push(
      c.env.DB.prepare("DELETE FROM operation_validations WHERE operation_id = ?").bind(opId)
    );

    try {
      await c.env.DB.batch(statements);
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
    const reserve = await reservePendingOperation(
      c.env.DB,
      "skill_upgrade_operations",
      `INSERT INTO skill_upgrade_operations (id, user_id, agent_id, operation_type, learned_skill_id, from_level, to_level, consumed_inventory_item_id, gp_cost, idempotency_key, request_hash, status)
       VALUES (?, ?, ?, 'upgrade', ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [opId, user.id, agentId, learnedSkillId, learnedSkill.skill_level, learnedSkill.skill_level + 1, inventoryItemId, gpCost, idempotencyKey, requestHash],
      `SELECT * FROM skill_upgrade_operations WHERE user_id = ? AND idempotency_key = ?`,
      [user.id, idempotencyKey],
      requestHash
    );

    if (!reserve.reserved) {
      if (reserve.error === "idempotency_conflict") {
        return c.json({ error: "idempotency_conflict" }, 409);
      }
      if (reserve.error === "reconciliation_required") {
        return c.json({ error: "reconciliation_required" }, 409);
      }
      if (reserve.status === "completed") {
        return c.json({ result: reserve.result, idempotent: true });
      }
      if (reserve.status === "pending") {
        return c.json({ error: "operation_in_progress" }, 409);
      }
      if (reserve.status === "failed") {
        return c.json({ error: "previous_operation_failed" }, 400);
      }
      return c.json({ error: reserve.error || "reserve_failed" }, 400);
    }

    // Execute batch
    const statements: any[] = [];

    // 1. Claim card
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO skill_economy_item_consumptions (inventory_item_id, operation_id, user_id, consumption_type)
         SELECT id, ?, owner_user_id, 'burn' FROM inventory_items
         WHERE id = ? AND owner_user_id = ? AND status = 'available'`
      ).bind(opId, inventoryItemId, user.id)
    );

    // 2. Assert claimed card count is 1
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
         SELECT ?, 1, COUNT(*) FROM skill_economy_item_consumptions WHERE operation_id = ?`
      ).bind(opId, opId)
    );

    // 3. Assert skill level pre-condition is met
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
         SELECT ?, 1, COUNT(*) FROM agent_learned_skills WHERE id = ? AND agent_id = ? AND status = 'active' AND skill_level = ?`
      ).bind(opId, learnedSkillId, agentId, learnedSkill.skill_level)
    );

    // 4. Assert GP balance
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
         SELECT ?, 1, COUNT(*) FROM user_balance_snapshots WHERE user_id = ? AND pending_points_balance >= ?`
      ).bind(opId, user.id, gpCost)
    );

    // 5. Burn card
    statements.push(
      c.env.DB.prepare(
        "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
      ).bind(inventoryItemId, user.id)
    );

    // 6. Update skill level
    statements.push(
      c.env.DB.prepare(
        "UPDATE agent_learned_skills SET skill_level = skill_level + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND agent_id = ? AND status = 'active' AND skill_level = ?"
      ).bind(learnedSkillId, agentId, learnedSkill.skill_level)
    );

    // 7. GP deduction
    statements.push(
      legacyPendingPointsLedger(c.env.DB, user.id, agentId, "skill_economy_spend", -gpCost, null, `skill_upgrade_spend|${opId}`, { operationId: opId, learnedSkillId })
    );

    // 8. Update operation
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

    // 9. Audit
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO skill_economy_events (id, user_id, agent_id, event_type, learned_skill_id, inventory_item_id, operation_id, before_json, after_json)
         VALUES (?, ?, ?, 'upgrade', ?, ?, ?, ?, ?)`
      ).bind(id("see"), user.id, agentId, learnedSkillId, inventoryItemId, opId,
        JSON.stringify({ fromLevel: learnedSkill.skill_level, operationId: opId }),
        JSON.stringify({ toLevel: learnedSkill.skill_level + 1, gpCost, tier: skillDef.tier })
      )
    );

    // 10. Clean validations
    statements.push(
      c.env.DB.prepare("DELETE FROM operation_validations WHERE operation_id = ?").bind(opId)
    );

    try {
      await c.env.DB.batch(statements);
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

    let drawnTier = "normal";
    let newSkillPick: any = null;
    let rollInteger = 0;
    let weightTotal = 0;
    let selectedRange = "";

    let attempt = 0;
    for (; attempt < 5; attempt++) {
      const testTierOverride = await getTestDrawOverride(c, "reset_tier");
      if (testTierOverride === "normal" || testTierOverride === "advanced" || testTierOverride === "expert") {
        drawnTier = testTierOverride;
      } else {
        const tierResult = weightedDraw(resetTierWeights);
        drawnTier = tierResult.rewardType;
      }

      const poolCode = `reset_${drawnTier}_v1`;
      const pool = await getSkillPoolForPoolCode(c.env.DB, poolCode, agentId);
      if (pool.length > 0) {
        const weightField = drawnTier === "expert" ? "synthesis_weight" : "drop_weight";
        const drawResult = drawSkillFromPool(pool, weightField);
        newSkillPick = drawResult.skill;
        rollInteger = drawResult.rollInteger;
        weightTotal = drawResult.weightTotal;
        selectedRange = drawResult.selectedRange;
        break;
      }
    }

    if (!newSkillPick) {
      return c.json({ error: "no_valid_skill", message: "Could not find a valid replacement skill after 5 attempts." }, 500);
    }

    // Reserve operation using INSERT-first
    const opResetId = id("sop");
    const gpCost = 200;

    const requestString = `${user.id}:${agentId}:reset:${resetCoreInventoryItemId}:${protectionInventoryItemId}:${protectedLearnedSkillId}`;
    const requestHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(requestString)).then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join(""));

    const reserve = await reservePendingOperation(
      c.env.DB,
      "agent_skill_reset_operations",
      `INSERT INTO agent_skill_reset_operations (id, user_id, agent_id, operation_type, idempotency_key, request_hash, consumed_inventory_item_id, consumed_protection_item_id, status)
       VALUES (?, ?, ?, 'reset', ?, ?, ?, ?, 'pending')`,
      [opResetId, user.id, agentId, idempotencyKey, requestHash, resetCoreInventoryItemId, protectionInventoryItemId],
      `SELECT * FROM agent_skill_reset_operations WHERE user_id = ? AND idempotency_key = ?`,
      [user.id, idempotencyKey],
      requestHash
    );

    if (!reserve.reserved) {
      if (reserve.error === "idempotency_conflict") {
        return c.json({ error: "idempotency_conflict", message: "Different request body for same key." }, 409);
      }
      if (reserve.error === "reconciliation_required") {
        return c.json({ error: "reconciliation_required" }, 409);
      }
      if (reserve.status === "completed") {
        return c.json({ result: reserve.result, idempotent: true });
      }
      if (reserve.status === "pending") {
        return c.json({ error: "operation_in_progress" }, 409);
      }
      if (reserve.status === "failed") {
        return c.json({ error: "previous_operation_failed" }, 400);
      }
      return c.json({ error: reserve.error || "reserve_failed" }, 400);
    }

    // Execute batch
    const statements: any[] = [];

    // 1. Claim Reset Core
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO skill_economy_item_consumptions (inventory_item_id, operation_id, user_id, consumption_type)
         SELECT id, ?, owner_user_id, 'reset_core' FROM inventory_items
         WHERE id = ? AND owner_user_id = ? AND status = 'available' AND item_type = 'consumable' AND name = 'Reset Core'`
      ).bind(opResetId, resetCoreInventoryItemId, user.id)
    );
    // Assert claimed Reset Core
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
         SELECT ?, 1, COUNT(*) FROM skill_economy_item_consumptions WHERE operation_id = ? AND inventory_item_id = ?`
      ).bind(opResetId, opResetId, resetCoreInventoryItemId)
    );

    // 2. Claim Protection Token if provided
    if (protectionInventoryItemId) {
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO skill_economy_item_consumptions (inventory_item_id, operation_id, user_id, consumption_type)
           SELECT id, ?, owner_user_id, 'protection_token' FROM inventory_items
           WHERE id = ? AND owner_user_id = ? AND status = 'available' AND item_type = 'consumable' AND name = 'Skill Protection Token'`
        ).bind(opResetId, protectionInventoryItemId, user.id)
      );
      // Assert claimed Protection Token
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
           SELECT ?, 1, COUNT(*) FROM skill_economy_item_consumptions WHERE operation_id = ? AND inventory_item_id = ?`
        ).bind(opResetId, opResetId, protectionInventoryItemId)
      );
    }

    // 3. Assert old skill is active
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
         SELECT ?, 1, COUNT(*) FROM agent_learned_skills WHERE id = ? AND agent_id = ? AND status = 'active'`
      ).bind(opResetId, targetSkill.id, agentId)
    );

    // 4. Assert GP balance
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
         SELECT ?, 1, COUNT(*) FROM user_balance_snapshots WHERE user_id = ? AND pending_points_balance >= ?`
      ).bind(opResetId, user.id, gpCost)
    );

    // 5. Consume Reset Core
    statements.push(
      c.env.DB.prepare(
        "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
      ).bind(resetCoreInventoryItemId, user.id)
    );

    // 6. Consume Protection Token if provided
    if (protectionInventoryItemId) {
      statements.push(
        c.env.DB.prepare(
          "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
        ).bind(protectionInventoryItemId, user.id)
      );
    }

    // 7. Mark old skill as replaced
    statements.push(
      c.env.DB.prepare(
        "UPDATE agent_learned_skills SET status = 'replaced', replaced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND agent_id = ? AND status = 'active'"
      ).bind(targetSkill.id, agentId)
    );

    // 8. Insert new skill in same slot
    const newLearnedSkillId = id("ls");
    statements.push(
      c.env.DB.prepare(
        "INSERT INTO agent_learned_skills (id, agent_id, skill_definition_id, skill_level, slot_index, status, source_inventory_item_id) VALUES (?, ?, ?, 1, ?, 'active', ?)"
      ).bind(newLearnedSkillId, agentId, newSkillPick.id, targetSkill.slot_index, resetCoreInventoryItemId)
    );

    // 9. GP deduction
    statements.push(
      legacyPendingPointsLedger(c.env.DB, user.id, agentId, "skill_economy_spend", -gpCost, null, `skill_reset_spend|${opResetId}`, { operationId: opResetId })
    );

    // 10. Record/Update operation
    const resultJson = JSON.stringify({
      operationId: opResetId,
      replacedSkillId: targetSkill.id,
      replacedSkillDefinitionId: targetSkill.skill_definition_id,
      newSkillId: newLearnedSkillId,
      newSkillDefinitionId: newSkillPick.id,
      newSkillName: newSkillPick.name,
      drawnTier,
      gpCost,
    });
    statements.push(
      c.env.DB.prepare(
        `UPDATE agent_skill_reset_operations SET status = 'completed', learned_skill_id = ?, replaced_learned_skill_id = ?, result_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(newLearnedSkillId, targetSkill.id, resultJson, opResetId)
    );

    // 11. Audit
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO skill_economy_events (
          id, user_id, agent_id, event_type, learned_skill_id, inventory_item_id, slot_index, operation_id,
          pool_code, pool_version, roll_integer, weight_total, selected_range, selected_skill_definition_id,
          before_json, after_json
        ) VALUES (?, ?, ?, 'reset', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id("see"), user.id, agentId, newLearnedSkillId, resetCoreInventoryItemId, targetSkill.slot_index, opResetId,
        `reset_${drawnTier}_v1`,
        1,
        rollInteger,
        weightTotal,
        selectedRange,
        newSkillPick.id,
        JSON.stringify({ replacedSkillId: targetSkill.id, oldSkillDefId: targetSkill.skill_definition_id, oldSkillName: oldDef?.name, operationId: opResetId }),
        JSON.stringify({ newSkillDefId: newSkillPick.id, newSkillName: newSkillPick.name, drawnTier, gpCost })
      )
    );

    // 12. Clean validations
    statements.push(
      c.env.DB.prepare("DELETE FROM operation_validations WHERE operation_id = ?").bind(opResetId)
    );

    try {
      await c.env.DB.batch(statements);
    } catch (err: any) {
      await c.env.DB.prepare(
        `UPDATE agent_skill_reset_operations SET status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(err.message?.slice(0, 500) || "batch_failed", opResetId).run();
      return c.json({ error: "reset_failed", message: err.message || "Reset operation failed." }, 500);
    }

    return c.json({
      result: {
        operationId: opResetId,
        replacedSkillId: targetSkill.id,
        replacedSkillName: oldDef?.name || "Unknown",
        newLearnedSkillId,
        newSkillDefinitionId: newSkillPick.id,
        newSkillName: newSkillPick.name,
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

      const opId = id("op");
      const statements: any[] = [];

      // 1. Claim consumable
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO skill_economy_item_consumptions (inventory_item_id, operation_id, user_id, consumption_type)
           SELECT id, ?, owner_user_id, 'use_consumable' FROM inventory_items
           WHERE id = ? AND owner_user_id = ? AND status = 'available' AND item_type = 'consumable'`
        ).bind(opId, inventoryItemId, user.id)
      );

      // 2. Assert consumable claimed
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
           SELECT ?, 1, COUNT(*) FROM skill_economy_item_consumptions WHERE operation_id = ? AND inventory_item_id = ?`
        ).bind(opId, opId, inventoryItemId)
      );

      // 3. Burn consumable
      statements.push(
        c.env.DB.prepare(
          "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
        ).bind(inventoryItemId, user.id)
      );

      // 4. Add energy
      statements.push(
        c.env.DB.prepare(
          "UPDATE agents SET energy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
        ).bind(newEnergy, agent.id, user.id)
      );

      // 5. Ledger
      statements.push(
        ledger(c.env.DB, user.id, agent.id, "consumable_use", "energy", energyAmount, null, `energy_recovery|${inventoryItemId}`, { itemId: inventoryItemId })
      );

      // 6. Audit
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO skill_economy_events (id, user_id, agent_id, event_type, inventory_item_id, operation_id, before_json, after_json)
           VALUES (?, ?, ?, 'consumable_use', ?, ?, ?, ?)`
        ).bind(id("see"), user.id, agent.id, inventoryItemId, opId,
          JSON.stringify({ itemName: item.name, energyBefore: agent.energy, operationId: opId }),
          JSON.stringify({ energyAdded: energyAmount, energyAfter: newEnergy })
        )
      );

      // 7. Clean validations
      statements.push(
        c.env.DB.prepare("DELETE FROM operation_validations WHERE operation_id = ?").bind(opId)
      );

      try {
        await c.env.DB.batch(statements);
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
  auditData.poolCode = null;
  auditData.poolVersion = null;
  auditData.selectedSkillDefinitionId = null;

  switch (rewardType) {
    case "normal_skill":
    case "advanced_skill": {
      const tier = rewardType === "normal_skill" ? "normal" : "advanced";
      const poolCode = `skill_box_${tier}_v1`;
      const pool = await getSkillPoolForPoolCode(db, poolCode);

      if (!pool || pool.length === 0) {
        throw new Error("invalid_skill_pool_config");
      }

      const drawResult = drawSkillFromPool(pool, "drop_weight");
      const def = drawResult.skill;
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
      
      auditData.poolCode = poolCode;
      auditData.poolVersion = 1;
      auditData.rollInteger = drawResult.rollInteger;
      auditData.weightTotal = drawResult.weightTotal;
      auditData.selectedRange = drawResult.selectedRange;
      auditData.selectedRewardType = rewardType;
      auditData.selectedSkillDefinitionId = def.id;
      auditData.testOverrideUsed = !!testOverride;
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
        legacyPendingPointsLedger(db, userId, agentId, "skill_box_reward", pointAmount, null, `skill_box_gp_small|${openingId}`, { openingId, rewardType: "gp_small" })
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
