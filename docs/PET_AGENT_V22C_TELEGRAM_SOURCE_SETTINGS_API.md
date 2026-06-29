# GBot Pet Agent V2.2-C — Telegram Source Settings API

本文件规范了 GBot Pet Agent V2.2-C 阶段实现的 **授权来源管理接口** 契约及安全隐私模型。

## 1. 范围 (Scope)
- **授权源管理**: 支持用户在 Mini App 中增删改查其 Agent 挂载的 Telegram 来源（群组、频道、个人提及或公告源）。
- **RESTful Endpoints**: 部署了 `GET`, `POST`, `PATCH`, `DELETE` 接口对 `telegram_authorized_sources` 表实施安全操作。
- **隐私隔离保证**: 服务端通过 SHA-256 哈希对 Telegram 敏感的聊天标识进行单向哈希，杜绝泄漏原始群 ID/群聊参数。

## 2. API 端点定义与交互规范 (Endpoints)

### 1) GET `/v1/telegram/sources`
- **目的**: 列出当前所有者拥有的全部或特定 Agent 下绑定的来源。
- **请求参数**:
  - `agentId` (可选): 按 Agent 过滤。
  - `status` (可选): 按状态过滤。
- **返回结果**:
  ```json
  {
    "sources": [
      {
        "id": "src_12345",
        "ownerUserId": "user_abc",
        "agentId": "agent_xyz",
        "sourceType": "group",
        "telegramChatTitlePreview": "Alpha Hunters",
        "permissionScope": ["mention_analysis", "bounty_post"],
        "status": "authorized",
        "createdAt": "2026-06-29T12:00:00Z",
        "updatedAt": "2026-06-29T12:15:00Z",
        "revokedAt": null
      }
    ]
  }
  ```

### 2) POST `/v1/telegram/sources`
- **目的**: 申请绑定或直接挂载一个新的 Telegram 来源。
- **请求负载 (Request Body)**:
  ```json
  {
    "agentId": "agent_xyz",
    "sourceType": "group",
    "telegramChatId": "-100123456789",
    "telegramChatTitlePreview": "Alpha Hunters",
    "permissionScope": ["mention_analysis"],
    "status": "pending"
  }
  ```
- **哈希防御行为**: `telegramChatId`（例如 `-100123456789`）会在服务端立即混入可选盐值并计算 SHA-256 哈希，仅哈希串被写入 `telegram_chat_id_hash`，原始明文立即丢弃，不会落盘或输出到任何日志。
- **校验约束**: 必须校验 `agentId` 归属于当前已登录的 `userId`。

### 3) PATCH `/v1/telegram/sources/:id`
- **目的**: 更改授权范围、重命名群预览、或者更新状态。
- **请求负载**:
  ```json
  {
    "status": "revoked",
    "telegramChatTitlePreview": "Alpha Hunters (Archived)"
  }
  ```
- **生命周期机制**: 
  - 当状态更新为 `revoked` 时，服务端将自动写入当前时间到 `revoked_at` 字段。
  - 当状态从 `revoked` 重新恢复为 `authorized` 时，会自动将 `revoked_at` 置为 `null`。

### 4) DELETE `/v1/telegram/sources/:id`
- **目的**: 撤销授权（为了审计追踪，此处采用**软删除 (Soft Delete)**，将状态标记为 `revoked` 并设置 `revoked_at`，不进行物理删除）。
- **返回结果**:
  ```json
  {
    "ok": true,
    "status": "revoked"
  }
  ```

---

## 3. 隐私与安全限制说明 (Non-goals & Security Rules)
- ❌ **不输出明文**: API 返回的源对象中绝对不带有任何 `telegram_chat_id_hash` 哈希值或原始聊天 ID。
- ❌ **不主动外发**: 本阶段仅完成来源管理 API 的配置，不启动任何 Telegram 机器人主动作出回复的 outbound 连接。
- ❌ **无自动交易**: 所有与资金相关的操作完全与事件监听链隔离，必须经过 Policy Guard 策略和主人的显式签名动作才可进入钱包执行。

## 4. 后续规划
- **V2.2-D**: 编写 Opportunity Signal 提取分析与忽略/转换 API。详见：[PET_AGENT_V22D_TELEGRAM_OPPORTUNITY_SIGNAL_API.md](file:///Users/yudeyou/Desktop/GrowthBot/docs/PET_AGENT_V22D_TELEGRAM_OPPORTUNITY_SIGNAL_API.md)
