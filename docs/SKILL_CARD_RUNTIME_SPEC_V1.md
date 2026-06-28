# Skill Card Runtime Spec V1

Skill Cards in GrowthBot are runtime-readable Agent capability specifications, not just UI collectible cards. They define execution logic, safety parameters, tool access controls, and output structures.

## Card Architecture

GrowthBot separates capabilities into a three-layer runtime system:

1. **Display Card (Layer 1)**: Defines UI styling, tier indicators, visual assets, category, and catalog entries read by the frontend.
2. **Runtime Card (Layer 2)**: Standard Markdown and compiled configurations defining purpose, execution procedures, allowed tools, and safety boundaries executed by the Agent runtime engine.
3. **Evidence Required / Work Report Sections (Layer 3)**: Structural schemas determining the verification fields and proof checklists compiled into the final delivery work report.

## Unified Schema Definition

Every Skill Card runtime specification is represented by a structured `SkillRuntimeSpec` definition containing:

- `id`: Unique definition ID (e.g. `sd_onc_ton_chain_analyst`).
- `key`: Unique database code key (e.g. `skill_onc_ton_chain_analyst`).
- `name`: Human-readable title (e.g. `Token Analysis`).
- `tier`: One of `"normal"`, `"advanced"`, or `"expert"`.
- `displaySummary`: Brief UI descriptive summary.
- `purpose`: Precise natural language definition of capability scope.
- `useWhen`: Specific situational triggers.
- `doNotUseWhen`: Negative context selectors.
- `requiredInputs`: Input parameters required before execution.
- `executionSteps`: Dynamic prompt layers outlining procedure.
- `outputFormat`: Output schema contract parameters.
- `evidenceRequired`: List of verified links/hashes/proofs needed.
- `safetyBoundary`: Core runtime limits (such as transaction signing overrides).
- `agentRuntimeEffect`: Active capacity effects (e.g. canSign: false, canBroadcast: false, requiresAdminReview).
- `adminReviewPolicy`: Explanation of required review triggers.
- `workReportSections`: Target headers in compilation reports.

---

## Token Analysis Standard Template

The standard template below is finalized as the template for all current and future skill cards additions.

```markdown
Skill: Token Analysis
Tier: Advanced
Requires Admin Review: Yes

Purpose:
Evaluate a token’s public information, utility, distribution, liquidity context, and visible risk signals without making investment recommendations.

Use When:
* User asks Agent to understand a TON / G related token.
* A task requires checking token utility, holders, contract address, or public token docs.
* Agent needs to decide whether a token-related task has enough public evidence to proceed.

Do Not Use When:
* User asks for guaranteed profit, price prediction, or investment advice.
* The token has no verifiable contract/source.
* The task requires signing, swapping, buying, selling, or broadcasting transactions.

Required Inputs:
* Token name or symbol.
* Chain/network.
* Contract address if available.
* Official website/docs/social links if available.
* User’s task objective.

Execution Steps:
1. Identify the token and verify contract/source.
2. Collect official docs and public references.
3. Summarize utility and ecosystem role.
4. Review basic distribution and liquidity indicators if public.
5. Identify risk flags: unclear contract, fake links, extreme claims, missing docs.
6. Produce a neutral report with sources and limitations.
7. Recommend whether the Agent should continue, pause, or ask for human review.

Output Format:
* Token overview
* Verified sources
* Utility summary
* Risk flags
* Missing information
* Suggested next action
* Evidence links

Safety Boundary:
* Do not provide investment advice.
* Do not predict price.
* Do not promise rewards, yield, airdrops, or profit.
* Do not execute trades.
* Do not sign or broadcast transactions.
```

---

## Safety Hard Rules

All 31 cards are strictly restricted to:
- `canSign`: `false`
- `canBroadcast`: `false`
- `canTakeCustody`: `false`
- `canControlUserMainWallet`: `false`

The following high-risk skills explicitly require `requiresAdminReview: true`:
- Smart Contract Reader (`sd_onc_smart_contract_reader`)
- Onchain Risk Review (`sd_exp_onchain_intelligence`)
- Agent Service Procurement (`sd_biz_agent_service_procurement`)
- Token Analysis (`sd_onc_ton_chain_analyst`)
- Task Profit Analysis (`sd_biz_task_profit_analysis`)
- Risk & Fraud Detection (`sd_exp_chief_verification_officer`)

These limits are programmatically checked by the validation engine during build and test stages.
