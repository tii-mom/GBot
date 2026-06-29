import React from "react";
import { AgentVisualProfile } from "./petAgentTypes";

interface AgentMoodLineProps {
  profile: AgentVisualProfile;
  name: string;
}

export const AgentMoodLine: React.FC<AgentMoodLineProps> = ({ profile, name }) => {
  const getMoodText = () => {
    switch (profile.state) {
      case "dormant":
        return `💤 ${name} 处于沉睡状态，等待主人将其唤醒。`;
      case "idle":
        return `🍵 ${name} 正在巢穴里休息，目前精神抖擞，随时可以出击！`;
      case "scanning":
        return `📡 ${name} 正在瞪大眼睛，在雷达地图上仔细嗅探新的机会线索...`;
      case "exploring":
        return `🔭 ${name} 正在外出探索。它背起行囊，时刻留意周围的安全和收益机会。`;
      case "executing":
        return `⚡ ${name} 正在专注执行任务。在 Policy Guard 保护下，它正在安全使用 AI Credits。`;
      case "waiting_user":
        return `👀 ${name} 发现了一个重要的动作或高风险决策，正乖巧地坐着，等待主人确认。`;
      case "verifying":
        return `🔬 ${name} 已经向任务方提交了可验证凭证，正在等待对方系统进行数据链验收...`;
      case "settling":
        return `🪙 任务方验收通过！${name} 正在配合结算奖励，耐心等待资金入库。`;
      case "completed":
        return `🎉 ${name} 成功完成了上一次探索和任务交付，开心度 100%！`;
      case "failed":
        return `⚠️ ${name} 执行任务时遇到了挫折。不用担心，这只是暂时的，调整策略后它可以重新出发。`;
      case "low_ai_credit":
        return `🔋 ${name} 能量值不足啦。需要补充模型能量，好让它打起精神继续帮主人打工。`;
      case "resting":
        return `🛌 ${name} 正在恢复疲劳，暂时不想被打扰。`;
      default:
        return `🤖 ${name} 状态稳定，随时准备服从主人的策略安排。`;
    }
  };

  return (
    <div 
      className="agent-mood-line"
      style={{
        padding: "10px 14px",
        borderRadius: "12px",
        backgroundColor: "rgba(124, 58, 237, 0.08)",
        border: "1px dashed rgba(124, 58, 237, 0.2)",
        fontSize: "13px",
        color: "var(--text-primary)",
        lineHeight: "1.5",
        margin: "12px 0"
      }}
    >
      {getMoodText()}
    </div>
  );
};
