import React, { useMemo, useState } from "react";
import { ArrowRight, CalendarClock, Eye, Flame, Share2, ShieldCheck, Sparkles, TrendingUp, UserCheck, X } from "lucide-react";
import type { BoxSupply, MarketplaceListing, TrendingItem, Agent, User } from "@growthbot/shared";
import { telegramAdapter } from "../telegramAdapter";
import { apiClient } from "../apiClient";
import { translateAssetName, translateBoxOdds, translateBoxRoute, translateCategory, translateItemType, translateMarketSection, translateRarity } from "../i18n";
import { StoreView } from "./StoreView";

interface MarketplaceViewProps {
  user: User;
  agent: Agent | null;
  stats: { floorPrice: string; volume24h: string; currency: string; floorMove24h?: string; activeListings?: number };
  listings: MarketplaceListing[];
  recentTrades: Array<{ id: string; name: string; price: string; buyer: string }>;
  trendingItems: TrendingItem[];
  marketSections?: Array<{ key: string; title: string; listingIds: string[] }>;
  boxSupply?: BoxSupply[];
  onNavigateToEarn?: () => void;
  currentUserUsername: string;
  onBuyItem: (listingId: string) => Promise<void>;
  onCancelListing: (listingId: string) => Promise<void>;
  t: (key: string, fallback: string) => string;
  onRefreshData?: () => Promise<void>;
  onNavigateToBag?: () => void;
}

