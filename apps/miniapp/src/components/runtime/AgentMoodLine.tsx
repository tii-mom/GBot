import React from "react";
import { AgentVisualProfile } from "./petAgentTypes";
import { 
  Moon, Coffee, Radio, Compass, Zap, Eye, 
  FileCheck, Coins, PartyPopper, AlertTriangle, 
  BatteryLow, Bed, Bot 
} from "lucide-react";

interface AgentMoodLineProps {
  profile: AgentVisualProfile;
  name: string;
}

export const AgentMoodLine: React.FC<AgentMoodLineProps> = ({ profile, name }) => {
  const getMoodData = (): { icon: React.ReactNode; text: string } => {
    switch (profile.state) {
      case "dormant":
        return {
          icon: <Moon size={16} className="text-muted" />,
          text: `${name} 处于沉睡状态，等待用户将其激活。`
        };
      case "idle":
        return {
          icon: <Coffee size={16} style={{ color: "var(--amber)" }} />,
          text: `${name} 正在巢穴里休息，目前精神抖擞，随时可以出击！`
        };
      case "scanning":
        return {
          icon: <Radio size={16} className="spinning-icon" style={{ color: "var(--blue)" }} />,
          text: `${name} 正在雷达地图上整理新的机会线索...`
        };
      case "exploring":
        return {
          icon: <Compass size={16} style={{ color: "var(--blue)" }} />,
          text: `${name} 正在外出探索。它会优先留意安全边界清晰、可验证的机会线索。`
        };
      case "executing":
        return {
          icon: <Zap size={16} style={{ color: "var(--emerald)" }} />,
          text: `${name} 正在专注执行任务。在 Policy Guard 保护下，它正在按预算使用模型能量。`
        };
      case "waiting_user":
        return {
          icon: <Eye size={16} style={{ color: "var(--amber)" }} />,
          text: `${name} 发现了一个重要动作或高风险决策，正在等待用户确认。`
        };
      case "verifying":
        return {
          icon: <FileCheck size={16} style={{ color: "var(--emerald)" }} />,
          text: `${name} 已经向任务方提交了可验证凭证，正在等待对方系统进行数据链验收...`
        };
      case "settling":
        return {
          icon: <Coins size={16} style={{ color: "var(--emerald)" }} />,
          text: `${name} 正在配合任务方结算，等待验收或结算结果入账。`
        };
      case "completed":
        return {
          icon: <PartyPopper size={16} style={{ color: "var(--emerald)" }} />,
          text: `${name} 已完成上一次探索与任务交付，带回了可验证工作记录。`
        };
      case "failed":
        return {
          icon: <AlertTriangle size={16} style={{ color: "var(--danger)" }} />,
          text: `${name} 执行任务时遇到了挫折。不用担心，这只是暂时的，调整策略后它可以重新出发。`
        };
      case "low_ai_credit":
        return {
          icon: <BatteryLow size={16} style={{ color: "var(--danger)" }} />,
          text: `${name} 模型能量不足。补充预算后，它才能继续执行授权任务。`
        };
      case "resting":
        return {
          icon: <Bed size={16} className="text-muted" />,
          text: `${name} 正在恢复疲劳，暂时不想被打扰。`
        };
      default:
        return {
          icon: <Bot size={16} style={{ color: "var(--purple)" }} />,
          text: `${name} 状态稳定，随时可以根据用户策略执行授权任务。`
        };
    }
  };

  const { icon, text } = getMoodData();

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
        margin: "12px 0",
        display: "flex",
        alignItems: "center",
        gap: "8px"
      }}
    >
      <span style={{ display: "inline-flex", flexShrink: 0 }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
};
