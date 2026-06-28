---
skill_definition_id: sd_onc_smart_contract_reader
canonical_code: skill_onc_smart_contract_reader
runtime_version: 1
status: active
category: onchain
tier: advanced
max_loaded_per_task: 1
allowed_tools: ["web_search","web_browser"]
forbidden_actions: ["execute_calls","write_contract","sign_transactions","broadcast_transactions","take_custody_of_assets"]
---

# Purpose
Analyze and summarize smart contract source code, ABI interfaces, and function calls from a read-only perspective.

# Use When
* Reviewing smart contract methods, reading publicly verified code, or checking standard token contracts.

# Do Not Use When
* Required to interactively write to contracts, send transactions, or execute on-chain state changes.

# Required Inputs
* `contractAddress`: Target contract address.
* `abiJson` (optional): ABI details.

# Execution Procedure
1. Retrieve contract address and check compiler details.
2. Fetch verified source code from explorer or repository APIs.
3. Analyze constructor params, state variables, and read methods.
4. Map security configurations and ownership variables.
5. Summarize public interface structure.

# Output Contract
The final output must be structured JSON containing:
* `read_functions`: List of query methods.
* `write_functions`: List of transactional state-changing methods.
* `owner_address`: Contract owner or multisig controller.
* `security_flags`: Unlocked owner controls or upgrade patterns.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not offer potential success, yield, or airdrops.
- Main wallet seed phrases or private keys must never be accessed or processed.
- Enforce requiresAdminReview: true.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Parses functions and types.
- Level 3: Cross checks owner configurations.
- Level 4: Traces event emission logs.
- Level 5: Identifies critical modifiers and access control lists.
