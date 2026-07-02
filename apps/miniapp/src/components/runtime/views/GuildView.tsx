import React from "react";
import {
  Bot,
  Castle,
  CheckCircle2,
  Crown,
  Eye,
  Gift,
  Key,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  XOctagon
} from "lucide-react";
import { CollapsibleCard } from "../index";
import { GroupGuardianRulesPreview } from "../telegram";
import { RuntimeState } from "../runtimeTypes";
import { BUBBLE_EDITIONS } from "../bubbleAgentCatalog";
import { apiClient } from "../../../apiClient";
import { telegramAdapter } from "../../../telegramAdapter";

interface GuildViewProps {
  state: RuntimeState;
}

const steps = [
  {
    id: "step_1",
    name: "邀请进群",
    permission: "群组成员 / 选填管理员",
    canSee: "被 @ 提及的消息、公开任务链接",
    cannotSee: "群聊普通历史对话"
  },
  {
    id: "step_2",
    name: "配置守门",
    permission: "群管理规则",
    canSee: "高风险链接、垃圾签名",
    cannotSee: "成员日常闲聊"
  },
  {
    id: "step_3",
    name: "@ 提及分析",
    permission: "允许 Bot 响应提及",
    canSee: "@GBot 唤起的问题和指令",
    cannotSee: "无提及普通交流"
  },
  {
    id: "step_4",
    name: "分享战报",
    permission: "用户主动分享",
    canSee: "Work Report 摘要卡",
    cannotSee: "钱包私密预算和划转记录"
  }
];

const leaderboard = [
  { rank: 1, name: "灵巧金牛座战队", xp: "4200 XP", style: "gold" },
  { rank: 2, name: "自动化双子小队", xp: "3900 XP", style: "silver" },
  { rank: 3, name: "守护巨蟹座战队", xp: "3450 XP", style: "bronze" }
];

const modules = [
  { icon: ShieldCheck, label: "群守门", value: "风险过滤" },
  { icon: Sparkles, label: "战报分享", value: "晒成果" },
  { icon: Users, label: "公会任务", value: "协作待开放" }
];

const battleReports = [
  { id: "r1", title: "文档校对战报", result: "候选 8 G", status: "已验收" },
  { id: "r2", title: "项目线索整理", result: "待确认", status: "等待用户" }
];

