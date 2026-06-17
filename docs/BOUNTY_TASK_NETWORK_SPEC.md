# GrowthBot 赏金任务网络规格

## 1. 目标

把 GrowthBot 从“Agent 技能卡 + 任务验收”推进到“赏金任务网络”。

核心闭环：
- 任务发起方提供预算和目标。
- Agent 自动发现、归类、整理任务。
- 用户完成最后一步并提交链接。
- 平台验收后发放积分、技能卡、准入权或后续奖励权重。

V1 不做：
- 多链代币自动结算。
- 用户主钱包控制。
- 真实链上自动交易。

## 2. 任务来源

任务只能来自真实需求方：
- 平台官方任务。
- 白名单项目方任务。
- 白名单 KOL / 社区任务。
- 后续才开放用户自助赏金。

禁止：
- 无预算的空任务。
- 不能链接验收的任务作为主任务。
- 需要平台代操作账号密码的任务。

## 3. 任务结构

每个任务至少包含：
- `taskId`
- `title`
- `category`
- `platform`
- `targetUrl`
- `budget`
- `reward`
- `deadline`
- `verificationRule`
- `submissionType`
- `riskLevel`
- `ownerType`

平台建议支持的任务类型：
- Telegram 关注 / 入群 / 频道任务。
- X 发帖 / 转发 / 关注任务。
- Discord 加群 / 身份绑定任务。
- 问卷 / 表单 / 活动报名任务。
- 项目页面访问 / Mini App 内行为任务。

## 4. Agent 职责

Agent 只做编排，不代替用户完成外部平台动作。

Agent 可以：
- 扫描可做任务。
- 判断任务是否适合当前用户。
- 整理任务步骤。
- 生成直达链接。
- 提醒截止时间。
- 收集提交链接。
- 触发格式验收。
- 生成战报。

用户负责：
- 在外部平台完成最后一步。
- 提交可验证链接。

## 4.1 Agent 智能与自定义模型

GrowthBot 后续支持 Agent Bot Studio，但不放在普通用户第一屏。

普通用户：
- 默认使用平台 Agent 和平台模型额度。
- 无需填写 API Key。

高级用户 / KOL / 项目方 / 工作室：
- 可配置自定义模型 Base URL、Model ID 和 API Key。
- 可配置 Agent 名称、Prompt 模板、任务偏好、风险偏好、每日调用上限。
- 可购买平台托管模型额度和高级任务源订阅。

安全约束：
- 用户 API Key 必须后端加密存储，前端不得回显明文。
- 模型调用走后端代理，不允许前端直接携带用户 Key 请求模型服务。
- 模型输出只作为任务解析、步骤生成、风险提示和推荐排序建议。
- 模型不能直接发奖、改写积分、批准验收或触发钱包交易。
- 钱包相关动作必须用户二次确认，并放到 Agentic Wallet beta 阶段。

## 5. 验收方式

只把链接作为主验收入口。

状态流转：
- `draft`
- `submitted`
- `verifying`
- `approved`
- `rejected`

验收规则：
- Telegram / X / Discord / 项目页链接可以做格式校验。
- 截图不作为主验收方式。
- 高奖励任务可进入人工抽检。

## 6. 奖励结构

V1 奖励建议：
- POINT_TEST。
- 技能卡。
- 准入权 / 白名单权重。
- 未来奖励资格。

不建议 V1 直接开放：
- 多链代币直接发放。
- 固定兑换率承诺。
- 绝对化收益承诺。

## 7. 风控

必须记录：
- 发起方。
- 预算。
- 完成人数。
- 失败率。
- 链接格式错误率。
- 人工审核比例。

必须拦截：
- 自我刷量。
- 同一来源批量垃圾提交。
- 可疑任务重复发布。
- 无预算任务。

## 8. 后台页面建议

Admin 最少需要：
- 任务池管理。
- 预算和奖励配置。
- 验收列表。
- 人工审核入口。
- 任务统计和转化漏斗。
- 风险标记。

## 9. API 建议

建议新增或整理：
- `POST /admin/bounty/tasks`
- `GET /bounty/tasks`
- `POST /bounty/tasks/:taskId/submit`
- `POST /bounty/tasks/:taskId/verify`
- `GET /bounty/tasks/:taskId/status`
- `GET /admin/bounty/tasks`
- `GET /admin/bounty/verifications`
- `POST /admin/bounty/verifications/:id/approve`
- `POST /admin/bounty/verifications/:id/reject`

未来 Agent Bot Studio 预留：
- `GET /agent/model-config`
- `POST /agent/model-config`
- `DELETE /agent/model-config`
- `POST /agent/tasks/:taskId/ai-guide`
- `POST /admin/agent/prompt-templates`

## 10. 产品叙事

对外表达：
- Agent 帮你发现任务。
- Agent 帮你整理步骤。
- 你完成最后一步。
- 平台验收后给你积分和未来奖励资格。

不要对外表达：
- guaranteed profit
- guaranteed token
- fixed conversion
- risk-free
- 自动替用户操作账号
