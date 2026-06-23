# GrowthBot Agent Growth Proof System — Master Plan

> 文档状态：规划基线（Master Plan）  
> 适用仓库：`/Users/yudeyou/Desktop/GrowthBot`  
> 当前代码基线：`main@bd5ff50c05046631fa74d3cd548e9738fc2309d9`  
> 已合并：PR #8 Skill Runtime Lite V1、PR #9 Workflow Runtime Settlement Gate  
> 当前开发中：PR #10 Research Brief Runtime V1  
> 本文档定义 PR #10 至 PR #16+ 的产品方向、技术边界、数据资格、实施顺序与验收原则。

---

## 1. 文档目的

GrowthBot 已经拥有 Agent、技能卡、技能槽、任务、工作流、Skill Runtime、Recovery、结算门、积分、盲盒、市场、战队、排行和 Agentic Wallet 预留。下一阶段不应继续增加宠物、装备耐久、繁殖、土地、复杂属性树或第二套经济系统，而应把现有真实工作数据转化为可验证的 Agent 成长资产。

本规划定义一个统一的：

> **Agent 成长证明系统（Agent Growth Proof System）**

它不是一套新的游戏经济，而是对真实 Agent 工作事件的可信投影，用于回答四个问题：

1. Agent 真正做过什么？
2. Agent 擅长什么？
3. Agent 是否可靠？
4. Agent 因此可以获得哪些真实机会？

---

## 2. 当前代码基线

### 2.1 已有 Agent 基础

当前 `agents` 及相关 API 已覆盖：

- `level`
- `energy`
- `max_energy`
- `pending_points`
- `rank_tier`
- `status`
- `active_work_run_id`
- `daily_run_count`
- `daily_run_limit`

这些字段继续用于 Agent 基础状态，不承担完整的能力证明职责。

### 2.2 已有工作流基础

当前 Agent Workflow 已实现八步状态机：

1. `analyze`
2. `qualify`
3. `plan`
4. `prepare_output`
5. `wait_user_confirm`
6. `submit`
7. `verify`
8. `settle`

核心事实表包括：

- `agent_work_runs`
- `agent_work_steps`
- `work_run_settlements`

已有能力包括：

- 状态转换白名单
- pause / resume
- retry
- terminal state 保护
- exact-once settlement
- Agent active run 管理
- daily run limit

### 2.3 已有 Skill Runtime 基础

PR #8 已提供：

- `skill_runtime_executions`
- `task_skill_runtime_usages`
- `skill_runtime_versions`
- Runtime checksum
- Tool policy
- required / recommended / fallback 技能解析
- Token 使用量
- 模型名称
- 估算成本
- 幂等键
- failed / timed_out 状态
- immutable Recovery execution
- `parent_execution_id`
- `recovery_of_execution_id`
- `attempt_number`

### 2.4 已有 Runtime Settlement Gate

PR #9 已提供：

- `agent_work_runs.execution_mode`
- `work_step_runtime_executions`
- Runtime 与 Work Step 绑定
- same user / same agent / same run 约束
- completed Runtime 才允许结算
- failed / timed_out / missing / cross-agent / verification failed 均阻断
- valid Runtime 只允许结算一次
- simulated Workflow 不发真实 GP

`execution_mode` 当前允许：

- `simulated`
- `runtime`
- `external`

### 2.5 已有前端基础

Mini App 已有：

- `HomeView`
- `AgentWorkView`
- `SkillSlotsView`
- `InventoryView`
- `MarketplaceView`
- `LeaderboardView`
- `GroupPoolView`
- `AgentStudioView`
- `StoreView`
- `EarnView`

因此后续不应新增大量底部导航，而应优先扩展现有 `AgentWorkView`，并新增一个聚合型 `AgentProfileView`。

---

## 3. 产品目标与非目标

## 3.1 产品目标

Agent Growth Proof System 要实现：

- 真实工作可观察
- 真实能力可证明
- 技能使用有长期价值
- 成长来源可审计
- 指标可以重算
- 规则可以版本化
- 稀缺机会来自真实供给
- 项目方最终可以筛选可信 Agent

