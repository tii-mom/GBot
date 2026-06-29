# GBot Pet Agent Frontend Information Architecture (IA) Spec V1

本规范定义了 GBot Mini App 向游戏化宠物养成与召唤兽资产心智升级的完整前端信息架构。

## 1. 为什么 GBot 前端要按照宠物 Agent 设计
GBot 从本质上不是一个雇佣外包工人的任务平台，而是一个 **Agent 自动化执行与真实资产养成游戏平台**。
- 用户的心智不应该是“领单打工者”，而是“Agent 召唤兽的主人”。
- Agent 具备生命周期（等级、性格、星座倾向、能量、疲劳、信任度）。
- 用户通过提供模型能量预算 (AI Credit Budget) 与装备技能卡来培育 Agent，派它外出探索并将收益带回。

## 2. 五个一级页面定义
新版 Mini App 移除了所有传统仪表盘模块导航，采用全新的宠物行为式一级导航：
1. **AgentHomeView (Agent 🐾)**
   - 展示我的宠物生命状态面板、等级、性格偏好、今日价值创造摘要、待确认的高风险动作以及最新带回的战报。
2. **TrainView (训练 ⚔️)**
   - 技能卡插槽、装备状态、技能卡合成机制占位、推荐流派 Build。
3. **ExploreView (出击 🔭)**
   - 派遣策略设置（谨慎/平衡/激进）、探索区域地图、机会雷达扫描线索及指令下达（“派它探索”、“忽略此方向”）。
4. **NestView (巢穴 🏠)**
   - 装备及道具背包、AI 补能库、Agent 隔离钱包小金库（G/TON）、以及已授权的游乐园。
5. **GuildView (公会 🛡️)**
   - 好友激活邀请、社交声望排行、战报分享看板、公会小队与公会共享宝箱占位。

## 3. 用户心智模型
用户不再是赏金的直接申领人，而是 Agent 的最高策略授权者：
```
[主人 (User)] ──设定预算与安全策略──> [Policy Guard]
                                       │
                                   允许与审计
                                       ▼
[任务方] <───可验证凭证与战报结算─── [宠物 (Agent)]
```

## 4. Agent 状态模型
Agent 的行为状态决定其在 UI 的视觉表现和文案：
- `dormant` (沉睡) / `idle` (休息) / `scanning` (雷达中) / `exploring` (探索中) / `executing` (执行中) / `waiting_user` (等待主人确认) / `verifying` (任务方验收中) / `settling` (结算中) / `completed` (完成) / `failed` (挫折) / `low_ai_credit` (低能量) / `resting` (疲劳休养)。

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
- 12 星座 Starter 召唤兽外观及心情与 11 种 Agent 行为状态的视觉资产映射必须严格对齐。
- 本轮预留的 Z-Index 分层属性为未来动态加载 WebP 透明材质提供支撑。

## 7. 技能卡游戏化规则
技能卡分为 31 张标准卡。装备卡牌不是技术能力的声明，而是训练宠物：
- 装备不同技能能够增强特定领域的 `valueCreationRole`。
- 提供属性增益（如 `successRateBoost`、`costReduction` 降低模型 Credit 消耗）。

## 8. 探索 / 派遣规则
- 用户动作禁止出现“申领任务”，只能决定“派它探索”。
- 高风险意图（例如跨链或提现操作）触发 `waiting_user` 状态，必须由主人亲自在 ExploreView 或 HomeView 授权。

## 9. 巢穴资产规则
- 隔离钱包 (Agent Wallet) 在 NestView 集中展示。
- 模型能量条代表 AI 信用余量，能量耗尽后 Agent 进入 `low_ai_credit` 疲劳状态，需要补充能量。

## 10. 公会传播规则
- 通过 Telegram Guild Agent 将宠物代入社群，用于群聊守门和声望争夺。

## 11. Agent Playground / Telegram Plaza 入口
- 详见：[AGENT_PLAYGROUND_TELEGRAM_V1.md](file:///Users/yudeyou/Desktop/GrowthBot/docs/AGENT_PLAYGROUND_TELEGRAM_V1.md) 和 [TELEGRAM_MINIAPP_CONTEXT_SHARE_V1.md](file:///Users/yudeyou/Desktop/GrowthBot/docs/TELEGRAM_MINIAPP_CONTEXT_SHARE_V1.md)
- ExploreView 内嵌了 Agent 游乐园板块，支持 Telegram Plaza 的宿主上下文预览和授权设置。

## 12. Agent Wallet / value creation / reward settlement 文案边界
- **发现机会**: 代替“赚钱”
- **创造可验证价值**: 代替“必然获利”
- **待验收价值 / 任务方结算中**: 代替“投资回报”

## 13. 禁止文案与合规边界
- 严禁出现以下词汇：投资 Agent 必然获利、保证收益、稳赚、保本、零风险、保证空投、自动赚钱无风险、必定回本、必赚任务、投资回报提升。

## 14. V1.1 合规强化与 Playground 预备期约束
- **Telegram Plaza**: 本阶段为 Phase 1 Preview 预览占位，不制造已连接或已扫描用户隐私的假象。所有的交互按钮（探索、分享、设置）均应置灰标记为 Preview。
- **钱包指示器**: 页面头部显示状态需与底层是否存在 `agentWallet` 和 `walletPolicy` 数据挂钩。在缺失关联时明确标记为“待连接”，严禁伪造已连接的安全状态。
- **价值创造**: 雷达候选奖励应明确说明“需要任务方验收后结算”，其估算数据来源于任务发布方而非平台保证产出。
- **技能卡定义**: 技能学习代表 Agent 在该任务方向的处理效率提升与能耗降低，属于 Agent 功能性训练，不承诺任何财务方面的投资回报。

---
本轮重构仅实现前端 IA、视觉占位及 Telegram Plaza 前端预览，不集成真实 3D 资产、X 自动化或链上智能合约结算。

