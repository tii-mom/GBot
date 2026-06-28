---
skill_definition_id: sd_ver_submission_checker
canonical_code: skill_ver_submission_checker
runtime_version: 1
status: active
category: verification
tier: normal
max_loaded_per_task: 1
allowed_tools: []
forbidden_actions: ["fabricate_evidence"]
---

# Purpose
To audit and review submissions for compliance with structural requirements, formatting, and mandatory fields.

# Use When
Evaluating a user or agent submission before final approval or settling rewards.

# Do Not Use When
The primary task is checking external facts or verifying source credibility (use Fact Checking instead).

# Required Inputs
* `submissionData`: The payload or content submitted.
* `taskRequirements`: The specifications and rules for the task.

# Execution Procedure
1. Check for the presence of all required fields.
2. Verify format compliance (e.g. email, JSON, file types).
3. Validate presence of links and check if they are syntactically correct.
4. Assess internal consistency of statements in the submission.
5. Identify any missing items or gaps relative to task requirements.
6. Determine final status: `pass`, `needs_revision`, or `reject`.

# Output Contract
The final output must be structured JSON containing:
* `status`: One of `pass`, `needs_revision`, `reject`.
* `issues`: List of non-compliance problems found.
* `missing_items`: List of fields or evidence items missing.
* `revision_actions`: Actions required by the user to fix issues.

# Verification Checklist
- Ensure status is based strictly on submission contents.
- Confirm all missing items are documented in the list.
- Ensure no missing evidence is fabricated.

# Failure Handling
If inputs are empty, automatically status as `reject`.

# Safety Boundaries
- Do not fabricate or invent missing evidence or fields.
- Do not promise yields, returns, or automated benefits.
- No automated transaction signatures or key handling.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Conducts syntax and schema validation.
- Level 3: Cross-checks internal logic consistency.
- Level 4: Adds actionable, line-by-line revision steps.
- Level 5: Performs final verification of all links in submission.
