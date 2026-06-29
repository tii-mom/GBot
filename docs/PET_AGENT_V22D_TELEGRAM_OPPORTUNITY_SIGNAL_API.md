# GBot Pet Agent V2.2-D — Telegram Opportunity Signal API

本文件规范了 GBot Pet Agent V2.2-D 阶段实现的 **线索信号审查管理接口** 契约及安全风控隔离机制。

## 1. 范围 (Scope)
- **线索审查与扭转**: 支持用户在 Hono API 端点对通过 Telegram 收集的候选机会线索（Opportunity Signals）进行列表检索、单条详情查看、以及忽略、要求用户介入、转换状态等处理。
- **状态标记隔离 (State-Only)**: 点击“转换”操作仅把对应 D1 数据库记录的状态置为 `converted_to_work_run`，本 PR 不涉及任何真实的 WorkRun 数据行插入、不触发 workflow 工作流、不执行 Policy Guard 钱包划转。

## 2. API 端点定义与规范 (Endpoints)

### 1) GET `/v1/telegram/opportunity-signals`
- **目的**: 获取绑定到当前所有者 Agent 下的全部或筛选候选信号。
- **请求参数**:
  - `agentId` (可选)
  - `status` (可选): 按线索状态过滤。
  - `signalType` (可选): 按线索类型（`bounty` | `announcement` | `risk_link` | `project_update` | `guild_task`）过滤。
- **所有权隔离校验 (Access Control)**: 必须通过 SQL Join 校验 `agent_id` 下的 `user_id` 与当前已认证的 `user.id` 是否完全匹配，越权直接返回为空或 403。

### 2) GET `/v1/telegram/opportunity-signals/:id`
- **目的**: 检索单条线索的脱敏详情。
- **返回结果**:
  ```json
  {
    "id": "sig_777",
    "agentId": "agent_xyz",
    "sourceEventId": "evt_999",
    "signalType": "bounty",
    "title": "TON Liquid Staking Bounty",
    "summary": "Check gas limits and code logic.",
    "sourceUrl": "https://t.me/AlphaHunters/123",
    "confidenceLevel": "high",
    "estimatedAiCreditCost": 15,
    "requiredSkills": ["smart_contract_audit"],
    "riskFlags": ["high_gas_limit"],
    "status": "candidate",
    "createdAt": "2026-06-29T12:00:00Z",
    "updatedAt": "2026-06-29T12:05:00Z"
  }
  ```

### 3) POST `/v1/telegram/opportunity-signals/:id/ignore`
- **目的**: 标记某机会线索为忽略（`ignored`），将其从候选队列归档。

### 4) POST `/v1/telegram/opportunity-signals/:id/require-user`
- **目的**: 标记某机会线索为待主人确认（`pending_user`），表示其触碰了部分策略，但可以通过 Policy Guard 手动放行。

### 5) POST `/v1/telegram/opportunity-signals/:id/convert`
- **目的**: 转换该机会为待执行的任务。
- **返回结果 (V2.2-D State-Only 结构)**:
  ```json
  {
    "signal": {
      "id": "sig_777",
      "status": "converted_to_work_run",
      "updatedAt": "2026-06-29T12:10:00Z"
    },
    "workRun": null,
    "mode": "conversion_state_only"
  }
  ```
- **核心红线**: 在此迭代中，`workRun` 返回值必须固定为 `null`，且接口绝对不可以在底层触发实际的任务运行（WorkRun 实体）或钱包扣款。

---

## 3. 隐私与安全协议 (Privacy & Security Constraints)
- **数据脱敏**: 返回的线索中不允许暴露关联事件（`telegram_ingestion_events`）的原始全量报文，仅可通过 `sourceUrl` 指向脱敏白名单链接。
- **防止未授权越权**: 所有更新状态接口在执行 UPDATE 前必须使用 `WHERE id = ? AND agent_id IN (SELECT id FROM agents WHERE user_id = ?)` 进行防越权检测。

## 4. 后续规划
- **V2.2-E**: 打通 Mini App 游乐园与本 API 端点的数据互通，或者完成 Webhook Ingestion 的自动 D1 落盘流转。
