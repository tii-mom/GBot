# Skill Acquisition Pools V1

> **Pool Config Version**: 1  
> **Migration**: `0013_skill_catalog_acquisition_v1.sql`  
> **PR**: #7 feat(skill): add canonical catalog and acquisition rules  
> **Date**: 2026-06-22

All pool membership is controlled exclusively by `skill_acquisition_rules`.  
No hardcoded arrays, no fallback to all-enabled definitions.

---

## Pool Index

| Pool Code | Type | Members | Version |
|---|---|---|---|
| `skill_box_normal_v1` | Skill Box — Normal output | 12 | 1 |
| `skill_box_advanced_v1` | Skill Box — Advanced output | 12 | 1 |
| `normal_synthesis_advanced_v1` | Normal→Advanced synthesis output | 12 | 1 |
| `expert_synthesis_expert_v1` | Advanced→Expert synthesis success | 7 | 1 |
| `expert_failure_consolation_v1` | Advanced→Expert synthesis failure | 12 | 1 |
| `reset_normal_v1` | Reset Core — Normal tier output | 12 | 1 |
| `reset_advanced_v1` | Reset Core — Advanced tier output | 12 | 1 |
| `reset_expert_v1` | Reset Core — Expert tier output | 7 | 1 |

---

## Pool: skill_box_normal_v1

**Query filter**: `tier = 'normal' AND status = 'enabled' AND release_status = 'released' AND available_in_skill_box = 1`  
**Version**: 1 | **Member count**: 12

| # | Skill ID | Canonical Name | Category |
|---|---|---|---|
| 1 | sd_res_project_research | Project Research | research |
| 2 | sd_res_information_summary | Information Synthesis | research |
| 3 | sd_con_social_copywriter | Social Content | content |
| 4 | sd_con_structured_writing | Structured Writing | content |
| 5 | sd_ver_submission_checker | Submission Review | verification |
| 6 | sd_ver_evidence_organizer | Source Verification | verification |
| 7 | sd_onc_transaction_reader | Transaction Reader | onchain |
| 8 | sd_soc_telegram_promoter | Community Operation | social |
| 9 | sd_aut_task_decomposition | Task Decomposition | automation |
| 10 | sd_aut_tool_selection | Tool Selection | automation |
| 11 | sd_aut_progress_tracking | Progress Tracking | automation |
| 12 | sd_biz_budget_management | Budget Management | business |

---

## Pool: skill_box_advanced_v1

**Query filter**: `tier = 'advanced' AND status = 'enabled' AND release_status = 'released' AND available_in_skill_box = 1`  
**Version**: 1 | **Member count**: 12

| # | Skill ID | Canonical Name | Category |
|---|---|---|---|
| 1 | sd_res_competitive_intelligence | Competitive Intelligence | research |
| 2 | sd_res_user_market_research | User & Market Research | research |
| 3 | sd_con_technical_documentation | Technical Documentation | content |
| 4 | sd_con_content_strategist | Long-form Writing | content |
| 5 | sd_ver_advanced_verification | Fact Checking | verification |
| 6 | sd_onc_ton_chain_analyst | Token Analysis | onchain |
| 7 | sd_onc_smart_contract_reader | Smart Contract Reader | onchain |
| 8 | sd_soc_viral_pattern_analysis | Social Listening | social |
| 9 | sd_soc_audience_targeting | Lead Discovery | social |
| 10 | sd_aut_workflow_planning | Workflow Planning | automation |
| 11 | sd_biz_task_profit_analysis | Task Profit Analysis | business |
| 12 | sd_biz_client_delivery_management | Client Delivery Management | business |

---

## Pool: normal_synthesis_advanced_v1

**Query filter**: `tier = 'advanced' AND status = 'enabled' AND release_status = 'released' AND available_in_normal_synthesis = 1`  
**Version**: 1 | **Member count**: 12  
**Same members as** `skill_box_advanced_v1`.

*Note: `synthesis_weight` column reserved for future same-category preference (70/30). Currently all weights = 1.*

