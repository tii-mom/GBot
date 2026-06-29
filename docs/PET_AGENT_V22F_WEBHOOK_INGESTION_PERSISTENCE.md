# GBot Pet Agent V2.2-F — Webhook Ingestion Persistence MVP

本文件规范了 GBot Pet Agent V2.2-F 阶段完成的 **Telegram Webhook 事件持久化与候选信号自动生成** 设计。

## 1. 范围 (Scope)

V2.2-F 是第一个实际写入后端数据库的 Webhook 数据流，将 V2.2-A 的骨架路由升级为可持久化的接入管道：

```
Telegram Webhook POST
→ 密钥头校验 (X-Telegram-Bot-Api-Secret-Token)
→ 去重检查 (KV dedupe)
→ 保守分类 (classifyTelegramUpdate)
→ 授权来源查找 (telegram_authorized_sources)
→ 写入 telegram_ingestion_events
→ 创建候选 telegram_opportunity_signals
→ Mini App Inbox 通过现有 /v1/telegram/opportunity-signals 读取
```

## 2. 授权来源查找 (Authorized Source Lookup)

- 使用 `hashTelegramIdentifier(chatId, SALT)` 生成 SHA-256 哈希。
- 仅匹配 `status = 'authorized'` 的来源。
- 未匹配到授权来源时：返回 `{ ok: true, status: "ignored", reason: "not_authorized_source" }`，不写入任何记录。

## 3. 事件持久化模型 (Ingestion Event Persistence)

写入 `telegram_ingestion_events` 表，字段包括：

| 字段 | 说明 |
|------|------|
| `id` | `evt_{uuid}` |
| `source_id` | 关联的授权来源 ID |
| `agent_id` | 来源绑定的 Agent ID |
| `event_type` | `mention` / `command` / `submission` / `public_signal` |
| `telegram_update_id_hash` | SHA-256 哈希后的 update_id |
| `message_ref_hash` | SHA-256 哈希后的 chatId:messageId 组合 |
| `content_preview` | 截断至 ≤120 字符的安全预览 |
| `content_hash` | 全文 SHA-256 哈希（内存计算，不存储原文） |
| `risk_level` | MVP 阶段固定为 `low` |
| `status` | 初始 `received`，生成信号后更新为 `converted_to_signal` |

## 4. 候选信号生成 (Candidate Signal Generation)

基于确定性规则（非 AI）生成保守低置信度候选信号：

| 事件类型 | 信号类型 | 置信度 | 预估 Credits |
|----------|----------|--------|-------------|
| `command` | `guild_task` | `medium` | 3 |
| `mention` | `announcement` | `medium` | 3 |
| `submission` | `bounty` | `low` | 2 |
| `public_signal` | `announcement` | `low` | 2 |

所有候选信号均含 `needs_owner_review` 风控标记，状态为 `candidate`。

## 5. 隐私与安全模型 (Privacy Model)

- ❌ **不存储**原始 Telegram chat ID — 仅存储 SHA-256 哈希。
- ❌ **不存储**完整消息原文 — 仅存储 ≤120 字符的预览和全文哈希。
- ❌ **不读取**群聊历史 — 仅处理 Webhook 推送的实时更新。
- ❌ **不处理**私聊内容。
- ❌ **不日志记录**完整消息文本。

## 6. 未实现内容 (Non-goals)

- ❌ 不使用 AI 模型分类。
- ❌ 不创建 WorkRun。
- ❌ 不执行 Policy Guard。
- ❌ 不创建 Agent Wallet 意图。
- ❌ 不调用 Telegram 外发 API。
- ❌ 不进行爬虫或抓取。

## 7. Mini App 可见性

- 候选信号通过现有 `GET /v1/telegram/opportunity-signals` 端点对 Mini App Inbox 可见。
- V2.2-E 已完成的前端对接无需额外修改即可展示新产生的候选信号。
- 用户可在 Inbox 中对候选信号执行 ignore / require-user / convert（state-only）操作。

## 8. 后续规划

- **V2.2-G**: Policy Guard 外部审计集成，或 WorkRun 提案创建（需主人确认）。
