import React from "react";
import { AgentVisualProfile } from "./petAgentTypes";

interface AgentStatusPanelProps {
  profile: AgentVisualProfile;
  level: number;
  profession: string;
  energy: number; // 模型能量
  fatigue: number; // 疲劳度 (0-100)
  trust: number; // 信任度 (0-100)
}

export const AgentStatusPanel: React.FC<AgentStatusPanelProps> = ({
  profile,
  level,
  profession,
  energy,
  fatigue,
  trust
}) => {
  return (
    <div 
      className="agent-status-panel"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
        padding: "16px",
        backgroundColor: "var(--bg-card)",
        borderRadius: "16px",
        border: "1px solid rgba(255, 255, 255, 0.05)"
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>职业倾向 (Class)</span>
        <span style={{ fontSize: "14px", fontWeight: "bold", color: "var(--text-primary)" }}>
          {profession || "初级探索者"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>成长等级 (Level)</span>
        <span style={{ fontSize: "14px", fontWeight: "bold", color: "var(--text-primary)" }}>
          Lv.{level}
        </span>
      </div>

      {/* Model Energy Progress */}
      <div style={{ gridColumn: "span 2", marginTop: "4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
          <span style={{ color: "var(--text-secondary)" }}>模型能量 (AI Credit)</span>
          <span style={{ color: "var(--text-primary)", fontWeight: "bold" }}>{energy}/100</span>
        </div>
        <div style={{ height: "6px", backgroundColor: "rgba(255, 255, 255, 0.05)", borderRadius: "3px", overflow: "hidden" }}>
          <div 
            style={{ 
              height: "100%", 
              width: `${Math.min(100, Math.max(0, energy))}%`, 
              background: "linear-gradient(90deg, #10B981, #34D399)",
              borderRadius: "3px",
              transition: "width 0.3s ease"
            }} 
          />
        </div>
      </div>

      {/* Fatigue Progress */}
      <div style={{ marginTop: "4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
          <span style={{ color: "var(--text-secondary)" }}>疲劳值 (Fatigue)</span>
          <span style={{ color: "var(--text-primary)", fontWeight: "bold" }}>{fatigue}/100</span>
        </div>
        <div style={{ height: "6px", backgroundColor: "rgba(255, 255, 255, 0.05)", borderRadius: "3px", overflow: "hidden" }}>
          <div 
            style={{ 
              height: "100%", 
              width: `${Math.min(100, Math.max(0, fatigue))}%`, 
              background: fatigue > 70 ? "linear-gradient(90deg, #EF4444, #F87171)" : "linear-gradient(90deg, #F59E0B, #FBBF24)",
              borderRadius: "3px",
              transition: "width 0.3s ease"
            }} 
          />
        </div>
      </div>

      {/* Trust Progress */}
      <div style={{ marginTop: "4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
          <span style={{ color: "var(--text-secondary)" }}>信任度 (Trust)</span>
          <span style={{ color: "var(--text-primary)", fontWeight: "bold" }}>{trust}/100</span>
        </div>
        <div style={{ height: "6px", backgroundColor: "rgba(255, 255, 255, 0.05)", borderRadius: "3px", overflow: "hidden" }}>
          <div 
            style={{ 
              height: "100%", 
              width: `${Math.min(100, Math.max(0, trust))}%`, 
              background: "linear-gradient(90deg, #3B82F6, #60A5FA)",
              borderRadius: "3px",
              transition: "width 0.3s ease"
            }} 
          />
        </div>
      </div>
    </div>
  );
};
