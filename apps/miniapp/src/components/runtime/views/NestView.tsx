import React, { useEffect, useMemo, useRef, useState } from "react";
import { GBOT_BUBBLE_AGENT_OPS_CONFIG, InventoryItem, type BubbleAgentOpsConfig, type BubblePassportStatusResponse } from "@growthbot/shared";
import {
  Archive,
  Battery,
  Bot,
  ChevronRight,
  Coins,
  Gem,
  Globe,
  Landmark,
  Map,
  PackageOpen,
  Plug,
  Radio,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Ticket,
  Wallet,
  Zap
} from "lucide-react";
import { getMockMode, apiClient } from "../../../apiClient";
import { CollapsibleCard } from "../index";
import { RuntimeTab } from "../petAgentTypes";
import { RuntimeState } from "../runtimeTypes";
import { deriveBubbleAgentIdentity, BubbleMintStatus, isBubbleInventoryItem } from "../bubbleAgentIdentity";

interface NestViewProps {
  state: RuntimeState;
  setTab: (tab: RuntimeTab) => void;
}

const playgrounds = [
  {
    id: "telegram",
    name: "Telegram Plaza",
    status: "已接入",
    desc: "只处理授权、公开或 @ 提及内容。",
    icon: Plug,
    active: true
  },
  {
    id: "x",
    name: "X Radar",
    status: "待开放",
    desc: "通过官方 API / OAuth 接入。",
    icon: Radio,
    active: false
  },
  {
    id: "web",
    name: "Web Scout",
    status: "待开放",
    desc: "不绕过限制与违规爬取。",
    icon: Globe,
    active: false
  },
  {
    id: "ton",
    name: "TON Map",
    status: "待开放",
    desc: "链上读取优先，受 Policy Guard 约束。",
    icon: Map,
    active: false
  }
];

function getAssetAmount(state: RuntimeState, asset: "G" | "TON" | "AI_CREDIT") {
  return state.assetBalances.find((balance) => balance.asset === asset)?.available.amount || "0";
}

