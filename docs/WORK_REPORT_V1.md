# GrowthBot Work Report V1 — Implementation Specification

> 文档状态：Work Report V1 实施规格  
> 适用仓库：`/Users/yudeyou/Desktop/GrowthBot`  
> 代码基线：`main@65c51c48d8c85dc92d944ac7fd668e4403a05761`  
> 上层规划：`docs/AGENT_GROWTH_PROOF_PLAN.md`  
> 已完成依赖：PR #8 Skill Runtime Lite V1、PR #9 Workflow Runtime Settlement Gate、PR #10 Research Brief Runtime V1  
> 本文档只定义 Work Report V1 实现阶段的实施边界，不在本轮修改产品代码、Migration、共享类型、API Client、前端组件或测试脚本。

---

## 1. 文档目的与状态分层

本文档把上层规划中的“工作战报与 Runtime 可观察执行”细化为可独立验收的 Work Report V1 实施规格。

所有条目必须明确属于以下三类之一：

- **当前已实现**：PR #8、#9、#10 已提供的数据、约束与执行能力。
- **Work Report V1 新增**：本实现阶段允许实现 Work Report API、共享只读结构、页面展示、审计视图、分享文本与专项验证。
- **Agent Growth Proof V1 以后再做**：Agent Growth Proof、熟练度、专精、Streak、Trust、徽章、动态流、推荐与资格系统。

Work Report V1 是现有工作事实的只读投影，不是新的事实来源，不得反向修改 Runtime、Workflow、Verification、Settlement 或积分账本。

---

## 2. 产品目标与非目标

### 2.1 产品目标

Work Report V1 实现阶段必须让用户和管理员能够回答：

1. 这次工作是模拟、真实 Runtime，还是外部验证工作？
2. Work Run 经过了哪些步骤，每一步最终状态是什么？
3. 哪些 Runtime execution 被调用，哪些失败，是否发生 Recovery？
4. 最终哪一个 Runtime execution 被认定为有效产出？
5. 使用了哪些技能、版本、模型、Token 和估算成本？
6. Verification 是否通过？失败原因是什么？
7. Settlement 是否完成，发放了多少 GP，扣除了多少能量？
8. Research Brief 的结构化结果是什么？
9. 报告中哪些数据可分享，哪些必须过滤？
10. 历史 Work Run 在字段缺失时如何安全展示？

### 2.2 非目标

Work Report V1 实现阶段不建设：

- Agent 能力档案或评分。
- 技能熟练度、专精、Streak、Trust。
- 徽章、赛季、动态流、分享图片生成。
- 任务推荐、资格筛选、奖励倍率。
- 新的 Work Report 事实表或快照表。
- 新的 Settlement 规则、奖励规则或能量规则。
- External Work 的提交、审核或争议工作流。
- Runtime 重试模型改造。
- 新任务类型。
- 模拟任务转真实任务的升级入口。

---

## 3. 当前已实现的事实来源

Work Report V1 只读聚合以下现有表，不复制事实，不增加平行状态机。

### 3.1 `agent_work_runs`

用途：报告主记录。

当前可复用字段包括：

- `id`
- `agent_id`
- `user_id`
- `task_id`
- `task_kind`
- `status`
- `current_step`
- `total_steps`
- `progress`
- `estimated_reward`
- `estimated_energy`
- `actual_reward`
- `actual_energy`
- `risk_level`
- `requires_user_action`
- `settled`
- `settled_at`
- `settlement_ledger_id`
- `started_at`
- `completed_at`
- `failed_reason`
- `created_at`
- `updated_at`
- `execution_mode`
- `research_brief_result_json`

### 3.2 `agent_work_steps`

用途：步骤时间线。

关键字段：

- `id`
- `run_id`
- `step_order`
- `step_type`
- `title`
- `description`
- `status`
- `input_summary`
- `output_summary`
- `tool_name`
- `requires_approval`
- `approved_at`
- `started_at`
- `completed_at`
- `error_message`

### 3.3 `skill_runtime_executions`

用途：Runtime 执行事实。

关键字段：

- `id`
- `user_id`
- `agent_id`
- `task_type`
- `status`
- `selected_skills_json`
- `input_tokens`
- `output_tokens`
- `estimated_cost_usd_micros`
- `model_name`
- `retry_count`
- `error_code`
- `parent_execution_id`
- `recovery_of_execution_id`
- `attempt_number`
- `created_at`
- `started_at`
- `completed_at`

`input_json`、`result_json` 属于高风险原始数据，不得默认原样返回。

### 3.4 `task_skill_runtime_usages`

用途：技能使用审计。

关键字段：

- `task_execution_id`
- `learned_skill_id`
- `skill_definition_id`
- `runtime_version_id`
- `runtime_version`
- `learned_skill_level`
- `selection_role`
- `trigger_reason`
- `runtime_checksum`
- `input_tokens`
- `output_tokens`
- `estimated_cost_usd_micros`
- `status`
- `error_code`

### 3.5 `work_step_runtime_executions`

用途：把 Workflow Step 与 Runtime execution 绑定。

关键字段：

- `run_id`
- `step_id`
- `runtime_execution_id`
- `purpose`
- `created_at`

`purpose` 当前允许：

- `plan`
- `produce`
- `verify`
- `recover`

### 3.6 `work_run_settlements`

用途：Settlement Gate 的审计事实。当前真实字段、类型与可空性冻结为：

- `run_id TEXT NOT NULL`：本表业务键；Work Report 中定义 `settlementKey = runId`，不虚构独立 `settlementId`。
- `status TEXT NOT NULL`：仅使用当前 schema/实现允许的状态；不存在 `no_reward` settlement 状态。
- `reward_applied INTEGER NOT NULL`：奖励是否已应用的布尔标记，不是奖励金额，禁止据此推算 GP。
- `energy_applied INTEGER NOT NULL`：能量是否已应用的布尔标记，不是能量数值。
- `created_at TEXT NOT NULL`。
- `updated_at TEXT NOT NULL`。

`ledgerEventId` 只来自 `agent_work_runs.settlement_ledger_id`；`settledAt` 只来自 `agent_work_runs.settled_at`。报告用 `agent_work_runs.settled`、上述 run 字段与 settlement 记录做一致性核验，不为不存在的列或状态建立投影。

### 3.7 `point_ledger_events`

用途：确认真实 GP 账本变动。

唯一允许的精确关联规则：

1. 首选 `agent_work_runs.settlement_ledger_id = point_ledger_events.id`。
2. 同时核对 `source_id = run.id`、`user_id`、`agent_id`、受控 `event_type`、受控 `point_type`、奖励方向和 amount 单位。
3. 出现多个候选或任一关键维度冲突时，标记 `inconsistent`，不求和、不猜测。
4. 禁止仅按 user ID、source ID、时间范围或相近时间模糊查询。

