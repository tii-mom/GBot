import { Hono } from "hono";
import type {
  Agent,
  AgentWallet,
  AgentWalletPolicy,
  AdminRealAssetAuditEvent,
  AdminRealAssetRiskConsole,
  AdminRealAssetRiskConsoleAgent,
  RealAssetConsoleResponse,
  RealAssetEvidence,
  RealAssetEvidenceSection,
  RealAssetSummary,
  OnchainTransactionEvent,
  OnchainTransactionIntent,
  AiModelTokenPurchaseIntent
} from "@growthbot/shared";
import { defaultAgentWalletPolicy, requireAdmin, toAgent, toAgentWallet, type AppContext, type Bindings, type DbAgent, type DbAgentWallet } from "./core";
import {
  SIMULATED_EXECUTION_GUARD,
  createAiModelTokenPurchaseIntentDraft,
  createOnchainIntentDraft,
  createTransactionEventDraft,
  workReportEvidenceDraft
} from "./intent-service";

type AdminAuditRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata_json: string | null;
  created_at: string;
};

function buildAssetSnapshot(wallet: AgentWallet | null, policy: AgentWalletPolicy): AgentWallet["assetBalances"] extends infer T ? NonNullable<T> : never {
  return wallet?.assetBalances ?? [];
}

function flatAgentRow(
  agent: Agent,
  wallet: AgentWallet | null,
  policy: AgentWalletPolicy,
  onchainIntents: OnchainTransactionIntent[],
  aiModelTokenPurchaseIntents: AiModelTokenPurchaseIntent[],
  evidenceSections: RealAssetEvidenceSection[],
  readinessGaps: string[],
  lastReviewedAt: string | null
): AdminRealAssetRiskConsoleAgent {
  const latestIntent = [...onchainIntents, ...aiModelTokenPurchaseIntents].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  const latestEvidence = evidenceSections.flatMap((section) => section.items).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  return {
    agent,
    wallet,
    walletPolicy: policy,
    assetSnapshot: {
      walletId: wallet?.id ?? agent.id,
      agentId: agent.id,
      balances: buildAssetSnapshot(wallet, policy),
      policy,
      updatedAt: wallet?.updatedAt ?? null
    },
    agentId: agent.id,
    userId: wallet?.userId ?? "",
    displayName: agent.name,
    walletStatus: wallet?.status ?? "pending_setup",
    riskMode: policy.riskMode,
    autoPurchaseEnabled: policy.autoPurchaseEnabled,
    latestIntentStatus: latestIntent?.status ?? "",
    latestEvidenceStatus: latestEvidence?.status ?? "",
    updatedAt: wallet?.updatedAt ?? null,
    onchainIntents,
    aiModelTokenPurchaseIntents,
    evidenceSections,
    readinessGaps,
    lastReviewedAt
  };
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function amountValue(input: { amount: string } | null | undefined): string {
  return input?.amount ?? "0";
}

function evidenceFromIntent(intent: OnchainTransactionIntent, titlePrefix: string): RealAssetEvidence {
  return {
    id: `evi_${intent.id}`,
    kind: "onchain_intent",
    title: `${titlePrefix}: ${intent.id}`,
    summary: `${intent.status} ${amountValue(intent.amount)} ${intent.asset} via ${intent.provider || "no provider"}`,
    status: intent.policyDecision?.status || intent.status,
    agentId: intent.agentId,
    walletId: intent.walletId,
    intentId: intent.id,
    purchaseIntentId: null,
    eventId: null,
    createdAt: intent.createdAt,
    metadata: {
      ...SIMULATED_EXECUTION_GUARD,
      reasons: intent.policyDecision?.reasons || [],
      purchaseType: intent.purchaseType,
      contractAddress: intent.targetContract
    }
  };
}

function evidenceFromPurchaseIntent(intent: AiModelTokenPurchaseIntent): RealAssetEvidence {
  return {
    id: `evi_${intent.id}`,
    kind: "ai_purchase_intent",
    title: `AI Model Token purchase: ${intent.id}`,
    summary: `${intent.status} spend ${amountValue(intent.spend)} G for ${intent.modelId}`,
    status: intent.policyDecision?.status || intent.status,
    agentId: intent.agentId,
    walletId: intent.walletId,
    intentId: intent.relatedOnchainIntentId,
    purchaseIntentId: intent.id,
    eventId: null,
    createdAt: intent.createdAt,
    metadata: {
      ...SIMULATED_EXECUTION_GUARD,
      provider: intent.provider,
      modelId: intent.modelId,
      productId: intent.productId
    }
  };
}

function evidenceFromWallet(agentId: string, wallet: AgentWallet | null, policy: AgentWalletPolicy): RealAssetEvidence {
  return {
    id: `evi_wallet_${agentId}`,
    kind: "wallet_policy",
    title: `Agent Wallet policy: ${agentId}`,
    summary: `status=${policy.status}, autoPurchaseEnabled=${String(policy.autoPurchaseEnabled)}, liveExecution=false`,
    status: policy.status,
    agentId,
    walletId: wallet?.id ?? null,
    intentId: null,
    purchaseIntentId: null,
    eventId: null,
    createdAt: wallet?.updatedAt ?? new Date().toISOString(),
    metadata: {
      ...SIMULATED_EXECUTION_GUARD,
      allowedAssets: policy.allowedAssets,
      allowedContracts: policy.allowedContracts,
      allowedProviders: policy.allowedProviders,
      allowedPurchaseTypes: policy.allowedPurchaseTypes,
      adminGlobalPause: policy.adminGlobalPause,
      userPaused: policy.userPaused,
      riskMode: policy.riskMode
    }
  };
}

function evidenceFromAuditEvent(event: AdminRealAssetAuditEvent): RealAssetEvidence {
  return {
    id: `evi_audit_${event.eventType}_${event.createdAt}`,
    kind: "audit_event",
    title: event.eventType,
    summary: event.summary,
    status: "recorded",
    agentId: null,
    walletId: null,
    intentId: null,
    purchaseIntentId: null,
    eventId: event.eventType,
    createdAt: event.createdAt,
    metadata: event.metadata
  };
}

function evidenceSectionsForAgent(
  agent: Agent,
  wallet: AgentWallet | null,
  policy: AgentWalletPolicy,
  onchainIntents: OnchainTransactionIntent[],
  aiModelTokenPurchaseIntents: AiModelTokenPurchaseIntent[],
  auditEvents: AdminRealAssetAuditEvent[]
): RealAssetEvidenceSection[] {
  const walletEvidence = evidenceFromWallet(agent.id, wallet, policy);
  return [
    {
      key: "policy",
      title: "Wallet policy",
      description: "Simulation-only policy state for review.",
      items: [walletEvidence]
    },
    {
      key: "intents",
      title: "Purchase intents",
      description: "Onchain intents and AI Model Token purchase intents awaiting review.",
      items: [
        ...onchainIntents.map((intent) => evidenceFromIntent(intent, "Onchain intent")),
        ...aiModelTokenPurchaseIntents.map((intent) => evidenceFromPurchaseIntent(intent))
      ]
    },
    {
      key: "audit",
      title: "Audit evidence",
      description: "Review-only audit events and work report evidence.",
      items: [
        ...auditEvents.map((event) => evidenceFromAuditEvent(event)),
        ...workReportEvidenceDraft({
          onchainIntent: onchainIntents[0] ?? null,
          transactionEvent: onchainIntents[0] ? createTransactionEventDraft({ intent: onchainIntents[0] }) : null,
          aiPurchaseIntent: aiModelTokenPurchaseIntents[0] ?? null,
          skillCards: []
        }).map((item, index) => ({
          id: `evi_wr_${agent.id}_${index}`,
          kind: "work_report" as const,
          title: `Work report evidence ${index + 1}`,
          summary: JSON.stringify(item),
          status: "simulated",
          agentId: agent.id,
          walletId: wallet?.id ?? null,
          intentId: onchainIntents[0]?.id ?? null,
          purchaseIntentId: aiModelTokenPurchaseIntents[0]?.id ?? null,
          eventId: null,
          createdAt: wallet?.updatedAt ?? new Date().toISOString(),
          metadata: item as Record<string, unknown>
        }))
      ]
    }
  ];
}

function readinessGapsFromPolicy(policy: AgentWalletPolicy): string[] {
  const gaps = ["No live execution is enabled in Admin Risk Console V1."];
  if (!policy.autoPurchaseEnabled) gaps.push("autoPurchaseEnabled is false.");
  if (policy.adminGlobalPause) gaps.push("adminGlobalPause is set.");
  if (!policy.allowedContracts.length) gaps.push("No contract allowlist configured.");
  if (!policy.allowedProviders.length) gaps.push("No provider allowlist configured.");
  return gaps;
}

function mapAuditEvent(row: AdminAuditRow): AdminRealAssetAuditEvent {
  const metadata = parseJson<Record<string, unknown>>(row.metadata_json, {});
  const targetType = row.target_type || "unknown";
  const targetId = row.target_id || row.target_type;
  return {
    id: row.id,
    eventType: row.action,
    actor: String(metadata.operator || "系统管理员"),
    targetType,
    targetId,
    summary: String(metadata.afterValue || metadata.beforeValue || row.action),
    createdAt: row.created_at,
    metadata
  };
}

function countIntentState(onchainIntents: OnchainTransactionIntent[], purchaseIntents: AiModelTokenPurchaseIntent[]) {
  const counts = {
    allowed: 0,
    denied: 0,
    requires_confirmation: 0,
    paused: 0,
    proposed: 0,
    queued: 0,
    executing: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0
  };
  for (const intent of onchainIntents) {
    if (intent.policyDecision?.status === "allowed") counts.allowed += 1;
    if (intent.policyDecision?.status === "denied") counts.denied += 1;
    if (intent.policyDecision?.status === "requires_confirmation") counts.requires_confirmation += 1;
    if (intent.policyDecision?.status === "paused") counts.paused += 1;
    if (intent.status in counts) counts[intent.status as keyof typeof counts] += 1;
  }
  for (const intent of purchaseIntents) {
    if (intent.policyDecision?.status === "allowed") counts.allowed += 1;
    if (intent.policyDecision?.status === "denied") counts.denied += 1;
    if (intent.policyDecision?.status === "requires_confirmation") counts.requires_confirmation += 1;
    if (intent.policyDecision?.status === "paused") counts.paused += 1;
    if (intent.status in counts) counts[intent.status as keyof typeof counts] += 1;
  }
  return counts;
}

export async function buildAdminRealAssetRiskConsole(c: AppContext): Promise<AdminRealAssetRiskConsole> {
  const [agentRows, walletRows, auditRows] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM agents ORDER BY created_at DESC LIMIT 12").all<DbAgent>(),
    c.env.DB.prepare("SELECT * FROM agent_wallets ORDER BY created_at DESC LIMIT 12").all<DbAgentWallet>(),
    c.env.DB.prepare("SELECT id, action, target_type, target_id, metadata_json, created_at FROM admin_config_audit_logs ORDER BY created_at DESC LIMIT 50").all<AdminAuditRow>()
  ]);

  const agents: AdminRealAssetRiskConsoleAgent[] = [];
  const auditEvents = auditRows.results.map(mapAuditEvent);
  const walletPolicies: AgentWalletPolicy[] = [];
  const onchainIntents: OnchainTransactionIntent[] = [];
  const purchaseIntents: AiModelTokenPurchaseIntent[] = [];
  const evidenceSections: RealAssetEvidenceSection[] = [];
  const transactionEvents: OnchainTransactionEvent[] = [];
  let lastReviewedAt: string | null = null;

  for (const agentRow of agentRows.results) {
    const agent = await toAgent(c.env.DB, agentRow);
    const walletRow = walletRows.results.find((row) => row.agent_id === agent.id) || null;
    const wallet = walletRow ? toAgentWallet(walletRow) : null;
    const policy = defaultAgentWalletPolicy(walletRow);
    const reviewedAt = wallet?.updatedAt ?? agentRow.updated_at ?? agentRow.created_at ?? null;
    walletPolicies.push(policy);

    const onchainIntent = createOnchainIntentDraft({
      userId: agentRow.user_id,
      agentId: agent.id,
      walletId: wallet?.id ?? null,
      policy,
      asset: "G",
      amount: wallet ? Math.max(1, Math.min(50, Number(policy.requireConfirmationAbove?.amount ?? policy.perTransactionLimit.amount ?? 0) || 18)) : 18,
      targetContract: policy.allowedContracts[0] || "EQD_SIMULATED_AI_CREDIT_ROUTER",
      provider: policy.allowedProviders[0] || "simulated-provider",
      purchaseType: "ai_model_token",
      purpose: "simulated_admin_review"
    });
    const purchaseIntent = createAiModelTokenPurchaseIntentDraft({
      userId: agentRow.user_id,
      agentId: agent.id,
      walletId: wallet?.id ?? null,
      policy,
      productId: "simulated-ai-credit-pack",
      provider: policy.allowedProviders[0] || "simulated-provider",
      modelId: "simulated-model",
      spendAmount: onchainIntent.amount.amount,
      expectedCredits: "1800"
    });
    const transactionEvent = createTransactionEventDraft({ intent: onchainIntent });
    transactionEvents.push(transactionEvent);
    workReportEvidenceDraft({
      onchainIntent,
      transactionEvent,
      aiPurchaseIntent: purchaseIntent,
      skillCards: []
    });
    const sections = evidenceSectionsForAgent(agent, wallet, policy, [onchainIntent], [purchaseIntent], auditEvents.slice(0, 2));

    onchainIntents.push(onchainIntent);
    purchaseIntents.push(purchaseIntent);
    evidenceSections.push(...sections);
    agents.push(flatAgentRow(agent, wallet, policy, [onchainIntent], [purchaseIntent], sections, readinessGapsFromPolicy(policy), reviewedAt));
    lastReviewedAt = reviewedAt ?? lastReviewedAt;
  }

  const intentState = countIntentState(onchainIntents, purchaseIntents);
  const assetAllowlist = Array.from(new Set(walletPolicies.flatMap((policy) => policy.allowedAssets)));
  const providerAllowlist = Array.from(new Set(walletPolicies.flatMap((policy) => policy.allowedProviders)));
  const contractAllowlist = Array.from(new Set(walletPolicies.flatMap((policy) => policy.allowedContracts)));
  const purchaseTypeAllowlist = Array.from(new Set(walletPolicies.flatMap((policy) => policy.allowedPurchaseTypes)));
  const realAssetSummary: RealAssetSummary = {
    agentCount: agents.length,
    walletPolicyCount: walletPolicies.length,
    onchainIntentCount: onchainIntents.length,
    purchaseIntentCount: purchaseIntents.length,
    evidenceCount: evidenceSections.reduce((sum, section) => sum + section.items.length, 0),
    auditEventCount: auditEvents.length,
    allowedCount: intentState.allowed,
    deniedCount: intentState.denied,
    requiresConfirmationCount: intentState.requires_confirmation,
    pausedCount: intentState.paused,
    readinessGaps: [
      "Admin Risk Console V1 is review-only.",
      "No live execution is enabled.",
      "No custody / seed phrase / private key access exists."
    ],
    lastReviewedAt
  };

  return {
    mode: "simulated",
    dataSource: "api",
    generatedAt: new Date().toISOString(),
    liveExecution: false,
    custody: false,
    mainWalletControl: false,
    globalRisk: {
      adminGlobalPause: walletPolicies.some((policy) => policy.adminGlobalPause),
      allowedAssets: assetAllowlist,
      allowedProviders: providerAllowlist,
      allowedContracts: contractAllowlist,
      allowedPurchaseTypes: purchaseTypeAllowlist,
      defaultRiskMode: walletPolicies[0]?.riskMode || "conservative",
      testnetExecutorReady: false,
      liveExecutorReady: false,
      reason: "Simulation-only admin review surface."
    },
    walletPolicy: walletPolicies[0] || defaultAgentWalletPolicy(null),
    globalControls: {
      adminGlobalPause: walletPolicies.some((policy) => policy.adminGlobalPause),
      providerAllowlist,
      contractAllowlist,
      assetAllowlist,
      purchaseTypeAllowlist
    },
    realAssetSummary,
    walletPolicies: walletPolicies.map((policy, index) => ({
      agentId: agents[index]?.agentId ?? `agent_${index}`,
      userId: agents[index]?.userId ?? `user_${index}`,
      displayName: agents[index]?.displayName ?? `Agent ${index + 1}`,
      walletId: agents[index]?.wallet?.id ?? null,
      walletStatus: agents[index]?.walletStatus ?? "pending_setup",
      riskMode: policy.riskMode,
      autoPurchaseEnabled: policy.autoPurchaseEnabled,
      perTransactionLimit: policy.perTransactionLimit,
      dailyLimit: policy.dailyLimit,
      minimumReserve: policy.minimumReserve,
      allowedAssets: policy.allowedAssets,
      allowedContracts: policy.allowedContracts,
      allowedProviders: policy.allowedProviders,
      allowedPurchaseTypes: policy.allowedPurchaseTypes,
      requireConfirmationAbove: policy.requireConfirmationAbove,
      adminGlobalPause: policy.adminGlobalPause,
      userPaused: policy.userPaused,
      status: policy.status,
      updatedAt: agents[index]?.updatedAt ?? null,
      assetSnapshot: agents[index]?.assetSnapshot ?? {
        walletId: agents[index]?.wallet?.id ?? agents[index]?.agentId ?? "",
        agentId: agents[index]?.agentId ?? "",
        balances: [],
        policy,
        updatedAt: agents[index]?.updatedAt ?? null
      }
    })),
    purchaseIntents: purchaseIntents.map((intent) => ({
      kind: "ai_purchase_intent",
      id: intent.id,
      userId: intent.userId,
      agentId: intent.agentId,
      walletId: intent.walletId,
      status: intent.status,
      asset: "G",
      amount: intent.spend,
      provider: intent.provider,
      modelId: intent.modelId,
      purchaseType: "ai_model_token",
      purpose: `purchase ${intent.productId}`,
      policyDecision: intent.policyDecision,
      createdAt: intent.createdAt,
      updatedAt: intent.updatedAt,
      targetContract: null,
      expectedCredits: intent.expectedCredits,
      productId: intent.productId
    })),
    policyDecisions: [...onchainIntents, ...purchaseIntents].flatMap((intent) => intent.policyDecision ? [{
      intentId: intent.id,
      intentKind: "ai_purchase_intent" as const,
      status: intent.policyDecision.status,
      reasons: intent.policyDecision.reasons,
      requiredConfirmation: intent.policyDecision.requiredConfirmation,
      riskMode: intent.policyDecision.riskMode,
      evaluatedAt: intent.policyDecision.evaluatedAt,
      summary: JSON.stringify(intent.policyDecision.inputSummary)
    }] : []),
    intentStates: [
      { status: "proposed", count: onchainIntents.filter((intent) => intent.status === "proposed").length + purchaseIntents.filter((intent) => intent.status === "proposed").length, description: "Waiting for policy or user confirmation" },
      { status: "allowed", count: onchainIntents.filter((intent) => intent.status === "allowed").length + purchaseIntents.filter((intent) => intent.status === "allowed").length, description: "Policy Guard allowed simulation" },
      { status: "denied", count: onchainIntents.filter((intent) => intent.status === "denied").length + purchaseIntents.filter((intent) => intent.status === "denied").length, description: "Blocked by limit or allowlist" },
      { status: "queued", count: 0, description: "Future executor queue" },
      { status: "executing", count: 0, description: "Future executor in progress" },
      { status: "succeeded", count: 0, description: "Future completed transaction" },
      { status: "failed", count: 0, description: "Future failed transaction" },
      { status: "cancelled", count: 0, description: "Cancelled before execution" },
      { status: "paused", count: walletPolicies.filter((policy) => policy.status === "paused").length, description: "Stopped by global or user pause" }
    ],
    onchainIntents,
    aiModelTokenPurchaseIntents: purchaseIntents,
    transactionEvents,
    agents,
    evidenceSections,
    auditEvents,
    evidence: evidenceSections.flatMap((section) => section.items),
    assetSnapshots: agents.map((agent) => agent.assetSnapshot),
    readinessGaps: [
      {
        key: "missingDbPersistence",
        label: "DB persistence",
        detail: "Admin Risk Console V1 snapshot is read-only.",
        blocked: false
      }
    ],
    lastReviewedAt
  };
}

