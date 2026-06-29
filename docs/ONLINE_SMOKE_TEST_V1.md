# Online Smoke Test V1

> Status: manual online smoke execution checklist. This PR does not deploy and does not execute production migration apply.

## Targets

- Mini App: `https://app.gb8.top`
- Admin: `https://1989.gb8.top`
- API: `https://api.gb8.top`
- Telegram Bot: `@G2047_bot`

## Preconditions

- Production D1 apply, if required for the release, was manually approved and manually completed outside this PR.
- Production apply evidence is recorded in `docs/LAUNCH_READINESS_REPORT_TEMPLATE_V1.md`.
- Admin operator has a valid Admin session or `ADMIN_SESSION_TOKEN`.
- Browser screenshots or recordings can be stored in the launch evidence folder.
- No executor, testnet executor, or live executor is enabled.

## Online Smoke Execution Order

1. API health and authenticated Admin API checks.
2. Admin UI checks.
3. Mini App checks in Telegram WebApp environment.
4. Mini App browser preview checks.
5. Telegram Bot open/onboarding checks.
6. Safety boundary review.
7. Archive report and evidence.

If any step is `FAIL` or unresolved `BLOCKED`, stop launch approval.

## Execution Record Template

| Test item | Environment | Expected result | Actual result | PASS / FAIL / BLOCKED | Evidence link / screenshot path | Notes | Operator | Time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| API health | Production API | `/health` returns ok, env, d1, seeded |  |  |  |  |  |  |
| Admin Risk Console API | Production API with admin auth | Reachable and executor flags false |  |  |  |  |  |  |
| Admin Review Queue API | Production API with admin auth | Reachable, simulation/review-only |  |  |  |  |  |  |
| Executor Readiness API | Production API with admin auth | Reachable, executor disabled |  |  |  |  |  |  |
| Admin UI | Production Admin | Risk Console, Review Queue, Executor Readiness visible |  |  |  |  |  |  |
| Mini App Telegram WebApp | Telegram client | Bootstrap succeeds, workspace accessible |  |  |  |  |  |  |
| Mini App browser preview | Browser | Preview loads and degraded/fallback state is understandable |  |  |  |  |  |  |
| Telegram Bot | Telegram client | Bot opens Mini App with activation/start wording |  |  |  |  |  |  |

## API Smoke

Use `https://api.gb8.top/health` for API reachability. The current worker exposes `/health`; product bootstrap is validated through Mini App `/auth/telegram` and `/me` flows rather than a separate `/bootstrap` endpoint.

Admin Real Asset endpoints require admin authentication via `x-admin-token` or `Authorization: Bearer`.

Suggested checks:

```bash
curl -s https://api.gb8.top/health
curl -s https://api.gb8.top/admin/real-asset/risk-console -H "x-admin-token: ${ADMIN_SESSION_TOKEN}"
curl -s https://api.gb8.top/admin/real-asset/review-queue -H "x-admin-token: ${ADMIN_SESSION_TOKEN}"
curl -s https://api.gb8.top/admin/real-asset/executor-readiness -H "x-admin-token: ${ADMIN_SESSION_TOKEN}"
```

Expected:

- Health returns `ok: true`.
- `/admin/real-asset/risk-console` returns.
- `/admin/real-asset/review-queue` returns.
- `/admin/real-asset/executor-readiness` returns.
- Responses do not include `executorEnabled: true`.
- Responses do not include `testnetExecutorEnabled: true`.
- Responses do not include `liveExecutorEnabled: true`.
- Responses do not include `liveExecution: true`.

## Admin Smoke

Open `https://1989.gb8.top`.

Confirm:

- Admin Risk Console is accessible.
- Review Queue is accessible.
- Executor Readiness Gate is accessible.
- API/fallback data source is clearly displayed.
- `simulation-only` badge is visible.
- `no live execution` badge is visible.
- `no custody` badge is visible.
- `no main wallet control` badge is visible.
- `executorEnabled`, `testnetExecutorEnabled`, and `liveExecutorEnabled` are all false.
- Admin Review Queue and Risk Console are not bypassed for production approval.

## Mini App Smoke

Open `https://app.gb8.top`.

Telegram WebApp environment:

- Open `@G2047_bot`.
- Launch the Mini App from Telegram.
- Confirm product bootstrap succeeds through Telegram auth and `/me` state.
- Confirm Agent activation and workspace are accessible.
- Confirm Agent Wallet displays isolated / simulated / policy-limited status.
- Confirm Skill Cards display.
- Confirm Work Report evidence displays.
- Confirm degraded/fallback state is understandable if API state is unavailable.

Browser preview environment:

- Open `https://app.gb8.top` in a normal browser.
- Confirm preview or fallback mode is clearly labeled.
- Confirm safety posture remains visible.
- Confirm the page does not imply live execution or custody.

Forbidden user-visible copy:

- Do not show `领取免费 Agent`.
- Do not show `claim Agent`.
- Do not show guaranteed airdrop copy.
- Do not show guaranteed yield copy.
- Do not show guaranteed profit or risk-free outcome copy.

## Telegram Bot Smoke

Open `@G2047_bot`.

Confirm:

- Bot opens the Mini App.
- Onboarding uses activation/start semantics.
- No claim/airdrop promise appears.
- No guaranteed reward, guaranteed airdrop, guaranteed yield, guaranteed profit, fixed return, or risk-free wording appears.
- Fallback/degraded state is understandable if API state is unavailable.

## Safety Boundary Confirmation

Record explicit PASS/FAIL/BLOCKED for each item:

| Boundary | Expected | Actual | PASS / FAIL / BLOCKED | Evidence |
| --- | --- | --- | --- | --- |
| No executor enabled | `executorEnabled: false` |  |  |  |
| No testnet executor enabled | `testnetExecutorEnabled: false` |  |  |  |
| No live executor enabled | `liveExecutorEnabled: false` |  |  |  |
| No live execution | `liveExecution: false` |  |  |  |
| No signing | No signing action or UI |  |  |  |
| No broadcasting | No broadcast action or UI |  |  |  |
| No private keys | No private key storage/input |  |  |  |
| No seed phrases | No seed phrase storage/input |  |  |  |
| No mnemonics | No mnemonic storage/input |  |  |  |
| No custody | `custody: false` |  |  |  |
| No main wallet control | `mainWalletControl: false` |  |  |  |
| Telegram Kill Switch | `TELEGRAM_INGESTION_ENABLED=0` ignores webhook event |  |  |  |
| Telegram Safe Admin Read | Admin UI doesn't leak raw Telegram chat IDs / message content |  |  |  |
| Telegram Convert State | Convert signal button says "State-only" in live mode, no WorkRun created |  |  |  |

## Stop Conditions

Stop launch approval if:

- Any required smoke item is `FAIL`.
- Any required smoke item is `BLOCKED` without an approved resolution.
- API response shows executor enabled.
- API response shows testnet executor enabled.
- API response shows live executor enabled.
- API response shows live execution enabled.
- Admin UI implies executor is enabled.
- Admin Review Queue or Risk Console is bypassed.
- Any UI asks for private keys, seed phrases, or mnemonics.
- Any UI or API implies custody or user main-wallet control.
- Any copy promises guaranteed profit, guaranteed yield, guaranteed airdrop, fixed returns, or risk-free outcomes.

## Report Archival

Archive:

- Completed execution record.
- Screenshots or recordings.
- API response snippets with sensitive values redacted.
- Operator name.
- Timestamp.
- Release candidate commit.
- Link to launch readiness report.