## 3.2 非目标

本阶段不建设：

- 宠物系统
- Agent 繁殖
- 土地与基地
- 装备耐久
- 复杂属性树
- 多层升星
- 第二种积分
- Skill 熟练度交易
- Trust 付费提升
- Streak 无限付费保护
- Agent 战斗
- 虚假在线人数
- 虚假成交与虚假收益动态

已有技能升级、重置、合成能力可以保留，但近期不继续扩张其层级与材料体系。

---

## 4. 总体四层架构

```text
第一层：真实事件层
第二层：成长投影层
第三层：表现展示层
第四层：机会资格层
```

### 4.1 第一层：真实事件层

真实事件层是唯一事实来源，继续复用现有表：

- `agent_work_runs`
- `agent_work_steps`
- `skill_runtime_executions`
- `task_skill_runtime_usages`
- `work_step_runtime_executions`
- `work_run_settlements`
- `point_ledger_events`
- 市场成交事件
- 背包与开盒事件
- 后续 Badge grant 事件

不得为了成长系统复制一套平行工作事实表。

### 4.2 第二层：成长投影层

从真实事件计算：

- Agent 能力档案
- 技能熟练度
- 动态专精
- Streak
- Trust

这些不是五套独立经济，也不应是五套独立状态机。V1 应优先采用只读聚合，允许删除和重算。

### 4.3 第三层：表现展示层

用于用户理解和社会证明：

- 工作战报
- Runtime 时间线
- Agent 能力档案页面
- 徽章
- 排行榜扩展
- 真实动态流
- 分享文本与分享卡片

### 4.4 第四层：机会资格层

在成长投影稳定后，才逐步影响：

- 任务推荐排序
- 默认任务过滤器
- 高价值任务资格提示
- 技能组合任务
- 项目赛季
- 限量任务席位
- 项目方 Agent 人才池

第一版不得直接影响 GP 奖励倍率。

---

## 5. 有效成长事件统一资格

所有成长指标必须复用同一资格定义，禁止每个模块自行编写不同 SQL 口径。

### 5.1 正式计入条件

一个 Work Run 只有同时满足以下条件，才可以计入正式成长：

- `execution_mode IN ('runtime', 'external')`
- `agent_work_runs.status = 'completed'`
- verify step 最终为 completed / passed
- 结算流程已完成，或明确标记为合法 `no_reward` 结算
- Runtime 与当前 Work Step 存在合法绑定
- Runtime execution 最终状态为 completed
- Work Run、Runtime、User、Agent 所属关系一致
- 不存在未解决 dispute
- 不属于测试环境或 Fake Provider 正式数据

### 5.2 永不计入的数据

- `execution_mode = 'simulated'`
- `APP_ENV = test` 产生的测试记录
- `DeterministicFakeProvider` 产生的正式业务记录
- 未完成 Work Run
- cancelled Work Run
- verification failed
- failed 且 Recovery 最终未成功
- unresolved dispute
- 管理员演示数据
- mock fallback 数据

### 5.3 建议统一实现

后端应提供单一内部规则：

```ts
isEligibleGrowthRun(runContext)
```

或者统一的 SQL view / query builder。能力档案、熟练度、专精、Streak、Trust 必须全部复用。

### 5.4 历史数据边界

- simulated 历史永不计入
- runtime 历史仅计入满足正式资格且在 Growth V1 起始时间之后的数据
- external 仅在项目方 API 或人工审核通过后计入

建议定义系统起始配置：

```text
AGENT_GROWTH_V1_START_AT
```

避免旧测试与演示数据污染。

---

## 6. 数据与规则治理原则

### 6.1 事实与投影分离

```text
事实表：不可因算法变化而修改
投影：可删除、可重算、可升级版本
```

### 6.2 指标资格状态

所有成长指标必须返回资格状态：

- `insufficient_data`
- `provisional`
- `established`
- `under_review`
- `restricted`

样本不足时禁止强行生成 S/A/B 等评级。

