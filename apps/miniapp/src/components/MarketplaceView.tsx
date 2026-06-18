import React, { useMemo, useState } from "react";
import { ArrowRight, CalendarClock, Eye, Flame, Share2, ShieldCheck, Sparkles, TrendingUp, UserCheck, X } from "lucide-react";
import type { BoxSupply, MarketplaceListing, TrendingItem } from "@growthbot/shared";
import { telegramAdapter } from "../telegramAdapter";
import { apiClient } from "../apiClient";
import { translateAssetName, translateBoxOdds, translateBoxRoute, translateCategory, translateItemType, translateMarketSection, translateRarity } from "../i18n";

interface MarketplaceViewProps {
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
}

export function MarketplaceView({
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
  t
}: MarketplaceViewProps) {
  const [filterType, setFilterType] = useState<"all" | "box" | "ability">("all");
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);

  const filteredListings = listings.filter((item) => {
    if (filterType === "all") return true;
    if (filterType === "box") return item.name.toLowerCase().includes("box");
    return !item.name.toLowerCase().includes("box");
  });
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
        } catch (err: any) {
          telegramAdapter.showAlert(err.message || t("market.cancelFailed", "取消挂单失败"));
        }
      }
    });
  };

  return (
    <div className="view-panel marketplace-view animate-fade-in">
      <div className="view-header">
        <h2>{t("market.title", "市场")}</h2>
        <p className="muted font-12">{t("market.desc", "参与官方技能包活动，并交易用户挂单资产。")}</p>
      </div>

      {/* Market Stats Bar */}
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
                <span>{item.floorPrice} GP {t("market.floorShort", "地板")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {officialActivities.length > 0 && (
        <section className="official-activities-section">
          <div className="market-section-header">
            <h4><Sparkles size={14} className="text-amber" /> {t("market.officialActivities", "官方技能包活动")}</h4>
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
                    <button className="secondary compact" onClick={() => setFilterType("box")}>
                      {t("market.viewBoxListings", "查看市场挂单")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {sectionListings.length > 0 && (
        <div className="market-sections-stack">
          {sectionListings.slice(0, 4).map((section) => (
            <section key={section.key} className="market-section-card">
              <div className="market-section-header">
                <h4>{translateMarketSection(t, section.title)}</h4>
                <span>{section.items.length} {t("market.liveShort", "在售")}</span>
              </div>
              <div className="market-section-list">
                {section.items.slice(0, 2).map((item) => (
                  <div key={item.id} className="market-section-row">
                    <div>
                      <strong>{translateAssetName(t, item.name)}</strong>
                      <p>{item.assetType === "box" ? translateItemType(t, "box") : translateCategory(t, item.category)} · {item.floorRank ? `#${item.floorRank}` : t("market.floorShort", "地板")}</p>
                    </div>
                    <span>{item.price} GP</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Rarity & Filter Row */}
      <div className="market-listings-heading">
        <h4>{t("market.userListings", "用户挂单")}</h4>
        <span>{filteredListings.length} {t("market.liveShort", "在售")}</span>
      </div>
      <div className="market-filters-row">
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

      {/* Purchase feedback alert */}
      {purchaseSuccess && (
        <div className="purchase-success-alert animate-pop-in">
          <UserCheck size={18} />
          <span>{t("market.success", "购买成功！物品已加入背包。")}</span>
        </div>
      )}

      {/* Listing Grid */}
      {filteredListings.length === 0 ? (
        <div className="empty-market text-center pad-40">
          <div className="empty-brand-mark">
            <img src="/growthbot-logo.png" alt="GrowthBot" className="empty-brand-mark-img brand-mark-img" />
          </div>
          <p className="muted">{t("market.empty", "没有符合条件的挂单。")}</p>
          <span className="font-11 muted">{t("market.emptyHint", "从背包挂售未装备的技能卡，开始获取 GP。")}</span>
        </div>
      ) : (
        <div className="listings-grid">
          {filteredListings.map((list) => {
            const isMyListing = list.seller === currentUserUsername;

            return (
              <article key={list.id} className={`market-listing-card rarity-${list.rarity}`}>
                <div className="card-top-row">
                  <span className={`rarity-tag ${list.rarity}`}>{translateRarity(t, list.rarity)}</span>
                  <span className="listing-price-tag">
                    {list.price} {displayCurrency(list.currency)}
                  </span>
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
                      <span>{t("market.floorRank", "地板排名")}</span>
                      <strong>#{list.floorRank ?? "?"}</strong>
                    </div>
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

      {/* Recent trades */}
      <div className="recent-trades-container">
        <h4>
          <Flame size={14} className="text-amber" /> {t("market.recentTrades", "最近成交")}
        </h4>
        <div className="trades-ticker-list">
          {recentTrades.slice(0, 3).map((trade, idx) => (
            <div key={trade.id || idx} className="trade-ticker-row">
              <span className="trade-item-name">{translateAssetName(t, trade.name)}</span>
              <ArrowRight size={12} className="muted" />
              <span className="trade-details">
                {trade.price} GP {t("market.buyerBy", "买家")} <strong>{trade.buyer}</strong>
              </span>
            </div>
          ))}
        </div>
      </div>

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
              <p>{selectedListing.assetType === "box" ? t("market.boxUtility", "技能包可开出 Agent 技能卡和 GP。") : t("market.skillUtility", "技能卡可用于增强 Agent 的任务发现、整理和验收能力。")}</p>
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
              <span>{t("market.buyNote", "购买后资产会进入你的背包。未装备的可交易技能卡可继续持有、装备或再次挂牌。GP 不是代币，不承诺固定兑换。")}</span>
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
  return currency === "POINT_TEST" || currency === "PT" ? "GP" : currency || "GP";
}
