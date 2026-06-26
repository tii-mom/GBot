# Wallet Security Policy (Legacy / Superseded)

> Status: legacy. Replaced by [TON Agent Wallet V1](./TON_AGENT_WALLET_V1.md) and [GBot Canonical V1](./GBOT_CANONICAL_V1.md).

This document is preserved for historical reference only.

## 1. Core Principle

GrowthBot must never directly control the user's main wallet.

The main wallet is the user's owner account. GrowthBot's Agent can only operate through clearly authorized and limited mechanisms.

## 2. Integration Stages

### Stage 1: No Wallet

V0 starts without wallet requirement.

Allowed:

- Telegram login.
- Off-chain points.
- Off-chain boxes.
- Off-chain marketplace simulation.

### Stage 2: TON Connect

User connects wallet.

Allowed:

- Read wallet address.
- Verify ownership.
- Request user-confirmed transactions.

Not allowed:

- Store private keys.
- Move funds without wallet confirmation.

### Stage 3: Agentic Wallet

User creates or activates isolated Agentic Wallet.

Allowed:

- Approved low-risk actions.
- Budget-limited automation.
- Contract allowlist.
- Full execution logs.

Not allowed:

- Main wallet automation.
- Unrestricted swaps.
- Unknown contract interaction.
- Large transfers without confirmation.

## 3. Agentic Wallet Rules

Required controls:

- User remains owner.
- Agent/operator has limited authority.
- Daily spend limit.
- Per-project spend limit.
- Per-action risk level.
- Pause Agent button.
- Withdraw unused funds button.
- Execution history.

Default limits:

- Low initial budget.
- Low daily automation cap.
- High-risk actions disabled.

## 4. Action Risk Levels

### Low Risk

Can be auto-executed after user enables Agentic Wallet:

- Approved badge mint.
- Approved claim.
- Approved check-in.
- Approved raffle entry.
- Approved project task with small cost.

### Medium Risk

Requires user setting or one-time permission:

- Paid mint.
- Project-specific deposit.
- Repeated task execution.
- Spending above default task cost.

### High Risk

Requires explicit confirmation every time:

- Swap.
- Transfer to non-allowlisted address.
- Any unknown contract.
- Any large-value action.
- Permission changes.

## 5. User Controls

Every wallet user must have:

- Pause Agent.
- Resume Agent.
- View budget.
- View daily spend.
- View active permissions.
- Withdraw unused funds.
- Revoke or disable Agent.
- Export execution log.

## 6. Disclosure Copy

Suggested copy:

> Agent Wallet is isolated from your main wallet. GrowthBot can only execute approved actions within your limits.

Suggested warning:

> Agentic Wallet automation is experimental. Start with a small budget and review your activity regularly.

## 7. Incident Response

Required before production Agentic Wallet:

- Emergency pause for all automated actions.
- Per-project disable switch.
- User notification system.
- Transaction monitoring.
- Manual review queue.
- Public incident template.
