---
skill_definition_id: sd_soc_social_listening
canonical_code: skill_soc_social_listening
runtime_version: 1
status: active
category: social
tier: advanced
max_loaded_per_task: 1
allowed_tools: ["web_search","web_browser"]
forbidden_actions: ["bypass_rate_limits","publish_content"]
---

# Purpose
Monitor social media keywords, developer channel activity, and community sentiment trends.

# Use When
* Scanning public discussions for viral content keywords or developer feedback.

# Do Not Use When
* Writing or publishing content updates, replying to threads, or executing posts.

# Required Inputs
* `keywords`: Search terms.
* `channels`: Target platforms (Twitter, Telegram).

# Execution Procedure
1. Format query parameters for target keywords.
2. Fetch public platform query results.
3. Summarize volume and sentiment trends.
4. Pinpoint high-impact discussions or viral updates.
5. Output concise trend summary.

# Output Contract
The final output must be structured JSON containing:
* `keywords_tracked`: Checked keyword list.
* `volume_metrics`: Daily/hourly mention volume estimation.
* `hot_threads`: Key thread links.
* `sentiment`: Overall mood (positive/neutral/negative).

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not claim or promise guaranteed tokens, rewards, or profit.
- Follow rate limits and platform guidelines.
- No wallet keys or user balance checks.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Performs keyword mapping checks.
- Level 3: Evaluates sentiment distribution charts.
- Level 4: Adds historical benchmark comparisons.
- Level 5: Summarizes viral trend velocity indicators.
