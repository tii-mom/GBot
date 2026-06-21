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
  DbAgent
} from "../index";
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

    if (quantity <= 0) {
      return c.json({ error: "invalid_quantity", message: "Quantity must be greater than zero" }, 400);
    }

    // 1. Check idempotency
    const existingOrder = await c.env.DB.prepare(
      "SELECT * FROM box_orders WHERE user_id = ? AND idempotency_key = ?"
    ).bind(user.id, idempotencyKey).first<DbBoxOrder>();

    if (existingOrder) {
      const product = await c.env.DB.prepare("SELECT name, code FROM box_products WHERE id = ?").bind(existingOrder.box_product_id).first<any>();
      return c.json({ order: toBoxOrder(existingOrder, product) });
    }

    // 2. Fetch product details
    const product = await c.env.DB.prepare(
      "SELECT * FROM box_products WHERE id = ? AND status = 'active'"
    ).bind(boxId).first<DbBoxProduct>();

    if (!product) {
      return c.json({ error: "product_not_available", message: "Box is not available for sale" }, 404);
    }

    // 3. Restriction: Starter Box cannot be bought
    if (product.box_type === "starter" || product.code === "starter") {
      return c.json({ error: "starter_box_not_purchasable", message: "Starter Box can only be claimed through /agents/claim" }, 400);
    }

    // 4. Check stock
    if (product.remaining_supply < quantity) {
      return c.json({ error: "out_of_stock", message: "Insufficient product supply" }, 400);
    }

    // 5. Check per user limit
    const totalBoughtRow = await c.env.DB.prepare(
      "SELECT COALESCE(SUM(quantity), 0) AS total FROM box_orders WHERE user_id = ? AND box_product_id = ? AND status = 'fulfilled'"
    ).bind(user.id, boxId).first<{ total: number }>();

    const totalBought = Number(totalBoughtRow?.total ?? 0);
    if (product.per_user_limit > 0 && (totalBought + quantity) > product.per_user_limit) {
      return c.json({ error: "user_limit_exceeded", message: `You have reached the limit of ${product.per_user_limit} boxes` }, 400);
    }

    // 6. Check GP balance (pending_points)
    const totalPrice = product.price_amount * quantity;
    const balanceQuery = await c.env.DB.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM point_ledger_events WHERE user_id = ? AND point_type = 'pending_points'"
    ).bind(user.id).first<{ total: number }>();
    const balance = Number(balanceQuery?.total ?? 0);

    if (balance < totalPrice) {
      return c.json({ error: "insufficient_balance", message: "Insufficient GP balance" }, 400);
    }

    const orderId = id("order");
    const boxItemId = id("item");

    // Perform atomic transaction
    // - Deduct stock with conditional update
    const stockUpdate = await c.env.DB.prepare(
      "UPDATE box_products SET remaining_supply = remaining_supply - ? WHERE id = ? AND remaining_supply >= ?"
    ).bind(quantity, boxId, quantity).run();

    if (stockUpdate.meta.changes === 0) {
      return c.json({ error: "out_of_stock", message: "Out of stock during purchase" }, 400);
    }

    const agent = await getAgent(c.env.DB, user.id);
    const agentId = agent ? agent.id : null;

    const orderStatements = [
      // Insert fulfilled order record
      c.env.DB.prepare(
        `INSERT INTO box_orders (id, user_id, box_product_id, quantity, unit_price, total_price, currency, payment_provider, status, idempotency_key, fulfilled_inventory_item_id, paid_at, fulfilled_at)
         VALUES (?, ?, ?, ?, ?, ?, 'GP', 'gp_balance', 'fulfilled', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(orderId, user.id, boxId, quantity, product.price_amount, totalPrice, idempotencyKey, boxItemId),

      // GP deduction
      ledger(c.env.DB, user.id, agentId, "box_purchase", "pending_points", -totalPrice, null, orderId, { boxProductId: boxId }),

      // Add box to user inventory (only 1 item generated per purchase for V1 simplified flow)
      c.env.DB.prepare(
        `INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, box_order_id)
         VALUES (?, ?, 'box', ?, ?, 'available', ?, 0, ?)`
      ).bind(boxItemId, user.id, product.name, product.rarity, product.transferable ? 1 : 0, orderId)
    ];

    await c.env.DB.batch(orderStatements);

    const freshOrder = await c.env.DB.prepare("SELECT * FROM box_orders WHERE id = ?").bind(orderId).first<DbBoxOrder>();
    return c.json({ order: toBoxOrder(freshOrder!, product) });
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

    // 1. Double open protection
    const burnResult = await c.env.DB.prepare(
      "UPDATE inventory_items SET status = 'burned', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND status = 'available'"
    ).bind(inventoryItemId, user.id).run();

    if (burnResult.meta.changes === 0) {
      return c.json({ error: "box_already_opened", message: "Box is already burned or opened" }, 400);
    }

    // Starter box grant unique record insertion
    if (box.name === "Starter Box") {
      const grantExists = await c.env.DB.prepare(
        "SELECT 1 FROM starter_box_grants WHERE user_id = ?"
      ).bind(user.id).first<any>();

      if (grantExists) {
        return c.json({ error: "starter_box_already_opened", message: "Starter box has already been claimed and opened by this user" }, 400);
      }

      await c.env.DB.prepare(
        "INSERT INTO starter_box_grants (user_id, order_id) VALUES (?, ?)"
      ).bind(user.id, box.box_order_id || "starter_grant").run();
    }

    // 2. Fetch drops config
    const product = await c.env.DB.prepare(
      "SELECT * FROM box_products WHERE name = ? OR code = ?"
    ).bind(box.name, box.name.replace(" Box", "").toLowerCase()).first<DbBoxProduct>();

    if (!product) {
      return c.json({ error: "drop_config_missing", message: "Product drop catalog not configured" }, 500);
    }

    const dropPool = await c.env.DB.prepare(
      "SELECT * FROM box_drop_items WHERE box_product_id = ?"
    ).bind(product.id).all<DbBoxDropItem>();

    const guaranteed = dropPool.results.filter((d) => d.guaranteed === 1);
    const randomPool = dropPool.results.filter((d) => d.guaranteed === 0);

    const rewards: Array<{ type: string; name: string; amount?: number; rarity?: string; itemId?: string; category?: string }> = [];
    const statements: D1PreparedStatement[] = [];
    const openingId = id("opening");

    // Add guaranteed drops
    for (const item of guaranteed) {
      if (item.point_amount > 0) {
        rewards.push({ type: "pending_points", name: `${item.point_amount} GP`, amount: item.point_amount });
      }
      if (item.energy_amount > 0) {
        rewards.push({ type: "energy", name: `${item.energy_amount} Energy`, amount: item.energy_amount });
      }
    }

    // Process weighted random drops
    // Fetch active asset definitions to filter implementation_status = 'enabled'
    const activeAssets = await c.env.DB.prepare(
      "SELECT id, code, status FROM asset_definitions WHERE status = 'enabled'"
    ).all<DbAssetDefinition>();
    const activeAssetIds = new Set(activeAssets.results.map((a) => a.id));

    // Filter random pool based on max_supply & status = enabled
    const validRandomPool = randomPool.filter((item) => {
      if (item.asset_definition_id && !activeAssetIds.has(item.asset_definition_id)) {
        return false;
      }
      if (item.max_supply != null && item.issued_count >= item.max_supply) {
        return false;
      }
      return true;
    });

    if (validRandomPool.length > 0) {
      const totalWeight = validRandomPool.reduce((sum, item) => sum + item.weight, 0);
      let roll = Math.random() * totalWeight;
      let selectedItem = validRandomPool[0]!;

      for (const item of validRandomPool) {
        roll -= item.weight;
        if (roll <= 0) {
          selectedItem = item;
          break;
        }
      }

      if (selectedItem.asset_definition_id) {
        const itemId = id("item");
        const def = await c.env.DB.prepare("SELECT * FROM asset_definitions WHERE id = ?").bind(selectedItem.asset_definition_id).first<DbAssetDefinition>();
        
        rewards.push({
          type: "ability",
          name: selectedItem.asset_name,
          rarity: selectedItem.rarity,
          itemId,
          category: def?.category || "skill"
        });

        // Insert new ability item in user's inventory
        statements.push(
          c.env.DB.prepare(
            `INSERT INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, asset_definition_id, metadata_json)
             VALUES (?, ?, 'ability', ?, ?, 'available', ?, ?, ?, ?)`
          ).bind(
            itemId,
            user.id,
            selectedItem.asset_name,
            selectedItem.rarity,
            def?.soulbound === 1 ? 0 : 1, // transferable if not soulbound
            def?.soulbound || 0,
            selectedItem.asset_definition_id,
            JSON.stringify({
              usesRemaining: def?.max_uses || null,
              effect: def?.description_v1 || def?.description || null,
              sourceBox: box.name,
              category: def?.category || "skill",
              learnStatus: "unlearned"
            })
          )
        );

        // Update drop item issued count
        statements.push(
          c.env.DB.prepare(
            "UPDATE box_drop_items SET issued_count = issued_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(selectedItem.id)
        );
      }
    }

    // Ledger statements
    const points = rewards.find((r) => r.type === "pending_points")?.amount ?? 0;
    const energy = rewards.find((r) => r.type === "energy")?.amount ?? 0;
    const abilityReward = rewards.find((r) => r.type === "ability");

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

    if (statements.length > 0) {
      await c.env.DB.batch(statements);
    }

    await logActivity(c.env.DB, agent.id, null, "box_open_success", `Opened ${box.name}`, `Received: ${rewards.map(r => r.name).join(", ")}`, null);

    const freshAgent = await c.env.DB.prepare("SELECT * FROM agents WHERE id = ?").bind(agent.id).first<DbAgent>();

    return c.json({
      openingId,
      box: { id: box.id, name: box.name },
      rewards,
      agent: await toAgent(c.env.DB, freshAgent!)
    });
  });
}