Gross GP 优先读取该精确关联 ledger event 的 amount。ledger 缺失时，`agent_work_runs.actual_reward` 仅可作为明确标记为 `inferred_legacy` 的兼容 fallback；`estimated_reward` 永远不是实际 GP。

---

## 4. 三种报告类型

### 4.1 Simulation

判定条件：

```text
agent_work_runs.execution_mode = 'simulated'
```

展示名称：`Simulation`

规则：

- 顶部、摘要、分享文本必须显著标注。
- 必须显示“不计入正式工作履历”。
- 即使步骤为 completed，也不得显示为 Verified Runtime Work。
- 不得将 estimated reward 表述为已赚取 GP。
- 若存在异常 settlement 数据，报告显示审计警告，不得因此升级为真实工作。

### 4.2 Verified Runtime Work

基础判定条件：

```text
execution_mode = 'runtime'
AND work run completed
AND verification.status = 'passed'
AND verification.source = 'workflow_step'
AND final effective runtime execution completed
AND settlement.status = 'settled'
```

展示名称：`Verified Runtime Work`

规则：

- 只有同时满足正式资格时才能使用该标签。
- Runtime execution `completed` 不等于 Verification passed。
- Verification passed 不等于 Settlement completed；未结算时显示 `Runtime Work — Unsettled`。
- 不存在 `no_reward` settlement 状态，不得用其绕过真实结算事实。
- 报告必须保留失败 execution 和合法直接 Recovery child，不能只展示最终成功节点。

### 4.3 External Work（V1 冻结）

判定条件：

```text
execution_mode = 'external'
```

Work Report V1 固定返回：`external_verification_unknown`。

规则：

- 保留 `external` 类型仅用于未来兼容。
- Work Report V1 不生成 `external_verified_work`。
- 当前不存在可信 External Verification 事实来源。
- 不得根据 execution mode、自由文本、用户输入、步骤状态或 Runtime 状态推断 verified。
- External Work 禁止分享。
- 待未来存在正式 external verification 表、签名证明或审核事实并经过独立规格审查后再启用。

---

## 5. 建议 API

### 5.1 用户报告 API

```text
GET /work-runs/:runId/report
```

权限：

- 必须通过现有用户认证。
- `agent_work_runs.user_id` 必须等于当前用户 ID。
- 不允许通过仅知道 `runId` 越权读取。
- 不返回其他用户、Agent 或 Work Run 的关联数据。

成功响应：`200 OK`

```ts
interface WorkReportResponse {
  report: WorkReport;
}
```

### 5.2 Admin 只读审计 API

固定路径：

```text
GET /admin/v1/work-runs/:runId/report
```

权限与接线：

- 注册在现有 Admin router 中。
- 复用现有 `requireAdmin`，不得重新实现 Admin Token 判断。
- 不建立第二套 Admin 前缀。
- 只读；不提供 settle、retry、recover、verify、edit、delete 操作。
- 可包含额外审计 ID、checksum 和一致性 warning，但仍不得返回原始 URL、密钥、认证信息、原始 JSON 或错误堆栈。

### 5.3 返回结构原则

- 字段命名使用共享类型的 camelCase。
- 所有金额单位必须显式。
- 所有时间使用 ISO 8601。
- 所有可空字段使用 `null`，不要以空字符串代替未知。
- Work Run 存在且用户有权访问时，即使 Research Brief JSON 解析失败或 schema 不匹配，报告仍返回 `200`；`structuredResult.type = 'unavailable'`，附受控 warning，其他部分继续返回。
- 原始 JSON 解析错误、schema 错误详情和完整错误对象不得进入响应。
- 只有核心身份、owner 或主记录无法安全确定时，才考虑 `409`。
- 数组必须稳定排序、使用 `LIMIT`、去重并受第 13.4 节硬上限约束。

### 5.4 普通用户身份隐藏与错误码

普通用户 endpoint 固定规则：

- 未认证：`401 UNAUTHORIZED`。
- 查询必须直接使用 `WHERE id = ? AND user_id = ?`。
- 不存在的 run 与非本人 run 统一返回相同的 `404 WORK_RUN_NOT_FOUND`，HTTP 状态、响应字段、code 和 message 结构完全相同。
- 禁止先按 ID 查出记录再判断 owner。
- 普通用户不返回 `403 WORK_REPORT_FORBIDDEN`。
- Admin endpoint 才允许根据现有 Admin API 契约区分不存在与权限问题。

| HTTP | code | 场景 |
|---|---|---|
| 400 | `INVALID_WORK_RUN_ID` | runId 格式非法 |
| 401 | `UNAUTHORIZED` | 未认证 |
| 404 | `WORK_RUN_NOT_FOUND` | 普通用户下不存在或非本人，响应完全一致 |
| 409 | `WORK_REPORT_INCONSISTENT` | 核心身份、owner 或主记录无法安全确定 |
| 500 | `WORK_REPORT_BUILD_FAILED` | 未分类服务端错误 |

Research Brief 结构异常不得返回 `422`。

---

## 6. Shared Type 草案

以下为 Work Report V1 实现阶段建议加入共享包的草案。本轮只修订规格文档，不修改共享类型。

