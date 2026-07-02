export type TelegramPlaygroundContext = {
  available: boolean;
  platform?: string;
  userDisplayName?: string;
  userIdPreview?: string;
  startParam?: string;
  chatContextAvailable: boolean;
  launchSource: "direct" | "startapp" | "group" | "unknown";
  permissionState: "not_connected" | "preview" | "awaiting_authorization" | "authorized_mock";
  safetyNotice: string;
  cluesCount: number;
};

/**
 * Safely derives the Telegram host context without exposing raw security tokens or initData.
 */
export function deriveTelegramPlaygroundContext(): TelegramPlaygroundContext {
  const isWindowAvailable = typeof window !== "undefined";
  const webApp = isWindowAvailable ? (window as any).Telegram?.WebApp : null;
  const isAvailable = !!webApp && !!webApp.initData;

  const platform = webApp?.platform || "web";
  const user = webApp?.initDataUnsafe?.user;
  const startParam = webApp?.initDataUnsafe?.start_param || "";

  // Derive launch source
  let launchSource: TelegramPlaygroundContext["launchSource"] = "unknown";
  if (isAvailable) {
    if (startParam) {
      launchSource = "startapp";
    } else {
      launchSource = "direct";
    }
  }

  // Use a preview/abbreviated form for User ID
  let userIdPreview = "";
  if (user?.id) {
    const rawId = String(user.id);
    userIdPreview = rawId.length > 5 
      ? `${rawId.slice(0, 3)}...${rawId.slice(-3)}` 
      : rawId;
  }

  // Display Name derivation
  let userDisplayName = "Telegram 用户";
  if (user) {
    userDisplayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "Telegram 用户";
  }

  // Group context (chat context) check. E.g. WebApp.initDataUnsafe.chat or check start param
  const chatContextAvailable = !!webApp?.initDataUnsafe?.chat || startParam.startsWith("group");

  return {
    available: isAvailable,
    platform,
    userDisplayName,
    userIdPreview,
    startParam,
    chatContextAvailable,
    launchSource,
    permissionState: isAvailable ? "authorized_mock" : "awaiting_authorization",
    safetyNotice: "只处理授权群聊、被 @ 提及或用户显式提交的数据，不监控私聊，不读取全部历史消息。",
    cluesCount: isAvailable ? 4 : 0
  };
}