### 6.3 规则版本

至少保留：

- `profile_projection_version`
- `skill_proficiency_rule_version`
- `specialization_rule_version`
- `streak_rule_version`
- `trust_rule_version`

建议输出：

```ts
{
  ruleVersion: "agent_trust_v1",
  calculatedAt: "...",
  sampleSize: 28,
  status: "established"
}
```

### 6.4 第一版影响边界

PR #12 的所有成长指标必须：

- 只读
- 可重算
- 不直接修改 GP
- 不改变任务奖励
- 不改变盲盒掉率
- 不改变市场价格
- 不改变 Settlement
- 不生成不可逆链上资产

---

## 7. PR 路线总览

```text
PR #10  Research Brief 真实 Runtime 闭环
PR #11  工作战报与 Runtime 可观察执行
PR #12  Agent Growth Proof V1
PR #13  技能组合与可验证徽章
PR #14  真实动态流与分享
PR #15  成长结果影响任务推荐与资格提示
PR #16+ 赛季、限量席位、项目方人才池
```

各 PR 必须独立验收，不得跨阶段提前混入后续功能。

---

## 8. PR #10 — Research Brief 真实 Runtime 闭环

### 8.1 目标

完成第一种真实、可验证、可结算、可恢复、可审计的 Agent 工作类型：

```text
Research Brief
```

### 8.2 完整流程

```text
创建 Research Brief 任务
→ 检查 Agent 必需技能
→ 创建 execution_mode=runtime 的 Work Run
→ analyze / qualify / plan
→ prepare_output 调用 Skill Runtime
→ 保存结构化结果
→ 用户确认
→ submit
→ 服务端 verify
→ Settlement Gate
→ exact-once GP
```

### 8.3 必须完善

- Research Brief 使用共享强类型，不继续只用 `Record<string, unknown>`
- Production 与 Test Mode 严格隔离
- Fake Provider 仅能在合法测试路径使用
- Fake Provider 数据不得形成真实 GP 或成长
- 服务端验证字段类型、文本长度、JSON 大小、URL、来源数量与 fact/judgment 结构
- Runtime completed 不等于任务完成
- verify passed 后才允许 settle
- Runtime 失败使用 PR #8 immutable Recovery 模型
- 原 failed execution 不得修改为 completed
- Recovery 创建新 execution
- 使用 `recovery_of_execution_id`
- `work_step_runtime_executions.purpose = 'recover'`
- 明确最终有效 Runtime execution
- Recovery 成功后只结算一次
- 两份 `0016` migration 完全同步

### 8.4 建议共享类型

```ts
interface ResearchBriefResult {
  summary: string;
  coreProduct: string;
  targetUsers: string;
  businessModel: string;
  teamBackground: string;
  competition: string;
  risks: string;
  sources: ResearchSource[];
  factVsJudgment: FactJudgmentItem[];
  recommendations: string[];
}
```

### 8.5 专项验证

新增：

```text
scripts/verify-research-brief-runtime.mjs
npm run verify:research-brief-runtime
```

至少覆盖：

- 成功路径
- 缺失 required Skill
- recommended Skill 选择
- Runtime execution 写入
- Skill usage 写入
- Work Step runtime link
- schema verification
- invalid source URL
- verification failed 不结算
- runtime failed 不结算
- recovery failed 不结算
- recovery success exact once
- idempotency conflict
- cross-user / cross-agent 阻断
- Production 不调用 Fake Provider

### 8.6 禁止混入

- Work Report 完整页面
- Agent 能力档案
- 熟练度
- 专精
- Streak
- Trust
- 徽章
- 动态流
- 赛季

---

## 9. PR #11 — 工作战报与 Runtime 可观察执行

### 9.1 目标

让用户清楚看到一次真实 Agent 工作发生了什么。

### 9.2 数据来源

直接聚合：

- `agent_work_runs`
- `agent_work_steps`
- `work_step_runtime_executions`
- `skill_runtime_executions`
- `task_skill_runtime_usages`
- `work_run_settlements`
- `point_ledger_events`