```ts
type WorkReportKind =
  | 'simulation'
  | 'verified_runtime_work'
  | 'runtime_unsettled'
  | 'external_verification_unknown';

type WorkReportOverallStatus =
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'verification_failed'
  | 'recovery_failed'
  | 'unsettled'
  | 'data_incomplete';

interface WorkReport {
  schemaVersion: 'work_report_v1';
  runId: string;
  userId?: string; // admin only
  agentId: string;
  taskId: string;
  taskKind: string;
  reportKind: WorkReportKind;
  executionMode: 'simulated' | 'runtime' | 'external';
  overallStatus: WorkReportOverallStatus;
  title: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  progress: number;
  riskLevel: string;
  steps: WorkReportStep[];
  runtimeExecutions: RuntimeExecutionSummary[];
  skillUsages: SkillUsageSummary[];
  verification: VerificationSummary;
  recovery: RecoverySummary;
  settlement: SettlementSummary;
  structuredResult:
    | { type: 'research_brief'; value: ResearchBriefResult }
    | { type: 'unavailable'; reason: string }
    | null;
  metrics: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsdMicros: number;
    estimatedCostUsd: string;
    estimatedEnergy: number;
    actualEnergy: number | null;
    grossGp: number | null;
    netContributionGpEquivalent: number | null;
  };
  warnings: string[];
  share: {
    allowed: boolean;
    text: string | null;
    blockedReason: string | null;
  };
}

interface WorkReportStep {
  stepId: string;
  order: number;
  type: string;
  title: string;
  description: string | null;
  status: string;
  purposeExecutions: Array<{
    purpose: 'plan' | 'produce' | 'verify' | 'recover';
    runtimeExecutionId: string;
  }>;
  inputSummary: string | null;
  outputSummary: string | null;
  toolName: string | null;
  requiresApproval: boolean;
  approvedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  error: { code: string | null; message: string | null } | null;
}

interface RuntimeExecutionSummary {
  executionId: string;
  stepId: string | null;
  purpose: 'plan' | 'produce' | 'verify' | 'recover' | 'unknown';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timed_out' | 'cancelled';
  taskType: string;
  modelName: string;
  attemptNumber: number;
  retryCount: number;
  parentExecutionId: string | null;
  recoveryOfExecutionId: string | null;
  isFinalEffectiveExecution: boolean;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsdMicros: number;
  errorCode: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}

interface SkillUsageSummary {
  runtimeExecutionId: string;
  learnedSkillId: string;
  skillDefinitionId: string;
  runtimeVersionId: string;
  runtimeVersion: number;
  learnedSkillLevel: number;
  selectionRole: 'required' | 'recommended' | 'fallback';
  triggerReason: string | null;
  runtimeChecksum: string;
  status: 'selected' | 'loaded' | 'completed' | 'failed' | 'skipped';
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsdMicros: number;
  errorCode: string | null;
}

interface VerificationSummary {
  status: 'passed' | 'failed' | 'pending' | 'not_applicable' | 'unknown';
  stepId: string | null;
  verifiedAt: string | null;
  reasonCode: string | null;
  message: string | null;
  source: 'workflow_step' | 'legacy_unknown';
}

// `passed` 的唯一合法来源是 workflow_step。
// `source = 'legacy_unknown'` 时，`status` 必须为 `unknown`。
// verifiedAt 只取 verify workflow step.completed_at；缺少 verify step 时为 unknown。
// reasonCode 只能来自受控映射，不返回原始 Verification 错误文本。
// Runtime completed、produce runtime completed、verify runtime completed 均不得推断 Verification passed。

interface RecoverySummary {
  required: boolean;
  attempted: boolean;
  status: 'not_needed' | 'succeeded' | 'failed' | 'in_progress' | 'unknown';
  rootExecutionId: string | null;
  finalExecutionId: string | null;
  chain: Array<{
    executionId: string;
    status: string;
    attemptNumber: number;
    recoveryOfExecutionId: string | null;
  }>;
}

interface SettlementSummary {
  status: 'settled' | 'unsettled' | 'not_eligible' | 'inconsistent' | 'unknown';
  settlementKey: string | null; // 当前固定为 runId
  ledgerEventId: string | null; // 仅来自 agent_work_runs.settlement_ledger_id
  grossGp: number | null;
  grossGpSource: 'ledger' | 'inferred_legacy' | 'none';
  energySpent: number | null;
  settledAt: string | null; // 仅来自 agent_work_runs.settled_at
  exactOnceVerified: boolean;
  warning: string | null;
}
```

---

## 7. 最终有效 Runtime execution 选择规则

最终有效 execution 只能由服务端确定，前端不得自行猜测。

### 7.1 候选集合

仅考虑同时满足以下条件的 execution：

- 通过 `work_step_runtime_executions` 绑定到当前 `run_id`。
- `purpose IN ('produce', 'recover')`。
- `user_id`、`agent_id` 与 Work Run 一致。
- `task_type` 与当前任务类型兼容。

### 7.2 选择顺序与 Recovery 冻结规则

统一常量：

```ts
const MAX_RECOVERY_GRAPH_DEPTH = 2;
```

- depth 1：原始 produce execution。
- depth 2：一个直接 Recovery child。
- 任何第二层 Recovery child 之后的节点均超出 V1 支持范围。

选择规则：

1. 找到该 Work Run、该步骤的唯一原始 `produce` execution。
2. 若原始 produce 为 `completed` 且没有 Recovery link，则它是最终有效 execution。
3. 只有原 produce `status = 'failed'` 且 `error_code` 属于当前 recover endpoint 的受控 recoverable error 集合时，唯一直接 Recovery child 才可能合法。
4. 合法 Recovery 必须满足 `recovery_of_execution_id = originalProduce.id`；该字段必须直接指向本步骤原 produce。
5. 正式有效结果只允许原 produce 或一个直接 Recovery child。构建器可以读取更深关系用于异常检测，但不得选择其为最终有效 execution。
6. `timed_out`、`cancelled` 当前不是合法 recover endpoint 输入；若其存在 Recovery link，`overallStatus = 'data_incomplete'`，添加 `RECOVERY_LINK_INCONSISTENT` warning，不选择最终 execution。
7. 合法直接 Recovery 为 `completed` 时，它是最终有效 execution；未完成或失败时不存在最终有效 execution。
8. 构建展示关系必须使用 visited set、按 execution ID 去重，并统一使用 `MAX_RECOVERY_GRAPH_DEPTH`。
9. 发现自引用、循环、重复节点、parent/recovery 矛盾、多个 Recovery 指向同一原 produce、跨 run/step/user/agent 关联时：`overallStatus = 'data_incomplete'`，添加对应受控 warning，且不选择最终 execution。
10. 超过 `MAX_RECOVERY_GRAPH_DEPTH` 时：`overallStatus = 'data_incomplete'`，添加 `RECOVERY_GRAPH_DEPTH_EXCEEDED` warning，且不选择最终 execution。
11. 不得把原 failed execution 改写为 completed，不得按最新 `created_at` 或最大 `attempt_number` 猜测。
12. Token 与成本必须按唯一 execution ID 去重汇总。

### 7.3 多 produce 场景

V1 默认每个产出步骤只有一个主 produce 链。若历史数据存在多个独立 produce execution：

- 按 `step_order` 展示全部链。
- 每个步骤分别计算最终有效 execution。
- `structuredResult` 只从明确负责最终任务产出的步骤读取。
- 无法确定主产出步骤时，结构化结果降级为 unavailable，不得猜测。

---

## 8. Produce / Recover 链展示规则

时间线必须展示事实，而不是只展示成功结果。

示例：

```text
Produce attempt #1 — failed
└─ Recovery attempt #2 — completed — Final effective execution
```

规则：

