# GrowthBot Bounty Task Abstraction Layer

## 1. 目标

把 GrowthBot 从“Agent 技能卡 + 内部任务验收”升级为 **Bounty Task Abstraction Layer**：一个把外部任务平台和 GBot 自有任务市场统一成简单任务卡的 Agent 执行层。

核心闭环：
- 用户在任务地图看到统一 Opportunity 卡。
- Agent 评估奖励、G 消耗、成功率、风险、收款方式和证据要求。
- 用户确认或规则允许后，Agent 消耗 G / AI Credits 执行任务。
- 外部平台奖励进入用户钱包或用户平台账户；GBot 只记录执行燃料、证据包和结算追踪。
- GBot 自有任务市场可以继续使用内部审核、预算和审计队列。

> [!IMPORTANT]
> **兼容原则**：所有新规划文档与规格设计不得要求立即替换当前 V0 Earn / Task / Marketplace / Admin 流程。`bounty_tasks` 继续作为 `source = "gbot"` 的自有任务来源。Phase 1 只做任务抽象、只读机会 API、前端任务卡和战报上下文；不新增真实外部平台自动接单、真实钱包结算或 Agentic Wallet 主网交易。

---

## 2. 双市场任务来源

### 2.1 External Source

外部来源包括 OKX.AI、Algora / GitHub、Bountycaster、Zealy、Layer3 等。GBot 在这些来源上只做合规聚合、评分、计划、证据包、提交辅助和结算追踪。

外部来源规则：
- `settlementTarget = user_wallet` 或 `user_platform_account`
- `payoutCustody = never_platform_custody`
- 不伪造“已接单、已提交、已到账”状态。
- 平台规则不允许自动化时，Opportunity 必须标记为 `automationMode = blocked` 或 `recommend_only`。

### 2.2 GBot Source

GBot 自有任务继续来自 `bounty_tasks` 和后续自有任务市场。该来源可使用内部预算、审核、审计和争议流程。

GBot 来源规则：
- `settlementTarget = gbot_internal`
- `payoutCustody = gbot_escrow_for_internal_only`
- 奖励文案必须标记为 GBot internal reward，不得与外部平台用户收款混淆。

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

每个统一 Opportunity 包含以下基础字段：
- `id`
- `source` (`gbot` / `okx_ai` / `algora` / `github` / `bountycaster` / `zealy` / `layer3` / `external`)
- `platform`
- `externalTaskId`
- `localTaskId`
- `title`
- `summary`
- `rewardDisplay`
- `rewardAsset`
- `rewardAmountUsdEstimate`
- `fuelCostG`
- `aiCreditEstimate`
- `successProbability`
- `riskLevel`
- `automationMode`
- `settlementTarget`
- `payoutCustody`
- `requiredSkills`
- `evidenceRequirements`
- `platformRulesUrl`
- `targetUrl`
- `deadline`
- `status`

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

外部任务验收不进入 GBot 资金托管队列。GBot 只记录证据、提交状态、平台状态和用户收款追踪。GBot 自有任务保留可审计结算队列。

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

平台采用清晰拆分的账本语义：
1. **Fuel 层**：记录 Agent 消耗的 `G`、AI Credit 和工具调用成本。
2. **External Tracking 层**：记录外部平台任务状态、证据、用户收款目标和追踪结果，不托管外部奖励。
3. **GBot Internal 层**：仅用于自有任务市场的内部奖励、预算、审核和争议记录。
4. **安全原则**：禁止确定性回报、固定兑换或无风险表达，强调“可审计的任务执行与结算追踪”。

---

## 7. 风控与审计记录

系统必须记录以下审计事件：
- **Fuel usage**：任务发现、评分、执行、证明、追踪各阶段消耗。
- **Evidence package**：链接、PR、报告、截图、交易哈希、测试日志等证据。
- **External payout tracking**：外部平台状态、用户收款目标、用户确认记录。
- **GBot internal ledger**：仅用于自有任务的预算、冻结、释放、结算和退款。
- **Risk reviews**：人工审核、风控挂起原因、拦截逻辑和最终处理决策。

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
*   `GET /opportunities` (统一机会列表，Phase 1 只读)
*   `POST /opportunities/:id/plan` (生成计划，后续阶段)
*   `POST /opportunities/:id/dispatch` (派遣执行，后续阶段)
*   `POST /project/bounty/campaigns` (创建任务活动)
*   `POST /project/bounty/budgets/deposit-intent` (存入预算意向)
*   `GET /bounty/tasks` (获取赏金任务列表)
*   `POST /bounty/tasks/:id/submit-proof` (提交 URL / TxHash 证明)
*   `POST /bounty/tasks/:id/verify` (触发自动验证)
*   `POST /agentic/tasks/:id/prepare` (构建执行 Payload 草案)
*   `POST /agentic/tasks/:id/execute` (提交签名交易)
*   `POST /admin/bounty/settlements/:id/approve` (管理员批准打款)
*   `POST /admin/contracts/allowlist` (管理合约准入白名单)
