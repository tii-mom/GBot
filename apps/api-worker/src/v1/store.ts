import { Hono, Context } from "hono";
import {
  Bindings,
  requireUser,
  id,
  ledger,
  getAgent,
  toAgent,
  logActivity,
  parseJson,
  toBoxProduct,
  toBoxOrder,
  toInventoryItem,
  toAssetDefinition,
  legacyPendingPointsLedger,
  DbBoxProduct,
  DbBoxOrder,
  DbBoxDropItem,
  DbAssetDefinition,
  DbAgent,
  ensureUserBalanceSnapshot
} from "./core";
import { 
  BoxProduct, 
  BoxDropTableEntry, 
  BoxOrder,
  Rarity,
  ItemCategory
} from "@growthbot/shared";

type AppContext = Context<{ Bindings: Bindings }>;

export function registerV1Store(app: Hono<{ Bindings: Bindings }>) {
  // 1. List products
  app.get("/store/boxes", async (c) => {
    await requireUser(c);
    const rows = await c.env.DB.prepare(
      "SELECT * FROM box_products WHERE status != 'draft' ORDER BY price_amount ASC"
    ).all<DbBoxProduct>();
    return c.json({ products: rows.results.map(toBoxProduct) });
  });

  // 2. Product details
  app.get("/store/boxes/:boxId", async (c) => {
    await requireUser(c);
    const boxId = c.req.param("boxId");
    const row = await c.env.DB.prepare("SELECT * FROM box_products WHERE id = ?").bind(boxId).first<DbBoxProduct>();
    if (!row) return c.json({ error: "product_not_found", message: "Box product not found" }, 404);
    return c.json({ product: toBoxProduct(row) });
  });

  // 3. Drop table details
  app.get("/store/boxes/:boxId/drop-table", async (c) => {
    await requireUser(c);
    const boxId = c.req.param("boxId");
    
    const product = await c.env.DB.prepare("SELECT * FROM box_products WHERE id = ?").bind(boxId).first<DbBoxProduct>();
    if (!product) return c.json({ error: "product_not_found", message: "Box product not found" }, 404);

    const items = await c.env.DB.prepare(
      "SELECT * FROM box_drop_items WHERE box_product_id = ?"
    ).bind(boxId).all<DbBoxDropItem>();

    const totalWeight = items.results
      .filter((i) => i.guaranteed === 0)
      .reduce((sum, item) => sum + item.weight, 0);

    const entries: BoxDropTableEntry[] = items.results.map((row) => {
      const probability = row.guaranteed === 1 ? 1.0 : (totalWeight > 0 ? row.weight / totalWeight : 0);
      return {
        id: row.id,
        boxProductId: row.box_product_id,
        assetDefinitionId: row.asset_definition_id,
        assetName: row.asset_name,
        weight: row.weight,
        guaranteed: row.guaranteed === 1,
        minQuantity: row.min_quantity,
        maxQuantity: row.max_quantity,
        rarity: row.rarity,
        pointAmount: row.point_amount,
        energyAmount: row.energy_amount,
        issuedCount: row.issued_count,
        maxSupply: row.max_supply,
        probability
      };
    });

    return c.json({ dropTable: entries });
  });

  // 4. Order creation (GP balance atomic fulfillment)
  app.post("/store/boxes/:boxId/orders", async (c) => {
    const user = await requireUser(c);
    const boxId = c.req.param("boxId");
    const body = await c.req.json().catch(() => ({}));
    const quantity = Math.floor(Number(body.quantity || 1));
    const idempotencyKey = body.idempotencyKey || `${user.id}:${boxId}:${quantity}:${Date.now()}`;

    // Force quantity = 1 for V1
    if (quantity !== 1) {
      return c.json({ error: "unsupported_quantity", message: "Only quantity of 1 is supported in V1" }, 400);
    }

    // Initialize/Ensure balance snapshot first
    await ensureUserBalanceSnapshot(c.env.DB, user.id);

    const product = await c.env.DB.prepare(
      "SELECT * FROM box_products WHERE id = ? AND status = 'active'"
    ).bind(boxId).first<DbBoxProduct>();

    if (!product) {
      return c.json({ error: "product_not_available", message: "Box is not available for sale" }, 404);
    }

    // 2. Restriction: Starter Box cannot be bought
    if (product.box_type === "starter" || product.code === "starter") {
      return c.json({ error: "starter_box_not_purchasable", message: "Starter Box can only be claimed through /agents/claim" }, 400);
    }

    // Calculate request hash covering: user_id, box_product_id, quantity, price
    const hashData = JSON.stringify({
      userId: user.id,
      boxProductId: boxId,
      quantity,
      price: product.price_amount
    });
    const requestHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(hashData)).then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join(""));

    let activeOrderId = id("order");
    let order: DbBoxOrder | null = null;

    // INSERT-first reservation
    try {
      await c.env.DB.prepare(
        `INSERT INTO box_orders (id, user_id, box_product_id, quantity, unit_price, total_price, currency, payment_provider, status, idempotency_key, request_hash, fulfillment_attempts)
         VALUES (?, ?, ?, ?, ?, ?, 'GP', 'gp_balance', 'pending', ?, ?, 0)`
      ).bind(activeOrderId, user.id, boxId, quantity, product.price_amount, product.price_amount, idempotencyKey, requestHash).run();
    } catch (err: any) {
      // UNIQUE constraint conflict. Fetch the existing order.
      order = await c.env.DB.prepare(
        "SELECT * FROM box_orders WHERE user_id = ? AND idempotency_key = ?"
      ).bind(user.id, idempotencyKey).first<DbBoxOrder>();
      if (!order) {
        throw err;
      }
      activeOrderId = order.id;
      if (order.request_hash !== requestHash) {
        return c.json({ error: "idempotency_conflict", message: "Different request parameters for same idempotency key." }, 409);
      }
      if (order.status === "fulfilled") {
        return c.json({ order: toBoxOrder(order, product) });
      }
      if (order.status === "pending") {
        // Check timeout recovery (30 seconds)
        const age = Date.now() - new Date(order.created_at + "Z").getTime();
        if (age >= 30000) {
          const recovered = await recoverBoxOrder(c.env.DB, order);
          if (recovered.status === "fulfilled") {
            return c.json({ order: toBoxOrder(recovered, product) });
          }
          if (recovered.status === "failed") {
            return c.json({ error: "previous_operation_failed", message: "Previous attempt of this order failed due to timeout." }, 400);
          }
          if (recovered.status === "reconciliation_required") {
            return c.json({ error: "reconciliation_required" }, 409);
          }
        }
        return c.json({ error: "operation_in_progress", message: "Order is already in progress." }, 409);
      }
      if (order.status === "failed") {
        return c.json({ error: "previous_operation_failed", message: "Previous attempt of this order failed." }, 400);
      }
      if (order.status === "reconciliation_required") {
        return c.json({ error: "reconciliation_required" }, 409);
      }
      return c.json({ error: "unknown_status" }, 400);
    }

    // Check per user limit
    const totalBoughtRow = await c.env.DB.prepare(
      "SELECT COALESCE(SUM(quantity), 0) AS total FROM box_orders WHERE user_id = ? AND box_product_id = ? AND status = 'fulfilled'"
    ).bind(user.id, boxId).first<{ total: number }>();

    const totalBought = Number(totalBoughtRow?.total ?? 0);
    if (product.per_user_limit > 0 && product.code !== "skill_box" && (totalBought + 1) > product.per_user_limit) {
      await c.env.DB.prepare(
        `UPDATE box_orders SET status = 'failed', failure_code = 'user_limit_exceeded', failure_message = 'You have reached the purchase limit for this box', fulfillment_attempts = 1 WHERE id = ?`
      ).bind(activeOrderId).run();
      return c.json({ error: "user_limit_exceeded", message: `You have reached the limit of ${product.per_user_limit} boxes` }, 400);
    }

    // Now we have execution rights.
    const boxItemId = id("item");
    const agent = await getAgent(c.env.DB, user.id);
    const agentId = agent ? agent.id : null;
    const utcDate = new Date().toISOString().slice(0, 10);
    const sbdpId = id("sbdp");

    const orderStatements: any[] = [];

    // 1. Assert GP balance
    orderStatements.push(
      c.env.DB.prepare(
        `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
         SELECT ?, 1, COUNT(*) FROM user_balance_snapshots WHERE user_id = ? AND pending_points_balance >= ?`
      ).bind(activeOrderId, user.id, product.price_amount)
    );

    // 2. Assert stock supply
    orderStatements.push(
      c.env.DB.prepare(
        `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
         SELECT ?, 1, COUNT(*) FROM box_products WHERE id = ? AND remaining_supply >= 1`
      ).bind(activeOrderId, boxId)
    );

    // 3. Stock update
    orderStatements.push(
      c.env.DB.prepare(
        "UPDATE box_products SET remaining_supply = remaining_supply - 1 WHERE id = ?"
      ).bind(boxId)
    );

    // 4. Update daily purchases count
    orderStatements.push(
      c.env.DB.prepare(
        `INSERT INTO skill_box_daily_purchases (id, user_id, box_product_id, utc_date, purchase_count)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(user_id, box_product_id, utc_date) DO UPDATE SET
           purchase_count = purchase_count + 1,
           updated_at = CURRENT_TIMESTAMP`
      ).bind(sbdpId, user.id, boxId, utcDate)
    );

    // 5. Assert daily limit <= 10
    orderStatements.push(
      c.env.DB.prepare(
        `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
         SELECT ?, 1, COUNT(*) FROM skill_box_daily_purchases WHERE user_id = ? AND box_product_id = ? AND utc_date = ? AND purchase_count <= 10`
      ).bind(activeOrderId, user.id, boxId, utcDate)
    );

    // 6. Deduct GP
    orderStatements.push(
      legacyPendingPointsLedger(c.env.DB, user.id, agentId, "box_purchase", -product.price_amount, null, activeOrderId, { boxProductId: boxId })
    );

    // 7. Add box to inventory
    orderStatements.push(
      c.env.DB.prepare(
        `INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, box_order_id)
         VALUES (?, ?, 'box', ?, ?, 'available', ?, 0, ?)`
      ).bind(boxItemId, user.id, product.name, product.rarity, product.transferable ? 1 : 0, activeOrderId)
    );

    // 8. Update order to fulfilled
    orderStatements.push(
      c.env.DB.prepare(
        `UPDATE box_orders 
         SET status = 'fulfilled', fulfilled_inventory_item_id = ?, paid_at = CURRENT_TIMESTAMP, fulfilled_at = CURRENT_TIMESTAMP, fulfillment_attempts = 1
         WHERE id = ?`
      ).bind(boxItemId, activeOrderId)
    );

    // 9. Clean validations
    orderStatements.push(
      c.env.DB.prepare("DELETE FROM operation_validations WHERE operation_id = ?").bind(activeOrderId)
    );

    try {
      await c.env.DB.batch(orderStatements);
      const freshOrder = await c.env.DB.prepare("SELECT * FROM box_orders WHERE id = ?").bind(activeOrderId).first<DbBoxOrder>();
      return c.json({ order: toBoxOrder(freshOrder!, product) });
    } catch (err: any) {
      await c.env.DB.prepare(
        `UPDATE box_orders 
         SET status = 'failed', failure_code = ?, failure_message = ?, fulfillment_attempts = 1
         WHERE id = ?`
      ).bind("fulfillment_failed", err.message || "Unknown fulfillment error", activeOrderId).run();
      
      const freshOrder = await c.env.DB.prepare("SELECT * FROM box_orders WHERE id = ?").bind(activeOrderId).first<DbBoxOrder>();
      return c.json({ 
        error: "fulfillment_failed", 
        message: err.message || "Failed to process order",
        order: toBoxOrder(freshOrder!, product)
      }, 400);
    }
  });

  // 5. Order details
  app.get("/store/orders/:orderId", async (c) => {
    const user = await requireUser(c);
    const orderId = c.req.param("orderId");
    
    const row = await c.env.DB.prepare("SELECT * FROM box_orders WHERE id = ?").bind(orderId).first<DbBoxOrder>();
    if (!row) return c.json({ error: "order_not_found", message: "Order not found" }, 404);
    if (row.user_id !== user.id) return c.json({ error: "forbidden", message: "Forbidden" }, 403);

    const product = await c.env.DB.prepare("SELECT name, code FROM box_products WHERE id = ?").bind(row.box_product_id).first<any>();
    return c.json({ order: toBoxOrder(row, product) });
  });

  // 6. Box open (incorporates server-side random drops)
  app.post("/boxes/:inventoryItemId/open", async (c) => {
    const user = await requireUser(c);
    const agent = await getAgent(c.env.DB, user.id);
    if (!agent) {
      return c.json({ error: "no_active_agent", message: "Claim your agent first before opening boxes" }, 400);
    }

    const inventoryItemId = c.req.param("inventoryItemId");
    const box = await c.env.DB.prepare(
      "SELECT * FROM inventory_items WHERE id = ? AND owner_user_id = ?"
    ).bind(inventoryItemId, user.id).first<any>();

    if (!box || box.item_type !== "box" || box.status !== "available") {
      return c.json({ error: "box_not_available", message: "Box is not available for opening" }, 400);
    }

    // 1. Fetch drop configuration
    const product = await c.env.DB.prepare(
      "SELECT * FROM box_products WHERE name = ? OR code = ?"
    ).bind(box.name, box.name.replace(" Box", "").toLowerCase()).first<DbBoxProduct>();

    if (!product) {
      return c.json({ error: "drop_config_missing", message: "Product drop catalog not configured" }, 500);
    }

    // 4. Fetch only enabled & implementation active asset definitions once (used inside redraw filter)
    const activeAssets = await c.env.DB.prepare(
      "SELECT id, code, status, implementation_status FROM asset_definitions WHERE status = 'enabled' AND implementation_status = 'active'"
    ).all<DbAssetDefinition>();
    const activeAssetIds = new Set(activeAssets.results.map((a) => a.id));

    // 5. Attempt loop for weighted random asset draw with rollbacks
    let attempts = 0;
    const maxAttempts = 3;
    let selectedItem: DbBoxDropItem | null = null;
    let rewards: Array<{ type: string; name: string; amount?: number; rarity?: string; itemId?: string; category?: string }> = [];
    const openingId = id("opening");

    while (attempts < maxAttempts) {
      selectedItem = null;
      rewards = [];
      const statements: any[] = []; // D1PreparedStatement[]

      // Re-query/re-load drop pool from DB (Task 5: refresh drop table within the retry loop)
      const currentDropPool = await c.env.DB.prepare(
        "SELECT * FROM box_drop_items WHERE box_product_id = ?"
      ).bind(product.id).all<DbBoxDropItem>();

      const currentGuaranteed = currentDropPool.results.filter((d) => d.guaranteed === 1);
      const currentRandomPool = currentDropPool.results.filter((d) => d.guaranteed === 0);

      const validRandomPool = currentRandomPool.filter((item) => {
        if (item.asset_definition_id && !activeAssetIds.has(item.asset_definition_id)) {
          return false;
        }
        if (item.max_supply != null && item.issued_count >= item.max_supply) {
          return false;
        }
        return true;
      });

      // Add guaranteed rewards
      for (const item of currentGuaranteed) {
        if (item.point_amount > 0) {
          rewards.push({ type: "pending_points", name: `${item.point_amount} GP`, amount: item.point_amount });
        }
        if (item.energy_amount > 0) {
          rewards.push({ type: "energy", name: `${item.energy_amount} Energy`, amount: item.energy_amount });
        }
      }

      // Draw random reward if pool is valid
      // PR #6 — Skill Box uses two-stage secure draw
      const productRow = await c.env.DB.prepare(
        "SELECT * FROM box_products WHERE id = ?"
      ).bind(product.id).first<any>();

      const isSkillBox = productRow?.box_type === "skill_box" || box.name === "Skill Box";

      let skillBoxResult: any = null;
      if (isSkillBox) {
        // Two-stage secure draw via resolveSkillBoxReward
        const testOverride = await getTestDrawOverride(c, "skill_box_reward_type").catch(() => null);
        skillBoxResult = await resolveSkillBoxReward(
          c.env.DB, user.id, agent.id, openingId, validRandomPool, testOverride
        );
        if (skillBoxResult) {
          // Merge skill box statements and rewards
          for (const stmt of skillBoxResult.statements) {
            statements.push(stmt);
          }
          for (const r of skillBoxResult.rewards) {
            rewards.push(r);
          }
          selectedItem = null; // signal: skill box handled
        }
      } else if (validRandomPool.length > 0) {
        const totalWeight = validRandomPool.reduce((sum, item) => sum + item.weight, 0);
        let roll = Math.random() * totalWeight;
        let drawn: DbBoxDropItem | null = validRandomPool[0] || null;

        for (const item of validRandomPool) {
          roll -= item.weight;
          if (roll <= 0) {
            drawn = item;
            break;
          }
        }
        selectedItem = drawn;
      }

      // 6. Build transaction statements
      // A. Claim box item
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO skill_economy_item_consumptions (inventory_item_id, operation_id, user_id, consumption_type)
           SELECT id, ?, owner_user_id, 'box_open' FROM inventory_items
           WHERE id = ? AND owner_user_id = ? AND status = 'available' AND item_type = 'box'`
        ).bind(openingId, inventoryItemId, user.id)
      );

      // B. Assert box claimed
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO operation_validations (operation_id, expected_count, actual_count)
           SELECT ?, 1, COUNT(*) FROM skill_economy_item_consumptions WHERE operation_id = ? AND inventory_item_id = ?`
        ).bind(openingId, openingId, inventoryItemId)
      );

      // C. Box Opening Reservation (Task 3: UNIQUE constraint aborts duplicate opens)
      statements.push(
        c.env.DB.prepare(
          "INSERT INTO box_openings (inventory_item_id, user_id) VALUES (?, ?)"
        ).bind(inventoryItemId, user.id)
      );

      // D. Condition burn
      statements.push(
        c.env.DB.prepare(
          "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
        ).bind(inventoryItemId, user.id)
      );

      // E. Starter Box Grant
      if (box.name === "Starter Box") {
        statements.push(
          c.env.DB.prepare(
            "INSERT INTO starter_box_grants (user_id, order_id) VALUES (?, ?)"
          ).bind(user.id, box.box_order_id || "starter_grant")
        );
      }

      // F. Random asset reward and issued_count update
      if (selectedItem && selectedItem.asset_definition_id) {
        const itemId = id("item");
        const def = await c.env.DB.prepare("SELECT * FROM asset_definitions WHERE id = ?").bind(selectedItem.asset_definition_id).first<DbAssetDefinition>();
        
        rewards.push({
          type: "ability",
          name: selectedItem.asset_name,
          rarity: selectedItem.rarity,
          itemId,
          category: def?.category || "skill"
        });

        // Insert ability item
        statements.push(
          c.env.DB.prepare(
            `INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, asset_definition_id, metadata_json)
             VALUES (?, ?, 'ability', ?, ?, 'available', ?, ?, ?, ?)`
          ).bind(
            itemId,
            user.id,
            selectedItem.asset_name,
            selectedItem.rarity,
            def?.soulbound === 1 ? 0 : 1,
            def?.soulbound || 0,
            selectedItem.asset_definition_id,
            JSON.stringify({
              usesRemaining: def?.max_uses || null,
              effect: def?.description_v1 || def?.effect || null,
              sourceBox: box.name,
              category: def?.category || "skill",
              learnStatus: "unlearned"
            })
          )
        );

        // Update issued count (Triggers exception if supply is exceeded)
        statements.push(
          c.env.DB.prepare(
            "UPDATE box_drop_items SET issued_count = issued_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(selectedItem.id)
        );
      }

      // G. Ledger statements
      const points = rewards.find((r) => r.type === "pending_points")?.amount ?? 0;
      const energy = rewards.find((r) => r.type === "energy")?.amount ?? 0;

      if (points > 0) {
        statements.push(
          legacyPendingPointsLedger(c.env.DB, user.id, agent.id, "box_open", points, null, openingId, { boxId: box.id, boxName: box.name })
        );
      }
      if (energy > 0) {
        const nextEnergy = Math.min(agent.max_energy, agent.energy + energy);
        statements.push(
          c.env.DB.prepare("UPDATE agents SET energy = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(nextEnergy, agent.id)
        );
        statements.push(
          ledger(c.env.DB, user.id, agent.id, "box_open", "energy", energy, null, openingId, { boxId: box.id })
        );
      }

      // H. Audit Event (Skill Economy Event)
      const audit = skillBoxResult?.auditData || {};
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO skill_economy_events (
            id, user_id, agent_id, event_type, box_opening_id, inventory_item_id, operation_id,
            roll_integer, weight_total, selected_range, selected_reward_type, selected_skill_definition_id,
            test_override_used, pool_code, pool_version, before_json, after_json
          ) VALUES (?, ?, ?, 'skill_box_draw', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id("see"),
          user.id,
          agent.id,
          openingId,
          inventoryItemId,
          openingId,
          audit.rollInteger !== undefined ? audit.rollInteger : null,
          audit.weightTotal !== undefined ? audit.weightTotal : null,
          audit.selectedRange || null,
          audit.selectedRewardType || null,
          audit.selectedSkillDefinitionId || null,
          audit.testOverrideUsed ? 1 : 0,
          audit.poolCode || null,
          audit.poolVersion !== undefined ? audit.poolVersion : null,
          JSON.stringify({ boxId: box.id, boxName: box.name }),
          JSON.stringify({ rewards, openingId })
        )
      );

      // I. Clean validations
      statements.push(
        c.env.DB.prepare("DELETE FROM operation_validations WHERE operation_id = ?").bind(openingId)
      );

      // E. Execute batch
      try {
        await c.env.DB.batch(statements);
        
        // Audit log success
        await logActivity(c.env.DB, agent.id, null, "box_open_success", `Opened ${box.name}`, `Received: ${rewards.map(r => r.name).join(", ")}`, null);
        const freshAgent = await c.env.DB.prepare("SELECT * FROM agents WHERE id = ?").bind(agent.id).first<DbAgent>();

        return c.json({
          openingId,
          box: { id: box.id, name: box.name },
          rewards,
          agent: await toAgent(c.env.DB, freshAgent!)
        });

      } catch (err: any) {
        if (err.message?.includes("max supply exceeded") || err.message?.includes("issued_count")) {
          // Supply conflict: retry with a different item if possible
          console.warn(`Opening conflict on drop item ${selectedItem?.id}. Attempt ${attempts + 1} of ${maxAttempts}. Redrawing.`);
          attempts++;
          continue;
        }
        // General error, abort immediately and keep box available
        return c.json({ error: "open_failed", message: err.message || "Failed to open box" }, 500);
      }
    }

    return c.json({ 
      error: "drop_limit_conflict", 
      message: "Could not allocate random drop due to concurrent maximum supply exhaustion. Please try again." 
    }, 409);
  });
}

