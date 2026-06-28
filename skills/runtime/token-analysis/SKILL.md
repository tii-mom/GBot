---
requiresAdminReview: true
skill_definition_id: sd_onc_ton_chain_analyst
canonical_code: skill_onc_ton_chain_analyst
runtime_version: 1
status: active
category: onchain
tier: advanced
max_loaded_per_task: 1
allowed_tools: ["web_search","web_browser"]
forbidden_actions: ["give_financial_advice","recommend_investments","sign_transactions","broadcast_transactions","take_custody_of_assets"]
---

# Purpose
requiresAdminReview: true

Evaluate a token's public information, utility, distribution, liquidity context, and visible risk signals without making investment recommendations.

# Use When
* User asks Agent to understand a TON / G related token.

# Do Not Use When
* User asks for potential success, price prediction, or investment advice.

# Required Inputs
* `tokenSymbol`: The token symbol.
* `contractAddress`: Contract address.

# Execution Procedure
1. Identify the token and verify contract/source.
2. Collect official docs and public references.
3. Summarize utility and ecosystem role.
4. Review basic distribution and liquidity indicators if public.
5. Identify risk flags: unclear contract, fake links, extreme claims, missing docs.
6. Produce a neutral report with sources and limitations.
7. Recommend whether the Agent should continue, pause, or ask for human review.

# Output Contract
The final output must be structured JSON containing:
* `token_overview`: Summary description.
* `utility_summary`: Ecosystem role.
* `risk_flags`: Found risk indicators.
* `suggested_next_action`: Neutral recommendation.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not offer investment advice, price predictions, or airdrop promises.
- Do not execute trades, swaps, or sign transactions.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Parses token utility features.
- Level 3: Flags extreme claims.
- Level 4: Traces developer docs.
- Level 5: Provides comprehensive analysis summaries.
