# Skill Catalog Mapping V1 (Legacy / Superseded)

> Status: legacy. Replaced by [GBot Canonical V1](./GBOT_CANONICAL_V1.md), [Skill Card System V1](./SKILL_CARD_SYSTEM_V1.md), and [Legacy Docs Archive Index](./LEGACY_DOCS_ARCHIVE_INDEX.md).

This document is preserved for historical reference only.

> **PR #7** — Canonical mapping of 31 formal skills to existing `agent_skill_definitions` and newly created incompatible definitions.  
> **Key constraint**: Treat the original `agent_skill_definitions` as frozen immutable history. Do NOT UPDATE original definition name or description. Use `skill_acquisition_rules` catalog fields to map public catalog display names, descriptions, and codes, fully preserving historical inventory and learned skill semantics.

---

## Catalog Mapping Table

The public catalog consists of exactly **31 Canonical Skills** (24 released + 7 advanced_unlock).
- **13 skills** are mapped to existing definitions (semantic match `exact` or `close`) as alias/direct reuse.
- **18 skills** are mapped to brand new definitions (`incompatible` with legacy definitions) to protect the semantic integrity of historical assets.

| # | Canonical Name | Canonical Code | Category | Tier | Existing ID | Existing Name | Existing Description | Existing Effect Type | Semantic Compatibility | Final Action |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Project Research | `skill_res_project_research` | research | normal | `sd_res_project_research` | Project Research | Improves project context gathering. | growth_propagation | **exact** | Reuse definition |
| 2 | Information Synthesis | `skill_res_information_summary` | research | normal | `sd_res_information_summary` | Information Summary | Concise summaries of research findings. | research | **close** | Display rename via Catalog |
| 3 | User & Market Research | `skill_res_user_market_research` | research | advanced | — | — | — | — | **incompatible** | Create new definition (`sd_res_user_market_research`) |
| 4 | Competitive Intelligence | `skill_res_competitive_intelligence` | research | advanced | `sd_res_competitive_intelligence` | Competitive Intelligence | Competitor activity analysis. | research | **exact** | Reuse definition |
| 5 | Deep Research | `skill_exp_deep_research` | research | expert | — | — | — | — | **incompatible** | Create new definition (`sd_exp_deep_research`) |
| 6 | Structured Writing | `skill_con_structured_writing` | content | normal | — | — | — | — | **incompatible** | Create new definition (`sd_con_structured_writing`) |
| 7 | Social Content | `skill_con_social_copywriter` | content | normal | `sd_con_social_copywriter` | Social Copywriter | Generates social copy for promotions. | content | **close** | Display rename via Catalog |
| 8 | Technical Documentation | `skill_con_technical_documentation` | content | advanced | — | — | — | — | **incompatible** | Create new definition (`sd_con_technical_documentation`) |
| 9 | Long-form Writing | `skill_con_long_form_writing` | content | advanced | — | — | — | — | **incompatible** | Create new definition (`sd_con_long_form_writing`) |
| 10 | Multilingual Adaptation | `skill_exp_multilingual_director` | content | expert | `sd_exp_multilingual_director` | Multilingual Campaign Director | Directs global multilingual campaigns. | content | **close** | Catalog Alias/Rename |
| 11 | Source Verification | `skill_ver_source_verification` | verification | normal | — | — | — | — | **incompatible** | Create new definition (`sd_ver_source_verification`) |
| 12 | Submission Review | `skill_ver_submission_checker` | verification | normal | `sd_ver_submission_checker` | Submission Checker | Verifies submission format compliance. | verification_reputation | **close** | Display rename via Catalog |
| 13 | Fact Checking | `skill_ver_advanced_verification` | verification | advanced | `sd_ver_advanced_verification` | Advanced Verification | Multi-rule verification checks. | verification_reputation | **close** | Display rename via Catalog |
| 14 | Risk & Fraud Detection | `skill_exp_chief_verification_officer` | verification | expert | `sd_exp_chief_verification_officer` | Chief Verification Officer | Enterprise-grade verification and audit. | verification_reputation | **close** | Catalog Alias/Rename |
| 15 | Transaction Reader | `skill_onc_transaction_reader` | onchain | normal | `sd_onc_transaction_reader` | Transaction Reader | Reads public transaction data. | trading_prep | **exact** | Reuse definition |
| 16 | Token Analysis | `skill_onc_ton_chain_analyst` | onchain | advanced | `sd_onc_ton_chain_analyst` | TON Chain Analyst | TON blockchain data analysis. | trading_prep | **close** | Display rename via Catalog |
| 17 | Smart Contract Reader | `skill_onc_smart_contract_reader` | onchain | advanced | `sd_onc_smart_contract_reader` | Smart Contract Reader | Reads and summarises contract calls. | trading_prep | **exact** | Reuse definition |
| 18 | Onchain Risk Review | `skill_exp_onchain_intelligence` | onchain | expert | `sd_exp_onchain_intelligence` | Onchain Intelligence Expert | Deep onchain data intelligence. | trading_prep | **close** | Display rename via Catalog |
| 19 | Community Operation | `skill_soc_community_operation` | social | normal | — | — | — | — | **incompatible** | Create new definition (`sd_soc_community_operation`) |
| 20 | Social Listening | `skill_soc_social_listening` | social | advanced | — | — | — | — | **incompatible** | Create new definition (`sd_soc_social_listening`) |
| 21 | Lead Discovery | `skill_soc_lead_discovery` | social | advanced | — | — | — | — | **incompatible** | Create new definition (`sd_soc_lead_discovery`) |
| 22 | Growth Campaign | `skill_exp_master_growth_strategist` | social | expert | `sd_exp_master_growth_strategist` | Master Growth Strategist | Orchestrates multi-channel growth strategies. | growth_propagation | **close** | Display rename via Catalog |
| 23 | Task Decomposition | `skill_aut_task_decomposition` | automation | normal | — | — | — | — | **incompatible** | Create new definition (`sd_aut_task_decomposition`) |
| 24 | Tool Selection | `skill_aut_tool_selection` | automation | normal | — | — | — | — | **incompatible** | Create new definition (`sd_aut_tool_selection`) |
| 25 | Progress Tracking | `skill_aut_progress_tracking` | automation | normal | — | — | — | — | **incompatible** | Create new definition (`sd_aut_progress_tracking`) |
| 26 | Workflow Planning | `skill_aut_workflow_planning` | automation | advanced | — | — | — | — | **incompatible** | Create new definition (`sd_aut_workflow_planning`) |
| 27 | Failure Recovery | `skill_exp_failure_recovery` | automation | expert | — | — | — | — | **incompatible** | Create new definition (`sd_exp_failure_recovery`) |
| 28 | Budget Management | `skill_biz_budget_management` | business | normal | — | — | — | — | **incompatible** | Create new definition (`sd_biz_budget_management`) |
| 29 | Task Profit Analysis | `skill_biz_task_profit_analysis` | business | advanced | — | — | — | — | **incompatible** | Create new definition (`sd_biz_task_profit_analysis`) |
| 30 | Client Delivery Management | `skill_biz_client_delivery_management` | business | advanced | — | — | — | — | **incompatible** | Create new definition (`sd_biz_client_delivery_management`) |
| 31 | Agent Service Procurement | `skill_biz_agent_service_procurement` | business | expert | — | — | — | — | **incompatible** | Create new definition (`sd_biz_agent_service_procurement`) |

---

## Definition Categorisation Summary

- **Total DB Definitions**: $44 \text{ (Original)} + 18 \text{ (New incompatible)} = 62$ definitions.
- **Core Excluded**: 4 core modules (`sd_core_*`), marked as `internal` (pools = 0).
- **Canonical Catalog**: 31 skills (24 released + 7 advanced_unlock).
- **Legacy Internal**: 27 definitions ($44 - 4 \text{ (core)} - 13 \text{ (reused)} = 27$ original definitions), marked as `internal` (pools = 0).

This guarantees that:
- Every definition has exactly one entry in the `skill_acquisition_rules` table.
- No historical inventories, learned skills, or event logs are modified or invalidated.
- All public catalog details are read from catalog columns in `skill_acquisition_rules`.
