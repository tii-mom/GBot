# G Token Economy V1

> Status: canonical economy spec.

## Asset Roles

- `G` is the real spending asset and Agent fuel.
- `TON` is the gas and network asset.
- `AI Model Tokens / AI Credits` are paid usage units or credits consumed by the Agent.
- `Skill Cards` are capability assets purchased or acquired by the user.

## What Changed From GP

- `GP` is removed from canonical product economics.
- Legacy GP history may remain in archives and historical exports.
- New product copy must not present GP as the spendable economy.

## Economy Rules

- Users fund isolated Agent Wallets with real TON/G assets.
- Agent discovery, scoring, planning, model calls, execution, proof packaging, submission assistance, and settlement tracking consume `G` directly or consume AI Credits / token budget bought with `G`.
- Spending must respect explicit user authorization.
- Spending must respect per-transaction and daily limits.
- Spending must keep a minimum reserve.
- Spending must respect contract, asset, and provider allowlists.
- All execution must be auditable.
- External bounty payouts belong to the user and should settle to the user's wallet or platform account.
- GBot does not default to taking custody of external bounty payouts.
- GBot monetizes fuel, subscriptions, tool calls, or explicitly authorized service fees rather than default custody of user payouts.

## Pricing And Copy

- Prices may be shown in `G` when the product is selling capability, access, or credit packages.
- Gas and network fees are shown in `TON` when relevant.
- Do not imply fixed conversion rates between `G`, TON, fiat, or future rewards.
- Do not promise guaranteed return on spend.
- Users may voluntarily buy more `G` after receiving external payouts, but this must be an explicit user action.

## Accounting Model

The economy should track:

- intent creation
- approval or denial
- spend reservation
- execution status
- fuel usage
- external payout destination metadata
- settlement tracking status
- post-execution receipt or failure
- audit trace

## Legacy Boundary

Any `GP`, `pending_points`, or `Observation Mode` wording belongs to legacy material only.
