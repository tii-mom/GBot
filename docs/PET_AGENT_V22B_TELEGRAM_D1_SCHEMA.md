# GBot Pet Agent V2.2-B — Telegram D1 Schema Migrations

本规范定义了 GBot Pet Agent V2.2-B 阶段的 D1 数据库结构表迁移设计，主要解决授权来源数据模型与 Policy Guard 外部审计的底层建模。

## 1. V2.2-B 目标与范围 (Scope)
- **纯结构定义 (Schema-Only)**: 本阶段仅创建迁移文件并实施本地结构校验，不涉及任何 Webhook 信号落盘逻辑或 API HTTP 端点实现。
- **数据隐私设计**: 为保护 Telegram 用户数据，严格限制了存储内容，绝不存储普通历史会话全文。

## 2. 数据库表定义说明 (Table Descriptions)

本迁移共引入以下四张数据库表：

### 1) `telegram_authorized_sources` (授权来源表)
- **用途**: 存储用户/Agent 授权接入的群组、频道或链接入口。
- **核心字段**:
  - `telegram_chat_id_hash`: Telegram 聊天 ID 经单向 Hash 加密后的哈希串，避免明文泄露。
  - `telegram_chat_title_preview`: 用于在 Mini App 列表展示的标题预览。
  - `status`: 状态（`pending` | `authorized` | `revoked` | `disabled`）。

### 2) `telegram_ingestion_events` (事件接入表)
- **用途**: 记录经过安全分类过滤后认为有效的指令/提及事件。
- **核心字段**:
  - `event_type`: 事件类型（`mention` | `command` | `submission` | `public_signal`）。
  - `telegram_update_id_hash`: Telegram 事件唯一 ID 的单向哈希，用于防重校验。
  - `content_preview`: 最多保留 80 个字符的非敏感信息摘要。

### 3) `telegram_opportunity_signals` (机会线索表)
- **用途**: 存储从接入事件中提炼出、等待 Policy Guard 审计与用户确认的候选任务线索。
- **核心字段**:
  - `signal_type`: 机会类型（`bounty` | `announcement` | `risk_link` | `project_update` | `guild_task`）。
  - `confidence_level`: 置信度。
  - `status`: 状态（`candidate` | `ignored` | `pending_user` | `converted_to_work_run`）。

### 4) `policy_guard_external_action_events` (风控审计记录表)
- **用途**: 审计外部事件触发的所有动作提案，保障外部请求无法绕过安全栅栏。
- **核心字段**:
  - `policy_decision`: 裁定结果（`allow` | `deny` | `require_user` | `admin_pause`）。
  - `budget_snapshot`: 资产开支与预算限额快照。

---

## 3. 隐私与安全模型 (Privacy Model)
- **Hash 隔离**: 聊天 ID 与 Update ID 均需经过 Hash 存储。
- **无内容监控**: 不抓取群内普通聊天，不设计任何全群对话记录的落盘表，不读取私聊历史。
- **无直接划转**: 任何表均不包含与钱包交易自动划转或私钥引用的直接执行字段。所有交易意图均通过 `policy_guard_external_action_events` 审计，并在前端由用户批准后执行。

## 4. 下一阶段规划
- **V2.2-C**: 编写 Source Settings API 增删改查路由端点。
