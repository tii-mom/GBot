# GBot Pet Agent V2.2-G — Telegram Ingestion Production Readiness & Admin Review Console

本文件规范了 GBot Pet Agent V2.2-G 阶段完成的 **生产环境就绪度与管理后台审阅看板** 设计。

## 1. 范围 (Scope)

V2.2-G 为 Telegram 授权事件接入管道设计并交付了运行保护、故障熔断、管理审阅及就绪度检查机制：

1. **运营级熔断机制 (Ingestion Kill Switch)**: 可通过环境变量 `TELEGRAM_INGESTION_ENABLED` 彻底断开数据接收。
2. **管理端 API 审阅通道 (Admin Read APIs)**: 增加独立且符合现有 Admin 权限的专属 API，提供源、流水和机会的统计查阅。
3. **审阅看板 (Admin UI Review Console)**: 在管理后台（Admin UI）中新增审阅面板，方便系统管理员监控消息量并执行手动干预（如停用源、忽略线索）。

---

## 2. 熔断保护开关 (Kill Switch Contract)

- **控制变量**: `TELEGRAM_INGESTION_ENABLED`
- **控制逻辑**:
  - `TELEGRAM_INGESTION_ENABLED` 设为 `"true"` 或 `"1"` 时：正常流转 Webhook Ingestion。
  - 缺失、未配置或配置为其他值（如 `"false"`, `"0"`）时：快速返回忽略结果，**不落盘，不生成线索**：
    ```json
    {
      "ok": true,
      "status": "ignored",
      "reason": "ingestion_disabled",
      "handled": false
    }
    ```

---

## 3. 管理端审阅接口 (Admin Read APIs)

所有接口均带有 `requireAdmin(c)` 强制鉴权校验：

1. `GET /admin/v1/telegram/sources` - 检索所有授权源。
2. `GET /admin/v1/telegram/ingestion-events` - 检索所有接入的流转事件。
3. `GET /admin/v1/telegram/opportunity-signals` - 检索所有自动生成的线索。
4. `POST /admin/v1/telegram/sources/:id/disable` - 管理员手动停用某个授权源。
5. `POST /admin/v1/telegram/opportunity-signals/:id/ignore` - 管理员手动忽略指定线索。

---

## 4. 隐私安全原则 (Privacy Controls)

- 接口响应中**绝不泄露** Telegram raw chat ID。
- `content_preview` 经过 120 字符截断，**不存储**消息原文。
- 管理后台操作**不涉及** WorkRun 执行、钱包划转意图生成或 Telegram 消息回复。

---

## 5. 运维操作指南 (Operational Runbook)

### 开启 Ingestion 管道
1. 在 Cloudflare Worker 或本地环境设置环境变量：
   `TELEGRAM_INGESTION_ENABLED=1`
2. 重新部署服务。

### 紧急熔断 Ingestion 管道
1. 修改环境变量：
   `TELEGRAM_INGESTION_ENABLED=0`
2. 重新部署服务。网关会继续对 Webhook 请求校验令牌，但不再进行查表、不持久化任何事件、不产生任何新线索。

### 轮换 Webhook 密钥
1. 在 Telegram Controller 更新 Webhook Secret。
2. 在 Cloudflare 中更新 `TELEGRAM_WEBHOOK_SECRET` 变量。

### 部署回滚与紧急恢复 (Emergency Rollback)
1. 如遇到严重数据库锁冲突或接口雪崩，执行 Git 与 Cloudflare 部署回滚 (rollback)。
2. 回滚命令：`git checkout main && git reset --hard <stable_commit> && git push origin main --force`。
3. 在 Cloudflare 控制面板直接触发上一个稳定版本的 rollback 部署。


---

## 6. 联调烟雾测试计划 (Staging Deploy Smoke Test)

1. **未授权消息测试**: 向未授权群组/频道投递带有 `@GBot` 的消息，确认 Webhook 返回 `not_authorized_source`，D1 中无新增事件与线索。
2. **授权消息流转测试**: 向已授权的群组发送消息，确认 Webhook 返回 `eventId` 并在 D1 `telegram_ingestion_events` 表中落盘，且成功生成状态为 `candidate` 的机会信号。
3. **熔断测试**: 移除 `TELEGRAM_INGESTION_ENABLED`，发送消息，确认返回 `ingestion_disabled` 且 D1 无任何记录生成。
4. **管理端测试**: 登录管理员控制台，确认可在 Ingestion Review 面板看到该事件及信号，并能成功执行“停用源”或“忽略线索”。

---

## 7. 下一阶段上线准备 (Next Step)
- **V2.2-H**: Telegram 接入控制台上线验收与 Staging 阶段联调就绪度核对。详见：[PET_AGENT_V22H_LAUNCH_CLOSEOUT_STAGING_READINESS.md](file:///Users/yudeyou/Desktop/GrowthBot/docs/PET_AGENT_V22H_LAUNCH_CLOSEOUT_STAGING_READINESS.md)