- 原始 produce 始终展示。
- Recovery 节点在其 `recovery_of_execution_id` 指向的节点下展示。
- `parent_execution_id` 用于辅助展示上下文链，不替代 `recovery_of_execution_id` 的 Recovery 语义。
- 展示构建、查询限制和异常检测统一使用 `MAX_RECOVERY_GRAPH_DEPTH = 2`。
- depth 1 展示原始 produce，depth 2 展示一个直接 Recovery child；更深节点仅可读取用于异常检测，不得作为正式展示链或最终 execution。
- 超过深度 2 时，`overallStatus = 'data_incomplete'`，添加 `RECOVERY_GRAPH_DEPTH_EXCEEDED` warning，不选择最终 execution。
- 每个节点显示状态、attempt number、模型、Token、成本、错误码和时间。
- 错误消息只展示经过过滤的安全摘要。
- Recovery 成功不隐藏原始失败。
- Recovery failed 时报告总体状态应体现 `recovery_failed`。
- 链不完整时显示 `Data incomplete` 警告。

---

## 9. 状态映射

### 9.1 failed

满足任一条件：

- Work Run 终态为 failed。
- 关键 produce execution failed 且无成功 Recovery。
- 必需步骤失败导致任务无法继续。

展示：失败原因、失败步骤、相关 execution、是否可重试的静态说明。Work Report V1 实现阶段不新增重试动作。

### 9.2 cancelled

- Work Run 为 cancelled。
- 不得显示为 verification failed。
- 不得计入正式工作。
- 已发生的 Runtime 成本可以展示，但 GP 必须按事实显示为 0 或未结算。

### 9.3 verification failed

- Produce 可能 completed。
- Work Run 不得显示为 Verified Runtime Work。
- Settlement 必须显示 `not_eligible` 或 `unsettled`，视现有事实而定。
- 展示服务端验证失败原因，不展示未过滤的内部 payload。

### 9.4 recovery failed

- 原 execution 未成功。
- 已创建 Recovery，但 Recovery 最终为 failed、timed_out 或 cancelled。
- 报告必须展示两次成本与 Token，不得只展示 Recovery。
- 不得产生最终有效 Runtime execution。

### 9.5 unsettled

适用于：

- Verification passed，但 `settled = 0`。
- Settlement 记录缺失。
- ledger event 缺失。
- settlement 表、run 字段和 ledger 三者不一致。

不得把 estimated reward 当作 Gross GP。

### 9.6 in progress

- Work Run 尚未终结。
- 报告允许读取，但必须标注数据仍可能变化。
- 分享默认关闭。

---

## 10. Research Brief 结构化结果展示

### 10.1 数据源

优先使用：

```text
agent_work_runs.research_brief_result_json
```

仅当：

- task kind/type 为 Research Brief；
- JSON 可解析；
- 满足 PR #10 的服务端结构验证；

才返回 `structuredResult.type = 'research_brief'`。

### 10.2 展示顺序

1. Summary
2. Core Product
3. Target Users
4. Business Model
5. Team Background
6. Competition
7. Risks
8. Sources
9. Fact vs Judgment
10. Recommendations

### 10.3 规则

- `sources` 当前是 URL 字符串数组，V1 不存在可选标题；不得抓取网页标题或猜测 title。
- 每个 source 必须先经过第 13.2 节安全 URL 投影，V1 仅返回 `displayDomain` 与 `safeUrl`。
- `fact_vs_judgment` 以 Fact / Judgment 明确分组，不混为普通段落。
- recommendations 使用有序列表。
- 不渲染任意 HTML。
- 不自动抓取远程页面。
- 不把 result_json 中未验证的备用内容当作正式 Research Brief。
- JSON 缺失、损坏或 schema 不匹配时返回 `200`，`structuredResult.type = 'unavailable'`，附受控 warning；报告其余部分继续返回，原始解析错误不得进入响应。

---

## 11. Token、成本、能量、Gross GP、Net Contribution 定义

### 11.1 Token

- `inputTokens`：当前 Work Run 所有合法绑定 Runtime execution 的输入 Token 合计。
- `outputTokens`：同上输出 Token 合计。
- `totalTokens = inputTokens + outputTokens`。
- 失败和 Recovery execution 产生的 Token 仍计入真实消耗。
- 不得同时累加 execution 与 usage 表中的同一份 Token，避免双计。
- V1 以 `skill_runtime_executions` 为 Work Run 总量主来源；usage 表仅用于按技能拆分。

### 11.2 成本

- 使用 `estimated_cost_usd_micros`。
- `1 USD = 1,000,000 micros`。
- 报告显示“Estimated Runtime Cost”，不得称为实际账单。
- 所有合法绑定 execution 均计入，包括失败和 Recovery。
- usage 成本用于技能拆分，不与 execution 总成本重复相加。

### 11.3 能量

- `estimatedEnergy`：执行前估算值。
- `actualEnergy: number | null`：Work Run 最终记录的真实能量变化。
- 不得用 estimatedEnergy 替代 actualEnergy。
- 历史缺失时返回 `null` 并附带受控 warning。
- 只有数据库明确记录 `0` 时才展示 `0`。

### 11.4 Gross GP

定义：与当前 Work Run settlement 明确关联、最终进入 `point_ledger_events` 的正向 GP 数量。

优先级：

1. 精确关联且完成全部一致性核验的 `point_ledger_events.amount`，`grossGpSource = 'ledger'`。
2. ledger 缺失时，`agent_work_runs.actual_reward` 仅作 `inferred_legacy` fallback。
3. 两者均不可用时，`grossGp = null`、`grossGpSource = 'none'`，并添加受控 warning。

不得从 `reward_applied`、settlement status、`estimated_reward`、Runtime cost 或 energy 推算 Gross GP。

### 11.5 Net Contribution

Work Report V1 实现阶段只提供透明定义，不把它用于排名或奖励。

建议 V1 定义：

```text
Net Contribution = Gross GP - Runtime Cost GP Equivalent
```

但当前系统若没有经过治理的 USD→GP 换算规则，则：

- `netContributionGpEquivalent = null`。
- 页面分别展示 Gross GP 与 Estimated Runtime Cost。
- 不得临时硬编码汇率。

正式 Net Contribution 指标及规则版本化属于 Agent Growth Proof V1。

---

## 12. 模拟任务不得伪装成真实工作

强制规则：

- `execution_mode = 'simulated'` 是最高优先级标签。
- Simulation 不因 completed、settled、存在 Token 或存在结构化输出而升级。
- Simulation 卡片必须使用独立视觉标识。
- Simulation 分享文本必须包含 `Simulation`。
- Simulation 不使用“Verified”“Earned from verified work”“Official work history”等措辞。
- Simulation 的 reward 显示为“simulated/estimated”，除非账本确实存在异常事件；异常时显示审计警告而非真实工作标签。
- Admin 视图必须能发现 simulated run 被结算的异常。

