---
skill_definition_id: sd_exp_deep_research
canonical_code: skill_exp_deep_research
runtime_version: 1
status: active
category: research
tier: expert
max_loaded_per_task: 1
allowed_tools: ["web_search","web_browser"]
forbidden_actions: ["execute_code","purchase_reports"]
---

# Purpose
Perform multi-source autonomous web research, verify contradictions, and output fully cited research dossiers.

# Use When
* Conducting in-depth evaluations of projects, protocols, or market dynamics.

# Do Not Use When
* Required to perform on-chain wallet evaluations or interact with live smart contracts.

# Required Inputs
* `queries`: Target research terms.
* `depthCriteria`: Depth specification.

# Execution Procedure
1. Decompose research topic into specific search queries.
2. Fetch public resources, documentation, and forum posts.
3. Compare claims and flag contradictory statements.
4. Synthesize verified data into structured research blocks.
5. Include full citation lists for all assertions.

# Output Contract
The final output must be structured JSON containing:
* `research_dossier`: Comprehensive structured overview.
* `citation_sources`: Full reference URLs.
* `contradictions_resolved`: Summarized contradictions.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not offer potential success, yield, or air-drops.
- No financial advice or token predictions.
- Keep wallet interactions strictly disabled.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Adds founder background checks.
- Level 3: Ensures all source links are verified.
- Level 4: Adds risk checklist validations.
- Level 5: Performs final self-consistency scans.
