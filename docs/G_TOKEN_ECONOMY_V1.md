# G Token Economy V1

> Status: canonical economy spec.

## Asset Roles

- `G` is the real on-chain spending asset.
- `TON` is the gas and network asset.
- `AI Model Tokens / AI Credits` are paid usage units or credits consumed by the Agent.
- `Skill Cards` are capability assets purchased or acquired by the user.

## What Changed From GP

- `GP` is removed from canonical product economics.
- Legacy GP history may remain in archives and historical exports.
- New product copy must not present GP as the spendable economy.

## Economy Rules

- Users fund isolated Agent Wallets with real TON/G assets.
- Spending must respect explicit user authorization.
- Spending must respect per-transaction and daily limits.
- Spending must keep a minimum reserve.
- Spending must respect contract, asset, and provider allowlists.
- All execution must be auditable.

## Pricing And Copy

- Prices may be shown in `G` when the product is selling capability, access, or credit packages.
- Gas and network fees are shown in `TON` when relevant.
- Do not imply fixed conversion rates between `G`, TON, fiat, or future rewards.
- Do not promise guaranteed return on spend.

## Accounting Model

The economy should track:

- intent creation
- approval or denial
- spend reservation
- execution status
- post-execution receipt or failure
- audit trace

## Legacy Boundary

Any `GP`, `pending_points`, or `Observation Mode` wording belongs to legacy material only.

