import type { RuntimeState, WorkspaceStats } from "../runtimeTypes";
import { Card, SectionHeader, WorkspaceMetricRow } from "..";

function amount(value?: { amount: string } | null) {
  return value?.amount || "0";
}

export function NetworkView({ state, workspaceStats }: { state: RuntimeState; workspaceStats: WorkspaceStats }) {
  const policy = state.walletPolicy || state.agentWallet?.policy || null;
  const wallet = state.agentWallet;
  const simulationOnly = wallet?.walletType === "testnet_simulated" || wallet?.network?.includes("simulated") || !wallet?.address;

  return (
    <section className="runtime-stack">
      <SectionHeader
        eyebrow="Agent Wallet / Policy"
        title="隔离 Agent Wallet"
        description="Agent Wallet 与用户主钱包分离。Mini App 只展示策略、预算、allowlist 和 audit evidence；当前 scaffold 不执行真实链上交易。Network 数据暂未连接时仍展示战队 / 邀请 / 资产 / 市场的策略边界。"
      />

      <Card title="Wallet Separation">
        <WorkspaceMetricRow label="Agent Wallet" value={wallet?.label || "Isolated Agent Wallet · simulated"} hint="Agent 不控制主钱包；用户主钱包始终由用户自己掌控" />
        <WorkspaceMetricRow label="Network" value={wallet?.network || "testnet_simulated"} hint={simulationOnly ? "Simulation-only：除非后端明确返回 live 状态，否则不执行真实链上操作" : "Backend reported wallet network"} />
        <WorkspaceMetricRow label="Address" value={wallet?.address || "No live address stored"} hint="不保存 seed phrase 或主钱包私钥" />
        <WorkspaceMetricRow label="Status" value={wallet?.status || "pending_setup"} />
      </Card>

      <Card title="Auto Purchase Policy">
        <WorkspaceMetricRow label="autoPurchaseEnabled" value={policy?.autoPurchaseEnabled ? "enabled" : "disabled"} hint="仅允许在用户策略、预算和 allowlists 内创建 purchase intent" />
        <WorkspaceMetricRow label="perTransactionLimit" value={`${amount(policy?.perTransactionLimit)} ${policy?.perTransactionLimit?.symbol || "G"}`} />
        <WorkspaceMetricRow label="dailyLimit" value={`${amount(policy?.dailyLimit)} ${policy?.dailyLimit?.symbol || "G"}`} />
        <WorkspaceMetricRow label="minimumReserve" value={`${amount(policy?.minimumReserve)} ${policy?.minimumReserve?.symbol || "TON"}`} />
        <WorkspaceMetricRow label="riskMode" value={policy?.riskMode || "conservative"} hint="Policy Guard 会拒绝超出预算、资产、合约或服务商限制的 intent" />
      </Card>

      <Card title="Allowlists">
        <WorkspaceMetricRow label="allowedAssets" value={(policy?.allowedAssets || ["G", "TON", "AI_CREDIT"]).join(", ")} />
        <WorkspaceMetricRow label="allowedProviders" value={(policy?.allowedProviders || ["mock-ai-provider"]).join(", ")} />
        <WorkspaceMetricRow label="allowedContracts" value={(policy?.allowedContracts || ["simulated-ai-credit-vault"]).join(", ")} />
      </Card>

      <Card title="Real Asset Snapshot">
        <WorkspaceMetricRow label="G" value={workspaceStats.gBalance} hint="用于 future Skill Card / AI capacity budgeting" />
        <WorkspaceMetricRow label="TON gas" value={workspaceStats.tonBalance} hint="TON 是网络 gas 资产" />
        <WorkspaceMetricRow label="AI Credits" value={workspaceStats.aiCreditBalance} hint="Agent 执行 WorkRun 时消耗的 AI capacity" />
      </Card>
    </section>
  );
}
