import React from "react";
import type { Task } from "@growthbot/shared";

export interface TaskOpportunityCardProps {
  task: Task;
  onGeneratePlan: () => void;
}

export function TaskOpportunityCard({
  task,
  onGeneratePlan
}: TaskOpportunityCardProps) {
  // Derive details from Task properties
  const energy = task.energyCost || 10;
  const isWallet = !!task.requiresWallet;
  const requiredAbility = task.requiredAbility || "None (Generalist)";
  
  // Mapping risk level
  let riskClass = "low";
  let riskLabel = "Low Risk";
  if (energy >= 40 || isWallet) {
    riskClass = "high";
    riskLabel = "High Risk Policy Audit Required";
  } else if (energy >= 20) {
    riskClass = "medium";
    riskLabel = "Medium Risk Review";
  }

  // Derive expected output
  let expectedOutput = "Verified data submission / contribution proof";
  if (task.taskType === "project_research" || task.taskType === "task_planning") {
    expectedOutput = "Detailed research report & synthesis brief";
  } else if (task.taskType === "structured_content") {
    expectedOutput = "Structured content layout with source references";
  }

  return (
    <div className="task-opp-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
        <div>
          <div className="task-opp-title">{task.name}</div>
          <div className="task-opp-meta-row">
            <span className="task-opp-pill">{task.taskType || "General Job"}</span>
            {isWallet && <span className="task-opp-pill requires-wallet">Requires Wallet Scope</span>}
            <span className={`ai-risk-tag ${riskClass}`}>{riskLabel}</span>
          </div>
        </div>
      </div>

      <div className="task-opp-details-grid">
        <div className="task-opp-detail-item">
          <span>Required Ability</span>
          <strong>{requiredAbility}</strong>
        </div>
        <div className="task-opp-detail-item">
          <span>AI Credits Required</span>
          <strong>{energy} capacity</strong>
        </div>
        <div className="task-opp-detail-item">
          <span>Expected Output</span>
          <strong>{expectedOutput}</strong>
        </div>
        <div className="task-opp-detail-item">
          <span>Settlement Hint</span>
          <strong>Proof-of-Work Contribution</strong>
        </div>
      </div>

      <button className="gb-cta-button" onClick={onGeneratePlan}>
        <span>Generate Execution Plan</span>
        <small>Agent will draft proposal for approval before any action</small>
      </button>
    </div>
  );
}
