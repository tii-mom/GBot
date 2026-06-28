---
skill_definition_id: sd_exp_chief_verification_officer
canonical_code: skill_exp_chief_verification_officer
runtime_version: 1
status: active
category: verification
tier: expert
max_loaded_per_task: 1
allowed_tools: ["web_search","web_browser"]
forbidden_actions: ["blacklist_addresses","withhold_funds"]
---

# Purpose
Scan submissions, user links, and contract indicators for fraud signals, duplicate evidence, or Sybil patterns.

# Use When
* Auditing user task proofs, checking links for sybil indicators, or evaluating risk parameters.

# Do Not Use When
* Executing direct administrative user bans or modifying state databases.

# Required Inputs
* `submissionPayload`: Data submitted.
* `historicalLog`: Previous records for matching.

# Execution Procedure
1. Extract submission URLs and hashes.
2. Search public records for duplicate links or matching patterns.
3. Check domain age and WHOIS record details.
4. Analyze social accounts for sybil activity signals.
5. Compile fraud risk metrics.

# Output Contract
The final output must be structured JSON containing:
* `fraud_signals`: Identified risk indicators.
* `duplicate_found`: Boolean if matching item found.
* `risk_score`: Consolidated danger level.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not offer investment recommendations or price predictions.
- Enforce requiresAdminReview: true.
- No wallet keys or user balance modifications.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Conducts syntax and schema validation.
- Level 3: Cross-checks internal logic consistency.
- Level 4: Adds actionable, line-by-line revision steps.
- Level 5: Performs final verification of all links.
