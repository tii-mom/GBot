# GBot Agent Simple Skills V1

> Status: design proposal for agent assembly and concise runtime prompts.

This document defines a simpler skill layer for GBot Agents. It keeps the current 31-card economy, but makes every skill easier for an Agent to select, mount, and execute.

## Design Goals

- One card should explain itself in 5 seconds.
- One task should load 1-3 skills, not a whole catalog.
- Every skill should have a clear job, input, output, and stop rule.
- Normal skills handle execution basics.
- Advanced skills improve quality and judgment.
- Expert skills handle strategy, risk, recovery, or orchestration.

## Agent Assembly Rules

Each Agent has 4 active skill slots:

1. **Work Skill**: the main task capability.
2. **Quality Skill**: checks facts, sources, or delivery quality.
3. **Flow Skill**: plans, tracks, or recovers the workflow.
4. **Growth Skill**: optional slot for social, business, or advanced upside.

Recommended loadout:

| Agent Type | Slot 1 | Slot 2 | Slot 3 | Slot 4 |
|---|---|---|---|---|
| Research Agent | Project Research | Source Verification | Information Synthesis | Deep Research |
| Content Agent | Structured Writing | Source Verification | Progress Tracking | Social Content |
| Bounty Agent | Task Decomposition | Submission Review | Progress Tracking | Task Profit Analysis |
| Growth Agent | Community Operation | Social Listening | Social Content | Growth Campaign |
| Onchain Analyst | Transaction Reader | Source Verification | Token Analysis | Onchain Risk Review |
| Client Agent | Client Delivery Management | Structured Writing | Budget Management | Agent Service Procurement |

## Simple Runtime Card Format

Each skill should be shown to the Agent in this compact format:

```text
Skill: <name>
Tier: normal | advanced | expert
Use For: <one-line job>
Needs: <required inputs>
Do: <3 short actions>
Output: <expected artifact>
Stop If: <hard boundary>
Level Bonus: <Lv.1-Lv.5 behavior>
```

## Level Model

All skills use the same five-level interpretation:

| Level | Meaning | Agent Behavior |
|---|---|---|
| Lv.1 | Execute | Follow the basic steps. |
| Lv.2 | Check | Add a simple quality or source check. |
| Lv.3 | Compare | Compare options, sources, or assumptions. |
| Lv.4 | Optimize | Improve structure, risk handling, and next steps. |
| Lv.5 | Lead | Produce a polished result with self-review and handoff notes. |

## Skill Set

### Research

#### Project Research
- Tier: Normal
- Use For: Build a basic profile of a project, product, protocol, or company.
- Needs: name, official link, research goal.
- Do: collect official facts; separate facts from unknowns; summarize risks.
- Output: project brief.
- Stop If: no verifiable source exists.

#### Information Synthesis
- Tier: Normal
- Use For: Turn scattered notes into a concise decision summary.
- Needs: source material, target audience, decision question.
- Do: group key points; remove duplicates; state conclusion and gaps.
- Output: synthesis brief.
- Stop If: inputs are too thin to support a conclusion.

#### User & Market Research
- Tier: Advanced
- Use For: Understand users, segments, demand, and market fit.
- Needs: product, target users, market question.
- Do: identify segments; compare pains and alternatives; find demand signals.
- Output: market insight brief.
- Stop If: the task asks for guaranteed market performance.

#### Competitive Intelligence
- Tier: Advanced
- Use For: Compare competitors and positioning.
- Needs: target project, competitors, comparison criteria.
- Do: map competitors; compare strengths and weaknesses; suggest positioning.
- Output: competitor map.
- Stop If: competitor data cannot be verified.

#### Deep Research
- Tier: Expert
- Use For: Produce a high-confidence multi-source research report.
- Needs: research question, scope, source rules, deadline.
- Do: gather multiple source types; cross-check claims; write limitations.
- Output: deep research report.
- Stop If: claims cannot be sourced.

### Content

#### Structured Writing
- Tier: Normal
- Use For: Create outlines, reports, summaries, and formatted deliverables.
- Needs: topic, audience, format, key points.
- Do: outline; draft; tighten language.
- Output: structured document.
- Stop If: required facts are missing.

