# GBot Skill Architecture V1.1 (Legacy / Superseded)

> Status: legacy. Replaced by [GBot Canonical V1](./GBOT_CANONICAL_V1.md), [Skill Card System V1](./SKILL_CARD_SYSTEM_V1.md), and [Legacy Docs Archive Index](./LEGACY_DOCS_ARCHIVE_INDEX.md).

This document is preserved for historical reference only.

> **Status**: Frozen — Migration 0013 · Pool Config Version 1  
> **Date**: 2026-06-22  
> **PR**: #7 feat(skill): add canonical catalog and acquisition rules

---

## 1. Three-Layer Agent Capability Model

### Layer A — Agent Core OS

Built into every Agent by default. **Never a Skill Card.**

| Capability | Description |
|---|---|
| Basic Dialogue | Conversational task handling |
| Task Understanding | Parse and decompose task instructions |
| Tool Routing | Select the appropriate tool per step |
| Memory Read/Write | Basic persistent context access |
| Safety Policy | Guard rails and content filtering |
| Wallet Permission Check | Verify wallet access before any transaction |
| Task Status Management | Track and report task lifecycle state |
| Basic Cost Check | Pre-flight cost estimation before execution |

The 4 existing Core Module definitions (`sd_core_*`) are preserved in the database but excluded from all acquisition channels, synthesis pools, Reset, market, and inventory Skill Cards.

### Layer B — Professional Skills

Acquired via **Skill Cards**. Learned by mounting a card into an agent's skill slot.

- **Per Agent**: 4–8 Learned Skills equipped at any time
- **Per Task**: 1–3 Skills loaded at runtime

Seven canonical categories:

| Category | Normal | Advanced | Expert | Total |
|---|---|---|---|---|
| Research | 2 | 2 | 1 | 5 |
| Content | 2 | 2 | 1 | 5 |
| Verification | 2 | 1 | 1 | 4 |
| Onchain | 1 | 2 | 1 | 4 |
| Social & Growth | 1 | 2 | 1 | 4 |
| Automation | 3 | 1 | 1 | 5 |
| Business & Collaboration | 1 | 2 | 1 | 4 |
| **Total** | **12** | **12** | **7** | **31** |

> **Skill Runtime** (task loading, effect application) is NOT implemented in this PR.

### Layer C — Agent Core Documents

Each Agent will independently own structured documents:

| Document | Purpose |
|---|---|
| `IDENTITY` | Agent persona, name, and mission |
| `GOALS` | Objectives and priorities |
| `MEMORY` | Persistent cross-task context |
| `OPERATING_RULES` | Behaviour constraints and decision policy |
| `ECONOMY_POLICY` | GP allocation, spending, and saving rules |
| `EVOLUTION` | Capability growth targets and unlock roadmap |

These are **NOT Skill Cards**. Data tables and runtime are **NOT implemented in this PR**.

---

## 2. Canonical 31-Skill Catalog

### Release Status Summary

| Status | Count | Description |
|---|---|---|
| `released` | 24 | Normal + Advanced; available via Skill Box, synthesis, Reset |
| `advanced_unlock` | 7 | Expert only; available via Expert Synthesis and future task rewards |
| `internal` | 25 | 4 Core + 21 legacy; no new generation, existing cards preserved |

### A. Research (5)

| # | Canonical Name | Tier | Release | DB ID |
|---|---|---|---|---|
| 1 | Project Research | normal | released | `sd_res_project_research` |
| 2 | Information Synthesis | normal | released | `sd_res_information_summary` |
| 3 | User & Market Research | advanced | released | `sd_res_user_market_research` |
| 4 | Competitive Intelligence | advanced | released | `sd_res_competitive_intelligence` |
| 5 | Deep Research | expert | advanced_unlock | `sd_exp_deep_research` |

### B. Content (5)

| # | Canonical Name | Tier | Release | DB ID |
|---|---|---|---|---|
| 6 | Structured Writing | normal | released | `sd_con_structured_writing` |
| 7 | Social Content | normal | released | `sd_con_social_copywriter` |
| 8 | Technical Documentation | advanced | released | `sd_con_technical_documentation` |
| 9 | Long-form Writing | advanced | released | `sd_con_content_strategist` |
| 10 | Multilingual Adaptation | expert | advanced_unlock | `sd_exp_multilingual_director` |