V1 不新建复杂 Work Report 事实表。

### 9.3 建议 API

```text
GET /work-runs/:runId/report
```

必须校验当前用户拥有该 Work Run。

### 9.4 战报内容

- Task / Work Run 基本信息
- execution mode
- Step timeline
- Runtime executions
- Skills used
- Runtime version
- Token 与成本
- Verification result
- Recovery chain
- Settlement result
- Final structured output

### 9.5 状态标识

必须清晰区分：

- `Simulation`：不计入正式履历
- `Verified Runtime Work`：计入正式履历
- `External Verified Work`：通过外部或人工验证

### 9.6 前端落点

优先扩展：

```text
apps/miniapp/src/components/AgentWorkView.tsx
```

不要新增底部 Tab。

### 9.7 分享原则

- 只分享真实数据
- 模拟战报必须显著标注 Simulation
- 不暴露钱包、隐私任务和完整敏感输出

---

## 10. PR #12 — Agent Growth Proof V1

### 10.1 目标

从真实事件生成统一、只读、可重算的 Agent 成长投影。

### 10.2 建议后端模块

```text
apps/api-worker/src/v1/agent-growth.ts
apps/api-worker/src/v1/agent-growth-rules.ts
```

避免继续把逻辑堆入 `core.ts`、`workflow.ts`、`skill-runtime.ts`。

### 10.3 建议统一 API

```text
GET /agents/:agentId/growth
```

返回：

- identity
- eligibility
- performance
- skill proficiency
- specialization
- streaks
- trust
- representative work
- rule versions

### 10.4 Agent 能力档案

V1 只展示硬数据：

- Agent ID
- 创建时间
- 有效任务数
- 验证通过任务数
- Verification Pass Rate
- Runtime Success Rate
- Recovery Success Rate
- Total Earned GP
- Runtime Cost
- Net Contribution
- Active Work Periods
- Skills Used
- 主要任务类型
- Representative Work

样本不足时显示数据积累状态，不显示 S/A/B。

### 10.5 技能熟练度

技能卡本身不升级，成长的是 Agent 对技能的真实使用经验。

仅三档：

- `new`
- `familiar`
- `mastered`

必须按独立有效 Work Run 去重，并考虑：

- 有效独立任务数
- 验证通过率
- Runtime 成功率
- Recovery 成功率
- 任务多样性
- 低价值重复比例

不得加入 XP、升星、突破、材料、熟练度交易。

### 10.6 动态专精

首期：

- `Researcher`
- `Operator`
- `Auditor`
- `Promoter`

`Scout` 延后到真实任务发现机制成熟之后。

计算窗口：

- 最近 30 个有效任务
- 或最近 60 天

输出主专精、次要倾向、贡献分布、样本量和规则版本。专精不得永久锁定。

### 10.7 Streak

首期保留：

- `verifiedTaskStreak`
- `successfulRecoveryStreak`
- `activeWorkPeriodStreak`

优先真实验证连续性，不做普通登录签到。

用户未登录、没有任务供给、项目方取消、模拟失败不应中断正式 Streak。

### 10.8 Trust V1

Trust 依据：

- 有效任务数量
- 验证通过率
- 争议率
- 异常提交率
- Recovery 最终结果
- 账户风险状态
- 历史持续时间
- 任务多样性
- 人工审核结果

Trust 不得受到以下因素影响：

- 充值
- 持币
- 盲盒购买
- 稀有技能购买
- 邀请人数本身
- 市场交易额
- VIP

Tier：

- `unproven`
- `verified`
- `reliable`
- `trusted`

普通失败应平滑影响；严重作弊可直接 `restricted`。

### 10.9 前端

新增：

```text
apps/miniapp/src/components/AgentProfileView.tsx
```

首页仅展示轻量成长概览，不把完整档案塞入 `HomeView`。

---

## 11. PR #13 — 技能组合与可验证徽章

### 11.1 技能组合

优先复用现有：

- required
- recommended
- fallback
- Runtime Version
- Tool Policy

组合应改变 Agent 的工作方式，而不是制造数值倍率。

