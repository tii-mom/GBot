# Agent Skill Core V1

## Product Rules

- Skills are permanent once learned by an Agent.
- Skills cannot be removed for free.
- Core modules (Task Scanner, Task Planner, Basic Writer, Submission Assistant) are always active and do not use skill slots.
- Skill slots are determined by Agent level (4 at L1, 5 at L5, 6 at L10, 7 at L20, 8 at L30).
- When all slots are full, using a new skill card randomly replaces an unlocked skill.
- Locked skills cannot be replaced. Each Agent may lock one skill for free.
- Protection Tokens transiently protect an additional unlocked skill during replacement.

## Skill Tiers

- **Normal**: 15 skills across 5 categories
- **Advanced**: 15 skills across 5 categories
- **Expert**: 10 global skills
- Total: 4 core + 40 learnable = 44 definitions

## Categories

- research, content, social, verification, onchain

## Database

Tables: agent_skill_definitions, agent_learned_skills, agent_skill_operations, agent_skill_events
Migration: 0011_agent_skill_core.sql

## API

- GET /skills/definitions — List skill definitions
- GET /agents/:agentId/skills — List learned skills
- POST /agents/:agentId/skills/learn — Learn from skill card (empty slot or replace)
- POST /agents/:agentId/skills/:learnedSkillId/lock — Lock a skill
- POST /agents/:agentId/skills/:learnedSkillId/unlock — Unlock a skill
- GET /agents/:agentId/skill-events — Skill event audit trail
- GET /agent/skill-effects — Capability context for current agent

## Error Codes

agent_not_found, forbidden, skill_card_not_found, skill_card_consumed, skill_level_too_low, skill_slots_full, no_replaceable_skill, protection_invalid, lock_limit_exceeded, cannot_lock_core, skill_disabled

## Idempotency

All write operations (learn, replace, lock, unlock) use idempotency keys tracked in agent_skill_operations.

## Workflow Integration

Skill effects are computed through `resolveAgentSkillEffects()` and affect:
- Research: sourceLimit, researchDepth
- Verification: verificationLevel, riskChecks
- Content: contentModes, supportedLanguages
- Social: supportedChannels, audienceTargetingLevel
- Onchain: onchainReadLevel, contractAnalysisLevel
