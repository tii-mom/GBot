import type { Agent, InventoryItem, Task, User } from "@growthbot/shared";
import type { ApiStatus } from "./EnvironmentBadge";

export type Tab = "Workspace" | "Agents" | "Tasks" | "Reports" | "Network";
export type ResearchBriefInput = { topic: string; context: string };
export type RuntimeState = {
  user: User | null;
  agent: Agent | null;
  tasks: Task[];
  inventory: InventoryItem[];
  skills: any[];
  runs: any[];
  activeRun: any | null;
  selectedRun: any | null;
  selectedSteps: any[];
  selectedReport: any | null;
  apiStatus: ApiStatus;
  error: string | null;
};

export type WorkspaceStats = {
  activeAgents: number;
  runningTasks: number;
  verifiedReports: number;
  settlements: number;
  gpEarned: number;
};
