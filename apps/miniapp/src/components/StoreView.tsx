import React, { useState, useEffect } from "react";
import { 
  Package, 
  Zap, 
  HelpCircle, 
  ChevronRight, 
  RefreshCw, 
  CheckCircle2, 
  Lock, 
  ShoppingBag,
  Sparkles,
  Info
} from "lucide-react";
import type { Agent, User } from "@growthbot/shared";
import { apiClient } from "../apiClient";
import { telegramAdapter } from "../telegramAdapter";
import { translateAssetName, translateRarity } from "../i18n";

interface StoreViewProps {
  user: User;
  agent: Agent | null;
  t: (key: string, fallback: string) => string;
  onRefreshData?: () => Promise<void>;
  onNavigateToBag?: () => void;
}

export function StoreView({ user, agent, t, onRefreshData, onNavigateToBag }: StoreViewProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Selected product detail modal
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [dropTable, setDropTable] = useState<any[]>([]);
  const [loadingDropTable, setLoadingDropTable] = useState(false);

  // Purchase state
  const [purchasing, setPurchasing] = useState(false);
  const [purchasedBoxItem, setPurchasedBoxItem] = useState<any | null>(null); // Box inventory item returned
  
  // Box opening state
  const [opening, setOpening] = useState(false);
  const [openRewards, setOpenRewards] = useState<any[]>([]);

  // Fetch store catalog
  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getStoreBoxes();
      if (res && res.products) {
        setProducts(res.products);
      }
    } catch (err) {
      console.error("Failed to load store products", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [agent]);

  // Load drop table when product modal opens
  useEffect(() => {
    if (selectedProduct) {
      setLoadingDropTable(true);
      apiClient.getDropTable(selectedProduct.id)
        .then((res: any) => {
          if (res && res.dropTable) setDropTable(res.dropTable);
        })
        .catch((err: any) => console.error(err))
        .finally(() => setLoadingDropTable(false));
    } else {
      setDropTable([]);
    }
  }, [selectedProduct]);

  if (!agent) {
    return (
      <div className="view-panel text-center flex-center flex-column" style={{ padding: "40px 20px" }}>
        <ShoppingBag size={48} className="muted" />
        <h3 style={{ marginTop: "16px" }}>{t("store.noAgentTitle", "未绑定 Agent")}</h3>
        <p className="muted font-13">{t("store.noAgentDesc", "请先绑定或领取您的 Agent，即可在商店购买官方装备与技能盲盒。")}</p>
      </div>
    );
  }

  const handlePurchase = async (product: any) => {
    if (purchasing) return;
    setPurchasing(true);
    telegramAdapter.hapticImpact("medium");

    try {
      const res = await apiClient.purchaseBox(product.id, 1);
      telegramAdapter.hapticImpact("heavy");
      // Purchase API returns the fulfilled inventory item inside order metadata or we can find it
      const order = res.order;
      setPurchasedBoxItem({
        id: order.fulfilledInventoryItemId || "item_mock_box",
        name: order.boxName
      });
      
      if (onRefreshData) await onRefreshData();
      await fetchCatalog();
    } catch (err: any) {
      console.error(err);
      telegramAdapter.showAlert(err.message || t("store.purchaseFailed", "Purchase failed. Check G budget, policy limits, or inventory cap."));
    } finally {
      setPurchasing(false);
    }
  };

  const handleOpenBoxNow = async () => {
    if (!purchasedBoxItem || opening) return;
    setOpening(true);
    telegramAdapter.hapticImpact("heavy");

    try {
      const res = await apiClient.openBox(purchasedBoxItem.id);
      telegramAdapter.hapticImpact("heavy");
      setOpenRewards(res.rewards || []);
      setPurchasedBoxItem(null); // clear purchase status
      if (onRefreshData) await onRefreshData();
    } catch (err: any) {
      telegramAdapter.showAlert(err.message || t("store.openFailed", "开启盒子失败。"));
      setPurchasedBoxItem(null);
    } finally {
      setOpening(false);
    }
  };

  const translateProbability = (prob: number) => {
    return `${(prob * 100).toFixed(1)}%`;
  };

  const displayCurrency = (currency?: string) => {
    return currency === "GP" || currency === "POINT_TEST" || currency === "PT" ? "G (legacy fallback)" : (currency || "G");
  };

  return (
    <div className="view-panel store-view animate-fade-in" style={{ paddingBottom: "80px" }}>
      {/* Header */}
      <div className="section-header flex-row align-center justify-between" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>{t("store.title", "Skill Card Store")}</h2>
          <p className="muted font-12">{t("store.subtitle", "Skill Cards 是 Agent capability assets。31-card system：Normal / Advanced / Expert。未来定价以 G 和 AI Credits 预算展示。")}</p>
        </div>
        <div style={{ background: "var(--card-bg)", padding: "4px 10px", borderRadius: "20px", display: "flex", alignItems: "center", gap: "4px" }}>
          <Zap size={13} className="text-amber" />
          <strong className="font-12">G budget · policy-limited</strong>
        </div>
      </div>

      {/* Product List */}
      {loading ? (
        <div className="text-center muted font-12" style={{ padding: "40px" }}>
          <RefreshCw className="spinning-icon" size={20} /> {t("store.loadingCatalog", "正在加载商店目录...")}
        </div>
      ) : (
        <div className="product-list" style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
          {products.map((product) => {
            const isStarter = product.boxType === "starter";
            const isAffordable = true; // Real-asset UX: affordability is enforced by backend policy guard / G budget, not GP client copy.
            const isSoldOut = product.remainingSupply <= 0;
            
            // Check button text
            let btnText = `${product.priceAmount} ${displayCurrency(product.priceCurrency)}`;
            let btnDisabled = false;

            if (isStarter) {
              btnText = t("store.starterClaimed", "专属领取 (限1次)");
              btnDisabled = true;
            } else if (isSoldOut) {
              btnText = t("store.soldOut", "已售罄");
              btnDisabled = true;
            } else if (!isAffordable) {
              btnText = t("store.insufficientPoints", "Budget limit reached");
              btnDisabled = true;
            }

            return (
              <div 
                key={product.id} 
                className={`card product-card border-${product.rarity}`}
                onClick={() => setSelectedProduct(product)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "16px",
                  borderRadius: "12px",
                  background: "var(--card-bg)",
                  cursor: "pointer",
                  position: "relative"
                }}
              >
                <div className="flex-row justify-between align-center" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className={`rarity-tag ${product.rarity}`}>{translateRarity(t, product.rarity)}</span>
                  <span className="font-11 muted">{product.remainingSupply}/{product.totalSupply} {t("store.stock", "剩余库存")}</span>
                </div>

                <div className="flex-row align-center gap-12" style={{ display: "flex", gap: "12px", margin: "12px 0" }}>
                  <div className={`glowing-avatar rarity-glow-${product.rarity}`} style={{ width: "48px", height: "48px", borderRadius: "10px", background: "rgba(0,0,0,0.3)" }}>
                    <Package size={24} className={product.rarity === "epic" ? "text-epic" : (product.rarity === "rare" ? "text-primary" : "muted")} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0 }}>{translateAssetName(t, product.name)}</h3>
                    <p className="muted font-11" style={{ margin: "2px 0 0 0" }}>{product.description}</p>
                  </div>
                </div>

                <div className="flex-row align-center justify-between" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                  <span className="font-11 muted flex-row align-center gap-4">
                    <Info size={12} /> {product.perUserLimit > 0 ? `${t("store.limit", "每人限购")} ${product.perUserLimit}` : t("store.unlimited", "不限购")}
                  </span>
                  
                  <button
                    className={`primary small ${btnDisabled ? "disabled" : ""}`}
                    disabled={btnDisabled || purchasing}
                    onClick={() => handlePurchase(product)}
                    style={{ padding: "8px 16px", fontSize: "12px", width: "120px" }}
                  >
                    {purchasing ? <RefreshCw className="spinning-icon" size={14} /> : btnText}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 1. Product Detail Modal & Drop Table */}
      {selectedProduct && (
        <div className="modal-backdrop active-modal" onClick={() => setSelectedProduct(null)}>
          <div className="modal-content text-left" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "80vh", overflowY: "auto" }}>
            <div className="modal-header flex-row justify-between align-center" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3>{translateAssetName(t, selectedProduct.name)}</h3>
              <button className="close-btn" onClick={() => setSelectedProduct(null)}>
                <CheckCircle2 size={18} />
              </button>
            </div>

            <div className="font-12" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <p><strong>{t("store.desc", "商品描述")}:</strong> {selectedProduct.description}</p>
              <p><strong>{t("store.boxType", "盲盒类别")}:</strong> {selectedProduct.boxType.toUpperCase()}</p>
              <p><strong>{t("store.rarity", "商品品质")}:</strong> <span className={`rarity-tag ${selectedProduct.rarity}`}>{selectedProduct.rarity.toUpperCase()}</span></p>
              <p><strong>{t("store.tradeStatus", "二级交易")}:</strong> {selectedProduct.transferable ? t("store.tradable", "支持挂单出售") : t("store.soulbound", "灵魂绑定不可划转")}</p>

              {/* Drop table */}
              <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <h4 style={{ marginBottom: "8px" }}>{t("store.oddsTitle", "Capability pool / no promised outcome")}</h4>
                {loadingDropTable ? (
                  <div className="muted font-11">{t("store.loadingOdds", "正在载入概率...")}</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {dropTable.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex-row justify-between font-11"
                        style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "4px" }}
                      >
                        <span className="flex-row align-center gap-4">
                          <span className={`rarity-tag ${item.rarity}`} style={{ padding: "1px 4px", fontSize: "9px" }}>{item.rarity.toUpperCase()}</span>
                          {translateAssetName(t, item.assetName)}
                        </span>
                        <strong>{item.guaranteed ? t("store.guaranteed", "included in this pool") : translateProbability(item.probability)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Purchase Success Modal (Choice: open now or later) */}
      {purchasedBoxItem && (
        <div className="modal-backdrop active-modal">
          <div className="modal-content text-center" style={{ maxWidth: "320px", padding: "24px" }}>
            <div className="flex-center flex-column" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div className="glowing-avatar brand-avatar" style={{ background: "rgba(0, 200, 100, 0.15)", color: "var(--primary)" }}>
                <CheckCircle2 size={36} />
              </div>
              <h3>{t("store.purchasedTitle", "购买盲盒成功！")}</h3>
              <p className="muted font-12" style={{ margin: "4px 0 16px 0" }}>
                {t("store.purchasedDesc", "Skill Card asset 已进入背包。装备后可增强 Agent 能力；不会承诺回报、资格或固定结果。AI capacity 购买仍受策略限制。")}
              </p>

              <button
                className="primary action-btn font-12"
                style={{ width: "100%", padding: "12px" }}
                disabled={opening}
                onClick={handleOpenBoxNow}
              >
                {opening ? <RefreshCw className="spinning-icon" size={16} /> : t("store.openNow", "立即开启")}
              </button>

              <button
                className="secondary action-btn font-12"
                style={{ width: "100%", padding: "10px", marginTop: "6px" }}
                disabled={opening}
                onClick={() => {
                  telegramAdapter.hapticImpact("light");
                  setPurchasedBoxItem(null);
                  if (onNavigateToBag) onNavigateToBag();
                }}
              >
                {t("store.openLater", "稍后开启 (放入背包)")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Open Rewards Screen (Mermaid / Rarity drops details) */}
      {openRewards.length > 0 && (
        <div className="modal-backdrop active-modal" onClick={() => setOpenRewards([])}>
          <div className="modal-content text-center animate-pop-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "320px", padding: "24px" }}>
            <div className="flex-center flex-column" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <Sparkles className="text-epic animate-bounce" size={40} />
              <h3>{t("store.unboxTitle", "恭喜获得！")}</h3>
              
              <div className="rewards-list" style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", margin: "16px 0" }}>
                {openRewards.map((reward, index) => (
                  <div 
                    key={index} 
                    className="flex-row justify-between align-center" 
                    style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.05)", padding: "8px 12px", borderRadius: "6px" }}
                  >
                    <span className="font-12 flex-row align-center gap-6">
                      {reward.type === "ability" ? (
                        <>
                          <span className={`rarity-tag ${reward.rarity || "common"}`} style={{ fontSize: "9px" }}>{(reward.rarity || "common").toUpperCase()}</span>
                          {translateAssetName(t, reward.name)}
                        </>
                      ) : (
                        <span>{reward.name}</span>
                      )}
                    </span>
                    <strong className="font-12 text-epic">
                      {reward.type === "pending_points" ? `legacy fallback +${reward.amount}` : (reward.type === "energy" ? `+${reward.amount} AI capacity` : "NEW SKILL CARD")}
                    </strong>
                  </div>
                ))}
              </div>

              <button
                className="primary action-btn font-12"
                style={{ width: "100%", padding: "12px" }}
                onClick={() => {
                  telegramAdapter.hapticImpact("light");
                  setOpenRewards([]);
                }}
              >
                {t("store.ack", "知道了")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
