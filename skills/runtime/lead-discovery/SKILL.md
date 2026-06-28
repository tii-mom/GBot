---
skill_definition_id: sd_soc_lead_discovery
canonical_code: skill_soc_lead_discovery
runtime_version: 1
status: active
category: social
tier: advanced
max_loaded_per_task: 1
allowed_tools: ["web_search","web_browser"]
forbidden_actions: ["scraping_private_pii"]
---

# Purpose
Search and discover profile structures, developer portfolios, and target audience segments.

# Use When
* Finding developers, potential integration partners, or community leaders for campaigns.

# Do Not Use When
* Interacting directly, messaging targets, or collecting secure personal info.

# Required Inputs
* `profileTarget`: Target criteria.
* `sourcesPreferred`: Github, Twitter, LinkedIn.

# Execution Procedure
1. Search for public profiles matching criteria.
2. Summarize experience, projects, or integration points.
3. Screen candidates for community size or repository stars.
4. Formulate organized list of discoverable leads.
5. Output profile list with public metrics.

# Output Contract
The final output must be structured JSON containing:
* `leads`: Array of profiles.
* `ranking`: Suitability scores.
* `notes`: Key integration arguments.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not promise rewards, drops, or returns.
- Keep data limited to public records.
- Wallet parameters remain disabled.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Categorizes leads by segment.
- Level 3: Scores alignment against objectives.
- Level 4: Traces developer active contributions.
- Level 5: Summarizes potential collaboration strategies.