### C. Verification (4)

| # | Canonical Name | Tier | Release | DB ID |
|---|---|---|---|---|
| 11 | Source Verification | normal | released | `sd_ver_evidence_organizer` |
| 12 | Submission Review | normal | released | `sd_ver_submission_checker` |
| 13 | Fact Checking | advanced | released | `sd_ver_advanced_verification` |
| 14 | Risk & Fraud Detection | expert | advanced_unlock | `sd_exp_chief_verification_officer` |

### D. Onchain (4)

| # | Canonical Name | Tier | Release | DB ID |
|---|---|---|---|---|
| 15 | Transaction Reader | normal | released | `sd_onc_transaction_reader` |
| 16 | Token Analysis | advanced | released | `sd_onc_ton_chain_analyst` |
| 17 | Smart Contract Reader | advanced | released | `sd_onc_smart_contract_reader` |
| 18 | Onchain Risk Review | expert | advanced_unlock | `sd_exp_onchain_intelligence` |

### E. Social & Growth (4)

| # | Canonical Name | Tier | Release | DB ID |
|---|---|---|---|---|
| 19 | Community Operation | normal | released | `sd_soc_telegram_promoter` |
| 20 | Social Listening | advanced | released | `sd_soc_viral_pattern_analysis` |
| 21 | Lead Discovery | advanced | released | `sd_soc_audience_targeting` |
| 22 | Growth Campaign | expert | advanced_unlock | `sd_exp_master_growth_strategist` |

### F. Automation (5)

| # | Canonical Name | Tier | Release | DB ID |
|---|---|---|---|---|
| 23 | Task Decomposition | normal | released | `sd_aut_task_decomposition` |
| 24 | Tool Selection | normal | released | `sd_aut_tool_selection` |
| 25 | Progress Tracking | normal | released | `sd_aut_progress_tracking` |
| 26 | Workflow Planning | advanced | released | `sd_aut_workflow_planning` |
| 27 | Failure Recovery | expert | advanced_unlock | `sd_exp_task_orchestration` |

### G. Business & Collaboration (4)

| # | Canonical Name | Tier | Release | DB ID |
|---|---|---|---|---|
| 28 | Budget Management | normal | released | `sd_biz_budget_management` |
| 29 | Task Profit Analysis | advanced | released | `sd_biz_task_profit_analysis` |
| 30 | Client Delivery Management | advanced | released | `sd_biz_client_delivery_management` |
| 31 | Agent Service Procurement | expert | advanced_unlock | `sd_biz_agent_service_procurement` |

---

## 3. 24 Released + 7 Advanced Unlock

**Batch 1 — Released (24):** All Normal and Advanced skills in the canonical catalog.  
Available in Skill Box, normal synthesis output, Reset pool, and task rewards.

**Batch 2 — Advanced Unlock (7):** All Expert skills.  
- NOT in Skill Box
- Available in Expert Synthesis output pool
- Available in Reset Expert pool
- Future: task achievement unlock, task reward
- NOT in market (current)
- NOT on-chain (current)

---

## 4. Skill Object Model

```
agent_skill_definitions      ← immutable capability template
                                (id, code, name, tier, category, effect_type, …)

skill_acquisition_rules      ← release control + pool membership
                                (1:1 with skill_definition_id)
                                SINGLE AUTHORITATIVE SOURCE for all pool queries

inventory_items              ← Skill Card: one purchasable/obtainable instance
  [item_type='skill_card']     owned by a user, has skill_definition_id FK

agent_learned_skills         ← Learned Skill: card mounted in an agent's slot
                                references inventory_items + agent_skill_definitions

skill_economy_events         ← audit trail for all economy operations
                                now includes pool_code + pool_version
```

Synthesis and Reset create **new Skill Cards** only.  
They never create Skill Definitions, modify names, tiers, or internal properties.

---

## 5. Skill Box Pool Rules

Pool query (per tier):

```sql
SELECT d.*
FROM agent_skill_definitions d
JOIN skill_acquisition_rules r ON r.skill_definition_id = d.id
WHERE d.tier = ?
  AND d.status = 'enabled'
  AND r.release_status = 'released'
  AND r.available_in_skill_box = 1
```