---

## 13. 隐私和敏感数据过滤

### 13.1 默认不返回

- 原始 `input_json`。
- 未过滤的 `result_json`。
- Telegram init data、JWT、Cookie、Authorization header。
- API key、secret、token、签名、私钥、助记词。
- 完整钱包地址；确需展示时只显示截断版本。
- 用户邮箱、手机号、IP、设备标识。
- 内部 prompt、system instructions、tool credentials。
- 完整 error stack。
- 未公开项目资料或用户自由输入中的敏感内容。

### 13.2 过滤策略与 Research Brief source URL 安全投影

- 采用字段白名单，不采用仅靠关键词黑名单。
- 对 step summary 和 error message 设置最大长度。
- 去除控制字符和可执行 HTML。
- 分享文本使用单独的最小字段模板，不直接复用页面全文。
- Admin 也不得看到密钥、认证材料或原始持久化 URL。

Research Brief source 必须由服务端逐项执行以下安全投影：

1. 使用 `new URL(rawUrl)` 解析，且协议仅允许 `http:` / `https:`；解析失败则丢弃该项并增加受控 warning。
2. 删除 `username`、`password`。
3. 删除 `hash` / fragment。
4. 默认删除全部 query 参数。
5. 如未来确需参数，只允许经独立规格批准的显式参数白名单；Work Report V1 默认不保留任何 query。
6. API、Admin API 均不得返回原始持久化 URL。
7. 仅返回 `{ displayDomain, safeUrl }`；`displayDomain` 来自清洗后 URL 的 hostname，`safeUrl` 为清洗后的 origin + pathname。
8. Telegram 分享只允许使用 `displayDomain`，禁止输出任何 URL。

负向测试必须覆盖参数名或载荷包含 `token`、`key`、`signature`、`auth`、`session`，以及 userinfo、fragment 和任意未知 query 参数；断言响应、分享文本、stdout/stderr 均不含被删除内容。

### 13.3 结构化结果

Research Brief 只返回已验证 schema 中的字段。未来任务类型必须为各自定义 serializer，不允许通用 `JSON.stringify(result_json)`。

### 13.4 响应数量与体积硬上限

Work Report V1 固定使用以下唯一常量表；查询层、serializer、共享类型说明和测试必须引用同一组值，不得在实现阶段另行决定：

```ts
const MAX_REPORT_STEPS = 32;
const MAX_RUNTIME_EXECUTIONS = 32;
const MAX_SKILL_USAGES = 64;
const MAX_WARNINGS = 32;
const MAX_SOURCES = 20;
const MAX_RECOMMENDATIONS = 20;
const MAX_FACT_JUDGMENT_ITEMS = 40;
const MAX_TITLE_CHARS = 200;
const MAX_DESCRIPTION_CHARS = 2_000;
const MAX_SUMMARY_CHARS = 4_000;
const MAX_ERROR_MESSAGE_CHARS = 500;
const MAX_WARNING_MESSAGE_CHARS = 500;
const MAX_REASON_CODE_CHARS = 100;
const MAX_SAFE_URL_CHARS = 2_048;
const MAX_MODEL_NAME_CHARS = 200;
const MAX_SKILL_NAME_CHARS = 200;
```

执行规则：

- 查询层使用稳定排序和显式 `LIMIT`；Recovery 关系查询同时受 `MAX_RECOVERY_GRAPH_DEPTH = 2` 约束。
- serializer 使用同一组常量截断，不返回原始超长文本。
- 所有数组先稳定排序，再截断。
- executions 与 usages 按 ID 去重后再计数、截断和返回。
- 任一截断发生时设置 `data_truncated` 并添加受控 warning。
- warnings 自身超过 `MAX_WARNINGS` 时也必须稳定、确定性截断，并保留一个可识别的截断 warning。
- 普通用户 API 不得返回无限数组或无限字符串。
- Admin 如未来需要完整数据，使用独立分页 endpoint，不扩大当前响应。
- 测试必须覆盖正好等于上限、超过上限 1 项、超长字符串、稳定排序、重复 ID 和 `data_truncated` warning。

---

## 14. AgentWorkView 页面信息架构

Work Report V1 实现阶段优先扩展：

```text
apps/miniapp/src/components/AgentWorkView.tsx
```

不得新增底部 Tab。

建议页面层级：

### 14.1 Report Header

- 任务名称
- 报告类型标签
- 总体状态
- Agent 名称/ID
- 开始与结束时间
- 时长
- Simulation 警告或 Verified 标识

### 14.2 Outcome Summary

- Verification
- Settlement
- Gross GP
- Energy
- Total Tokens
- Estimated Runtime Cost

### 14.3 Step Timeline

- 按 `agent_work_steps.step_order` 稳定排序并动态展示实际步骤数。
- 当前标准 Workflow 预期八步，但 UI 不得硬编码八步或依赖固定数量。
- 展示状态、时间、摘要、受控错误信息。
- 有 Runtime 的步骤可展开。

### 14.4 Runtime & Recovery

- Produce / Recover 树
- Final effective execution 标记
- 模型、版本、Token、成本、错误码

### 14.5 Skills Used

- 技能名称/定义 ID
- required/recommended/fallback
- learned level
- runtime version
- checksum 的短格式
- 成功/失败状态

### 14.6 Structured Result

Research Brief 按第 10 节结构渲染。

### 14.7 Verification & Settlement Audit

- 验证状态与原因
- 结算状态
- ledger reference 的短 ID
- exact-once 检查结果

### 14.8 Share

- 仅在报告处于允许状态时显示。
- V1 只生成 Telegram 文本，不生成图片卡。

---

## 15. Admin 只读审计视图

目标：支持排查事实链，而不是提供人工改写结果的入口。

Admin 可额外查看：

- user ID、agent ID、run ID、step ID、execution ID。
- runtime checksum。
- settlement key（当前为 run ID）、ledger event ID。
- 数据一致性 warnings。
- 原始状态字段的安全摘要。
- report builder schema version。

Admin 禁止：

- 手工把 Simulation 改成 Verified。
- 手工选择 final effective execution。
- 直接修正 Token、成本、GP、能量。
- 从报告页触发 recover、verify 或 settle。
- 编辑 Research Brief 正式结果。

修复数据必须走独立、可审计的运维流程，不属于 Work Report V1 实现阶段。

---

## 16. Telegram 分享文本规则

### 16.1 允许分享条件

