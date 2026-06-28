---
skill_definition_id: sd_aut_tool_selection
canonical_code: skill_aut_tool_selection
runtime_version: 1
status: active
category: automation
tier: normal
max_loaded_per_task: 1
allowed_tools: ["web_search","web_browser"]
forbidden_actions: ["execute_unauthorized_tools"]
---

# Purpose
Analyze available tools and select optimal resources for a given task.

# Use When
* Executing complex tasks requiring external APIs, data sources, or operations.

# Do Not Use When
* Using pre-configured pipelines or single-step fixed paths.

# Required Inputs
* `objective`: Goal of the workflow.
* `toolsAvailable`: List of options.
* `constraints`: Hard constraints (cost, latency).

# Execution Procedure
1. Evaluate objective and resource requirements.
2. Analyze capabilities of each available tool.
3. Screen tools against constraints.
4. Prioritize tools based on efficiency.
5. Select the best execution pathway.

# Output Contract
The final output must be structured JSON containing:
* `selected_tool`: The chosen tool id.
* `rationale`: Why this tool is optimal.
* `alternative`: Fallback option.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not offer potential success, yield, or airdrops.
- Do not execute unauthorized tools.
- No wallet keys or seed phrase processing.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Identifies tool configuration requirements.
- Level 3: Recommends fallback tools for each step.
- Level 4: Performs efficiency score optimization.
- Level 5: Conducts security policy checks before tool use.
