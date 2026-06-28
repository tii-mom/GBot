---
skill_definition_id: sd_exp_multilingual_director
canonical_code: skill_exp_multilingual_director
runtime_version: 1
status: active
category: content
tier: expert
max_loaded_per_task: 1
allowed_tools: ["web_search"]
forbidden_actions: ["auto_publish"]
---

# Purpose
Adapt campaign copy and reports to multiple languages while preserving style, tone, and localized terminology.

# Use When
* Localizing project briefs, translating community announcements, or reviewing multilingual materials.

# Do Not Use When
* Handling real-time dialogue translations or automated publishing.

# Required Inputs
* `sourceText`: The source content.
* `targetLanguages`: Array of languages.
* `styleDirectives`: Specific guidelines.

# Execution Procedure
1. Analyze source text core arguments and tone.
2. Translate and localize terminology per language.
3. Validate translated drafts for flow and stylistic alignment.
4. Cross-check for localization anomalies.
5. Output localized version array.

# Output Contract
The final output must be structured JSON containing:
* `translations`: Array of localized text outputs.
* `local_nuances`: Explained changes for terminology.
* `review_notes`: Quality check details.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not promise fixed yields, guaranteed payouts, or rewards.
- Keep all translations neutral and factual.
- No private key handling or main wallet controls.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Adds smooth localized transitions.
- Level 3: Formulates custom summaries.
- Level 4: Enhances formatting details.
- Level 5: Performs readability and style checks.
