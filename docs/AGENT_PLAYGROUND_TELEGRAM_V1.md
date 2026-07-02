# GBot Agent Playground: Telegram Integration Spec V1

本规范定义了 GBot 探索雷达中最核心的外部交互游乐场——**Telegram 游乐园 (Telegram Plaza)**。

## 1. Agent Playground 定义
Agent Playground（游乐园）是 Agent 依靠其所配备的技能卡，在用户设定的安全 Policy Guard 下，外出整理任务线索、安全事件与社交趋势的外部数据源和运行时环境。

## 2. 为什么 Telegram 是 GBot 首期最重要的游乐园
GBot 是 Telegram-native Web3 生态系统。
- 绝大多数任务的发布方（官方、社区、KOL）均以 Telegram 频道或群组作为其首要发布和活动渠道。
- Telegram 官方提供的 Mini App SDK、直接启动参数 (startapp) 和丰富的 Bot 交互能让 Agent 实现极低开销的轻量化交互。

## 3. Agent 与 Bot 的区别
- **普通 Telegram Bot**: 被动的被呼叫工具，完全依赖固定的斜杠命令或按钮回调，没有自主决策。
- **GBot Pet Agent**: 拥有自主策略的主动探索体。它可以分析接收到的数据，向用户申请 Intent 预算，决定何时何地执行交互，并在 Policy Guard 守卫下完成凭证上报。

## 4. Telegram 官方能力映射
为了符合 Telegram 原生规范，Agent 充分利用以下平台机制：
- **Main Mini App**: 主入口界面，即当前宠物养成 UI。
- **startapp / direct links**: 允许用户直接将战报或公会密钥以参数化链接形式分享。
- **Guest Bots & Bot-to-Bot Communication**: 与官方守护 Bot 握手，由后台验证数据而无需前端常驻。
- **Stars / Gifts**: 预留未来对小金库打赏的展示通道。

## 5. 可做能力 (Allowed Scopes)
- **@GBot Guest Agent**: 在被拉入的群聊或频道中，读取被 @ 提及的内容并分析线索。
- **Telegram Opportunity Radar**: 从用户授权的白名单频道中提取任务线索并呈现在出击雷达中。
- **Group Guardian (群守门)**: 公会群安全过滤器，识别欺诈链接。
- **Work Report Share Card**: 允许用户将带回的战报生成精美 WebP 并一键分享至聊天上下文。

## 6. 不可做能力 (Prohibited Scopes - Safety Guard)
- **无授权读取私聊**: 严禁在未经用户显式确认前读取或监听任何个人对话。
- **自动群发/私信陌生人**: 严禁进行滥用 Telegram 的私信拉客或群内垃圾信息轰炸行为。
- **未经授权的抓取**: 严禁绕过 Telegram Bot API 限制强行抓取非公开社群聊天记录以进行 AI 训练。

## 7. 用户授权模型
所有与外部群聊交互的动作，必须在 ExploreView 中明确标记授权状态，例如：
`Telegram Plaza · 等待授权`
- 遵循“仅处理授权数据，绝不扫描全频道，不破坏用户私密空间”的原心智。

## 8. 群权限模型
当 Agent 进入公会群组充当守门人时，其权限严格受群主所分配的 Admin 角色限制，不越权、不篡改聊天设置。

## 9. Opportunity Radar 数据模型
雷达所捕获的每一个机会，其数据契约包含：
- 匹配度、预计 Credit 消耗、预计待结算奖励、风险评级、Agent 装备推荐。

## 10. Work Report Telegram 分享模型
战报分享通过标准 Telegram Inline Query 或 WebApp Share 接口调起，禁止静默后台分发。

## 11. Agent Wallet / transaction intent / Policy Guard 边界
- 所有的链上或者数据交互动作必须先转化为 JSON 形式的 `OnchainTransactionIntent`。
- 只有经过 Policy Guard 与预算检查后，低风险行为才可进入执行流程，高风险行为必须悬挂等待用户二次点击授权。

## 12. 后续 X / Web / TON 扩展边界
- 规划中的 X (Twitter) 监听雷达、Web3 网页爬虫、以及链上热度扫描地图（TON Map）均仅作界面预留，在后续版本中按需发布。

## 13. V1.1 授权状态和权限说明
- **Awaiting Authorization**: 页面上必须声明 Telegram 处于未授权或预览就绪状态。
- **无越权监控**: Agent 不存在对所有群聊历史消息的默默读取。它只能在获得群管理或者被 @ 提及的显式交互下触发。
- **防止陌生人侵入**: 坚决禁止自动私聊和陌生人主动营销推流，这是 Telegram 平台对机器人的红线政策。

---
**关联参考文档：**
- [PET_AGENT_FRONTEND_IA_V1.md](file:///Users/yudeyou/Desktop/GrowthBot/docs/PET_AGENT_FRONTEND_IA_V1.md)
- [REAL_ASSET_AGENT_V1.md](file:///Users/yudeyou/Desktop/GrowthBot/docs/REAL_ASSET_AGENT_V1.md)
- [AI_MODEL_TOKEN_PURCHASE_V1.md](file:///Users/yudeyou/Desktop/GrowthBot/docs/AI_MODEL_TOKEN_PURCHASE_V1.md)