export async function buildRealAssetConsoleResponse(c: AppContext): Promise<RealAssetConsoleResponse<AdminRealAssetRiskConsole>> {
  try {
    const data = await buildAdminRealAssetRiskConsole(c);
    const generatedAt = data.generatedAt;
    return {
      dataSource: "api",
      source: "api",
      loading: false,
      error: null,
      stale: false,
      fallbackReason: null,
      generatedAt,
      refreshedAt: generatedAt,
      data
    };
  } catch (error) {
    const fallbackPolicy = defaultAgentWalletPolicy(null);
    const fallbackData: AdminRealAssetRiskConsole = {
      mode: "simulated",
      dataSource: "fallback_mock",
      generatedAt: new Date().toISOString(),
      liveExecution: false,
      custody: false,
      mainWalletControl: false,
      globalRisk: {
        adminGlobalPause: fallbackPolicy.adminGlobalPause,
        allowedAssets: fallbackPolicy.allowedAssets,
        allowedProviders: fallbackPolicy.allowedProviders,
        allowedContracts: fallbackPolicy.allowedContracts,
        allowedPurchaseTypes: fallbackPolicy.allowedPurchaseTypes,
        defaultRiskMode: fallbackPolicy.riskMode,
        testnetExecutorReady: false,
        liveExecutorReady: false,
        reason: "Fallback mock data used because the API console snapshot could not be loaded."
      },
      walletPolicy: fallbackPolicy,
      globalControls: {
        adminGlobalPause: fallbackPolicy.adminGlobalPause,
        providerAllowlist: fallbackPolicy.allowedProviders,
        contractAllowlist: fallbackPolicy.allowedContracts,
        assetAllowlist: fallbackPolicy.allowedAssets,
        purchaseTypeAllowlist: fallbackPolicy.allowedPurchaseTypes
      },
      realAssetSummary: {
        agentCount: 0,
        walletPolicyCount: 0,
        onchainIntentCount: 0,
        purchaseIntentCount: 0,
        evidenceCount: 0,
        auditEventCount: 0,
        allowedCount: 0,
        deniedCount: 0,
        requiresConfirmationCount: 0,
        pausedCount: 0,
        readinessGaps: ["Fallback mock data used because the API console snapshot could not be loaded."],
        lastReviewedAt: null
      },
      walletPolicies: [],
      purchaseIntents: [],
      policyDecisions: [],
      evidence: [],
      assetSnapshots: [],
      readinessGaps: [
        {
          key: "missingDbPersistence",
          label: "DB persistence",
          detail: "Fallback mock console snapshot is read-only.",
          blocked: false
        }
      ],
      intentStates: [
        { status: "proposed", count: 0, description: "Waiting for policy or user confirmation" },
        { status: "allowed", count: 0, description: "Policy Guard allowed simulation" },
        { status: "denied", count: 0, description: "Blocked by limit or allowlist" },
        { status: "queued", count: 0, description: "Future executor queue" },
        { status: "executing", count: 0, description: "Future executor in progress" },
        { status: "succeeded", count: 0, description: "Future completed transaction" },
        { status: "failed", count: 0, description: "Future failed transaction" },
        { status: "cancelled", count: 0, description: "Cancelled before execution" },
        { status: "paused", count: 0, description: "Stopped by global or user pause" }
      ],
      onchainIntents: [],
      aiModelTokenPurchaseIntents: [],
      transactionEvents: [],
      agents: [],
      evidenceSections: [],
      auditEvents: [],
      lastReviewedAt: null
    };
    return {
      dataSource: "fallback_mock",
      source: "fallback_mock",
      loading: false,
      error: error instanceof Error ? error.message : "Failed to load real asset console snapshot.",
      stale: true,
      fallbackReason: "api_unavailable",
      generatedAt: fallbackData.generatedAt,
      refreshedAt: fallbackData.generatedAt,
      data: fallbackData
    };
  }
}

