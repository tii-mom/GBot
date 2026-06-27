# Online Smoke Test V1

> Status: manual pre-launch checklist. This document assumes live URLs already exist. This PR does not deploy.

## Targets

- Mini App: `https://app.gb8.top`
- Admin: `https://1989.gb8.top`
- API: `https://api.gb8.top`
- Telegram Bot: `@G2047_bot`

## Output Format

For each check, record:

- `PASS`
- `FAIL`
- `BLOCKED`
- `notes`
- `screenshot/evidence optional`

## Mini App

- Confirm bootstrap succeeds.
- Confirm Agent activation and workspace entry are accessible.
- Confirm Agent Wallet copy shows isolated / simulated / policy-limited posture.
- Confirm Skill Cards render.
- Confirm Work Report evidence renders.
- Confirm user-visible primary paths do not show:
  - `领取免费 Agent`
  - `claim Agent`
  - `guaranteed airdrop`
  - `guaranteed yield`
- Confirm degraded/fallback messaging is visible if API becomes unavailable.

## Admin

- Confirm Admin Risk Console is accessible.
- Confirm Review Queue is accessible.
- Confirm Executor Readiness Gate is accessible.
- Confirm API vs fallback data source is clearly labeled.
- Confirm safety badges are visible:
  - `simulation-only`
  - `no live execution`
  - `no custody`
  - `no main wallet control`
- Confirm UI does not expose:
  - execute
  - submit transaction
  - sign
  - broadcast
  - enable executor

## API

- Confirm health/bootstrap endpoint is reachable.
- Confirm `/admin/real-asset/risk-console` returns.
- Confirm `/admin/real-asset/review-queue` returns.
- Confirm `/admin/real-asset/executor-readiness` returns.
- Confirm response never includes `executorEnabled: true`.
- Confirm response never includes `liveExecution: true`.

## Telegram Bot

- Confirm bot opens the Mini App.
- Confirm onboarding copy uses activation/start wording rather than claim/领取 promises.
- Confirm no guaranteed reward / guaranteed airdrop / guaranteed yield copy appears.
- Confirm degraded/fallback state remains understandable if API is unavailable.

## Safety Reminders

- Executor remains disabled.
- Testnet executor remains disabled.
- Live executor remains disabled.
- No signing.
- No broadcasting.
- No private keys.
- No seed phrases.
- No mnemonics.
- No custody.
- No main wallet control.

## Suggested API Commands

```bash
curl -s https://api.gb8.top/health
curl -s https://api.gb8.top/admin/real-asset/risk-console
curl -s https://api.gb8.top/admin/real-asset/review-queue
curl -s https://api.gb8.top/admin/real-asset/executor-readiness
```
