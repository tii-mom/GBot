import React from "react";
import { RuntimeState, RuntimeSkill } from "../runtimeTypes";
import { CANONICAL_SKILL_CARDS } from "@growthbot/shared";
import { Card } from "../index";
import { RuntimeTab } from "../petAgentTypes";

interface TrainViewProps {
  state: RuntimeState;
  setTab: (tab: RuntimeTab) => void;
}

export const TrainView: React.FC<TrainViewProps> = ({ state, setTab }) => {
  const { skills } = state;

  // Recommended build streams
  const builds = [
    {
      id: "bounty_hunter",
      name: "🎯 赏金猎人流",
      desc: "偏向自动接单、信息整理与高通过率交付。",
      role: "提升 Telegram 群 / 频道线索整理能力，提高报告通过率"
    },
    {
      id: "research_expert",
      name: "🔬 研究专家流",
      desc: "深度挖掘新项目资料、自动化报告产出。",
      role: "发现更多任务线索，提升任务方验收材料质量"
    },
    {
      id: "content_growth",
      name: "📈 内容增长流",
      desc: "多语言社群推广、社交互动与推流。",
      role: "提升社群数据指标，优化可验证提交材料"
    },
    {
      id: "onchain_scout",
      name: "⚓ 链上侦察流",
      desc: "监控链上交易流向与智能合约风险审查。",
      role: "降低误接高风险任务，提升链上风险识别能力"
    },
    {
      id: "auto_butler",
      name: "🤖 自动化管家流",
      desc: "低能耗长效运行、自动容错重试。",
      role: "降低 AI Credit 消耗，提高异常自动恢复率"
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>
      <div>
        <h1 style={{ fontSize: "20px", fontWeight: "bold" }}>⚔️ 技能训练 (Agent Training)</h1>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
          装备技能卡，训练你的 Agent，使其在特定领域的价值创造中表现更好。
        </p>
      </div>

      {/* Equipped Skill Cards Grid */}
      <Card title="已装备的技能槽 (Equipped Skills)">
        {skills && skills.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {skills.map((s: RuntimeSkill) => {
              const def = CANONICAL_SKILL_CARDS.find(c => c.code === s.skillCode) || {
                name: s.skillName || s.skillCode || "未装备技能",
                category: "其他",
                tier: "Normal"
              };
              return (
                <div 
                  key={s.id} 
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "13px" }}>{def.name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                      域: {def.category} • 级别: {def.tier || "Normal"}
                    </div>
                    {/* Game-like Effects */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                      <span style={{ fontSize: "10px", background: "rgba(16, 185, 129, 0.1)", color: "#10B981", padding: "2px 6px", borderRadius: "4px" }}>
                        🔋 能量开销 -15%
                      </span>
                      <span style={{ fontSize: "10px", background: "rgba(59, 130, 246, 0.1)", color: "#3B82F6", padding: "2px 6px", borderRadius: "4px" }}>
                        🎯 成功率 +10%
                      </span>
                      <span style={{ fontSize: "10px", background: "rgba(245, 158, 11, 0.1)", color: "#F59E0B", padding: "2px 6px", borderRadius: "4px" }}>
                        🛡️ 误接控制
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: "24px" }}>🧩</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "16px", textAlign: "center", color: "var(--text-secondary)", fontSize: "13px" }}>
            🕸️ 暂无装备的技能，请在下方库中选择训练。
          </div>
        )}
      </Card>

      {/* Recommended Builds */}
      <Card title="推荐流派 Build">
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {builds.map(b => (
            <div 
              key={b.id}
              style={{
                padding: "12px",
                borderRadius: "12px",
                backgroundColor: "rgba(124, 58, 237, 0.03)",
                border: "1px solid rgba(124, 58, 237, 0.1)",
                fontSize: "13px"
              }}
            >
              <div style={{ fontWeight: "bold", color: "var(--text-primary)" }}>{b.name}</div>
              <p style={{ color: "var(--text-secondary)", margin: "4px 0 6px 0", fontSize: "12px" }}>{b.desc}</p>
              <div style={{ fontSize: "11px", color: "#10B981", fontWeight: "bold" }}>
                🔑 价值方向: {b.role}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Synthesizer Entry Block */}
      <Card title="缺失核心技能 / 合成升级">
        <div style={{ padding: "8px 0", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "var(--text-primary)" }}>融合核心与技能合成</div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
              消耗低阶卡牌可以融合合成为更高级别的高阶卡。
            </div>
          </div>
          <button 
            disabled 
            style={{ 
              padding: "6px 12px", 
              backgroundColor: "rgba(255, 255, 255, 0.05)", 
              color: "var(--text-secondary)", 
              border: "1px solid rgba(255, 255, 255, 0.1)", 
              borderRadius: "8px",
              fontSize: "11px"
            }}
          >
            敬请期待
          </button>
        </div>
      </Card>
    </div>
  );
};
