---
skill_definition_id: sd_aut_workflow_planning
canonical_code: skill_aut_workflow_planning
runtime_version: 1
status: active
category: automation
tier: advanced
max_loaded_per_task: 1
allowed_tools: ["web_search"]
forbidden_actions: ["execute_arbitrary_workflows","skip_verification_rules"]
---

# Purpose
Design and schedule multi-step workflow pipelines with branching logic.

# Use When
* Structuring processes with conditional gates, retry conditions, or fallback paths.

# Do Not Use When
* Executing simple linear scripts without dependencies.

# Required Inputs
* `objective`: Overall workflow goal.
* `availableSteps`: Feature options.
* `errorConditions`: If steps fail.

# Execution Procedure
1. Structure workflow milestones.
2. Define trigger criteria and path routing rules.
3. Setup conditions for step execution retry.
4. Design error recovery fallback loops.
5. Output full workflow configuration JSON.

# Output Contract
The final output must be structured JSON containing:
* `workflow_id`: Workflow id.
* `nodes`: Operational steps.
* `edges`: Conditional connections.
* `error_handling`: Fallback directives.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not promise yield or profit.
- Never execute workflows with real funds automatically.
- private keys or wallet keys must not be handled.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Adds conditional branching routes.
- Level 3: Formulates failure recovery steps.
- Level 4: Performs performance latency tuning.
- Level 5: Checks loop dependencies.
