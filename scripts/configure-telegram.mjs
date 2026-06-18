import { readFileSync } from "node:fs";

const envText = readFileSync(new URL("../.env", import.meta.url), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || "https://api.gb8.top/telegram/webhook";
const miniAppUrl = process.env.TELEGRAM_MINIAPP_URL || "https://app.gb8.top";

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is missing from .env");
}

async function callTelegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000)
  });
  const json = await response.json();
  if (!response.ok || !json.ok) {
    throw new Error(`${method} failed: ${JSON.stringify(json)}`);
  }
  return json.result;
}

try {
  const webhook = await callTelegram("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query", "my_chat_member"],
    drop_pending_updates: true
  });

  const menu = await callTelegram("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "打开 GrowthBot",
      web_app: { url: miniAppUrl }
    }
  });

  const commands = await callTelegram("setMyCommands", {
    commands: [
      { command: "start", description: "打开 GrowthBot" },
      { command: "farm", description: "查看任务状态" },
      { command: "boxes", description: "查看技能包资产" },
      { command: "market", description: "查看市场" },
      { command: "pool", description: "查看战队" },
      { command: "help", description: "安全说明" }
    ]
  });

  const info = await callTelegram("getWebhookInfo", {});

  console.log(JSON.stringify({
    webhook,
    menu,
    commands,
    info: {
      url: info.url,
      pending_update_count: info.pending_update_count,
      last_error_message: info.last_error_message || null
    }
  }, null, 2));
} catch (error) {
  console.error("Telegram configuration failed.");
  console.error(error instanceof Error ? error.message : String(error));
  console.error("Retry this command from a network that can reach api.telegram.org:");
  console.error("node scripts/configure-telegram.mjs");
  process.exit(1);
}
