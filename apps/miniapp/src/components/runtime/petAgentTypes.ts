export type ZodiacSign =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";

export type AgentMood =
  | "happy"
  | "focused"
  | "tired"
  | "excited"
  | "waiting"
  | "sleepy"
  | "failed";

export type AgentState =
  | "dormant"
  | "idle"
  | "scanning"
  | "exploring"
  | "executing"
  | "waiting_user"
  | "verifying"
  | "settling"
  | "completed"
  | "failed"
  | "low_ai_credit"
  | "resting";

export type AgentVisualProfile = {
  zodiac: ZodiacSign;
  mood: AgentMood;
  state: AgentState;
  outfitId: string;
  accessoryIds: string[];
  auraId: string;
  rarityFrame?: "starter" | "rare" | "epic" | "legendary";
};

export type DispatchMode = "cautious" | "balanced" | "aggressive";

export type ExploreZone =
  | "ton_new_projects"
  | "telegram_playground"
  | "community_growth"
  | "onchain_risk"
  | "bounty_hall";

export type TrainBuild =
  | "bounty_hunter"
  | "research_expert"
  | "content_growth"
  | "onchain_scout"
  | "auto_butler";

export type ValueCreationSummary = {
  todayRadarCount: number;
  filteredRisksCount: number;
  completedTasksCount: number;
  reportsGeneratedCount: number;
  aiCreditConsumed: number;
  savedBudget: number;
  pendingVerificationRewards: number; // 待验收价值 / 待结算结果
  settlingRewards: number; // 任务方结算中
};

export type TelegramPlaygroundSummary = {
  isConnected: boolean;
  cluesCount: number;
  authorizedPlaza: boolean;
  permissionsText: string;
};

export type RuntimeTab = "Agent" | "Train" | "Explore" | "Nest" | "Guild";
export type LegacyTab =
  | "Workspace"
  | "Agents"
  | "Tasks"
  | "Run"
  | "Reports"
  | "Network";
