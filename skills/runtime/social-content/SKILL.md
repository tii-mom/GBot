---
skill_definition_id: sd_con_social_copywriter
canonical_code: skill_con_social_copywriter
runtime_version: 1
status: active
category: content
tier: normal
max_loaded_per_task: 1
allowed_tools: []
forbidden_actions: ["auto_publish","exceed_permissions"]
---

# Purpose
Drafting high-engagement and context-appropriate social copy for normal audience reach on platforms like Telegram and X/Twitter.

# Use When
* Generating short promotional descriptions or thread drafts.

# Do Not Use When
* The task requires automated publishing, scheduling, or actual account logins.

# Required Inputs
* `topic`: Topic or theme of the social post.
* `platform`: Target social media channel (e.g., Telegram, X).
* `audience`: Target profile of the reader.
* `styleConstraints`: Specific tone limits or style directives.

# Execution Procedure
1. Verify inputs and style requirements.
2. Structure copy to fit platform length constraints (e.g. 280 characters for X).
3. Use engaging headers, concise bullet points, and appropriate tags.
4. Ensure text is clear and doesn't contain placeholders.
5. Provide a neutral review of the draft copy against constraints.

# Output Contract
The final output must be structured JSON containing:
* `platform_drafts`: Array of drafted posts with character counts.
* `tags_suggested`: Suggested hashtags or search terms.
* `internal_review`: Explanation of how post aligns with requested style.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not promise potential yields, yield rates, airdrops, or returns.
- Do not make investment recommendations or offer trading predictions.
- No automated transaction signatures or key handling.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Suggests optimized layout formats.
- Level 3: Evaluates readability indices.
- Level 4: Adapts structure to target audience segments.
- Level 5: Reviews copy for maximum stylistic consistency.
