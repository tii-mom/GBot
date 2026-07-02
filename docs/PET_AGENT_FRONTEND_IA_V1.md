# GBot Pet Agent Frontend Information Architecture (IA) Spec V1

本规范定义了 GBot Mini App 向 Agent 养成式交互与真实资产授权任务控制台升级的完整前端信息架构。

## 1. 为什么 GBot 前端要按照宠物 Agent 设计
GBot 从本质上不是一个雇佣外包工人的任务平台，而是一个 **Agent 自动化执行与真实资产授权任务平台**。
- 用户的心智不应该是“领单者”，而是 Agent 的策略授权者。
- Agent 具备生命周期（等级、性格、星座倾向、能量、疲劳、信任度）。
- 用户通过提供模型能量预算 (AI Credit Budget) 与装备技能卡来培育 Agent，派它外出发现机会、执行授权任务、创造可验证价值，并等待任务方验收或结算结果。

## 2. Agent Game HUD 与隐藏式一级导航
新版 Mini App 移除了常驻底部 Tab 与传统仪表盘模块导航，采用 **Agent 主屏优先 + 点击展开的隐藏式侧边菜单**。

### 2.1 AgentHomeView 是默认主屏
AgentHomeView 必须像移动养成游戏主屏，而不是数据后台。首屏只展示：
- Agent 形象、等级、当前状态与小金库状态。
- Token / 模型能量、已获取 G、TON / 预算、今日行动次数等游戏化状态条。
- 已装配技能槽，包含已装备、空槽、待解锁三态。
- 一个唯一主操作：派 Agent 外出发现机会。
- 今日简报与最近战报的轻量摘要。

AgentHomeView 不得重新堆回完整技能卡图鉴、复杂四宫格统计、长篇产品说明或传统工作台式模块。

### 2.2 隐藏式侧边菜单
一级导航只在用户点击菜单按钮时出现，平时隐藏。菜单固定包含五个入口：
1. **Agent 主屏**
   - Agent 状态、装备槽、状态条、主派遣按钮、今日简报、最近战报。
2. **技能商店**
   - 三档技能卡外观、购买入口、装备状态、合成/升级占位。
3. **去赚钱**
   - 派遣策略设置、探索区域、机会线索、需要用户确认的高风险动作。
4. **小金库**
   - Agent 隔离钱包资产、AI 补能库、G/TON、预算 Policy、已授权来源。
5. **公会**
   - 好友激活邀请、社交声望排行、战报分享看板、公会小队与共享宝箱占位。

侧边菜单顶部必须显示 Agent 小头像、等级和 G 余额；点击任一入口后菜单自动关闭。不得新增常驻底部 Tab。

## 3. 用户心智模型
用户不再是赏金的直接申领人，而是 Agent 的最高策略授权者：
```
[用户 (User)] ──设定预算与安全策略──> [Policy Guard]
                                      │
                                  允许与审计
                                      ▼
[任务方] <───可验证凭证与战报结算─── [Agent]
```

## 4. Agent 状态模型
Agent 的行为状态决定其在 UI 的视觉表现和文案：
- `dormant` (沉睡) / `idle` (休息) / `scanning` (雷达中) / `exploring` (探索中) / `executing` (执行中) / `waiting_user` (等待用户确认) / `verifying` (任务方验收中) / `settling` (结算中) / `completed` (完成) / `failed` (挫折) / `low_ai_credit` (低能量) / `resting` (疲劳休养)。

## 5. AgentAvatarStage 预留设计
为未来的星座皮肤、多层叠加动态纸娃娃系统预留分层 DOM 结构：
```html
<div className="agent-avatar-stage" data-state={profile.state} data-zodiac={profile.zodiac}>
  <div className="agent-layer agent-layer--aura" />
  <div className="agent-layer agent-layer--base" />
  <div className="agent-layer agent-layer--outfit" />
  <div className="agent-layer agent-layer--expression" />
  <div className="agent-layer agent-layer--accessory" />
</div>
```
- 本轮只使用纯 CSS 渐变、emoji 及呼吸缩放动画表现其生命状态，不包含真实 2.5D 美术切片。