- Expert cards are **never** produced by Skill Box.
- If pool is empty → return `invalid_skill_pool_config`, no inventory consumed.
- Pool code: `skill_box_normal_v1` / `skill_box_advanced_v1`

---

## 6. Normal → Advanced Synthesis Pool Rules

Output pool query:

```sql
SELECT d.*
FROM agent_skill_definitions d
JOIN skill_acquisition_rules r ON r.skill_definition_id = d.id
WHERE d.tier = 'advanced'
  AND d.status = 'enabled'
  AND r.release_status = 'released'
  AND r.available_in_normal_synthesis = 1
```

- `synthesis_weight` column reserved for future same-category preference (70/30).
- Pool code: `normal_synthesis_advanced_v1`

---

## 7. Advanced → Expert Synthesis Pool Rules

Success output pool:

```sql
SELECT d.*
FROM agent_skill_definitions d
JOIN skill_acquisition_rules r ON r.skill_definition_id = d.id
WHERE d.tier = 'expert'
  AND d.status = 'enabled'
  AND r.available_in_expert_synthesis = 1
  AND r.release_status IN ('advanced_unlock', 'released')
```

**Unchanged parameters:**
- Requires 5 Advanced Cards + 2000 GP
- 20% success rate
- Failure: return 1 consolation Advanced Card (from `available_in_normal_synthesis = 1` pool)
- 5th attempt guaranteed (pity counter)
- GP and pity logic unchanged

Pool codes: `expert_synthesis_expert_v1` / `expert_failure_consolation_v1`

---

## 8. Reset Core Pool Rules

Tier probability (unchanged): 75% Normal / 23% Advanced / 2% Expert

Per-tier pool query:

```sql
SELECT d.*
FROM agent_skill_definitions d
JOIN skill_acquisition_rules r ON r.skill_definition_id = d.id
WHERE d.tier = ?
  AND d.status = 'enabled'
  AND r.available_in_reset_pool = 1
  AND r.release_status IN ('released', 'advanced_unlock')
```

- If tier pool empty → re-draw up to 5 times.
- If completely fails → no Reset Core, Protection Token, or GP consumed.
- Pool codes: `reset_normal_v1` / `reset_advanced_v1` / `reset_expert_v1`

---

## 9. Historical Asset Compatibility

Skills with `release_status = 'internal'` (legacy definitions) remain:
- ✅ Learnable (if card already owned)
- ✅ Upgradeable (if card already owned)
- ✅ Viewable in inventory
- ❌ Not generated by any new acquisition channel

**No Skill Card or Learned Skill is deleted.** Acquisition Rules only control NEW asset generation.

---

## 10. Pool Audit

Every random skill draw records in `skill_economy_events`:

| Field | Description |
|---|---|
| `pool_code` | Stable pool identifier (e.g. `skill_box_normal_v1`) |
| `pool_version` | Integer version of pool config (current: `1`) |
| `selectedSkillDefinitionId` | The drawn skill definition ID |
| `rollInteger` | Raw random integer used |
| `weightTotal` | Sum of weights in the pool |
| `selectedRange` | Weight range that was hit |
| `testOverrideUsed` | Whether a test override was active |

---

## 11. Skill Market (Not Implemented)

`available_in_market = 0` for all skills in this release.  
No trading, listing, or price discovery is implemented.

---

## 12. On-Chain Skills (Not Implemented)

`available_for_direct_grant = 1` is reserved for future NFT-backed grant flows.  
No on-chain minting, transfer, or verification is implemented in this PR.

---

## 13. Skill Runtime Roadmap

Future PR:
- Task-level skill slot loading (1–3 per task context)
- Effect application in workflow executor
- Skill Markdown content loader
- Task–Skill match scoring

---

## 14. Agent Core Documents Roadmap

Future PR:
- Schema: `agent_documents` table with `doc_type`, `agent_id`, `content`
- Runtime: document loader, context injector
- Evolution: versioned content and diff tracking

---

*Migration: `0013_skill_catalog_acquisition_v1.sql` | Pool Config Version: `1` | PR #7*
