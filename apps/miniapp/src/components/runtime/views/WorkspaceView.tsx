import React from "react";
import type { WorkRun } from "@growthbot/shared";
import { AgentHeroCard } from "../AgentHeroCard";
import { AssetBalanceStrip } from "../AssetBalanceStrip";
import { AgentWalletCard } from "../AgentWalletCard";
import { SkillCardDeck } from "../SkillCardDeck";
import type { RuntimeState, Tab, WorkspacePrimaryAction, WorkspaceStats } from "../runtimeTypes";
import { getWorkspacePrimaryAction } from "../runtimeUtils";

function getLatestVerification(run: WorkRun | null) {
  if (!run) return null;
  return ["verifying", "waiting_signature", "submitting"].includes(run.status) ? run : null;
}

export function WorkspaceView({
  state,
  workspaceStats,
  setTab,
  onPrimaryAction
}: {
  state: RuntimeState;
  workspaceStats: WorkspaceStats;
  setTab: (tab: Tab) => void;
  onPrimaryAction: (kind: WorkspacePrimaryAction["kind"]) => void;
}) {
  const action = getWorkspacePrimaryAction(workspaceStats, !!state.agent, state.activeRun, state.runs);
  const latestRun = state.runs[0] || null;
  const latestVerification = getLatestVerification(state.activeRun || latestRun);
  const latestSettlement = state.runs.find((run) => run.settled) || null;

  // Map primary CTA action to view redirects or API calls
  const handleCtaClick = () => {
    if (action.kind === "plan") {
      setTab("Run");
    } else if (action.kind === "tasks" || action.kind === "retry") {
      setTab("Tasks");
    } else if (action.kind === "report") {
      setTab("Reports");
    } else if (action.kind === "verify") {
      setTab("Run");
    } else {
      onPrimaryAction(action.kind);
    }
  };

  // Map skill cards
  const equippedSkills = state.skills.map((s: any) => s.skillName || s.name || s.id);

  return (
    <section className="runtime-stack animate-fade-in" style={{ paddingBottom: "24px" }}>
      {/* Agent Hologram HUD Card */}
      <AgentHeroCard
        agentExists={!!state.agent}
        agentName={state.agent?.name}
        agentLevel={state.agent?.level}
        agentStatus={state.agent?.status}
        activeRunStatus={state.activeRun?.status}
        onCtaClick={handleCtaClick}
        ctaText={action.label}
        ctaHint={action.hint}
      />

      {/* Asset Balances (G, TON, AI Credits) */}
      <AssetBalanceStrip
        gBalance={`${workspaceStats.gBalance} G`}
        tonBalance={`${workspaceStats.tonBalance} TON`}
        aiCredits={`${workspaceStats.aiCreditBalance} Credits`}
        pendingPoints={state.agent?.pendingPoints || state.user?.pendingPoints || undefined}
      />

      {/* Agent Wallet Safeguards Card */}
      <AgentWalletCard
        status={state.agentWallet?.status || "Simulation only"}
        autoPurchase={workspaceStats.autoPurchaseEnabled}
        address={state.agentWallet?.address || "Not provisioned"}
        dailyLimit={state.walletPolicy?.dailyLimit?.amount ? `${state.walletPolicy.dailyLimit.amount} ${state.walletPolicy.dailyLimit.symbol}` : "Policy unavailable"}
      />

      {/* 31 Canonical Skill Card Deck */}
      <SkillCardDeck
        totalCanonical={31}
        normalCount={12}
        advancedCount={12}
        expertCount={7}
        equippedNames={equippedSkills}
      />

      {/* Latest Work Activity */}
      <div className="gb-glass-card">
        <div className="gb-glass-card-header">
          <h3>
            <svg style={{ width: "16px", height: "16px", fill: "var(--gb-emerald-glow)" }} viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            Recent Proof Activity
          </h3>
        </div>
        <div style={{ fontSize: "12px", color: "var(--gb-text-soft)", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--gb-text-muted)" }}>Last Work Report:</span>
            <span>{latestRun ? `Task ${latestRun.taskId.slice(0, 10)}...` : "No execution history"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--gb-text-muted)" }}>Last Verification:</span>
            <span>{latestVerification ? `Status: ${latestVerification.status}` : "No verification pending"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--gb-text-muted)" }}>Last Settlement:</span>
            <span style={{ color: latestSettlement ? "var(--gb-emerald-glow)" : "var(--gb-text-muted)" }}>
              {latestSettlement ? "Settled & Disbursed" : "Awaiting completion"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
