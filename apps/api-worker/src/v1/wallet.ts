import { Hono, Context } from "hono";
import { Address } from "@ton/core";
import { 
  Bindings, 
  requireUser, 
  id, 
  toAgentWallet,
  defaultAgentWalletPolicy,
  DbAgentWallet,
  DbAssetDefinition,
  toAssetDefinition
} from "./core";
import { aiCreditBalanceDraft, defaultAssetBalances, summarizeAssetLedger } from "./asset-ledger";
import {
  SIMULATED_EXECUTION_GUARD,
  createAiModelTokenPurchaseIntentDraft,
  createOnchainIntentDraft,
  createTransactionEventDraft,
  purchaseIntentSummaryDraft
} from "./intent-service";

type AppContext = Context<{ Bindings: Bindings }>;

type WalletMetadata = Record<string, any>;

function parseWalletMetadata(row: DbAgentWallet): WalletMetadata {
  try {
    return row.metadata_json ? JSON.parse(row.metadata_json) : {};
  } catch {
    return {};
  }
}

function buildAssetBalances(row: DbAgentWallet | null) {
  return defaultAssetBalances(row?.updated_at ?? null);
}

function simulatedResponse<T extends Record<string, unknown>>(body: T): T & typeof SIMULATED_EXECUTION_GUARD {
  return { ...body, ...SIMULATED_EXECUTION_GUARD };
}

async function requireOwnedAgent(c: AppContext, agentId: string, userId: string) {
  const agent = await c.env.DB.prepare("SELECT user_id FROM agents WHERE id = ?").bind(agentId).first<any>();
  return Boolean(agent && agent.user_id === userId);
}

