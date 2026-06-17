# GrowthBot 前端开发提示词

```text
你是 GrowthBot 项目的前端工程师，请在现有 monorepo 工程中继续开发前端，不要改变工程根目录结构。项目根目录结构已经存在：apps/miniapp 是 Telegram Mini App 前端，apps/admin 是 Admin Console 前端，packages/shared 是共享 TypeScript 类型，apps/api-worker 是 Cloudflare Worker API，migrations 是 D1 migrations。请只重点修改 apps/miniapp、apps/admin 和必要的共享前端类型/工具，不要重写后端，不要删除现有文档。项目部署目标是 Cloudflare Pages，前端技术栈是 React + TypeScript + Vite，图标使用 lucide-react，可以继续使用纯 CSS，也可以引入 Tailwind 但要保证可运行。产品名 GrowthBot，定位是 Telegram 原生的 Agent 网络产品。核心概念是：Wallet 是用户的执行账户，Agent 是自动打工人，盲盒是能力来源，市场是交易放大器。目标用户是加密用户、空投猎人、Telegram 群用户，他们需要无门槛、强传播、傻瓜式操作体验。请不要做营销落地页，Mini App 第一屏必须是实际产品体验：领取免费 Agent、打开启动盒、获得积分/能量/技能、启动任务、看到排行压力、引导分享战报或加入战队。

请先阅读并遵循这些项目文档的意图：docs/FRONTEND_HANDOFF.md、docs/SCREEN_DATA_SPEC.md、docs/API_CONTRACT.md、docs/BOT_COPY.md、docs/MVP_USER_FLOW.md、docs/V0_SCOPE.md、docs/POINTS_AND_BOX_RULES.md、docs/MARKETPLACE_RULES.md。Mini App 必须移动端优先，适合 Telegram 内打开，页面包括 Agent 首页、开盒、背包、任务、战队、市场、排行。Admin Console 页面包括仪表盘、用户、任务、盲盒、资产、市场、风控。视觉风格要 crypto-native、高对比、奖励感强、有倒计时、稀有度、排行榜、价格变化、热度提示；不要像普通 SaaS，不要大段说明文字，不要首页营销页。Mini App 的每个页面都要有清晰操作入口：运行任务、开盒、分享战报、加入战队、打开市场、挂售物品。

现有 API 已在 apps/api-worker/src/index.ts 中提供，默认前端通过 VITE_API_BASE=http://localhost:8787 请求；请保留这种 API client 方式，并在 API 不可用时提供本地 mock fallback，方便单独预览前端。请把 API client、mock data、types、formatters 拆成清晰文件，不要把所有逻辑堆在 main.tsx。

Mini App 必须支持这些 UI 状态：无 Agent、Agent 已激活、能量为空、开盒中、开盒成功、背包为空、任务需要技能、任务需要钱包、市场为空、购买成功、账户受限。请实现 Telegram Mini App 安全区域和移动端布局，但不要依赖真实 Telegram SDK 才能预览；封装 telegram adapter，若 window.Telegram.WebApp 不存在就使用 mock adapter。请设计更完整的交互：开盒动画或揭晓状态、任务执行进度、战报卡片、分享按钮、战队解锁进度、市场地板价/成交量/最近成交、背包物品操作、排行榜距离下一档位。

Admin Console 要实用，不需要花哨：仪表盘指标、用户列表和用户详情占位、任务/盲盒/资产配置表单、市场交易监控、风险标记列表、暂停盲盒/暂停任务等运营按钮。

所有涉及空投的文案必须避免 guaranteed token、guaranteed profit、fixed conversion、risk-free、automatic profit 等表达，使用 points、airdrop chance、allocation weight、future reward eligibility、project-specific redemption。请输出完整可运行代码，并确保在项目根目录 npm install 后，可以运行 npm run dev:miniapp 预览 Mini App、npm run dev:admin 预览 Admin、npm run build 和 npm run typecheck 通过。
```
