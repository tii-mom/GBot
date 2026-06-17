# GrowthBot 前端修复线程提示词

```text
你是 GrowthBot 前端修复线程。请只处理 UI/UX、响应式、状态展示和小型交互修复，不要重写应用架构，不要修改后端，不要改变 API contract，不要改变积分/盲盒/市场经济规则。

当前项目路径是 /Users/yudeyou/Desktop/GrowthBot。项目结构：apps/miniapp 是 Telegram Mini App，apps/admin 是 Admin Console，packages/shared 是共享类型，apps/api-worker 是 Cloudflare Worker。Cloudflare 当前地址：Mini App 为 https://app.gb8.top，Admin 为 https://admin.gb8.top，API 为 https://api.gb8.top；staging alias 为 https://staging.growthbot-miniapp.pages.dev 和 https://staging.growthbot-admin.pages.dev。请优先基于真实 API 模式检查，但必须保留 ?mock=true 预览能力。

请先阅读 docs/FRONTEND_HANDOFF.md、docs/SCREEN_DATA_SPEC.md、docs/API_CONTRACT.md、docs/BOT_COPY.md、docs/V0_SCOPE.md、docs/POINTS_AND_BOX_RULES.md、docs/MARKETPLACE_RULES.md、docs/GO_LIVE_CHECKLIST.md、docs/REAL_CLIENT_ACCEPTANCE_V02.md。当前公开叙事是 Agent、任务、技能、战队、Alpha、准入权和 Agentic Wallet，不要在用户可见或运营可见文案中使用 FOMO、sleep while farming、auto farming、guaranteed token、guaranteed profit、fixed conversion、risk-free 等表达。

Mini App 修复范围：首页盲盒供应卡片、实时任务窗口、稀有掉落 ticker、分享战报；开盒页奖励揭晓、技能用途、分享结果；背包页技能用途、次数、过期、可交易性；市场页热门/稀有/即将到期/地板分区、挂单卡片信息层级、购买/取消/挂售反馈；战队页解锁进度和邀请入口；任务页锁定态、钱包任务文案、loading/empty/error 状态。Admin 修复范围：Launch Ops 页面、Dashboard 指标、桌面/移动表格、Admin token 输入、暂停控制清晰度。

视觉方向保持 crypto-native、高对比、奖励感强、稀有度明显、信息密度适中。不要做营销落地页，不要新增大段说明文字，不要过量 blur/glow，不要让卡片互相套卡片。移动端必须优先，底部导航不能遮挡内容，开盒 modal 不能超出屏幕，按钮文字不能溢出。所有涉及空投/积分/市场的文案必须避免 guaranteed token、guaranteed profit、fixed conversion、risk-free、automatic profit，使用 points、airdrop chance、allocation weight、future reward eligibility、project-specific redemption。

不要删除 mock mode；不要提交 dist、node_modules、.DS_Store、tsconfig.tsbuildinfo 或其他生成物。完成后必须运行 npm run typecheck 和 npm run build，并回复修改文件、修复点、验证结果、仍需主线程处理的问题。
```
