---
skill_definition_id: sd_aut_progress_tracking
canonical_code: skill_aut_progress_tracking
runtime_version: 1
status: active
category: automation
tier: normal
max_loaded_per_task: 1
allowed_tools: ["web_search"]
forbidden_actions: ["modify_states_without_permission"]
---

# Purpose
Monitor execution steps, log state changes, and report progress milestones.

# Use When
* Running multi-step tasks with long durations or sequential operations.

# Do Not Use When
* Task is a single atomic command.

# Required Inputs
* `stepsList`: Array of planned steps.
* `statusLog`: Execution log.
* `milestones`: Goals to check.

# Execution Procedure
1. Load the execution plan and goals.
2. Review status logs and identify current step.
3. Validate completed steps against criteria.
4. Highlight issues or execution delays.
5. Synthesize clean progress status summary.

# Output Contract
The final output must be structured JSON containing:
* `current_step`: Current active step.
* `completed_steps`: List of verified items.
* `remaining_steps`: Steps to execute.
* `status`: active, delayed, or stuck.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not promise potential returns or guaranteed rewards.
- Do not bypass verification checks.
- Keep wallet keys and main wallet interactions strictly disabled.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Adds step duration logs.
- Level 3: Computes eta metrics based on history.
- Level 4: Traces dependency updates.
- Level 5: Generates execution reports.
