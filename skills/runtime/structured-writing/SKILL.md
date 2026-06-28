---
skill_definition_id: sd_con_structured_writing
canonical_code: skill_con_structured_writing
runtime_version: 1
status: active
category: content
tier: normal
max_loaded_per_task: 1
allowed_tools: []
forbidden_actions: ["perform_fact_checking"]
---

# Purpose
To write structured, clear, and professional text based on a specified topic and format.

# Use When
Drafting a structured brief, report, specification, checklist, or proposal.

# Do Not Use When
The primary task is checking facts or verifying source documents (this skill focuses on structure and writing, not verification).

# Required Inputs
* `topic`: The core subject matter.
* `audience`: The target demographic or profile of the reader.
* `format`: The type of document (must be one of: `brief`, `report`, `specification`, `checklist`, `proposal`).
* `tone`: Desired voice and style (e.g. professional, concise).
* `requiredSections`: List of headings or areas that must be covered.

# Execution Procedure
1. Create a logical outline of the document.
2. Structure the content hierarchically using appropriate heading levels.
3. Keep the text concise and eliminate repetitive phrases or ideas.
4. Mark any placeholder information or facts needing confirmation with a clear warning or tag.
5. Generate the complete formatted document following the requested structure.

# Output Contract
The final output must be structured JSON containing:
* `title`: Document title.
* `outline`: The hierarchy structure of the document.
* `sections`: Array of objects with section headers and text content.
* `unverified_facts`: List of statements requiring fact-checking or verification.
* `formatted_content`: Full text output.

# Verification Checklist
- Confirm all required sections are present.
- Verify that formatting matches one of the supported formats.
- Ensure any unverified statements are explicitly flagged.

# Failure Handling
If required inputs are incomplete, halt generation.

# Safety Boundaries
- Do not make final claims without flagging unverified statements.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Adds transition phrases and style polish.
- Level 3: Formulates custom introduction and summary sections.
- Level 4: Enhances formatting with checklists and inline highlights.
- Level 5: Performs readability and flow review.
