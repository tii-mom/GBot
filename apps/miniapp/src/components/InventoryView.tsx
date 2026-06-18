import React, { useState } from "react";
import { Eye, Share2, Sparkles, X } from "lucide-react";
import type { InventoryItem } from "@growthbot/shared";
import { telegramAdapter } from "../telegramAdapter";
import { apiClient } from "../apiClient";
import { translateAbilityEffect, translateAssetName, translateCategory, translateRarity, translateStatus } from "../i18n";

interface InventoryViewProps {
  items: InventoryItem[];
  onUseAbility: (id: string) => Promise<void>;
  onUnequipAbility: (id: string) => Promise<void>;
  onListMarketplace: (id: string, price: string) => Promise<void>;
  t: (key: string, fallback: string) => string;
}

export function InventoryView({ items, onUseAbility, onUnequipAbility, onListMarketplace, t }: InventoryViewProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | "box" | "ability" | "ticket">("all");
  const [listingItemId, setListingItemId] = useState<string | null>(null);
  const [listingPrice, setListingPrice] = useState("10.0");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

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

  const handleUnequipAbility = async (itemId: string) => {
    telegramAdapter.hapticImpact("light");
    telegramAdapter.showConfirm(t("inv.unequipConfirm", "卸下后将进入 24 小时冷却，冷却结束前不能交易或再次装备。确定卸下？"), async (ok) => {
      if (!ok) return;
      try {
        await onUnequipAbility(itemId);
      } catch (err: any) {
        telegramAdapter.showAlert(err.message || t("inv.unequipFailed", "卸下技能失败"));
      }
    });
  };

  const formatCooldown = (value?: string | null) => {
    if (!value) return t("inv.cooldownUnknown", "冷却中");
    const diff = new Date(value).getTime() - Date.now();
    if (diff <= 0) return t("inv.cooldownReady", "即将恢复");
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.ceil((diff % 3_600_000) / 60_000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const marketLabel = (item: InventoryItem) => {
    if (item.status === "cooling_down") return t("inv.afterCooldown", "冷却后恢复");
    if (item.transferable) return t("inv.tradable", "可交易");
    return t("inv.soulbound", "绑定");
  };

  const shareSkillCard = (item: InventoryItem) => {
    const name = translateAssetName(t, item.name);
    const number = item.cardNumber ? ` ${item.cardNumber}` : "";
    const series = item.series ? ` / ${item.series}` : "";
    const link = "https://t.me/G2047_bot?start=box_report";
    const text = t("inv.shareText", "我的 GrowthBot Agent 获得了一张技能卡：")
      + ` ${name}${number}${series}。`
      + ` ${translateAbilityEffect(t, item.name)}。`;
    void apiClient.trackEvent("share_clicked", "skill_card_detail", {
      itemId: item.id,
      itemName: item.name,
      cardNumber: item.cardNumber || null,
      rarity: item.rarity,
      channel: "telegram",
      startParam: "box_report"
    });
    void apiClient.trackEvent("share_completed", "skill_card_detail", {
      itemId: item.id,
      itemName: item.name,
      cardNumber: item.cardNumber || null,
      rarity: item.rarity,
      channel: "telegram",
      startParam: "box_report"
    });
    telegramAdapter.shareUrl(link, text);
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
            const isCoolingDown = item.status === "cooling_down";

            return (
              <article className={`inventory-card-item rarity-${item.rarity}`} key={item.id}>
                <div className="card-top">
                  <span className={`rarity-tag ${item.rarity}`}>{translateRarity(t, item.rarity)}</span>
                  <span className={`transferable-tag ${item.transferable ? "tradable" : "soulbound"}`}>
                    {isCoolingDown ? t("inv.cooling", "冷却中") : marketLabel(item)}
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
                    {isCoolingDown && (
                      <div className="meta-grid-item">
                        <span className="meta-label">{t("inv.cooldown", "冷却")}</span>
                        <span className="meta-val text-amber">{formatCooldown(item.cooldownUntil)}</span>
                      </div>
                    )}
                    <div className="meta-grid-item">
                      <span className="meta-label">{t("inv.market", "交易权")}</span>
                      <span className="meta-val">
                        {marketLabel(item)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card-actions">
                  <button className="secondary compact" onClick={() => setSelectedItem(item)}>
                    <Eye size={13} /> {t("inv.details", "详情")}
                  </button>
                  {isListed ? (
                    <button className="disabled-btn" disabled>
                      {t("inv.listed", "已挂售")}
                    </button>
                  ) : item.type === "box" ? (
                    <span className="font-12 text-amber text-center w-full block pad-6">
                      {t("inv.openVia", "通过开盒页打开，或挂到市场")}
                    </span>
                  ) : item.status === "active" ? (
                    <button className="secondary" onClick={() => handleUnequipAbility(item.id)}>
                      {t("inv.unequip", "卸下技能")}
                    </button>
                  ) : isCoolingDown ? (
                    <button className="disabled-btn" disabled style={{ opacity: 0.6 }}>
                      {t("inv.cooldownWait", "冷却中")} · {formatCooldown(item.cooldownUntil)}
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
            <p className="muted font-12">{t("inv.listDesc", "设置 GP 价格，成交收取 2.5% 市场手续费。")}</p>

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

      {selectedItem && (
        <div className="box-opening-overlay list-item-overlay">
          <div className={`box-modal skill-card-detail rarity-${selectedItem.rarity}`}>
            <button className="close-btn" onClick={() => setSelectedItem(null)}>
              <X size={18} />
            </button>
            <div className="skill-detail-hero">
              <span className={`rarity-tag ${selectedItem.rarity}`}>{translateRarity(t, selectedItem.rarity)}</span>
              <h3>{translateAssetName(t, selectedItem.name)}</h3>
              {selectedItem.cardNumber && <strong className="skill-serial">{selectedItem.cardNumber}</strong>}
              <p>{selectedItem.type === "ability" ? translateAbilityEffect(t, selectedItem.name) : t("inv.boxUtility", "技能包可开出 Agent 技能卡和 GP。")}</p>
            </div>

            <div className="skill-detail-grid">
              <div>
                <span>{t("inv.series", "所属系列")}</span>
                <strong>{selectedItem.series || selectedItem.sourceBox || t("common.other", "其他")}</strong>
              </div>
              <div>
                <span>{t("inv.status", "状态")}</span>
                <strong>{translateStatus(t, selectedItem.status)}</strong>
              </div>
              <div>
                <span>{t("inv.market", "交易权")}</span>
                <strong>{marketLabel(selectedItem)}</strong>
              </div>
              <div>
                <span>{t("market.type", "类型")}</span>
                <strong>{selectedItem.type === "ability" ? translateCategory(t, selectedItem.category) : selectedItem.type}</strong>
              </div>
              {selectedItem.usesRemaining !== undefined && (
                <div>
                  <span>{t("inv.uses", "次数")}</span>
                  <strong>{selectedItem.usesRemaining}</strong>
                </div>
              )}
              {selectedItem.status === "cooling_down" && (
                <div>
                  <span>{t("inv.cooldown", "冷却")}</span>
                  <strong>{formatCooldown(selectedItem.cooldownUntil)}</strong>
                </div>
              )}
            </div>

            <div className="skill-value-note">
              <Sparkles size={14} />
              <span>{t("inv.valueNote", "技能卡是 Agent 的能力组件。未装备的可交易卡可在市场流通，已装备卡会先服务你的 Agent。")}</span>
            </div>

            <div className="skill-detail-actions">
              {selectedItem.type === "ability" && selectedItem.status === "available" && (
                <button className="primary" onClick={() => handleUseAbility(selectedItem.id)}>
                  {t("inv.useAbility", "装备技能")}
                </button>
              )}
              {selectedItem.status === "active" && (
                <button className="secondary" onClick={() => handleUnequipAbility(selectedItem.id)}>
                  {t("inv.unequip", "卸下技能")}
                </button>
              )}
              {selectedItem.status === "available" && selectedItem.transferable && (
                <button className="secondary" onClick={() => {
                  setListingItemId(selectedItem.id);
                  setSelectedItem(null);
                }}>
                  {t("inv.sell", "挂售到市场")}
                </button>
              )}
              <button className="secondary" onClick={() => shareSkillCard(selectedItem)}>
                <Share2 size={14} /> {t("inv.share", "分享技能卡")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
