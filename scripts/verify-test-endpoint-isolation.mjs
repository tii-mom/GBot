import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { app } from "../apps/api-worker/src/index.ts";

let envText = "";
try {
  envText = readFileSync(new URL("../.env", import.meta.url), "utf8");
} catch (_) {}
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const botToken = process.env.TELEGRAM_BOT_TOKEN;

function signTelegramInitData(userObj) {
  const user = JSON.stringify(userObj);
  const authDate = Math.floor(Date.now() / 1000);
  const params = {
    auth_date: String(authDate),
    query_id: "verify_isolation_query_id",
    user,
  };
  if (!botToken) {
    return new URLSearchParams({ ...params, hash: "mockhash" }).toString();
  }
  const dataCheckString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
}

const initData = signTelegramInitData({ id: 8888, username: "isolation_tester" });

function createMockDB() {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("FROM users")) {
                return { id: "user_test", telegram_id: "8888", username: "isolation_tester", risk_status: "normal" };
              }
              if (sql.includes("FROM agents")) {
                return { id: "agent_test", user_id: "user_test" };
              }
              return null;
            },
            async all() {
              return { results: [] };
            },
            async run() {
              return { success: true };
            }
          };
        },
        async first() {
          if (sql.includes("FROM users")) {
            return { id: "user_test", telegram_id: "8888", username: "isolation_tester", risk_status: "normal" };
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { success: true };
        }
      };
    }
  };
}

async function runTest(env, path, headers = {}) {
  try {
    const response = await app.fetch(new Request(`http://localhost${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-init-data": initData,
        ...headers
      },
      body: JSON.stringify({})
    }), {
      ...env,
      DB: createMockDB()
    });
    return response.status;
  } catch (err) {
    console.error("fetch error:", err);
    return 500;
  }
}

async function run() {
  console.log("=== Starting Test Endpoint Isolation Verification ===");

  const combinations = [
    {
      name: "production + ENABLE=true -> 403",
      env: { APP_ENV: "production", ENABLE_TEST_ENDPOINTS: "true", TEST_ENDPOINT_TOKEN: "secret123" },
      expected: 403
    },
    {
      name: "staging + ENABLE=true -> 403",
      env: { APP_ENV: "staging", ENABLE_TEST_ENDPOINTS: "true", TEST_ENDPOINT_TOKEN: "secret123" },
      expected: 403
    },
    {
      name: "test + ENABLE=false -> 403",
      env: { APP_ENV: "test", ENABLE_TEST_ENDPOINTS: "false", TEST_ENDPOINT_TOKEN: "secret123" },
      expected: 403
    },
    {
      name: "test + ENABLE=true + invalid token -> 403",
      env: { APP_ENV: "test", ENABLE_TEST_ENDPOINTS: "true", TEST_ENDPOINT_TOKEN: "secret123" },
      headers: { "x-test-endpoint-token": "wrong_token" },
      expected: 403
    },
    {
      name: "test + ENABLE=true + valid token -> non-403",
      env: { APP_ENV: "test", ENABLE_TEST_ENDPOINTS: "true", TEST_ENDPOINT_TOKEN: "secret123" },
      headers: { "x-test-endpoint-token": "secret123" },
      expected: 200
    }
  ];

  for (const tc of combinations) {
    console.log(`[ISOLATION] Running case: ${tc.name}`);
    const statusPoints = await runTest(tc.env, "/test/points-grant", tc.headers);
    const statusStock = await runTest(tc.env, "/test/update-stock", tc.headers);
    const statusInspect = await runTest(tc.env, "/test/inspect", tc.headers);
    const statusRuntimeFixture = await runTest(tc.env, "/test/runtime/fixtures/failed-execution", tc.headers);

    if (tc.expected === 403) {
      if (statusPoints !== 403 || statusStock !== 403 || statusInspect !== 403 || statusRuntimeFixture !== 403) {
        throw new Error(`Expected 403 for forbidden environment configuration, but got: points-grant=${statusPoints}, update-stock=${statusStock}, inspect=${statusInspect}, runtime-fixture=${statusRuntimeFixture}`);
      }
    } else {
      if (statusPoints === 403 || statusStock === 403 || statusInspect === 403 || statusRuntimeFixture === 403) {
        throw new Error(`Expected success (non-403) for valid configuration, but got: points-grant=${statusPoints}, update-stock=${statusStock}, inspect=${statusInspect}, runtime-fixture=${statusRuntimeFixture}`);
      }
    }
    console.log(`[ISOLATION] PASS: ${tc.name}`);
  }

  console.log("[ISOLATION] Test endpoint environment isolation verified successfully!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(err => {
    console.error("Unhandled isolation verification error:", err);
    process.exit(1);
  });
}

export { run as verifyTestEndpointIsolation };
