import type {
  AdminReviewQueueItem,
  ExecutorReadinessGateStatus,
  TxStatusTrackerEventDraft,
  TxStatusTrackerLifecycleStatus,
  TxStatusTrackerSummary
} from "@growthbot/shared";

const TRACKER_STATUSES: TxStatusTrackerLifecycleStatus[] = [
  "not_started",
  "intent_created",
  "awaiting_admin_review",
  "approved_for_future_testnet",
  "submitted_testnet_placeholder",
  "pending_confirmation",
  "confirmed",
  "failed",
  "cancelled",
  "blocked"
];

export function buildTxStatusTrackerEventDraft(input: {
  id: string;
  intentId?: string | null;
  purchaseIntentId?: string | null;
  status: TxStatusTrackerLifecycleStatus;
  title: string;
  summary: string;
  metadata?: Record<string, unknown>;
}): TxStatusTrackerEventDraft {
  return {
    id: input.id,
    intentId: input.intentId ?? null,
    purchaseIntentId: input.purchaseIntentId ?? null,
    status: input.status,
    title: input.title,
    summary: input.summary,
    createdAt: new Date().toISOString(),
    metadata: input.metadata ?? {}
  };
}

export function listSimulatedTxStatusEvents(reviewQueueItems: AdminReviewQueueItem[] = []): TxStatusTrackerEventDraft[] {
  if (reviewQueueItems.length === 0) {
    return [
      buildTxStatusTrackerEventDraft({
        id: "tx_tracker_not_started",
        status: "not_started",
        title: "Executor scaffold only",
        summary: "No TON RPC, signing, broadcasting, or testnet submission is enabled in this PR.",
        metadata: {
          simulationOnly: true,
          executorEnabled: false,
          testnetExecutorEnabled: false,
          liveExecutorEnabled: false
        }
      })
    ];
  }

  return reviewQueueItems.slice(0, 12).map((item, index) => {
    const status: TxStatusTrackerLifecycleStatus =
      item.status === "allowed"
        ? "approved_for_future_testnet"
        : item.status === "denied" || item.status === "failed"
          ? "blocked"
          : item.status === "resolved"
            ? "cancelled"
            : "awaiting_admin_review";
    return buildTxStatusTrackerEventDraft({
      id: `tx_tracker_${index}_${item.id}`,
      intentId: item.relatedIntentId,
      purchaseIntentId: item.relatedPurchaseIntentId,
      status,
      title: item.title,
      summary: `${item.itemType} remains simulation-only and cannot be signed or broadcast from this PR.`,
      metadata: {
        itemId: item.id,
        itemType: item.itemType,
        riskLevel: item.riskLevel,
        reviewQueueStatus: item.status
      }
    });
  });
}

export function classifyTxStatusReadiness(events: TxStatusTrackerEventDraft[]): ExecutorReadinessGateStatus {
  if (events.some((event) => event.status === "blocked")) return "warning";
  if (events.some((event) => event.status === "awaiting_admin_review" || event.status === "intent_created")) return "warning";
  return "pass";
}

export function buildTxStatusTrackerSummary(reviewQueueItems: AdminReviewQueueItem[] = []): TxStatusTrackerSummary {
  const events = listSimulatedTxStatusEvents(reviewQueueItems);
  const trackerStatus = classifyTxStatusReadiness(events);
  return {
    mode: "simulated",
    liveExecution: false,
    custody: false,
    mainWalletControl: false,
    executorEnabled: false,
    testnetExecutorEnabled: false,
    liveExecutorEnabled: false,
    trackerStatus,
    chain: "TON",
    network: "testnet_simulated",
    statusesSupported: TRACKER_STATUSES,
    events,
    summary: "Tx Status Tracker V1 is a scaffold only. It models future testnet execution checkpoints without TON RPC, signing, broadcasting, or custody.",
    nextRequiredImplementation: [
      "future_testnet_submission_worker",
      "tx_hash_persistence",
      "confirmation_polling",
      "reconciliation_audit_append"
    ],
    updatedAt: new Date().toISOString()
  };
}
