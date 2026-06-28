---
skill_definition_id: sd_res_project_research
canonical_code: skill_res_project_research
runtime_version: 1
status: active
category: research
tier: normal
max_loaded_per_task: 1
allowed_tools: ["web_search", "web_browser"]
forbidden_actions: ["auto_onchain_trading", "fabricate_team_members", "fabricate_funding_info"]
---

# Purpose
To gather and analyze context about a specific project from online sources to build a robust profile.

# Use When
Conducting primary research on a crypto project, startup, protocol, or product.

# Do Not Use When
The project requires real-time transaction processing or execution of actions on-chain.

# Required Inputs
* `projectName`: The name of the project.
* `url`: The official URL of the project.
* `researchGoal`: Specific objectives of the research.
* `constraints` (optional): Any extra boundaries or formatting guidelines.

# Execution Procedure
1. Clarify the research goal and scope.
2. Search and collect official website, whitepaper, docs, product info, team background, business model, market data, and risk metrics.
3. Distinguish between verified facts, reasonable inferences, and unknowns.
4. Synthesize the findings into the requested output structure.
5. Provide reference sources and citations for all key conclusions.

# Output Contract
The final output must be structured JSON containing:
* `overview`: Brief summary of the project.
* `product`: Details of the product or protocol features.
* `team`: Information about founders and core team.
* `business_model`: Revenue streams and tokenomics (if any).
* `market`: Target audience, size, and competitor landscape.
* `risks`: Technological, regulatory, and financial risks.
* `unknowns`: Questions left unanswered due to lack of public data.
* `sources`: List of URLs cited.

# Verification Checklist
- Check if all required fields are populated.
- Verify that team members and funding info correspond to public records.
- Confirm all claims have corresponding URLs in sources.

# Failure Handling
If URL is inaccessible, try alternative search engine queries or search archives. Do not assume content is fake or generate placeholder info.

# Safety Boundaries
- Do not fabricate team members.
- Do not fabricate funding or financial info.
- Do not treat marketing hype as absolute facts.
- Do not attempt or trigger on-chain transactions.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Adds check step for founder background verification.
- Level 3: Ensures all source links are verified and active.
- Level 4: Adds risk checklist validation.
- Level 5: Performs final self-consistency scan.
