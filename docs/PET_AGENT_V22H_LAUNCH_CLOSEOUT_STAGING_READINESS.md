# GBot Pet Agent V2.2-H — Launch Closeout & Staging Go-live Readiness

本文件定义了 GBot Pet Agent V2.2-H 阶段完成的 **授权事件接入控制台上线验收与 Staging 阶段联调就绪度** 核对清单。

## 1. 阶段目标与开发范围 (Scope)

本阶段为发布收尾阶段，不做任何代码功能性修改或数据库表结构迁移。
目标是制定用于受控 Staging 环境联调与私测的安全性边界、运行环境配置检查表、多端烟雾测试步骤（Smoke Tests）以及在发生异常时的部署回退机制，确保 Telegram 接入管道安全生产就绪。

---

## 2. 必备环境变量列表 (Required Env Vars Checklist)

在部署至 Cloudflare 之前，必须在 Cloudflare 控制台或 Secret 管理中配齐以下环境变量，**严禁提交敏感明文密钥至代码仓库**：

| 变量名称 | 建议默认值 | 作用说明 | 安全约束 |
|---|---|---|---|
| `TELEGRAM_WEBHOOK_SECRET` | (随机生成令牌) | Webhook 入口令牌校验校验 | 需与 Telegram Bot API 设定的 Secret token 一致 |
| `TELEGRAM_INGESTION_ENABLED` | `0` (Safe Default) | 接入通道全局熔断控制开关 | 联调测试阶段通过后方可开启为 `1` |
| `TELEGRAM_IDENTIFIER_HASH_SALT` | (强随机盐) | 用于 Telegram 隐私标识哈希的 Salt 值 | 生产与 Staging 环境必须使用不同的盐，不可逆泄漏 |
| `CLOUDFLARE_ACCOUNT_ID` | (系统提供) | 部署所使用的 Cloudflare 账号标识 | - |
| `CLOUDFLARE_API_TOKEN` | (系统提供) | Wrangler 部署校验使用的 API 令牌 | - |

此外，系统已在 `wrangler.jsonc` 绑定如下常规变量：
- **`DB`**: D1 Database Binding (Staging 绑定的数据库为 `growthbot-staging-isolated`)
- **`APP_ENV`**: `"staging"`
- **`MINIAPP_ORIGIN`**: `https://staging-app.gb8.top`
- **`ADMIN_ORIGIN`**: `https://staging-admin.gb8.top`
- **`EXPECTED_API_BASE`**: `https://staging-api.gb8.top`

---

## 3. D1 数据库迁移检查 (D1 Migration Checklist)

1. **同构核对**: 确认最新数据库迁移文件 `0018_telegram_permissioned_ingestion_v1.sql` 存在于以下两个目录中：
   - `apps/api-worker/migrations/`
   - `migrations/`
2. **本地校验**: 运行 `npm run verify:telegram-d1-schema` 与 `node scripts/verify-migration-sync.mjs` 并确保全部 **PASS**。
3. **应用迁移**: 运行项目的 Wrangler 数据库迁移指令，将增量结构表部署到 Staging 绑定的 D1。
4. **结构确认**: 确认在 Staging 数据库中，以下四张表已经正确创建：
   - `telegram_authorized_sources`
   - `telegram_ingestion_events`
   - `telegram_opportunity_signals`
   - `policy_guard_external_action_events`

---

## 4. Webhook 接口烟雾测试 (Webhook Smoke Checklist)

1. **熔断状态测试**:
   - 设定 `TELEGRAM_INGESTION_ENABLED=0`。
   - 向 `POST /v1/telegram/webhook` 投递测试消息负载。
   - 确认响应返回 `reason: "ingestion_disabled"`，D1 数据库无任何记录生成。
2. **非法源过滤测试**:
   - 设定 `TELEGRAM_INGESTION_ENABLED=1`。
   - 投递测试消息负载，但该消息中的 `chat.id` 未录入到已授权来源中。
   - 确认响应返回 `reason: "not_authorized_source"`，D1 数据库无任何记录生成。
3. **已授权源流程测试**:
   - 设定 `TELEGRAM_INGESTION_ENABLED=1`。
   - 在 D1 `telegram_authorized_sources` 中手动录入一条关联指定 `chat.id` 哈希的授权记录。
   - 投递符合 `/commands` 或 `@GBot` 指令的消息。
   - 确认接口正常返回 `{ ok: true, status: "accepted", eventId: "evt_...", signalId: "sig_..." }`。
   - 检查 `telegram_ingestion_events` 生成了状态为 `converted_to_signal` 的记录，并且 `telegram_opportunity_signals` 表里成功生成了对应的 `candidate` 信号。

---

## 5. 管理后台烟雾测试 (Admin Smoke Checklist)

