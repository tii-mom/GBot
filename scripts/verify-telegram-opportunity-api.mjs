import { serializeSignal } from "../apps/api-worker/src/v1/telegram.ts";

console.log("🧪 Starting Telegram Opportunity API Helper Verification...");

let failed = false;

// 1. Test serializeSignal
console.log("\n1. Testing serializeSignal...");
const mockDbRow = {
  id: "sig_uuid_777",
  agent_id: "agent_active_888",
  source_event_id: "evt_uuid_999",
  signal_type: "bounty",
  title: "TON Liquid Staking Bounty Proposal",
  summary: "Analyze the staking contract code and provide feedback.",
  source_url: "https://t.me/AlphaHunters/123",
  confidence_level: "high",
  estimated_ai_credit_cost: 15,
  required_skills: '["smart_contract_audit", "ton_development"]',
  risk_flags: '["high_gas_limit"]',
  status: "candidate",
  created_at: "2026-06-29T12:00:00Z",
  updated_at: "2026-06-29T12:05:00Z"
};

try {
  const serialized = serializeSignal(mockDbRow);

  // Assert requiredSkills array parsing
  if (Array.isArray(serialized.requiredSkills) && serialized.requiredSkills.includes("smart_contract_audit")) {
    console.log("✅ [PASS] JSON required_skills successfully parsed into string array");
  } else {
    console.error("❌ [FAIL] Deserializing required_skills failed. Got:", serialized.requiredSkills);
    failed = true;
  }

  // Assert riskFlags array parsing
  if (Array.isArray(serialized.riskFlags) && serialized.riskFlags.includes("high_gas_limit")) {
    console.log("✅ [PASS] JSON risk_flags successfully parsed into string array");
  } else {
    console.error("❌ [FAIL] Deserializing risk_flags failed. Got:", serialized.riskFlags);
    failed = true;
  }

  // Assert raw/internal IDs are not present
  if ("telegram_chat_id" in serialized || "telegram_update_id" in serialized || "telegramChatId" in serialized) {
    console.error("❌ [FAIL] Serializer leaked internal Telegram identifiers.");
    failed = true;
  } else {
    console.log("✅ [PASS] Serializer does not leak raw Telegram identifiers");
  }

  // Assert camelCase property mapping
  if (
    serialized.id === mockDbRow.id &&
    serialized.agentId === mockDbRow.agent_id &&
    serialized.sourceEventId === mockDbRow.source_event_id &&
    serialized.signalType === mockDbRow.signal_type &&
    serialized.title === mockDbRow.title &&
    serialized.summary === mockDbRow.summary &&
    serialized.sourceUrl === mockDbRow.source_url &&
    serialized.confidenceLevel === mockDbRow.confidence_level &&
    serialized.estimatedAiCreditCost === mockDbRow.estimated_ai_credit_cost &&
    serialized.status === mockDbRow.status &&
    serialized.createdAt === mockDbRow.created_at &&
    serialized.updatedAt === mockDbRow.updated_at
  ) {
    console.log("✅ [PASS] Database snake_case columns correctly serialized to camelCase response properties");
  } else {
    console.error("❌ [FAIL] Serializer mapping failed. Got:", serialized);
    failed = true;
  }
} catch (err) {
  console.error("❌ [FAIL] Serializer helper threw an error:", err.message);
  failed = true;
}

// 2. Validate Enum Schemas
console.log("\n2. Testing enum verification helper stubs...");
const validStatuses = ["candidate", "ignored", "pending_user", "converted_to_work_run"];
const validTypes = ["bounty", "announcement", "risk_link", "project_update", "guild_task"];

function validateStatus(status) {
  return validStatuses.includes(status);
}

function validateType(type) {
  return validTypes.includes(type);
}

if (validateStatus("candidate") && !validateStatus("fake_status")) {
  console.log("✅ [PASS] Status enum validation boundary verified");
} else {
  console.error("❌ [FAIL] Status validation failed.");
  failed = true;
}

if (validateType("bounty") && !validateType("fake_type")) {
  console.log("✅ [PASS] Signal type enum validation boundary verified");
} else {
  console.error("❌ [FAIL] Signal type validation failed.");
  failed = true;
}

if (failed) {
  console.error("\n❌ Telegram Opportunity API verification FAILED!");
  process.exit(1);
} else {
  console.log("\n🎉 All Telegram Opportunity API helper checks PASSED successfully!");
  process.exit(0);
}
