import { useEffect, useMemo, useState } from "react";
import type { Agent, Task } from "@growthbot/shared";
import { Card, EmptyState, SectionHeader, TaskLine } from "..";
import type { ResearchBriefInput } from "../runtimeTypes";
import { isResearchTask, stateEmptyCopy, statusLabel } from "../runtimeUtils";

export function ResearchBriefCreateView({ tasks, agent, onCreate }: { tasks: Task[]; agent: Agent | null; onCreate: (taskId: string, input: ResearchBriefInput) => void }) {
  const researchTasks = useMemo(() => tasks.filter(isResearchTask), [tasks]);
  const selectableTasks = researchTasks.length ? researchTasks : tasks;
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [taskId, setTaskId] = useState(selectableTasks[0]?.id || "");

  useEffect(() => {
    const firstTask = selectableTasks[0];
    const currentTaskStillSelectable = selectableTasks.some((task) => task.id === taskId);
    if (!currentTaskStillSelectable) setTaskId(firstTask?.id || "");
  }, [taskId, selectableTasks]);

  if (!agent) {
    return (
      <Card title="让 Agent 分析任务">
        <EmptyState title="先激活 Agent" description={stateEmptyCopy.noAgent} />
      </Card>
    );
  }

  return (
    <Card title="让 Agent 分析任务">
      <SectionHeader
        eyebrow="研究简报"
        title="开始 Agent 执行"
        description="把任务目标、限制和背景交给 Agent，让它先分析再生成计划。"
      />
      <input placeholder="任务目标" value={topic} onChange={(e) => setTopic(e.target.value)} />
      <textarea placeholder="上下文、约束、资料来源或期望结果" value={context} onChange={(e) => setContext(e.target.value)} />
      <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
        {selectableTasks.map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}
      </select>
      <button disabled={!taskId || !topic.trim()} onClick={() => onCreate(taskId, { topic: topic.trim(), context: context.trim() })}>开始 Agent 执行</button>
      <small>兼容路径：仍通过 `apiClient.createWorkRun` 创建 WorkRun；独立 Research Brief CRUD/list API 若缺失，会保留为 P1 缺口记录。</small>
      {researchTasks.length > 0 && <p className="runtime-inline-note">当前可优先选择的研究简报任务：{researchTasks.map((task) => task.name).join(" · ")}</p>}
      {!researchTasks.length && <p className="runtime-inline-note">当前任务池里没有显式 Research Brief 任务，已回退到普通任务列表。</p>}
    </Card>
  );
}

export function TaskBucket({ title, tasks, action }: { title: string; tasks: Task[]; action: (task: Task) => React.ReactNode }) {
  return (
    <Card title={title}>
      {tasks.length ? tasks.map((task) => <TaskLine key={task.id} task={task} meta={<small>{statusLabel(task.taskType || "pending")}</small>} action={action(task)} />) : <EmptyState title="暂无任务" description={stateEmptyCopy.noTasks} />}
    </Card>
  );
}
