# Authenticated Production Smoke 2026-06-28

## 1. Environment

- API URL: `https://api.gb8.top`
- Mini App URL: `https://app.gb8.top/`
- Admin URL: `https://1989.gb8.top`
- Worker version: `a0190651-44b0-4deb-8ebf-ca26619cc4e1`
- Main commit: `b77eea5de482846eca9f44dcfa86b4e60f026d88`
- Production D1 apply: `NOT_EXECUTED`

## 2. Unauthenticated Smoke

| Endpoint | Status | Result |
| --- | --- | --- |
| `GET /health` | `200` | `{"ok":true,"env":"production","d1":true,"seeded":false}` |
| `GET /me` | `401` | `telegram_auth_required` |
| `GET /admin/real-asset/risk-console` | `401` | `admin_auth_required` |
| `GET /admin/real-asset/review-queue` | `401` | `admin_auth_required` |
| `GET /admin/real-asset/executor-readiness` | `401` | `admin_auth_required` |
| `GET /admin/real-asset/tx-status-tracker` | `401` | `admin_auth_required` |
| `GET /admin/real-asset/rollback-readiness` | `401` | `admin_auth_required` |

Outcome:

- Expected auth gating is present.
- No `404`.
- No `500`.

## 3. Telegram Authenticated Smoke

Method:

- Used the repository's existing safe test method to generate signed Telegram `initData` locally from the configured bot token.
- No raw `initData` or secrets are included in this report.

Results:

| Endpoint | Status | Result |
| --- | --- | --- |
| `GET /me` with signed Telegram `initData` | `200` | User bootstrap returned successfully. |
| `GET /tasks/available` with signed Telegram `initData` | `200` | Tasks payload returned. |
| `GET /inventory` with signed Telegram `initData` | `200` | Inventory payload returned. |

Observed behavior:

- No `500`.
- No raw `internal_error`.
- No evidence of expired `initData`.
- No evidence of bot token / env mismatch.
- No evidence of signature validation failure.
- No immediate D1 schema blocker on `/me`, `/tasks/available`, or `/inventory`.

Scope note:

- This smoke path may create or update a production user bootstrap row via normal `/me` semantics.
- No secrets were logged or committed.

## 4. Admin Authenticated Smoke

Method:

- Used the production `ADMIN_TOKEN` from local non-committed environment only.
- Tested both raw token auth and `/admin/login` session behavior.

### 4.1 Raw token against Real Asset Admin endpoints

| Endpoint | Status | Result |
| --- | --- | --- |
| `GET /admin/real-asset/risk-console` | `200` | Response shape loaded from `api`; no 404/500. |
| `GET /admin/real-asset/review-queue` | `200` | Response loaded; `persistence.degraded=true`, `persistenceError=admin_risk_audit_events_missing`. |
| `GET /admin/real-asset/executor-readiness` | `200` | `overallStatus=blocked`; readiness scaffold returned successfully. |
| `GET /admin/real-asset/tx-status-tracker` | `200` | Simulated tracker returned successfully. |
| `GET /admin/real-asset/rollback-readiness` | `200` | `status=pass`; rollback metadata returned successfully. |

Executor / safety flags observed:

| Field | Observed value |
| --- | --- |
| `executorEnabled` | `false` |
| `testnetExecutorEnabled` | `false` |
| `liveExecutorEnabled` | `false` |
| `signingEnabled` | not present in response shape |
| `broadcastingEnabled` | not present in response shape |
| `custodyEnabled` | not present in response shape |
| `mainWalletControlEnabled` | not present in response shape |
| `liveExecution` | `false` |
| `custody` | `false` |
| `mainWalletControl` | `false` |

Additional authenticated findings:

- `review-queue` reports `persistenceError=admin_risk_audit_events_missing`.
- That error maps directly to migration `0017_real_asset_agent_persistence_v1.sql`, which creates `admin_risk_audit_events`.
- This is strong evidence that production D1 migrations are still incomplete for at least part of the Real Asset persistence surface.

### 4.2 `/admin/login` session mismatch

Observed:

- `POST /admin/login` with valid production credentials returns `200` and an `accessToken`.
- Reusing that returned token against `GET /admin/real-asset/*` returns `401 admin_invalid_token`.

Interpretation:

- Production admin login is reachable, but the returned session token is not accepted by the Real Asset Admin auth path.
- This is an auth surface inconsistency blocker for session-based Admin smoke.
- Raw token auth works; session auth does not currently work for these endpoints.

Classification:

- `AUTH_BLOCKED` for session-based admin path.
- `READ-ONLY RAW TOKEN ACCESS OK` for direct authenticated smoke.

## 5. Mini App Smoke

Surface tested:

- Production page in browser: `https://app.gb8.top/`
- Screenshot artifact: [page-2026-06-28T10-25-33-014Z.png](/Users/yudeyou/Desktop/GrowthBot/output/playwright/authenticated-production-smoke-2026-06-28/.playwright-cli/page-2026-06-28T10-25-33-014Z.png)

Observed browser result without Telegram WebApp context:

- Page loads successfully.
- Header renders `GrowthBot HUD`.
- Bottom tabs are visible:
  - `Agent`
  - `Tasks`
  - `Run`
  - `Reports`
  - `Network`
- No raw `500` shown in UI.
- No default `Demo Mode · Not real assets` banner shown.
- Page falls into `Offline` / `Degraded` state because browser context does not provide Telegram `initData`, and `/me` returns `401`.

Console evidence:

- Browser logs show `GET https://api.gb8.top/me` returns `401`.
- Frontend logs `API request failed for /me. Mock fallback is disabled.`

Interpretation:

- In a normal browser without Telegram context, the current production Mini App presents a degraded/offline recovery state instead of a true auth-gated inline state.
- This is not a raw backend `500`, but it does mean browser-only entry does not transition into a real user session.
- A true Telegram in-app authenticated UI session was not completed in this run, so end-to-end Telegram Mini App rendering remains only partially verified.

## 6. D1 Status

- Production D1 apply: `NOT_EXECUTED`
- Confirmed blocker signal observed:
  - `admin_risk_audit_events_missing`
- Migration likely implicated:
  - `0017_real_asset_agent_persistence_v1.sql`

Assessment:

- Production Worker deploy is live and route mounting is correct.
- Production D1 schema is still not fully aligned with current authenticated Real Asset Admin expectations.
- Do not execute production D1 apply in this task.
- Separate explicit approval remains required.

Classification:

- `Production D1 migration required, pending separate explicit approval.`

## 7. Go / No-Go

Conclusion:

- `NO-GO / D1_MIGRATION_REQUIRED`

Reasoning:

- Telegram-authenticated `/me` smoke passes.
- Raw-token Admin authenticated smoke reaches the intended Real Asset surfaces successfully.
- However, Real Asset Admin returns a concrete persistence degradation signal tied to missing production migration state (`admin_risk_audit_events_missing` / migration `0017`).
- Admin session-token flow is also inconsistent: login succeeds but session token is rejected by `real-asset` endpoints.
- Mini App in plain browser remains degraded without Telegram context; full Telegram in-app UI transition was not completed here.

This is not full production go-live readiness.
