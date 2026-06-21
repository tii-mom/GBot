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

    // 1. Check idempotency
    let order = await c.env.DB.prepare(
      "SELECT * FROM box_orders WHERE user_id = ? AND idempotency_key = ?"
    ).bind(user.id, idempotencyKey).first<DbBoxOrder>();

    const product = await c.env.DB.prepare(
      "SELECT * FROM box_products WHERE id = ? AND status = 'active'"
    ).bind(boxId).first<DbBoxProduct>();

    if (!product) {
      return c.json({ error: "product_not_available", message: "Box is not available for sale" }, 404);
    }

    if (order) {
      if (order.status === "fulfilled") {
        return c.json({ order: toBoxOrder(order, product) });
      }
      if (order.status === "failed") {
        return c.json({ order: toBoxOrder(order, product) }, 400);
      }
      // If pending, we fall through to try processing it again
    } else {
      // Create pending order
      const orderId = id("order");
      await c.env.DB.prepare(
        `INSERT INTO box_orders (id, user_id, box_product_id, quantity, unit_price, total_price, currency, payment_provider, status, idempotency_key, fulfillment_attempts)
         VALUES (?, ?, ?, ?, ?, ?, 'GP', 'gp_balance', 'pending', ?, 0)`
      ).bind(orderId, user.id, boxId, quantity, product.price_amount, product.price_amount, idempotencyKey).run();
      
      order = await c.env.DB.prepare("SELECT * FROM box_orders WHERE id = ?").bind(orderId).first<DbBoxOrder>();
    }

    // 2. Restriction: Starter Box cannot be bought
    if (product.box_type === "starter" || product.code === "starter") {
      await c.env.DB.prepare(
        "UPDATE box_orders SET status = 'failed', failure_code = 'starter_box_not_purchasable', failure_message = 'Starter Box can only be claimed through /agents/claim', fulfillment_attempts = fulfillment_attempts + 1 WHERE id = ?"
      ).bind(order!.id).run();
      return c.json({ error: "starter_box_not_purchasable", message: "Starter Box can only be claimed through /agents/claim" }, 400);
    }

    // 3. Check stock
    if (product.remaining_supply < 1) {
      await c.env.DB.prepare(
        "UPDATE box_orders SET status = 'failed', failure_code = 'out_of_stock', failure_message = 'Insufficient product supply', fulfillment_attempts = fulfillment_attempts + 1 WHERE id = ?"
      ).bind(order!.id).run();
      return c.json({ error: "out_of_stock", message: "Insufficient product supply" }, 400);
    }

    // 4. Check per user limit
    const totalBoughtRow = await c.env.DB.prepare(
      "SELECT COALESCE(SUM(quantity), 0) AS total FROM box_orders WHERE user_id = ? AND box_product_id = ? AND status = 'fulfilled'"
    ).bind(user.id, boxId).first<{ total: number }>();

    const totalBought = Number(totalBoughtRow?.total ?? 0);
    if (product.per_user_limit > 0 && (totalBought + 1) > product.per_user_limit) {
      await c.env.DB.prepare(
        "UPDATE box_orders SET status = 'failed', failure_code = 'user_limit_exceeded', failure_message = 'You have reached the purchase limit for this box', fulfillment_attempts = fulfillment_attempts + 1 WHERE id = ?"
      ).bind(order!.id).run();
      return c.json({ error: "user_limit_exceeded", message: `You have reached the limit of ${product.per_user_limit} boxes` }, 400);
    }

    const boxItemId = id("item");
    const agent = await getAgent(c.env.DB, user.id);
    const agentId = agent ? agent.id : null;

    try {
      const orderStatements = [
        // Deduct stock with unconditional update (Task 2: let the trigger trg_box_products_stock_check abort if supply is exhausted)
        c.env.DB.prepare(
          "UPDATE box_products SET remaining_supply = remaining_supply - 1 WHERE id = ?"
        ).bind(boxId),

        // GP deduction ledger (Task 1: Point ledger insertion automatically updates balance snapshots via AFTER INSERT trigger)
        ledger(c.env.DB, user.id, agentId, "box_purchase", "pending_points", -product.price_amount, null, order!.id, { boxProductId: boxId }),

        // Add box to user inventory
        c.env.DB.prepare(
          `INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, box_order_id)
           VALUES (?, ?, 'box', ?, ?, 'available', ?, 0, ?)`
        ).bind(boxItemId, user.id, product.name, product.rarity, product.transferable ? 1 : 0, order!.id),

        // Update order status to fulfilled
        c.env.DB.prepare(
          `UPDATE box_orders 
           SET status = 'fulfilled', fulfilled_inventory_item_id = ?, paid_at = CURRENT_TIMESTAMP, fulfilled_at = CURRENT_TIMESTAMP, fulfillment_attempts = fulfillment_attempts + 1
           WHERE id = ?`
        ).bind(boxItemId, order!.id)
      ];

      await c.env.DB.batch(orderStatements);

      const freshOrder = await c.env.DB.prepare("SELECT * FROM box_orders WHERE id = ?").bind(order!.id).first<DbBoxOrder>();
      return c.json({ order: toBoxOrder(freshOrder!, product) });

    } catch (err: any) {
      // Record failure on state machine
      await c.env.DB.prepare(
        `UPDATE box_orders 
         SET status = 'failed', failure_code = ?, failure_message = ?, fulfillment_attempts = fulfillment_attempts + 1
         WHERE id = ?`
      ).bind("fulfillment_failed", err.message || "Unknown fulfillment error", order!.id).run();

      return c.json({ 
        error: "fulfillment_failed", 
        message: err.message || "Failed to process order",
        order: toBoxOrder((await c.env.DB.prepare("SELECT * FROM box_orders WHERE id = ?").bind(order!.id).first<DbBoxOrder>())!, product)
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
      if (validRandomPool.length > 0) {
        const totalWeight = validRandomPool.reduce((sum, item) => sum + item.weight, 0);
        let roll = Math.random() * totalWeight;
        let drawn = validRandomPool[0]!;

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
      // A. Box Opening Reservation (Task 3: UNIQUE constraint aborts duplicate opens)
      statements.push(
        c.env.DB.prepare(
          "INSERT INTO box_openings (inventory_item_id) VALUES (?)"
        ).bind(inventoryItemId)
      );

      // B. Condition burn
      statements.push(
        c.env.DB.prepare(
          "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
        ).bind(inventoryItemId, user.id)
      );

      // B. Starter Box Grant
      if (box.name === "Starter Box") {
        statements.push(
          c.env.DB.prepare(
            "INSERT INTO starter_box_grants (user_id, order_id) VALUES (?, ?)"
          ).bind(user.id, box.box_order_id || "starter_grant")
        );
      }

      // C. Random asset reward and issued_count update
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

      // D. Ledger statements
      const points = rewards.find((r) => r.type === "pending_points")?.amount ?? 0;
      const energy = rewards.find((r) => r.type === "energy")?.amount ?? 0;

      if (points > 0) {
        statements.push(
          ledger(c.env.DB, user.id, agent.id, "box_open", "pending_points", points, null, openingId, { boxId: box.id, boxName: box.name })
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

      // E. Execute batch
      try {
        const results = await c.env.DB.batch(statements);
        // Ensure box burn affected exactly 1 row (it is index 1 because index 0 is box_openings insert)
        if (results[1]?.meta.changes !== 1) {
          throw new Error("Box is no longer available to burn");
        }
        
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
