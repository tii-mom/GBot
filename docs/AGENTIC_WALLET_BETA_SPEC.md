# Agentic Wallet Beta 规格说明书 (AGENTIC_WALLET_BETA_SPEC.md) (Legacy / Superseded)

> Status: legacy. Replaced by [TON Agent Wallet V1](./TON_AGENT_WALLET_V1.md) and [GBot Canonical V1](./GBOT_CANONICAL_V1.md).

This document is preserved for historical reference only.

本规格说明书定义了 GrowthBot 在 Phase 4 (测试网 Beta) 阶段引入的 Agentic Wallet（智能体隔离钱包）技术方案与安全边界。

> [!WARNING]
> **主网默认关闭限制**：Mainnet Agentic Wallet feature flag 默认关闭。在未通过独立安全评审、外部安全审计以及人工授权签署前，不得开启主网功能。在 Technical Spike 完成前，PR-4 不得把 operator key 生产托管方案合并到 mainnet 生产路径。

---

## 1. 范围与定位 (Scope & Positioning)

在 Phase 4 阶段，本功能具有以下强限制边界：
*   **Testnet First**：仅限在 TON Testnet 环境下进行技术连调。
*   **Beta Only**：仅对内部白名单测试用户开放。
*   **Allowlist Only**：只允许与经过官方人工审核、并记录在系统 allowlist 中的智能合约交互。
*   **Small Budget Only**：隔离钱包内只存放小额代币资产（如少量测试币或等值 5U - 10U 的资产）。
*   **No Main Wallet Automation**：禁止对用户的主钱包进行任何自动化授权或划扣操作。
*   **No Unknown Contract**：禁止与任何未知合约或未公开的 Dapp 交互。
*   **No Auto Swap**：禁止自动 Swap 交易、自动 Meme Sniping 或自动清算套利。

---

## 2. 允许的低风险执行动作 (Low-Risk Whitelist Actions)

Agent 仅被允许执行以下几种明确的链上低风险交互模板：
*   `approved_check_in`：已审核项目方的链上打卡/打卡签名。
*   `approved_badge_mint`：已审核项目方的 SBT/NFT Badge 免费铸造。
*   `approved_claim`：已审核项目方的空投/测试代币领取。
*   `approved_raffle_entry`：已审核活动方的抽奖参与签名。
*   `allowlisted_project_action`：其他通过官方审核、单次成本极低的链上交互（如投票）。

---

## 3. Operator Key 密钥安全托管策略

为了彻底隔离资产被盗的风险，操作密钥管理应遵循以下规范：
1.  **私钥不落库**：Operator Key 绝对不得以明文或非对称解密前状态进入普通 D1 数据库、应用日志、前端会话或普通审计记录。
2.  **安全方案调研 (Spike)**：在开发前期进行单独的技术方案选择，候选方案包括：
    *   **受控 KMS / HashiCorp Vault**：使用硬件安全模块（HSM）级服务进行 API 签名代扣。
    *   **隔离签名微服务**：构建独立的、无外网入方向连接的加密签名节点，仅暴露 Payload 签名 API。
    *   **用户侧加密签名**：仅作为技术 Spike 候选方案，不作为生产默认方案。若使用 LocalStorage / Telegram Cloud Storage，必须经过额外安全评审，且只能保存加密材料，不得保存明文 Operator Key。在用户发起操作时在客户端计算签名后广播。
3.  **用户绝对控制权**：用户在任何时候都可以进行以下操作：
    *   **Pause**：暂停 Agent 的 Operator Key 签名权限。
    *   **Withdraw**：一键退款，将 Agentic Wallet 中的余额全额提现回用户主钱包。
    *   **Rotate**：旋转（重新生成）操作密钥并更新链上授权。
    *   **Revoke**：彻底撤销对该 Agent 的链上智能合约授权。
4.  **紧急熔断**：用户发送 `/stop` 指令或在 Mini App 界面点击暂停，系统将**触发暂停与撤销流程**，并在 TON 链上交易确认打包后正式生效。

---

## 4. 安全策略引擎与 LLM 隔离 (Policy Engine Rules)

LLM（大模型）与 MCP 工具集（如 `@ton/mcp`）不能直接控制交易发起或执行：
1.  **LLM 仅生成草案**：LLM 仅根据任务描述解析参数并生成交易 payload 草案。
2.  **安全引擎硬重查**：系统后端在接到草案后，必须通过节点独立重新查询链上合约状态、重新组装标准的 binary payload。
3.  **Policy Engine 强力验证**：
    *   验证 `target_contract` 是否在 `project_allowlist_contracts` 允许列表中。
    *   验证交易 `value` 和 Jetton 数量是否超出 `per_task_limit` 或累计的 `daily_limit`。
    *   匹配 `action_template`。若检测到未知模板或超限，**Policy Engine 必须默认拒绝**，并生成高风险审计警告。
    *   任何涉及资产转移或高风险动作的操作，必须强制返回给用户进行手动二次确认。