## 6. 如何对齐 PET_AGENT_VISUAL_SYSTEM_V1.md
详细对齐要求参见：[PET_AGENT_VISUAL_SYSTEM_V1.md](file:///Users/yudeyou/Desktop/GrowthBot/docs/PET_AGENT_VISUAL_SYSTEM_V1.md)
- 12 星座 Starter Agent 外观及心情与 11 种 Agent 行为状态的视觉资产映射必须严格对齐。
- 本轮预留的 Z-Index 分层属性为未来动态加载 WebP 透明材质提供支撑。

## 7. 技能卡游戏化规则
技能卡分为 31 张标准卡。装备卡牌不是技术能力的声明，而是训练 Agent：
- 装备不同技能能够增强特定领域的 `valueCreationRole`。
- 提供属性增益（如 `successRateBoost`、`costReduction` 降低模型 Credit 消耗）。
- 首页只显示 3-4 个装备槽摘要；完整 31 张技能卡图鉴、三档卡外观和购买动机必须放在 TrainView。
- 装备槽状态包括：已装备、空槽、待解锁。空槽点击进入技能商店，待解锁槽只展示成长目标。

## 8. 探索 / 派遣规则
- 用户动作禁止出现“申领任务”，只能决定“派它探索”。
- 高风险意图（例如跨链或提现操作）触发 `waiting_user` 状态，必须由用户亲自在 ExploreView 或 HomeView 授权。

## 9. 巢穴资产规则
- 隔离钱包 (Agent Wallet) 在 NestView 集中展示。
- 模型能量条代表 AI 信用余量，能量耗尽后 Agent 进入 `low_ai_credit` 疲劳状态，需要补充能量。

## 10. 公会传播规则
- 通过 Telegram Guild Agent 将 Agent 带入社群，用于群聊守门、战报分享和公会声望系统。

## 11. Agent Playground / Telegram Plaza 入口
- 详见：[AGENT_PLAYGROUND_TELEGRAM_V1.md](file:///Users/yudeyou/Desktop/GrowthBot/docs/AGENT_PLAYGROUND_TELEGRAM_V1.md) 和 [TELEGRAM_MINIAPP_CONTEXT_SHARE_V1.md](file:///Users/yudeyou/Desktop/GrowthBot/docs/TELEGRAM_MINIAPP_CONTEXT_SHARE_V1.md)
- ExploreView 内嵌了 Agent 游乐园板块，支持 Telegram Plaza 的宿主上下文预览和授权设置。

## 12. Agent Wallet / value creation / reward settlement 文案边界
- **发现机会**: 代替“赚钱”
- **创造可验证价值**: 代替“必然获利”
- **待验收价值 / 任务方结算中**: 代替任何财务回报承诺。

## 13. 禁止文案与合规边界
- 严禁使用任何“财务承诺、固定式回款、风险不存在、无需确认即产生收益、确定性空投或回本”的表达。
- 首页可以使用“派 Agent 赚钱”作为游戏化 CTA，但收益说明必须落在“发现机会、待验收、待结算、可验证战报”语义内，不得承诺确定收益。

## 14. V1.1 合规强化与 Playground 预备期约束
- **Telegram Plaza**: 本阶段为前端占位与授权源预备入口，不制造已扫描用户隐私的假象。所有未接入的外部能力必须明确标记为“待开放”或“等待授权”。
- **钱包指示器**: 页面头部显示状态需与底层是否存在 `agentWallet` 和 `walletPolicy` 数据挂钩。在缺失关联时明确标记为“待连接”，严禁伪造已连接的安全状态。
- **价值创造**: 雷达候选奖励应明确说明“需要任务方验收后结算”，其估算数据来源于任务发布方而非平台保证产出。
- **技能卡定义**: 技能学习代表 Agent 在该任务方向的处理效率提升与能耗降低，属于 Agent 功能性训练，不承诺任何财务方面的回报。

---
本轮重构仅实现前端 IA、视觉占位及 Telegram Plaza 前端授权入口，不集成真实 3D 资产、X 自动化或链上智能合约结算。
