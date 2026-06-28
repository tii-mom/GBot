---
skill_definition_id: sd_exp_master_growth_strategist
canonical_code: skill_exp_master_growth_strategist
runtime_version: 1
status: active
category: social
tier: expert
max_loaded_per_task: 1
allowed_tools: ["web_search"]
forbidden_actions: ["run_unauthorized_campaigns"]
---

# Purpose
Coordinate multi-channel growth campaigns and construct structured promotion proposals.

# Use When
* Planning cross-channel community growth steps or drafting promotion briefs.

# Do Not Use When
* Publishing live posts or distributing automated rewards.

# Required Inputs
* `campaignObjective`: Main growth goals.
* `channelsAllowed`: Platforms included.
* `timeframes`: Schedules.

# Execution Procedure
1. Identify target audience profiles.
2. Design cross-channel promotional schedule outlines.
3. Draft community engagement message proposals.
4. Formulate referral and growth metrics.
5. Output consolidated campaign roadmap.

# Output Contract
The final output must be structured JSON containing:
* `roadmap`: Visual schedule representation.
* `channels_mapped`: Channel allocations.
* `content_templates`: Draft templates.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not promise potential yields, airdrops, or rewards.
- No financial advisor claims or investment recommendations.
- keeps wallet transactions disabled.
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
