# Project Hub B2B 自助控制台规格说明书 (PROJECT_HUB_SPEC.md) (Legacy / Superseded)

> Status: legacy. Replaced by [GBot Canonical V1](./GBOT_CANONICAL_V1.md).

This document is preserved for historical reference only.

本规格说明书定义了 GrowthBot 面向第三方 B2B 广告主、项目方与白名单 KOL 提供的自助任务发布系统 (Project Hub) 的业务规范与数据流程。

---

## 1. 项目方准入与 KYB 等级 (Onboarding & KYB Tiers)

为了防范女巫攻击与诈骗任务，项目方必须遵循白名单准入规则：
*   **KYB Level 0 (未认证)**：仅可阅读控制台指南，无法创建任何 Bounty 任务。
*   **KYB Level 1 (白名单基础版)**：经过平台 Admin 人工资质审核（团队信息、推特验证）。可发布 `HUMAN_FINAL_STEP` 社交任务，单个 Campaign 预算受限（如最高 500 USD 价值代币）。
*   **KYB Level 2 (深度合作伙伴)**：经过审计或深度战略合作。可以发布 `AGENT_ASSISTED` 和 `PROJECT_API_VERIFIED` 任务，支持大额预算。
*   **KYB Level 3 (高级别/链上自动化准入)**：仅限经过官方多重签名安全审核、项目智能合约经过外部审计方审计通过的项目。可申请发布 `AGENT_AUTONOMOUS_ONCHAIN`（测试网 Beta）任务，合约必须提交至官方 `project_allowlist_contracts`。

---

## 2. 任务活动创建与管理 (Campaign Creation)

项目方可以通过 Project Hub 创建并发布 `bounty_campaigns`。
*   **任务模板化**：项目方必须使用系统提供的任务模板（如 TG 加群、X 发帖、链上打卡等），以匹配标准的交易与校验逻辑。
*   **预算配置**：创建 Campaign 时必须配置其子任务列表（`bounty_tasks`）和总预算上限。
*   **平台审核**：任务创建后进入 `draft` 状态，经平台 Admin 安全审核后方能进入 `active` 进行分发。
*   **管理员应急开关**：平台管理员在后台拥有最高权限，可一键暂停（Pause）、下架任意异常的 Project 账户或单个 Campaign。

---

## 3. 预算托管账本与结算 (Budget & Payout Ledger)

项目方必须预存并锁定足够的任务赏金预算：
1.  **预算池冻结**：项目方发起 Campaign 时，对应的代币或点数余额将从其 Project 账户冻结至 `bounty_budgets` 中。
2.  **账本流水记录 (`bounty_ledger_events`)**：每次预算的存入、冻结、释放、结算、退款以及平台手续费扣减，必须实时向 `bounty_ledger_events` 表写入一条带有唯一幂等键（`idempotency_key`）的审计流水。
3.  **结算审计队列**：
    *   Bounty 任务经验证通过（`verified`）后，结算指令写入 `bounty_payouts` 并处于 `payout_pending` 状态。
    *   对于大额异常打款或检测到高女巫风险的用户，系统触发 `risk_hold`（风控挂起），必须由平台 Reviewer 人工审核通过后才转为 `payout_approved` 执行结算。
    *   所有打款流程必须在测试覆盖范围内，通过幂等键、唯一索引、数据库事务锁以及重放测试，确保不会产生重复支付。
4.  **退款与撤回**：当 Campaign 截止或项目方手动下架任务时，未被消耗的剩余冻结预算可申请撤回。系统将解除冻结并退回至项目方主账户余额中。

---

## 4. 统计与分析看板 (Analytics Dashboard)

Project Hub 为项目方提供以下维度的数据看板：
*   **任务转化率**：展示新用户到 Agent 认领、任务步骤拆解、提交凭证、最终验收的完整转化漏斗。
*   **预算消耗分析**：展示日度预算消耗曲线、平均任务获取成本（CAC）及余额警告提示。
*   **Agent 执行质量**：统计接单 Agent 的信誉分布、提交凭证一次通过率及作弊率。
*   **数据报告导出**：支持项目方导出脱敏后的完成数据流水，用于二次社群运营。
