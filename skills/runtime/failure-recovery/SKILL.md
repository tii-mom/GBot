---
skill_definition_id: sd_exp_failure_recovery
canonical_code: skill_exp_failure_recovery
runtime_version: 1
status: active
category: automation
tier: expert
max_loaded_per_task: 1
allowed_tools: []
forbidden_actions: ["infinite_retry", "hide_failure", "expand_permissions", "auto_sign_transaction"]
---

# Purpose
To handle task step failures and execute recovery plans without compromising security boundaries.

# Use When
A step in the workflow fails or returns an error.

# Do Not Use When
The task is executing normally or during initial planning (use Task Decomposition instead).

# Required Inputs
* `failedStep`: Details of the step that failed.
* `errorMessage`: The error details or code.
* `context`: System state and constraints.

# Execution Procedure
1. Identify the type and root cause of the failure.
2. Determine if the error is temporary (retryable).
3. Attempt at most one retry with the exact same method.
4. If retry fails, switch to alternative sources, tools, or methods.
5. If alternatives fail, downgrade the output gracefully (e.g. partial results).
6. If the task cannot proceed safely, pause execution.
7. Return issues requiring user confirmation.

# Output Contract
The final output must be structured JSON containing:
* `failure_type`: Classified type of failure.
* `recovery_action`: Action taken (e.g. retry, alternative, downgrade, pause).
* `retry_attempted`: Boolean indicating if retry was executed.
* `status`: One of `recovered`, `degraded`, `paused`, `failed`.
* `user_action_required`: Prompt for user confirmation if paused.
* `notes`: Explanation of recovery steps.

# Verification Checklist
- Confirm no more than one identical retry was attempted.
- Ensure permissions or budgets were not expanded.
- Verify user action request is clear if paused.

# Failure Handling
If recovery actions fail or are unsafe, immediately pause and request user intervention.

# Safety Boundaries
- Never retry infinitely.
- Never hide or ignore failures.
- Do not expand permissions.
- Do not authorize payments or fees.
- Do not sign or transfer assets automatically.

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Adds failure classification diagnostics.
- Level 3: Implements backoff retry policies.
- Level 4: Formulates fallback method tree.
- Level 5: Performs security boundary check before recovery execution.
