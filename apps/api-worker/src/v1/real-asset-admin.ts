import { Hono } from "hono";
import type {
  Agent,
  AgentWallet,
  AgentWalletPolicy,
  AdminRealAssetAuditEvent,
  AdminReviewActionRequest,
  AdminReviewActionResponse,
  AdminReviewQueueItem,
  AdminReviewQueueItemStatus,
  AdminReviewQueueItemType,
  AdminReviewQueueResponse,
  AdminReviewRiskLevel,
  AdminRealAssetRiskConsole,
  AdminRealAssetRiskConsoleAgent,
  RealAssetConsoleResponse,
  RealAssetEvidence,
  RealAssetEvidenceSection,
  RealAssetSummary,
  PolicyGuardDecision,
  OnchainTransactionEvent,
  OnchainTransactionIntent,
  AiModelTokenPurchaseIntent,
  RealAssetPersistenceSource
} from "@growthbot/shared";
import { defaultAgentWalletPolicy, requireAdmin, toAgent, toAgentWallet, type AppContext, type Bindings, type DbAgent, type DbAgentWallet } from "./core";
import {
  SIMULATED_EXECUTION_GUARD,
  createAiModelTokenPurchaseIntentDraft,
  createOnchainIntentDraft,
  createTransactionEventDraft,
  workReportEvidenceDraft
} from "./intent-service";
import {
  appendAdminRiskAuditEvent,
  listAdminRiskAuditEvents,
  listAiModelTokenPurchaseIntents,
  listOnchainTransactionIntents,
  listWorkReportEvidenceEvents,
  updateAiModelTokenPurchaseIntentStatusSimulated,
  updateOnchainTransactionIntentStatusSimulated
} from "./real-asset-repository";

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

function queueStatusFromIntent(status: string): AdminReviewQueueItemStatus {
  switch (status) {
    case "allowed":
    case "denied":
    case "requires_confirmation":
    case "resolved":
    case "failed":
    case "simulated_only":
    case "pending":
      return status;
    case "succeeded":
      return "resolved";
    case "purchased":
      return "resolved";
    case "pending_payment":
      return "pending";
    case "reversed":
      return "failed";
    case "paused":
      return "simulated_only";
    case "queued":
    case "executing":
      return "pending";
    case "proposed":
      return "pending";
    default:
      return "pending";
  }
}

function queueRiskLevelFromItem(itemType: AdminReviewQueueItemType, status: AdminReviewQueueItemStatus): AdminReviewRiskLevel {
  if (itemType === "audit_event") return "low";
  if (itemType === "evidence_gap") return "medium";
  if (status === "denied" || status === "failed") return "high";
  if (status === "requires_confirmation" || status === "pending") return "medium";
  return "low";
}

function queueItemFromOnchainIntent(intent: OnchainTransactionIntent, source: RealAssetPersistenceSource): AdminReviewQueueItem {
  const status = queueStatusFromIntent(intent.status);
  return {
    id: `review_${intent.id}`,
    itemType: "onchain_intent",
    status,
    riskLevel: queueRiskLevelFromItem("onchain_intent", status),
    agentId: intent.agentId,
    userId: intent.userId,
    title: `Onchain intent ${intent.id}`,
    summary: `${intent.asset} ${intent.amount.amount} via ${intent.provider || "simulated-provider"}`,
    policyDecision: intent.policyDecision,
    relatedIntentId: intent.id,
    relatedPurchaseIntentId: null,
    relatedEvidenceId: null,
    createdAt: intent.createdAt,
    updatedAt: intent.updatedAt,
    metadata: {
      source,
      purchaseType: intent.purchaseType,
      contractAddress: intent.targetContract
    }
  };
}

function queueItemFromPurchaseIntent(intent: AiModelTokenPurchaseIntent, source: RealAssetPersistenceSource): AdminReviewQueueItem {
  const status = queueStatusFromIntent(intent.status);
  return {
    id: `review_${intent.id}`,
    itemType: "ai_model_token_purchase_intent",
    status,
    riskLevel: queueRiskLevelFromItem("ai_model_token_purchase_intent", status),
    agentId: intent.agentId,
    userId: intent.userId,
    title: `AI Model Token purchase ${intent.id}`,
    summary: `${intent.spend.amount} G for ${intent.modelId}`,
    policyDecision: intent.policyDecision,
    relatedIntentId: intent.relatedOnchainIntentId,
    relatedPurchaseIntentId: intent.id,
    relatedEvidenceId: null,
    createdAt: intent.createdAt,
    updatedAt: intent.updatedAt,
    metadata: {
      source,
      provider: intent.provider,
      productId: intent.productId
    }
  };
}

