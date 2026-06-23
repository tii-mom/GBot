---
skill_definition_id: sd_ver_advanced_verification
canonical_code: skill_ver_advanced_verification
runtime_version: 1
status: active
category: verification
tier: advanced
max_loaded_per_task: 1
allowed_tools: ["web_search", "web_browser"]
forbidden_actions: ["proven_false_on_no_evidence"]
---

# Purpose
To assess the truthfulness of statements by mapping claims to supporting evidence or contradictions.

# Use When
Verifying factual statements within reports, proposals, or articles.

# Do Not Use When
The document format or submission fields are being reviewed (use Submission Review instead).

# Required Inputs
* `claims`: Array of statements to be checked.
* `supportingSources`: List of sources or search terms.
* `context` (optional): Extra background context.

# Execution Procedure
1. Break down the input into discrete, testable claims.
2. Cross-reference claims against the supporting sources.
3. Distinguish clearly between facts, opinions, predictions, and marketing/promotional text.
4. Classify each claim's status as: `supported`, `contradicted`, `insufficient_evidence`, or `not_verifiable`.
5. Compile the results without overstating conclusions.

# Output Contract
The final output must be structured JSON containing:
* `results`: Array of objects, each containing:
  - `claim`: The statement evaluated.
  - `status`: One of `supported`, `contradicted`, `insufficient_evidence`, `not_verifiable`.
  - `type`: One of `fact`, `opinion`, `prediction`, `marketing`.
  - `evidence`: Snippets or text backing the status.
  - `sources`: URLs used to verify.

# Verification Checklist
- Confirm each claim is mapped to at least one source.
- Check that opinions and marketing claims are not marked as absolute facts.
- Confirm "insufficient evidence" is not marked as "contradicted".

# Failure Handling
- If evidence is lacking, classify as `insufficient_evidence`. Never assert a claim is proven false just because evidence was not found.

# Safety Boundaries
- Do not declare a claim to be "proven false" if the correct status is "no evidence".

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Adds classification of claims by type (fact/opinion).
- Level 3: Cross-checks multiple search queries per claim.
- Level 4: Conducts contradiction search specifically looking for debunking sources.
- Level 5: Performs final review of confidence levels.
