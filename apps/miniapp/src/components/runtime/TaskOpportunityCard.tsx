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
  const requiredAbility = task.requiredAbility || "通用能力";
  
  // Mapping risk level
  let riskClass = "low";
  let riskLabel = "低风险";
  if (energy >= 40 || isWallet) {
    riskClass = "high";
    riskLabel = "高风险，需要策略审核";
  } else if (energy >= 20) {
    riskClass = "medium";
    riskLabel = "中风险，需要复核";
  }

  // Derive expected output
  let expectedOutput = "已验证的数据提交或贡献证明";
  if (task.taskType === "project_research" || task.taskType === "task_planning") {
    expectedOutput = "详细研究报告与综合摘要";
  } else if (task.taskType === "structured_content") {
    expectedOutput = "带来源引用的结构化内容";
  }

  return (
    <div className="task-opp-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
        <div>
          <div className="task-opp-title">{task.name}</div>
          <div className="task-opp-meta-row">
            <span className="task-opp-pill">{task.taskType || "通用任务"}</span>
            {isWallet && <span className="task-opp-pill requires-wallet">需要钱包授权范围</span>}
            <span className={`ai-risk-tag ${riskClass}`}>{riskLabel}</span>
          </div>
        </div>
      </div>

      <div className="task-opp-details-grid">
        <div className="task-opp-detail-item">
          <span>所需能力</span>
          <strong>{requiredAbility}</strong>
        </div>
        <div className="task-opp-detail-item">
          <span>所需模型能量</span>
          <strong>{energy} 点</strong>
        </div>
        <div className="task-opp-detail-item">
          <span>预期产出</span>
          <strong>{expectedOutput}</strong>
        </div>
        <div className="task-opp-detail-item">
          <span>结算说明</span>
          <strong>基于工作证明的贡献结算</strong>
        </div>
      </div>

      <button className="gb-cta-button" onClick={onGeneratePlan}>
        <span>生成执行计划</span>
        <small>Agent 会先生成计划，确认后才开始执行</small>
      </button>
    </div>
  );
}