- Work Run 属于当前用户。
- Work Run 已终结。
- 不存在敏感数据阻断。
- 结构化结果已完成过滤。
- Simulation 可分享，但必须显著标注。

### 16.2 Verified Runtime Work 模板

```text
✅ GrowthBot Verified Runtime Work

Agent: {agentName}
Task: {taskTitle}
Result: Verification passed
Skills: {skillNames}
Runtime: {totalTokens} tokens · ${estimatedCostUsd} estimated
Reward: {grossGp} GP

Work Run: {shortRunId}
```

### 16.3 Simulation 模板

```text
🧪 GrowthBot Simulation

Agent: {agentName}
Task: {taskTitle}
Status: Simulation only — not verified work history

Work Run: {shortRunId}
```

### 16.4 External Work

Work Report V1 不提供 External Verified Work 成功分享模板。`execution_mode = 'external'` 固定为 `external_verification_unknown`，`share.allowed = false`，不得输出 URL、domain 或任何“verified”措辞。

### 16.5 禁止内容

- 完整 Research Brief 正文。
- 任何原始 source URL、query、userinfo、fragment 或未经安全投影的 URL 内容。所有 query 默认删除，不区分敏感或非敏感；分享文本不包含 `safeUrl`，只包含 `displayDomain`；Admin API 也不返回原始 URL。
- 钱包地址、用户 ID、执行 input。
- 内部错误信息。
- 未结算时宣称已赚取 GP。
- Verification failed 时使用成功模板。

---

## 17. 旧 Work Run 与缺失字段兼容

### 17.1 总原则

报告构建器必须容忍旧数据，但不得把未知推断为成功。

### 17.2 `execution_mode` 缺失

- 由于 migration 默认值，正常库应为 `simulated`。
- 若旧导入数据实际为空，按 `simulated` 处理并添加 warning。
- 不得根据存在 Runtime execution 自动升级为 runtime。

### 17.3 Runtime link 缺失

- 报告仍返回 Work Run 和步骤。
- Runtime 区显示 unavailable。
- runtime 模式且缺 link 时总体状态为 `data_incomplete` 或 `unsettled`，不得显示 Verified。

### 17.4 Settlement 字段缺失或矛盾

- `settled = 1` 但 ledger 缺失：`inconsistent`。
- ledger 存在但 run 未 settled：`inconsistent`。
- actual_reward 与 ledger 不一致：以 ledger 为准并提示 warning。

### 17.5 Research Brief 缺失

- 旧 Research Brief run 无 `research_brief_result_json` 时显示 unavailable。
- 不从自由文本 output summary 自动重建正式结构。

### 17.6 时间字段缺失

- duration 返回 null。
- 不以 createdAt 伪造 startedAt 或 completedAt。

### 17.7 未识别状态

- 保留原始安全字符串。
- 映射到 `data_incomplete`。
- 记录 warning，避免 API 500。

---

## 18. 本地验证环境隔离

### 18.1 Post-merge 发现的问题

当前根 `.env` 中的：

```text
VITE_API_BASE
```

可能指向 staging。若本地页面或动态验证脚本隐式读取该值，测试可能静默请求远程 Worker，造成：

- 本地代码实际未被验证。
- 测试数据污染 staging。
- 远程旧版本返回成功，形成假通过。
- 本地与远程 schema 不一致时结果不可重复。

### 18.2 Work Report V1 最小、可靠的环境隔离方案

Work Report V1 实现阶段只做最小环境隔离，不引入复杂环境管理系统：

1. CI 必须先启动本地 Worker，并等待 health check 成功后才运行专项验证。
2. 验证脚本只通过环境变量 `WORK_REPORT_API_BASE` 接收实际 origin；未设置时立即失败。任何固定端口都不得成为脚本默认值、CI 契约或退出门契约。
3. 脚本不得读取根 `.env` 的 `VITE_API_BASE`，不得把它作为 fallback，也不得连接失败后静默切换到远程。
4. 脚本日志只允许打印 `new URL(base).origin`；禁止打印 query、userinfo、fragment、Authorization header、API Token、test endpoint token、headers、完整 request config 或完整错误对象。
5. 默认仅允许 loopback host：`127.0.0.1`、`localhost`、`[::1]`；非本地目标默认立即失败并返回 `REFUSING_REMOTE_VERIFICATION_TARGET`。
6. 仅在人工显式设置 `ALLOW_REMOTE_WORK_REPORT_VERIFY=1` 时才允许远程目标；即使允许，也只打印清洗后的 origin。
7. Mini App 本地手工验证必须显式使用本地 Worker origin，不以根 `.env` 当前值作为验收证据。
8. 测试数据使用唯一前缀，Fake Provider 只能走合法测试模式。
9. CI 必须覆盖：根 `.env` 指向 staging 仍不影响本地验证，以及 stdout/stderr 不包含测试 token。

### 18.3 建议验证脚本接口

CI 固定使用动态 origin 注入：

```bash
WORK_REPORT_API_BASE="$LOCAL_WORKER_ORIGIN" \
TEST_ENDPOINT_TOKEN="$TEST_ENDPOINT_TOKEN" \
npm run verify:work-report
```

CI 启动 Worker 后确定实际 origin，并注入 `LOCAL_WORKER_ORIGIN`。`WORK_REPORT_API_BASE` 未设置时脚本必须失败；不得 fallback 到 `VITE_API_BASE` 或根 `.env`。`http://127.0.0.1:8787` 仅允许作为人工本地运行示例，不是脚本默认值、CI 固定端口或退出门固定值。日志不得打印 token、headers、query、userinfo、fragment 或完整 request config。

禁止：

```text
未设置 API base 时自动读取 staging
连接失败后自动 fallback 到远程
脚本只打印 passed 而不打印目标地址
```

---

## 19. 完整测试矩阵

### 19.1 权限

- owner 可读取。
- 未认证固定返回 401。
- 普通用户查询不存在 run 与非本人 run 均返回完全相同的 404 响应结构。
- owner 查询直接使用 `WHERE id = ? AND user_id = ?`，不先按 ID 暴露存在性。
- 随机 run ID 返回相同安全错误。
- Admin 只读接口要求现有 `requireAdmin` 权限。

### 19.2 报告类型

- simulated 正确标记。
- runtime 完整成功且 Verification 与 Settlement 均有正式事实时才是 Verified Runtime Work。
- Runtime completed 但 Verification failed/unknown 不得标记 Verified。
- Verification passed 但 unsettled 只能标记 runtime unsettled。
- external 始终返回 `external_verification_unknown`。
- Work Report V1 不存在 external verified 成功路径，且 external 禁止分享。

### 19.3 Runtime 选择

