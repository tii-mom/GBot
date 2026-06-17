import React, { useMemo, useState } from "react";
import { Clock, ArrowRight, UserCheck, Flame, TrendingUp, Zap, Boxes } from "lucide-react";
import type { MarketplaceListing, TrendingItem } from "@growthbot/shared";
import { telegramAdapter } from "../telegramAdapter";
import { translateAssetName, translateCategory, translateItemType, translateMarketSection, translateRarity } from "../i18n";

interface MarketplaceViewProps {
  stats: { floorPrice: string; volume24h: string; currency: string; floorMove24h?: string; activeListings?: number };
  listings: MarketplaceListing[];
  recentTrades: Array<{ id: string; name: string; price: string; buyer: string }>;
  trendingItems: TrendingItem[];
  marketSections?: Array<{ key: string; title: string; listingIds: string[] }>;
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
  currentUserUsername,
  onBuyItem,
  onCancelListing,
  t
}: MarketplaceViewProps) {
  const [filterType, setFilterType] = useState<"all" | "box" | "ability">("all");
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

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
    if (value === "box") return t("market.box", "盒子");
    return t("market.skill", "技能");
  };

  const handleBuy = async (listingId: string) => {
    telegramAdapter.hapticImpact("heavy");
    setBuyingId(listingId);

    try {
      await onBuyItem(listingId);
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
        <p className="muted font-12">{t("market.desc", "与其他 Agent 交易任务资产。")}</p>
      </div>

      {/* Market Stats Bar */}
      <div className="market-stats-header">
        <div className="stat-pill">
          <span className="muted font-10 uppercase block">{t("market.floor", "地板价")}</span>
          <strong>{stats.floorPrice} PT</strong>
        </div>
        <div className="stat-pill">
          <span className="muted font-10 uppercase block">{t("market.volume", "24h 量")}</span>
          <strong>{stats.volume24h} PT</strong>
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
                <span>{item.floorPrice} PT {t("market.floorShort", "地板")}</span>
              </div>
            ))}
          </div>
        </div>
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
                    <span>{item.price} PT</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Rarity & Filter Row */}
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
          <span className="font-11 muted">{t("market.emptyHint", "从背包挂售物品，开始获取测试积分。")}</span>
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
                    {list.price} {list.currency.replace("POINT_TEST", "PT")}
                  </span>
                </div>

                <div className="listing-body">
                  <h3>{translateAssetName(t, list.name)}</h3>
                  <div className="listing-metadata-grid">
                    <div className="listing-meta-item">
                      <span>{t("market.type", "类型")}</span>
                      <strong>{list.assetType === "box" ? translateItemType(t, "box") : translateCategory(t, list.category)}</strong>
                    </div>
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
                    <button
                      className="primary"
                      onClick={() => handleBuy(list.id)}
                      disabled={buyingId === list.id}
                    >
                      {buyingId === list.id ? t("market.buying", "购买中...") : t("market.buy", "购买")}
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
                {trade.price} PT {t("market.buyerBy", "买家")} <strong>{trade.buyer}</strong>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatExpiry(value: string): string {
  const minutes = Math.max(1, Math.floor((new Date(value).getTime() - Date.now()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}
