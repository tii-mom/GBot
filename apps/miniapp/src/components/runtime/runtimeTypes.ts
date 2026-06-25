import type {
  Agent,
  AgentSkillSlots,
  InventoryItem,
  LearnedSkill,
  Task,
  User,
  WorkReport,
  WorkRun,
  WorkStep
} from "@growthbot/shared";
import type { ApiStatus } from "./EnvironmentBadge";

export type Tab = "Workspace" | "Agents" | "Tasks" | "Reports" | "Network";
export type ReportFilter = "All" | "Verified" | "Failed" | "Shared" | "Pending Verification";
export type ResearchBriefInput = { topic: string; context: string };
export type RuntimeSkill = LearnedSkill & {
  sourceLabel?: string | null;
};

export type RuntimeState = {
  user: User | null;
  agent: Agent | null;
  tasks: Task[];
  inventory: InventoryItem[];
  skills: RuntimeSkill[];
  skillSlots: AgentSkillSlots | null;
  runs: WorkRun[];
  activeRun: WorkRun | null;
  selectedRun: WorkRun | null;
  selectedSteps: WorkStep[];
  selectedReport: WorkReport | null;
  reportCache: Record<string, WorkReport | null>;
  apiStatus: ApiStatus;
  error: string | null;
};

export type WorkspacePrimaryActionKind = "claim" | "tasks" | "plan" | "verify" | "report" | "retry" | "energy";

export type WorkspacePrimaryAction = {
  label: string;
  hint: string;
  kind: WorkspacePrimaryActionKind;
};

export type WorkspaceStats = {
  todayTasks: number;
  activeAgentCount: number;
  runningTasks: number;
  waitingConfirmation: number;
  pendingVerification: number;
  completedRuns: number;
  settledRuns: number;
  pendingPoints: number;
  energy: number;
};
