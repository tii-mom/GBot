import React, { useState } from "react";
import { Users, ShieldAlert, Award, Star, Share2, Plus, Sparkles } from "lucide-react";
import type { FomoSnapshot, GroupPool } from "@growthbot/shared";
import { telegramAdapter } from "../telegramAdapter";
import { apiClient } from "../apiClient";
import { interpolate, translateAssetName } from "../i18n";

interface GroupPoolViewProps {
  joinedPool: GroupPool | null;
  fomoSnapshot: FomoSnapshot | null;
  onJoinPool: (telegramGroupId: string) => Promise<void>;
  onNavigateToEarn: () => void;
  t: (key: string, fallback: string) => string;
}

export function GroupPoolView({ joinedPool, fomoSnapshot, onJoinPool, onNavigateToEarn, t }: GroupPoolViewProps) {
  const [groupIdInput, setGroupIdInput] = useState("-100123456789");
  const [submitting, setSubmitting] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupIdInput.trim()) return;
    setSubmitting(true);
    telegramAdapter.hapticImpact("medium");

    try {
      await onJoinPool(groupIdInput);
      telegramAdapter.showAlert(t("pool.joined", "已成功加入战队！"));
    } catch (err: any) {
      telegramAdapter.showAlert(err.message || t("pool.joinFailed", "加入战队失败"));
    } finally {
      setSubmitting(false);
    }
  };

  const shareGroupLink = () => {
    if (!joinedPool) return;
    telegramAdapter.hapticImpact("light");
    const referralUrl = `https://t.me/G2047_bot?start=group_${joinedPool.telegramGroupId}`;
    const needed = Math.max(0, (fomoSnapshot?.nextGroupUnlockAgents ?? 15) - (fomoSnapshot?.groupAgentsActive ?? 8));
    const text = interpolate(t("share.group", "GrowthBot 战队邀请：还差 {needed} 个 Agent 解锁今日战队盒。打开 GrowthBot 领取你的 Agent。"), { needed });
    void apiClient.trackEvent("share_clicked", "group_pool_invite", { startParam: `group_${joinedPool.telegramGroupId}`, needed, channel: "telegram" });
    void apiClient.trackEvent("share_group_invite", "group_pool_invite", { startParam: `group_${joinedPool.telegramGroupId}`, needed, channel: "telegram" });
    void apiClient.trackEvent("share_completed", "group_pool_invite", { startParam: `group_${joinedPool.telegramGroupId}`, needed, channel: "telegram" });
    telegramAdapter.shareUrl(referralUrl, text);
  };

  const activeAgents = fomoSnapshot?.groupAgentsActive ?? 8;
  const requiredAgents = fomoSnapshot?.nextGroupUnlockAgents ?? 15;
  const missingAgents = Math.max(0, requiredAgents - activeAgents);
  const unlockProgress = Math.min(100, Math.floor((activeAgents / requiredAgents) * 100));

  return (
    <div className="view-panel group-pool-view animate-fade-in">
      <div className="view-header">
        <h2>{t("pool.title", "战队")}</h2>
        <p className="muted font-12">{t("pool.desc", "邀请 Telegram 群成员加入，一起解锁战队盒。")}</p>
      </div>

      {/* 1. NOT JOINED STATE */}
      {!joinedPool ? (
        <div className="pool-onboarding">
          <div className="card text-center inline-join-box">
            <Users size={40} className="glow-emerald icon-margin" />
            <h3>{t("pool.join", "加入战队")}</h3>
            <p className="muted font-12" style={{ margin: "10px 0" }}>
              {t("pool.desc", "每个 Telegram 群里的活跃 Agent 都会推进战队解锁进度。")}
            </p>

            <form onSubmit={handleJoin} className="join-pool-form">
              <div className="form-group">
                <label>{t("pool.telegramGroupId", "Telegram 群 ID")}</label>
                <input
                  type="text"
                  value={groupIdInput}
                  onChange={(e) => setGroupIdInput(e.target.value)}
                  placeholder="-100..."
                  required
                />
              </div>
              <button type="submit" className="primary" disabled={submitting}>
                <Plus size={16} style={{ marginRight: "4px" }} />
                {submitting ? t("pool.joining", "正在加入...") : t("pool.join", "加入战队")}
              </button>
            </form>
          </div>

          <div className="rules-card">
            <h4>{t("pool.rules", "战队规则")}</h4>
            <ul>
              <li>{t("pool.rule1", "每个已验证 Agent 都会提高战队加成。")}</li>
              <li>{t("pool.rule2", "战队每天可解锁专属战队盒。")}</li>
              <li>{t("pool.rule3a", "")}{missingAgents}{t("pool.rule3b", " 个 Agent 才能解锁今日战队盒。")}</li>
            </ul>
          </div>
        </div>
      ) : (
        /* 2. JOINED POOL STATE */
        <div className="pool-dashboard animate-pop-in">
          {/* Pool stats card */}
          <div className="pool-stats-summary-card">
            <div className="pool-title-row">
              <h3>{translateAssetName(t, joinedPool.title || "Crew")}</h3>
              <span className="multiplier-badge">{joinedPool.boostMultiplier}x Boost</span>
            </div>
            <p className="muted font-11">{t("pool.groupId", "群组编号")}: {joinedPool.telegramGroupId}</p>

            <div className="stats-row-grid">
              <div className="sub-stat">
                <span className="muted font-11 block">{t("pool.rank", "排名")}</span>
                <strong>#{joinedPool.rank}</strong>
              </div>
              <div className="sub-stat">
                <span className="muted font-11 block">{t("pool.members", "成员")}</span>
                <strong>{joinedPool.memberCount}</strong>
              </div>
              <div className="sub-stat">
                <span className="muted font-11 block">{t("pool.dailyScore", "今日分数")}</span>
                <strong>{joinedPool.dailyScore.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          {/* Crew Box unlock progress */}
          <div className="unlock-progress-card">
            <div className="unlock-header">
              <span>
                <Sparkles size={14} className="text-amber" /> {t("home.groupUnlock", "战队盒解锁")}
              </span>
              <span>{activeAgents} / {requiredAgents} {t("pool.active", "个 Agent 活跃")}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill farm" style={{ width: `${unlockProgress}%` }} />
            </div>
            <p className="muted font-11 unlock-helper">
              {t("pool.unlockHintA", "再邀请 ")}{missingAgents}{t("pool.unlockHintB", " 位群成员领取 Agent，即可解锁今日战队盒。")}
            </p>
          </div>

          {/* Top contributors */}
          <div className="top-contributors">
            <h4>{t("pool.top", "贡献榜")}</h4>
            <div className="contributors-list">
              <div className="contributor-row">
                <span>1. mission_runner</span>
                <strong>4,200 pts</strong>
              </div>
              <div className="contributor-row">
                <span>2. ton_sniper</span>
                <strong>3,150 pts</strong>
              </div>
              <div className="contributor-row">
                <span>3. user_mock ({t("pool.you", "你")})</span>
                <strong>2,400 pts</strong>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="pool-actions">
            <button className="primary" onClick={shareGroupLink}>
              <Share2 size={16} style={{ marginRight: "6px" }} /> {t("pool.invite", "邀请群成员")}
            </button>
            <button className="secondary" onClick={onNavigateToEarn}>
              {t("pool.farm", "运行战队任务")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
