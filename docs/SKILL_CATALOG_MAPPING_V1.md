# Skill Catalog Mapping V1

> **PR #7** — Canonical mapping of 31 formal skills to existing `agent_skill_definitions` rows.  
> Rules: prefer reuse, no ID changes, no deletion, display renames allowed, no Skill Card invalidation.

---

## Mapping Table

| # | Canonical Name | Canonical Code | Category | Tier | Existing Code | Existing ID | Action | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | Project Research | skill_res_project_research | research | normal | skill_res_project_research | sd_res_project_research | **reuse** | Exact match |
| 2 | Information Synthesis | skill_res_information_summary | research | normal | skill_res_information_summary | sd_res_information_summary | **reuse + rename** | Display name: "Information Synthesis" (was "Information Summary") |
| 3 | User & Market Research | skill_res_user_market_research | research | advanced | — | — | **NEW** | Created in migration 0013 |
| 4 | Competitive Intelligence | skill_res_competitive_intelligence | research | advanced | skill_res_competitive_intelligence | sd_res_competitive_intelligence | **reuse** | Exact match |
| 5 | Deep Research | skill_exp_deep_research | research | expert | — | — | **NEW** | Created in migration 0013; existing `sd_res_deep_research` is advanced-tier internal |
| 6 | Structured Writing | skill_con_structured_writing | content | normal | — | — | **NEW** | Created in migration 0013 |
| 7 | Social Content | skill_con_social_copywriter | content | normal | skill_con_social_copywriter | sd_con_social_copywriter | **reuse + rename** | Display name: "Social Content" (was "Social Copywriter") |
| 8 | Technical Documentation | skill_con_technical_documentation | content | advanced | — | — | **NEW** | Created in migration 0013 |
| 9 | Long-form Writing | skill_con_content_strategist | content | advanced | skill_con_content_strategist | sd_con_content_strategist | **reuse + rename** | Display name: "Long-form Writing" (was "Content Strategist") |
| 10 | Multilingual Adaptation | skill_exp_multilingual_director | content | expert | skill_exp_multilingual_director | sd_exp_multilingual_director | **reuse + rename** | Display name: "Multilingual Adaptation" (was "Multilingual Campaign Director") |
| 11 | Source Verification | skill_ver_evidence_organizer | verification | normal | skill_ver_evidence_organizer | sd_ver_evidence_organizer | **reuse + rename** | Display name: "Source Verification" (was "Evidence Organizer") |
| 12 | Submission Review | skill_ver_submission_checker | verification | normal | skill_ver_submission_checker | sd_ver_submission_checker | **reuse + rename** | Display name: "Submission Review" (was "Submission Checker") |
| 13 | Fact Checking | skill_ver_advanced_verification | verification | advanced | skill_ver_advanced_verification | sd_ver_advanced_verification | **reuse + rename** | Display name: "Fact Checking" (was "Advanced Verification") |
| 14 | Risk & Fraud Detection | skill_exp_chief_verification_officer | verification | expert | skill_exp_chief_verification_officer | sd_exp_chief_verification_officer | **reuse + rename** | Display name: "Risk & Fraud Detection" (was "Chief Verification Officer") |
| 15 | Transaction Reader | skill_onc_transaction_reader | onchain | normal | skill_onc_transaction_reader | sd_onc_transaction_reader | **reuse** | Exact match |
| 16 | Token Analysis | skill_onc_ton_chain_analyst | onchain | advanced | skill_onc_ton_chain_analyst | sd_onc_ton_chain_analyst | **reuse + rename** | Display name: "Token Analysis" (was "TON Chain Analyst") |
| 17 | Smart Contract Reader | skill_onc_smart_contract_reader | onchain | advanced | skill_onc_smart_contract_reader | sd_onc_smart_contract_reader | **reuse** | Exact match |
| 18 | Onchain Risk Review | skill_exp_onchain_intelligence | onchain | expert | skill_exp_onchain_intelligence | sd_exp_onchain_intelligence | **reuse + rename** | Display name: "Onchain Risk Review" (was "Onchain Intelligence Expert") |
| 19 | Community Operation | skill_soc_telegram_promoter | social | normal | skill_soc_telegram_promoter | sd_soc_telegram_promoter | **reuse + rename** | Display name: "Community Operation" (was "Telegram Promoter") |
| 20 | Social Listening | skill_soc_viral_pattern_analysis | social | advanced | skill_soc_viral_pattern_analysis | sd_soc_viral_pattern_analysis | **reuse + rename** | Display name: "Social Listening" (was "Viral Pattern Analysis") |
| 21 | Lead Discovery | skill_soc_audience_targeting | social | advanced | skill_soc_audience_targeting | sd_soc_audience_targeting | **reuse + rename** | Display name: "Lead Discovery" (was "Audience Targeting") |
| 22 | Growth Campaign | skill_exp_master_growth_strategist | social | expert | skill_exp_master_growth_strategist | sd_exp_master_growth_strategist | **reuse + rename** | Display name: "Growth Campaign" (was "Master Growth Strategist") |
| 23 | Task Decomposition | skill_aut_task_decomposition | automation | normal | — | — | **NEW** | Created in migration 0013 |
| 24 | Tool Selection | skill_aut_tool_selection | automation | normal | — | — | **NEW** | Created in migration 0013 |
| 25 | Progress Tracking | skill_aut_progress_tracking | automation | normal | — | — | **NEW** | Created in migration 0013 |
| 26 | Workflow Planning | skill_aut_workflow_planning | automation | advanced | — | — | **NEW** | Created in migration 0013 |
| 27 | Failure Recovery | skill_exp_task_orchestration | automation | expert | skill_exp_task_orchestration | sd_exp_task_orchestration | **reuse + rename** | Display name: "Failure Recovery" (was "Task Orchestration Expert") |
| 28 | Budget Management | skill_biz_budget_management | business | normal | — | — | **NEW** | Created in migration 0013 |
| 29 | Task Profit Analysis | skill_biz_task_profit_analysis | business | advanced | — | — | **NEW** | Created in migration 0013 |
| 30 | Client Delivery Management | skill_biz_client_delivery_management | business | advanced | — | — | **NEW** | Created in migration 0013 |
| 31 | Agent Service Procurement | skill_biz_agent_service_procurement | business | expert | — | — | **NEW** | Created in migration 0013 |

