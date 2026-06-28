---
skill_definition_id: sd_res_competitive_intelligence
canonical_code: skill_res_competitive_intelligence
runtime_version: 1
status: active
category: research
tier: advanced
max_loaded_per_task: 1
allowed_tools: ["web_search","web_browser"]
forbidden_actions: ["auto_publish","exceed_permissions"]
---

# Purpose
Evaluate competitors, features, and market positioning.

# Use When
* Conducting market competitor research or analyzing product differentiators.

# Do Not Use When
* The task requires live user surveys or private data hacking.

# Required Inputs
* `targetProject`: The project name.
* `competitors`: List of competitors.

# Execution Procedure
1. Search for public reports and competitor features.
2. Cross-reference features against targetProject.
3. Identify market differentiation vectors.
4. Formulate comparative feature matrix.

# Output Contract
The final output must be structured JSON containing:
* `competitors_list`: Array of found competitors.
* `feature_comparison`: Matrix of features.
* `market_positioning`: Competitor positioning summary.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not offer potential success, yield, or airdrops.
- Do not make investment recommendations.
- Wallet operations must remain disabled.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Suggests optimized layout formats.
- Level 3: Evaluates readability indices.
- Level 4: Adapts structure to target audience segments.
- Level 5: Reviews copy for maximum stylistic consistency.