- produce completed，无 Recovery。
- produce failed 且 error_code 可恢复 + 唯一直接 recovery completed。
- produce failed + recovery failed。
- `MAX_RECOVERY_GRAPH_DEPTH = 2` 在选择算法、展示、查询和测试中保持一致。
- depth 1 为原始 produce，depth 2 为一个直接 Recovery child。
- timed_out/cancelled 存在 Recovery link 时，`overallStatus = 'data_incomplete'`，添加 `RECOVERY_LINK_INCONSISTENT` warning，不选择最终 execution。
- 第二层或更深 Recovery 不得被选为正式结果；超过 depth 2 时添加 `RECOVERY_GRAPH_DEPTH_EXCEEDED` warning。
- 自引用、循环、重复节点、parent/recovery 矛盾分别以受控 warning code 表达，总体状态统一为 `data_incomplete`。
- 非法多个 Recovery 被识别。
- 跨 run/step/user/agent link 被拒绝。
- 最新 createdAt 或最大 attemptNumber 不是合法依据时不得误选。
- Token 与成本按唯一 execution ID 去重。

### 19.4 步骤时间线

- 按 step_order 排序。
- pending/running/completed/failed/cancelled 正确映射。
- 时间缺失时 duration null。
- approval 字段正确。
- error 安全过滤。

### 19.5 技能使用

- required/recommended/fallback 正确。
- runtime version 和 checksum 正确。
- usage 按 execution 关联。
- failed/skipped 正确展示。
- 不混入其他 run 的 usage。

### 19.6 Token 与成本

- input/output/total 正确。
- 失败 execution 计入成本。
- Recovery 计入成本。
- execution 总量与 usage 拆分不双计。
- micros 转 USD 格式正确。
- 大整数不溢出。

### 19.7 Verification

- `verification.status = 'passed'` 时，`verification.source` 必须且只能为 `workflow_step`。
- `verification.source = 'legacy_unknown'` 时，`verification.status` 必须为 `unknown`。
- `workflow_step` passed/failed/pending 正确映射。
- verifiedAt 只来自 verify workflow step.completed_at。
- 缺少 verify step 时为 unknown，legacy 数据不得推断 verified。
- Runtime completed、produce runtime completed、verify runtime completed 均不得推断 passed。
- reasonCode 只来自受控映射，原始错误文本不返回。

### 19.8 Settlement

- settled + 精确关联并完成全部一致性核验的 `point_ledger_events.amount` 正确。
- settled 标志与 settlement 表不一致时，`overallStatus = 'data_incomplete'`，添加 `SETTLEMENT_FACTS_INCONSISTENT` warning。
- ledger 缺失时仅允许 `actual_reward` 作为标记 `inferred_legacy` 的 fallback。
- ledger 与 actual_reward 均不可用时，`grossGp = null`、`grossGpSource = 'none'` 并添加受控 warning。
- ledger 多候选、source/user/agent/type/方向/单位冲突时不求和，添加 `LEDGER_LINK_INCONSISTENT` warning。
- exact-once 正确。
- 不得从 `reward_applied`、settlement status、estimated reward、Runtime cost 或 energy 推算金额。
- settlementKey = runId；ledgerEventId 与 settledAt 仅来自 run 的真实字段。
- 不存在 `no_reward` settlement 状态。

### 19.9 Research Brief

- 完整有效结构。
- 七个必填文本字段缺失。
- 空字符串、仅空格、非字符串。
- sources 非数组、空数组、非法 URL、javascript URL、非字符串成员。
- source URL 的 token、key、signature、auth、session、userinfo、fragment 与任意未知 query 参数均被删除。
- API 与 Admin API 不返回原始持久化 URL，仅返回 displayDomain 与 safeUrl。
- Telegram 分享只允许 domain，不输出 URL。
- fact_vs_judgment 非数组、非法对象、空 statement、非法 type。
- recommendations 非数组、空数组、空字符串。
- JSON 损坏或 schema 不匹配时返回 200、structuredResult unavailable，其他部分仍可读取，原始解析错误不返回。
- HTML 内容不执行。

### 19.10 隐私与响应上限

- input_json、result_json、prompt、system prompt 不返回。
- secret/API key/JWT/Authorization/test token 不返回。
- wallet 地址被过滤或截断。
- stack trace、完整错误对象、headers、request config 不返回。
- 分享文本不含完整正文、任何原始 source URL、query、userinfo、fragment、safeUrl 或敏感字段；只允许 `displayDomain`。
- Admin API 也不返回原始 URL。
- 第 13.4 节全部数组和字符串常量逐项生效。
- 每个数组测试正好等于上限与超过上限 1 项。
- 每个字符串类别测试超长输入且不返回原始超长文本。
- 测试稳定排序、重复 execution/usage ID 去重和 warnings 自身确定性截断。
- 任一截断均返回 `data_truncated` 与受控 warning。
- 查询稳定排序并使用显式 LIMIT；普通用户 API 不返回无限数组。

### 19.11 历史兼容

- execution_mode 缺失。
- runtime link 缺失。
- research result 缺失。
- 时间缺失。
- 未识别状态。
- old run 仍返回稳定 schema。

### 19.12 环境隔离

- CI 先启动本地 Worker，health check 成功后确定实际 `LOCAL_WORKER_ORIGIN`。
- 通过 `WORK_REPORT_API_BASE="$LOCAL_WORKER_ORIGIN"` 注入动态 origin；未设置 base 立即失败。
- 固定 `8787` 只允许作为人工本地示例，不是脚本默认值、CI 固定端口或退出门固定值。
- staging URL 默认拒绝；`ALLOW_REMOTE_WORK_REPORT_VERIFY=1` 时才允许远程。
- 日志只打印 `new URL(base).origin`。
- 连接失败不 fallback，脚本不读取根 `.env` 的 `VITE_API_BASE`。
- 根 `.env` 指向 staging 仍不影响本地验证。
- stdout/stderr 不包含测试 token、query、userinfo、fragment、headers 或完整错误对象。

### 19.13 回归

- PR #8 Runtime 验证继续通过。
- PR #9 Settlement Gate 验证继续通过。
- PR #10 Research Brief 验证继续通过。
- typecheck 通过。
- build 通过。
- migration sync 不受影响。

---

## 20. Work Report V1 允许修改的文件

Work Report V1 实现阶段建议限制为：

