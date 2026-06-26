# TON Agent Wallet V1

> Status: canonical wallet spec.

The TON Agent Wallet is the isolated execution wallet used by the Agent for allowed real-asset actions.

## Wallet Roles

- `Main Wallet`: user-owned root wallet with owner control.
- `Agent Wallet`: isolated operational wallet used by the Agent.
- `Policy Guard`: policy engine that decides whether an intent may execute.
- `Operator Scope`: the narrow permission set granted to the Agent or operator service.

## Hard Boundaries

- The main wallet remains under user root control.
- The Agent Wallet must not reuse the user's main wallet seed phrase or private key.
- The Agent Wallet must not be treated as the user's primary custody wallet.
- The Agent may only act through scoped operator permissions or policy-controlled execution.

## Required Safeguards

- Explicit user opt-in before any spending.
- Per-transaction limit.
- Daily limit.
- Minimum reserve.
- Contract allowlist.
- Asset allowlist.
- AI provider allowlist.
- Admin global pause.
- Audit log entry for every intent.
- Transaction status tracking for every execution.

## Transaction Lifecycle

1. Create intent.
2. Validate policy.
3. Reserve or check budget.
4. Execute only if allowed.
5. Record result status.
6. Emit post-execution audit evidence.

Recommended statuses:

- `proposed`
- `allowed`
- `denied`
- `queued`
- `executing`
- `succeeded`
- `failed`
- `cancelled`
- `paused`

## Recovery And Revocation

- The user can revoke operator scope.
- The admin can globally pause execution.
- Residual funds should be recoverable or sweepable by a later approved flow.
- Failed or denied intents must remain auditable.

## Out Of Scope In Phase 1

- Live transaction code.
- Custodial seed management.
- Production wallet mutation.