允许：

- 增加 Review Step
- 启用更完整输出模板
- 启用来源一致性检查
- 启用 Recovery
- 解锁特定任务模板

禁止：

- GP +30%
- 成功率 +20%
- 成本 -50%
- 自动通过验证

### 11.2 徽章

建议新增轻量 `agent_badges` 表，字段至少包括：

- `id`
- `agent_id`
- `user_id`
- `badge_code`
- `source_type`
- `source_id`
- `rule_version`
- `granted_at`
- `revoked_at`
- `metadata_json`

首期徽章：

- first verified work
- 10 verified streak
- 5 successful recoveries
- 100 verified tasks
- research pioneer
- genesis agent

V1 不 NFT 化，不交易。

---

## 12. PR #14 — 真实动态流与分享

### 12.1 动态流来源

只能来自真实事件：

- Verified Work completed
- Recovery succeeded
- 真实市场成交
- Badge granted
- 真实 Season progress

建议 API：

```text
GET /activity-feed
```

不需要 WebSocket，页面打开和下拉刷新时聚合即可。

### 12.2 隐私

默认：

- 只显示 Agent 编号
- 不显示 Telegram 用户名
- 不显示钱包
- 不显示敏感任务详情
- 不显示完整 Research Brief

### 12.3 禁止

- 随机在线人数
- 模拟成交
- 模拟收益
- 人工伪造剩余名额
- 虚假高价值任务

---

## 13. PR #15 — 成长影响任务推荐与资格提示

这是成长结果第一次影响产品行为。

允许影响：

- 推荐任务排序
- 默认过滤器
- Agent Fit Score
- 资格提示
- 缺失技能解释

暂不允许影响：

- GP 奖励倍率
- Settlement
- 盲盒概率
- 市场价格

“预计成功率”统一改为：

- `Agent Fit Score`
- `Execution Readiness`
- `任务匹配度`

并展示解释：

- 必需技能匹配
- 同类任务样本量
- 同类验证表现
- 当前能量
- 风险等级

不得将 Fit Score 表述为成功承诺。

---

## 14. PR #16+ — 赛季、限量席位、项目方人才池

### 14.1 上线前置条件

- 至少两类稳定真实 Runtime 任务
- 足够真实用户
- 有真实项目方
- 有真实预算
- Verification 稳定
- Settlement 稳定
- Growth Profile 已运行并有样本
- Trust 规则稳定

### 14.2 项目赛季

复用现有任务，不建立第二套任务状态机。

赛季只是一层：

- 时间窗口
- 任务集合
- 个人 / 战队进度
- 排行
- 真实徽章与资格

### 14.3 限量席位

每个限量任务必须有真实：

- `project_id`
- `campaign_id`
- `budget`
- `capacity`
- `starts_at`
- `ends_at`
- `eligibility`
- `allocation_rule`

若做预占，必须使用数据库条件更新保证并发安全，不得先查后写。

### 14.4 项目方 Agent 人才池

项目方根据：

- 真实工作历史
- 专精
- Trust
- Skill proficiency
- Representative Work

筛选 Agent。该能力依赖前述所有层，必须最后建设。

---

## 15. Admin 后台规划

### PR #11

新增只读：

- Work Reports
- Runtime Executions
- Recovery Chain
- Verification Result
- Settlement Result

### PR #12

新增 Agent Growth Inspector：

- 有效任务数
- 被排除任务数
- 排除原因
- 规则版本
- Trust 依据
- 专精窗口
- 熟练度依据
- 触发重算
- 标记 under_review

管理员不得直接把 Agent 修改为 Trusted、Researcher 或 Mastered。

---

## 16. 数据库存储策略

### 16.1 V1 优先实时聚合

适合当前阶段：

- 用户规模尚小
- 规则仍会变化
- 指标需要重算

### 16.2 后续统一快照

性能需要时，可增加统一：

```text
agent_growth_snapshots
```

建议字段：

- `id`
- `agent_id`
- `user_id`
- `projection_version`
- `profile_json`
- `calculated_at`
- `source_event_cutoff`
- `status`

