import React, { useEffect, useState } from "react";
import { CANONICAL_SKILL_CARDS, CanonicalSkillCard, CanonicalSkillTier, type BubbleAgentOpsConfig, type BubbleBoxOpenReward } from "@growthbot/shared";
import { Battery, Box, Crown, Gem, LockKeyhole, Plus, ShieldCheck, ShoppingCart, Sparkles, Star, Sword, Ticket, Zap } from "lucide-react";
import { apiClient } from "../../../apiClient";
import { AgentAvatarStage } from "../AgentAvatarStage";
import { deriveAgentVisualProfile } from "../petAgentAdapters";
import {
  BUBBLE_AGENT_OPS_CONFIG,
  BubbleEdition,
  createBubblePreviewIdentity,
  getBlindBoxPreviewItems,
  getBlindBoxTotalWeight
} from "../bubbleAgentCatalog";
import { RuntimeState } from "../runtimeTypes";
import { RuntimeTab } from "../petAgentTypes";
import { CollapsibleCard } from "../index";

interface TrainViewProps {
  state: RuntimeState;
  setTab: (tab: RuntimeTab) => void;
  onInventoryChanged?: () => Promise<void>;
}

const tierMeta: Record<
  CanonicalSkillTier,
  {
    label: string;
    title: string;
    price: string;
    promise: string;
    className: string;
    icon: React.ElementType;
  }
> = {
  normal: {
    label: "普通",
    title: "打工基础卡",
    price: "80 G",
    promise: "让 Agent 稳定完成基础任务，适合起步铺能力。",
    className: "normal",
    icon: Star
  },
  advanced: {
    label: "进阶",
    title: "任务效率卡",
    price: "260 G",
    promise: "提高机会筛选和任务质量，让 Agent 更适合连续执行。",
    className: "advanced",
    icon: Gem
  },
  expert: {
    label: "专家",
    title: "高阶策略卡",
    price: "680 G",
    promise: "解锁深度研究、风控和复合任务，适合复投成长。",
    className: "expert",
    icon: Crown
  }
};

const categoryLabel: Record<string, string> = {
  research: "研究",
  content: "内容",
  verification: "验收",
  onchain: "链上",
  social_growth: "增长",
  automation: "自动化",
  business_collaboration: "商业"
};

function getOwnedSkillCodes(state: RuntimeState) {
  return new Set(state.skills.map((skill) => skill.skillCode).filter(Boolean));
}

function getCardSamples(tier: CanonicalSkillTier) {
  return CANONICAL_SKILL_CARDS.filter((card) => card.tier === tier);
}

function SkillShowcaseCard({ card, owned }: { card: CanonicalSkillCard; owned: boolean }) {
  const meta = tierMeta[card.tier];
  const Icon = meta.icon;

  return (
    <article className={`gbot-skill-card gbot-skill-card--${meta.className}`}>
      <div className="gbot-skill-card__shine" />
      <div className="gbot-skill-card__top">
        <span>{meta.label}</span>
        <Icon size={18} />
      </div>
      <div className="gbot-skill-card__sigil">
        <Sparkles size={28} />
      </div>
      <h3>{card.name}</h3>
      <p>{card.shortDescription}</p>
      <div className="gbot-skill-card__tags">
        <span>{categoryLabel[card.category] || card.category}</span>
        <span>{owned ? "已拥有" : meta.price}</span>
      </div>
    </article>
  );
}

function BubbleEditionCard({ edition, onOpenVault }: { edition: BubbleEdition; onOpenVault: () => void }) {
  const previewProfile = deriveAgentVisualProfile(null, null, null, []);
  const identity = createBubblePreviewIdentity(edition);
  const naturalSkillLabel = edition.naturalSkills.length
    ? edition.naturalSkills.map((skill) => skill.name).join(" / ")
    : "无天生技能";

  return (
    <article className={`gbot-bubble-edition-card gbot-bubble-edition-card--${edition.className}`}>
      <div className="gbot-bubble-edition-card__stage">
        <AgentAvatarStage profile={previewProfile} identity={identity} />
      </div>
      <div className="gbot-bubble-edition-card__body">
        <div className="gbot-bubble-edition-card__title">
          <span>{edition.rarity}</span>
          <strong>{edition.name}</strong>
        </div>
        <p>{edition.note}</p>
        <div className="gbot-bubble-edition-card__meta">
          <span>{naturalSkillLabel}</span>
          <span>{edition.source}</span>
          <span>{edition.frameLabel}</span>
        </div>
        <button type="button" onClick={onOpenVault}>
          <Ticket size={15} />
          背包查看
        </button>
      </div>
    </article>
  );
}

