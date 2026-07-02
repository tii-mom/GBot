# GBot Bounty Autopilot Canonical V1

> Status: canonical product direction for the bounty autopilot phase.

GBot is an Agent Bounty Game & Execution Network. Users raise an Agent, equip skills, spend `G` as execution fuel, and dispatch the Agent to find, assess, execute, submit, and track bounty-style work across GBot-owned and external task sources.

The user experience is intentionally simple:

```text
Task map -> choose opportunity -> spend G -> dispatch Agent -> work package -> proof / report -> payout tracking
```

The system hides platform complexity behind a game-like cockpit. Users should not need to understand every task platform, escrow rule, GitHub issue workflow, wallet detail, or evidence format before they can operate their Agent.

## Product Positioning

GBot is not a default custodial bounty broker. The product model is:

- User Agent owns identity, wallet, payout destination, work history, and reputation.
- GBot provides runtime, strategy, skills, task abstraction, evidence packaging, and safety controls.
- `G` is Agent fuel. Agent actions consume fuel directly or consume AI Credits / token budget bought with `G`.
- External bounty payouts belong to the user and should settle to the user's wallet or platform account.
- GBot-owned internal bounties can use internal records, review queues, or escrow-like controls, but they must be clearly labeled as GBot internal rewards.

## Two Opportunity Sources

### External Source

External opportunities come from platforms such as OKX.AI, Algora / GitHub, Bountycaster, Zealy, Layer3, and similar task markets.

GBot may aggregate, normalize, score, plan, assist, and track these opportunities. GBot must not claim that it has accepted, submitted, or settled an external task unless that action has actually happened under the user's authorized account or wallet.

External payout model:

- `settlementTarget = user_wallet` or `user_platform_account`
- `payoutCustody = never_platform_custody`
- GBot records fuel usage, plan, evidence, and settlement tracking only.

### GBot Source

GBot internal opportunities are tasks published inside GBot's own task system.

GBot internal payout model:

- `settlementTarget = gbot_internal`
- `payoutCustody = gbot_escrow_for_internal_only`
- Internal review, budget, and audit logic can remain compatible with existing `bounty_tasks`.

## G Fuel Model

`G` is the commercial center of the product.

Agent actions can consume fuel for:

- task discovery
- task scoring
- risk review
- execution planning
- model / tool calls
- code or report generation
- proof packaging
- submission assistance
- settlement tracking

The user keeps external bounty payouts. GBot monetizes execution fuel, subscriptions, paid tools, or explicitly authorized service fees. It should not default to taking custody of external bounty funds.

## Bounty Capability Pack

Every Agent can be equipped with a bounty execution capability pack:

- Task Scout: discover and normalize opportunities.
- ROI Scorer: estimate reward, cost, time, and success probability.
- Policy Gate: block disallowed tasks and route ambiguous tasks to user confirmation.
- Bid / Apply Assistant: draft scope, bid, or acceptance steps where platform rules allow it.
- Executor: perform allowed low-risk work packages.
- QA Verifier: test, review, cite sources, and validate evidence.
- Submitter: prepare final materials for user or platform submission.
- Settlement Watcher: track review, payout, dispute, or retry states.
- Reputation Manager: maintain task history, acceptance rate, and quality signals.

## Automation Levels

Automation must be progressive:

1. `recommend_only`: Agent only recommends and explains opportunities.
2. `user_confirm`: Agent drafts the plan and waits for user approval before action.
3. `auto_execute`: Agent can execute low-risk, rule-compliant tasks within budget.
4. `blocked`: platform rules, risk policy, or missing authorization prevent automation.

High-risk tasks, unclear platform rules, account-sensitive actions, wallet-sensitive actions, or security testing require explicit user confirmation or must be blocked.

## Risk Boundaries

GBot must block or route to manual review:

- multi-account abuse
- fake proof or fabricated evidence
- KYC / sanction / access-control bypass
- market manipulation
- spam, engagement farming, or social deception
- unauthorized vulnerability scanning or exploitation
- malware, phishing, credential collection, or privacy abuse
- tasks that require GBot to store third-party account passwords
- professional financial, legal, or medical claims without appropriate controls

## UI Rules

Opportunity cards should show:

- task title
- source / platform
- reward display
- `G` fuel cost
- AI Credit / token estimate
- success probability
- risk level
- automation mode
- payout destination
- custody mode
- required skills
- evidence requirements

The main CTA can use direct game language such as "派 Agent 赚钱", but supporting copy must explain that results depend on task rules, user authorization, verification, and settlement tracking.

## Phase 1 Implementation Boundary

Phase 1 only creates product alignment and a visible local loop:

- canonical docs
- shared `BountyOpportunity` contract
- read-only `/opportunities` API
- Miniapp opportunity cards
- dispatch context passed into existing WorkRun flow
- neutral WorkRun report wording

Phase 1 does not implement live OKX.AI login, automatic external acceptance, external submission, real chain transactions, or payout custody.