```text
packages/shared/src/index.ts
apps/api-worker/src/v1/work-report.ts              # 建议新增
apps/api-worker/src/index.ts                       # 仅路由注册
apps/miniapp/src/apiClient.ts
apps/miniapp/src/components/AgentWorkView.tsx
apps/admin/src/apiClient.ts                       # 仅当实现 Admin API 客户端
apps/admin/src/main.tsx                            # 仅当当前阶段实现 Admin UI；否则不修改 Admin 前端
scripts/verify-work-report.mjs                     # 建议新增
package.json                                       # 仅新增 verify:work-report
README.md 或 docs/WORK_REPORT_V1.md                # 必要说明
```

若当前路由架构要求在 `workflow.ts` 中做极小接线，可以修改，但不得把完整 report builder 堆入该文件。

Migration 只有在实施中发现现有事实无法表达且经过独立审查后才能提出；按当前设计，Work Report V1 实现阶段不需要新 Migration。

---

## 21. Work Report V1 禁止实现的后续功能

禁止混入：

- `GET /agents/:agentId/growth`
- Agent Profile / Growth Profile
- 熟练度 new/familiar/mastered
- Researcher/Operator/Auditor/Promoter 专精
- Streak
- Trust
- Badge
- 社交动态流
- 分享图片卡片
- 排行榜扩展
- 任务推荐或资格过滤
- 稀缺任务席位
- 项目方人才池
- Work Report 快照表
- 管理员手工改报告
- 自动重算或补写历史事实
- USD/GP 临时兑换率
- 新经济奖励

这些属于 Agent Growth Proof V1 或更后续阶段。

---

## 22. Work Report V1 退出门

Work Report V1 只有同时满足以下条件才可转 Ready：

### 22.1 范围

- 实现分支开始前必须重新确认 `origin/main` 没有影响本规格的数据结构变化；如有变化先更新规格并重新审查。
- 只实现 Work Report V1。
- 没有 Growth Proof 后续功能。
- 不新增 Migration。
- 没有改变 Runtime、Recovery、Verification、Settlement 业务语义。

### 22.2 数据正确性

- 报告只读聚合七张现有表。
- final effective execution 规则唯一、确定、服务端实现。
- Runtime 选择、Recovery 展示、查询限制和测试统一使用 `MAX_RECOVERY_GRAPH_DEPTH = 2`。
- 超过 depth 2 时，`overallStatus = 'data_incomplete'`，添加 `RECOVERY_GRAPH_DEPTH_EXCEEDED` warning，不选择最终 execution。
- 一致性异常只使用 `data_incomplete` 总体状态，并通过 `RECOVERY_LINK_INCONSISTENT`、`RECOVERY_GRAPH_CYCLE`、`RECOVERY_GRAPH_DEPTH_EXCEEDED`、`LEDGER_LINK_INCONSISTENT`、`SETTLEMENT_FACTS_INCONSISTENT` 等受控 warning code 表达。
- Produce / Recover 链完整。
- Simulation 永不伪装为真实工作。
- Verification passed 的唯一合法来源是 `workflow_step`；`legacy_unknown` 必须对应 unknown。
- Verification 与 Settlement 标签准确且互不推断。
- Gross GP 只来自精确核验的 ledger amount 或 `actual_reward` 的 `inferred_legacy` fallback；两者不可用时为 null/none。
- 不得从 reward_applied、settlement status、estimated reward、Runtime cost 或 energy 推算 GP。
- Token、成本、能量、GP 不双计、不误称。

### 22.3 安全

- owner 权限验证完整。
- Admin 视图只读。
- 敏感字段白名单过滤。
- 分享文本不泄露隐私。
- 原始 input/result 不默认暴露。

### 22.4 兼容性

- 旧 Work Run 可返回。
- 缺字段安全降级。
- JSON 损坏不导致整份报告失败。
- 未知状态不被错误映射为成功。

### 22.5 环境隔离

- CI 启动 Worker、等待 health check，并将实际 origin 注入 `LOCAL_WORKER_ORIGIN`。
- 专项验证显式设置 `WORK_REPORT_API_BASE="$LOCAL_WORKER_ORIGIN"`；未设置时立即失败。
- 固定 `8787` 不是脚本默认值、CI 固定端口或退出门固定值。
- 默认拒绝远程目标。
- 不读取 `VITE_API_BASE` 或根 `.env` 作为脚本隐式 fallback。
- 不静默误连 staging。
- 日志只打印清洗后的 origin，不打印 token、headers、query、userinfo、fragment 或完整 request config。

### 22.6 验证命令

至少通过：

```bash
npm run typecheck
npm run build
npm run verify:static-v1
npm run verify:skill-runtime-lite
npm run verify:workflow-runtime-settlement
npm run verify:research-brief-runtime
WORK_REPORT_API_BASE="$LOCAL_WORKER_ORIGIN" \
TEST_ENDPOINT_TOKEN="$TEST_ENDPOINT_TOKEN" \
npm run verify:work-report
```

### 22.7 最终验收事实

验收报告必须明确列出：

- 本地 Worker origin。
- 测试 Work Run ID。
- 报告类型。
- final effective execution ID。
- Verification 状态。
- Settlement/ledger 状态。
- Token 与成本合计。
- 是否发生 Recovery。
- 是否存在敏感字段泄漏。
- git diff 文件列表。

---

## 23. 实施顺序建议

```text
共享类型
→ 后端 report builder
→ 用户 API 权限
→ final execution / recovery 规则
→ Research Brief serializer
→ 隐私过滤
→ AgentWorkView
→ Admin 只读审计
→ Telegram 分享文本
→ 本地环境隔离验证脚本
→ 完整回归
```

不得先做漂亮 UI，再由前端猜测业务状态。

---

## 24. 最终边界总结

### 当前已实现

- Work Run 与八步 Workflow。
- Skill Runtime execution 与技能 usage。
- Produce/Verify/Recover 绑定。
- immutable Recovery。
- Runtime Settlement Gate。
- Research Brief 真实 Runtime、结构验证与结算闭环。

### Work Report V1 新增

- Work Report V1 只读聚合 API。
- final effective execution 统一选择规则。
- Produce/Recover 可观察时间线。
- Simulation / Verified Runtime / Runtime Unsettled / External Verification Unknown 分类。
- Research Brief 结构化展示。
- Token、成本、能量、GP 的透明口径。
- AgentWorkView 战报信息架构。
- Admin 只读审计。
- Telegram 分享文本。
- 历史兼容与隐私过滤。
- 本地 Worker 环境隔离验证。

### Agent Growth Proof V1 以后再做

- Agent Growth Proof 聚合。
- 能力档案。
- 熟练度、专精、Streak、Trust。
- 徽章、动态流、推荐、资格与赛季。

Work Report V1 的唯一职责是：

> **把一次 Agent 工作的真实事实链，准确、安全、可审计地展示出来。**
