# Real Asset Agent V1

> Status: canonical product spec.

This document defines the product contract for the real asset Agent layer.

## What The Agent Is

- A user-authorized operating agent.
- A capability consumer that can spend within explicit policy.
- A task executor that can propose and carry out allowed actions.
- A buyer of AI Model Tokens / AI Credits when policy permits.

The Agent is not a custodian of the user's main wallet and is not allowed to hold the user's seed phrase or private key.

## Operating Model

1. The user authorizes an action or budget envelope.
2. The Agent creates an auditable intent.
3. Policy Guard evaluates the intent against the current rules.
4. If allowed, the wallet layer executes the permitted action.
5. Execution produces a transaction status and a post-execution audit event.

## Required Controls

- Explicit user opt-in.
- Per-transaction limit.
- Daily limit.
- Minimum reserve.
- Contract allowlist.
- Asset allowlist.
- AI provider allowlist.
- Admin global pause.
- Audit logs.
- Transaction status tracking.

## Decision Rule

AI may recommend and prepare purchase or execution intents, but it does not self-approve policy.

Policy Guard makes the final allow or deny decision.

## Copy Rules

- Do not promise guaranteed profit.
- Do not promise guaranteed yield.
- Do not promise guaranteed airdrops.
- Do not promise risk-free returns.
- Use clear language about budgets, permissions, and auditability.

## Out Of Scope In Phase 1

- Live chain transaction execution.
- Production D1 mutation.
- Telegram config changes.
- Any wallet seed phrase handling.

