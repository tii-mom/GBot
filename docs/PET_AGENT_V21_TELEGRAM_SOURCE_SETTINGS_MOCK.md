# GBot Pet Agent V2.1 — Telegram Source Settings & Opportunity Inbox Mock UI Spec

本规范定义了 GBot Pet Agent V2.1 前端 Mock 交互流程的实现范围、文案约束与系统设计架构。

## 1. V2.1 开发范围 (Scope)
- **纯前端 Mock 实现**: 在 ExploreView 内置了 Telegram 游乐园的两个新子版块：**来源设置 (Sources)** 和 **线索收件箱 (Inbox)**。
- **数据流可视化展示**: 通过静态模拟数据演示 Ingestion 到 Opportunity Signal 的流转心智，无需后端数据库或 Telegram Webhook 支持。
- **禁止边界校验**: 前端所有控制行为均以 Mock 执行，不向后台发送请求，不触发真实的钱包 intent 划转。

## 2. 为什么在开发 Webhook 后端前先开发 Mock UI?
- **心智对齐**: 在实现真实的 Telegram 接入前，先以具体交互确立**授权事件接入 (Permissioned Event Ingestion)** 与“仅转为待探索线索，不直接触发钱包动作”的风控心智。
- **文案防御**: 精准拦截敏感合规词，通过前端交互直接展示数据可见与不可见的明确分界线，保护用户隐私知情权。
- **交互演练**: 验证来源增删与忽略线索在宠物拟人化场景下的主从交互是否自然流畅。

## 3. Telegram 授权来源模型 (Source Settings Model)
- 提供 5 个静态模拟授权源（👥 公会群、📢 公告频道、🔗 用户手动提交、🔌 @提及、🌐 公开白名单链接）。
- 支持用户在页面上点击 **暂停来源 · Mock** 与 **移除来源 · Mock** 进行界面卡片的临时增减与状态转换（`authorized_mock` <-> `disabled`）。

## 4. 线索收件箱模型 (Opportunity Inbox Model)
- 提供 5 个静态模拟线索卡片（包括质押任务反馈、文档翻译校对、异常钓鱼警示等）。
- 划分了三种不同状态对应的操作按钮：
  - `candidate`: 转为候选任务 · Mock
  - `pending_user`: 主人确认授权派它出击 · Mock
  - `ignored`: 已忽略此线索

## 5. 权限安全与合规边界文案 (Permission Boundary)
- **已授权**: 仅处理明确授权、用户显式粘贴提交或以 `@GBot` 主动发起的提及数据。
- **已隔离**: 绝对不读取、不监控普通群内会话历史，不自动向陌生人批量推送私信广告。
- **核心判定规则**: 所有的 Telegram 接收事件只能先汇聚成为线索收件箱中的 Candidate Signals。即使置信度极高，Agent 也绝对无法自动或隐式触发钱包的扣款与转账。必须由 Policy Guard 校验并经过用户确认。

## 6. 与 PR #46 数据库 Schema 的映射关系
- 本地 mock 类型 `TelegramAuthorizedSourceMock` 对应 `telegram_authorized_sources` 结构。
- 本地 mock 类型 `TelegramOpportunitySignalMock` 对应 `telegram_opportunity_signals` 与 `telegram_ingestion_events` 联合解析字段。
- 在后续 V2.2 实现时，前端 Mock 状态的交互逻辑将以 Restful API endpoints 进行平滑替代。

## 7. 严禁文案及行为边界 (Prohibited Copy & Behaviors)
- ❌ **严禁使用字眼**: 无感知监听、静默监听、已开始监听、自动读取消息、已接管群聊、自动私信、自动交易、确定性盈利类口号、本金安全类口号、收益承诺类口号。
- ❌ **安全替代词**: 授权事件接入、待确认线索、待 Policy Guard 确认、证据摘要、任务方结算中。

## 8. 验证计划 (Verification Plan)
- 静态编译无报错：`npm run typecheck --workspace @growthbot/miniapp` & `npm run build`
- 合规自检通过：`npm run verify:pet-agent-copy`
- 手动 Grep 自检无敏感词残留。
