# GBot Pet Agent V2.2 Staging UAT Evidence Report

This report records the final Staging User Acceptance Testing (UAT) results and credentials safety validation for the Telegram Agent Ingestion (V2.2) pipeline.

---

## 1. Tested Commit & Repository State

- **Tested Commit Hash**: `60ed0eb`
- **Tested Commit Title**: `docs: add telegram v22 final closeout report (#57)`
- **Clean Workspace**: Yes (all code changes and final closeout report successfully merged into `main`).

---

## 2. Endpoint Reachability

All staging endpoints are confirmed reachable over HTTPS:
- **API Worker**: [https://api.gb8.top](https://api.gb8.top) (Reachable, returns HTTP 404 for root path)
- **Mini App**: [https://staging.growthbot-miniapp.pages.dev](https://staging.growthbot-miniapp.pages.dev) (Reachable, returns HTTP 200)
- **Admin Console**: [https://staging.growthbot-admin.pages.dev](https://staging.growthbot-admin.pages.dev) (Reachable, returns HTTP 200)

**Result**: 🟢 **PASS**

---

## 3. Remote D1 Database Evidence

Remote D1 database `growthbot-staging` is confirmed to contain all 4 required schema tables:
1. `telegram_authorized_sources`
2. `telegram_ingestion_events`
3. `telegram_opportunity_signals`
4. `policy_guard_external_action_events`

**Result**: 🟢 **PASS**

---

## 4. Webhook Smoke Results

- **TELEGRAM_INGESTION_ENABLED=0**: **BLOCKED** (Requires live secret header token matching `X-Telegram-Bot-Api-Secret-Token` which is secure and unshared)
- **Unauthorized source check**: **BLOCKED** (Requires secret-token authenticated replay)
- **Authorized source check**: **BLOCKED** (Requires secret-token authenticated replay)

**Result**: 🔴 **BLOCKED**

---

## 5. Admin Smoke Results

- **Admin console reachable**: **PASS** (Admin page loads correctly)
- **Auth boundary**: **PASS** (Redirects/gates console behind login)
- **Table views (sources/events/signals)**: **BLOCKED** (Requires an active authorized JWT administrative session)
- **Table actions (disable source/ignore signal)**: **BLOCKED** (Requires administrative credentials)
- **Privacy constraints (no raw Telegram ID/no full message text)**: **BLOCKED** (Tables not viewable without credentials)
- **Scope safety (no WorkRun/no wallet intent)**: **BLOCKED** (Panel not reachable)

**Result**: 🔴 **BLOCKED**

---

## 6. Mini App Smoke Results

- **Mini App reachable**: **PASS** (Shell loads correctly)
- **API connection badge**: **PASS** (Live API badge ready to show connection status; falls back to offline overlay when unauthenticated)
- **Inbox & Sources render**: **BLOCKED** (Requires loading inside Telegram runtime with valid `initData`)
- **Convert action (State-only/no WorkRun/no wallet signature)**: **BLOCKED** (Requires Telegram runtime context)

**Result**: 🔴 **BLOCKED**

---

## 7. Rollback / Kill Switch Result

- **Live Kill Switch Ingestion Bypass**: **BLOCKED** (Tested locally in unit/persistence suites, but live Cloudflare variables toggle not exercised on staging)

**Result**: 🔴 **BLOCKED**

---

## 8. Credentials Rotation Confirmation

- **Cloudflare API Token Rotation**: **CONFIRMED** (Exposed API token has been successfully rotated on Cloudflare and replaced locally in `.env` with a placeholder `REDACTED_API_TOKEN_ROTATED_ON_CF`. No plain text secrets are referenced or stored in any logs or repository files).

---

## 9. Final Decision & Status

```text
Implementation phase: CLOSED
Controlled staging UAT: BLOCKED
Public launch: NO-GO
```

### Remaining Blockers:
1. Webhook testing requires configuring the bot webhook secret token.
2. Admin Console smoke tests require administrative credentials to bypass the auth gateway.
3. Mini App smoke tests require loading the application inside a real Telegram container passing authenticated `initData` parameters.
