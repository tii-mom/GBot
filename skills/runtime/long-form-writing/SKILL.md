---
skill_definition_id: sd_con_long_form_writing
canonical_code: skill_con_long_form_writing
runtime_version: 1
status: active
category: content
tier: advanced
max_loaded_per_task: 1
allowed_tools: ["web_search"]
forbidden_actions: ["hide_sources"]
---

# Purpose
Draft comprehensive articles, reports, or blog posts with citations.

# Use When
* Generating deep-dive writing requiring structured headers and paragraphs.

# Do Not Use When
* Writing short-form social copy or technical guide drafts.

# Required Inputs
* `topic`: Deep-dive topic.
* `wordLimit`: Range (e.g. 1000-1500 words).
* `outlines`: Specific sections to cover.

# Execution Procedure
1. Conduct research on target topic details.
2. Outline the document flow.
3. Write rich paragraphs with arguments.
4. Map claims to public sources.
5. Format with hierarchical headers.

# Output Contract
The final output must be structured JSON containing:
* `article_body`: Rich text content.
* `citations`: Reference list.
* `sections_written`: Section map.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not predict prices, market yields, or coin performance.
- Do not use promotional language promising profit.
- Keep wallet operations strictly disabled.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Adds smooth section transitions.
- Level 3: Builds custom introduction summaries.
- Level 4: Embeds highlighted checklists.
- Level 5: Performs editorial flow review.
