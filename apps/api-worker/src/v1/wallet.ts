import { Hono, Context } from "hono";
import { 
  Bindings, 
  requireUser, 
  id, 
  toAgentWallet,
  DbAgentWallet,
  DbAssetDefinition,
  toAssetDefinition
} from "../index";

type AppContext = Context<{ Bindings: Bindings }>;

// Simple TON address format validator
function validateTonAddress(address: string): boolean {
  address = address.trim();
  // Validates base64 url-safe 48-char user friendly address (starts with E or k)
  // or a 64-char hex raw address
  if (/^[a-zA-Z0-9_\-]{48}$/.test(address)) return true;
  if (/^[0-9a-fA-F]{64}$/.test(address)) return true;
  return false;
}

export function registerV1Wallet(app: Hono<{ Bindings: Bindings }>) {
  // 1. Link a public TON address (creates or updates observation profile)
  app.post("/agents/:agentId/wallet/link", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");
    const body = await c.req.json().catch(() => ({}));
    const address = String(body.address || "").trim();

    if (!address) {
      return c.json({ error: "address_required", message: "Address is required" }, 400);
    }

    if (!validateTonAddress(address)) {
      return c.json({ error: "invalid_address_format", message: "Invalid TON address format. Must be a 48-character user-friendly address or 64-character hex address." }, 400);
    }

    // Check ownership of the agent
    const agent = await c.env.DB.prepare("SELECT user_id FROM agents WHERE id = ?").bind(agentId).first<any>();
    if (!agent || agent.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }

    // Check if wallet already exists
    const existing = await c.env.DB.prepare(
      "SELECT id FROM agent_wallets WHERE agent_id = ?"
    ).bind(agentId).first<any>();

    const walletId = existing?.id || id("wallet");

    if (existing) {
      // Update
      await c.env.DB.prepare(
        `UPDATE agent_wallets 
         SET address = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE agent_id = ?`
      ).bind(address, agentId).run();
    } else {
      // Insert
      await c.env.DB.prepare(
        `INSERT INTO agent_wallets (id, agent_id, user_id, address, wallet_type, permission_level, status)
         VALUES (?, ?, ?, ?, 'observation', 0, 'active')`
      ).bind(walletId, agentId, user.id, address).run();
    }

    const row = await c.env.DB.prepare("SELECT * FROM agent_wallets WHERE id = ?").bind(walletId).first<DbAgentWallet>();
    return c.json({ wallet: toAgentWallet(row!) });
  });

  // Backward compatible POST /agents/:agentId/wallet
  app.post("/agents/:agentId/wallet", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");
    
    // Check ownership of the agent
    const agent = await c.env.DB.prepare("SELECT user_id FROM agents WHERE id = ?").bind(agentId).first<any>();
    if (!agent || agent.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }

    // Check if wallet already exists
    const existing = await c.env.DB.prepare(
      "SELECT * FROM agent_wallets WHERE agent_id = ?"
    ).bind(agentId).first<DbAgentWallet>();

    if (existing) {
      return c.json({ wallet: toAgentWallet(existing) });
    }

    // No wallet exists - user must link via /agents/:agentId/wallet/link with a real address
    return c.json({ 
      error: "wallet_not_linked", 
      message: "No wallet linked. Use POST /agents/:agentId/wallet/link with your real TON public address." 
    }, 400);
  });

  // 2. Read wallet status
  app.get("/agents/:agentId/wallet", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");

    // Check ownership of the agent
    const agent = await c.env.DB.prepare("SELECT user_id FROM agents WHERE id = ?").bind(agentId).first<any>();
    if (!agent || agent.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }

    const row = await c.env.DB.prepare("SELECT * FROM agent_wallets WHERE agent_id = ?").bind(agentId).first<DbAgentWallet>();
    if (!row) {
      return c.json({ wallet: null });
    }

    return c.json({ wallet: toAgentWallet(row) });
  });

  // 3. Pause wallet
  app.post("/agents/:agentId/wallet/pause", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");

    const agent = await c.env.DB.prepare("SELECT user_id FROM agents WHERE id = ?").bind(agentId).first<any>();
    if (!agent || agent.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }

    await c.env.DB.prepare(
      "UPDATE agent_wallets SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE agent_id = ?"
    ).bind(agentId).run();

    const row = await c.env.DB.prepare("SELECT * FROM agent_wallets WHERE agent_id = ?").bind(agentId).first<DbAgentWallet>();
    return c.json({ wallet: toAgentWallet(row!) });
  });

  // 4. Resume wallet
  app.post("/agents/:agentId/wallet/resume", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");

    const agent = await c.env.DB.prepare("SELECT user_id FROM agents WHERE id = ?").bind(agentId).first<any>();
    if (!agent || agent.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }

    await c.env.DB.prepare(
      "UPDATE agent_wallets SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE agent_id = ?"
    ).bind(agentId).run();

    const row = await c.env.DB.prepare("SELECT * FROM agent_wallets WHERE agent_id = ?").bind(agentId).first<DbAgentWallet>();
    return c.json({ wallet: toAgentWallet(row!) });
  });

  // 5. Update limits/policies (observation mode configurations only)
  app.put("/agents/:agentId/wallet/policy", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");
    const body = await c.req.json().catch(() => ({}));

    const agent = await c.env.DB.prepare("SELECT user_id FROM agents WHERE id = ?").bind(agentId).first<any>();
    if (!agent || agent.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }

    const spendingLimitDaily = Math.max(0, Number(body.spendingLimitDaily || 0));
    const transactionLimit = Math.max(0, Number(body.transactionLimit || 0));
    const allowedActionsJson = JSON.stringify(body.allowedActions || []);
    const allowedContractsJson = JSON.stringify(body.allowedContracts || []);
    const withdrawalAddress = body.withdrawalAddress ? String(body.withdrawalAddress).trim() : null;

    await c.env.DB.prepare(
      `UPDATE agent_wallets 
       SET spending_limit_daily = ?, transaction_limit = ?, allowed_actions_json = ?, allowed_contracts_json = ?, withdrawal_address = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE agent_id = ?`
    ).bind(spendingLimitDaily, transactionLimit, allowedActionsJson, allowedContractsJson, withdrawalAddress, agentId).run();

    const row = await c.env.DB.prepare("SELECT * FROM agent_wallets WHERE agent_id = ?").bind(agentId).first<DbAgentWallet>();
    return c.json({ wallet: toAgentWallet(row!) });
  });

  // 6. Transaction history (returns structured observation details)
  app.get("/agents/:agentId/wallet/transactions", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");

    const agent = await c.env.DB.prepare("SELECT user_id FROM agents WHERE id = ?").bind(agentId).first<any>();
    if (!agent || agent.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }

    return c.json({
      supported: false,
      mode: "observation",
      reason: "Agentic Wallet is currently in Level 0 (Observation Mode) and does not perform active on-chain transactions.",
      transactions: []
    });
  });

  // 7. Public assets catalog
  app.get("/assets/catalog", async (c) => {
    await requireUser(c);
    const rows = await c.env.DB.prepare(
      "SELECT * FROM asset_definitions WHERE status = 'enabled' ORDER BY required_level ASC"
    ).all<DbAssetDefinition>();
    return c.json({ catalog: rows.results.map(toAssetDefinition) });
  });
}