export const TrainView: React.FC<TrainViewProps> = ({ state, setTab, onInventoryChanged }) => {
  const [bubbleConfig, setBubbleConfig] = useState(BUBBLE_AGENT_OPS_CONFIG);
  const [boxOpening, setBoxOpening] = useState(false);
  const [boxOpenError, setBoxOpenError] = useState("");
  const [boxOpenRewards, setBoxOpenRewards] = useState<BubbleBoxOpenReward[]>([]);
  const [selectedTier, setSelectedTier] = useState<CanonicalSkillTier>("normal");

  const ownedSkillCodes = getOwnedSkillCodes(state);
  const equippedCount = state.skills.length;
  const gBalance = state.assetBalances.find((balance) => balance.asset === "G")?.available.amount || "0";
  const slotTotal = Math.max(state.skillSlots?.total || 4, 4);
  const slotCells = Array.from({ length: slotTotal }, (_, index) => state.skills[index] || null);
  const blindBoxPreviewItems = getBlindBoxPreviewItems(bubbleConfig);
  const blindBoxTotalWeight = getBlindBoxTotalWeight(bubbleConfig.blindBoxPool);
  const canOpenSkillBox = Boolean(state.agent);

  useEffect(() => {
    let cancelled = false;
    apiClient.getBubbleAgentConfig()
      .then((config: BubbleAgentOpsConfig) => {
        if (!cancelled) setBubbleConfig(config);
      })
      .catch(() => {
        if (!cancelled) setBubbleConfig(BUBBLE_AGENT_OPS_CONFIG);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openSkillBox = async () => {
    if (boxOpening) return;
    if (!canOpenSkillBox) {
      setTab("Agent");
      return;
    }
    setBoxOpening(true);
    setBoxOpenError("");
    setBoxOpenRewards([]);
    try {
      const orderRes = await apiClient.purchaseBox("skill_box", 1, `skill_box_${Date.now()}`);
      const inventoryItemId = orderRes.order?.fulfilledInventoryItemId;
      if (!inventoryItemId) {
        throw new Error("盲盒订单未返回背包道具。");
      }
      const openRes = await apiClient.openBox(inventoryItemId);
      setBoxOpenRewards(openRes.rewards || []);
      const bubbleReward = openRes.rewards?.find((reward: BubbleBoxOpenReward) => reward.type === "bubble_agent");
      if (bubbleReward?.itemId && typeof window !== "undefined") {
        localStorage.setItem("gb_selected_bubble_item_id", bubbleReward.itemId);
        window.dispatchEvent(new CustomEvent("gb_selected_bubble_changed", {
          detail: { itemId: bubbleReward.itemId, displayNo: bubbleReward.displayNo || null }
        }));
      }
      if (onInventoryChanged) {
        await onInventoryChanged();
      }
      void apiClient.trackEvent("skill_box_opened", "skill_box", {
        rewardCount: openRes.rewards?.length || 0,
        hasBubble: openRes.rewards?.some((reward: BubbleBoxOpenReward) => reward.type === "bubble_agent") || false
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "开盒失败，请稍后再试。";
      setBoxOpenError(message);
    } finally {
      setBoxOpening(false);
    }
  };

  const tierSamples = getCardSamples(selectedTier);

  return (
    <main className="gbot-mini-page gbot-train-page">
      {/* 1. Compact HUD Header */}
      <header className="gbot-mini-header">
        <div className="gbot-mini-header__left">
          <div className="gbot-mini-header__icon">
            <Box size={18} />
          </div>
          <div className="gbot-mini-header__titles">
            <h1>技能工坊</h1>
            <span>SKILL WORKSHOP</span>
          </div>
        </div>
        <div className="gbot-mini-header__right">
          <button type="button" className="gbot-mini-pill gbot-mini-pill--active" onClick={() => setTab("Nest")}>
            <Zap size={14} />
            {gBalance} G
          </button>
        </div>
      </header>

      {/* 2. Compact Resource Stat Strip */}
      <div className="gbot-mini-stat-strip" style={{ marginBottom: "0", padding: "4px 8px" }}>
        <div className="gbot-mini-stat-item">
          <div className="gbot-mini-stat-item__top">
            <span>已装配技能</span>
          </div>
          <strong>{equippedCount}/{slotTotal}</strong>
          <i><b style={{ width: `${(equippedCount / slotTotal) * 100}%` }} /></i>
        </div>
        <div className="gbot-mini-stat-item">
          <div className="gbot-mini-stat-item__top">
            <span>可用余额</span>
          </div>
          <strong>{gBalance} G</strong>
          <i><b style={{ width: "60%" }} /></i>
        </div>
        <div className="gbot-mini-stat-item">
          <div className="gbot-mini-stat-item__top">
            <span>技能槽</span>
          </div>
          <strong>{slotTotal} 槽位</strong>
          <i><b style={{ width: "100%" }} /></i>
        </div>
      </div>

      {/* 3. Blind Box & Equip Hero Panel */}
      <section className="gbot-mini-panel gbot-blindbox-panel">
        <div className="gbot-mini-panel__title">
          <div>
            <span>盲盒主卡</span>
            <h2>技能盲盒 · 抽技能与特别泡泡</h2>
          </div>
          <Sparkles size={18} className="text-amber" />
        </div>

        <div className="gbot-blindbox-hero" style={{ padding: "6px 8px", margin: 0 }}>
          <div className="gbot-blindbox-capsule">
            <Sparkles size={20} />
            <strong>Skill Box</strong>
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: "12px", display: "block" }}>开盒即得技能卡或特别版泡泡</strong>
            <p style={{ fontSize: "10px", margin: "1px 0 4px 0" }}>300 G 试开一次 · 保留 4 个装配技能槽</p>
            <button
              type="button"
              className="gbot-mini-primary-btn"
              onClick={openSkillBox}
              disabled={boxOpening}
            >
              <Sparkles size={16} />
              {boxOpening ? "开启中..." : canOpenSkillBox ? "开一个技能盲盒" : "先领养 Agent"}
            </button>
          </div>
        </div>

        {/* Box Opening Result Modal/Panel */}
        {(boxOpenRewards.length > 0 || boxOpenError) && (
          <div className={`gbot-blindbox-result${boxOpenRewards.some((reward) => reward.type === "bubble_agent") ? " has-bubble" : ""}`}>
            <div>
              <span>开盒结果</span>
              <strong>{boxOpenError ? "本次未完成" : "已放入背包"}</strong>
            </div>
            {boxOpenError ? (
              <p>{boxOpenError}</p>
            ) : (
              <div className="gbot-blindbox-result-list">
                {boxOpenRewards.map((reward, index) => (
                  <article className={`is-${reward.rarity || "common"}${reward.type === "bubble_agent" ? " is-bubble-agent" : ""}`} key={`${reward.itemId || reward.name}-${index}`}>
                    <span>{reward.rarity || reward.type}</span>
                    <strong>{reward.name}</strong>
                    <small>
                      {reward.type === "bubble_agent"
                        ? `${reward.displayNo || "新编号"} · 天生标签 ${reward.naturalSkillCodes?.length || 0}`
                        : reward.amount
                          ? `数量 +${reward.amount}`
                          : "可在背包查看"}
                    </small>
                  </article>
                ))}
              </div>
            )}
            <button type="button" className="gbot-mini-btn" onClick={() => setTab("Nest")}>
              <ShoppingCart size={16} />
              查看背包
            </button>
          </div>
        )}
      </section>

      {/* 4. Current Equipped Slots */}
      <section className="gbot-mini-panel">
        <div className="gbot-mini-panel__title">
          <div>
            <span>装备槽</span>
            <h2>{equippedCount ? `${equippedCount}/${slotTotal} 个已装配` : "当前装备槽"}</h2>
          </div>
          <ShieldCheck size={18} />
        </div>

        <div className="gbot-equipment-grid" style={{ gap: "6px" }}>
          {slotCells.map((skill, index) => {
            if (!skill) {
              const locked = index >= (state.skillSlots?.total || 4);
              return (
                <button
                  className={`gbot-equip-slot${locked ? " is-locked" : " is-empty"}`}
                  key={`empty-${index}`}
                  type="button"
                  onClick={() => !locked && setTab("Train")}
                  disabled={locked}
                  style={{ minHeight: "52px" }}
                >
                  {locked ? <LockKeyhole size={16} /> : <Plus size={16} />}
                  <strong>{locked ? "锁定槽" : "空槽"}</strong>
                </button>
              );
            }

            const def = CANONICAL_SKILL_CARDS.find((card) => card.code === skill.skillCode);
            const tier = def?.tier || "normal";
            const meta = tierMeta[tier];
            return (
              <article className={`gbot-equip-slot gbot-equip-slot--${meta.className} is-equipped`} key={skill.id} style={{ minHeight: "52px", padding: "6px 10px" }}>
                <div className="gbot-equip-slot__orb">
                  <meta.icon size={16} />
                </div>
                <div>
                  <strong>{def?.name || skill.skillName || skill.skillCode}</strong>
                  <span>{meta.label} · {categoryLabel[def?.category || ""] || "通用"}</span>
                </div>
              </article>
            );
          })}
        </div>

        {/* Empty state for skill slots */}
        {state.skills.length === 0 && (
          <div className="gbot-mini-empty">
            <LockKeyhole size={20} />
            <strong>未装备技能</strong>
            <p>购买第一张普通卡让 Agent 获得基础任务处理能力。</p>
          </div>
        )}
      </section>

      {/* 5. Collapsible Detail Section (Skill Card Store, Probability Pool & Codex) */}
      <CollapsibleCard
        title="技能卡选购 & 盲盒概率池"
        summary={`31 张技能卡 · ${blindBoxPreviewItems.length} 款盲盒奖品 · ${bubbleConfig.editions.length} 款泡泡图鉴`}
        className="gbot-drawer-card"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Three-Tier Skill Cards Segmented Selector */}
          <div className="gbot-mini-panel" style={{ background: "rgba(10, 12, 20, 0.6)", padding: "8px" }}>
            <div className="gbot-mini-panel__title" style={{ marginBottom: "6px" }}>
              <div>
                <span>技能卡分类</span>
                <h2 style={{ fontSize: "13px" }}>三档技能卡选购</h2>
              </div>
              <ShoppingCart size={16} />
            </div>

            <div className="gbot-mini-segmented">
              {(Object.keys(tierMeta) as CanonicalSkillTier[]).map((tier) => {
                const meta = tierMeta[tier];
                const Icon = meta.icon;
                const active = selectedTier === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    className={active ? "is-active" : ""}
                    onClick={() => setSelectedTier(tier)}
                  >
                    <Icon size={14} />
                    {meta.label} ({meta.price})
                  </button>
                );
              })}
            </div>

            <div className="gbot-mini-carousel" style={{ marginTop: "8px" }}>
              {tierSamples.map((card) => (
                <div style={{ width: "220px" }} key={card.code}>
                  <SkillShowcaseCard card={card} owned={ownedSkillCodes.has(card.code)} />
                </div>
              ))}
            </div>
          </div>
          {/* Ops Strip */}
          <div className="gbot-blindbox-ops-strip">
            <div>
              <span>启用条目</span>
              <strong>{blindBoxPreviewItems.filter((item) => item.enabled).length}</strong>
            </div>
            <div>
              <span>总权重</span>
              <strong>{blindBoxTotalWeight}</strong>
            </div>
            <div>
              <span>特别泡泡</span>
              <strong>{blindBoxPreviewItems.filter((item) => item.itemType === "bubble_agent").length} 款</strong>
            </div>
          </div>

          {/* Prize Grid */}
          <div className="gbot-blindbox-prize-grid">
            {blindBoxPreviewItems.map((item) => (
              <article key={item.label}>
                <span>{item.rarity} · {item.chanceLabel}</span>
                <strong>{item.label}</strong>
                <small>{item.desc}</small>
              </article>
            ))}
          </div>

          {/* Bubble Edition Codex */}
          <div className="gbot-bubble-edition-grid">
            {bubbleConfig.editions.map((edition) => (
              <BubbleEditionCard edition={edition} onOpenVault={() => setTab("Nest")} key={edition.key} />
            ))}
          </div>

          {/* All Skill Cards Showcase */}
          <div className="gbot-skill-shop">
            {(Object.keys(tierMeta) as CanonicalSkillTier[]).map((tier) => (
              <div className="gbot-skill-tier-lane" key={tier}>
                <div className="gbot-lane-title">
                  <strong>{tierMeta[tier].label}技能</strong>
                  <span>{tierMeta[tier].price} 起</span>
                </div>
                <div className="gbot-skill-card-row">
                  {getCardSamples(tier).map((card) => (
                    <SkillShowcaseCard card={card} owned={ownedSkillCodes.has(card.code)} key={card.code} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="gbot-compliance-note">正式概率、库存和启停由后台配置；前端仅展示机制说明。</p>
        </div>
      </CollapsibleCard>
    </main>
  );
};
