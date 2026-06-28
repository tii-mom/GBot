---
skill_definition_id: sd_biz_client_delivery_management
canonical_code: skill_biz_client_delivery_management
runtime_version: 1
status: active
category: business
tier: advanced
max_loaded_per_task: 1
allowed_tools: ["web_search"]
forbidden_actions: ["auto_release_payment"]
---

# Purpose
Manage client deliverables, milestones, verification criteria, and quality checks.

# Use When
* Preparing task submissions or tracking client acceptance guidelines.

# Do Not Use When
* Signing settlement contracts or releasing funds automatically.

# Required Inputs
* `deliverables`: Items to submit.
* `qualityStandard`: Validation checklist.
* `milestoneDates`: Delivery schedules.

# Execution Procedure
1. Load deliverable lists and specs.
2. Check completeness of output against quality standards.
3. Audit link structure and report parameters.
4. Compile delivery package files.
5. Draft delivery transmittal note.

# Output Contract
The final output must be structured JSON containing:
* `quality_status`: Pass/Fail rating.
* `issues_identified`: Found discrepancies.
* `transmittal_details`: Packages compiled.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not promise potential yields or reward payouts.
- Keep delivery checks aligned to rules.
- No wallet keys or main wallet interactions.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Highlights critical milestones.
- Level 3: Suggests quality improvement steps.
- Level 4: Conducts client criteria checks.
- Level 5: Reviews compliance before transmittal.
