import React, { useState, useEffect } from "react";
import { Trophy, ShieldAlert, Award, Star, ArrowUpRight, AlertTriangle } from "lucide-react";
import type { LeaderboardRow, Agent } from "@growthbot/shared";
import { telegramAdapter } from "../telegramAdapter";

interface LeaderboardViewProps {
  currentUserRank: { rank: number; rankTier: string; pointsToNextTier: number };
  onFetchLeaderboard: (scope: "global" | "group") => Promise<LeaderboardRow[]>;
  onNavigateToEarn: () => void;
  agent: Agent | null;
  t: (key: string, fallback: string) => string;
}

export function LeaderboardView({
  currentUserRank,
  onFetchLeaderboard,
  onNavigateToEarn,
  agent,
  t
}: LeaderboardViewProps) {
  const [scope, setScope] = useState<"global" | "group">("global");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    onFetchLeaderboard(scope)
      .then((data) => {
        setRows(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [scope, onFetchLeaderboard]);

  const handleCatchUp = () => {
    telegramAdapter.hapticImpact("light");
    onNavigateToEarn();
  };

  return (
    <div className="view-panel leaderboard-view animate-fade-in">
      <div className="view-header">
        <h2>{t("rank.title", "排行")}</h2>
        <p className="muted font-12">{t("rank.desc", "任务排行。提升用户分数，冲击更高层级。")}</p>
      </div>

      {/* Scope Selector */}
      <div className="scope-tabs">
        <button
          className={`scope-btn ${scope === "global" ? "active" : ""}`}
          onClick={() => setScope("global")}
        >
          {t("rank.global", "全局用户")}
        </button>
        <button
          className={`scope-btn ${scope === "group" ? "active" : ""}`}
          onClick={() => setScope("group")}
        >
          {t("rank.groups", "战队")}
        </button>
      </div>

      {/* Current User Placement Card */}
      {agent && (
        <div className="current-user-rank-card">
          <div className="card-top-row">
            <div>
              <span className="muted font-11 block">{t("rank.yourRank", "你的排名")}</span>
              <strong>#{currentUserRank.rank.toLocaleString()}</strong>
            </div>
            <div className="text-right">
              <span className="muted font-11 block">{t("rank.tier", "层级状态")}</span>
              <span className="tier-tag">{currentUserRank.rankTier.replace("_", " ").toUpperCase()}</span>
            </div>
          </div>
          <p className="fomo-text">
            <AlertTriangle size={13} className="text-amber" /> {t("rank.fomo", "你距离下一层级只差")} <strong>{currentUserRank.pointsToNextTier} 用户分数</strong> {t("rank.pointsAway", "分。")}
          </p>
          <button className="catchup-btn" onClick={handleCatchUp}>
            {t("rank.farmNow", "立即运行任务")} <ArrowUpRight size={14} />
          </button>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="leaderboard-table-container">
        {loading ? (
          <p className="muted text-center pad-20">{t("rank.loading", "正在加载排行榜...")}</p>
        ) : (
          <div className="leaderboard-rows">
            {rows.map((row) => {
              const isTop3 = row.rank <= 3;
              const isMe = (agent && agent.name && row.displayName === agent.name.split(" ")[0]?.toLowerCase()) || row.displayName === "alpha_user";
              
              return (
                <div key={row.rank} className={`leaderboard-row ${isMe ? "highlight" : ""}`}>
                  <div className="row-left">
                    <span className={`rank-number rank-${row.rank} ${isTop3 ? "top-three" : ""}`}>
                      {isTop3 ? <Star size={12} className="star-icon" /> : null}
                      {row.rank}
                    </span>
                    <span className="display-name">{row.displayName}</span>
                  </div>
                  <span className="row-score">
                    {row.score.toLocaleString()} <span className="score-lbl">{t("rank.score", "分数")}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
