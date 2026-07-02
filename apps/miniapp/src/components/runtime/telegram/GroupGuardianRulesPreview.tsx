import React from "react";
import { TelegramGuardianRuleMock } from "./telegramSourceMockTypes";

export const GroupGuardianRulesPreview: React.FC = () => {
  const defaultRules: TelegramGuardianRuleMock[] = [
    {
      id: "rule_1",
      title: "仿冒链接警示",
      description: "当群内出现与白名单特征高度不符、被 Policy Guard 规则库收录的高危钓鱼及欺诈网站链接时，由 Agent 发出自动警告通知。",
      status: "preview",
      requiredPermission: "普通发送权限",
      safetyBoundary: "仅对比域名特征，不做任何主动网页内容或用户签名拦截。"
    },
    {
      id: "rule_2",
      title: "任务发布审批",
      description: "只识别由群主或指定公会管理员发出的任务指令（带有指定发布标签），降低假借官方名义发布诱导链接的风险。",
      status: "preview",
      requiredPermission: "管理员来源过滤",
      safetyBoundary: "仅匹配发送方的 Telegram ID 是否在群管白名单内。"
    },
    {
      id: "rule_3",
      title: "@GBot 提问回答与摘要",
      description: "当用户在群内 @GBot 并追加明确提问（例如：@GBot 检查这笔任务进度）时，自动生成对应摘要与任务线索记录。",
      status: "preview",
      requiredPermission: "提及应答",
      safetyBoundary: "非提及会话直接进入本地垃圾过滤器抛弃，绝不回传服务器后台。"
    },
    {
      id: "rule_4",
      title: "权限安全隔离审计",
      description: "严格遵守数据隔离，不监控私聊会话，不读取全量聊天历史数据。所有外部动作均受本地沙箱审计限制。",
      status: "preview",
      requiredPermission: "事件隔离安全协议",
      safetyBoundary: "物理切断全量消息记录的落盘权限，零普通日志记录。"
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ fontWeight: "bold", fontSize: "12px", color: "var(--text-primary)" }}>
        群守门规则
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {defaultRules.map(rule => (
          <div 
            key={rule.id}
            style={{ 
              padding: "10px", 
              background: "rgba(255,255,255,0.01)", 
              border: "1px solid rgba(255,255,255,0.03)", 
              borderRadius: "8px",
              fontSize: "11px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: "bold", color: "var(--text-primary)" }}>{rule.title}</span>
              <span style={{ fontSize: "10px", color: "#F59E0B", fontWeight: "bold" }}>待启用</span>
            </div>
            <p style={{ margin: "4px 0 6px 0", color: "var(--text-secondary)", lineHeight: "1.4" }}>
              {rule.description}
            </p>
            <div style={{ fontSize: "10px", color: "gray", display: "flex", flexDirection: "column", gap: "2px" }}>
              <div>所需权限: <span style={{ color: "var(--text-primary)" }}>{rule.requiredPermission}</span></div>
              <div>安全边界: <span style={{ color: "var(--text-secondary)" }}>{rule.safetyBoundary}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default GroupGuardianRulesPreview;