function queueItemFromPolicyDecision(agent: Agent, policy: AgentWalletPolicy, relatedIntentId: string | null, relatedPurchaseIntentId: string | null): AdminReviewQueueItem {
  const status: AdminReviewQueueItemStatus = policy.adminGlobalPause
    ? "requires_confirmation"
    : policy.autoPurchaseEnabled
      ? "allowed"
      : policy.status === "paused"
        ? "simulated_only"
        : "pending";
  const policyDecision: PolicyGuardDecision = {
    status: policy.adminGlobalPause || policy.userPaused || policy.status === "paused"
      ? "paused"
      : policy.autoPurchaseEnabled
        ? "allowed"
        : "requires_confirmation",
    reasons: policy.adminGlobalPause
      ? ["admin_global_pause"]
      : policy.userPaused
        ? ["user_paused"]
        : policy.status === "paused"
          ? ["wallet_inactive"]
          : policy.autoPurchaseEnabled
            ? ["within_policy"]
            : ["auto_purchase_disabled"],
    requiresUserConfirmation: !policy.adminGlobalPause && !policy.userPaused && policy.status !== "paused" && !policy.autoPurchaseEnabled,
    requiredConfirmation: !policy.adminGlobalPause && !policy.userPaused && policy.status !== "paused" && !policy.autoPurchaseEnabled,
    riskMode: policy.riskMode,
    evaluatedAt: new Date().toISOString(),
    inputSummary: {
      agentId: agent.id,
      walletId: null,
      intentId: null,
      policyStatus: policy.status,
      autoPurchaseEnabled: policy.autoPurchaseEnabled,
      adminGlobalPause: policy.adminGlobalPause,
      userPaused: policy.userPaused,
      allowedAssets: policy.allowedAssets,
      allowedContracts: policy.allowedContracts,
      allowedProviders: policy.allowedProviders,
      allowedPurchaseTypes: policy.allowedPurchaseTypes
    }
  };
  return {
    id: `review_policy_${agent.id}`,
    itemType: "policy_decision",
    status,
    riskLevel: queueRiskLevelFromItem("policy_decision", status),
    agentId: agent.id,
    userId: null,
    title: `Wallet policy review ${agent.name}`,
    summary: `autoPurchaseEnabled=${String(policy.autoPurchaseEnabled)}, adminGlobalPause=${String(policy.adminGlobalPause)}, riskMode=${policy.riskMode}`,
    policyDecision,
    relatedIntentId,
    relatedPurchaseIntentId,
    relatedEvidenceId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      allowedAssets: policy.allowedAssets,
      allowedContracts: policy.allowedContracts,
      allowedProviders: policy.allowedProviders,
      allowedPurchaseTypes: policy.allowedPurchaseTypes,
      source: "simulated"
    }
  };
}

function queueItemFromEvidence(agentId: string, evidence: RealAssetEvidence, source: RealAssetPersistenceSource): AdminReviewQueueItem {
  const status: AdminReviewQueueItemStatus = evidence.kind === "work_report" ? "resolved" : "simulated_only";
  return {
    id: `review_evidence_${evidence.id}`,
    itemType: "evidence_gap",
    status,
    riskLevel: queueRiskLevelFromItem("evidence_gap", status),
    agentId,
    userId: null,
    title: evidence.title,
    summary: evidence.summary,
    policyDecision: null,
    relatedIntentId: evidence.intentId,
    relatedPurchaseIntentId: evidence.purchaseIntentId,
    relatedEvidenceId: evidence.id,
    createdAt: evidence.createdAt,
    updatedAt: evidence.createdAt,
    metadata: {
      source,
      kind: evidence.kind
    }
  };
}