#### Social Content
- Tier: Normal
- Use For: Draft short posts, replies, announcements, or campaign snippets.
- Needs: message goal, channel, tone, constraints.
- Do: draft variants; adapt to channel; keep call to action clear.
- Output: social copy set.
- Stop If: user asks for spam, impersonation, or fake engagement.

#### Technical Documentation
- Tier: Advanced
- Use For: Explain APIs, workflows, integrations, or product behavior.
- Needs: technical source, reader type, doc format.
- Do: define concepts; write steps; include examples and edge cases.
- Output: technical doc.
- Stop If: implementation details are unknown.

#### Long-form Writing
- Tier: Advanced
- Use For: Write articles, long reports, narratives, or thought pieces.
- Needs: thesis, audience, source notes, target length.
- Do: structure argument; develop sections; polish transitions.
- Output: long-form draft.
- Stop If: the draft depends on unsourced claims.

#### Multilingual Adaptation
- Tier: Expert
- Use For: Adapt content across language, region, and cultural context.
- Needs: source text, target language, audience, tone.
- Do: preserve intent; localize examples; check sensitive wording.
- Output: localized content.
- Stop If: legal, medical, or financial meaning could change.

### Verification

#### Source Verification
- Tier: Normal
- Use For: Check whether claims have reliable sources.
- Needs: claims, links, required confidence.
- Do: inspect sources; mark supported or unsupported; list gaps.
- Output: source check table.
- Stop If: sources are inaccessible or circular.

#### Submission Review
- Tier: Normal
- Use For: Check whether a task submission meets rules.
- Needs: submission, task rules, proof links.
- Do: compare against requirements; flag missing proof; suggest fixes.
- Output: review checklist.
- Stop If: rules are unavailable.

#### Fact Checking
- Tier: Advanced
- Use For: Verify factual claims against independent evidence.
- Needs: claim list, source policy, topic context.
- Do: test each claim; compare sources; rate confidence.
- Output: fact-check report.
- Stop If: evidence is contradictory and unresolved.

#### Risk & Fraud Detection
- Tier: Expert
- Use For: Detect fraud, manipulation, abuse, or high-risk claims.
- Needs: artifact, actors, transaction or campaign context.
- Do: identify signals; separate risk from proof; recommend review path.
- Output: risk memo.
- Stop If: task asks to accuse without evidence.

### Onchain

#### Transaction Reader
- Tier: Normal
- Use For: Explain public transaction data.
- Needs: chain, transaction hash, user question.
- Do: identify parties; explain actions; note unknowns.
- Output: transaction explanation.
- Stop If: transaction data is unavailable.

#### Token Analysis
- Tier: Advanced
- Use For: Analyze token utility, supply context, and visible risks.
- Needs: token, chain, contract, official links.
- Do: verify identity; summarize utility; flag risk indicators.
- Output: token analysis brief.
- Stop If: user asks for price prediction or investment advice.

#### Smart Contract Reader
- Tier: Advanced
- Use For: Explain contract interfaces and visible behavior.
- Needs: chain, contract address, ABI or source if available.
- Do: identify functions; explain permissions; flag dangerous patterns.
- Output: contract reading note.
- Stop If: task requires signing or broadcasting.

#### Onchain Risk Review
- Tier: Expert
- Use For: Review wallet, contract, or transaction risk signals.
- Needs: addresses, contracts, chain, risk question.
- Do: inspect public evidence; identify risk paths; recommend pause or review.
- Output: onchain risk memo.
- Stop If: evidence is insufficient for risk judgment.

### Social And Growth

#### Community Operation
- Tier: Normal
- Use For: Support community updates, FAQs, and moderation workflows.
- Needs: community goal, channel, rules, topic.
- Do: draft response; keep tone consistent; escalate sensitive issues.
- Output: community response pack.
- Stop If: user asks for harassment or fake moderation authority.

#### Social Listening
- Tier: Advanced
- Use For: Monitor social signals, sentiment, and recurring themes.
- Needs: topic, channels, time window, signal type.
- Do: collect samples; group themes; report trend and confidence.
- Output: listening brief.
- Stop If: sample size is too small.

