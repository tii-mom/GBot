import { useEffect, useState } from "react";
import type { Agent, Task } from "@growthbot/shared";
import { Card, TaskLine } from "..";
import type { ResearchBriefInput } from "../runtimeTypes";
import { isResearchTask } from "../runtimeUtils";

export function ResearchBriefCreateView({ tasks, agent, onCreate }: { tasks: Task[]; agent: Agent | null; onCreate: (taskId: string, input: ResearchBriefInput) => void }) {
  const research = tasks.filter(isResearchTask);
  const selectableTasks = research.length ? research : tasks;
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [taskId, setTaskId] = useState(selectableTasks[0]?.id || "");
  useEffect(() => {
    const firstTask = selectableTasks[0];
    if (!taskId && firstTask) setTaskId(firstTask.id);
  }, [taskId, selectableTasks]);
  return <Card title="New Research Brief"><input placeholder="Research topic" value={topic} onChange={(e) => setTopic(e.target.value)} /><textarea placeholder="Research context, constraints, sources, or expected angle" value={context} onChange={(e) => setContext(e.target.value)} /><select value={taskId} onChange={(e) => setTaskId(e.target.value)}>{selectableTasks.map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}</select><button disabled={!agent || !taskId || !topic.trim()} onClick={() => onCreate(taskId, { topic: topic.trim(), context: context.trim() })}>Create Research Brief WorkRun</button><small>This creates a WorkRun from a Research Brief compatibility path until standalone Research Brief CRUD/list APIs exist.</small></Card>;
}

export function TaskBucket({ title, tasks, action }: { title: string; tasks: Task[]; action: (task: Task) => React.ReactNode }) {
  return <Card title={title}>{tasks.map((task) => <TaskLine key={task.id} task={task} action={action(task)} />)}</Card>;
}
