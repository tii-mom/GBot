import React, { useState } from "react";
import { Gift, X, Award, Zap, Sparkles, Share2 } from "lucide-react";
import type { InventoryItem } from "@growthbot/shared";
import { telegramAdapter } from "../telegramAdapter";
import { apiClient } from "../apiClient";
import { interpolate, translateAbilityEffect, translateAssetName, translateCategory, translateRarity } from "../i18n";

interface BoxOpeningViewProps {
  boxes: InventoryItem[];
  onOpenBox: (id: string) => Promise<{
    rewards: Array<{ type: string; amount?: number; name?: string; rarity?: string; category?: string }>;
  } | null>;
  onClose: () => void;
  t: (key: string, fallback: string) => string;
}

export function BoxOpeningView({ boxes, onOpenBox, onClose, t }: BoxOpeningViewProps) {
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(
    boxes.length > 0 ? (boxes[0]?.id ?? null) : null
  );
  const [openingState, setOpeningState] = useState<"idle" | "opening" | "revealed" | "error">("idle");
  const [rewards, setRewards] = useState<Array<{ type: string; amount?: number; name?: string; rarity?: string; category?: string }>>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const selectedBox = boxes.find((b) => b.id === selectedBoxId);

  const startOpen = async () => {
    if (!selectedBoxId) return;
    telegramAdapter.hapticImpact("heavy");
    setOpeningState("opening");

    try {
      const res = await onOpenBox(selectedBoxId);
      if (res) {
        // Hold on opening state for animation
        setTimeout(() => {
          setRewards(res.rewards);
          setOpeningState("revealed");
          telegramAdapter.hapticImpact("medium");
        }, 1200);
      } else {
        setOpeningState("error");
        setErrorMsg(t("box.errorTitle", "开盒失败，请重试。"));
      }
    } catch (err: any) {
      setOpeningState("error");
      setErrorMsg(err.message || t("box.errorTitle", "出了点问题。"));
    }
  };

  const shareResult = () => {
    telegramAdapter.hapticImpact("light");
    const rewardsStr = rewards
      .map((r) => (r.name ? `${translateAssetName(t, r.name)} (${translateRarity(t, r.rarity)})` : `+${r.amount} ${r.type.replace("_", " ")}`))
      .join(", ");
    const text = interpolate(t("share.box", "GrowthBot 开盒战报：{rewards}。免费 Agent 和启动盒正在开放。"), { rewards: rewardsStr });
    const url = "https://t.me/G2047_bot?start=box_report";
    void apiClient.trackEvent("share_clicked", "box_open_report", { startParam: "box_report", rewards: rewardsStr, channel: "telegram" });
    void apiClient.trackEvent("share_box_report", "box_open_report", { startParam: "box_report", rewards: rewardsStr, channel: "telegram" });
    void apiClient.trackEvent("share_completed", "box_open_report", { startParam: "box_report", rewards: rewardsStr, channel: "telegram" });
    telegramAdapter.shareUrl(url, text);
  };

  return (
    <div className="box-opening-overlay animate-fade-in">
      <div className="box-modal">
        <button className="close-btn" onClick={onClose} disabled={openingState === "opening"}>
          <X size={20} />
        </button>

        {/* 1. IDLE STATE: CHOOSE BOX & CLICK OPEN */}
        {openingState === "idle" && (
          <div className="modal-content text-center">
            <div className="box-hero-mark">
              <img src="/growthbot-logo.png" alt="GrowthBot" className="box-hero-mark-img brand-mark-img" />
            </div>
            <h2>{t("box.openBefore", "在供应变化前开盒")}</h2>
            <p className="muted font-13">
              {t("box.desc", "盒子可掉落积分、能量和限量任务资产。")}
            </p>

            {boxes.length === 0 ? (
              <div className="no-boxes-alert">
                <p>{t("box.noBox", "背包里没有可开的盒子。去市场或完成任务获取。")}</p>
              </div>
            ) : (
              <>
                <div className="box-select-list">
                  {boxes.map((b) => (
                    <button
                      key={b.id}
                      className={`box-select-card ${selectedBoxId === b.id ? "active" : ""}`}
                      onClick={() => setSelectedBoxId(b.id)}
                    >
                      <span className={`rarity-tag ${b.rarity}`}>{translateRarity(t, b.rarity)}</span>
                      <strong>{translateAssetName(t, b.name)}</strong>
                    </button>
                  ))}
                </div>

                <button className="primary open-box-action-btn" onClick={startOpen}>
                  {t("box.open", "开盒")} {translateAssetName(t, selectedBox?.name || "盒子")}
                </button>
              </>
            )}
          </div>
        )}

        {/* 2. OPENING ANIMATION STATE */}
        {openingState === "opening" && (
          <div className="modal-content text-center opening-animation-container">
            <div className="spinning-box-glow">
              <img src="/growthbot-logo.png" alt="GrowthBot" className="wobbling-box brand-mark-img spinning-logo-mark" />
            </div>
            <h3>{t("box.opening", "开盒中...")}</h3>
            <p className="muted">{t("box.rolled", "正在揭晓任务资产")}</p>
          </div>
        )}

        {/* 3. REVEALED RESULTS STATE */}
        {openingState === "revealed" && (
          <div className="modal-content text-center animate-pop-in">
            <Sparkles size={48} className="text-amber" />
            <h2 className="glow-title">{t("box.opened", "已开盒")}</h2>
            <p className="muted font-12" style={{ marginBottom: "16px" }}>
              {t("box.received", "你的 Agent 获得了以下内容：")}
            </p>

            <div className="rewards-grid">
              {rewards.map((reward, index) => {
                const isPoints = reward.type === "pending_points";
                const isEnergy = reward.type === "energy";

                const cardRarity = reward.rarity || (isPoints ? "common" : isEnergy ? "common" : "common");
                return (
                  <div key={index} className={`reward-item-card border-${cardRarity}`}>
                    {isPoints && (
                      <>
                        <Award size={28} className="text-amber" />
                        <span className="reward-amt">+{reward.amount}</span>
                        <span className="reward-lbl">{t("box.points", "积分")}</span>
                      </>
                    )}
                    {isEnergy && (
                      <>
                        <Zap size={28} className="text-emerald" />
                        <span className="reward-amt">+{reward.amount}</span>
                        <span className="reward-lbl">{t("box.energy", "能量")}</span>
                      </>
                    )}
                    {!isPoints && !isEnergy && (
                      <>
                        <span className={`rarity-badge mini ${reward.rarity || "common"}`}>
                          {translateRarity(t, reward.rarity)}
                        </span>
                        <strong className="reward-name">{translateAssetName(t, reward.name)}</strong>
                        <span className="reward-lbl">{translateCategory(t, reward.category)}</span>
                        <span className="reward-utility">{translateAbilityEffect(t, reward.name)}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="reveal-actions" style={{ marginTop: "24px", display: "grid", gap: "10px" }}>
              <button className="primary" onClick={shareResult}>
                <Share2 size={16} style={{ marginRight: "6px" }} /> {t("box.share", "分享结果")}
              </button>
              <button className="secondary" onClick={onClose}>
                {t("box.back", "返回首页")}
              </button>
            </div>
          </div>
        )}

        {/* 4. ERROR STATE */}
        {openingState === "error" && (
          <div className="modal-content text-center">
            <h2>{t("box.errorTitle", "开盒失败")}</h2>
            <p className="text-danger">{errorMsg}</p>
            <button className="primary" onClick={() => setOpeningState("idle")} style={{ marginTop: "16px" }}>
              {t("box.tryAgain", "重试")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
