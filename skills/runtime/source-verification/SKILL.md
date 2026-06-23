---
skill_definition_id: sd_ver_source_verification
canonical_code: skill_ver_source_verification
runtime_version: 1
status: active
category: verification
tier: normal
max_loaded_per_task: 1
allowed_tools: ["web_search", "web_browser"]
forbidden_actions: ["assert_false_on_inaccessible"]
---

# Purpose
To evaluate individual sources for credibility, originality, and support for specific claims.

# Use When
Reviewing references, links, and documents cited to support statements or research findings.

# Do Not Use When
The overall logical consistency or fact checking across multiple sources is required.

# Required Inputs
* `sourceUrl`: The URL of the source to verify.
* `associatedClaim`: The claim or statement that the source is supposed to back up.

# Execution Procedure
1. Check if the source exists and is accessible.
2. Determine if the source is the original creator of the information or a secondary reporting outlet.
3. Record the publishing date and the identity of the publisher or author.
4. Compare the source content with the associated claim to verify if it supports it.
5. Identify any secondary summary distortion or misrepresentations.
6. Compile findings into a structured verification report.

# Output Contract
The final output must be structured JSON containing:
* `source`: The URL evaluated.
* `accessible`: Boolean indicating whether the source could be loaded.
* `source_type`: Type of content (e.g. blog, whitepaper, news, official_docs).
* `original_or_secondary`: Identifies if the source is original or secondary.
* `supports_claim`: Boolean indicating if the claim is supported.
* `confidence`: Rating of the source credibility (low, medium, high).
* `notes`: Detailed observations.

# Verification Checklist
- Check if access status is correct.
- Verify publisher information is accurate.
- Double-check logical mapping between the source text and the claim.

# Failure Handling
- If page is inaccessible, note it as `accessible: false` with low confidence. Do not assert the claim is fake or false solely based on this.

# Safety Boundaries
- Never assume an inaccessible page means the claim is false.

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Investigates domain reputation and WHOIS age.
- Level 3: Cross-checks metadata and publisher bias.
- Level 4: Adds verification of secondary quote accuracy.
- Level 5: Conducts cryptographic or archive.org historical lookup.
