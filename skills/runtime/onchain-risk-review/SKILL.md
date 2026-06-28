---
skill_definition_id: sd_exp_onchain_intelligence
canonical_code: skill_exp_onchain_intelligence
runtime_version: 1
status: active
category: onchain
tier: expert
max_loaded_per_task: 1
allowed_tools: ["web_search","web_browser"]
forbidden_actions: ["execute_blocking_rules","blacklist_wallets","sign_transactions","broadcast_transactions","take_custody_of_assets"]
---

# Purpose
Evaluate on-chain activity, suspicious transfers, and contract modifiers to flag risk parameters before execution.

# Use When
* Auditing contract history, reviewing transaction profiles, or assessing system dangers.

# Do Not Use When
* Taking custody of user coins, signing transfers, or modifying wallet keys.

# Required Inputs
* `contractAddress`: Target contract.
* `recentTransactions`: Activity array.

# Execution Procedure
1. Inspect compiler version and verified contract source.
2. Query explorer APIs for token transfers and recent transactions.
3. Search public databases for reported scams or honeypots.
4. Review access control configurations (multisigs, time-locks).
5. Synthesize neutral risk report.

# Output Contract
The final output must be structured JSON containing:
* `risk_flags`: Array of warning items.
* `honeypot_test`: Result details.
* `ownership_status`: Details of ownership configurations.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not offer potential success, returns, or yields.
- Main wallet private keys or seed phrases must never be processed.
- Enforce requiresAdminReview: true.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Adds classification of claims by type.
- Level 3: Cross-checks multiple search queries.
- Level 4: Conducts contradiction searches.
- Level 5: Performs final reviews of confidence levels.
