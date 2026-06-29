import { Hono, Context } from "hono";
import { 
  Bindings, 
  requireAdmin, 
  toAssetDefinition,
  toBoxProduct,
  toBoxOrder,
  toWorkRun,
  DbAssetDefinition,
  DbBoxProduct,
  DbBoxOrder,
  DbWorkRun
} from "./core";
import {
  serializeSource,
  serializeSignal,
  serializeIngestionEvent
} from "./telegram";

type AppContext = Context<{ Bindings: Bindings }>;

export function registerV1Admin(app: Hono<{ Bindings: Bindings }>) {
  const ADMIN_PREFIX = "/admin/v1";

  // 1. Get asset definitions
  app.get(`${ADMIN_PREFIX}/assets`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;

    const rows = await c.env.DB.prepare(
      "SELECT * FROM asset_definitions ORDER BY created_at DESC"
    ).all<DbAssetDefinition>();
    return c.json({ assets: rows.results.map(toAssetDefinition) });
  });

  // 2. Enable/disable asset definition
  app.post(`${ADMIN_PREFIX}/assets/:assetId/status`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;

    const assetId = c.req.param("assetId");
    const body = await c.req.json().catch(() => ({}));
    const status = body.status === "enabled" ? "enabled" : "disabled";

    await c.env.DB.prepare(
      "UPDATE asset_definitions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(status, assetId).run();

    return c.json({ success: true, status });
  });

  // 3. Get box products
  app.get(`${ADMIN_PREFIX}/boxes`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;

    const rows = await c.env.DB.prepare(
      "SELECT * FROM box_products ORDER BY created_at DESC"
    ).all<DbBoxProduct>();
    return c.json({ boxes: rows.results.map(toBoxProduct) });
  });

  // 4. Pause/resume box product sale
  app.post(`${ADMIN_PREFIX}/boxes/:boxId/status`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;

    const boxId = c.req.param("boxId");
    const body = await c.req.json().catch(() => ({}));
    const status = body.status === "active" ? "active" : "paused";

    await c.env.DB.prepare(
      "UPDATE box_products SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(status, boxId).run();

    return c.json({ success: true, status });
  });

  // 5. Get global box orders
  app.get(`${ADMIN_PREFIX}/orders`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;

    const rows = await c.env.DB.prepare(
      "SELECT * FROM box_orders ORDER BY created_at DESC LIMIT 100"
    ).all<DbBoxOrder>();

    const ordersWithProducts = [];
    for (const row of rows.results) {
      const product = await c.env.DB.prepare("SELECT name, code FROM box_products WHERE id = ?").bind(row.box_product_id).first<any>();
      ordersWithProducts.push(toBoxOrder(row, product));
    }

    return c.json({ orders: ordersWithProducts });
  });

  // 6. Get work runs
  app.get(`${ADMIN_PREFIX}/work-runs`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;

    const status = c.req.query("status");
    let query = "SELECT * FROM agent_work_runs ";
    const params = [];

    if (status) {
      query += "WHERE status = ? ";
      params.push(status);
    }
    query += "ORDER BY created_at DESC LIMIT 100";

    const rows = await c.env.DB.prepare(query).bind(...params).all<DbWorkRun>();
    return c.json({ workRuns: rows.results.map(toWorkRun) });
  });

  // 7. Get Telegram sources
  app.get(`${ADMIN_PREFIX}/telegram/sources`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;

    const rows = await c.env.DB.prepare(
      "SELECT * FROM telegram_authorized_sources ORDER BY created_at DESC LIMIT 100"
    ).all();
    return c.json({ sources: (rows.results || []).map(serializeSource) });
  });

  // 8. Get Telegram ingestion events
  app.get(`${ADMIN_PREFIX}/telegram/ingestion-events`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;

    const rows = await c.env.DB.prepare(
      "SELECT * FROM telegram_ingestion_events ORDER BY created_at DESC LIMIT 100"
    ).all();
    return c.json({ events: (rows.results || []).map(serializeIngestionEvent) });
  });

  // 9. Get Telegram opportunity signals
  app.get(`${ADMIN_PREFIX}/telegram/opportunity-signals`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;

    const rows = await c.env.DB.prepare(
      "SELECT * FROM telegram_opportunity_signals ORDER BY created_at DESC LIMIT 100"
    ).all();
    return c.json({ signals: (rows.results || []).map(serializeSignal) });
  });

  // 10. Disable a Telegram source
  app.post(`${ADMIN_PREFIX}/telegram/sources/:id/disable`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;

    const id = c.req.param("id");
    const now = new Date().toISOString();

    const result = await c.env.DB.prepare(
      "UPDATE telegram_authorized_sources SET status = 'disabled', updated_at = ? WHERE id = ?"
    ).bind(now, id).run();

    if (result.meta.changes === 0) {
      return c.json({ error: "not_found", message: "Source not found" }, 404);
    }

    return c.json({ success: true, status: "disabled" });
  });

  // 11. Ignore a Telegram opportunity signal
  app.post(`${ADMIN_PREFIX}/telegram/opportunity-signals/:id/ignore`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;

    const id = c.req.param("id");
    const now = new Date().toISOString();

    const result = await c.env.DB.prepare(
      "UPDATE telegram_opportunity_signals SET status = 'ignored', updated_at = ? WHERE id = ?"
    ).bind(now, id).run();

    if (result.meta.changes === 0) {
      return c.json({ error: "not_found", message: "Signal not found" }, 404);
    }

    return c.json({ success: true, status: "ignored" });
  });
}