---

## Pool: expert_synthesis_expert_v1

**Query filter**: `tier = 'expert' AND status = 'enabled' AND available_in_expert_synthesis = 1 AND release_status IN ('advanced_unlock', 'released')`  
**Version**: 1 | **Member count**: 7

| # | Skill ID | Canonical Name | Category |
|---|---|---|---|
| 1 | sd_exp_deep_research | Deep Research | research |
| 2 | sd_exp_multilingual_director | Multilingual Adaptation | content |
| 3 | sd_exp_chief_verification_officer | Risk & Fraud Detection | verification |
| 4 | sd_exp_onchain_intelligence | Onchain Risk Review | onchain |
| 5 | sd_exp_master_growth_strategist | Growth Campaign | social |
| 6 | sd_exp_task_orchestration | Failure Recovery | automation |
| 7 | sd_biz_agent_service_procurement | Agent Service Procurement | business |

---

## Pool: expert_failure_consolation_v1

**Query filter**: same as `normal_synthesis_advanced_v1`  
**Version**: 1 | **Member count**: 12  
**Same members as** `skill_box_advanced_v1`.

Returned when Expert synthesis fails (80% probability).  
Expert synthesis pity logic and GP cost are unchanged.

---

## Pool: reset_normal_v1

**Query filter**: `tier = 'normal' AND status = 'enabled' AND available_in_reset_pool = 1 AND release_status IN ('released', 'advanced_unlock')`  
**Version**: 1 | **Member count**: 12  
**Same members as** `skill_box_normal_v1`.

---

## Pool: reset_advanced_v1

**Query filter**: `tier = 'advanced' AND status = 'enabled' AND available_in_reset_pool = 1 AND release_status IN ('released', 'advanced_unlock')`  
**Version**: 1 | **Member count**: 12  
**Same members as** `skill_box_advanced_v1`.

---

## Pool: reset_expert_v1

**Query filter**: `tier = 'expert' AND status = 'enabled' AND available_in_reset_pool = 1 AND release_status IN ('released', 'advanced_unlock')`  
**Version**: 1 | **Member count**: 7  
**Same members as** `expert_synthesis_expert_v1`.

---

## Pool Membership Constraints

### Exclusions (always enforced via JOIN)

| Excluded category | Reason |
|---|---|
| `release_status = 'internal'` | Not for public acquisition |
| `release_status = 'draft'` | Not released |
| `release_status = 'deprecated'` | End-of-life |
| `release_status = 'disabled'` | Manually disabled |
| `is_core = 1` | Core OS modules, never cards |
| `status != 'enabled'` | Soft-disabled definition |

### Expert skills in Skill Box

Expert skills are **never** available from Skill Box:
- `available_in_skill_box = 0` for all 7 expert skills

### Internal legacy skills

21 existing definitions have `release_status = 'internal'` and all `available_*` flags = 0.  
They cannot be generated by any acquisition channel.  
Existing user assets referencing these IDs are preserved and fully functional.

---

## Pool Configuration Authority

`skill_acquisition_rules` is the **sole authoritative source** for pool membership.  
Code constant `POOL_CONFIG_VERSION = 1` tracks the config version.  
Every random draw records `pool_code` and `pool_version` in `skill_economy_events`.

**Prohibited fallbacks:**
- Hardcoded skill ID arrays
- `effect_config_json` membership
- Skill name pattern matching
- Frontend-only lists
- `SELECT * FROM agent_skill_definitions WHERE status = 'enabled'` without JOIN

---

## Empty Pool Behaviour

| Scenario | Action |
|---|---|
| Skill Box pool empty | Return `invalid_skill_pool_config`, no inventory consumed, audit written |
| Synthesis output pool empty | Return `invalid_skill_pool_config`, no cards consumed, no GP deducted |
| Reset tier pool empty | Re-draw up to 5 times; if all fail, no assets consumed |

---

*Version: V1 | Pool Config Version: 1 | Migration: 0013 | PR #7*