---

## Category Strategy

The existing `agent_skill_definitions.category` CHECK allows only:
`research`, `content`, `social`, `verification`, `onchain`

The canonical catalog introduces two new product categories: `automation` and `business`.

**Decision: Backup Alternative** — Add `catalog_category` column to `skill_acquisition_rules`.  
This avoids rebuilding the `agent_skill_definitions` table and breaking any existing foreign keys.

The 7 product categories are exposed via the `catalog_category` field in `skill_acquisition_rules`:
`research`, `content`, `verification`, `onchain`, `social`, `automation`, `business`

All new `automation` and `business` skill definitions store `category = 'research'` in the definition table (closest semantic fit) while `catalog_category` in acquisition rules stores the correct product category.

---

## New Definitions Created (12)

| New ID | Canonical Name | DB Category | Catalog Category | Tier |
|---|---|---|---|---|
| sd_res_user_market_research | User & Market Research | research | research | advanced |
| sd_exp_deep_research | Deep Research | research | research | expert |
| sd_con_structured_writing | Structured Writing | content | content | normal |
| sd_con_technical_documentation | Technical Documentation | content | content | advanced |
| sd_aut_task_decomposition | Task Decomposition | research | automation | normal |
| sd_aut_tool_selection | Tool Selection | research | automation | normal |
| sd_aut_progress_tracking | Progress Tracking | research | automation | normal |
| sd_aut_workflow_planning | Workflow Planning | research | automation | advanced |
| sd_biz_budget_management | Budget Management | research | business | normal |
| sd_biz_task_profit_analysis | Task Profit Analysis | research | business | advanced |
| sd_biz_client_delivery_management | Client Delivery Management | research | business | advanced |
| sd_biz_agent_service_procurement | Agent Service Procurement | research | business | expert |

---

## Internal Legacy Skills (21)

Retained in DB, not in any acquisition pool, existing user assets unaffected.

| ID | Original Name | Tier | Reason Internal |
|---|---|---|---|
| sd_res_opportunity_scanner | Opportunity Scanner | normal | Not in formal catalog |
| sd_res_deep_research | Deep Research (Advanced) | advanced | Superseded by expert sd_exp_deep_research |
| sd_res_high_yield_scanner | High-Yield Scanner | advanced | Not in formal catalog |
| sd_con_translation | Translation | normal | Superseded by Multilingual Adaptation |
| sd_con_short_form_writer | Short-form Writer | normal | Overlaps Social Content |
| sd_con_growth_copywriter | Growth Copywriter | advanced | Not in formal catalog |
| sd_con_multilingual_campaign | Multilingual Campaign | advanced | Superseded by Multilingual Adaptation (expert) |
| sd_soc_x_engagement | X Engagement | normal | Not in formal catalog |
| sd_soc_community_observer | Community Observer | normal | Superseded by Community Operation |
| sd_soc_community_growth | Community Growth | advanced | Superseded by Growth Campaign (expert) |
| sd_ver_risk_analyzer | Risk Analyzer | advanced | Superseded by Fact Checking + Risk & Fraud Detection |
| sd_ver_fraud_signal_detection | Fraud Signal Detection | advanced | Superseded by Risk & Fraud Detection |
| sd_ver_basic_risk_check | Basic Risk Check | normal | Not in formal catalog |
| sd_onc_wallet_observer | Wallet Observer | normal | Not in formal catalog |
| sd_onc_token_research | Token Research | normal | Superseded by Token Analysis (advanced) |
| sd_onc_onchain_risk_review | Onchain Risk Review (Advanced) | advanced | Superseded by Onchain Risk Review (expert) |
| sd_exp_research_director | Autonomous Research Director | expert | Superseded by Deep Research |
| sd_exp_alpha_opportunity_hunter | Alpha Opportunity Hunter | expert | Not in formal catalog |
| sd_exp_contract_risk_expert | Contract Risk Expert | expert | Superseded by Risk & Fraud Detection |
| sd_exp_adaptive_learning | Adaptive Learning | expert | Not in formal catalog |
| sd_exp_perfect_memory | Perfect Memory | expert | Not in formal catalog |

---

*Version: V1 | Migration: 0013_skill_catalog_acquisition_v1 | PR #7*
