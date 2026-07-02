import React from "react";
import { Crown, Gem, LockKeyhole, Plus, Sparkles, Star } from "lucide-react";

export interface SkillCardDeckProps {
  totalCanonical?: number;
  normalCount?: number;
  advancedCount?: number;
  expertCount?: number;
  equippedNames?: string[];
  compact?: boolean;
  onOpenStore?: () => void;
}

const deckCards = [
  { key: "normal", label: "普通", title: "基础打工", icon: Star },
  { key: "advanced", label: "进阶", title: "效率赚钱", icon: Gem },
  { key: "expert", label: "专家", title: "策略复投", icon: Crown }
] as const;

export function SkillCardDeck({
  totalCanonical = 31,
  normalCount = 12,
  advancedCount = 12,
  expertCount = 7,
  equippedNames = [],
  compact = false,
  onOpenStore
}: SkillCardDeckProps) {
  const counts = { normal: normalCount, advanced: advancedCount, expert: expertCount };
  const slots = Array.from({ length: 4 }, (_, index) => ({
    name: equippedNames[index] || "",
    locked: !equippedNames[index] && index === 3
  }));

  if (compact) {
    return (
      <section className="game-skill-slots">
        <div className="game-panel-title">
          <span>已装配技能</span>
          <strong>{equippedNames.length}/4</strong>
        </div>
        <div className="game-skill-slot-row">
          {slots.map((slot, index) => (
            <button
              type="button"
              className={`game-skill-slot${slot.name ? " is-equipped" : slot.locked ? " is-locked" : " is-empty"}`}
              key={`${slot.name || "empty"}-${index}`}
              onClick={slot.locked ? undefined : onOpenStore}
              disabled={slot.locked}
            >
              {slot.name ? <Sparkles size={18} /> : slot.locked ? <LockKeyhole size={18} /> : <Plus size={18} />}
              <span>{slot.name || (slot.locked ? "待解锁" : "空槽")}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="gbot-skill-deck">
      <div className="gbot-section-title">
        <div>
          <span>技能卡图鉴</span>
          <h2>{totalCanonical} 张能力卡</h2>
        </div>
        <Sparkles size={20} />
      </div>

      <div className="skill-deck-grid">
        {deckCards.map((card) => {
          const Icon = card.icon;
          return (
            <article className={`skill-deck-card-mini ${card.key}`} key={card.key}>
              <Icon size={20} />
              <span className="count">{counts[card.key]}</span>
              <span className="type">{card.label}</span>
              <small>{card.title}</small>
            </article>
          );
        })}
      </div>

      {equippedNames.length > 0 ? (
        <div className="gbot-equipped-chips">
          {equippedNames.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      ) : (
        <p className="gbot-deck-empty">还没有装备技能卡，先去技能商店买一张普通卡开工。</p>
      )}
    </section>
  );
}
