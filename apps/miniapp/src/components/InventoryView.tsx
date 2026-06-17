import React, { useState } from "react";
import { Sparkles, Calendar, ToggleLeft } from "lucide-react";
import type { InventoryItem } from "@growthbot/shared";
import { telegramAdapter } from "../telegramAdapter";
import { translateAbilityEffect, translateAssetName, translateCategory, translateRarity, translateStatus } from "../i18n";

interface InventoryViewProps {
  items: InventoryItem[];
  onUseAbility: (id: string) => Promise<void>;
  onListMarketplace: (id: string, price: string) => Promise<void>;
  t: (key: string, fallback: string) => string;
}

export function InventoryView({ items, onUseAbility, onListMarketplace, t }: InventoryViewProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | "box" | "ability" | "ticket">("all");
  const [listingItemId, setListingItemId] = useState<string | null>(null);
  const [listingPrice, setListingPrice] = useState("10.0");

  const filteredItems = items.filter((item) => {
    if (activeFilter === "all") return true;
    return item.type === activeFilter;
  });

  const handleListSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listingItemId) return;
    const priceVal = parseFloat(listingPrice);
    if (isNaN(priceVal) || priceVal <= 0) {
      telegramAdapter.showAlert(t("inv.invalidPrice", "请输入大于 0 的有效价格。"));
      return;
    }

    try {
      await onListMarketplace(listingItemId, listingPrice);
      telegramAdapter.showAlert(t("inv.listedToast", "物品已挂到市场。"));
      setListingItemId(null);
    } catch (err: any) {
      telegramAdapter.showAlert(err.message || t("inv.listFailed", "挂售失败"));
    }
  };

  const handleUseAbility = async (itemId: string) => {
    telegramAdapter.hapticImpact("light");
    try {
      await onUseAbility(itemId);
    } catch (err: any) {
      telegramAdapter.showAlert(err.message || t("inv.useFailed", "使用技能失败"));
    }
  };

  return (
    <div className="view-panel inventory-view animate-fade-in">
      <div className="view-header">
        <h2>{t("inv.title", "我的背包")}</h2>
        <p className="muted font-12">{t("inv.desc", "查看你持有的盒子、技能和可交易资产。")}</p>
      </div>

      {/* Filter Tabs */}
      <div className="inventory-filters">
        {(["all", "box", "ability", "ticket"] as const).map((filter) => (
          <button
            key={filter}
            className={`filter-btn ${activeFilter === filter ? "active" : ""}`}
            onClick={() => setActiveFilter(filter)}
          >
            {t(`inv.${filter}`, filter.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Item List Grid */}
      {filteredItems.length === 0 ? (
        <div className="empty-inventory text-center">
          <div className="empty-brand-mark">
            <img src="/growthbot-logo.png" alt="GrowthBot" className="empty-brand-mark-img brand-mark-img" />
          </div>
          <p className="muted">{t("inv.empty", "背包为空")}</p>
          <span className="font-12 muted">{t("inv.emptyDesc", "先完成任务或在市场购买盒子。")}</span>
        </div>
      ) : (
        <div className="inventory-grid">
          {filteredItems.map((item) => {
            const isListed = item.status === "listed";
            const expires = item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : null;
            const isAbility = item.type === "ability";

            return (
              <article className={`inventory-card-item rarity-${item.rarity}`} key={item.id}>
                <div className="card-top">
                  <span className={`rarity-tag ${item.rarity}`}>{translateRarity(t, item.rarity)}</span>
                  <span className={`transferable-tag ${item.transferable ? "tradable" : "soulbound"}`}>
                    {item.transferable ? t("inv.tradable", "可交易") : t("inv.soulbound", "绑定")}
                  </span>
                </div>

                <div className="card-body">
                  <h3>{translateAssetName(t, item.name)}</h3>
                  {isAbility && (
                    <div className="ability-badge-strip" style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                      <Sparkles size={12} className="text-amber" />
                      <span className="rarity-tag mini">{translateCategory(t, item.category)}</span>
                      <span className="ability-utility-desc">{translateAbilityEffect(t, item.name)}</span>
                      {item.cardNumber && (
                        <span className="card-number-badge font-10 text-amber font-mono" style={{ backgroundColor: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "4px" }}>
                          {item.cardNumber}
                        </span>
                      )}
                      {item.series && (
                        <span className="card-series-badge font-10 text-muted" style={{ backgroundColor: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "4px" }}>
                          {item.series}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="card-meta-grid">
                    {expires && (
                      <div className="meta-grid-item">
                        <span className="meta-label">{t("inv.expiry", "过期")}</span>
                        <span className="meta-val">{expires}</span>
                      </div>
                    )}
                    {item.usesRemaining !== undefined && (
                      <div className="meta-grid-item">
                        <span className="meta-label">{t("inv.uses", "次数")}</span>
                        <span className="meta-val">{item.usesRemaining} {t("inv.left", "剩余")}</span>
                      </div>
                    )}
                    <div className="meta-grid-item">
                      <span className="meta-label">{t("inv.status", "状态")}</span>
                      <span className={`meta-val status-${item.status}`}>{translateStatus(t, item.status)}</span>
                    </div>
                    <div className="meta-grid-item">
                      <span className="meta-label">{t("inv.market", "交易权")}</span>
                      <span className="meta-val">{item.transferable ? t("inv.tradable", "可交易") : t("inv.soulbound", "绑定")}</span>
                    </div>
                  </div>
                </div>

                <div className="card-actions">
                  {isListed ? (
                    <button className="disabled-btn" disabled>
                      {t("inv.listed", "已挂售")}
                    </button>
                  ) : item.type === "box" ? (
                    <span className="font-12 text-amber text-center w-full block pad-6">
                      {t("inv.openVia", "通过开盒页打开，或挂到市场")}
                    </span>
                  ) : item.status === "active" ? (
                    <button className="disabled-btn" disabled style={{ opacity: 0.6 }}>
                      {t("inv.equipped", "已装备")}
                    </button>
                  ) : (
                    <button className="primary" onClick={() => handleUseAbility(item.id)}>
                      {t("inv.useAbility", "使用技能")}
                    </button>
                  )}

                  {item.status === "available" && !isListed && item.transferable && (
                    <button className="secondary" onClick={() => setListingItemId(item.id)}>
                      {t("inv.sell", "挂到市场")}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Listing Overlay Modal */}
      {listingItemId && (
        <div className="box-opening-overlay list-item-overlay">
          <div className="box-modal list-modal">
            <h3>{t("inv.listTitle", "挂售物品")}</h3>
            <p className="muted font-12">{t("inv.listDesc", "设置测试积分价格，成交收取 2.5% 市场手续费。")}</p>

            <form onSubmit={handleListSubmit}>
              <div className="form-group">
                <label>{t("inv.price", "挂单价格")}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={listingPrice}
                  onChange={(e) => setListingPrice(e.target.value)}
                  required
                />
              </div>

              <div className="list-form-actions">
                <button type="submit" className="primary">
                  {t("inv.confirm", "确认挂售")}
                </button>
                <button type="button" className="secondary" onClick={() => setListingItemId(null)}>
                  {t("common.cancel", "取消")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
