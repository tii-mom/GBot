import React, { useState, useEffect } from "react";
import { Zap, Trophy, ShieldAlert, Award, Play, Share2, Sparkles, RefreshCw, Clock, Package, Flame, Users, ArrowRight, Activity } from "lucide-react";
import type { Agent, FomoSnapshot, User } from "@growthbot/shared";
import { telegramAdapter } from "../telegramAdapter";
import { apiClient, getRealAssetFallback } from "../apiClient";
import { interpolate, translateAssetName, translateBoxOdds, translateBoxRoute, translateRarity } from "../i18n";

interface HomeViewProps {
  user: User;
  agent: Agent | null;
  onClaimAgent: () => Promise<void>;
  onFarm: (taskIds: string[], abilityItemIds: string[]) => Promise<void>; // kept for backward compatibility signature
  availableTasksCount: number;
  activeAbilities: string[];
  pointsToNextTier: number;
  triggerMockRefill: () => void;
  statusText: string;
  fomoSnapshot: FomoSnapshot | null;
  t: (key: string, fallback: string) => string;
  onOpenStudio?: () => void;
  onNavigateToRank?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export function HomeView({
  user,
  agent,
  onClaimAgent,
  onFarm,
  availableTasksCount,
  activeAbilities,
  pointsToNextTier,
  triggerMockRefill,
  statusText,
  fomoSnapshot,
  t,
  onOpenStudio,
  onNavigateToRank,
  onNavigateToTab
}: HomeViewProps) {
  const [activeRun, setActiveRun] = useState<any | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);

  const fetchActiveRun = async () => {
    if (agent) {
      setLoadingRun(true);
      try {
        const res = await apiClient.getActiveWorkRun(agent.id);
        if (res && res.run) {
          setActiveRun(res.run);
        } else {
          setActiveRun(null);
        }
      } catch (err) {
        console.error("Failed to load active run on HomeView", err);
      } finally {
        setLoadingRun(false);
      }
    }
  };

  useEffect(() => {
    fetchActiveRun();
  }, [agent]);

