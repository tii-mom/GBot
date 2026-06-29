// Legacy runtime dashboard view. Not part of Pet Agent V1 primary navigation.
import React from "react";
import type { RuntimeState, WorkspaceStats } from "../runtimeTypes";
import { Card, WorkspaceMetricRow } from "..";

export function NetworkView({
  state,
  workspaceStats
}: {
  state: RuntimeState;
  workspaceStats: WorkspaceStats;
}) {
  const policy = state.walletPolicy || state.agentWallet?.policy || null;
  const wallet = state.agentWallet;

  // Telegram referral link helper
  const referralCode = state.user?.id || "scout_member";
  const referralLink = `https://t.me/GrowthBot?start=${referralCode}`;

  const copyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      alert("Referral link copied to clipboard.");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <section className="runtime-stack animate-fade-in" style={{ paddingBottom: "24px" }}>
      <div style={{ padding: "0 16px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "16px 0 4px" }}>Agent Network Growth</h2>
        <p style={{ fontSize: "12px", color: "var(--gb-text-muted)", lineHeight: 1.4 }}>
          Expand the Agent Network by sharing verified Proof of Work reports. Track invitations and contribution scores.
        </p>
      </div>

      {/* Network Referral Invite Card */}
      <div className="gb-glass-card">
        <div className="gb-glass-card-header">
          <h3>
            <svg style={{ width: "16px", height: "16px", fill: "var(--gb-cyan-cyber)" }} viewBox="0 0 24 24">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
            Invite New Agents
          </h3>
        </div>
        <div style={{ fontSize: "12px", color: "var(--gb-text-soft)", display: "flex", flexDirection: "column", gap: "10px" }}>
          <p>
            Share your unique invitation link to invite developers, scouts, or operators. When they activate their Agent Wallet, they join your Network Growth branch.
          </p>
          <div
            style={{
              padding: "10px",
              background: "rgba(0, 0, 0, 0.2)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "8px",
              fontFamily: "monospace",
              wordBreak: "break-all",
              color: "var(--gb-cyan-cyber)"
            }}
          >
            {referralLink}
          </div>
          <button className="gb-cta-button" onClick={copyReferral}>
            <span>Copy Invitation Link</span>
            <small>Share to Telegram, Twitter, or Discord</small>
          </button>
        </div>
      </div>

      {/* Network Stats / Contributions */}
      <div className="gb-glass-card">
        <div className="gb-glass-card-header">
          <h3>Network Contribution</h3>
        </div>
        <WorkspaceMetricRow
          label="Shared Reports Count"
          value={state.runs.filter(r => state.reportCache[r.id]?.share?.allowed).length}
          hint="Verified proofs published to the network"
        />
        <WorkspaceMetricRow
          label="Invited Operators"
          value="0"
          hint="Graceful empty state - no active referrals detected"
        />
        <WorkspaceMetricRow
          label="Contribution Score"
          value="0 Tier"
          hint="Calculated based on verified evidence tasks"
        />
      </div>

      {/* Security & Isolation Policies Sub-Card */}
      <div className="gb-glass-card">
        <div className="gb-glass-card-header">
          <h3>Technical Security Policy</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <WorkspaceMetricRow
            label="Agent Wallet Separation"
            value={wallet?.address ? "Isolated Active Address" : "Simulation Bound"}
          />
          <WorkspaceMetricRow
            label="Risk Evaluation Mode"
            value={policy?.riskMode || "conservative"}
            hint="Policy Guard rejects unauthorized contract intents"
          />
        </div>
      </div>
    </section>
  );
}

// Compatibility: Network 数据暂未连接, 战队 / 邀请 / 资产 / 市场

