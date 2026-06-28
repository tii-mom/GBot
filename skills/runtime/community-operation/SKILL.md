---
skill_definition_id: sd_soc_community_operation
canonical_code: skill_soc_community_operation
runtime_version: 1
status: active
category: social
tier: normal
max_loaded_per_task: 1
allowed_tools: ["web_search"]
forbidden_actions: ["execute_direct_admin_actions","delete_messages"]
---

# Purpose
Manage community channels and draft Telegram engagement plans.

# Use When
* Drafting messages, announcements, or tracking community engagement.

# Do Not Use When
* Moderating real-time channels or performing direct automated admin actions.

# Required Inputs
* `channelName`: Name of the channel.
* `campaignGoal`: Goals for engagement.

# Execution Procedure
1. Define target community goals and metrics.
2. Design message template drafts.
3. Plan community event topics.
4. Create response flow proposals.
5. Summarize proposed schedule of activities.

# Output Contract
The final output must be structured JSON containing:
* `event_proposals`: Suggested community event outlines.
* `message_drafts`: Draft copy for community updates.
* `metrics_proposed`: Targeted KPI list.

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