function queueItemFromAuditEvent(event: AdminRealAssetAuditEvent, source: RealAssetPersistenceSource): AdminReviewQueueItem {
  const status: AdminReviewQueueItemStatus = "resolved";
  return {
    id: `review_audit_${event.id}`,
    itemType: "audit_event",
    status,
    riskLevel: queueRiskLevelFromItem("audit_event", status),
    agentId: null,
    userId: null,
    title: event.eventType,
    summary: event.summary,
    policyDecision: null,
    relatedIntentId: null,
    relatedPurchaseIntentId: null,
    relatedEvidenceId: null,
    createdAt: event.createdAt,
    updatedAt: event.createdAt,
    metadata: {
      source,
      actor: event.actor,
      targetType: event.targetType,
      targetId: event.targetId
    }
  };
}

async function buildAdminReviewQueue(c: AppContext): Promise<AdminReviewQueueResponse> {
  const consoleData = await buildAdminRealAssetRiskConsole(c);
  const auditRead = await listAdminRiskAuditEvents(c, { limit: 100 });
  const auditEvents = auditRead.value.length > 0 ? auditRead.value : consoleData.auditEvents;
  const queueItems: AdminReviewQueueItem[] = [];
  const statuses = new Set<AdminReviewQueueItemStatus>();
  const itemTypes = new Set<AdminReviewQueueItemType>();
  let persistenceSource: RealAssetPersistenceSource = auditRead.source;
  let persistenceError: string | null = auditRead.persistenceError;

  for (const agentBundle of consoleData.agents) {
    const onchainRead = await listOnchainTransactionIntents(c, agentBundle.agent.id, { limit: 25 });
    const purchaseRead = await listAiModelTokenPurchaseIntents(c, agentBundle.agent.id, { limit: 25 });
    const evidenceRead = await listWorkReportEvidenceEvents(c, agentBundle.agent.id, { limit: 25 });
    const onchainIntents = onchainRead.value.length > 0 ? onchainRead.value : agentBundle.onchainIntents;
    const purchaseIntents = purchaseRead.value.length > 0 ? purchaseRead.value : agentBundle.aiModelTokenPurchaseIntents;
    const evidenceItems = evidenceRead.value.length > 0 ? evidenceRead.value : flattenEvidenceSections(agentBundle.evidenceSections);

    if (onchainRead.source === "db" || purchaseRead.source === "db" || evidenceRead.source === "db") {
      persistenceSource = "db";
    } else if (persistenceSource !== "db") {
      persistenceSource = onchainRead.source === "simulated" || purchaseRead.source === "simulated" || evidenceRead.source === "simulated"
        ? "simulated"
        : "fallback";
    }
    persistenceError = persistenceError || onchainRead.persistenceError || purchaseRead.persistenceError || evidenceRead.persistenceError;

    for (const intent of onchainIntents) {
      const item = queueItemFromOnchainIntent(intent, onchainRead.source);
      queueItems.push(item);
      statuses.add(item.status);
      itemTypes.add(item.itemType);
    }

    for (const intent of purchaseIntents) {
      const item = queueItemFromPurchaseIntent(intent, purchaseRead.source);
      queueItems.push(item);
      statuses.add(item.status);
      itemTypes.add(item.itemType);
    }

    const policyItem = queueItemFromPolicyDecision(
      agentBundle.agent,
      agentBundle.walletPolicy,
      agentBundle.onchainIntents[0]?.id ?? null,
      agentBundle.aiModelTokenPurchaseIntents[0]?.id ?? null
    );
    queueItems.push(policyItem);
    statuses.add(policyItem.status);
    itemTypes.add(policyItem.itemType);

    if (evidenceItems.length === 0) {
      const evidenceGapItem: AdminReviewQueueItem = {
        id: `review_gap_${agentBundle.agent.id}`,
        itemType: "evidence_gap",
        status: "pending",
        riskLevel: "medium",
        agentId: agentBundle.agent.id,
        userId: null,
        title: `${agentBundle.agent.name} evidence gap`,
        summary: "No durable Work Report evidence rows are available yet.",
        policyDecision: null,
        relatedIntentId: agentBundle.onchainIntents[0]?.id ?? null,
        relatedPurchaseIntentId: agentBundle.aiModelTokenPurchaseIntents[0]?.id ?? null,
        relatedEvidenceId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          source: evidenceRead.source,
          reason: "missing_work_report_evidence"
        }
      };
      queueItems.push(evidenceGapItem);
      statuses.add(evidenceGapItem.status);
      itemTypes.add(evidenceGapItem.itemType);
    } else {
      for (const evidence of evidenceItems) {
        const item = queueItemFromEvidence(agentBundle.agent.id, evidence, evidenceRead.source);
        queueItems.push(item);
        statuses.add(item.status);
        itemTypes.add(item.itemType);
      }
    }
  }

  for (const auditEvent of auditEvents) {
    const item = queueItemFromAuditEvent(auditEvent, auditRead.source);
    queueItems.push(item);
    statuses.add(item.status);
    itemTypes.add(item.itemType);
  }

  const generatedAt = new Date().toISOString();
  return {
    mode: "simulated",
    dataSource: consoleData.dataSource,
    generatedAt,
    liveExecution: false,
    custody: false,
    mainWalletControl: false,
    persistence: {
      source: persistenceSource,
      degraded: persistenceSource !== "db",
      persistenceError
    },
    items: queueItems,
    filters: {
      statuses: Array.from(statuses),
      itemTypes: Array.from(itemTypes)
    }
  };
}

