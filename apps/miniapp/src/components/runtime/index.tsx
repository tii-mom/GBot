import React from "react";
import type { Agent, Task, WorkReport, WorkRun, WorkStep } from "@growthbot/shared";
import { formatSettlementLabel, formatVerificationLabel, formatWorkRunSummary, statusLabel } from "./runtimeUtils";
import type { WorkspacePrimaryAction } from "./runtimeTypes";

export function Card({ title, children, action, className }: { title?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return <section className={`runtime-card${className ? ` ${className}` : ""}`}>{(title || action) && <div className="runtime-card__head">{title && <h2>{title}</h2>}{action}</div>}{children}</section>;
}

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="section-header"><div><span className="section-header__eyebrow">{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state"><strong>{title}</strong><p>{description}</p>{action}</div>;
}

export function PrimaryAction({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return <button className="primary-action" onClick={onClick}><span>{label}</span><small>{hint}</small></button>;
}

export function StatusExplainer({ title, description, status }: { title: string; description: string; status?: string }) {
  return <div className="status-explainer"><div><strong>{title}</strong><p>{description}</p></div>{status && <span className="status-explainer__status">{status}</span>}</div>;
}

export function EnvironmentNotice({ title, description }: { title: string; description: string }) {
  return <div className="environment-notice"><strong>{title}</strong><p>{description}</p></div>;
}

export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return <Card><div className="stat-card"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div></Card>;
}

export function StatusBadge({ status }: { status?: string | null }) {
  const normalized = status || "unknown";
  return <span className={`status-badge status-badge--${normalized.replace(/_/g, "-")}`}>{statusLabel(normalized)}</span>;
}

export function RuntimeBadge({ status, progress }: { status?: string | null; progress?: number | null }) {
  return <span className="runtime-badge"><StatusBadge status={status || "idle"} /> {typeof progress === "number" ? `${Math.max(0, Math.min(100, progress))}%` : "runtime"}</span>;
}

export function ProgressCard({ label, progress, detail }: { label: string; progress: number; detail?: string }) {
  return <Card><div className="progress-card"><div><strong>{label}</strong><span>{detail}</span></div><div className="progress"><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div><b>{Math.max(0, Math.min(100, progress))}%</b></div></Card>;
}

export function ReportCard({ report, onOpen, filter }: { report: WorkReport | WorkRun; onOpen: () => void; filter?: string }) {
  const isWorkReport = "reportKind" in report || "overallStatus" in report;
  const status = isWorkReport ? (report as WorkReport).overallStatus : (report as WorkRun).status;
  const label = isWorkReport ? (report as WorkReport).taskId : (report as WorkRun).taskId;
  const agentLabel = isWorkReport ? `Agent ${report.agentId}` : `Agent ${report.agentId}`;
  const summary = isWorkReport
    ? `${formatVerificationLabel((report as WorkReport).verification?.status)} · ${formatSettlementLabel((report as WorkReport).settlement?.status)}`
    : formatWorkRunSummary(report as WorkRun).label;
  return <button className="report-card" onClick={onOpen} data-filter={filter || "All"}><div><span>{label}</span><small>{agentLabel}</small></div><div><small>{summary}</small><StatusBadge status={status} /></div></button>;
}

function AgentCardContent({ agent, skills, lastRuntime }: { agent: Agent; skills: string[]; lastRuntime?: string }) {
  return <><div className="agent-card__top"><div><h3>{agent.name}</h3><small>{statusLabel(agent.status)}</small></div><StatusBadge status={agent.status} /></div><p>Energy {agent.energy}/{agent.maxEnergy}</p><p>Level {agent.level}</p><p>Skills: {skills.length ? skills.join(" · ") : "No runtime skills loaded"}</p><small>Last Runtime: {lastRuntime || agent.activeWorkRunId || "none"}</small></>;
}

export function AgentCard({ agent, skills, lastRuntime, onOpen }: { agent: Agent; skills: string[]; lastRuntime?: string; onOpen?: () => void }) {
  return onOpen ? <button className="agent-card" onClick={onOpen}><AgentCardContent agent={agent} skills={skills} lastRuntime={lastRuntime} /></button> : <article className="agent-card"><AgentCardContent agent={agent} skills={skills} lastRuntime={lastRuntime} /></article>;
}

export function RuntimeTimeline({ steps = [] }: { steps?: WorkStep[] }) {
  return <ol className="runtime-timeline">{steps.length ? steps.map((step) => <li key={step.id || step.stepOrder}><StatusBadge status={step.status} /><b>{step.title || step.stepType}</b><span>{step.outputSummary || step.description || "Awaiting runtime output"}</span></li>) : <li><StatusBadge status="pending" /><b>No steps returned</b><span>The WorkRun API has not returned execution steps yet.</span></li>}</ol>;
}

export function TaskLine({ task, action, meta }: { task: Task; action?: React.ReactNode; meta?: React.ReactNode }) {
  return <div className="task-line"><div><b>{task.name}</b><small>{task.taskType || "runtime_task"} · AI capacity est. {task.energyCost} · evidence task</small>{meta}</div>{action}</div>;
}

export function WorkspaceMetricRow({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return <div className="workspace-metric-row"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>;
}

export function ActionList({ children }: { children: React.ReactNode }) {
  return <div className="action-list">{children}</div>;
}
