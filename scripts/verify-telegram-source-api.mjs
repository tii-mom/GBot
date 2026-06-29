import { hashTelegramIdentifier, serializeSource } from "../apps/api-worker/src/v1/telegram.ts";

console.log("🧪 Starting Telegram Source API Helper Verification...");

let failed = false;

// 1. Test hashTelegramIdentifier
console.log("\n1. Testing hashTelegramIdentifier...");
(async () => {
  try {
    const rawVal = "123456789";
    const salt = "my-secure-salt";

    const hash1 = await hashTelegramIdentifier(rawVal);
    const hash2 = await hashTelegramIdentifier(rawVal);
    const hashWithSalt = await hashTelegramIdentifier(rawVal, salt);

    if (hash1 !== hash2) {
      console.error("❌ [FAIL] Hashing is not deterministic.");
      failed = true;
    } else {
      console.log("✅ [PASS] Hashing is deterministic");
    }

    if (hash1.includes(rawVal)) {
      console.error("❌ [FAIL] Hashed output leaks raw identifier.");
      failed = true;
    } else {
      console.log("✅ [PASS] Hash output does not leak raw ID");
    }

    if (hash1 === hashWithSalt) {
      console.error("❌ [FAIL] Salting did not change hash output.");
      failed = true;
    } else {
      console.log("✅ [PASS] Salting successfully modifies the SHA-256 digest");
    }

    // Verify format (64-character hex string)
    const hexRegex = /^[a-f0-9]{64}$/;
    if (!hexRegex.test(hash1)) {
      console.error(`❌ [FAIL] Hash is not a valid 64-char hex string. Got: ${hash1}`);
      failed = true;
    } else {
      console.log("✅ [PASS] Hash output matches standard SHA-256 hex signature format");
    }
  } catch (err) {
    console.error("❌ [FAIL] Hashing helper threw an error:", err.message);
    failed = true;
  }

  // 2. Test serializeSource
  console.log("\n2. Testing serializeSource...");
  const mockDbRow = {
    id: "src_uuid_123",
    owner_user_id: "user_owner_456",
    agent_id: "agent_active_789",
    source_type: "group",
    telegram_chat_id_hash: "82736481729abc",
    telegram_chat_title_preview: "Staking Alpha Chat",
    permission_scope: '["mention_analysis", "bounty_post"]',
    status: "authorized",
    created_at: "2026-06-29T12:00:00Z",
    updated_at: "2026-06-29T12:15:00Z",
    revoked_at: null
  };

  try {
    const serialized = serializeSource(mockDbRow);

    // Assert omission of raw telegram_chat_id_hash
    if ("telegram_chat_id_hash" in serialized || "telegramChatIdHash" in serialized) {
      console.error("❌ [FAIL] Serialized output leaks internal hash identifier.");
      failed = true;
    } else {
      console.log("✅ [PASS] Serialized output completely omits internal database chat hash");
    }

    // Assert camelCase formatting
    if (
      serialized.id === mockDbRow.id &&
      serialized.ownerUserId === mockDbRow.owner_user_id &&
      serialized.agentId === mockDbRow.agent_id &&
      serialized.sourceType === mockDbRow.source_type &&
      serialized.telegramChatTitlePreview === mockDbRow.telegram_chat_title_preview &&
      serialized.status === mockDbRow.status &&
      serialized.createdAt === mockDbRow.created_at &&
      serialized.updatedAt === mockDbRow.updated_at &&
      serialized.revokedAt === null
    ) {
      console.log("✅ [PASS] Database snake_case columns properly mapped to camelCase response properties");
    } else {
      console.error("❌ [FAIL] Property mapping failed. Got:", serialized);
      failed = true;
    }

    // Assert parsing of permission_scope
    if (Array.isArray(serialized.permissionScope) && serialized.permissionScope.length === 2) {
      console.log("✅ [PASS] JSON permission_scope string successfully deserialized into string array");
    } else {
      console.error("❌ [FAIL] Failed to deserialize permission_scope. Got:", serialized.permissionScope);
      failed = true;
    }
  } catch (err) {
    console.error("❌ [FAIL] Serializer helper threw an error:", err.message);
    failed = true;
  }

  if (failed) {
    console.error("\n❌ Telegram Source API verification FAILED!");
    process.exit(1);
  } else {
    console.log("\n🎉 All Telegram Source API helper checks PASSED successfully!");
    process.exit(0);
  }
})();