export const GuildView: React.FC<GuildViewProps> = ({ state }) => {
  const { user, agent } = state;
  const inviteCode = user?.id || "guest";
  const inviteUrl = `https://t.me/GrowthBot?start=${inviteCode}`;

  const handleShareGuildWall = () => {
    const link = typeof window !== "undefined" ? `${window.location.origin}/?startapp=guild_${inviteCode}` : inviteUrl;
    const text = "来 GBot 公会展示墙看看编号泡泡、特别款和可验证战报。";
    void apiClient.trackEvent("share_clicked", "guild_wall", { inviteCode, channel: "telegram" });
    void apiClient.trackEvent("share_completed", "guild_wall", { inviteCode, channel: "telegram" });
    telegramAdapter.shareUrl(link, text);
  };

  return (
    <main className="gbot-mini-page gbot-guild-page">
      {/* 1. HUD Top Header */}
      <header className="gbot-mini-header">
        <div className="gbot-mini-header__left">
          <div className="gbot-mini-header__icon">
            <Castle size={18} />
          </div>
          <div className="gbot-mini-header__titles">
            <h1>公会房间</h1>
            <span>GUILD ROOM</span>
          </div>
        </div>
        <div className="gbot-mini-header__right">
          <span className="gbot-mini-pill">
            <Bot size={14} />
            {agent ? `Lv.${agent.level || 1}` : "待激活"}
          </span>
        </div>
      </header>

      {/* 2. Stat Strip */}
      <div className="gbot-mini-stat-strip">
        <div className="gbot-mini-stat-item">
          <div className="gbot-mini-stat-item__top">
            <span>公会人数</span>
          </div>
          <strong>{user ? "1 人小队" : "未入会"}</strong>
          <i><b style={{ width: "40%" }} /></i>
        </div>
        <div className="gbot-mini-stat-item">
          <div className="gbot-mini-stat-item__top">
            <span>共享宝箱</span>
          </div>
          <strong>1500 XP</strong>
          <i><b style={{ width: "75%" }} /></i>
        </div>
        <div className="gbot-mini-stat-item">
          <div className="gbot-mini-stat-item__top">
            <span>本周战报</span>
          </div>
          <strong>{battleReports.length} 篇</strong>
          <i><b style={{ width: "100%" }} /></i>
        </div>
      </div>

      {/* 3. Compact Merged Invite Card */}
      <section className="gbot-mini-panel" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(12,14,23,0.85))" }}>
        <div className="gbot-invite-card" style={{ padding: 0, border: "none", background: "transparent", margin: 0 }}>
          <div className="gbot-invite-card__badge" style={{ width: "36px", height: "36px" }}>
            <Gift size={20} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong style={{ fontSize: "14px", display: "block" }}>邀请好友组建 Agent 小队</strong>
            <p style={{ fontSize: "11px", margin: "2px 0 0 0" }}>好友激活后双方得训练道具。</p>
            <span style={{ fontSize: "10px", color: "rgba(255,247,223,0.5)", wordBreak: "break-all" }}>{inviteUrl}</span>
          </div>
          <button type="button" className="gbot-mini-btn" onClick={handleShareGuildWall} style={{ minHeight: "44px", padding: "0 14px" }}>
            <Share2 size={15} />
            分享
          </button>
        </div>
      </section>

      {/* 4. Guild Modules Strip */}
      <div className="gbot-guild-modules" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", margin: 0 }}>
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <article key={module.label} style={{ padding: "8px 6px", textAlign: "center" }}>
              <Icon size={16} style={{ color: "var(--amber-glow)", margin: "0 auto 2px auto" }} />
              <span style={{ fontSize: "11px", display: "block" }}>{module.label}</span>
              <strong style={{ fontSize: "10px" }}>{module.value}</strong>
            </article>
          );
        })}
      </div>

      {/* 5. Collapsible Detail Section (Showcase Wall, Battle Reports, Guardian, Leaderboard & Chest) */}
      <CollapsibleCard
        title="展示墙 · 战报 · 守门规则"
        summary="泡泡展示墙 · 最近战报 · 4 步权限流向 · 周榜 Top 3 · 共享宝箱"
        className="gbot-drawer-card"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Bubble Showcase Wall */}
          <div className="gbot-mini-panel" style={{ background: "rgba(10, 12, 20, 0.6)", padding: "8px" }}>
            <div className="gbot-mini-panel__title" style={{ marginBottom: "6px" }}>
              <div>
                <span>展示墙 Preview</span>
                <h2 style={{ fontSize: "13px" }}>泡泡展示墙</h2>
              </div>
              <Sparkles size={16} />
            </div>
            <div className="gbot-mini-carousel">
              {BUBBLE_EDITIONS.slice(0, 4).map((edition, index) => (
                <article
                  className={`gbot-showcase-bubble gbot-showcase-bubble--${edition.className}`}
                  key={edition.key}
                  style={{ width: "120px", padding: "8px", flexShrink: 0 }}
                >
                  <b>#{String(index + 88).padStart(4, "0")}</b>
                  <strong style={{ fontSize: "12px", display: "block" }}>{edition.name}</strong>
                  <span style={{ fontSize: "10px" }}>{edition.rarity}</span>
                </article>
              ))}
            </div>
          </div>

          {/* Battle Report Wall */}
          <div className="gbot-mini-panel" style={{ background: "rgba(10, 12, 20, 0.6)", padding: "8px" }}>
            <div className="gbot-mini-panel__title" style={{ marginBottom: "6px" }}>
              <div>
                <span>战报墙</span>
                <h2 style={{ fontSize: "13px" }}>最近战报</h2>
              </div>
              <Trophy size={16} />
            </div>

            {battleReports.length > 0 ? (
              <div className="gbot-report-wall-list" style={{ gap: "6px" }}>
                {battleReports.slice(0, 2).map((report) => (
                  <article key={report.id} style={{ padding: "8px 10px" }}>
                    <div>
                      <strong style={{ fontSize: "13px" }}>{report.title}</strong>
                      <span style={{ fontSize: "10px" }}>{report.status}</span>
                    </div>
                    <em style={{ fontSize: "12px" }}>{report.result}</em>
                  </article>
                ))}
              </div>
            ) : (
              <div className="gbot-mini-empty">
                <Trophy size={20} />
                <strong>暂无战报</strong>
                <p>派遣 Agent 出关后将自动记录并可晒战报。</p>
              </div>
            )}
          </div>

          {/* Guardian Note */}
          <div className="gbot-permission-note">
            <ShieldAlert size={16} />
            <p>Agent 仅处理已授权、被 @ 提及或用户提交的信息；不读取全量历史消息。</p>
          </div>

          <GroupGuardianRulesPreview />

          {/* 4-step permission flow */}
          <div className="gbot-permission-flow">
            <div className="gbot-mini-panel__title">
              <div>
                <span>权限流向</span>
                <h2>4 步开启公会守护</h2>
              </div>
            </div>
            {steps.map((step, index) => (
              <article key={step.id}>
                <b>{index + 1}</b>
                <div>
                  <strong>{step.name}</strong>
                  <span><Key size={12} /> {step.permission}</span>
                  <span><Eye size={12} /> 可见：{step.canSee}</span>
                  <span><XOctagon size={12} /> 不可见：{step.cannotSee}</span>
                </div>
              </article>
            ))}
          </div>

          {/* Weekly Leaderboard */}
          <div className="gbot-leaderboard-panel" style={{ background: "transparent", border: "none", padding: 0 }}>
            <div className="gbot-mini-panel__title">
              <div>
                <span>每周排行</span>
                <h2>Top 3 公会小队</h2>
              </div>
              <Crown size={18} />
            </div>
            <div className="gbot-leaderboard-list">
              {leaderboard.map((team) => (
                <article className={`gbot-leader-row gbot-leader-row--${team.style}`} key={team.rank}>
                  <b>#{team.rank}</b>
                  <span>{team.name}</span>
                  <strong>{team.xp}</strong>
                </article>
              ))}
            </div>
          </div>

          {/* Guild Chest */}
          <div className="gbot-guild-chest">
            <div>
              <span><Gift size={14} /> 公会共享宝箱</span>
              <strong>1500 / 2000 XP</strong>
              <p>声望达标后解锁。完成邀请、战报分享和公会守门配置提高声望。</p>
            </div>
            <i><b style={{ width: "75%" }} /></i>
            <CheckCircle2 size={18} />
          </div>
        </div>
      </CollapsibleCard>
    </main>
  );
};
