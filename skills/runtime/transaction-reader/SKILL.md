---
skill_definition_id: sd_onc_transaction_reader
canonical_code: skill_onc_transaction_reader
runtime_version: 1
status: active
category: onchain
tier: normal
max_loaded_per_task: 1
allowed_tools: ["web_search","web_browser"]
forbidden_actions: ["sign_transactions","broadcast_transactions","custody_funds"]
---

# Purpose
Evaluate on-chain transaction status and details via explorers.

# Use When
* Analyzing transaction confirmations or looking up specific txids.

# Do Not Use When
* Required to execute swaps, transfer assets, or sign messages.

# Required Inputs
* `txHash`: The hash of the transaction.
* `network`: Target network (e.g. TON).

# Execution Procedure
1. Retrieve txHash and identify network.
2. Fetch transaction metadata from explorer endpoints.
3. Validate transaction status (success/failed).
4. Trace outputs and fee details.
5. Output structured transaction summary.

# Output Contract
The final output must be structured JSON containing:
* `status`: Success/Failed/Pending.
* `details`: Outputs, outputs_sum, fee details.
* `block_number`: Block number of transaction.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not offer potential success, yield, or airdrops.
- Do not store or request private keys or seed phrases.
- Do not control or interact with user wallets.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Adds multi-explorer cross check.
- Level 3: Evaluates contract call event logs.
- Level 4: Traces token transfers in tx output.
- Level 5: Identifies batch multi-transfer arrays.