// TON address format validator using official @ton/core Address parser
function validateTonAddress(address: string): boolean {
  try {
    Address.parse(address.trim());
    return true;
  } catch {
    return false;
  }
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
      return c.json({ error: "invalid_address_format", message: "Invalid TON address format. Must be a valid bounceable/non-bounceable user-friendly address or raw hex address." }, 400);
    }

    // Standardize address using official toString()
    const standardized = Address.parse(address).toString({ testOnly: false, bounceable: true, urlSafe: true });

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
      ).bind(standardized, agentId).run();
    } else {
      // Insert
      await c.env.DB.prepare(
        `INSERT INTO agent_wallets (id, agent_id, user_id, address, wallet_type, permission_level, status)
         VALUES (?, ?, ?, ?, 'observation', 0, 'active')`
      ).bind(walletId, agentId, user.id, standardized).run();
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

    const wallet = toAgentWallet(row);
    return c.json(simulatedResponse({ wallet, agentWallet: wallet, walletPolicy: wallet.policy, assetBalances: buildAssetBalances(row), aiCreditBalance: aiCreditBalanceDraft(agentId, row.updated_at), purchaseIntentSummary: purchaseIntentSummaryDraft() }));
  });

  // 2a. Canonical Agent Wallet policy scaffold. This is simulated/policy-only;
  // it never stores seed phrases, never uses the user's main wallet key, and never executes live chain transactions.
  app.get("/agents/:agentId/wallet/policy", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");
    if (!(await requireOwnedAgent(c, agentId, user.id))) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }
    const row = await c.env.DB.prepare("SELECT * FROM agent_wallets WHERE agent_id = ?").bind(agentId).first<DbAgentWallet>();
    if (!row) {
      return c.json(simulatedResponse({ walletPolicy: defaultAgentWalletPolicy(null) }));
    }
    return c.json(simulatedResponse({ walletPolicy: defaultAgentWalletPolicy(row) }));
  });

  app.get("/agents/:agentId/wallet/assets", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");
    if (!(await requireOwnedAgent(c, agentId, user.id))) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }
    const row = await c.env.DB.prepare("SELECT * FROM agent_wallets WHERE agent_id = ?").bind(agentId).first<DbAgentWallet>();
    const assetBalances = buildAssetBalances(row || null);
    return c.json(simulatedResponse({ assetBalances, assetLedgerSummary: summarizeAssetLedger([]) }));
  });

  app.get("/agents/:agentId/wallet/intents", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");
    if (!(await requireOwnedAgent(c, agentId, user.id))) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }
    return c.json(simulatedResponse({ intents: [], purchaseIntentSummary: purchaseIntentSummaryDraft() }));
  });

  app.post("/agents/:agentId/wallet/intents/simulate", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");
    const body = await c.req.json().catch(() => ({}));
    if (!(await requireOwnedAgent(c, agentId, user.id))) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }
    const row = await c.env.DB.prepare("SELECT * FROM agent_wallets WHERE agent_id = ?").bind(agentId).first<DbAgentWallet>();
    const policy = defaultAgentWalletPolicy(row || null);
    const intent = createOnchainIntentDraft({
      userId: user.id,
      agentId,
      walletId: row?.id ?? null,
      policy,
      asset: body.asset || "G",
      amount: body.amount ?? "0",
      targetContract: body.contractAddress || null,
      provider: body.provider || null,
      purchaseType: body.purchaseType || null,
      purpose: body.purpose || "simulated_policy_guard_check"
    });
    const transactionEvent = createTransactionEventDraft({ intent });
    const aiPurchaseIntent = createAiModelTokenPurchaseIntentDraft({
      userId: user.id,
      agentId,
      walletId: row?.id ?? null,
      policy,
      productId: body.productId,
      provider: body.provider,
      modelId: body.modelId,
      spendAmount: body.amount ?? "0",
      expectedCredits: body.expectedCredits ?? "0"
    });
    return c.json(simulatedResponse({ intent, policyDecision: intent.policyDecision, transactionEvent, aiPurchaseIntent }));
  });

  // 3. Pause wallet
  app.post("/agents/:agentId/wallet/pause", async (c) => {
    const user = await requireUser(c);
    const agentId = c.req.param("agentId");

    const agent = await c.env.DB.prepare("SELECT user_id FROM agents WHERE id = ?").bind(agentId).first<any>();
    if (!agent || agent.user_id !== user.id) {
      return c.json({ error: "forbidden", message: "Forbidden" }, 403);
    }

    const wallet = await c.env.DB.prepare("SELECT * FROM agent_wallets WHERE agent_id = ?").bind(agentId).first<DbAgentWallet>();
    if (!wallet) {
      return c.json({ error: "wallet_not_found", message: "Wallet profile does not exist" }, 404);
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

    const wallet = await c.env.DB.prepare("SELECT * FROM agent_wallets WHERE agent_id = ?").bind(agentId).first<DbAgentWallet>();
    if (!wallet) {
      return c.json({ error: "wallet_not_found", message: "Wallet profile does not exist" }, 404);
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

    const wallet = await c.env.DB.prepare("SELECT * FROM agent_wallets WHERE agent_id = ?").bind(agentId).first<DbAgentWallet>();
    if (!wallet) {
      return c.json({ error: "wallet_not_found", message: "Wallet profile does not exist" }, 404);
    }

    const spendingLimitDaily = Math.max(0, Number(body.spendingLimitDaily ?? body.dailyLimit?.amount ?? 0));
    const transactionLimit = Math.max(0, Number(body.transactionLimit ?? body.perTransactionLimit?.amount ?? 0));
    const allowedActionsJson = JSON.stringify(body.allowedActions || body.allowedPurchaseTypes || []);
    const allowedContractsJson = JSON.stringify(body.allowedContracts || []);
    const withdrawalAddress = body.withdrawalAddress ? String(body.withdrawalAddress).trim() : null;
    const existingMetadata = parseWalletMetadata(wallet);
    const policyMetadata = {
      ...existingMetadata,
      autoPurchaseEnabled: body.autoPurchaseEnabled ?? existingMetadata.autoPurchaseEnabled ?? false,
      allowedAssets: body.allowedAssets ?? existingMetadata.allowedAssets ?? ["G", "TON", "AI_CREDIT"],
      allowedProviders: body.allowedProviders ?? existingMetadata.allowedProviders ?? [],
      allowedPurchaseTypes: body.allowedPurchaseTypes ?? existingMetadata.allowedPurchaseTypes ?? ["ai_model_token", "ai_credit"],
      requireConfirmationAbove: body.requireConfirmationAbove?.amount ?? body.requireConfirmationAbove ?? existingMetadata.requireConfirmationAbove ?? null,
      adminGlobalPause: body.adminGlobalPause ?? existingMetadata.adminGlobalPause ?? false,
      userPaused: body.userPaused ?? existingMetadata.userPaused ?? false,
      riskMode: body.riskMode ?? existingMetadata.riskMode ?? "conservative",
      minimumReserve: body.minimumReserve?.amount ?? body.minimumReserve ?? existingMetadata.minimumReserve ?? "0"
    };

    if (withdrawalAddress && !validateTonAddress(withdrawalAddress)) {
      return c.json({ error: "invalid_withdrawal_address", message: "Invalid withdrawal TON address format" }, 400);
    }

    const standardizedWithdrawal = withdrawalAddress 
      ? Address.parse(withdrawalAddress).toString({ testOnly: false, bounceable: true, urlSafe: true }) 
      : null;

    await c.env.DB.prepare(
      `UPDATE agent_wallets 
       SET spending_limit_daily = ?, transaction_limit = ?, allowed_actions_json = ?, allowed_contracts_json = ?, withdrawal_address = ?, metadata_json = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE agent_id = ?`
    ).bind(spendingLimitDaily, transactionLimit, allowedActionsJson, allowedContractsJson, standardizedWithdrawal, JSON.stringify(policyMetadata), agentId).run();

    const row = await c.env.DB.prepare("SELECT * FROM agent_wallets WHERE agent_id = ?").bind(agentId).first<DbAgentWallet>();
    const updatedWallet = toAgentWallet(row!);
    return c.json(simulatedResponse({ wallet: updatedWallet, agentWallet: updatedWallet, walletPolicy: updatedWallet.policy }));
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
