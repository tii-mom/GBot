# GBot Canonical V1

> Status: canonical source of truth for the Phase 1 reset.

GBot is now canonically a TON-native Real Asset Agent Platform.

Users buy Skill Cards and fund an isolated Agent Wallet with real TON/G assets. The Agent may use those assets, under explicit user authorization, spending budgets, allowlisted contracts, policy guard checks, and audit logs, to purchase AI Model Tokens / AI Credits, execute tasks, and manage capabilities.

This document wins over any older product, economy, wallet, or workflow spec when they conflict.

## Canonical Principles

- `G` is the real on-chain spending asset.
- `TON` is the gas and network asset.
- `GP` is removed from new product economics.
- Skill Cards are public Agent capability assets.
- The public Skill Card set is exactly 31 cards: 12 Normal, 12 Advanced, 7 Expert.
- The Agent Wallet is isolated from the user's main wallet.
- The user main wallet keeps owner/root control.
- The Agent must never receive or store the user's main wallet seed phrase or private key.
- Policy Guard decides whether an intent is allowed to execute.
- Every on-chain action must have an auditable intent before execution and an auditable event after execution.
- No copy may promise guaranteed profit, guaranteed yield, guaranteed airdrops, or risk-free returns.

## Phase 1 Scope

- Create the new canonical product direction.
- Remove GP as a product and economic concept from canonical docs.
- Mark old GP / pending_points / Observation Mode docs as legacy.
- Keep migrations, production backups, and historical ops exports intact.
- Keep build and typecheck passing.
- Do not deploy.
- Do not modify production D1.
- Do not modify Telegram config.
- Do not implement live chain transactions in this PR.
- Do not touch `.ai-bridge`.

## Canonical Doc Set

- [Real Asset Agent V1](./REAL_ASSET_AGENT_V1.md)
- [TON Agent Wallet V1](./TON_AGENT_WALLET_V1.md)
- [G Token Economy V1](./G_TOKEN_ECONOMY_V1.md)
- [Skill Card System V1](./SKILL_CARD_SYSTEM_V1.md)
- [AI Model Token Purchase V1](./AI_MODEL_TOKEN_PURCHASE_V1.md)
- [Pet Agent Visual System V1](./PET_AGENT_VISUAL_SYSTEM_V1.md)
- [Pet Agent Frontend IA V1](./PET_AGENT_FRONTEND_IA_V1.md)
- [Agent Playground Telegram V1](./AGENT_PLAYGROUND_TELEGRAM_V1.md)
- [Telegram Mini App Context & Share Card Spec V1.5](./TELEGRAM_MINIAPP_CONTEXT_SHARE_V1.md)
- [Pet Agent V2 Telegram Permission Backend Plan](./PET_AGENT_V2_TELEGRAM_PERMISSION_BACKEND_PLAN.md)
- [Telegram Source Settings & Opportunity Inbox Mock UI Spec V2.1](./PET_AGENT_V21_TELEGRAM_SOURCE_SETTINGS_MOCK.md)
- [GP Removal Plan](./GP_REMOVAL_PLAN.md)
- [Legacy Docs Archive Index](./LEGACY_DOCS_ARCHIVE_INDEX.md)

## Legacy Guidance

- Historical GP-era docs remain in the repository for traceability.
- They are not product truth once this canonical set exists.
- `GP`, `pending_points`, and `point_ledger_events` are legacy implementation references that still need later migration work.
- New implementation must not derive product truth from the old GP ledger model or any `point_ledger_events`-based settlement assumptions.
- If a later document conflicts with this one, the canonical set and archive index win.
