---
skill_definition_id: sd_res_information_summary
canonical_code: skill_res_information_summary
runtime_version: 1
status: active
category: research
tier: normal
max_loaded_per_task: 1
allowed_tools: []
forbidden_actions: ["introduce_external_facts"]
---

# Purpose
To synthesize information from multiple sources into a single, cohesive, and actionable summary.

# Use When
Combining multiple research inputs, reports, or articles to support decision making.

# Do Not Use When
The input materials are insufficient or when external fact verification is the primary task.

# Required Inputs
* `materials`: Array of texts or links containing target information.
* `targetAudience`: The intended reader of the synthesized output.
* `decisionGoal`: The specific decision or action this synthesis aims to support.
* `outputLength`: Preferred length or constraint for the output.

# Execution Procedure
1. Deduplicate redundant data across all input materials.
2. Identify overlapping facts and themes.
3. Detect and mark any conflicting statements or contradictions.
4. Extract key findings and conclusions aligned with the decision goal.
5. Formulate actionable recommendations.
6. Strictly avoid introducing any external facts not supported by the input materials.

# Output Contract
The final output must be structured JSON containing:
* `summary`: A concise high-level synthesis of all materials.
* `key_findings`: List of critical findings backed by the inputs.
* `conflicts`: List of any contradictions found between sources.
* `decision_points`: Identified options or variables key to the decision.
* `recommended_actions`: Steps recommended based on the synthesis.

# Verification Checklist
- Confirm all points in `key_findings` can be traced back to the input materials.
- Ensure no external facts or assumptions are introduced.
- Verify conflicts are clearly marked.

# Failure Handling
If materials are missing or empty, abort execution. If materials are contradictory, highlight them in the `conflicts` field.

# Safety Boundaries
- Never introduce any information or facts that do not exist in the input materials.

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Adds a cross-referencing matrix for findings.
- Level 3: Formulates options analysis for each decision point.
- Level 4: Adds detailed risk assessment to recommendations.
- Level 5: Performs final self-check on external fact leaks.
