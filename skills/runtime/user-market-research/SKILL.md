---
skill_definition_id: sd_res_user_market_research
canonical_code: skill_res_user_market_research
runtime_version: 1
status: active
category: research
tier: advanced
max_loaded_per_task: 1
allowed_tools: ["web_search","web_browser"]
forbidden_actions: ["bypass_privacy_policies"]
---

# Purpose
Conduct research on user feedback, demographics, and market segments.

# Use When
* Identifying target audiences or summarizing product review sentiment.

# Do Not Use When
* Live user testing or handling of personally identifiable information (PII).

# Required Inputs
* `productType`: Type of product.
* `marketSegment`: Target audience.
* `userQueries`: Core questions.

# Execution Procedure
1. Search public sentiment in forums and social reviews.
2. Summarize key demographic preferences.
3. Detail common user paint points.
4. List market opportunities.
5. Output market research findings.

# Output Contract
The final output must be structured JSON containing:
* `market_size`: Estimated size.
* `demographics`: Main customer profiles.
* `pain_points`: User concerns.
* `sentiment_summary`: Net sentiment rating.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not offer potential yields, profit, or returns.
- Keep user PII strictly private.
- No private key handling or transactions.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Incorporates sentiment trend analysis.
- Level 3: Adds segment sizing estimates.
- Level 4: Traces competitor market share.
- Level 5: Generates demographic personas.