function clampPercent(value: number, max: number) {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function parseAmount(value: string | number | undefined | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rarityLabel(item: InventoryItem) {
  const labels: Record<string, string> = {
    common: "普通",
    rare: "稀有",
    epic: "史诗",
    legendary: "传说",
    genesis: "创世"
  };
  return labels[item.rarity] || item.rarity || "道具";
}

const mintStatusCopy: Record<BubbleMintStatus, { label: string; hint: string }> = {
  unminted: {
    label: "游戏内资产",
    hint: "可选择自愿铸造 Passport"
  },
  minting: {
    label: "铸造同步中",
    hint: "等待链上确认与索引同步"
  },
  minted: {
    label: "已铸造 Passport",
    hint: "链上归属以 Passport 记录为准"
  },
  failed: {
    label: "铸造未完成",
    hint: "可稍后重新发起"
  }
};

const ownerStateCopy: Record<string, string> = {
  app_asset: "应用内持有",
  pending_chain_index: "等待链上索引",
  synced_to_holder: "已同步持有人",
  claim_required: "待用户处理"
};

export const NestView: React.FC<NestViewProps> = ({ state, setTab }) => {
  const { aiCreditBalance, agent, inventory, walletPolicy, agentWallet } = state;
  const isDemo = getMockMode();
  const [sourcesCount, setSourcesCount] = useState<number>(3);
  const [signalsCount, setSignalsCount] = useState<number>(3);
  const [riskCount, setRiskCount] = useState<number>(1);
  const [creditsCount, setCreditsCount] = useState<number>(30);
  const [apiMode, setApiMode] = useState<"live" | "mock">("mock");
  const [bubbleConfig, setBubbleConfig] = useState(GBOT_BUBBLE_AGENT_OPS_CONFIG);
  const [selectedBubbleItemId, setSelectedBubbleItemId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("gb_selected_bubble_item_id");
  });

  useEffect(() => {
    let active = true;
    const fetchCounts = async () => {
      try {
        const sourcesRes = await apiClient.listTelegramSources();
        const signalsRes = await apiClient.listTelegramOpportunitySignals();

        if (!active) return;
        setSourcesCount(sourcesRes.sources.filter((source: any) => source.status === "authorized").length);
        setSignalsCount(signalsRes.signals.filter((signal: any) => signal.status === "candidate").length);
        setRiskCount(signalsRes.signals.filter((signal: any) => signal.status === "pending_user").length);
        setCreditsCount(
          signalsRes.signals
            .filter((signal: any) => signal.status === "candidate")
            .reduce((sum: number, signal: any) => sum + (signal.estimatedAiCreditCost || 0), 0)
        );
        setApiMode("live");
      } catch (error) {
        console.warn("[NestView] Fallback to mock counts:", error);
        if (!active) return;
        setSourcesCount(3);
        setSignalsCount(3);
        setRiskCount(1);
        setCreditsCount(30);
        setApiMode("mock");
      }
    };
    fetchCounts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    apiClient.getBubbleAgentConfig()
      .then((config: BubbleAgentOpsConfig) => {
        if (active) setBubbleConfig(config);
      })
      .catch(() => {
        if (active) setBubbleConfig(GBOT_BUBBLE_AGENT_OPS_CONFIG);
      });
    return () => {
      active = false;
    };
  }, []);

  const gBalance = getAssetAmount(state, "G");
  const tonBalance = getAssetAmount(state, "TON");
  const creditBalance = aiCreditBalance[0]?.balance.amount || getAssetAmount(state, "AI_CREDIT") || String(agent?.energy || 0);
  const bubbleItems = (inventory || []).filter(isBubbleInventoryItem);
  const selectedBubble = bubbleItems.find((item) => item.id === selectedBubbleItemId) || bubbleItems[0] || null;
  const inventoryPreview = inventory?.filter((item) => !isBubbleInventoryItem(item)) || [];
  const policyLabel = agentWallet ? "钱包在线" : walletPolicy ? "预算已设定" : "待设置";
  const identity = deriveBubbleAgentIdentity(agent, selectedBubble);
  const [passportStatus, setPassportStatus] = useState<BubbleMintStatus>(identity.mintStatus);
  const [passportTokenId, setPassportTokenId] = useState<string | null>(identity.tokenId || null);
  const [passportMessage, setPassportMessage] = useState<string | null>(null);
  const [passportBusy, setPassportBusy] = useState(false);
  const passportCompletionTimer = useRef<number | null>(null);
  const mintCopy = mintStatusCopy[passportStatus];
  const passportPreview = bubbleConfig.passportSyncPreview.find((item) => item.status === passportStatus)
    || bubbleConfig.passportSyncPreview[0]!;
  const passportPreviewToken = passportTokenId || passportPreview.tokenId;
  const passportHint = !agent ? "先领养 Agent 后再处理 Passport。" : passportMessage || mintCopy.hint;
  const passportButtonText = !agent
    ? "先领养"
    : passportBusy
    ? "处理中"
    : passportStatus === "minted"
      ? "已铸造"
      : passportStatus === "minting"
        ? "同步中"
        : passportStatus === "failed"
          ? "重新发起"
          : "自愿铸造";

  useEffect(() => {
    setPassportStatus(identity.mintStatus);
    setPassportTokenId(identity.tokenId || null);
    setPassportMessage(null);
    setPassportBusy(false);
  }, [identity.displayNo, identity.mintStatus, identity.tokenId]);

  useEffect(() => {
    if (isDemo || !agent || identity.displayNo === "GBOT-000000") return;
    let active = true;

    apiClient.getBubblePassportStatus(identity.displayNo)
      .then((response: BubblePassportStatusResponse) => {
        if (!active) return;
        setPassportStatus(response.passport.mintStatus);
        setPassportTokenId(response.passport.tokenId || null);
        window.dispatchEvent(new CustomEvent("gb_agent_mint_status_changed", {
          detail: { displayNo: identity.displayNo, mintStatus: response.passport.mintStatus }
        }));
      })
      .catch((error: unknown) => {
        console.warn("[NestView] Passport status query failed:", error);
      });

    return () => {
      active = false;
    };
  }, [agent, identity.displayNo, isDemo]);

  useEffect(() => {
    const handlePassportStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ displayNo?: string; mintStatus?: BubbleMintStatus }>).detail;
      if (detail?.displayNo !== identity.displayNo || !detail.mintStatus) return;
      setPassportStatus(detail.mintStatus);
      if (detail.mintStatus === "minted") {
        setPassportTokenId(`Passport-#${identity.displayNo.replace("GBOT-", "")}`);
      }
    };

    window.addEventListener("gb_agent_mint_status_changed", handlePassportStatus);
    return () => window.removeEventListener("gb_agent_mint_status_changed", handlePassportStatus);
  }, [identity.displayNo]);

  useEffect(() => () => {
    if (passportCompletionTimer.current !== null) {
      window.clearTimeout(passportCompletionTimer.current);
    }
  }, []);

  const resourceBars = useMemo(
    () => [
      {
        key: "g",
        label: "G 金币",
        value: `${gBalance} G`,
        icon: Coins,
        percent: clampPercent(parseAmount(gBalance), 300)
      },
      {
        key: "ton",
        label: "TON 预算",
        value: `${tonBalance} TON`,
        icon: Wallet,
        percent: clampPercent(parseAmount(tonBalance), 1)
      },
      {
        key: "energy",
        label: "Token 能量",
        value: `${creditBalance}`,
        icon: Zap,
        percent: clampPercent(parseAmount(creditBalance), agent?.maxEnergy || 240)
      }
    ],
    [agent?.maxEnergy, creditBalance, gBalance, tonBalance]
  );

  const selectBubbleItem = (item: InventoryItem) => {
    setSelectedBubbleItemId(item.id);
    if (typeof window !== "undefined") {
      localStorage.setItem("gb_selected_bubble_item_id", item.id);
      window.dispatchEvent(new CustomEvent("gb_selected_bubble_changed", {
        detail: { itemId: item.id, displayNo: item.displayNo || item.cardNumber || null }
      }));
    }
  };

  const requestPassportMint = async () => {
    if (!agent || passportStatus === "minted" || passportStatus === "minting" || passportBusy) return;
    if (passportCompletionTimer.current !== null) {
      window.clearTimeout(passportCompletionTimer.current);
      passportCompletionTimer.current = null;
    }

    setPassportBusy(true);
    setPassportStatus("minting");
    setPassportMessage("已发起自愿铸造请求，等待钱包确认与链上索引同步。");

    try {
      const response = await apiClient.requestBubblePassportMint({
        agentId: identity.agentId || agent.id,
        displayNo: identity.displayNo,
        inventoryItemId: selectedBubble?.id || null,
        series: identity.series,
        rarity: identity.rarity,
        chain: "TON"
      });
      setPassportStatus(response.mintStatus);
      setPassportTokenId(response.tokenId || null);
      setPassportMessage(response.message);

      if (isDemo && response.mintStatus === "minting") {
        passportCompletionTimer.current = window.setTimeout(async () => {
          const completed = await apiClient.completeMockBubblePassportMint(identity.displayNo, "minted");
          setPassportStatus(completed.mintStatus);
          setPassportTokenId(completed.tokenId || null);
          setPassportMessage(completed.message);
          setPassportBusy(false);
          passportCompletionTimer.current = null;
        }, 1400);
      } else {
        setPassportBusy(false);
      }
    } catch (error) {
      console.warn("[NestView] Passport mint request failed:", error);
      setPassportStatus("failed");
      setPassportTokenId(null);
      setPassportMessage("请求未完成，可稍后重新发起。");
      setPassportBusy(false);
    }
  };

  return (
    <main className="gbot-mini-page gbot-vault-page">
      {/* 1. HUD Top Header */}
      <header className="gbot-mini-header">
        <div className="gbot-mini-header__left">
          <div className="gbot-mini-header__icon">
            <Wallet size={18} />
          </div>
          <div className="gbot-mini-header__titles">
            <h1>小金库</h1>
            <span>ASSET CABIN</span>
          </div>
        </div>
        <div className="gbot-mini-header__right">
          <span className="gbot-mini-pill">
            <Bot size={14} />
            {policyLabel}
          </span>
        </div>
      </header>

      {/* 2. 3-Resource Bars Strip */}
      <div className="gbot-mini-stat-strip">
        {resourceBars.map((bar) => {
          const Icon = bar.icon;
          return (
            <div className="gbot-mini-stat-item" key={bar.key}>
              <div className="gbot-mini-stat-item__top">
                <Icon size={12} />
                <span>{bar.label}</span>
              </div>
              <strong>{bar.value}</strong>
              <i><b style={{ width: `${bar.percent}%` }} /></i>
            </div>
          );
        })}
      </div>

      {/* 3. Passport Card (Compact) */}
      <section className={`gbot-passport-card is-${passportStatus}`} style={{ margin: 0, padding: "10px 12px", borderRadius: "18px" }}>
        <div className="gbot-passport-card__seal" style={{ width: "36px", height: "36px" }}>
          <Ticket size={20} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "10px" }}>泡泡 Passport</span>
            <span className={`game-bubble-identity-bar__rarity is-${identity.rarity.toLowerCase()}`} style={{ fontSize: "9px", padding: "1px 5px" }}>{identity.rarity}</span>
          </div>
          <strong style={{ fontSize: "15px" }}>{identity.displayNo}</strong>
          <small style={{ fontSize: "10px", display: "block" }}>{passportHint}</small>
        </div>
        <button
          type="button"
          className="gbot-mini-btn"
          onClick={requestPassportMint}
          disabled={!agent || passportBusy || passportStatus === "minted" || passportStatus === "minting"}
          style={{ minHeight: "44px", padding: "0 12px" }}
        >
          {passportButtonText}
        </button>
      </section>

      {/* 4. My Bubble Assets Horizontal Carousel */}
      <section className="gbot-mini-panel">
        <div className="gbot-mini-panel__title">
          <div>
            <span>泡泡背包</span>
            <h2>{bubbleItems.length ? `${bubbleItems.length} 只泡泡资产` : "当前展示普通款"}</h2>
          </div>
          <button type="button" className="gbot-mini-pill" onClick={() => setTab("Train")}>
            开盲盒
            <ChevronRight size={12} />
          </button>
        </div>

        {bubbleItems.length > 0 ? (
          <div className="gbot-mini-carousel">
            {bubbleItems.map((item) => {
              const selected = selectedBubble?.id === item.id;
              return (
                <article
                  className={`gbot-bubble-vault-item gbot-bubble-vault-item--${item.rarity}${selected ? " is-selected" : ""}`}
                  key={item.id}
                  style={{ width: "160px", padding: "8px" }}
                >
                  <div>
                    <span style={{ fontSize: "10px" }}>{item.displayNo || item.cardNumber || "GBOT-?????"}</span>
                    <strong style={{ fontSize: "13px", display: "block" }}>{item.series || item.name}</strong>
                    <small style={{ fontSize: "10px" }}>{rarityLabel(item)} · 标签 {item.naturalSkillCodes?.length || 0}</small>
                  </div>
                  <button
                    type="button"
                    className="gbot-mini-btn gbot-mini-bubble-select-btn"
                    onClick={() => selectBubbleItem(item)}
                    disabled={selected}
                  >
                    {selected ? "展示中" : "设为展示"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="gbot-mini-empty">
            <Ticket size={20} />
            <strong>当前展示烟灰泥泡泡</strong>
            <p>特别版泡泡可从技能盲盒中获得，获得后在背包选中展示。</p>
          </div>
        )}
      </section>

      {/* 5. Action Dock */}
      <div className="gbot-mini-action-dock">
        <button type="button" className="gbot-mini-primary-btn" onClick={() => setTab("Explore")}>
          <Sparkles size={18} />
          去赚钱 (出勤地图)
        </button>
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" className="gbot-mini-btn" onClick={() => setTab("Train")} style={{ flex: 1, borderRadius: "14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontWeight: 700 }}>
            <ShoppingCart size={14} />
            开盲盒 / 买技能
          </button>
        </div>
      </div>

      {/* 6. Collapsible Detail Section (Wallet Ledger & Inventory Items) */}
      <CollapsibleCard
        title="小金库流水 & 背包道具"
        summary={`资产记录 · 背包道具 (${inventoryPreview.length}) · 授权源 (${sourcesCount})`}
        className="gbot-drawer-card"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Passport Sync Detail */}
          <div className="gbot-passport-sync-strip">
            <div>
              <span>Passport 同步</span>
              <strong>{ownerStateCopy[passportPreview.ownerState] || passportPreview.ownerState}</strong>
            </div>
            <p style={{ fontSize: "11px" }}>{passportPreview.note} 应用内泡泡默认作为游戏内资产。</p>
            <small style={{ fontSize: "10px" }}>{passportPreview.chain || "TON"} · {passportPreviewToken || "未生成链上编号"}</small>
          </div>

          {/* Wallet Ledger */}
          <div className="gbot-vault-ledger" style={{ padding: 0, background: "transparent", border: "none" }}>
            <div className="gbot-ledger-list">
              <article>
                <b>G</b>
                <div>
                  <strong>任务验收候选入账</strong>
                  <span>进入待结算队列，完成验收后更新余额</span>
                </div>
                <em>+{signalsCount * 3} G</em>
              </article>
              <article>
                <b>TON</b>
                <div>
                  <strong>派遣预算锁定</strong>
                  <span>高风险动作和签名会等待用户确认</span>
                </div>
                <em>{tonBalance} TON</em>
              </article>
            </div>
          </div>

          {/* Backpack Inventory */}
          <div className="gbot-inventory-panel" style={{ padding: 0, background: "transparent", border: "none" }}>
            {inventoryPreview.length > 0 ? (
              <div className="gbot-inventory-grid">
                {inventoryPreview.map((item: InventoryItem) => (
                  <article className={`gbot-bag-item gbot-bag-item--${item.rarity}`} key={item.id}>
                    <div>
                      <Gem size={16} />
                      <span>{rarityLabel(item)}</span>
                    </div>
                    <strong>{item.name || "未命名道具"}</strong>
                    <small>{item.effect || item.type}</small>
                  </article>
                ))}
              </div>
            ) : (
              <div className="gbot-mini-empty">
                <PackageOpen size={20} />
                <strong>背包暂时是空的</strong>
                <p>去技能商店购买第一张普通卡，Agent 就能开始稳定打工。</p>
              </div>
            )}
          </div>

          {/* Authorized Sources */}
          <div className="gbot-source-console">
            <div className="gbot-permission-note">
              <ShieldCheck size={16} />
              <p>授权源只用于发现候选机会，不读取普通历史闲聊。</p>
            </div>
            <div className="gbot-source-grid">
              {playgrounds.map((playground) => {
                const Icon = playground.icon;
                return (
                  <article className={`gbot-source-card${playground.active ? " is-active" : ""}`} key={playground.id}>
                    <div>
                      <Icon size={14} />
                      <strong>{playground.name}</strong>
                      <span>{playground.status}</span>
                    </div>
                    <p style={{ fontSize: "10px" }}>{playground.desc}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </CollapsibleCard>
    </main>
  );
};
