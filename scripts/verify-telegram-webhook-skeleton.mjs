import { classifyTelegramUpdate, dedupeTelegramUpdate } from "../apps/api-worker/src/v1/telegram.ts";

console.log("🧪 Starting Telegram Webhook Backend Skeleton Verification...");

// 1. Classification Tests
console.log("\n1. Testing classifyTelegramUpdate...");

const testCases = [
  {
    name: "Empty update payload",
    input: null,
    expected: { accepted: false, reason: "unsupported_update" }
  },
  {
    name: "Missing message payload",
    input: { update_id: 123 },
    expected: { accepted: false, reason: "missing_message" }
  },
  {
    name: "Normal message without commands/mentions",
    input: { update_id: 124, message: { text: "Hello team, let's coordinate the staking pool." } },
    expected: { accepted: false, reason: "not_authorized_source" }
  },
  {
    name: "Slash command /start",
    input: { update_id: 125, message: { text: "/start" } },
    expected: { accepted: true, reason: "command", eventType: "command" }
  },
  {
    name: "Bot mention in lowercase @gbot",
    input: { update_id: 126, message: { text: "Hey @gbot status check" } },
    expected: { accepted: true, reason: "bot_mention", eventType: "mention" }
  },
  {
    name: "Bot mention in uppercase @GBOT",
    input: { update_id: 127, message: { text: "Hey @GBOT check balance" } },
    expected: { accepted: true, reason: "bot_mention", eventType: "mention" }
  }
];

let failed = false;

for (const tc of testCases) {
  const result = classifyTelegramUpdate(tc.input);
  const pass = result.accepted === tc.expected.accepted && result.reason === tc.expected.reason;
  if (pass) {
    console.log(`✅ [PASS] ${tc.name}`);
  } else {
    console.error(`❌ [FAIL] ${tc.name}`);
    console.error("Expected:", tc.expected);
    console.error("Got:", result);
    failed = true;
  }
}

// 2. Dedupe Tests
console.log("\n2. Testing dedupeTelegramUpdate...");

// Mock KV namespace
const mockKvStore = new Map();
const mockKv = {
  get: async (key) => mockKvStore.get(key) || null,
  put: async (key, val, options) => {
    mockKvStore.set(key, val);
  }
};

(async () => {
  // Test Option A stub (no KV)
  const isDuplicateNoKv = await dedupeTelegramUpdate(undefined, 9999);
  if (isDuplicateNoKv === false) {
    console.log("✅ [PASS] Dedupe stub works without KV binding");
  } else {
    console.error("❌ [FAIL] Dedupe stub returned true without KV");
    failed = true;
  }

  // Test Option B KV integration
  const firstTime = await dedupeTelegramUpdate(mockKv, 10001);
  const secondTime = await dedupeTelegramUpdate(mockKv, 10001);

  if (firstTime === false && secondTime === true) {
    console.log("✅ [PASS] Dedupe logic successfully caches and detects duplicates with KV");
  } else {
    console.error("❌ [FAIL] Dedupe logic failed with KV. First run:", firstTime, "Second run:", secondTime);
    failed = true;
  }

  if (failed) {
    console.error("\n❌ Verification FAILED!");
    process.exit(1);
  } else {
    console.log("\n🎉 All Telegram webhook skeleton checks PASSED successfully!");
    process.exit(0);
  }
})();
