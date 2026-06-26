# AI Model Token Purchase V1

> Status: canonical purchase flow spec.

This document defines how the Agent may obtain AI Model Tokens or AI Credits for approved work.

## Purpose

The product needs a clean contract for buying model usage units without blurring them with wallet custody or legacy point-system assumptions.

## Purchase Rules

- The Agent may propose a purchase intent.
- Policy Guard must approve the intent before execution.
- Purchases must obey user opt-in, transaction limits, reserve rules, and allowlists.
- Purchases must emit an audit event before execution and a status event after execution.

## Required Allowlists

- AI provider allowlist.
- Model allowlist.
- Contract allowlist, when the purchase uses on-chain or contract-mediated rails.
- Asset allowlist, when the purchase consumes a specific token or credit class.

## Budgeting

- The user must set or confirm a budget envelope.
- The system must keep a minimum reserve.
- Per-transaction and daily limits are mandatory.
- A denied purchase must not create hidden debt or phantom inventory.

## Status Model

Recommended statuses:

- `proposed`
- `allowed`
- `denied`
- `pending_payment`
- `purchased`
- `failed`
- `reversed`

## Copy Rules

- Do not present model credit purchase as an investment.
- Do not imply guaranteed earning power.
- Do not imply a risk-free path to monetization.

## Out Of Scope In Phase 1

- Live provider integrations that would move real assets.
- Production D1 changes.
- Telegram config changes.
