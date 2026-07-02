import React from "react";
import { ShieldAlert, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

export const PermissionBoundaryNotice: React.FC = () => {
  return (
    <div 
      style={{
        padding: "16px",
        borderRadius: "12px",
        background: "rgba(124, 58, 237, 0.05)",
        border: "1px dashed rgba(124, 58, 237, 0.3)",
        fontSize: "12px",
        lineHeight: "1.5",
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }}
    >
      <div style={{ fontWeight: "bold", color: "#A78BFA", display: "flex", alignItems: "center", gap: "6px" }}>
        Telegram 授权与数据安全边界
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {/* Allowed Section */}
        <div>
          <div style={{ fontWeight: "bold", color: "#10B981", marginBottom: "4px" }}><CheckCircle2 size={14} style={{color:'var(--emerald)', verticalAlign:'middle', marginRight:'6px', display:'inline-block'}} />允许的行为</div>
          <ul style={{ margin: 0, paddingLeft: "16px", color: "var(--text-secondary)", fontSize: "11px", display: "flex", flexDirection: "column", gap: "3px" }}>
            <li>解析显式授权的数据源</li>
            <li>处理被 @GBot 提及的消息</li>
            <li>用户自己手动粘贴提交的链接</li>
            <li>响应群管理员配置的公开任务线索</li>
            <li>整理白名单保护的公开可访问公告</li>
          </ul>
        </div>

        {/* Prohibited Section */}
        <div>
          <div style={{ fontWeight: "bold", color: "#EF4444", marginBottom: "4px" }}><XCircle size={14} style={{color:'var(--danger)', verticalAlign:'middle', marginRight:'6px', display:'inline-block'}} />禁止的行为</div>
          <ul style={{ margin: 0, paddingLeft: "16px", color: "var(--text-secondary)", fontSize: "11px", display: "flex", flexDirection: "column", gap: "3px" }}>
            <li>不读取用户的普通聊天历史</li>
            <li>不监控或读取个人私聊</li>
            <li>不向陌生人推送私信或群发广告</li>
            <li>不跨群组进行自动灌水群发</li>
            <li>不使用违规爬虫绕过平台访问限制</li>
            <li>不跳过人工确认直接触发钱包划转</li>
          </ul>
        </div>
      </div>

      <div 
        style={{ 
          borderTop: "1px dashed rgba(124, 58, 237, 0.15)", 
          paddingTop: "8px", 
          marginTop: "4px", 
          fontSize: "11px",
          color: "#F59E0B",
          fontWeight: "bold"
        }}
      >
        <ShieldAlert size={14} style={{color:'var(--amber)', verticalAlign:'middle', marginRight:'6px', display:'inline-block'}} /> 核心风控红线：所有接入的 Telegram 外部事件仅转为待处理的“候选线索”，绝对不能越权直接触发资产动作或进行钱包执行。
      </div>
    </div>
  );
};
