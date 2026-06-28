---
skill_definition_id: sd_biz_agent_service_procurement
canonical_code: skill_biz_agent_service_procurement
runtime_version: 1
status: active
category: business
tier: expert
max_loaded_per_task: 1
allowed_tools: ["web_search"]
forbidden_actions: ["sign_contracts","settle_payments","sign_transactions","broadcast_transactions","take_custody_of_assets"]
---

# Purpose
Evaluate, compare, and coordinate procurement specifications for agent-to-agent services.

# Use When
* Formulating agent delegation plans or checking service quality schemas.

# Do Not Use When
* Releasing funds automatically, signing legal contracts, or handling wallet keys.

# Required Inputs
* `serviceRequirement`: Description of work needed.
* `providerList`: Profiles of candidate agents.
* `budgetGP`: Maximum budget allocated.

# Execution Procedure
1. Load service requirements and provider specifications.
2. Review candidate agents capabilities against requirements.
3. Compare candidate fee structures and latency metrics.
4. Check proposed contracts for compliance with limits.
5. Output procurement coordination report.

# Output Contract
The final output must be structured JSON containing:
* `selected_provider`: Chosen agent details.
* `fee_comparison`: Cost structure comparisons.
* `compliance_score`: Suitability rating.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not promise potential yields or reward payouts.
- Enforce requiresAdminReview: true.
- No wallet keys or main wallet interactions.
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
