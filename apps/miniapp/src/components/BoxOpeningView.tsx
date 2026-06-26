import React, { useEffect, useState } from "react";
import { X, Award, Zap, Sparkles, Share2 } from "lucide-react";
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
  initialBoxId?: string | null;
}

export function BoxOpeningView({ boxes, onOpenBox, onClose, t, initialBoxId }: BoxOpeningViewProps) {
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(
    boxes.some((box) => box.id === initialBoxId) ? (initialBoxId ?? null) : boxes.length > 0 ? (boxes[0]?.id ?? null) : null
  );
  const [openingState, setOpeningState] = useState<"idle" | "opening" | "revealed" | "error">("idle");
  const [rewards, setRewards] = useState<Array<{ type: string; amount?: number; name?: string; rarity?: string; category?: string }>>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const selectedBox = boxes.find((b) => b.id === selectedBoxId);

  useEffect(() => {
    if (openingState !== "idle") return;
    if (initialBoxId && boxes.some((box) => box.id === initialBoxId)) {
      setSelectedBoxId(initialBoxId);
      return;
    }
    if (!selectedBoxId || !boxes.some((box) => box.id === selectedBoxId)) {
      setSelectedBoxId(boxes[0]?.id ?? null);
    }
  }, [boxes, initialBoxId, openingState, selectedBoxId]);

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
        setErrorMsg(t("box.errorTitle", "技能激活失败，请重试。"));
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
    const text = interpolate(t("share.box", "GrowthBot 技能学习战报：掌握了 {rewards}。免费 Agent 和启动技能包正在开放。"), { rewards: rewardsStr });
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
            <h2>{t("box.openBefore", "开启已获得的 Agent 技能包")}</h2>
            <p className="muted font-13">
              {t("box.desc", "这里不是公开销售入口。你只能开启背包中已领取、任务获得或市场买入的技能包。")}
            </p>

            {boxes.length === 0 ? (
              <div className="no-boxes-alert">
                <p>{t("box.noBox", "背包里没有可学习的技能包。可先完成赏金任务，或在市场购买可流通技能包。")}</p>
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
                  {t("box.open", "开启学习")} {translateAssetName(t, selectedBox?.name || "技能包")}
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
            <h3>{t("box.opening", "Agent 正在学习技能包...")}</h3>
            <p className="muted">{t("box.rolled", "正在生成技能卡编号并写入脱敏元数据...")}</p>
          </div>
        )}

        {/* 3. REVEALED RESULTS STATE */}
        {openingState === "revealed" && (
          <div className="modal-content text-center animate-pop-in">
            <Sparkles size={48} className="text-amber" />
            <h2 className="glow-title">{t("box.opened", "已学会")}</h2>
            <p className="muted font-12" style={{ marginBottom: "16px" }}>
              {t("box.received", "你的 Agent 掌握了以下技能：")}
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
                        <span className="reward-lbl">{t("box.points", "Legacy fallback")}</span>
                      </>
                    )}
                    {isEnergy && (
                      <>
                        <Zap size={28} className="text-emerald" />
                        <span className="reward-amt">+{reward.amount}</span>
                        <span className="reward-lbl">{t("box.energy", "行动力")}</span>
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
            <h2>{t("box.errorTitle", "技能激活失败")}</h2>
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