  const shareReport = () => {
    telegramAdapter.hapticImpact("light");
    const referralLink = `https://t.me/G2047_bot?start=ref_${user.telegramId}`;
    const text = agent?.status !== "idle"
      ? t("share.personalActive", "GrowthBot Agent 战报：我的 Agent 正在运行任务。Agent 与启动技能包已激活。")
      : interpolate(t("share.personalIdle", "GrowthBot Real Asset Agent report: G / TON / AI Credits ready, Skill Card packs left: {boxes}。"), {
          points: agent?.pendingPoints || 0,
          boxes: fomoSnapshot?.boxesRemaining.fomo ?? 221
        });
    void apiClient.trackEvent("share_clicked", "home_personal_report", { startParam: `ref_${user.telegramId}`, channel: "telegram" });
    void apiClient.trackEvent("share_personal_report", "home_personal_report", { startParam: `ref_${user.telegramId}`, channel: "telegram" });
    void apiClient.trackEvent("share_completed", "home_personal_report", { startParam: `ref_${user.telegramId}`, channel: "telegram" });
    telegramAdapter.shareUrl(referralLink, text);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "idle": return t("status.idle", "就绪闲置");
      case "working":
      case "executing": return t("status.working", "正在执行");
      case "analyzing": return t("status.analyzing", "正在分析");
      case "planning": return t("status.planning", "正在规划");
      case "waiting_user": return t("status.waiting_user", "等待确认");
      case "verifying": return t("status.verifying", "验证审核中");
      case "completed": return t("status.completed", "已完成");
      case "paused": return t("status.paused", "已暂停");
      case "failed": return t("status.failed", "执行失败");
      default: return status;
    }
  };

  // 1. NO AGENT STATE
  if (!agent) {
    return (
      <div className="view-panel claim-screen animate-fade-in">
        <div className="claim-hero">
          <div className="glowing-avatar brand-avatar">
            <img src="/growthbot-logo.png" alt="GrowthBot" className="agent-logo-img brand-mark-img" />
          </div>
          <h1>GrowthBot</h1>
          <p className="claim-subtitle">
            {t("top.title.claim", "激活 Agent 工作台")}
          </p>
        </div>

        <div className="benefit-list">
          <div className="benefit-item">
            <Sparkles size={20} className="glow-emerald" />
            <div>
              <strong>{t("home.claim", "激活 Agent")}</strong>
              <span>{t("home.farmNow", "创建 Agent 工作台，开启策略限制的 Agent 体验。")}</span>
            </div>
          </div>
          <div className="benefit-item">
            <Zap size={20} className="glow-amber" />
            <div>
              <strong>{t("home.starterBox", "启动盒已包含")}</strong>
              <span>{t("home.starterBoxDesc", "包含基础 Skill Cards 与 AI capacity onboarding，不承诺固定结果。")}</span>
            </div>
          </div>
        </div>

        <div className="cta-container">
          <button className="primary claim-btn" onClick={onClaimAgent}>
            {t("home.claim", "激活 Agent")}
          </button>
          <p className="safety-warning-text">
            {t("home.noAgentSafety", "当前版本不需要真实资金。隔离 Agent Wallet 仍在准备中。")}
          </p>
        </div>
      </div>
    );
  }

  // 2. RESTRICTED USER STATE
  if (user.riskStatus === "restricted") {
    return (
      <div className="view-panel risk-restricted-view text-center">
        <ShieldAlert size={64} className="risk-icon" />
        <h2>{t("home.restricted", "账户受限")}</h2>
        <p className="muted" style={{ margin: "16px 0" }}>
          {t("home.restrictedDesc", "Risk controls detected suspicious activity. Agent actions, budgets, and evidence generation are paused.")}
        </p>
        <button className="secondary" onClick={() => telegramAdapter.showAlert(t("home.contactSupport", "请通过 @GrowthBotSupport 联系支持。"))}>
          {t("home.appeal", "申诉限制")}
        </button>
      </div>
    );
  }

  // 3. NORMAL ACTIVE AGENT STATE
  const realAsset = getRealAssetFallback(agent.id, user.id);
  const assetAmount = (asset: "G" | "TON" | "AI_CREDIT") => realAsset.assetBalances.find((balance) => balance.asset === asset)?.available.amount || "0";
  const aiCredits = realAsset.aiCreditBalance[0]?.balance.amount || assetAmount("AI_CREDIT");
  const energyPercent = Math.min(100, Math.floor((agent.energy / agent.maxEnergy) * 100));
  const isEnergyEmpty = agent.energy === 0;
  const launchEndsAt = fomoSnapshot?.launchWindowEndsAt ? new Date(fomoSnapshot.launchWindowEndsAt) : null;
  const minutesLeft = launchEndsAt ? Math.max(1, Math.floor((launchEndsAt.getTime() - Date.now()) / 60000)) : 300;
  const formatLaunchTime = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  };
  const groupProgress = fomoSnapshot
    ? Math.min(100, Math.floor((fomoSnapshot.groupAgentsActive / fomoSnapshot.nextGroupUnlockAgents) * 100))
    : 53;

  return (
    <div className="view-panel home-view animate-fade-in" style={{ paddingBottom: "80px" }}>
      {/* Energy Bar Warning */}
      {isEnergyEmpty && (
        <div className="energy-warning-banner">
          <p>
            <strong>{t("home.idle", "Agent 空闲")}:</strong> {t("home.energyEmptyDesc", "Agent 已暂停任务。原因：能量为空。补充能量或开盒后继续。")}
          </p>
          <button className="refill-action-btn" onClick={triggerMockRefill}>
            {t("home.freeRefill", "免费补能")}
          </button>
        </div>
      )}

      {/* Profile Header */}
      <div className="agent-profile-header">
        <div className="avatar-side">
          <div className="agent-avatar-glow">
            <img src="/growthbot-logo.png" alt="GrowthBot Agent" className="agent-avatar-img brand-mark-img" />
          </div>
          <div>
            <h3>{agent.name}</h3>
            <span className="level-badge">{t("home.level", "等级")} {agent.level} Scout Agent</span>
          </div>
        </div>
        <div className="rank-badge-side flex-row align-center gap-6" style={{ display: "flex", alignItems: "center", gap: "6px" }} onClick={onNavigateToRank}>
          <Trophy size={16} className="text-amber" />
          <span>{agent.rankTier.replace("_", " ").toUpperCase()}</span>
          {user.studioEnabled && onOpenStudio && (
            <button
              className="studio-trigger-btn"
              onClick={(e) => {
                e.stopPropagation();
                telegramAdapter.hapticImpact("light");
                onOpenStudio();
              }}
              title="Agent Studio"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--amber)",
                padding: "0 4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center"
              }}
            >
              <Sparkles size={16} className="glow animate-pulse" />
            </button>
          )}
        </div>
      </div>

      {/* Command Live Snapshot */}
      <div className="fomo-command-center">
        <div className="fomo-command-header">
          <div>
            <span className="eyebrow uppercase">{t("home.commandWindow", "实时任务窗口")}</span>
            <h2>{formatLaunchTime(minutesLeft)} {t("home.leftToFarm", "距离今日任务窗口结束还有")}</h2>
          </div>
          <span className="live-pill">{t("home.live", "LIVE")}</span>
        </div>
        <div className="fomo-signal-grid">
          <div className="fomo-signal">
            <Package size={15} className="text-amber" />
            <strong>{fomoSnapshot?.boxesRemaining.fomo ?? 221}</strong>
            <span>{t("home.boxesLeft", "Alpha 盒剩余")}</span>
          </div>
          <div className="fomo-signal">
            <Flame size={15} className="text-danger" />
            <strong>{fomoSnapshot?.activeAgentsToday ?? 137}</strong>
            <span>{t("home.agentsToday", "今日活跃 Agent")}</span>
          </div>
          <div className="fomo-signal">
            <Trophy size={15} className="text-emerald" />
            <strong>{pointsToNextTier}</strong>
            <span>{t("home.scoreToNext", "距离下一档分数")}</span>
          </div>
        </div>
        <div className="group-unlock-strip">
          <div className="unlock-header">
            <span><Users size={14} className="text-emerald" /> {t("home.groupUnlock", "战队盒解锁")}</span>
            <span>{fomoSnapshot?.groupAgentsActive ?? 8}/{fomoSnapshot?.nextGroupUnlockAgents ?? 15} {t("pool.active", "个 Agent 活跃")}</span>
          </div>
          <div className="progress-track mini">
            <div className="progress-fill farm" style={{ width: `${groupProgress}%` }} />
          </div>
        </div>
      </div>

      {/* Stats Board */}
      <div className="agent-stats-grid" style={{ marginTop: "16px" }}>
        <div className="stat-box">
          <span className="stat-label">{t("home.pendingPoints", "G balance")}</span>
          <strong className="stat-value">{assetAmount("G")} G</strong>
          <span className="stat-sub">{t("home.futureWeight", "Agent Wallet budget · no promised return")}</span>
        </div>

        <div className="stat-box">
          <span className="stat-label">TON gas / AI Credits</span>
          <strong className="stat-value">{assetAmount("TON")} TON · {aiCredits} AI</strong>
          <span className="stat-sub">Policy-limited task capacity</span>
        </div>
      </div>

      {/* Energy Card */}
      <div className="energy-card" style={{ marginTop: "16px" }}>
        <div className="energy-header">
          <span className="energy-label">
            <Zap size={14} className="text-amber" /> {t("home.energy", "Agent 行动力")}
          </span>
          <span className="energy-value">
            {agent.energy} / {agent.maxEnergy}
          </span>
        </div>
        <div className="progress-track">
          <div
            className={`progress-fill ${isEnergyEmpty ? "empty" : ""}`}
            style={{ width: `${energyPercent}%` }}
          />
        </div>
      </div>

      {/* 4. Real Backend Agent Work Dashboard Card */}
      <div className="card backend-agent-card" style={{ padding: "16px", borderRadius: "12px", background: "var(--card-bg)", marginTop: "16px", border: "1px solid var(--border)" }}>
        <div className="flex-row justify-between align-center" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 className="font-13 uppercase flex-row align-center gap-6" style={{ margin: 0, display: "flex", gap: "6px", alignItems: "center" }}>
            <Activity size={15} className="text-epic" /> {t("home.agentStatusTitle", "Agent 实时运作状态")}
          </h4>
          <span className={`rarity-tag ${agent.status === "idle" ? "common" : "epic"}`} style={{ fontSize: "10px" }}>
            {getStatusLabel(agent.status)}
          </span>
        </div>

        {activeRun ? (
          <div style={{ marginTop: "12px" }}>
            <div className="flex-row justify-between align-center" style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <strong>{activeRun.taskId.replace("task_", "").toUpperCase()}</strong>
              <span className="muted">{activeRun.currentStep}/{activeRun.totalSteps} {t("work.stepsCount", "步")}</span>
            </div>
            
            <div className="progress-track mini" style={{ margin: "8px 0" }}>
              <div className="progress-fill farm" style={{ width: `${activeRun.progress}%` }} />
            </div>

            <button 
              className="secondary action-btn flex-row align-center justify-between font-11"
              style={{ width: "100%", padding: "8px 12px", marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              onClick={() => onNavigateToTab?.("work")}
            >
              <span>{t("home.enterWorkbench", "进入工作台查看详情")}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div style={{ marginTop: "10px" }}>
            <p className="muted font-11" style={{ margin: 0 }}>
              {t("home.agentIdleDesc", "Agent 当前处于闲置状态，行动力已就绪。你可以进入任务面板指派日常赏金计划。")}
            </p>
            <button 
              className="primary action-btn font-11"
              style={{ width: "100%", padding: "10px", marginTop: "12px" }}
              onClick={() => onNavigateToTab?.("earn")}
            >
              {t("home.goAssignTasks", "去指派赏金任务")}
            </button>
          </div>
        )}
      </div>

      {/* Active abilities */}
      <div className="active-abilities-section" style={{ marginTop: "20px" }}>
        <h4>{t("home.activeAbilities", "Skill Cards / Auto Purchase Policy")}</h4>
        <p className="muted font-11" style={{ margin: "4px 0 8px 0" }}>31-card capability system · Auto Purchase {realAsset.walletPolicy?.autoPurchaseEnabled ? "enabled" : "paused"} · latest simulated AI Model Token intent: {realAsset.purchaseIntentSummary.proposed} proposed / {realAsset.purchaseIntentSummary.allowed} allowed.</p>
        {activeAbilities.length === 0 ? (
          <p className="muted font-12" style={{ margin: "6px 0 0 0" }}>{t("home.noAbilities", "暂无生效技能，开盒后可获得任务资产。")}</p>
        ) : (
          <div className="ability-pills" style={{ marginTop: "8px" }}>
            {activeAbilities.map((ab, idx) => (
              <span key={idx} className="ability-pill">
                {ab}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="home-action-buttons" style={{ marginTop: "20px" }}>
        <button
          className="primary action-btn flex-center gap-6"
          onClick={() => onNavigateToTab?.(agent.status === "idle" ? "earn" : "work")}
          disabled={agent.status === "idle" ? isEnergyEmpty : false}
        >
          <Play size={16} /> 
          {agent.status === "idle" ? t("home.assignNow", "指派工作") : t("home.viewWorkbench", "查看工作台")}
        </button>
        <button className="secondary action-btn flex-center gap-6" onClick={shareReport}>
          <Share2 size={16} /> {t("home.shareReport", "分享战报")}
        </button>
      </div>
    </div>
  );
}
