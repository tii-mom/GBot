---
skill_definition_id: sd_biz_budget_management
canonical_code: skill_biz_budget_management
runtime_version: 1
status: active
category: business
tier: normal
max_loaded_per_task: 1
allowed_tools: ["web_search"]
forbidden_actions: ["approve_spending","spend_funds_automatically"]
---

# Purpose
Track, budget, and report workflow cost allocations across USD and GP.

# Use When
* Executing complex tasks with multiple paid API calls or resource consumption.

# Do Not Use When
* No paid resources or transaction budgets are involved.

# Required Inputs
* `limits`: Budget limits (GP/USD).
* `spendingHistory`: List of spent funds.
* `estimatedSteps`: Anticipated steps.

# Execution Procedure
1. Retrieve budget limits and actual spending.
2. Analyze upcoming step cost requirements.
3. Check if potential costs exceed limits.
4. Recommend cost-saving alternatives.
5. Output current budget utilization status.

# Output Contract
The final output must be structured JSON containing:
* `budget_limit`: Original limits.
* `spent_amount`: Total actual spent.
* `remaining_budget`: Unspent balance.
* `alert_raised`: Boolean if budget exceeded.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not promise potential yields, returns, or profit.
- Never auto-approve or spend funds without user signature.
- Main wallet seed phrase or private keys must never be read.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Identifies high cost steps.
- Level 3: Computes resource usage analysis.
- Level 4: Performs cost optimization modeling.
- Level 5: Reviews spending constraints dynamically.
