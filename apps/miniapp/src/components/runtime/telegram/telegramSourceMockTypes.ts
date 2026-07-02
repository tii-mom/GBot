export type TelegramAuthorizedSourceMock = {
  id: string;
  sourceType: "group" | "channel" | "user_submission" | "bot_mention" | "public_link";
  titlePreview: string;
  permissionScope: string[];
  status: "pending" | "authorized_mock" | "revoked" | "disabled";
  riskLevel: "low" | "medium" | "high";
  lastSignalAt?: string;
  dataBoundary: string;
  canSee: string[];
  cannotSee: string[];
};

export type TelegramOpportunitySignalMock = {
  id: string;
  sourceId: string;
  signalType: "bounty" | "announcement" | "risk_link" | "project_update" | "guild_task";
  title: string;
  summary: string;
  sourceType: TelegramAuthorizedSourceMock["sourceType"];
  confidenceLevel: "low" | "medium" | "high";
  estimatedAiCreditCost: number;
  requiredSkills: string[];
  riskFlags: string[];
  status: "candidate" | "ignored" | "pending_user" | "converted_to_work_run_mock";
  evidencePreview: string[];
  recommendedAction: string;
};

export type TelegramGuardianRuleMock = {
  id: string;
  title: string;
  description: string;
  status: "preview" | "enabled_mock" | "disabled_mock";
  requiredPermission: string;
  safetyBoundary: string;
};

export const sourceTypeLabel: Record<TelegramAuthorizedSourceMock["sourceType"], string> = {
  group: "公会群组",
  channel: "公告频道",
  user_submission: "用户提交链接",
  bot_mention: "@提及入口",
  public_link: "公开可访问线索"
};

export const signalTypeLabel: Record<TelegramOpportunitySignalMock["signalType"], string> = {
  bounty: "任务机会",
  announcement: "官方公告",
  risk_link: "风险提示",
  project_update: "项目更新",
  guild_task: "公会任务"
};

export const sourceStatusLabel: Record<TelegramAuthorizedSourceMock["status"], string> = {
  pending: "等待授权",
  authorized_mock: "授权生效",
  revoked: "已撤销",
  disabled: "已禁用"
};

export const riskLevelLabel: Record<TelegramAuthorizedSourceMock["riskLevel"], string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险"
};

export const confidenceLabel: Record<TelegramOpportunitySignalMock["confidenceLevel"], string> = {
  low: "匹配度较低",
  medium: "匹配度中等",
  high: "匹配度较高"
};
