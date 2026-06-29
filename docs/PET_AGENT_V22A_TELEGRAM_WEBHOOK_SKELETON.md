# GBot Pet Agent V2.2-A — Telegram Webhook Backend Skeleton & Security Contract

本文件定义了 GBot Pet Agent V2.2-A 阶段的 **授权事件接入 (Permissioned Event Ingestion)** 接口骨架与安全防护协议。

## 1. V2.2-A 开发范围 (Scope)
- **Hono Webhook 骨架**: 在 API Worker 部署了 `POST /v1/telegram/webhook` 作为外部消息接入的单一安全入口。
- **安全校验校验**: 完成 `X-Telegram-Bot-Api-Secret-Token` 头部令牌校验，以及限流与去重 (deduplicate) 网关存根。
- **分类应答**: 内置消息分类器 `classifyTelegramUpdate(update)`，提取 /commands 及 @GBot 提及指令。
- **只进骨架，不通闭环**: 本阶段不存储任何消息内容，不读写 D1 数据库，不创建 WorkRun，不调用大模型，也不触发任何隔离钱包划转动作。

## 2. 外部接口说明 (API Endpoints)
### `POST /v1/telegram/webhook`
- **接收方法**: 仅限 `POST`
- **数据格式**: `application/json`
- **尺寸上限限制**: Payload 大小必须小于 64 KB (65536 字节)，超过直接响应 `413 Payload Too Large` 防止拒绝服务攻击。
- **应答输出**:
  - 校验成功且分类忽略:
    ```json
    { "ok": true, "status": "accepted", "mode": "skeleton", "handled": false, "reason": "not_authorized_source" }
    ```
  - 校验成功且分类接收:
    ```json
    { "ok": true, "status": "accepted", "mode": "skeleton", "handled": true, "reason": "command" }
    ```
  - 头部验证失败或缺少 Token:
    ```json
    { "ok": false, "error": "unauthorized" } // 401 Unauthorized
    ```
  - 环境变量缺失配置:
    ```json
    { "ok": false, "error": "configuration_error" } // 503 Service Unavailable
    ```

## 3. 环境变量与配置项 (Environment Variables)
- **`TELEGRAM_WEBHOOK_SECRET`** (必须): Webhook 接收端配置的秘密共享密钥，对应请求头 `X-Telegram-Bot-Api-Secret-Token` 的值。缺失配置时服务器直接回退保护拒绝接收。
- **`TELEGRAM_BOT_TOKEN`** (可选 / 预留): 用于未来调用 Telegram Bot API 发送消息。
- **`TELEGRAM_BOT_USERNAME`** (可选 / 预留): 用于配置 Bot 的用户名。

## 4. 安全防护与隐私限制规范 (Security Contract)
- **防止敏感泄露**: 在环境变量缺失或出错时，不向外界透露服务端的具体配置详情，不输出敏感日志。
- **隐私沙箱**: 坚决禁止“全群消息监控”、“读取个人私聊”等越权行为。Bot 仅被动接收以 `@GBot` 指明提及的消息。
- **交易红线隔离**: Telegram 触发的消息信号绝不能直接触发任何链上钱包划转动作。任何涉及钱包 Intent 的执行必须走 Policy Guard 风控审核，并需用户在 Mini App 内二次手动批准。

## 5. 本阶段未做的事项 (Non-goals in this PR)
- 本 PR 不执行 D1 数据库表迁移。
- 本 PR 不调用 Telegram Bot 发送外部消息。
- 本 PR 不包含与真实隔离钱包划转相关的 intent 执行层代码。

## 6. 后续迭代规划
- **V2.2-B**: 执行 D1 数据源、事件、机会及 Policy Guard 审计的表结构迁移。详见：[PET_AGENT_V22B_TELEGRAM_D1_SCHEMA.md](file:///Users/yudeyou/Desktop/GrowthBot/docs/PET_AGENT_V22B_TELEGRAM_D1_SCHEMA.md)
- **V2.2-C**: 编写 Source settings 相关增删改查 API。
- **V2.2-D**: 编写 Opportunity signals 状态更改与信号获取 API。
- **V2.2-E**: 打通 Mini App 页面与后端 API 路由。
- **V2.2-F**: Webhook 事件持久化与候选信号自动生成。详见：[PET_AGENT_V22F_WEBHOOK_INGESTION_PERSISTENCE.md](file:///Users/yudeyou/Desktop/GrowthBot/docs/PET_AGENT_V22F_WEBHOOK_INGESTION_PERSISTENCE.md)