function responseFromData<T>(data: T, source: "api" | "fallback_mock", error: string | null, fallbackReason: string | null): RealAssetConsoleResponse<T> {
  const generatedAt = new Date().toISOString();
  return {
    dataSource: source,
    source,
    loading: false,
    error,
    stale: source === "fallback_mock",
    fallbackReason,
    generatedAt,
    refreshedAt: generatedAt,
    data
  };
}

function findAgentBundle(data: AdminRealAssetRiskConsole, agentId: string) {
  return data.agents.find((entry) => entry.agent.id === agentId) || null;
}

function flattenEvidenceSections(sections: RealAssetEvidenceSection[]) {
  return sections.flatMap((section) => section.items);
}

export function registerV1RealAssetAdmin(app: Hono<{ Bindings: Bindings }>) {
  const ADMIN_PREFIX = "/admin/real-asset";

  app.get(`${ADMIN_PREFIX}/risk-console`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;
    return c.json(await buildRealAssetConsoleResponse(c));
  });

  app.get(`${ADMIN_PREFIX}/agents`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;
    const consoleData = await buildAdminRealAssetRiskConsole(c);
    return c.json(responseFromData({ agents: consoleData.agents, realAssetSummary: consoleData.realAssetSummary }, "api", null, null));
  });

  app.get(`${ADMIN_PREFIX}/agents/:agentId/wallet-policy`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;
    const agentId = c.req.param("agentId");
    const consoleData = await buildAdminRealAssetRiskConsole(c);
    const bundle = findAgentBundle(consoleData, agentId);
    if (!bundle) {
      return c.json(responseFromData({
        agentId,
        wallet: null,
        walletPolicy: defaultAgentWalletPolicy(null),
        policyDecision: null,
        readinessGaps: ["Agent not found in simulated console snapshot."],
        lastReviewedAt: null
      }, "fallback_mock", `Agent ${agentId} not found in simulated console snapshot.`, "agent_not_found"));
    }
    return c.json(responseFromData({
      agent: bundle.agent,
      wallet: bundle.wallet,
      walletPolicy: bundle.walletPolicy,
      policyDecision: bundle.onchainIntents[0]?.policyDecision || bundle.aiModelTokenPurchaseIntents[0]?.policyDecision || null,
      readinessGaps: bundle.readinessGaps,
      lastReviewedAt: bundle.lastReviewedAt
    }, "api", null, null));
  });

  app.get(`${ADMIN_PREFIX}/agents/:agentId/intents`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;
    const agentId = c.req.param("agentId");
    const consoleData = await buildAdminRealAssetRiskConsole(c);
    const bundle = findAgentBundle(consoleData, agentId);
    if (!bundle) {
      return c.json(responseFromData({ agentId, onchainIntents: [], aiModelTokenPurchaseIntents: [], realAssetSummary: consoleData.realAssetSummary }, "fallback_mock", `Agent ${agentId} not found in simulated console snapshot.`, "agent_not_found"));
    }
    return c.json(responseFromData({
      agentId,
      onchainIntents: bundle.onchainIntents,
      aiModelTokenPurchaseIntents: bundle.aiModelTokenPurchaseIntents,
      realAssetSummary: consoleData.realAssetSummary
    }, "api", null, null));
  });

  app.get(`${ADMIN_PREFIX}/agents/:agentId/evidence`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;
    const agentId = c.req.param("agentId");
    const consoleData = await buildAdminRealAssetRiskConsole(c);
    const bundle = findAgentBundle(consoleData, agentId);
    if (!bundle) {
      return c.json(responseFromData({ agentId, evidenceSections: [], evidence: [] }, "fallback_mock", `Agent ${agentId} not found in simulated console snapshot.`, "agent_not_found"));
    }
    return c.json(responseFromData({
      agentId,
      evidenceSections: bundle.evidenceSections,
      evidence: flattenEvidenceSections(bundle.evidenceSections)
    }, "api", null, null));
  });

  app.get(`${ADMIN_PREFIX}/audit-events`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;
    const consoleData = await buildAdminRealAssetRiskConsole(c);
    return c.json(responseFromData({ auditEvents: consoleData.auditEvents, realAssetSummary: consoleData.realAssetSummary }, "api", null, null));
  });

  app.post(`${ADMIN_PREFIX}/intents/:intentId/review-simulated`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;
    const intentId = c.req.param("intentId");
    const body = await c.req.json().catch(() => ({}));
    const consoleData = await buildAdminRealAssetRiskConsole(c);
    const bundle = consoleData.agents.find((entry) => entry.onchainIntents.some((intent) => intent.id === intentId) || entry.aiModelTokenPurchaseIntents.some((intent) => intent.id === intentId));
    const matchedOnchain = bundle?.onchainIntents.find((intent) => intent.id === intentId) || null;
    const matchedPurchase = bundle?.aiModelTokenPurchaseIntents.find((intent) => intent.id === intentId) || null;
    const decision = matchedOnchain?.policyDecision || matchedPurchase?.policyDecision || null;
    const review = {
      intentId,
      reviewer: String(body.reviewer || "admin"),
      reviewStatus: String(body.reviewStatus || decision?.status || "requires_confirmation"),
      policyDecision: decision,
      reviewedAt: new Date().toISOString(),
      safetyFlags: {
        ...SIMULATED_EXECUTION_GUARD,
        auditOnly: true
      }
    };
    return c.json(responseFromData(review, "api", null, null));
  });
}
