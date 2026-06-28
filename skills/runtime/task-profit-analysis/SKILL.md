---
skill_definition_id: sd_biz_task_profit_analysis
canonical_code: skill_biz_task_profit_analysis
runtime_version: 1
status: active
category: business
tier: advanced
max_loaded_per_task: 1
allowed_tools: ["web_search"]
forbidden_actions: ["sign_transactions","guarantee_profit"]
---

# Purpose
Evaluate the cost structure and theoretical profit margins of tasks.

# Use When
* Assessing task rewards against network costs, API fees, and work effort.

# Do Not Use When
* User asks for potential success, returns, or investment advice.

# Required Inputs
* `rewardAmount`: Total reward offered (GP/USD).
* `estimatedCosts`: Cost parameters.
* `laborEstimate`: Time to complete.

# Execution Procedure
1. Retrieve reward parameters and identify currency.
2. Sum estimated network and resource fees.
3. Subtract costs from total rewards to find theoretical gross margin.
4. Compute return on effort indices.
5. Output neutral profit margin analysis.

# Output Contract
The final output must be structured JSON containing:
* `gross_margin`: Net reward estimate.
* `cost_ratio`: Costs relative to reward.
* `profitability_score`: Margin suitability rating.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not guarantee profit, potential yields, or returns.
- Enforce requiresAdminReview: true.
- Keep wallet permissions strictly disabled.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Identifies high cost variables.
- Level 3: Computes resource optimization profiles.
- Level 4: Models fee rate spikes.
- Level 5: Performs margin validation check.
