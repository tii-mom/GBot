import React from "react";
import { RuntimeState } from "../runtimeTypes";
import { Card } from "../index";
import { RuntimeTab } from "../petAgentTypes";
import { InventoryItem } from "@growthbot/shared";
import { getMockMode } from "../../../apiClient";

interface NestViewProps {
  state: RuntimeState;
  setTab: (tab: RuntimeTab) => void;
}

export const NestView: React.FC<NestViewProps> = ({ state, setTab }) => {
  const { assetBalances, aiCreditBalance, agent, inventory } = state;
  const isDemo = getMockMode();

  const gBalance = assetBalances.find(b => b.asset === "G")?.available.amount || "0";
  const tonBalance = assetBalances.find(b => b.asset === "TON")?.available.amount || "0";
  const creditBalance = aiCreditBalance[0]?.balance.amount || String(agent?.energy || 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>
      <div>
        <h1 style={{ fontSize: "20px", fontWeight: "bold" }}>🏠 巢穴背包 (Nest & Vault)</h1>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
          管理你的 Agent 小金库资产、技能卡库存、模型能量和已连接授权的探索平台。
        </p>
      </div>

      {/* Vault Treasury */}
      <Card title={`Agent 小金库 (Vault)${isDemo ? " [演示数据]" : ""}`}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>可用 G 资产</div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#10B981", marginTop: "4px" }}>
              {gBalance} G
            </div>
          </div>
          <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>TON 余额</div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3B82F6", marginTop: "4px" }}>
              {tonBalance} TON
            </div>
          </div>
          <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>模型能量</div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#F59E0B", marginTop: "4px" }}>
              {creditBalance} Credit
            </div>
          </div>
        </div>
      </Card>

      {/* Bag Items Inventory */}
      <Card title="背包与道具 (Inventory)">
        {inventory && inventory.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {inventory.map((item: InventoryItem, idx) => (
              <div 
                key={idx} 
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  fontSize: "12px"
                }}
              >
                <div style={{ fontWeight: "bold" }}>{item.name || "未命名道具"}</div>
                <div style={{ fontSize: "10px", color: "gray", marginTop: "2px" }}>类型: {item.type}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "16px", textAlign: "center", color: "var(--text-secondary)", fontSize: "13px" }}>
            🎒 背包空空如也，快去集市购买箱子吧。
          </div>
        )}
      </Card>

      {/* Connected Playgrounds */}
      <Card title="已授权的游乐园 (Connected Playgrounds)">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          
          {/* Telegram Plaza */}
          <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
              <span style={{ fontWeight: "bold" }}>🔌 Telegram Plaza</span>
              <span style={{ color: "#10B981", fontWeight: "bold" }}>Preview / Awaiting authorization</span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.4" }}>
              数据边界：仅处理授权、公开、用户提交或 @ 提及内容
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "10px", color: "var(--text-secondary)", marginTop: "8px", borderTop: "1px dashed rgba(255,255,255,0.05)", paddingTop: "6px" }}>
              <div>已授权来源: <span style={{ color: "var(--text-primary)" }}>3 个 (Mock)</span></div>
              <div>待确认线索: <span style={{ color: "var(--text-primary)" }}>3 个 (Mock)</span></div>
              <div>已过滤风险: <span style={{ color: "var(--text-primary)" }}>1 次 (Mock)</span></div>
              <div>预估模型能量: <span style={{ color: "var(--text-primary)" }}>30 Credits</span></div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
              <button 
                onClick={() => setTab("Explore")}
                style={{ 
                  fontSize: "10px", 
                  background: "rgba(124, 58, 237, 0.15)", 
                  border: "1px solid rgba(124, 58, 237, 0.2)", 
                  color: "#A78BFA", 
                  padding: "4px 10px", 
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                管理 Telegram 来源 · Preview
              </button>
            </div>
          </div>

          {/* X Radar */}
          <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
              <span style={{ color: "gray", fontWeight: "bold" }}>🐦 X Radar</span>
              <span style={{ color: "gray" }}>Later</span>
            </div>
            <div style={{ fontSize: "11px", color: "gray", marginTop: "4px", lineHeight: "1.4" }}>
              数据边界：仅通过官方 API / OAuth / 公开可用数据接入，不进行自动转评赞关注等投流行为
            </div>
          </div>

          {/* Web Scout */}
          <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
              <span style={{ color: "gray", fontWeight: "bold" }}>🌐 Web Scout</span>
              <span style={{ color: "gray" }}>Later</span>
            </div>
            <div style={{ fontSize: "11px", color: "gray", marginTop: "4px", lineHeight: "1.4" }}>
              数据边界：不做违规爬虫，不绕过访问限制，保障网络合规
            </div>
          </div>

          {/* TON Map */}
          <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
              <span style={{ color: "gray", fontWeight: "bold" }}>🗺️ TON Map</span>
              <span style={{ color: "gray" }}>Later</span>
            </div>
            <div style={{ fontSize: "11px", color: "gray", marginTop: "4px", lineHeight: "1.4" }}>
              数据边界：链上数据读取优先，任何交易 intent 均受 Policy Guard 执行与审计
            </div>
          </div>

        </div>
      </Card>

      {/* Marketplace & Store entry buttons */}
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          style={{
            flex: 1,
            padding: "12px",
            background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",
            color: "white",
            border: "none",
            borderRadius: "12px",
            fontWeight: "bold",
            fontSize: "13px",
            cursor: "pointer"
          }}
        >
          🛒 进入技能卡商城
        </button>
        <button
          style={{
            flex: 1,
            padding: "12px",
            backgroundColor: "rgba(255,255,255,0.05)",
            color: "var(--text-primary)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            fontWeight: "bold",
            fontSize: "13px",
            cursor: "pointer"
          }}
        >
          🏦 交易集市 P2P
        </button>
      </div>
    </div>
  );
};