export function MarketplaceView({
  user,
  agent,
  stats,
  listings,
  recentTrades,
  trendingItems,
  marketSections,
  boxSupply,
  onNavigateToEarn,
  currentUserUsername,
  onBuyItem,
  onCancelListing,
  t,
  onRefreshData,
  onNavigateToBag
}: MarketplaceViewProps) {
  const [marketTab, setMarketTab] = useState<"store" | "p2p" | "my_listings" | "history">("store");
  const [filterType, setFilterType] = useState<"all" | "box" | "ability">("all");
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);

  const filteredListings = listings.filter((item) => {
    if (filterType === "all") return true;
    if (filterType === "box") return item.name.toLowerCase().includes("box");
    return !item.name.toLowerCase().includes("box");
  });

  const myListings = listings.filter((item) => item.seller === currentUserUsername);

  const sectionListings = useMemo(() => {
    const lookup = new Map(listings.map((item) => [item.id, item]));
    return (marketSections || []).map((section) => ({
      ...section,
      items: section.listingIds.map((id) => lookup.get(id)).filter(Boolean) as MarketplaceListing[]
    }));
  }, [listings, marketSections]);

  const filterLabel = (value: "all" | "box" | "ability") => {
    if (value === "all") return t("market.all", "全部");
    if (value === "box") return t("market.box", "技能包");
    return t("market.skill", "技能卡");
  };

  const officialActivities = (boxSupply || []).slice(0, 4);

  const handleBuy = async (listingId: string) => {
    telegramAdapter.hapticImpact("heavy");
    setBuyingId(listingId);

    try {
      await onBuyItem(listingId);
      setSelectedListing(null);
      setPurchaseSuccess(true);
      if (onRefreshData) await onRefreshData();
      setTimeout(() => {
        setPurchaseSuccess(false);
      }, 2500);
    } catch (err: any) {
      telegramAdapter.showAlert(err.message || t("market.buyFailed", "购买失败"));
    } finally {
      setBuyingId(null);
    }
  };

  const shareListing = (listing: MarketplaceListing) => {
    const name = translateAssetName(t, listing.name);
    const number = listing.cardNumber ? ` ${listing.cardNumber}` : "";
    const link = "https://t.me/G2047_bot?start=market_card";
    const text = `${t("market.shareText", "我在 GrowthBot 市场发现一张 Agent 技能卡：")} ${name}${number}，${listing.price} ${displayCurrency(listing.currency)}。`;
    void apiClient.trackEvent("share_clicked", "market_listing_detail", {
      listingId: listing.id,
      assetItemId: listing.assetItemId,
      itemName: listing.name,
      cardNumber: listing.cardNumber || null,
      price: listing.price,
      rarity: listing.rarity,
      channel: "telegram",
      startParam: "market_card"
    });
    void apiClient.trackEvent("share_completed", "market_listing_detail", {
      listingId: listing.id,
      assetItemId: listing.assetItemId,
      itemName: listing.name,
      cardNumber: listing.cardNumber || null,
      price: listing.price,
      rarity: listing.rarity,
      channel: "telegram",
      startParam: "market_card"
    });
    telegramAdapter.shareUrl(link, text);
  };

  const handleCancel = async (listingId: string) => {
    telegramAdapter.hapticImpact("light");
    telegramAdapter.showConfirm(t("market.cancelConfirm", "确定取消这个挂单吗？"), async (ok) => {
      if (ok) {
        try {
          await onCancelListing(listingId);
          telegramAdapter.showAlert(t("market.cancelDone", "挂单已取消，物品已回到背包。"));
          if (onRefreshData) await onRefreshData();
        } catch (err: any) {
          telegramAdapter.showAlert(err.message || t("market.cancelFailed", "取消挂单失败"));
        }
      }
    });
  };

  return (
    <div className="view-panel marketplace-view animate-fade-in">
      <div className="view-header">
        <h2>{t("market.title", "市场 Marketplace")}</h2>
        <p className="muted font-12">{t("market.desc", "参与官方盲盒活动，并在自由市场买卖装备技能卡。")}</p>
      </div>

      {/* Tabs Switcher Header */}
      <div className="tab-header flex-row" style={{ display: "flex", gap: "6px", margin: "12px 0 16px 0" }}>
        <button
          className={marketTab === "store" ? "active" : ""}
          onClick={() => { telegramAdapter.hapticImpact("light"); setMarketTab("store"); }}
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: "600",
            background: marketTab === "store" ? "var(--primary)" : "var(--card-bg)",
            border: "none",
            color: marketTab === "store" ? "#000" : "var(--text)"
          }}
        >
          {t("market.officialStore", "官方商店")}
        </button>
        <button
          className={marketTab === "p2p" ? "active" : ""}
          onClick={() => { telegramAdapter.hapticImpact("light"); setMarketTab("p2p"); }}
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: "600",
            background: marketTab === "p2p" ? "var(--primary)" : "var(--card-bg)",
            border: "none",
            color: marketTab === "p2p" ? "#000" : "var(--text)"
          }}
        >
          {t("market.p2pMarket", "自由市场")}
        </button>
        <button
          className={marketTab === "my_listings" ? "active" : ""}
          onClick={() => { telegramAdapter.hapticImpact("light"); setMarketTab("my_listings"); }}
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: "600",
            background: marketTab === "my_listings" ? "var(--primary)" : "var(--card-bg)",
            border: "none",
            color: marketTab === "my_listings" ? "#000" : "var(--text)"
          }}
        >
          {t("market.myListings", "我的在售")}
        </button>
        <button
          className={marketTab === "history" ? "active" : ""}
          onClick={() => { telegramAdapter.hapticImpact("light"); setMarketTab("history"); }}
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: "600",
            background: marketTab === "history" ? "var(--primary)" : "var(--card-bg)",
            border: "none",
            color: marketTab === "history" ? "#000" : "var(--text)"
          }}
        >
          {t("market.history", "成交记录")}
        </button>
      </div>

      {/* 1. Official Store Tab */}
      {marketTab === "store" && (
        <StoreView 
          user={user} 
          agent={agent} 
          t={t} 
          onRefreshData={onRefreshData} 
          onNavigateToBag={onNavigateToBag}
        />
      )}

      {/* 2. P2P Market Tab */}
      {marketTab === "p2p" && (
        <>
          {/* Stats Bar */}
          <div className="market-stats-header">
            <div className="stat-pill">
              <span className="muted font-10 uppercase block">{t("market.floor", "地板价")}</span>
              <strong>{stats.floorPrice} {displayCurrency(stats.currency)}</strong>
            </div>
            <div className="stat-pill">
              <span className="muted font-10 uppercase block">{t("market.volume", "24h 量")}</span>
              <strong>{stats.volume24h} {displayCurrency(stats.currency)}</strong>
            </div>
            <div className="stat-pill">
              <span className="muted font-10 uppercase block">{t("market.move", "地板涨跌")}</span>
              <strong>{stats.floorMove24h || "+0%"}</strong>
            </div>
            <div className="stat-pill">
              <span className="muted font-10 uppercase block">{t("market.live", "在售数量")}</span>
              <strong>{stats.activeListings ?? listings.length}</strong>
            </div>
          </div>

          {trendingItems.length > 0 && (
            <div className="trending-market-strip">
              <h4><TrendingUp size={14} className="text-emerald" /> {t("market.trending", "热门资产")}</h4>
              <div className="trending-items-row">
                {trendingItems.slice(0, 3).map((item) => (
                  <div key={item.name} className="trending-item-pill">
                    <span className={`rarity-tag ${item.rarity}`}>{translateRarity(t, item.rarity)}</span>
                    <strong>{translateAssetName(t, item.name)}</strong>
                    <span>{item.floorPrice} {displayCurrency(stats.currency)} {t("market.floorShort", "地板")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {officialActivities.length > 0 && (
            <section className="official-activities-section" style={{ marginTop: "12px" }}>
              <div className="market-section-header">
                <h4><Sparkles size={14} className="text-amber" /> {t("market.officialActivities", "官方活动技能包")}</h4>
                <span>{t("market.officialActivityNote", "活动获取，不是销售入口")}</span>
              </div>
              <div className="official-activity-grid">
                {officialActivities.map((box) => {
                  const remainPercent = Math.min(100, Math.max(0, Math.floor((box.remaining / box.total) * 100)));
                  return (
                    <article key={box.key} className={`official-activity-card border-${box.rarity}`}>
                      <div className="card-top-row">
                        <span className={`rarity-tag ${box.rarity}`}>{translateRarity(t, box.rarity)}</span>
                        <span className="font-10 muted">{box.remaining}/{box.total}</span>
                      </div>
                      <h3>{translateAssetName(t, box.name)}</h3>
                      <p>{translateBoxRoute(t, box.route)}</p>
                      <div className="mini-progress-track">
                        <div className={`mini-progress-fill ${box.rarity}`} style={{ width: `${remainPercent}%` }} />
                      </div>
                      <div className="official-activity-meta">
                        <span><CalendarClock size={12} /> {translateBoxOdds(t, box.oddsLabel)}</span>
                      </div>
                      <div className="official-activity-actions">
                        <button
                          className="secondary compact"
                          onClick={() => telegramAdapter.showAlert(t("market.campaignDetails", "官方活动会通过任务、邀请、白名单项目合作发放技能包。V1 不提供公开支付购买。"))}
                        >
                          {t("market.viewCampaign", "查看活动")}
                        </button>
                        <button
                          className="primary compact"
                          onClick={() => {
                            telegramAdapter.hapticImpact("light");
                            onNavigateToEarn?.();
                          }}
                        >
                          {t("market.goTasks", "去完成任务")}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* User Listings Section */}
          <div className="market-listings-heading" style={{ marginTop: "20px" }}>
            <h4>{t("market.userListings", "用户挂单")}</h4>
            <span>{filteredListings.length} {t("market.liveShort", "在售")}</span>
          </div>

          <div className="market-filters-row" style={{ margin: "10px 0" }}>
            {(["all", "box", "ability"] as const).map((filter) => (
              <button
                key={filter}
                className={`tab-filter-btn ${filterType === filter ? "active" : ""}`}
                onClick={() => setFilterType(filter)}
              >
                {filterLabel(filter)}
              </button>
            ))}
          </div>

          {filteredListings.length === 0 ? (
            <div className="empty-market text-center pad-40" style={{ background: "var(--card-bg)", borderRadius: "10px" }}>
              <p className="muted">{t("market.empty", "没有符合条件的挂单。")}</p>
            </div>
          ) : (
            <div className="listings-grid">
              {filteredListings.map((list) => {
                const isMyListing = list.seller === currentUserUsername;
                return (
                  <article key={list.id} className={`market-listing-card rarity-${list.rarity}`}>
                    <div className="card-top-row">
                      <span className={`rarity-tag ${list.rarity}`}>{translateRarity(t, list.rarity)}</span>
                      <span className="listing-price-tag">{list.price} {displayCurrency(list.currency)}</span>
                    </div>
                    <div className="listing-body">
                      <h3>{translateAssetName(t, list.name)}</h3>
                      <div className="listing-metadata-grid">
                        <div className="listing-meta-item">
                          <span>{t("market.type", "类型")}</span>
                          <strong>{list.assetType === "box" ? translateItemType(t, "box") : translateCategory(t, list.category)}</strong>
                        </div>
                        {list.cardNumber && (
                          <div className="listing-meta-item">
                            <span>{t("market.cardNumber", "编号")}</span>
                            <strong className="font-mono text-amber">{list.cardNumber}</strong>
                          </div>
                        )}
                        <div className="listing-meta-item">
                          <span>{t("market.expiresIn", "剩余时间")}</span>
                          <strong>{list.expiresInMinutes ? `${list.expiresInMinutes}m` : formatExpiry(list.expiresAt)}</strong>
                        </div>
                        <div className="listing-meta-item">
                          <span>{t("market.seller", "卖家")}</span>
                          <strong className="text-truncate">{isMyListing ? t("market.you", "你") : list.seller}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="listing-actions">
                      {isMyListing ? (
                        <button className="secondary danger-text" onClick={() => handleCancel(list.id)}>
                          {t("market.cancel", "取消挂单")}
                        </button>
                      ) : (
                        <button className="primary" onClick={() => setSelectedListing(list)}>
                          <Eye size={13} /> {t("market.viewListing", "查看")}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 3. My Listings Tab */}
      {marketTab === "my_listings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
          {myListings.length === 0 ? (
            <div className="empty-market text-center pad-40" style={{ background: "var(--card-bg)", borderRadius: "10px" }}>
              <p className="muted">{t("market.noMyListings", "您当前没有在自由市场挂售的物品。")}</p>
            </div>
          ) : (
            <div className="listings-grid">
              {myListings.map((list) => (
                <article key={list.id} className={`market-listing-card rarity-${list.rarity}`}>
                  <div className="card-top-row">
                    <span className={`rarity-tag ${list.rarity}`}>{translateRarity(t, list.rarity)}</span>
                    <span className="listing-price-tag">{list.price} {displayCurrency(list.currency)}</span>
                  </div>
                  <div className="listing-body">
                    <h3>{translateAssetName(t, list.name)}</h3>
                    <div className="listing-metadata-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                      <div className="listing-meta-item">
                        <span>{t("market.type", "类型")}</span>
                        <strong>{list.assetType === "box" ? translateItemType(t, "box") : translateCategory(t, list.category)}</strong>
                      </div>
                      <div className="listing-meta-item">
                        <span>{t("market.expiresIn", "剩余时间")}</span>
                        <strong>{list.expiresInMinutes ? `${list.expiresInMinutes}m` : formatExpiry(list.expiresAt)}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="listing-actions">
                    <button className="secondary danger-text" style={{ width: "100%" }} onClick={() => handleCancel(list.id)}>
                      {t("market.cancel", "取消挂单")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. History Tab */}
      {marketTab === "history" && (
        <div className="recent-trades-container" style={{ background: "var(--card-bg)", borderRadius: "10px", padding: "16px", marginTop: "12px" }}>
          <h4><Flame size={14} className="text-amber" /> {t("market.recentTrades", "最近成交记录")}</h4>
          <div className="trades-ticker-list" style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
            {recentTrades.map((trade, idx) => (
              <div key={trade.id || idx} className="trade-ticker-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "8px" }}>
                <span className="trade-item-name">{translateAssetName(t, trade.name)}</span>
                <ArrowRight size={12} className="muted" />
                <span className="trade-details">
                  <strong>{trade.price} {displayCurrency(stats.currency)}</strong> · {t("market.buyerBy", "买家")} <strong>{trade.buyer}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purchase Success Overlay */}
      {purchaseSuccess && (
        <div className="purchase-success-alert animate-pop-in">
          <UserCheck size={18} />
          <span>{t("market.success", "购买成功！物品已加入背包。")}</span>
        </div>
      )}

      {/* Detail Modal Overlay */}
      {selectedListing && (
        <div className="box-opening-overlay list-item-overlay">
          <div className={`box-modal market-detail-modal rarity-${selectedListing.rarity}`}>
            <button className="close-btn" onClick={() => setSelectedListing(null)}>
              <X size={18} />
            </button>

            <div className="market-detail-hero">
              <span className={`rarity-tag ${selectedListing.rarity}`}>{translateRarity(t, selectedListing.rarity)}</span>
              <h3>{translateAssetName(t, selectedListing.name)}</h3>
              {selectedListing.cardNumber && <strong className="skill-serial">{selectedListing.cardNumber}</strong>}
              <p>{selectedListing.assetType === "box" ? t("market.boxUtility", "技能包可开出 Agent 技能卡和积分。") : t("market.skillUtility", "技能卡可用于增强 Agent 的任务发现、整理和验收能力。")}</p>
            </div>

            <div className="market-price-panel">
              <div>
                <span>{t("market.price", "价格")}</span>
                <strong>{selectedListing.price} {displayCurrency(selectedListing.currency)}</strong>
              </div>
              <div>
                <span>{t("market.floorRank", "地板排名")}</span>
                <strong>#{selectedListing.floorRank ?? "?"}</strong>
              </div>
            </div>

            <div className="skill-detail-grid">
              <div>
                <span>{t("market.type", "类型")}</span>
                <strong>{selectedListing.assetType === "box" ? translateItemType(t, "box") : translateCategory(t, selectedListing.category)}</strong>
              </div>
              <div>
                <span>{t("market.seller", "卖家")}</span>
                <strong>{selectedListing.seller}</strong>
              </div>
              <div>
                <span>{t("market.expiresIn", "剩余时间")}</span>
                <strong>{selectedListing.expiresInMinutes ? `${selectedListing.expiresInMinutes}m` : formatExpiry(selectedListing.expiresAt)}</strong>
              </div>
              <div>
                <span>{t("market.cardNumber", "编号")}</span>
                <strong>{selectedListing.cardNumber || t("market.noSerial", "未公开")}</strong>
              </div>
            </div>

            <div className="skill-value-note">
              <ShieldCheck size={14} />
              <span>{t("market.buyNote", "购买后资产会进入你的背包。未装备的可交易技能卡可继续持有、装备或再次挂牌。")}</span>
            </div>

            <div className="skill-detail-actions">
              <button
                className="primary"
                onClick={() => handleBuy(selectedListing.id)}
                disabled={buyingId === selectedListing.id}
              >
                {buyingId === selectedListing.id ? t("market.buying", "购买中...") : t("market.confirmBuy", "确认购买")}
              </button>
              <button className="secondary" onClick={() => shareListing(selectedListing)}>
                <Share2 size={14} /> {t("market.share", "分享挂单")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatExpiry(value: string): string {
  const minutes = Math.max(1, Math.floor((new Date(value).getTime() - Date.now()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function displayCurrency(currency?: string): string {
  return currency === "GP" || currency === "POINT_TEST" || currency === "PT" ? "积分" : currency || "积分";
}
