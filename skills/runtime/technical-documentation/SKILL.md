---
skill_definition_id: sd_con_technical_documentation
canonical_code: skill_con_technical_documentation
runtime_version: 1
status: active
category: content
tier: advanced
max_loaded_per_task: 1
allowed_tools: ["web_search"]
forbidden_actions: ["execute_code"]
---

# Purpose
Write technical documentation, api specifications, and integration guides.

# Use When
* Drafting developer guides, specification documents, or api schemas.

# Do Not Use When
* Creating marketing articles, copy drafts, or high-level sales copy.

# Required Inputs
* `systemSpec`: Technical description of system.
* `targetDevelopers`: Audience level.
* `docFormat`: Output format (Markdown, JSON Schema).

# Execution Procedure
1. Analyze technical specifications and code definitions.
2. Outline api endpoints or system architecture.
3. Write descriptive explanations of parameters.
4. Draft complete coding examples.
5. Review schemas for format compliance.

# Output Contract
The final output must be structured JSON containing:
* `technical_content`: Full written documentation.
* `api_schema`: Schema drafts.
* `code_examples`: Complete blocks.

# Verification Checklist
- Confirm all required inputs are present.
- Ensure outputs match the JSON contract.

# Failure Handling
Fail execution if inputs are empty or malformed.

# Safety Boundaries
- Do not promise guaranteed returns or investment schemes.
- Do not include real credentials or keys in examples.
- No main wallet control or signatures.
- canSign: false
- canBroadcast: false
- canTakeCustody: false
- canControlUserMainWallet: false

# Level Effects
- Level 1: Basic execution procedure.
- Level 2: Validates schema formatting.
- Level 3: Generates REST/gRPC specifications.
- Level 4: Builds interactive setup checklists.
- Level 5: Reviews api request-response mappings.
