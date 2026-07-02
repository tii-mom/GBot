import { TelegramAuthorizedSourceMock, TelegramOpportunitySignalMock } from "./telegramSourceMockTypes";

export const MOCK_TELEGRAM_SOURCES: TelegramAuthorizedSourceMock[] = [
  {
    id: "src_1",
    sourceType: "group",
    titlePreview: "公会群 · Alpha Hunters",
    permissionScope: ["提及响应", "战报分享"],
    status: "authorized_mock",
    riskLevel: "low",
    lastSignalAt: "2026-06-29 11:20",
    dataBoundary: "只在被 @GBot 提及或管理员显式指定时接入数据，坚决不监控其他普通会话记录。",
    canSee: ["@GBot 提及的消息", "管理员批准发布的悬赏通告", "用户显式提交的数据链接"],
    cannotSee: ["群内普通用户的闲聊对话", "敏感账户私钥或钱包秘密", "未经提及的普通社交聊天流"]
  },
  {
    id: "src_2",
    sourceType: "channel",
    titlePreview: "TON 公告频道",
    permissionScope: ["公开公告读取"],
    status: "pending",
    riskLevel: "low",
    dataBoundary: "仅读取公开可访问的官方发布渠道，不进入任何加密或非公开频道。",
    canSee: ["频道内发布的公开公告消息", "官方外接悬赏详情"],
    cannotSee: ["频道的后台管理设置", "订阅用户的个人社交数据"]
  },
  {
    id: "src_3",
    sourceType: "user_submission",
    titlePreview: "用户手动提交链接",
    permissionScope: ["提交链接解析"],
    status: "authorized_mock",
    riskLevel: "low",
    lastSignalAt: "2026-06-29 09:40",
    dataBoundary: "仅在用户通过客户端手动复制并发送特定 URL 时进行单次解析，不做自动抓取。",
    canSee: ["用户手动粘贴的公开赏金任务链接", "与之配套的文字说明描述"],
    cannotSee: ["用户浏览器的历史记录", "用户未主动发送的本地剪贴板内容"]
  },
  {
    id: "src_4",
    sourceType: "bot_mention",
    titlePreview: "@GBot Mention Inbox",
    permissionScope: ["提及应答"],
    status: "authorized_mock",
    riskLevel: "low",
    lastSignalAt: "2026-06-29 10:15",
    dataBoundary: "仅对包含 @ 标签的私聊与指令进行响应，不主动打扰用户或向陌生人推送私信。",
    canSee: ["明确 @ 机器人的文字查询指令", "指定的命令参数"],
    cannotSee: ["用户个人的隐私聊天流", "非指令性质的普通私信"]
  },
  {
    id: "src_5",
    sourceType: "public_link",
    titlePreview: "公开任务链接",
    permissionScope: ["白名单公开链接整理"],
    status: "pending",
    riskLevel: "medium",
    dataBoundary: "仅整理经过社区治理白名单过滤的公开任务池，不对未知来源的危险链接做任何交互。",
    canSee: ["白名单池中已公开的活动链接"],
    cannotSee: ["第三方网站的内部敏感代码", "用户的账户会话凭证"]
  }
];

export const MOCK_TELEGRAM_SIGNALS: TelegramOpportunitySignalMock[] = [
  {
    id: "sig_1",
    sourceId: "src_1",
    signalType: "bounty",
    title: "TON Liquid Staking 协议反馈悬赏",
    summary: "自动发现于公会群 @提及线索。任务要求提交一份关于 TON 质押协议的安全及交互体验反馈报告。",
    sourceType: "group",
    confidenceLevel: "high",
    estimatedAiCreditCost: 12,
    requiredSkills: ["项目研究", "技术写作"],
    riskFlags: ["低风险"],
    status: "pending_user",
    evidencePreview: ["发现群内 @ 提及指令: '/check_staking'", "已提取官方质押平台白名单地址"],
    recommendedAction: "配备项目研究技能卡后，派 Agent 进行探索分析。"
  },
  {
    id: "sig_2",
    sourceId: "src_1",
    signalType: "guild_task",
    title: "开发工具包文档校对与翻译",
    summary: "由公会群管理员发布的协助校对文档的协作任务。需要将 TON 开发手册翻译为中文并校订格式错误。",
    sourceType: "group",
    confidenceLevel: "high",
    estimatedAiCreditCost: 8,
    requiredSkills: ["技术文档"],
    riskFlags: ["低风险"],
    status: "candidate",
    evidencePreview: ["匹配到关键词: 'translation', 'SDK docs'", "群管已提供可验证文档链接"],
    recommendedAction: "点击『转为候选任务』由 Agent 进行格式与翻译拟稿。"
  },
  {
    id: "sig_3",
    sourceId: "src_3",
    signalType: "bounty",
    title: "社区活跃度数据抓取与验证反馈",
    summary: "用户手动提交的社交平台任务。要求提交近 7 天推特运营指标的可审计截图以完成任务方验收。",
    sourceType: "user_submission",
    confidenceLevel: "medium",
    estimatedAiCreditCost: 15,
    requiredSkills: ["Social Monitoring", "Auditing"],
    riskFlags: ["包含外部社交链接", "需提供推特验证凭证"],
    status: "candidate",
    evidencePreview: ["用户提交网址: twitter.com/growthbot/status/...", "检测到图片提取请求"],
    recommendedAction: "确认无钓鱼风险后，授权派 Agent 验证完成。"
  },
  {
    id: "sig_4",
    sourceId: "src_5",
    signalType: "risk_link",
    title: "异常质押池钓鱼欺诈警示",
    summary: "白名单链接检查器检测到疑似仿冒的 TON 质押链接，并为用户生成安全警示报告。",
    sourceType: "public_link",
    confidenceLevel: "high",
    estimatedAiCreditCost: 4,
    requiredSkills: ["Onchain Risk Analysis"],
    riskFlags: ["仿冒风险", "高风险"],
    status: "pending_user",
    evidencePreview: ["链接域名: ton-staking-claim.net (疑似高仿)", "合约方法特征码不匹配"],
    recommendedAction: "Policy Guard 自动拦截。请忽略此线索，建议手动撤销此外部链接授权。"
  },
  {
    id: "sig_5",
    sourceId: "src_2",
    signalType: "announcement",
    title: "生态系统基金第三期资助计划公告",
    summary: "从公告频道中捕获的新资助提案。Agent 可根据公告分析出具有资助资格的细分 bounty 线索。",
    sourceType: "channel",
    confidenceLevel: "medium",
    estimatedAiCreditCost: 10,
    requiredSkills: ["Project Research"],
    riskFlags: ["信息公告类"],
    status: "candidate",
    evidencePreview: ["官方公告推送时间: 2026-06-29 08:00", "文档内容匹配到资助主题"],
    recommendedAction: "提取完毕。可转化为普通项目研究分析方向。"
  }
];
