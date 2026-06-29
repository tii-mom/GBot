# GBot Pet Agent V2.2-E — Mini App Telegram API Integration

本文件规范了 GBot Pet Agent V2.2-E 阶段在 Mini App 前端完成的 **Telegram API 对接与回退策略** 设计。

## 1. 范围 (Scope)
- **API 接口调用**: 封装了 apiClient 并接入后端 V2.2-C/D 开发的 `GET`/`POST`/`PATCH`/`DELETE` 授权源接口与机会线索接口。
- **无感降级与回退**: 设计了 Mock/Offline 自动回退保护机制，确保本地测试、Demo 演示或网络离线时界面优雅可用。
- **状态显示与风控警示**: 界面采用明确的指示牌标记 API 连接模式，确保用户对实时的链上状态具有准确知情权。

## 2. 对接 API 路由列表 (Endpoints Connected)
在 `apps/miniapp/src/apiClient.ts` 中完成封装对接：
1. `GET /v1/telegram/sources`
2. `POST /v1/telegram/sources`
3. `PATCH /v1/telegram/sources/:id`
4. `DELETE /v1/telegram/sources/:id`
5. `GET /v1/telegram/opportunity-signals`
6. `POST /v1/telegram/opportunity-signals/:id/ignore`
7. `POST /v1/telegram/opportunity-signals/:id/require-user`
8. `POST /v1/telegram/opportunity-signals/:id/convert`

---

## 3. 回退与双模控制策略 (Fallback Model)
- **获取数据机制**:
  - 启动或切换分区时，优先通过 apiClient 发起网络请求获取实时 API 数据。
  - 若检测到接口报错、处于强制 Mock 参数中、或离线状态，自动回退并渲染前端预置的 `MOCK_TELEGRAM_SOURCES` 与 `MOCK_TELEGRAM_SIGNALS`。
- **模式徽标**:
  - `🟢 Live API`: 已成功打通云端/本地运行的 API，操作会实时更新后台 D1 数据库。
  - `🧬 Mock Fallback`: 开发/测试阶段的回退数据演示，所有操作均在前端进行内存态变更。
  - `⚠️ Offline Fallback`: 判定为网络断开，处于离线状态。

---

## 4. 转换 State-only 安全合规文案 (Convert UI Compliance)
在 Live API 模式下，转化机会线索的文案严格遵循 V2.2-D 的安全限制红线：
- 转换按钮文案: `标记为候选转换 · State-only`
- 状态标签文案: `已标记候选转换`
- 绝对不宣称 `WorkRun created`、`任务开始执行`或`触发钱包滑转`，明确展示该操作仅为转换标识记录。

---

## 5. 未实现内容说明 (Non-goals)
- ❌ **不启动自动抓取**: 游乐园目前仍不接收实时的群会话监听，后端 Webhook 依然处于骨架隔离态。
- ❌ **不自动付款与交易**: 用户点击转换仅起到标记作用，本阶段依然不关联任何真实的支付通道或资产变动。

## 6. 后续规划
- **V2.2-F**: Webhook 事件持久化与候选信号自动生成。详见：[PET_AGENT_V22F_WEBHOOK_INGESTION_PERSISTENCE.md](file:///Users/yudeyou/Desktop/GrowthBot/docs/PET_AGENT_V22F_WEBHOOK_INGESTION_PERSISTENCE.md)
