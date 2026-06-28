import React from "react";
import { AgentVisualProfile } from "./petAgentTypes";

interface AgentAvatarStageProps {
  profile: AgentVisualProfile;
  className?: string;
}

export const AgentAvatarStage: React.FC<AgentAvatarStageProps> = ({ profile, className = "" }) => {
  // Get corresponding emojis for testing/mock representation
  const getEmojiRepresentation = () => {
    switch (profile.zodiac) {
      case "aries": return "🐏";
      case "taurus": return "🐂";
      case "gemini": return "♊";
      case "cancer": return "🦀";
      case "leo": return "🦁";
      case "virgo": return "♍";
      case "libra": return "⚖️";
      case "scorpio": return "🦂";
      case "sagittarius": return "🏹";
      case "capricorn": return "🐐";
      case "aquarius": return "🏺";
      case "pisces": return "🐟";
      default: return "🤖";
    }
  };

  const getMoodEmoji = () => {
    switch (profile.mood) {
      case "happy": return "✨😊";
      case "focused": return "👁️‍🗨️👁️";
      case "tired": return "💧🔋";
      case "excited": return "🔥🤩";
      case "waiting": return "💬⏳";
      case "sleepy": return "💤😴";
      case "failed": return "⚠️😭";
      default: return "🙂";
    }
  };

  const getStateAuraEmoji = () => {
    switch (profile.state) {
      case "executing": return "🌀";
      case "scanning":
      case "exploring": return "📡";
      case "low_ai_credit": return "⚡";
      default: return "";
    }
  };

  return (
    <div 
      className={`agent-avatar-stage ${className}`} 
      data-state={profile.state} 
      data-zodiac={profile.zodiac}
      style={{
        position: "relative",
        width: "100%",
        height: "220px",
        borderRadius: "20px",
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(124, 58, 237, 0.1) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.05)",
        boxShadow: "inset 0 0 20px rgba(124, 58, 237, 0.05)"
      }}
    >
      {/* 1. Aura Layer */}
      <div 
        className="agent-layer agent-layer--aura"
        style={{
          position: "absolute",
          fontSize: "120px",
          opacity: 0.15,
          zIndex: 1,
          animation: "pulse 3s infinite ease-in-out"
        }}
      >
        {getStateAuraEmoji()}
      </div>

      {/* 2. Base Body Layer */}
      <div 
        className="agent-layer agent-layer--base"
        style={{
          position: "absolute",
          fontSize: "80px",
          zIndex: 2,
          animation: "float 4s infinite ease-in-out"
        }}
      >
        🦊
      </div>

      {/* 3. Zodiac Outfit Layer */}
      <div 
        className="agent-layer agent-layer--outfit"
        style={{
          position: "absolute",
          fontSize: "50px",
          transform: "translate(40px, 40px)",
          zIndex: 3
        }}
      >
        {getEmojiRepresentation()}
      </div>

      {/* 4. Expression Layer */}
      <div 
        className="agent-layer agent-layer--expression"
        style={{
          position: "absolute",
          fontSize: "24px",
          transform: "translate(0px, -20px)",
          zIndex: 4
        }}
      >
        {getMoodEmoji()}
      </div>

      {/* 5. Accessory Layer */}
      <div 
        className="agent-layer agent-layer--accessory"
        style={{
          position: "absolute",
          fontSize: "30px",
          transform: "translate(-45px, 30px)",
          zIndex: 5
        }}
      >
        {profile.accessoryIds.includes("accessory_radar") ? "🎒" : ""}
      </div>

      {/* Stage Bottom Board */}
      <div 
        style={{
          position: "absolute",
          bottom: "12px",
          fontSize: "12px",
          color: "var(--text-secondary)",
          background: "rgba(0, 0, 0, 0.4)",
          padding: "4px 12px",
          borderRadius: "12px",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          zIndex: 6
        }}
      >
        {profile.zodiac.toUpperCase()} • {profile.state.replace("_", " ").toUpperCase()}
      </div>
    </div>
  );
};
