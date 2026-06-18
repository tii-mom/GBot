import React, { useState, useEffect } from "react";
import { Zap, Award, ShieldAlert, KeyRound, Clock, Pickaxe, HelpCircle, Lock, X, ExternalLink, RefreshCw, CheckCircle2, Sparkles, Share2 } from "lucide-react";
import type { Task, Agent, InventoryItem } from "@growthbot/shared";
import { telegramAdapter } from "../telegramAdapter";
import { translateAssetName, translateProjectName, translateTaskName } from "../i18n";
import { apiClient } from "../apiClient";

interface EarnViewProps {
  tasks: Task[];
  agent: Agent | null;
  inventory: InventoryItem[];
  onExecuteTask: (taskId: string, abilityItemId?: string) => Promise<void>; // Kept for compatibility if needed
  onConnectWallet: () => void;
  hasWallet: boolean;
  t: (key: string, fallback: string) => string;
  onRefreshData?: () => Promise<void>;
}

export function EarnView({
  tasks,
  agent,
  inventory,
  onExecuteTask,
  onConnectWallet,
  hasWallet,
  t,
  onRefreshData
}: EarnViewProps) {
  // Tabs state
  const [activeTab, setActiveTab] = useState<"missions" | "bounties">("missions");

  // Mission Modal & verification state
  const [guidedTask, setGuidedTask] = useState<Task | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submissionLink, setSubmissionLink] = useState("");
  const [verifStatus, setVerifStatus] = useState<"pending" | "submitted" | "verifying" | "approved" | "rejected">("pending");
  const [feedbackText, setFeedbackText] = useState("");
  const [pointsEarned, setPointsEarned] = useState(0);

  // Bounty Task network states
  const [bountyTasks, setBountyTasks] = useState<any[]>([]);
  const [loadingBounties, setLoadingBounties] = useState(false);
  const [guidedBounty, setGuidedBounty] = useState<any | null>(null);
  const [bountySubmitting, setBountySubmitting] = useState(false);
  const [bountyVerifying, setBountyVerifying] = useState(false);
  const [bountyLink, setBountyLink] = useState("");
  const [bountyStatus, setBountyStatus] = useState<string>("not_submitted");
  const [bountyFeedback, setBountyFeedback] = useState("");
  const [aiGuide, setAiGuide] = useState<any>(null);
  const [loadingAiGuide, setLoadingAiGuide] = useState(false);

  useEffect(() => {
    if (guidedTask) {
      setLoadingAiGuide(true);
      apiClient.getAiGuide(guidedTask.id, false)
        .then((res: any) => setAiGuide(res))
        .catch((err: any) => console.error("Failed to load AI Guide", err))
        .finally(() => setLoadingAiGuide(false));
    } else if (guidedBounty) {
      setLoadingAiGuide(true);
      apiClient.getAiGuide(guidedBounty.id, true)
        .then((res: any) => setAiGuide(res))
        .catch((err: any) => console.error("Failed to load AI Guide", err))
        .finally(() => setLoadingAiGuide(false));
    } else {
      setAiGuide(null);
    }
  }, [guidedTask, guidedBounty]);

  const loadBounties = async () => {
    setLoadingBounties(true);
    try {
      const res = await apiClient.getBountyTasks();
      if (res && res.tasks) {
        setBountyTasks(res.tasks);
      }
    } catch (e) {
      console.error("Failed to load bounty tasks", e);
    } finally {
      setLoadingBounties(false);
    }
  };

  useEffect(() => {
    loadBounties();
  }, []);

  const handleBountyClick = async (bounty: any) => {
    telegramAdapter.hapticImpact("medium");
    setGuidedBounty(bounty);
    setBountyLink("");
    setBountyStatus("not_submitted");
    setBountyFeedback("");

    try {
      const statusRes = await apiClient.getBountyTaskStatus(bounty.id);
      if (statusRes) {
        setBountyStatus(statusRes.status || "not_submitted");
        setBountyLink(statusRes.link || "");
        setBountyFeedback(statusRes.feedback || "");
      }
    } catch (e) {
      console.error("Failed to fetch bounty status", e);
    }
  };

  const handleBountySubmit = async () => {
    if (!guidedBounty) return;
    const linkVal = bountyLink.trim();
    if (!linkVal) {
      telegramAdapter.showAlert("请输入您的验证链接。");
      return;
    }
    setBountySubmitting(true);
    try {
      const res = await apiClient.submitBountyTask(guidedBounty.id, linkVal);
      setBountyStatus(res.status);
      telegramAdapter.showAlert("验证链接提交成功！");
    } catch (err: any) {
      telegramAdapter.showAlert(err.message || "提交失败，请重试。");
    } finally {
      setBountySubmitting(false);
    }
  };

  const handleBountyVerify = async () => {
    if (!guidedBounty) return;
    const linkVal = bountyLink.trim();
    if (!linkVal) {
      telegramAdapter.showAlert("请输入您的验证链接。");
      return;
    }
    setBountyVerifying(true);
    setBountyStatus("verifying");
    try {
      const res = await apiClient.verifyBountyTask(guidedBounty.id);
      setBountyStatus(res.status);
      if (res.feedback) {
        setBountyFeedback(res.feedback);
      }
      telegramAdapter.showAlert(
        res.status === "approved"
          ? "验收通过，奖励已发放！"
          : res.status === "verifying"
          ? "已转入人工复核中。"
          : "验收未通过。"
      );
      if (onRefreshData) {
        await onRefreshData();
      }
      loadBounties();
    } catch (err: any) {
      setBountyStatus("rejected");
      setBountyFeedback(err.message || "自动验收请求失败。");
      telegramAdapter.showAlert(err.message || "验收失败，请重试。");
    } finally {
      setBountyVerifying(false);
    }
  };

  const shareBountyResult = () => {
    if (!guidedBounty) return;
    const startParam = `bounty_${guidedBounty.id}`;
    const url = `https://t.me/G2047_bot?start=${encodeURIComponent(startParam)}`;
    const text = `GrowthBot Agent 完成赏金任务：${guidedBounty.title}。领取 Agent，发现任务，提交链接获取积分和未来奖励资格。`;
    void apiClient.trackEvent("share_clicked", "bounty_completed", { startParam, bountyTaskId: guidedBounty.id, channel: "telegram" });
    void apiClient.trackEvent("share_completed", "bounty_completed", { startParam, bountyTaskId: guidedBounty.id, channel: "telegram" });
    telegramAdapter.shareUrl(url, text);
  };

  const handleTaskClick = async (task: Task) => {
    if (!agent) return;
    telegramAdapter.hapticImpact("medium");

    // 1. Energy Check
    if (agent.energy < task.energyCost) {
      telegramAdapter.showAlert(t("earn.alertNoEnergy", "能量不足！补能或打开启动盒后继续。"));
      return;
    }

    // 2. Wallet Check
    if (task.requiresWallet && !hasWallet) {
      telegramAdapter.showAlert(t("earn.alertWallet", "该任务需要隔离 Agent Wallet。请使用下方开启入口。"));
      return;
    }

    // 3. Ability Check
    let matchingAbilityId: string | undefined;
    if (task.requiredAbility) {
      const matchingAbility = inventory.find(
        (i) => i.type === "ability" && i.name.toLowerCase().includes(task.requiredAbility!.toLowerCase()) && i.status === "available"
      );
      if (!matchingAbility) {
        telegramAdapter.showAlert(`${t("earn.alertAbility", "该任务需要指定技能。请去市场或开盒获取。")} ${translateAssetName(t, task.requiredAbility)}`);
        return;
      }
      matchingAbilityId = matchingAbility.id;
    }

    // Open guide modal
    setGuidedTask(task);
    setSubmissionLink("");
    setVerifStatus("pending");
    setFeedbackText("");
    setPointsEarned(0);

    // Try fetching existing submission status from backend
    try {
      const res = await apiClient.getTaskVerificationStatus(task.id);
      if (res && res.status && res.status !== "pending") {
        setVerifStatus(res.status as any);
        setSubmissionLink(res.link || "");
        setFeedbackText(res.feedback || "");
      }
    } catch (e) {
      console.warn("Failed to fetch initial task verification status", e);
    }
  };

  const handleOpenLink = () => {
    if (!guidedTask || !guidedTask.targetUrl) return;
    telegramAdapter.hapticImpact("light");
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(guidedTask.targetUrl);
    } else {
      window.open(guidedTask.targetUrl, "_blank");
    }
  };

  const handleSubmitLink = async () => {
    if (!guidedTask) return;
    const linkVal = submissionLink.trim();
    if (!linkVal) {
      telegramAdapter.showAlert(t("earn.inputLinkLabel", "请输入完成链接。"));
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.submitTaskVerification(guidedTask.id, linkVal);
      setVerifStatus("submitted");
      telegramAdapter.showAlert(t("earn.statusSubmitted", "已提交，正在等待 Agent 核查"));
    } catch (err: any) {
      telegramAdapter.showAlert(err.message || t("earn.failed", "提交失败。"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTriggerVerify = async () => {
    if (!guidedTask) return;
    const linkVal = submissionLink.trim();
    if (!linkVal) {
      telegramAdapter.showAlert(t("earn.inputLinkLabel", "请输入完成链接。"));
      return;
    }

    setVerifying(true);
    setVerifStatus("verifying");

    // Find matching ability if task requires one
    let matchingAbilityId: string | undefined;
    if (guidedTask.requiredAbility) {
      const matchingAbility = inventory.find(
        (i) => i.type === "ability" && i.name.toLowerCase().includes(guidedTask.requiredAbility!.toLowerCase()) && i.status === "available"
      );
      if (matchingAbility) {
        matchingAbilityId = matchingAbility.id;
      }
    }

    try {
      const abilityIds = matchingAbilityId ? [matchingAbilityId] : [];
      const res = await apiClient.verifyTaskVerification(guidedTask.id, abilityIds, linkVal);
      setVerifStatus(res.status);
      if (res.status === "approved") {
        setPointsEarned(res.pendingPointsEarned || 0);
        if (onRefreshData) {
          await onRefreshData();
        }
      } else {
        setFeedbackText(res.feedback || "Verification failed.");
      }
    } catch (err: any) {
      setVerifStatus("rejected");
      setFeedbackText(err.message || "Verification request failed.");
    } finally {
      setVerifying(false);
    }
  };

  const getTaskCategoryName = (taskName: string) => {
    const lower = taskName.toLowerCase();
    if (lower.includes("tg") || lower.includes("telegram")) return "Telegram / 社交任务";
    if (lower.includes("x") || lower.includes("twitter")) return "Twitter / 社交任务";
    if (lower.includes("discord")) return "Discord / 社区任务";
    if (lower.includes("survey") || lower.includes("questionnaire") || lower.includes("feedback") || lower.includes("反馈")) return "问卷调查 / 反馈";
    return "Agent 外部验证任务";
  };

  const getTaskStepInstructions = (taskName: string) => {
    const lower = taskName.toLowerCase();
    if (lower.includes("tg") || lower.includes("telegram")) {
      return "1. 点击“去外部平台完成”进入 TG 频道；\n2. 点击加入并验证不是机器人；\n3. 复制你在 TG 的个人主页链接、你的 @用户名 或分享链接，填入下方输入框；\n4. 提交链接并触发验收。";
    }
    if (lower.includes("x") || lower.includes("twitter")) {
      return "1. 点击“去外部平台完成”打开 X/Twitter 并关注；\n2. 复制关注后的 X 主页链接 (例如 https://x.com/username)；\n3. 将链接粘贴至下方输入框；\n4. 提交链接并触发验收。";
    }
    if (lower.includes("discord")) {
      return "1. 点击“去外部平台完成”加入 Discord 社区；\n2. 完成服务器新手引导；\n3. 复制你在该 Discord 中的用户名称或邀请链接/消息链接；\n4. 提交链接并触发验收。";
    }
    return "1. 点击“去外部平台完成”打开外部任务；\n2. 按照页面要求完成操作（如填写问卷、答题）；\n3. 复制完成页面/回执页面链接，粘贴至下方；\n4. 提交链接并触发验收。";
  };

  return (
    <div className="view-panel earn-view animate-fade-in">
      <div className="view-header">
        <h2>{t("earn.title", "任务")}</h2>
        <p className="muted font-12">{t("earn.desc", "指挥 Agent 整理任务并提交外部链接完成验收。")}</p>
      </div>

      {/* Wallet Onboarding Upgrade Strip (Non-blocking) */}
      {!hasWallet && (
        <div className="wallet-onboarding-banner">
          <KeyRound size={20} className="text-amber" />
          <div className="banner-details">
            <strong>{t("earn.walletTitle", "Agentic Wallet 升级")}</strong>
            <span>{t("earn.walletDesc", "准备隔离、需用户授权的钱包任务入口。")}</span>
          </div>
          <button className="wallet-btn mini" onClick={onConnectWallet}>
            {t("earn.unlock", "开启")}
          </button>
        </div>
      )}

      {/* Tab Headers */}
      <div className="tab-headers" style={{ display: "flex", gap: "16px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: "16px" }}>
        <button
          className={`tab-btn font-14 font-bold ${activeTab === "missions" ? "active text-amber" : "text-muted"}`}
          style={{ padding: "8px 4px", background: "none", border: "none", borderBottom: activeTab === "missions" ? "2px solid var(--amber)" : "none", outline: "none", cursor: "pointer", color: activeTab === "missions" ? "var(--amber)" : "rgba(255,255,255,0.6)" }}
          onClick={() => setActiveTab("missions")}
        >
          {t("earn.tab.missions", "Agent 编排任务")}
        </button>
        <button
          className={`tab-btn font-14 font-bold ${activeTab === "bounties" ? "active text-amber" : "text-muted"}`}
          style={{ padding: "8px 4px", background: "none", border: "none", borderBottom: activeTab === "bounties" ? "2px solid var(--amber)" : "none", outline: "none", cursor: "pointer", color: activeTab === "bounties" ? "var(--amber)" : "rgba(255,255,255,0.6)" }}
          onClick={() => setActiveTab("bounties")}
        >
          {t("earn.tab.bounties", "外部赏金网络")}
        </button>
      </div>

      {activeTab === "missions" ? (
        tasks.length === 0 ? (
          <div className="text-center pad-40">
            <HelpCircle size={40} className="muted" style={{ margin: "0 auto 12px" }} />
            <h3>{t("earn.empty", "当前没有可用任务")}</h3>
          </div>
        ) : (
          <div className="tasks-list">
            {tasks.map((task) => {
              const requiresAbility = !!task.requiredAbility;
              const userHasAbility = !requiresAbility || inventory.some(
                (i) => i.type === "ability" && i.name.toLowerCase().includes(task.requiredAbility!.toLowerCase()) && i.status === "available"
              );
              const walletBlocked = task.requiresWallet && !hasWallet;
              const abilityBlocked = requiresAbility && !userHasAbility;
              const energyBlocked = agent ? agent.energy < task.energyCost : true;

              const isBlocked = walletBlocked || abilityBlocked || energyBlocked;

              return (
                <article className={`task-card ${isBlocked ? "locked" : ""}`} key={task.id}>
                  <div className="task-header-row">
                    <h3 className="flex-center gap-6">
                      {isBlocked && <Lock size={13} className="text-muted" />}
                      {translateTaskName(t, task.name)}
                    </h3>
                    {task.projectName && <span className="project-badge">{translateProjectName(t, task.projectName)}</span>}
                  </div>

                  <div className="task-meta-row">
                    <div className="meta-item text-amber font-12 font-bold">
                      <Award size={14} /> +{task.basePendingPoints} {t("earn.points", "积分")}
                    </div>
                    <div className="meta-item text-emerald font-12 font-bold">
                      <Zap size={14} /> {task.energyCost} {t("earn.energy", "能量")}
                    </div>
                    {task.endsAt && (
                      <div className="meta-item muted font-11">
                        <Clock size={12} /> {t("earn.expiring", "即将结束")}
                      </div>
                    )}
                  </div>

                  {walletBlocked && (
                    <div className="requirement-warning text-amber">
                      <ShieldAlert size={14} /> {t("earn.walletRequired", "需要隔离钱包连接以获得分配权重。")}
                    </div>
                  )}

                  {abilityBlocked && (
                    <div className="requirement-warning text-purple">
                      <ShieldAlert size={14} /> {t("earn.requiresAbility", "需要技能")}: {translateAssetName(t, task.requiredAbility)}
                    </div>
                  )}

                  {energyBlocked && !walletBlocked && !abilityBlocked && (
                    <div className="requirement-warning text-danger">
                      <Zap size={14} /> {t("earn.noEnergy", "能量不足")} ({agent ? agent.energy : 0}/{task.energyCost}).
                    </div>
                  )}

                  <div className="task-actions">
                    <button
                      className={isBlocked ? "secondary disabled" : "primary"}
                      onClick={() => !isBlocked && handleTaskClick(task)}
                      disabled={isBlocked}
                    >
                      {isBlocked ? (
                        <Lock size={14} style={{ marginRight: "4px" }} />
                      ) : (
                        <Pickaxe size={14} style={{ marginRight: "4px" }} />
                      )}
                      {isBlocked ? t("earn.locked", "已锁定") : t("earn.queue", "运行任务")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : (
        loadingBounties ? (
          <div className="text-center pad-40">
            <RefreshCw size={30} className="animate-spin text-amber" style={{ margin: "0 auto" }} />
            <p className="muted font-12" style={{ marginTop: "10px" }}>载入赏金任务中...</p>
          </div>
        ) : bountyTasks.length === 0 ? (
          <div className="text-center pad-40">
            <HelpCircle size={40} className="muted" style={{ margin: "0 auto 12px" }} />
            <h3>暂无可用赏金任务</h3>
          </div>
        ) : (
          <div className="tasks-list">
            {bountyTasks.map((bounty) => {
              const isPaused = bounty.status === 'paused';
              const isCompleted = bounty.budgetRemaining <= 0 || (bounty.maxCompletions > 0 && bounty.completedCount >= bounty.maxCompletions);
              return (
                <article className={`task-card bounty-card ${isPaused || isCompleted ? "locked opacity-70" : ""}`} key={bounty.id}>
                  <div className="task-header-row">
                    <h3 className="flex-center gap-6">
                      {bounty.title}
                    </h3>
                    <span className="project-badge flex-center gap-4">
                      <Award size={11} /> {bounty.ownerName || "官方"}
                    </span>
                  </div>

                  <p className="font-12 text-muted" style={{ margin: "6px 0 10px 0", lineHeight: "1.4" }}>
                    {bounty.description}
                  </p>

                  <div className="task-meta-row" style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
                    <div className="meta-item text-amber font-12 font-bold">
                      <Award size={14} /> +{bounty.rewardPoints} GP
                    </div>
                    {bounty.rewardAssetName && (
                      <div className="meta-item text-purple font-12 font-bold">
                        技能卡: {bounty.rewardAssetName}
                      </div>
                    )}
                    {bounty.rewardAccessPass && (
                      <div className="meta-item text-indigo font-12 font-bold">
                        准入权: {bounty.rewardAccessPass}
                      </div>
                    )}
                    <div className="meta-item text-emerald font-12 font-bold">
                      预算剩余: {bounty.budgetRemaining} / {bounty.budgetTotal} GP
                    </div>
                  </div>

                  <div className="task-actions flex-center justify-between">
                    <div className="font-11 text-muted">
                      已完成: {bounty.completedCount} {bounty.maxCompletions > 0 ? `/ ${bounty.maxCompletions}` : ""}
                    </div>
                    <button
                      className={isPaused || isCompleted ? "secondary disabled" : "primary"}
                      onClick={() => !(isPaused || isCompleted) && handleBountyClick(bounty)}
                      disabled={isPaused || isCompleted}
                    >
                      {isPaused ? "已暂停" : (isCompleted ? "已抢光" : "参与赏金")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )
      )}

      {/* Agent Task Guide Modal Overlay */}
      {guidedTask && (
        <div className="box-opening-overlay earn-guide-overlay">
          <div className="box-modal earn-guide-modal" style={{ width: "min(95%, 440px)", maxHeight: "90vh" }}>
            <button className="close-btn" onClick={() => setGuidedTask(null)}>
              <X size={18} />
            </button>

            <h3 className="text-center font-18 text-amber flex-center gap-6 justify-center" style={{ margin: "10px 0 15px 0" }}>
              <Pickaxe size={18} />
              {t("earn.guideTitle", "Agent 任务执行引导")}
            </h3>

            <div className="guided-task-details" style={{ backgroundColor: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "10px", marginBottom: "15px" }}>
              <h4 className="font-14 text-white" style={{ margin: "0 0 8px 0" }}>{translateTaskName(t, guidedTask.name)}</h4>
              <div className="flex-center gap-12 font-12 text-muted" style={{ marginBottom: "10px" }}>
                <span className="flex-center gap-4 text-amber"><Award size={12}/>+{guidedTask.basePendingPoints} GP</span>
                <span className="flex-center gap-4 text-emerald"><Zap size={12}/>{guidedTask.energyCost} 行动力</span>
                {guidedTask.projectName && <span className="project-badge mini">{translateProjectName(t, guidedTask.projectName)}</span>}
              </div>
              <div className="font-11 text-muted" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "8px" }}>
                <strong>{t("earn.categoryLabel", "Agent 技能归类")}:</strong>
                <span className="text-amber font-bold ml-6">{getTaskCategoryName(guidedTask.name)}</span>
              </div>
            </div>

            {/* Agent AI Guide Card */}
            <div className="ai-guide-card" style={{
              background: "linear-gradient(135deg, rgba(212, 163, 89, 0.1) 0%, rgba(212, 163, 89, 0.02) 100%)",
              border: "1px solid rgba(212, 163, 89, 0.2)",
              borderRadius: "10px",
              padding: "12px",
              marginBottom: "15px"
            }}>
              <div className="flex-row justify-between align-center" style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="font-12 font-bold flex-center gap-4 text-amber" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Sparkles size={14} className="glow animate-pulse" />
                  Agent 智能建议
                </span>
                {aiGuide && (
                  <span className={`risk-tag font-10 ${aiGuide.riskLevel}`} style={{
                    padding: "2px 6px",
                    borderRadius: "4px",
                    backgroundColor: aiGuide.riskLevel === "high" ? "rgba(239, 83, 80, 0.2)" : aiGuide.riskLevel === "medium" ? "rgba(255, 167, 38, 0.2)" : "rgba(38, 166, 154, 0.2)",
                    color: aiGuide.riskLevel === "high" ? "#ef5350" : aiGuide.riskLevel === "medium" ? "#ffa726" : "#26a69a"
                  }}>
                    风险: {aiGuide.riskLevel.toUpperCase()}
                  </span>
                )}
              </div>

              {loadingAiGuide ? (
                <p className="font-11 text-muted text-center" style={{ margin: "10px 0" }}>
                  <RefreshCw className="spinning-icon inline mr-6" size={12} />
                  智能体正在检索任务背景与规则约束...
                </p>
              ) : aiGuide ? (
                <>
                  <p className="font-11 text-muted" style={{ margin: "0 0 8px 0", lineHeight: "1.4" }}>
                    {aiGuide.summary}
                  </p>

                  {/* AI Suggested Steps */}
                  <div style={{ marginBottom: "8px" }}>
                    <span className="font-10 text-white block mb-4" style={{ display: "block", marginBottom: "4px" }}>💡 推荐操作步骤：</span>
                    <ul style={{ margin: 0, paddingLeft: "15px", fontSize: "11px", color: "var(--text-muted)" }}>
                      {aiGuide.steps.map((s: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: "3px" }}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommendation Reason */}
                  {aiGuide.recommended && (
                    <div style={{ fontSize: "11px", color: "var(--amber)", backgroundColor: "rgba(212, 163, 89, 0.05)", padding: "6px", borderRadius: "4px", marginBottom: "8px" }}>
                      <strong>推荐理由:</strong> {aiGuide.reason}
                    </div>
                  )}

                  {/* Risk Notes */}
                  {aiGuide.riskNotes && aiGuide.riskNotes.length > 0 && (
                    <div style={{ borderTop: "1px dashed rgba(212, 163, 89, 0.15)", paddingTop: "8px", fontSize: "10px", color: "rgba(239, 83, 80, 0.8)" }}>
                      <strong>⚠️ 安全与风控预警：</strong>
                      <ul style={{ margin: "4px 0 0 0", paddingLeft: "15px" }}>
                        {aiGuide.riskNotes.map((note: string, idx: number) => (
                          <li key={idx} style={{ marginBottom: "2px" }}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="font-11 muted">无法生成 AI 分析报告，已回落至平台默认指引。</p>
              )}
            </div>

            <div className="instruction-step-box" style={{ marginBottom: "15px" }}>
              <h5 className="font-12 text-white font-bold" style={{ margin: "0 0 6px 0" }}>{t("earn.instructionLabel", "执行步骤引导")}:</h5>
              <div className="font-12 text-muted" style={{ whiteSpace: "pre-line", lineHeight: "1.6", backgroundColor: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px" }}>
                {getTaskStepInstructions(guidedTask.name)}
              </div>
            </div>

            {/* Target Link Button */}
            {guidedTask.targetUrl && (
              <button
                className="primary w-full flex-center justify-center gap-6 font-13"
                style={{ padding: "10px", borderRadius: "8px", marginBottom: "20px" }}
                onClick={handleOpenLink}
              >
                <ExternalLink size={14} />
                {t("earn.btnGoComplete", "去外部平台完成")}
              </button>
            )}

            {/* Verification Link Input */}
            <div className="verification-input-area" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "15px", marginBottom: "20px" }}>
              <label className="font-12 text-white font-bold block" style={{ marginBottom: "6px" }}>
                {t("earn.inputLinkLabel", "提交验证链接 (只接受可链接验收)")}:
              </label>
              <input
                type="text"
                placeholder="https://"
                className="w-full font-12 bg-dark-tint"
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", outline: "none", boxSizing: "border-box" }}
                value={submissionLink}
                onChange={(e) => setSubmissionLink(e.target.value)}
                disabled={verifStatus === "approved" || verifStatus === "verifying"}
              />
            </div>

            {/* Verification Status Display */}
            {verifStatus !== "pending" && (
              <div className={`verif-status-display alert-box status-${verifStatus}`} style={{ padding: "12px", borderRadius: "8px", marginBottom: "20px", display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "12px" }}>
                {verifStatus === "submitted" && (
                  <div className="text-amber">
                    <Clock size={16} className="inline mr-6" />
                    <strong>{t("earn.statusSubmitted", "已提交，正在等待 Agent 核查")}</strong>
                  </div>
                )}
                {verifStatus === "verifying" && (
                  <div className="text-amber flex-center gap-6 animate-pulse">
                    <RefreshCw size={16} className="animate-spin" />
                    <strong>{t("earn.statusVerifying", "Agent 正在执行链上/链下核对...")}</strong>
                  </div>
                )}
                {verifStatus === "approved" && (
                  <div className="text-emerald">
                    <CheckCircle2 size={16} className="inline mr-6" />
                    <strong>{t("earn.statusApproved", "验收通过！已获得 GP 与权重奖励")} (+{pointsEarned} GP)</strong>
                  </div>
                )}
                {verifStatus === "rejected" && (
                  <div className="text-danger">
                    <ShieldAlert size={16} className="inline mr-6" />
                    <strong>{t("earn.statusRejected", "验收未通过，原因：")}</strong>
                    <p className="font-11 text-muted ml-22 style-pre-line" style={{ marginTop: "4px" }}>{feedbackText}</p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="modal-actions-column" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {verifStatus !== "approved" && (
                <>
                  <button
                    className="primary w-full flex-center justify-center gap-6"
                    onClick={handleSubmitLink}
                    disabled={submitting || verifying || !submissionLink.trim()}
                    style={{ padding: "12px", borderRadius: "8px" }}
                  >
                    {submitting ? <RefreshCw size={14} className="animate-spin" /> : null}
                    {t("earn.btnSubmitVerif", "提交完成链接")}
                  </button>

                  <button
                    className="secondary w-full flex-center justify-center gap-6"
                    onClick={handleTriggerVerify}
                    disabled={verifying || submitting || !submissionLink.trim()}
                    style={{ padding: "12px", borderRadius: "8px", border: "1px solid var(--amber)", color: "var(--amber)" }}
                  >
                    {verifying ? <RefreshCw size={14} className="animate-spin" /> : null}
                    {t("earn.btnVerify", "触发验收")}
                  </button>
                </>
              )}

              <button
                className="secondary w-full text-center"
                onClick={() => setGuidedTask(null)}
                style={{ padding: "10px", borderRadius: "8px" }}
              >
                {verifStatus === "approved" ? t("home.ack", "知道了") : t("common.cancel", "关闭")}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Bounty Task Step Modal */}
      {guidedBounty && (
        <div className="box-opening-overlay earn-guide-overlay">
          <div className="box-modal earn-guide-modal" style={{ width: "min(95%, 440px)", maxHeight: "90vh", overflowY: "auto" }}>
            <button className="close-btn" onClick={() => setGuidedBounty(null)}>
              <X size={18} />
            </button>

            <h3 className="text-center font-18 text-amber flex-center gap-6 justify-center" style={{ margin: "10px 0 15px 0" }}>
              <Pickaxe size={18} />
              赏金任务执行指引
            </h3>

            <div className="guided-task-details" style={{ backgroundColor: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "10px", marginBottom: "15px" }}>
              <h4 className="font-14 text-white" style={{ margin: "0 0 8px 0" }}>{guidedBounty.title}</h4>
              <p className="font-12 text-muted" style={{ marginBottom: "10px" }}>{guidedBounty.description}</p>
              <div className="flex-center gap-12 font-12 text-muted" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "8px" }}>
                <span className="text-amber"><Award size={12} className="inline mr-4"/>+{guidedBounty.rewardPoints} GP</span>
                <span className="text-emerald">预算剩余: {guidedBounty.budgetRemaining} GP</span>
              </div>
            </div>

            {/* Agent AI Guide Card */}
            <div className="ai-guide-card" style={{
              background: "linear-gradient(135deg, rgba(212, 163, 89, 0.1) 0%, rgba(212, 163, 89, 0.02) 100%)",
              border: "1px solid rgba(212, 163, 89, 0.2)",
              borderRadius: "10px",
              padding: "12px",
              marginBottom: "15px"
            }}>
              <div className="flex-row justify-between align-center" style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="font-12 font-bold flex-center gap-4 text-amber" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Sparkles size={14} className="glow animate-pulse" />
                  Agent 智能建议
                </span>
                {aiGuide && (
                  <span className={`risk-tag font-10 ${aiGuide.riskLevel}`} style={{
                    padding: "2px 6px",
                    borderRadius: "4px",
                    backgroundColor: aiGuide.riskLevel === "high" ? "rgba(239, 83, 80, 0.2)" : aiGuide.riskLevel === "medium" ? "rgba(255, 167, 38, 0.2)" : "rgba(38, 166, 154, 0.2)",
                    color: aiGuide.riskLevel === "high" ? "#ef5350" : aiGuide.riskLevel === "medium" ? "#ffa726" : "#26a69a"
                  }}>
                    风险: {aiGuide.riskLevel.toUpperCase()}
                  </span>
                )}
              </div>

              {loadingAiGuide ? (
                <p className="font-11 text-muted text-center" style={{ margin: "10px 0" }}>
                  <RefreshCw className="spinning-icon inline mr-6" size={12} />
                  智能体正在检索任务背景与规则约束...
                </p>
              ) : aiGuide ? (
                <>
                  <p className="font-11 text-muted" style={{ margin: "0 0 8px 0", lineHeight: "1.4" }}>
                    {aiGuide.summary}
                  </p>

                  {/* AI Suggested Steps */}
                  <div style={{ marginBottom: "8px" }}>
                    <span className="font-10 text-white block mb-4" style={{ display: "block", marginBottom: "4px" }}>💡 推荐操作步骤：</span>
                    <ul style={{ margin: 0, paddingLeft: "15px", fontSize: "11px", color: "var(--text-muted)" }}>
                      {aiGuide.steps.map((s: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: "3px" }}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommendation Reason */}
                  {aiGuide.recommended && (
                    <div style={{ fontSize: "11px", color: "var(--amber)", backgroundColor: "rgba(212, 163, 89, 0.05)", padding: "6px", borderRadius: "4px", marginBottom: "8px" }}>
                      <strong>推荐理由:</strong> {aiGuide.reason}
                    </div>
                  )}

                  {/* Risk Notes */}
                  {aiGuide.riskNotes && aiGuide.riskNotes.length > 0 && (
                    <div style={{ borderTop: "1px dashed rgba(212, 163, 89, 0.15)", paddingTop: "8px", fontSize: "10px", color: "rgba(239, 83, 80, 0.8)" }}>
                      <strong>⚠️ 安全与风控预警：</strong>
                      <ul style={{ margin: "4px 0 0 0", paddingLeft: "15px" }}>
                        {aiGuide.riskNotes.map((note: string, idx: number) => (
                          <li key={idx} style={{ marginBottom: "2px" }}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="font-11 muted">无法生成 AI 分析报告，已回落至平台默认指引。</p>
              )}
            </div>

            <div className="instruction-step-box" style={{ marginBottom: "15px" }}>
              <h5 className="font-12 text-white font-bold" style={{ margin: "0 0 6px 0" }}>任务执行步骤:</h5>
              <div className="font-12 text-muted" style={{ whiteSpace: "pre-line", lineHeight: "1.6", backgroundColor: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px" }}>
                {t("bounty.step.agent", "1. Agent 发现并整理步骤") + "\n" +
                 t("bounty.step.user", "2. 您在外部平台完成最后一步") + "\n" +
                 t("bounty.step.submit", "3. 提交可验证的链接")}
              </div>
            </div>

            {/* Target Link */}
            {guidedBounty.targetUrl && (
              <button
                className="primary w-full flex-center justify-center gap-6 font-13"
                style={{ padding: "10px", borderRadius: "8px", marginBottom: "20px" }}
                onClick={() => {
                  telegramAdapter.hapticImpact("light");
                  if (window.Telegram?.WebApp?.openLink) {
                    window.Telegram.WebApp.openLink(guidedBounty.targetUrl);
                  } else {
                    window.open(guidedBounty.targetUrl, "_blank");
                  }
                }}
              >
                <ExternalLink size={14} />
                去外部平台完成
              </button>
            )}

            {/* Submission Input */}
            <div className="verification-input-area" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "15px", marginBottom: "20px" }}>
              <label className="font-12 text-white font-bold block" style={{ marginBottom: "6px" }}>
                提交验证链接 (只接受可链接验收):
              </label>
              <input
                type="text"
                placeholder="https://"
                className="w-full font-12 bg-dark-tint"
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", outline: "none", boxSizing: "border-box" }}
                value={bountyLink}
                onChange={(e) => setBountyLink(e.target.value)}
                disabled={bountyStatus === "approved" || bountyStatus === "verifying"}
              />
            </div>

            {/* Disclaimer */}
            <div className="font-10 text-muted" style={{ marginBottom: "20px", lineHeight: "1.4" }}>
              {t("bounty.disclaimer", "* 自动验收仅对链接格式和风险进行核实，并不表示能物理确认外部平台的操作状态。请确保真实完成。")}
            </div>

            {/* Bounty Verification Status Display */}
            {bountyStatus !== "not_submitted" && (
              <div className={`verif-status-display alert-box status-${bountyStatus}`} style={{ padding: "12px", borderRadius: "8px", marginBottom: "20px", fontSize: "12px" }}>
                {bountyStatus === "submitted" && (
                  <div className="text-amber">
                    <Clock size={16} className="inline mr-6" />
                    <strong>已提交验证，请点击“触发验收”开始验收</strong>
                  </div>
                )}
                {bountyStatus === "verifying" && (
                  <div className="text-amber flex-center gap-6 animate-pulse">
                    <RefreshCw size={16} className="animate-spin" />
                    <strong>人工审核中 / 系统复核中...</strong>
                  </div>
                )}
                {bountyStatus === "approved" && (
                  <div className="text-emerald">
                    <CheckCircle2 size={16} className="inline mr-6" />
                    <strong>验收通过，奖励已成功发放！</strong>
                  </div>
                )}
                {bountyStatus === "rejected" && (
                  <div className="text-danger">
                    <ShieldAlert size={16} className="inline mr-6" />
                    <strong>验收被拒，反馈原因：</strong>
                    <p className="font-11 text-muted ml-22" style={{ marginTop: "4px" }}>{bountyFeedback || "链接不合规，请核对后重新提交。"}</p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="modal-actions-column" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {bountyStatus !== "approved" && (
                <>
                  <button
                    className="primary w-full flex-center justify-center gap-6"
                    onClick={handleBountySubmit}
                    disabled={bountySubmitting || bountyVerifying || !bountyLink.trim()}
                    style={{ padding: "12px", borderRadius: "8px" }}
                  >
                    {bountySubmitting ? <RefreshCw size={14} className="animate-spin" /> : null}
                    提交链接
                  </button>

                  <button
                    className="secondary w-full flex-center justify-center gap-6"
                    onClick={handleBountyVerify}
                    disabled={bountyVerifying || bountySubmitting || !bountyLink.trim()}
                    style={{ padding: "12px", borderRadius: "8px", border: "1px solid var(--amber)", color: "var(--amber)" }}
                  >
                    {bountyVerifying ? <RefreshCw size={14} className="animate-spin" /> : null}
                    触发验收
                  </button>
                </>
              )}
              {bountyStatus === "approved" && (
                <button
                  className="primary w-full flex-center justify-center gap-6"
                  onClick={shareBountyResult}
                  style={{ padding: "12px", borderRadius: "8px" }}
                >
                  <Share2 size={14} />
                  分享赏金战报
                </button>
              )}

              <button
                className="secondary w-full text-center"
                onClick={() => setGuidedBounty(null)}
                style={{ padding: "10px", borderRadius: "8px" }}
              >
                关闭
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
