import React, { useState, useEffect } from "react";
import { Zap, Trophy, ShieldAlert, Award, Play, Share2, Sparkles, RefreshCw, Clock, Package, Flame, Users } from "lucide-react";
import type { Agent, FomoSnapshot, User } from "@growthbot/shared";
import { telegramAdapter } from "../telegramAdapter";
import { apiClient } from "../apiClient";
import { interpolate, translateAssetName, translateBoxOdds, translateBoxRoute, translateRarity } from "../i18n";

interface HomeViewProps {
  user: User;
  agent: Agent | null;
  onClaimAgent: () => Promise<void>;
  onFarm: (taskIds: string[], abilityItemIds: string[]) => Promise<void>;
  availableTasksCount: number;
  activeAbilities: string[];
  pointsToNextTier: number;
  triggerMockRefill: () => void;
  statusText: string;
  fomoSnapshot: FomoSnapshot | null;
  t: (key: string, fallback: string) => string;
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
  t
}: HomeViewProps) {
  const [isFarming, setIsFarming] = useState(false);
  const [farmProgress, setFarmProgress] = useState(0);
  const [farmCompleted, setFarmCompleted] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);

  // Farming simulation effect
  useEffect(() => {
    let interval: any;
    if (isFarming) {
      interval = setInterval(() => {
        setFarmProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsFarming(false);
            setFarmCompleted(true);
            // Simulate point earning display
            const earned = Math.floor(100 + Math.random() * 300);
            setEarnedPoints(earned);
            // Execute parent Mission action with mock empty lists for default run
            onFarm(["task_daily_checkin", "task_group_pool"], []);
            return 100;
          }
          return prev + 5;
        });
      }, 150);
    }
    return () => clearInterval(interval);
  }, [isFarming]);

  const startFarmingFlow = () => {
    if (!agent) return;
    if (agent.energy < 25) {
      telegramAdapter.showAlert(t("home.notEnoughEnergy", "能量不足！补充能量或开盒获得加成。"));
      return;
    }
    telegramAdapter.hapticImpact("medium");
    setIsFarming(true);
    setFarmProgress(0);
    setFarmCompleted(false);
  };

  const shareReport = () => {
    telegramAdapter.hapticImpact("light");
    const referralLink = `https://t.me/G2047_bot?start=ref_${user.telegramId}`;
    const text = isFarming
      ? t("share.personalActive", "GrowthBot Agent 战报：我的 Agent 正在运行任务。免费 Agent 和启动盒已开启。")
      : interpolate(t("share.personalIdle", "GrowthBot 战报：已获得 {points} 待结算积分，Alpha 盒还剩 {boxes} 个。"), {
          points: agent?.pendingPoints || 0,
          boxes: fomoSnapshot?.boxesRemaining.fomo ?? 221
        });
    void apiClient.trackEvent("share_personal_report", "home", { startParam: `ref_${user.telegramId}` });
    telegramAdapter.shareUrl(referralLink, text);
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
            {t("top.title.claim", "领取 Agent 开始任务")}
          </p>
        </div>

        <div className="benefit-list">
          <div className="benefit-item">
            <Sparkles size={20} className="glow-emerald" />
            <div>
              <strong>{t("home.claim", "领取免费 Agent")}</strong>
              <span>{t("home.farmNow", "无需钱包设置，立即运行任务。")}</span>
            </div>
          </div>
          <div className="benefit-item">
            <Zap size={20} className="glow-amber" />
            <div>
              <strong>{t("home.starterBox", "启动盒已包含")}</strong>
              <span>{t("home.starterBoxDesc", "稳定掉落积分、能量和基础任务技能。")}</span>
            </div>
          </div>
        </div>

        <div className="cta-container">
          <button className="primary claim-btn" onClick={onClaimAgent}>
            {t("home.claim", "领取免费 Agent")}
          </button>
          <p className="safety-warning-text">
            {t("home.noAgentSafety", "V0 不需要真实资金。Agentic Wallet 仍处于实验阶段。")}
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
          {t("home.restrictedDesc", "反女巫验证检测到可疑活动，积分累积已冻结。")}
        </p>
        <button className="secondary" onClick={() => telegramAdapter.showAlert(t("home.contactSupport", "请通过 @GrowthBotSupport 联系支持。"))}>
          {t("home.appeal", "申诉限制")}
        </button>
      </div>
    );
  }

  // 3. NORMAL ACTIVE AGENT STATE
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
    <div className="view-panel home-view animate-fade-in">
      {/* Top Banner Status */}
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

      {/* Profile summary */}
      <div className="agent-profile-header">
        <div className="avatar-side">
        <div className="agent-avatar-glow">
            <img src="/growthbot-logo.png" alt="GrowthBot Agent" className="agent-avatar-img brand-mark-img" />
          </div>
          <div>
            <h3>{agent.name}</h3>
              <span className="level-badge">{t("home.level", "等级")} {agent.level} Agent</span>
          </div>
        </div>
        <div className="rank-badge-side">
          <Trophy size={16} className="text-amber" />
          <span>{agent.rankTier.replace("_", " ").toUpperCase()}</span>
        </div>
      </div>

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
        <div className="rare-drop-ticker">
          {(fomoSnapshot?.recentDrops || []).slice(0, 2).map((drop) => (
            <div key={drop.id} className="rare-drop-row">
              <Sparkles size={12} className="text-amber" />
              <span className="drop-text"><strong>{drop.username}</strong> {t("home.openedWord", "开出了")} {translateAssetName(t, drop.boxName)}</span>
              <span className={`rarity-tag ${drop.rarity}`}>{translateAssetName(t, drop.rewardName)}</span>
            </div>
          ))}
        </div>
      </div>

      {fomoSnapshot?.boxSupply && (
        <div className="box-supply-strip">
          {fomoSnapshot.boxSupply.map((box) => {
            const remainPercent = Math.min(100, Math.max(0, Math.floor((box.remaining / box.total) * 100)));
            return (
              <div key={box.key} className={`box-supply-card border-${box.rarity}`}>
                <div className="box-supply-top">
                  <span className={`rarity-tag ${box.rarity}`}>{translateRarity(t, box.rarity)}</span>
                  <strong className="font-11">{box.remaining}/{box.total}</strong>
                </div>
                <h4>{translateAssetName(t, box.name)}</h4>
                <div className="mini-progress-track" style={{ margin: "6px 0" }}>
                  <div className={`mini-progress-fill ${box.rarity}`} style={{ width: `${remainPercent}%` }} />
                </div>
                <div className="box-supply-details">
                  <p>{translateBoxRoute(t, box.route)}</p>
                  <span className="odds-text">{translateBoxOdds(t, box.oddsLabel)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="brand-scene-strip">
        <div className="brand-scene-card">
          <img src="/growthbot-logo.png" alt="GrowthBot" className="brand-scene-img" />
          <div>
            <strong>{t("home.brandSceneTitle", "GrowthBot 已上线")}</strong>
            <p>{t("home.brandSceneDesc", "领取、开盒、任务都在同一个入口完成。")}</p>
          </div>
        </div>
      </div>

      {/* Stats Board */}
      <div className="agent-stats-grid">
        <div className="stat-box">
          <span className="stat-label">{t("home.pendingPoints", "待结算积分")}</span>
          <strong className="stat-value">{agent.pendingPoints.toLocaleString()}</strong>
          <span className="stat-sub">{t("home.futureWeight", "未来奖励权重")}</span>
        </div>

        <div className="stat-box">
          <span className="stat-label">{t("home.userScore", "用户分数")}</span>
          <strong className="stat-value">{agent.userScore.toLocaleString()}</strong>
          <span className="stat-sub">{t("home.globalScore", "全局排名分数")}</span>
        </div>
      </div>

      {/* Energy Bar */}
      <div className="energy-card">
        <div className="energy-header">
          <span className="energy-label">
            <Zap size={14} className="text-amber" /> {t("home.energy", "能量等级")}
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

      {/* Farming State Area */}
      <div className="farming-status-area">
        {isFarming ? (
          <div className="farming-progress-panel">
            <div className="farming-loader-row">
              <RefreshCw className="spinning-icon" size={18} />
              <span>{t("home.farming", "Agent 正在执行可用任务...")}</span>
            </div>
            <div className="progress-track mini">
              <div className="progress-fill farm" style={{ width: `${farmProgress}%` }} />
            </div>
            <p className="farm-eta">{t("home.finishIn", "预计完成还需")} {Math.floor((100 - farmProgress) / 10)}s</p>
          </div>
        ) : farmCompleted ? (
          <div className="farming-complete-panel animate-pop-in">
            <Award size={20} className="text-emerald" />
            <p>
              {t("home.completed", "你的 Agent 已完成任务并获得")} <strong>+{earnedPoints} {t("home.pendingPoints", "待结算积分")}</strong>{t("home.exclaim", "！")}
            </p>
              <button className="dismiss-btn" onClick={() => setFarmCompleted(false)}>
              {t("home.ack", "知道了")}
            </button>
          </div>
        ) : (
          <div className="farming-idle-panel">
            <p className="muted font-13">{statusText || t("home.agentReady", "你的 Agent 已就绪。")}</p>
          </div>
        )}
      </div>

      {/* Active abilities */}
      <div className="active-abilities-section">
        <h4>{t("home.activeAbilities", "当前技能")}</h4>
        {activeAbilities.length === 0 ? (
          <p className="muted font-12">{t("home.noAbilities", "暂无生效技能，开盒后可获得任务资产。")}</p>
        ) : (
          <div className="ability-pills">
            {activeAbilities.map((ab, idx) => (
              <span key={idx} className="ability-pill">
                {ab}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Recommendation and rank distance */}
      <div className="fomo-tip-card">
        <p>
          <Clock size={13} /> {t("home.tipPrefix", "你距离")} <strong>{pointsToNextTier}</strong> {t("home.tipSuffix", "只差")} <strong>Top 20%</strong>{t("home.tipEnd", "分。今日头部 Agent 的任务次数是普通用户的 3.1 倍。")}
        </p>
      </div>

      {/* Actions */}
      <div className="home-action-buttons">
        <button 
          className="primary action-btn flex-center gap-6" 
          onClick={startFarmingFlow} 
          disabled={isFarming || isEnergyEmpty}
        >
          <Play size={16} /> {t("home.farmNow", "运行任务")}
        </button>
        <button className="secondary action-btn flex-center gap-6" onClick={shareReport}>
          <Share2 size={16} /> {t("home.shareReport", "分享战报")}
        </button>
      </div>
    </div>
  );
}
