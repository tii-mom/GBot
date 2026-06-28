import React from "react";
import { telegramAdapter } from "../../telegramAdapter";

export interface AgentHeroCardProps {
  agentExists: boolean;
  agentName?: string;
  agentLevel?: number;
  agentStatus?: string;
  activeRunStatus?: string;
  onCtaClick: () => void;
  ctaText: string;
  ctaHint: string;
}

export function AgentHeroCard({
  agentExists,
  agentName = "Growth Scouter Agent",
  agentLevel = 1,
  agentStatus = "idle",
  activeRunStatus,
  onCtaClick,
  ctaText,
  ctaHint
}: AgentHeroCardProps) {
  const currentStatus = activeRunStatus || agentStatus;
  
  // Decide visual status styling
  let statusClass = "ready";
  let statusText = "Ready";
  
  if (!agentExists) {
    statusClass = "offline";
    statusText = "Not Activated";
  } else if (["executing", "submitting", "verifying", "queued", "analyzing", "planning", "qualified"].includes(currentStatus)) {
    statusClass = "working";
    statusText = "Working";
  } else if (currentStatus === "waiting_user") {
    statusClass = "waiting";
    statusText = "User Confirm Required";
  } else if (currentStatus === "completed") {
    statusClass = "working";
    statusText = "Completed Task";
  } else if (currentStatus === "failed") {
    statusClass = "offline";
    statusText = "Error State";
  }

  return (
    <div className="gb-glass-card agent-hero-card">
      <div className="holo-container">
        <div className="holo-core-outer">
          <div className="holo-core-mid">
            <div className={`holo-core-inner ${statusClass}`} />
          </div>
        </div>
        
        <div className="agent-title-text">{agentExists ? agentName : "No Active Agent"}</div>
        
        {agentExists && (
          <div style={{ fontSize: "12px", color: "var(--gb-text-soft)", marginTop: "4px" }}>
            Level {agentLevel} Capability Core
          </div>
        )}

        <div className={`agent-status-tag ${statusClass}`}>
          {statusText}
        </div>
      </div>

      <div style={{ marginTop: "16px" }}>
        <button
          className="gb-cta-button"
          onClick={() => {
            telegramAdapter.hapticImpact("medium");
            onCtaClick();
          }}
        >
          <span>{ctaText}</span>
          <small>{ctaHint}</small>
        </button>
      </div>
    </div>
  );
}
