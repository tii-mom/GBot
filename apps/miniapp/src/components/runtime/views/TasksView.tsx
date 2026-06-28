// Legacy runtime dashboard view. Not part of Pet Agent V1 primary navigation.
import React, { useState } from "react";
import type { Task } from "@growthbot/shared";
import type { RuntimeState, ResearchBriefInput } from "../runtimeTypes";
import { TaskOpportunityCard } from "../TaskOpportunityCard";
import { isResearchTask } from "../runtimeUtils";

export function TasksView({
  state,
  createResearchRun,
  loadRuntime
}: {
  state: RuntimeState;
  createResearchRun: (taskId: string, input: ResearchBriefInput) => void;
  loadRuntime: () => Promise<void>;
}) {
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState(state.tasks[0]?.id || "");
  const [submitting, setSubmitting] = useState(false);

  const researchTasks = state.tasks.filter(isResearchTask);
  const selectableTasks = researchTasks.length ? researchTasks : state.tasks;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId || !topic.trim()) return;
    setSubmitting(true);
    try {
      await createResearchRun(selectedTaskId, {
        topic: topic.trim(),
        context: context.trim()
      });
      setTopic("");
      setContext("");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTaskGeneratePlan = (task: Task) => {
    // Populate the form task select and focus or directly run with defaults
    setSelectedTaskId(task.id);
    setTopic(`Execution Intent: ${task.name}`);
    setContext(`Targeting tasks required skills. Energy cost budget: ${task.energyCost}.`);
    // Scroll form into view
    const formElement = document.getElementById("research-brief-form");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="runtime-stack animate-fade-in" style={{ paddingBottom: "24px" }}>
      <div style={{ padding: "0 16px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "16px 0 4px" }}>Agent Job Market</h2>
        <p style={{ fontSize: "12px", color: "var(--gb-text-muted)", lineHeight: 1.4 }}>
          Discover opportunity tasks. Choose a task to let the Agent run a risk check, capability review, and formulate a step-by-step proposal.
        </p>
      </div>

      {/* Research Brief Form */}
      {state.agent ? (
        <div id="research-brief-form" className="gb-glass-card">
          <div className="gb-glass-card-header">
            <h3>
              <svg style={{ width: "16px", height: "16px", fill: "var(--gb-cyan-cyber)" }} viewBox="0 0 24 24">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
              Initiate Agent Research Brief
            </h3>
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--gb-text-soft)", display: "block", marginBottom: "4px" }}>
                Select Targeted Task
              </label>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="tasks-form-select"
              >
                <option value="">-- Choose an active task --</option>
                {selectableTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.energyCost} Credits)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--gb-text-soft)", display: "block", marginBottom: "4px" }}>
                Task Topic / Objective
              </label>
              <input
                type="text"
                placeholder="e.g. Deep synthesis of TON DeFi ecosystem"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                className="tasks-form-input"
              />
            </div>

            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--gb-text-soft)", display: "block", marginBottom: "4px" }}>
                Context & Requirements
              </label>
              <textarea
                placeholder="Define constraints, required assets, or specific outcomes for the Agent..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
                className="tasks-form-textarea"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedTaskId || !topic.trim()}
              className="gb-cta-button"
              style={{ marginTop: "8px" }}
            >
              <span>{submitting ? "Formulating Intent..." : "Generate Execution Proposal"}</span>
              <small>Creates plan for confirmation before any state transitions occur</small>
            </button>
          </form>
        </div>
      ) : (
        <div className="gb-glass-card" style={{ textAlign: "center", padding: "24px" }}>
          <div style={{ color: "var(--gb-text-muted)", fontSize: "13px" }}>
            Please activate an Agent on the home screen to access the job market.
          </div>
        </div>
      )}

      {/* Task Opportunities List */}
      <div style={{ padding: "0 16px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "8px 0" }}>Opportunities catalog</h3>
      </div>

      {state.tasks.length > 0 ? (
        state.tasks.map((task) => (
          <TaskOpportunityCard
            key={task.id}
            task={task}
            onGeneratePlan={() => handleTaskGeneratePlan(task)}
          />
        ))
      ) : (
        <div className="gb-glass-card" style={{ textAlign: "center", padding: "30px 16px" }}>
          <strong style={{ display: "block", color: "var(--gb-text-soft)", marginBottom: "4px" }}>
            No agent jobs available right now
          </strong>
          <span style={{ fontSize: "12px", color: "var(--gb-text-muted)" }}>
            Your Agent will surface tasks when the network updates.
          </span>
        </div>
      )}
    </section>
  );
}

// Compatibility: 让 Agent 分析任务, 当前没有正在运行的任务, 等待确认, 等待验收, 执行操作