#### Lead Discovery
- Tier: Advanced
- Use For: Find potential collaborators, customers, or task leads.
- Needs: target profile, market, exclusion rules.
- Do: define filters; collect candidates; score fit.
- Output: lead list.
- Stop If: task asks for private personal data.

#### Growth Campaign
- Tier: Expert
- Use For: Plan a measurable growth campaign.
- Needs: goal, audience, channel, budget, timeline.
- Do: define campaign angle; plan steps; set metrics and risks.
- Output: campaign plan.
- Stop If: growth method relies on spam or deception.

### Automation

#### Task Decomposition
- Tier: Normal
- Use For: Break a task into executable steps.
- Needs: task, deadline, constraints.
- Do: identify deliverables; split steps; mark dependencies.
- Output: task plan.
- Stop If: objective is unclear.

#### Tool Selection
- Tier: Normal
- Use For: Choose the right tool or execution route.
- Needs: task, available tools, risk level.
- Do: match tool to step; explain tradeoff; define fallback.
- Output: tool plan.
- Stop If: tool permissions are missing.

#### Progress Tracking
- Tier: Normal
- Use For: Track status, blockers, and next actions.
- Needs: task plan, current state, owner.
- Do: update status; list blockers; define next action.
- Output: progress note.
- Stop If: no current state is available.

#### Workflow Planning
- Tier: Advanced
- Use For: Design a multi-step workflow with checkpoints.
- Needs: goal, actors, tools, approval points.
- Do: map phases; add gates; define success criteria.
- Output: workflow plan.
- Stop If: workflow includes unauthorized action.

#### Failure Recovery
- Tier: Expert
- Use For: Recover from failed or blocked workflows.
- Needs: failure, logs, expected result, last good state.
- Do: diagnose cause; choose recovery path; prevent repeat failure.
- Output: recovery plan.
- Stop If: recovery would destroy user data or assets.

### Business And Collaboration

#### Budget Management
- Tier: Normal
- Use For: Track simple cost, budget, and spending limits.
- Needs: budget, costs, task goal.
- Do: calculate spend; compare limit; flag overrun.
- Output: budget note.
- Stop If: required prices are unknown.

#### Task Profit Analysis
- Tier: Advanced
- Use For: Estimate effort, cost, upside, and risk of a task.
- Needs: reward, cost, time, probability assumptions.
- Do: estimate net value; mark assumptions; recommend go, wait, or skip.
- Output: task ROI note.
- Stop If: user asks for guaranteed profit.

#### Client Delivery Management
- Tier: Advanced
- Use For: Manage deliverables, acceptance criteria, and handoff.
- Needs: client request, deliverables, due date, acceptance rules.
- Do: define scope; track deliverables; prepare handoff.
- Output: delivery checklist.
- Stop If: scope is not agreed.

#### Agent Service Procurement
- Tier: Expert
- Use For: Source and coordinate external services under policy and budget.
- Needs: service need, budget, criteria, approval rule.
- Do: compare options; assess risk; prepare approval request.
- Output: procurement memo.
- Stop If: purchase or commitment lacks approval.

## Assembly Recipes

### Starter Work Agent
- Task Decomposition
- Project Research
- Structured Writing
- Progress Tracking

Use this for basic bounty and research tasks.

### Quality Research Agent
- Project Research
- Source Verification
- Information Synthesis
- Fact Checking

Use this when accuracy matters more than speed.

### Growth Operator Agent
- Social Listening
- Social Content
- Community Operation
- Growth Campaign

Use this for community and campaign work.

### Onchain Safety Agent
- Transaction Reader
- Token Analysis
- Smart Contract Reader
- Onchain Risk Review

Use this for read-only chain analysis. Never signs or broadcasts.

### Delivery Agent
- Client Delivery Management
- Structured Writing
- Budget Management
- Submission Review

Use this for client-style task delivery and acceptance.

## Global Safety Boundary

All skills remain read-only and advisory by default:

- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false
- no investment advice
- no guaranteed profit claims
- no fabricated sources
- no private personal data collection

