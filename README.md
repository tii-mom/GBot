# GrowthBot

GrowthBot is a Telegram-native growth product for crypto users.

The core idea:

> Wallet is the user's execution account. Agent is the automated worker. Blind boxes are the source of abilities. Marketplace is the liquidity and discovery layer.

GrowthBot lets users create or activate an Agent that farms points, badges, whitelist chances, raffle entries, and launch access across ecosystem projects. Users can open blind boxes to obtain Agent abilities, trade those abilities in a marketplace, and join group mining pools for viral Telegram distribution.

## Product Positioning

GrowthBot is not a generic quest platform.

It is a Telegram-native Agent product for crypto users who want early access, points, and future reward eligibility with minimal friction.

User-facing promise:

> Let your Telegram Agent farm airdrops while you sleep.

## Core Modules

- Telegram Bot: entry point, notifications, group virality, daily reports, referrals.
- Telegram Mini App: Agent dashboard, boxes, inventory, leaderboard, marketplace.
- Agent System: automated task execution, strategy, energy, abilities, reports.
- TON Agentic Wallet: isolated execution wallet for on-chain farming actions.
- Points System: Pending Points, User Score, Claim Credits.
- Blind Box System: source of Agent abilities, boosts, tickets, and access rights.
- Marketplace: trading, renting, pricing, and discovery for boxes and abilities.
- Project Task Pool: ecosystem projects publish tasks and reward pools.

## Key Documents

- [Product PRD](./docs/PRD.md)
- [MVP User Flow](./docs/MVP_USER_FLOW.md)
- [V0 Scope](./docs/V0_SCOPE.md)
- [API Contract](./docs/API_CONTRACT.md)
- [Database Schema](./docs/DATABASE_SCHEMA.md)
- [Admin Console Spec](./docs/ADMIN_CONSOLE_SPEC.md)
- [Cloudflare Architecture](./docs/CLOUDFLARE_ARCHITECTURE.md)
- [Cloudflare Setup](./docs/CLOUDFLARE_SETUP.md)
- [Backend Blueprint](./docs/BACKEND_BLUEPRINT.md)
- [Screen Data Spec](./docs/SCREEN_DATA_SPEC.md)
- [Bot State Machine](./docs/BOT_STATE_MACHINE.md)
- [Implementation Tasks](./docs/IMPLEMENTATION_TASKS.md)
- [System Architecture](./docs/ARCHITECTURE.md)
- [Points, Boxes, and Marketplace Economy](./docs/ECONOMY.md)
- [Points and Box Rules](./docs/POINTS_AND_BOX_RULES.md)
- [Marketplace Rules](./docs/MARKETPLACE_RULES.md)
- [Wallet Security Policy](./docs/WALLET_SECURITY_POLICY.md)
- [Bot Copy](./docs/BOT_COPY.md)
- [Analytics and Anti-Sybil](./docs/ANALYTICS_AND_ANTISYBIL.md)
- [Launch Ops Playbook](./docs/LAUNCH_OPS_PLAYBOOK.md)
- [QA Test Plan](./docs/QA_TEST_PLAN.md)
- [Frontend Handoff](./docs/FRONTEND_HANDOFF.md)
- [AI Studio Frontend Prompt](./docs/AI_STUDIO_FRONTEND_PROMPT.md)
- [Project Handoff](./docs/HANDOFF.md)
- [MVP Roadmap](./docs/MVP_ROADMAP.md)
- [Risks and Open Questions](./docs/RISKS_AND_OPEN_QUESTIONS.md)

## Current Strategy

Phase 1 should prove the growth loop before pushing heavy on-chain automation:

1. Telegram login and free Agent claim.
2. Starter Box and basic abilities.
3. Off-chain Pending Points farming.
4. Daily Agent report sharing.
5. Referral and group mining pool.
6. Simple leaderboard.
7. Basic blind box purchase.
8. Fixed-price marketplace for boxes and transferable abilities.

Phase 2 introduces TON Agentic Wallet for isolated on-chain execution.