function mapReviewStatusToOnchainStatus(status: AdminReviewQueueItemStatus) {
  switch (status) {
    case "allowed":
      return "allowed";
    case "denied":
      return "denied";
    case "resolved":
      return "succeeded";
    case "failed":
      return "failed";
    case "requires_confirmation":
    case "pending":
    case "simulated_only":
    default:
      return "proposed";
  }
}

function mapReviewStatusToPurchaseStatus(status: AdminReviewQueueItemStatus) {
  switch (status) {
    case "allowed":
      return "allowed";
    case "denied":
      return "denied";
    case "resolved":
      return "purchased";
    case "failed":
      return "failed";
    case "requires_confirmation":
    case "pending":
    case "simulated_only":
    default:
      return "proposed";
  }
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

  app.get(`${ADMIN_PREFIX}/review-queue`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;
    return c.json(await buildAdminReviewQueue(c));
  });

  app.get(`${ADMIN_PREFIX}/review-queue/:itemId`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;
    const itemId = c.req.param("itemId");
    const queue = await buildAdminReviewQueue(c);
    const item = queue.items.find((entry) => entry.id === itemId || entry.relatedIntentId === itemId || entry.relatedPurchaseIntentId === itemId || entry.relatedEvidenceId === itemId) || null;
    return c.json({ ...queue, item });
  });

  app.post(`${ADMIN_PREFIX}/intents/:intentId/review-simulated`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;
    const intentId = c.req.param("intentId");
    const body = await c.req.json().catch(() => ({} as AdminReviewActionRequest));
    const queue = await buildAdminReviewQueue(c);
    const item = queue.items.find((entry) => entry.id === intentId || entry.relatedIntentId === intentId || entry.relatedPurchaseIntentId === intentId || entry.relatedEvidenceId === intentId);
    const reviewer = String(body.reviewer || "admin");
    const reviewStatus = body.reviewStatus || item?.status || "requires_confirmation";
    const reviewedAt = new Date().toISOString();
    const reviewEvent = await appendAdminRiskAuditEvent(c, {
      id: `admin_review_${intentId.replace(/[^a-zA-Z0-9_]/g, "_")}_${Date.now()}`,
      eventType: "review_simulated",
      actor: reviewer,
      targetType: item?.itemType || "unknown",
      targetId: item?.id || intentId,
      summary: body.notes || `Review simulated for ${item?.title || intentId}`,
      createdAt: reviewedAt,
      metadata: {
        ...SIMULATED_EXECUTION_GUARD,
        reviewStatus,
        itemType: item?.itemType || null,
        itemId: item?.id || intentId,
        notes: body.notes || null,
        extraMetadata: body.metadata || null
      }
    });
    let onchainResult = null;
    let purchaseResult = null;
    if (item?.relatedIntentId && (item.itemType === "onchain_intent" || item.itemType === "policy_decision")) {
      onchainResult = await updateOnchainTransactionIntentStatusSimulated(c, item.relatedIntentId, mapReviewStatusToOnchainStatus(reviewStatus), {
        reviewer,
        reviewStatus,
        reviewedAt,
        notes: body.notes || null
      });
    }
    if (item?.relatedPurchaseIntentId && (item.itemType === "ai_model_token_purchase_intent" || item.itemType === "policy_decision")) {
      purchaseResult = await updateAiModelTokenPurchaseIntentStatusSimulated(c, item.relatedPurchaseIntentId, mapReviewStatusToPurchaseStatus(reviewStatus), {
        reviewer,
        reviewStatus,
        reviewedAt,
        notes: body.notes || null
      });
    }
    const persistence = reviewEvent.source === "db" || onchainResult?.source === "db" || purchaseResult?.source === "db"
      ? "db"
      : "fallback";
    const persistenceError = reviewEvent.persistenceError || onchainResult?.persistenceError || purchaseResult?.persistenceError || null;
    const response: AdminReviewActionResponse = {
      mode: "simulated",
      liveExecution: false,
      custody: false,
      mainWalletControl: false,
      itemId: item?.id || intentId,
      status: reviewStatus,
      reviewedAt,
      persistence,
      persistenceError,
      review: {
        reviewer,
        notes: body.notes || null,
        metadata: {
          ...(body.metadata || {}),
          reviewEventId: reviewEvent.value.id,
          onchainUpdated: onchainResult?.value?.id || null,
          purchaseUpdated: purchaseResult?.value?.id || null
        }
      }
    };
    return c.json(response);
  });

  app.post(`${ADMIN_PREFIX}/review-queue/:itemId/review-simulated`, async (c) => {
    const auth = await requireAdmin(c);
    if (auth) return auth;
    const itemId = c.req.param("itemId");
    const body = await c.req.json().catch(() => ({} as AdminReviewActionRequest));
    const queue = await buildAdminReviewQueue(c);
    const item = queue.items.find((entry) => entry.id === itemId || entry.relatedIntentId === itemId || entry.relatedPurchaseIntentId === itemId || entry.relatedEvidenceId === itemId);
    if (!item) {
      return c.json({ error: "review_queue_item_not_found", message: "Review queue item not found" }, 404);
    }
    const reviewer = String(body.reviewer || "admin");
    const reviewStatus = body.reviewStatus || item.status || "requires_confirmation";
    const reviewedAt = new Date().toISOString();
    const reviewEvent = await appendAdminRiskAuditEvent(c, {
      id: `admin_review_${itemId.replace(/[^a-zA-Z0-9_]/g, "_")}_${Date.now()}`,
      eventType: "review_simulated",
      actor: reviewer,
      targetType: item.itemType,
      targetId: item.id,
      summary: body.notes || `Review simulated for ${item.title}`,
      createdAt: reviewedAt,
      metadata: {
        ...SIMULATED_EXECUTION_GUARD,
        reviewStatus,
        itemType: item.itemType,
        itemId: item.id,
        notes: body.notes || null,
        extraMetadata: body.metadata || null
      }
    });
    let onchainResult = null;
    let purchaseResult = null;
    if (item.relatedIntentId && (item.itemType === "onchain_intent" || item.itemType === "policy_decision")) {
      onchainResult = await updateOnchainTransactionIntentStatusSimulated(c, item.relatedIntentId, mapReviewStatusToOnchainStatus(reviewStatus), {
        reviewer,
        reviewStatus,
        reviewedAt,
        notes: body.notes || null
      });
    }
    if (item.relatedPurchaseIntentId && (item.itemType === "ai_model_token_purchase_intent" || item.itemType === "policy_decision")) {
      purchaseResult = await updateAiModelTokenPurchaseIntentStatusSimulated(c, item.relatedPurchaseIntentId, mapReviewStatusToPurchaseStatus(reviewStatus), {
        reviewer,
        reviewStatus,
        reviewedAt,
        notes: body.notes || null
      });
    }
    const persistence = reviewEvent.source === "db" || onchainResult?.source === "db" || purchaseResult?.source === "db"
      ? "db"
      : "fallback";
    const persistenceError = reviewEvent.persistenceError || onchainResult?.persistenceError || purchaseResult?.persistenceError || null;
    const response: AdminReviewActionResponse = {
      mode: "simulated",
      liveExecution: false,
      custody: false,
      mainWalletControl: false,
      itemId: item.id,
      status: reviewStatus,
      reviewedAt,
      persistence,
      persistenceError,
      review: {
        reviewer,
        notes: body.notes || null,
        metadata: {
          ...(body.metadata || {}),
          reviewEventId: reviewEvent.value.id,
          onchainUpdated: onchainResult?.value?.id || null,
          purchaseUpdated: purchaseResult?.value?.id || null
        }
      }
    };
    return c.json(response);
  });
}
