# GrowthBot 赏金任务网络规格

## 1. 目标

把 GrowthBot 从“Agent 技能卡 + 任务验收”升级到“全球任务赏金执行网络 (Telegram-native Global Bounty Execution Network)”。

核心闭环：
- 任务发起方用 TON/GRAM/USDT 等生态资产提供预算和目标。
- Agent 自动发现、归类、整理并拆解任务。
- 用户或 Agent（在测试网隔离钱包授权下）完成执行。
- 平台通过链接、链上事件或项目方回调验收，审核通过后发放赏金并结算奖励。

> [!IMPORTANT]
> **旧系统兼容原则**：所有新规划文档与规格设计不得要求立即替换当前 V0 Earn / Task / Marketplace / Admin 流程；Bounty Network 是当前任务系统的战略升级方向，不是立即推翻现有实现。在 Phase 0 阶段，系统仅承担任务发现、任务整理、链接提交和战报反馈，不新增真实钱包结算与 Agentic Wallet 主网交易。

---

## 2. 任务来源

任务只能来自真实需求方：
- 平台官方任务。
- 白名单项目方任务。
- 白名单 KOL / 社区任务。
- 后续才开放用户自助赏金。

禁止：
- 无预算的空任务。
- 不能提供有效凭证验收的任务作为主任务。
- 需要平台托管第三方账号密码的任务。

---

## 3. 任务结构与分类

根据执行方式，任务划分为以下四类 (`execution_type`)：
1. `HUMAN_FINAL_STEP`：Agent 梳理，用户手动操作并提交链接凭证。
2. `AGENT_ASSISTED`：Agent 辅助生成文案、预填表单、整理提交材料和提醒截止时间；涉及第三方账号、身份授权或不可逆提交时，必须由用户完成最后确认。
3. `AGENT_AUTONOMOUS_ONCHAIN`：测试网 Agentic Wallet 链上低风险自动执行。
4. `PROJECT_API_VERIFIED`：项目方系统主动向平台进行 API/Webhook 回调验收。

每个任务包含以下基础字段：
- `taskId`
- `title`
- `category`
- `platform`
- `targetUrl`
- `budget`
- `reward`
- `deadline`
- `verificationRule`
- `submissionType` (URL / TX_HASH / API_CALLBACK / EVENT_LOG)
- `riskLevel`
- `ownerType`
- `executionType`

对于 `AGENT_AUTONOMOUS_ONCHAIN` 类型任务，项目方必须基于安全模板发布，包含以下 TON 链专用控制字段，由平台硬编码策略校验（不得由 LLM 直接决定）：
- `chain` (Mainnet / Testnet)
- `target_contract` (目标合约地址)
- `asset_type` (允许消耗或交互的资产种类)
- `action_template` (固定允许的操作模板，如 `check_in` 或 `badge_mint`)
- `payload_schema` (操作荷载校验规则)
- `value_limit` & `jetton_limit` (单次交易的最大金额限制)
- `allowed_methods` (只允许调用的合约方法)
- `verification_adapter` (对应的链上事件验证器)
- `requires_user_confirmation` (是否强制用户二次手动确认)

---

## 4. Agent 职责与 MCP 边界

Agent 在网络中扮演“任务工人”角色，负责执行的编排与决策理解。

Agent 可以：
- 扫描可做任务。
- 拆解任务步骤。
- 生成用户最后一步指令。
- 调用隔离的 Agentic Wallet 签署白名单交易。
- 收集提交 proof 证据凭证。

### 4.1 MCP 与 LLM 的安全隔离限制
*   **工具草案定位**：LLM 或 MCP（如 `@ton/mcp`）仅用于解析自然语言、拆解步骤并生成“执行草案 (Execution Draft)”。
*   **数据重查校验**：MCP 返回的任何链上或任务状态不得直接作为交易或审核事实来源。后端必须通过节点重新查询链上状态、重新构建交易 payload、并重新通过安全策略引擎（Policy Engine）的硬编码校验（如 limits、allowlists、template 匹配）。
*   **强制风控**：未知合约、未知操作模板或超额转账，Policy Engine 必须默认拒绝。

---

## 5. 验收方式与结算队列

赏金验收取消“事件监听成功即自动发钱”的激进模式，统一引入**“可审计结算队列 (Payout Queue)”**进行状态流转。

### 5.1 验收状态机

任务凭证（链接/TxHash/事件）流转状态如下：
- `draft`：草稿。
- `submitted`：凭证已提交。
- `verifying`：格式或链上事件检索中。
- `verified`：凭证与数据校验通过。
- `payout_pending`：进入待打款结算审计队列。
- `payout_approved`：风控与规则过滤通过，已核准打款。
- `paid`：链上或账本打款成功。
- `rejected`：凭证校验失败。
- `disputed`：用户争议申诉中。
- `risk_hold`：触发风控监控，挂起等待人工放行。

> [!NOTE]
> **自动放行规则**：仅低金额、低风险、且属于官方或白名单项目池内的任务，系统允许在校验通过后自动由 `verified` 穿透至 `paid`。高金额或异常频次操作必须拦截进入 `risk_hold` 待审。

---

## 6. 奖励与结算结构

为规避代币波动性风险并确保合规，平台采用**三层账本体系**：
1.  **记账层**：任务定价统一使用 USD 记价单位或内部点数（如 `Claim Credits`）记录 bounty value，规避代币实时波动。
2.  **支付层**：项目方通过 USDT on TON 或 TON/GRAM 资产作为支付担保，锁入 `bounty_budgets` 预算池。
3.  **运营层**：USDT 用于 B2B 任务预算定价；而 **TON/GRAM** native asset 更适合作为交易 Gas 费、平台提现手续费、社区活动代扣和生态叙事资产。
4.  **安全原则**：禁止任何 "guaranteed profit"、"fixed conversion" 等躺赚或即时收益承诺，强调“可审计的真实赏金结算闭环”。

---

## 7. 风控与审计记录

系统必须记录以下审计事件以备资金核账：
- **`bounty_ledger_events`（流水账本）**：记录预算、冻结、释放、结算、退款及手续费明细。**在测试覆盖范围内，幂等键、唯一索引、事务锁和重放测试必须证明不会重复支付。**
- **`risk_reviews`（风控记录）**：记录所有人工审核、风控挂起原因、拦截逻辑和最终 Reviewer 处理决策。

---

## 8. 后台页面建议

Admin 后台必须包括：
- 任务与活动母表（Bounty Campaigns）管理。
- 项目方账户、KYB 等级与 API 密钥审计。
- 结算待审队列（Payout Queue）及一键风控暂停开关。
- 人工申诉（Dispute）仲裁入口。

---

## 9. API 建议

建议新增或升级：
*   `POST /project/bounty/campaigns` (创建任务活动)
*   `POST /project/bounty/budgets/deposit-intent` (存入预算意向)
*   `GET /bounty/tasks` (获取赏金任务列表)
*   `POST /bounty/tasks/:id/submit-proof` (提交 URL / TxHash 证明)
*   `POST /bounty/tasks/:id/verify` (触发自动验证)
*   `POST /agentic/tasks/:id/prepare` (构建执行 Payload 草案)
*   `POST /agentic/tasks/:id/execute` (提交签名交易)
*   `POST /admin/bounty/settlements/:id/approve` (管理员批准打款)
*   `POST /admin/contracts/allowlist` (管理合约准入白名单)