V1 不建议分别新建五张成长表。

---

## 17. 测试矩阵

### 17.1 数据资格

- simulated 不计入
- runtime completed + verified + settled 计入
- external verified 计入
- failed 不计入
- cancelled 不计入
- unresolved dispute 不计入
- dispute reversed 后可重算
- test provider 不计入

### 17.2 技能熟练度

- 同一 Work Run 不重复计数
- 同一 Skill 多步骤按规则去重
- Recovery Skill 独立统计
- 失败调用不直接提升
- 模拟调用不提升
- 低价值重复任务不能快速刷满

### 17.3 专精

- 最近 30 次窗口正确
- 60 天窗口正确
- 主专精可变化
- 次要倾向正确
- 样本不足为 provisional

### 17.4 Streak

- 连续验证成功增加
- Verification failed 中断
- 模拟失败不中断
- 用户不登录不中断
- 项目方取消不中断
- Recovery 最终成功保持
- Recovery 最终失败中断

### 17.5 Trust

- 充值不影响
- 持币不影响
- 稀有技能不影响
- 普通失败平滑影响
- 严重作弊 restricted
- 样本不足不显示高等级
- 规则升级可重算

### 17.6 战报

- 用户只能读取自己的报告
- Runtime chain 完整
- Recovery chain 完整
- Simulation 标识正确
- Settlement exact once
- 敏感字段不泄漏

---

## 18. 每个 PR 的统一退出门

基础命令：

```bash
npm run typecheck
npm run build
npm run verify:static-v1
```

并运行对应专项验证。

建议在所有专项脚本稳定后增加：

```text
npm run verify:all
```

但不得为了让总脚本通过而删除既有断言或降低标准。

---

## 19. 并行开发边界

### 可并行

在 PR #10 完成并合并后，可以并行进行：

- PR #11 后端 Work Report API 与前端视觉方案，但共享类型必须由一个主线程负责
- PR #12 规则文档、SQL 查询设计与 UI 信息架构
- PR #13 徽章规则设计与技能组合产品规格

### 不可并行修改同一核心文件

以下文件应设置单一所有者，避免多线程同时编辑：

- `apps/api-worker/src/v1/workflow.ts`
- `apps/api-worker/src/v1/skill-runtime.ts`
- `packages/shared/src/index.ts`
- 同一 migration 编号
- `apps/miniapp/src/apiClient.ts`
- `apps/miniapp/src/components/AgentWorkView.tsx`

### 必须串行的依赖

- PR #11 依赖 PR #10 的真实事件结构
- PR #12 依赖 PR #11/PR #10 的稳定口径
- PR #15 依赖 PR #12 指标稳定
- PR #16+ 依赖真实供给与 Trust 稳定

---

## 20. 完整产品闭环

```text
用户领取 Agent
→ 学习并装备 Skill
→ 执行真实任务
→ Skill Runtime 调用
→ 服务端 Verification
→ Settlement Gate
→ 生成工作战报
→ 真实事件进入成长投影
→ 形成熟练度、专精、Streak、Trust
→ Agent 能力档案展示长期履历
→ Skill Combo 改变工作方式
→ 徽章记录可验证成就
→ 动态流与分享形成社会证明
→ 成熟 Agent 获得更匹配的真实任务
→ 进入赛季、限量任务与人才池
→ 项目方为可信 Agent 执行网络付费
```

---

## 21. 五条不可违反的底线

```text
所有成长必须来自真实 Runtime 执行
所有信誉必须来自服务端验证
所有收益必须经过 Settlement Gate
所有稀缺必须来自真实供给
所有 FOMO 必须可以被审计
```

补充工程原则：

```text
代码尽量轻
规则必须严谨
指标必须可重算
规则必须版本化
影响必须逐步开放
```

---

## 22. 最终定位

完成本路线后，GrowthBot 应从：

```text
Agent 外观的任务积分产品
```

升级为：

> **可培养、可验证、可组合、可筛选、可就业的 Agent 工作网络。**
