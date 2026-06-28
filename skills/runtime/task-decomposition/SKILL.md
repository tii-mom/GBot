---
skill_definition_id: sd_aut_task_decomposition
canonical_code: skill_aut_task_decomposition
runtime_version: 1
status: active
category: automation
tier: normal
max_loaded_per_task: 1
allowed_tools: ["task_planner"]
forbidden_actions: ["auto_approve_funding", "execute_high_risk_actions", "exceed_permissions"]
---

# Purpose
To break down complex objectives into structured, ordered, and executable sub-tasks.

# Use When
Planning a multi-step workflow or task execution path.

# Do Not Use When
The workflow is a simple single-step action or requires real-time reactive recovery (use Failure Recovery instead).

# Required Inputs
* `objective`: The primary goal to achieve.
* `constraints`: Limits and rules governing the execution.
* `deadline`: Time limits for the task.
* `tools`: Allowed tools.
* `budget`: Budget limits (GP or usd).

# Execution Procedure
1. Analyze the main objective and identify constraints.
2. Outline the necessary milestones and step dependencies.
3. For each step, define clear inputs, expected output, and verification check.
4. Assess risks for each individual step.
5. Order steps sequentially based on dependencies.
6. Strictly avoid creating redundant or unnecessary steps.

# Output Contract
The final output must be structured JSON containing:
* `steps`: Array of sub-task components.
* `milestones`: Target validation milestones.
* `risk_mitigation`: Mitigation strategies.

# Verification Checklist
- Confirm all steps are necessary to reach the objective.
- Verify no step violates budget or deadline constraints.
- Confirm dependency order is correct.

# Failure Handling
If constraints cannot be met within the budget/deadline, fail early with detailed explanation.

# Safety Boundaries
- Do not create unnecessary steps.
- Do not exceed user permissions.
- Do not auto-approve funds or budget spending.
- Do not execute high-risk operations automatically.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Identifies critical path steps.
- Level 3: Adds risk mitigation plans for high-risk steps.
- Level 4: Conducts resource constraint optimization.
- Level 5: Performs dependency loop check.
