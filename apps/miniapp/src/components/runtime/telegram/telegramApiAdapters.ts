import type { TelegramAuthorizedSource, TelegramOpportunitySignal } from "../../../apiClient";
import type { TelegramAuthorizedSourceMock, TelegramOpportunitySignalMock } from "./telegramSourceMockTypes";

export function adaptSourceToMock(src: TelegramAuthorizedSource): TelegramAuthorizedSourceMock {
  return {
    id: src.id,
    sourceType: src.sourceType,
    titlePreview: src.telegramChatTitlePreview || "Telegram 挂载源",
    permissionScope: src.permissionScope || [],
    status: src.status === "authorized" ? "authorized_mock" : src.status,
    riskLevel: "low", // Default fallback risk assessment
    lastSignalAt: src.updatedAt ? src.updatedAt.slice(0, 16).replace("T", " ") : undefined,
    dataBoundary: "依据授权事件接入协议运行。仅在提及与特定指令时处理。",
    canSee: ["@GBot 提及内容", "明确指定的 Slash 命令", "用户显式复制提交的公开文档与悬赏链接"],
    cannotSee: ["群内普通用户聊天隐私", "钱包私钥/助记词敏感参数", "其他非指令信息"]
  };
}

export function adaptSignalToMock(sig: TelegramOpportunitySignal): TelegramOpportunitySignalMock {
  return {
    id: sig.id,
    sourceId: sig.sourceEventId || "",
    signalType: sig.signalType,
    title: sig.title,
    summary: sig.summary,
    sourceType: "group", // Fallback sourceType mapping
    confidenceLevel: sig.confidenceLevel || "medium",
    estimatedAiCreditCost: sig.estimatedAiCreditCost || 4,
    requiredSkills: sig.requiredSkills || [],
    riskFlags: sig.riskFlags || ["Live Ingestion"],
    status: sig.status === "converted_to_work_run" ? "converted_to_work_run_mock" : sig.status,
    evidencePreview: [
      `来源事件 ID: ${sig.sourceEventId || "N/A"}`,
      `发布时间: ${sig.createdAt ? sig.createdAt.replace("T", " ").slice(0, 16) : "N/A"}`
    ],
    recommendedAction: "配备所需技能卡，或标记为候选转换进行审查。"
  };
}
