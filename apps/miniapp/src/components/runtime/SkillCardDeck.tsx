import React from "react";

export interface SkillCardDeckProps {
  totalCanonical?: number;
  normalCount?: number;
  advancedCount?: number;
  expertCount?: number;
  equippedNames?: string[];
}

export function SkillCardDeck({
  totalCanonical = 31,
  normalCount = 12,
  advancedCount = 12,
  expertCount = 7,
  equippedNames = []
}: SkillCardDeckProps) {
  return (
    <div className="gb-glass-card">
      <div className="gb-glass-card-header">
        <h3>
          <svg style={{ width: "16px", height: "16px", fill: "var(--gb-cyan-cyber)" }} viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          Skill Card Deck
        </h3>
        <span style={{ fontSize: "11px", color: "var(--gb-cyan-cyber)", fontWeight: 700 }}>
          {equippedNames.length} Equipped
        </span>
      </div>

      <div className="skill-deck-grid">
        <div className="skill-deck-card-mini normal">
          <span className="count">{normalCount}</span>
          <span className="type">Normal</span>
        </div>
        <div className="skill-deck-card-mini advanced">
          <span className="count">{advancedCount}</span>
          <span className="type">Advanced</span>
        </div>
        <div className="skill-deck-card-mini expert">
          <span className="count">{expertCount}</span>
          <span className="type">Expert</span>
        </div>
      </div>

      {equippedNames.length > 0 ? (
        <div style={{ marginTop: "12px" }}>
          <span style={{ fontSize: "10px", color: "var(--gb-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Active Operational Capabilities
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
            {equippedNames.map((name, i) => (
              <span
                key={i}
                style={{
                  fontSize: "10px",
                  background: "rgba(6, 182, 212, 0.08)",
                  border: "1px solid rgba(6, 182, 212, 0.2)",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  color: "var(--gb-cyan-cyber)"
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: "10px", color: "var(--gb-text-faint)", marginTop: "10px", textAlign: "center" }}>
          Equip skill cards from the Agent Center to unlock advanced tasks.
        </div>
      )}
    </div>
  );
}
