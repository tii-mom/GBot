// Legacy runtime dashboard view. Not part of Pet Agent V1 primary navigation.
import { AgentStudioView } from "../../AgentStudioView";
import type { RuntimeState } from "../runtimeTypes";
import { AgentCard, Card, EmptyState, SectionHeader, StatusBadge, StatusExplainer, WorkspaceMetricRow } from "..";
import { skillStatusLabel, stateEmptyCopy, statusLabel } from "../runtimeUtils";

export function AgentsView({
  state,
  skillNames,
  showStudio,
  setShowStudio
}: {
  state: RuntimeState;
  skillNames: string[];
  showStudio: boolean;
  setShowStudio: (show: boolean) => void;
}) {
  return (
    <section className="runtime-stack">
      <SectionHeader
        eyebrow="Agent Center"
        title="Agent 与技能"
        description="Agent Detail 先保持可读，资产中心和更深的技能编排作为二级能力保留。"
        action={<button onClick={() => setShowStudio(true)}>打开 Agent Studio</button>}
      />
      <Card title="Agent 卡片">
        {state.agent ? (
          <AgentCard agent={state.agent} skills={skillNames} lastRuntime={state.runs[0]?.id} />
        ) : (
          <EmptyState title="未激活 Agent" description={stateEmptyCopy.noAgent} />
        )}
      </Card>
      <Card title="Agent 详情">
        {state.agent ? (
          <>
            <StatusExplainer title="Overview" description={state.agent.profession || "Agent 已就绪"} status={statusLabel(state.activeRun?.status || state.agent.status)} />
            <WorkspaceMetricRow label="Runtime" value={statusLabel(state.activeRun?.status || state.agent.status)} />
            <WorkspaceMetricRow label="Level" value={state.agent.level} />
            <WorkspaceMetricRow label="Energy" value={`${state.agent.energy}/${state.agent.maxEnergy}`} />
            <WorkspaceMetricRow label="Skills" value={skillNames.length || "0"} hint={skillNames.length ? skillNames.join(" · ") : stateEmptyCopy.noSkills} />
            <WorkspaceMetricRow label="History" value={state.runs.length} hint="WorkRun 历史记录" />
            <WorkspaceMetricRow label="Assets" value={state.inventory.length} hint="资产中心保持为二级入口" />
          </>
        ) : (
          <EmptyState title="Agent Detail 暂不可用" description={stateEmptyCopy.noAgent} />
        )}
      </Card>
      <Card title="技能卡">
        {state.skills.length ? (
          <div className="skill-card-grid">
            {state.skills.map((skill) => (
              <article key={skill.id} className="skill-card">
                <div className="skill-card__head">
                  <div>
                    <strong>{skill.skillName}</strong>
                    <p>{skill.skillDescription || skill.skillCategory}</p>
                  </div>
                  <StatusBadge status={skill.status} />
                </div>
                <WorkspaceMetricRow label="Tier" value={skill.skillTier} />
                <WorkspaceMetricRow label="Level" value={skill.skillLevel} />
                <WorkspaceMetricRow label="Status" value={skillStatusLabel(skill.status)} hint={skill.sourceLabel || "来自技能卡 / 任务 / 市场"} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="暂无技能" description={stateEmptyCopy.noSkills} />
        )}
      </Card>
      {showStudio && <AgentStudioView onClose={() => setShowStudio(false)} t={(k: string, d?: string) => d || k} />}
    </section>
  );
}