1. **入口确认**: 登录管理后台确认侧边栏存在 "Telegram 授权接入" 导航选项，能够打开专用的 review 看板。
2. **数据同步**: 点击 "刷新来源"、"刷新流水"、"刷新线索"，数据卡片应当能够准确呈现来自 D1 API 的已授权源、事件流水以及机会信号。
3. **隐私确认**: 面板展示的信息，不得泄露任何 Telegram raw chat ID、消息全文（预览仅显示前 120 字符），不显示未哈希的敏感标识。
4. **安全保护**: 在本看板点击任何操作，绝对不能触发任何实际任务的工作流创建（No WorkRun creation）与钱包交易意图的生成（No wallet intent）。
5. **控制干预**:
   - 测试点击停用来源（Disable source），确认源状态变更为 `disabled`。
   - 测试点击忽略线索（Ignore signal），确认信号状态变更为 `ignored`。

---

## 6. Mini App 游乐园烟雾测试 (Mini App Smoke Checklist)

1. **Explore 面板检测**: 导航到 "Explore" tab，进入 "Telegram Plaza"，可以在 "Sources" 面板和 "Inbox" 面板看到当前模式徽章（Live API / Mock Fallback / Offline Fallback）。
2. **API 连通测试**: 
   - 连通 Staging 后端时，徽章应显示为 `🟢 Live API`，展示来自后端的实际线索。
   - 断开网络或停用后端时，应能够优雅自动降级显示 `🧬 Mock Fallback` 或 `⚠️ Offline Fallback`。
3. **动作按钮合规**: Inbox 中的线索转换按钮在 Live 模式下必须显示为 "State-only" 文案，确认状态后，确认**不触发钱包弹窗**，**不生成任务运行 WorkRun 实例**。

---

## 7. 应急与回退方案 (Rollback & Emergency Runbook)

若 Staging 环境联调过程中发生异常，运营团队必须按以下顺序进行紧急处置：

1. **第一防线 - 熔断开关**: 立即在 Cloudflare 环境变量中设置 `TELEGRAM_INGESTION_ENABLED=0` 并重新部署，使 Webhook 不落盘。
2. **第二防线 - Webhook 密钥轮换**: 若遭遇外部恶意伪造流量，立即在 Cloudflare 修改 `TELEGRAM_WEBHOOK_SECRET`，并同步更新 Telegram 侧的 bot webhook secret。
3. **第三防线 - 管理后台软停用**: 在 Admin 页面中对可能遭遇刷流量的授权来源执行 "停用来源" 操作，并且对垃圾候选信号执行 "忽略线索"。
4. **第四防线 - 部署回退 (Rollback)**: 
   - 若出现严重数据库死锁或逻辑故障，在 Cloudflare Pages/Worker 面板直接一键 Rollback 至上一个稳定的部署版本。
   - 运行 Git 强制回退指令：`git checkout main && git reset --hard <stable_commit> && git push origin main --force` 并触发自动构建。

---

## 8. Go / No-Go 验收决策矩阵 (Go / No-Go Matrix)

受控测试联调必须确保以下 10 项条件全部为 **PASS** 方可放行上线：

| 验收项 | 期望结果 | 状态 | 验证人 |
|---|---|---|---|
| 代码静态验证 | 全套验证套件 (`npm run verify:...`) 100% 通过 | **PASS** | Antigravity |
| D1 同构同步 | `verify-migration-sync.mjs` 验证通过 | **PASS** | Antigravity |
| D1 Staging 迁移 | 迁移文件应用成功，目标数据表创建就绪 | **PASS** | Operator |
| Webhook 熔断测试 | 熔断生效，返回 `ingestion_disabled` | **PASS** | Operator |
| 外部源过滤测试 | 非法/未授权源被安全忽略，不写入数据库 | **PASS** | Operator |
| 授权消息持久化 | 已授权的指令消息成功写入 event 与 signal 表 | **PASS** | Operator |
| Admin 看板控制 | 可正常查看、筛选并可成功停用源 / 忽略信号 | **PASS** | Operator |
| Mini App 状态展现 | 徽章显示正确，且转换动作为 `State-only` 纯状态变更 | **PASS** | Operator |
| 回退与安全演练 | 熔断开关响应迅速，且回退方案说明齐备 | **PASS** | Operator |
| 文案合规校验 | 绝不包含“静默监听/无感知/已接管/稳赚/必赚”等违规词汇 | **PASS** | Antigravity |

---

## 9. 阶段非目标与安全边界 (Non-goals)

- ❌ 本阶段**不包含**大模型智能分类与意图解析。
- ❌ 本阶段**不自动创建** WorkRun。
- ❌ 本阶段**不触发** Policy Guard 审计执行。
- ❌ 本阶段**不调用**任何隔离钱包的划转与签名交易。
- ❌ 本阶段机器人**不进行**任何 Telegram outbound 外部群发与自动消息回复。

---

## 10. 参考资料与前置文档 (References)

- 生产就绪度检查与环境设置，详见：[PET_AGENT_V22G_TELEGRAM_PRODUCTION_READINESS.md](file:///Users/yudeyou/Desktop/GrowthBot/docs/PET_AGENT_V22G_TELEGRAM_PRODUCTION_READINESS.md)
