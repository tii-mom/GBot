import React from "react";
import { RuntimeState } from "../runtimeTypes";
import { Card } from "../index";

interface GuildViewProps {
  state: RuntimeState;
}

export const GuildView: React.FC<GuildViewProps> = ({ state }) => {
  const { user } = state;

  // Step by step preview flow
  const steps = [
    {
      id: "step_1",
      name: "1. 邀请 Agent 进入公会群 (Preview)",
      permission: "群组成员 / 选填管理员",
      canSee: "被 @ 提及的消息、群内公开任务链接",
      cannotSee: "群聊中全部普通历史对话，不获取用户隐私"
    },
    {
      id: "step_2",
      name: "2. 配置群守门规则 (Preview)",
      permission: "群管理写入规则",
      canSee: "发出的高风险欺诈或仿冒链接、垃圾签名",
      cannotSee: "群成员之间的正常日常闲聊"
    },
    {
      id: "step_3",
      name: "3. 开启 @ 提及分析 (Preview)",
      permission: "允许 Bot 响应提及",
      canSee: "针对 @GBot 唤起的提问和指令请求",
      cannotSee: "无提及的普通群内数据交流"
    },
    {
      id: "step_4",
      name: "4. 分享战报卡片 (Preview)",
      permission: "主页授权分享",
      canSee: "用户主动触发的 Work Report 摘要图片",
      cannotSee: "用户的隔离钱包私密预算和划转记录"
    },
    {
      id: "step_5",
      name: "5. 开启群投票任务 (Preview)",
      permission: "允许群民意投票",
      canSee: "投票表决的选项统计结果",
      cannotSee: "选民具体的私钥及身份证明凭证"
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>
      <div>
        <h1 style={{ fontSize: "20px", fontWeight: "bold" }}>🛡️ 公会战队 (Guild & Squad)</h1>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
          邀请好友激活幼体 Agent、建立小队参与公会任务，分享战报并累积声望。
        </p>
      </div>

      {/* Invite and Activate Larva Card */}
      <Card title="邀请好友激活幼体 Agent">
        <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>
            分享你的专属孵化密钥。好友激活 Agent 幼体时，双方都将获得训练道具。
          </p>
          <div 
            style={{ 
              padding: "10px", 
              borderRadius: "8px", 
              background: "rgba(0,0,0,0.2)", 
              border: "1px solid rgba(255,255,255,0.05)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <span style={{ fontSize: "11px", color: "#A78BFA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
              https://t.me/GrowthBot?start={user?.id || "guest"}
            </span>
            <button 
              style={{ 
                fontSize: "10px", 
                backgroundColor: "#7C3AED", 
                color: "white", 
                border: "none", 
                padding: "4px 8px", 
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              复制
            </button>
          </div>
        </div>
      </Card>

      {/* Telegram Guild Agent Area */}
      <Card title="Telegram Guild Agent • 前端预览">
        <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
          
          <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(124, 58, 237, 0.04)", border: "1px dashed rgba(124, 58, 237, 0.15)", fontSize: "11px", lineHeight: "1.4" }}>
            📢 <strong>数据访问原则：</strong> Agent 只能处理被授权、被 @ 提及、用户提交或 bot 可访问的信息。不会读取全部历史消息，保障群聊私密安全。
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {steps.map(s => (
              <div 
                key={s.id}
                style={{ 
                  padding: "10px", 
                  background: "rgba(255,255,255,0.02)", 
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.04)"
                }}
              >
                <div style={{ fontWeight: "bold", color: "var(--text-primary)", fontSize: "12px" }}>{s.name}</div>
                <div style={{ fontSize: "10px", color: "gray", marginTop: "4px" }}>
                  <div>🔑 所需权限: <span style={{ color: "#F59E0B" }}>{s.permission}</span></div>
                  <div style={{ marginTop: "2px" }}>👁️ Agent 可以看到: <span style={{ color: "var(--text-secondary)" }}>{s.canSee}</span></div>
                  <div style={{ marginTop: "2px" }}>❌ Agent 无法看到: <span style={{ color: "var(--text-secondary)" }}>{s.cannotSee}</span></div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-secondary)" }}>
            <span>群内战报投票 (Awaiting setup)</span>
            <span>公会战队声望: 1500 XP (演示数据)</span>
          </div>
        </div>
      </Card>

      {/* Leaderboard Placeholders */}
      <Card title="每周战力与声望排行榜">
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}>
            <span>#1 灵巧金牛座战队</span>
            <span>4200 XP</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}>
            <span>#2 自动化双子小队</span>
            <span>3900 XP</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}>
            <span>#3 守护巨蟹座战队</span>
            <span>3450 XP</span>
          </div>
        </div>
      </Card>

      {/* Guild Chest Placeholder */}
      <Card title="公会共享宝箱 (Shared Loot Chest)">
        <div style={{ padding: "8px 0", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div>公会每周共享宝箱</div>
            <div style={{ fontSize: "10px", color: "gray", marginTop: "2px" }}>声望达到 2000 XP 自动解锁。</div>
          </div>
          <span style={{ fontSize: "20px" }}>🔒🎁</span>
        </div>
      </Card>
    </div>
  );
};
