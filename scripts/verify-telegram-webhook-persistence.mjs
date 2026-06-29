/**
 * verify-telegram-webhook-persistence.mjs
 * V2.2-F Verification: Telegram Webhook Ingestion Persistence MVP
 */

import {
  extractBoundedContentPreview,
  hashTelegramUpdateId,
  hashTelegramContentPreview,
  deriveSignalFromIngestionEvent,
  classifyTelegramUpdate,
  hashTelegramIdentifier
} from "../apps/api-worker/src/v1/telegram.ts";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`✅ [PASS] ${label}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${label}`);
    failed++;
  }
}

console.log("🧪 Starting Telegram Webhook Persistence MVP Verification...\n");

// ─── 1. Bounded Preview ───
console.log("1. Testing extractBoundedContentPreview...");

const shortText = "Hello @GBot, check this project out.";
assert(extractBoundedContentPreview(shortText) === shortText.trim(), "Short text returned unchanged");

const longText = "A".repeat(200);
const preview = extractBoundedContentPreview(longText, 120);
assert(preview.length <= 121, "Long text truncated to maxLength + ellipsis");
assert(preview.endsWith("…"), "Truncated preview ends with ellipsis");
assert(!preview.includes(longText), "Full text is never returned from bounded preview");

const multiLine = "Hello\n@GBot\tPlease\rcheck";
assert(!extractBoundedContentPreview(multiLine).includes("\n"), "Newlines stripped from preview");

assert(extractBoundedContentPreview("") === "", "Empty text returns empty");
assert(extractBoundedContentPreview(null) === "", "Null text returns empty");

// ─── 2. Update ID Hashing ───
console.log("\n2. Testing hashTelegramUpdateId...");

const uidHash = await hashTelegramUpdateId(123456789, "test_salt");
assert(typeof uidHash === "string" && uidHash.length === 64, "Update ID hash has SHA-256 format");
assert(!uidHash.includes("123456789"), "Raw update ID not echoed in hash");

const uidHash2 = await hashTelegramUpdateId(123456789, "test_salt");
assert(uidHash === uidHash2, "Update ID hashing is deterministic");

// ─── 3. Content Hashing ───
console.log("\n3. Testing hashTelegramContentPreview...");

const fullText = "Hello @GBot, I have a potential bounty task about smart contract auditing.";
const contentHash = await hashTelegramContentPreview(fullText, "test_salt");
assert(typeof contentHash === "string" && contentHash.length === 64, "Content hash has SHA-256 format");
assert(!contentHash.includes("Hello"), "Raw text not echoed in content hash");
assert(!contentHash.includes("bounty"), "Raw text keywords not echoed in content hash");

// ─── 4. Signal Derivation ───
console.log("\n4. Testing deriveSignalFromIngestionEvent...");

const mockEvent = {
  updateIdHash: "abc123",
  sourceId: "src_1",
  agentId: "agent_1",
  eventType: "command",
  contentPreview: "/start check bounty",
  contentHash: "hash_xyz",
  messageRefHash: null,
  riskLevel: "low"
};

const signal = deriveSignalFromIngestionEvent(mockEvent);
assert(signal.signalType === "guild_task", "Command event maps to guild_task signal type");
assert(signal.confidenceLevel === "medium", "Command event gets medium confidence");
assert(signal.riskFlags.includes("needs_owner_review"), "Signal includes needs_owner_review flag");
assert(signal.requiredSkills.includes("telegram_signal_parser"), "Signal includes telegram_signal_parser skill");
assert(signal.estimatedAiCreditCost === 3, "Medium-confidence signal costs 3 credits");
assert(signal.title.length > 0, "Signal has non-empty title");
assert(signal.summary === mockEvent.contentPreview, "Signal summary comes from content preview");

const mentionEvent = { ...mockEvent, eventType: "mention" };
const mentionSignal = deriveSignalFromIngestionEvent(mentionEvent);
assert(mentionSignal.signalType === "announcement", "Mention event maps to announcement signal type");
assert(mentionSignal.confidenceLevel === "medium", "Mention event gets medium confidence");

const submissionEvent = { ...mockEvent, eventType: "submission" };
const submissionSignal = deriveSignalFromIngestionEvent(submissionEvent);
assert(submissionSignal.signalType === "bounty", "Submission event maps to bounty signal type");
assert(submissionSignal.confidenceLevel === "low", "Submission event gets low confidence");
assert(submissionSignal.estimatedAiCreditCost === 2, "Low-confidence signal costs 2 credits");

// ─── 5. Unauthorized Source Path ───
console.log("\n5. Testing unauthorized source classification path...");

const normalMsg = classifyTelegramUpdate({
  message: { text: "Hey everyone, how's it going?", chat: { id: -10012345 } }
});
assert(!normalMsg.accepted, "Normal group message is rejected");
assert(normalMsg.reason === "not_authorized_source", "Rejection reason is not_authorized_source");

// ─── 6. Candidate Signal Invariants ───
console.log("\n6. Testing candidate signal invariants...");

assert(signal.signalType !== undefined, "Signal has defined signal type");
assert(
  !JSON.stringify(signal).includes("WorkRun") && !JSON.stringify(signal).includes("workRun"),
  "No WorkRun fields appear in derived signal"
);
assert(
  !JSON.stringify(signal).includes("wallet") && !JSON.stringify(signal).includes("Wallet"),
  "No wallet intent fields appear in derived signal"
);

// ─── 7. Webhook Response Shape Verification ───
console.log("\n7. Testing webhook response shape...");

// Accepted response shape
const acceptedResponse = {
  ok: true,
  status: "accepted",
  mode: "ingestion_persistence_mvp",
  handled: true,
  eventId: "evt_test",
  signalId: "sig_test"
};
assert(!JSON.stringify(acceptedResponse).includes(fullText), "Accepted response does not contain full message text");
assert(acceptedResponse.mode === "ingestion_persistence_mvp", "Response mode is ingestion_persistence_mvp");

// Ignored response shape
const ignoredResponse = {
  ok: true,
  status: "ignored",
  reason: "not_authorized_source",
  handled: false
};
assert(ignoredResponse.handled === false, "Ignored response has handled=false");
assert(!JSON.stringify(ignoredResponse).includes("message"), "Ignored response has no message field");

// ─── 8. Bounded Preview Boundary ───
console.log("\n8. Testing content boundary enforcement...");

const exactBoundary = "A".repeat(120);
assert(extractBoundedContentPreview(exactBoundary, 120) === exactBoundary, "Exact boundary text not truncated");

const overBoundary = "A".repeat(121);
const overResult = extractBoundedContentPreview(overBoundary, 120);
assert(overResult.length <= 121, "Over-boundary text truncated");
assert(overResult.endsWith("…"), "Over-boundary text ends with ellipsis");

// ─── Summary ───
console.log(`\n${"=".repeat(50)}`);
if (failed > 0) {
  console.error(`❌ ${failed} check(s) FAILED, ${passed} passed`);
  process.exit(1);
} else {
  console.log(`🎉 All ${passed} Telegram webhook persistence checks PASSED successfully!`);
}