// PR #6 — Skill Box two-stage draw integration
import { resolveSkillBoxReward, getTestDrawOverride } from "./skill-economy";

// Hook into the existing open flow: called instead of the standard weighted draw
// when the box is a Skill Box.
// Returns: { statements, rewards, auditData, shouldReplaceStandardDraw }
export async function handleSkillBoxOpen(
  db: D1Database,
  userId: string,
  agentId: string,
  openingId: string,
  boxName: string,
  currentDropPool: DbBoxDropItem[],
  testOverride?: string | null
): Promise<{
  statements: any[];
  rewards: Array<{ type: string; name: string; rarity: string; itemId?: string; amount?: number }>;
  auditData: Record<string, any>;
} | null> {
  // Only handle Skill Box
  if (boxName !== "Skill Box") return null;

  const result = await resolveSkillBoxReward(db, userId, agentId, openingId, currentDropPool, testOverride);
  return result;
}

// Legacy compatibility-only: box recovery still reconciles old point_ledger_events
// so existing store/order flows remain stable. New purchases should use real-asset
// asset ledger events and intent audit evidence.
export async function recoverBoxOrder(db: D1Database, order: DbBoxOrder): Promise<DbBoxOrder> {
  const ledgerRow = await db.prepare(
    "SELECT * FROM point_ledger_events WHERE user_id = ? AND source_id = ?"
  ).bind(order.user_id, order.id).first<any>();

  const itemRow = await db.prepare(
    "SELECT * FROM inventory_items WHERE owner_user_id = ? AND box_order_id = ?"
  ).bind(order.user_id, order.id).first<any>();

  const isFullSuccess = !!ledgerRow && !!itemRow;
  const isFullFailure = !ledgerRow && !itemRow;

  if (isFullSuccess) {
    await db.prepare(
      `UPDATE box_orders 
       SET status = 'fulfilled', fulfilled_inventory_item_id = ?, paid_at = CURRENT_TIMESTAMP, fulfilled_at = CURRENT_TIMESTAMP, fulfillment_attempts = ?
       WHERE id = ?`
    ).bind(itemRow.id, (order.fulfillment_attempts || 0) + 1, order.id).run();
    return { 
      ...order, 
      status: "fulfilled", 
      fulfilled_inventory_item_id: itemRow.id, 
      paid_at: new Date().toISOString(), 
      fulfilled_at: new Date().toISOString(),
      fulfillment_attempts: (order.fulfillment_attempts || 0) + 1
    };
  } else if (isFullFailure) {
    await db.prepare(
      `UPDATE box_orders 
       SET status = 'failed', failure_code = 'timeout', failure_message = 'Operation timed out', fulfillment_attempts = ?
       WHERE id = ?`
    ).bind((order.fulfillment_attempts || 0) + 1, order.id).run();
    return { 
      ...order, 
      status: "failed",
      fulfillment_attempts: (order.fulfillment_attempts || 0) + 1
    };
  } else {
    await db.prepare(
      `UPDATE box_orders 
       SET status = 'reconciliation_required', fulfillment_attempts = ?
       WHERE id = ?`
    ).bind((order.fulfillment_attempts || 0) + 1, order.id).run();
    return { 
      ...order, 
      status: "reconciliation_required",
      fulfillment_attempts: (order.fulfillment_attempts || 0) + 1
    };
  }
}
