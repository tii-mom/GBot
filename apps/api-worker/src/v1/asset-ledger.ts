import type {
  AssetAmount,
  AssetBalance,
  AssetLedgerEvent,
  AssetLedgerEventType,
  AssetSymbol
} from "@growthbot/shared";

export const REAL_ASSET_SYMBOLS: readonly AssetSymbol[] = ["G", "TON", "AI_CREDIT"] as const;

export function assetDecimals(symbol: AssetSymbol): number {
  switch (symbol) {
    case "G":
    case "TON":
    case "AI_CREDIT":
      return 9;
  }
}

export function toAssetAmount(symbol: AssetSymbol, amount: string | number = "0", decimals = assetDecimals(symbol)): AssetAmount {
  return { symbol, amount: String(amount), decimals };
}

export function zeroAssetAmount(symbol: AssetSymbol): AssetAmount {
  return toAssetAmount(symbol, "0");
}

export function toAssetBalance(
  asset: AssetSymbol,
  available: string | number = "0",
  reserved: string | number = "0",
  updatedAt: string | null = null
): AssetBalance {
  const availableAmount = toAssetAmount(asset, available);
  const reservedAmount = toAssetAmount(asset, reserved);
  const total = Number(availableAmount.amount) + Number(reservedAmount.amount);
  return {
    asset,
    available: availableAmount,
    reserved: reservedAmount,
    total: toAssetAmount(asset, Number.isFinite(total) ? String(total) : "0"),
    updatedAt
  };
}

export function defaultAssetBalances(updatedAt: string | null = null): AssetBalance[] {
  return REAL_ASSET_SYMBOLS.map((symbol) => toAssetBalance(symbol, "0", "0", updatedAt));
}

export function summarizeAssetLedger(events: AssetLedgerEvent[] = []) {
  const byAsset = Object.fromEntries(REAL_ASSET_SYMBOLS.map((symbol) => [symbol, { eventCount: 0, spendEvents: 0, usageEvents: 0 }])) as Record<AssetSymbol, { eventCount: number; spendEvents: number; usageEvents: number }>;
  for (const event of events) {
    byAsset[event.asset].eventCount += 1;
    if (event.eventType === "spend" || event.eventType === "purchase") byAsset[event.asset].spendEvents += 1;
    if (event.eventType === "usage") byAsset[event.asset].usageEvents += 1;
  }
  return {
    mode: "simulated" as const,
    liveExecution: false,
    custody: false,
    mainWalletControl: false,
    totalEvents: events.length,
    byAsset
  };
}

export function createAssetLedgerEventDraft(input: {
  userId: string;
  agentId?: string | null;
  walletId?: string | null;
  eventType?: AssetLedgerEventType;
  asset: AssetSymbol;
  amount?: string | number;
  relatedIntentId?: string | null;
  relatedTransactionId?: string | null;
  metadata?: Record<string, unknown> | null;
  now?: string;
}): AssetLedgerEvent {
  return {
    id: `asset_evt_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    userId: input.userId,
    agentId: input.agentId ?? null,
    walletId: input.walletId ?? null,
    eventType: input.eventType ?? "audit",
    asset: input.asset,
    amount: toAssetAmount(input.asset, input.amount ?? "0"),
    relatedIntentId: input.relatedIntentId ?? null,
    relatedTransactionId: input.relatedTransactionId ?? null,
    metadata: {
      ...(input.metadata || {}),
      mode: "simulated",
      liveExecution: false,
      custody: false,
      mainWalletControl: false
    },
    createdAt: input.now ?? new Date().toISOString()
  };
}

export function aiCreditBalanceDraft(agentId: string, updatedAt: string | null = null) {
  return [{
    agentId,
    provider: "simulated-provider",
    modelId: null,
    balance: zeroAssetAmount("AI_CREDIT"),
    reserved: zeroAssetAmount("AI_CREDIT"),
    updatedAt
  }];
}
