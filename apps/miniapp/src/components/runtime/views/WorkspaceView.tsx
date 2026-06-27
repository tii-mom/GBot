import type { WorkRun } from "@growthbot/shared";
import { Card, EmptyState, PrimaryAction, SectionHeader, StatCard, StatusExplainer, WorkspaceMetricRow } from "..";
import type { RuntimeState, Tab, WorkspacePrimaryAction, WorkspaceStats } from "../runtimeTypes";
import { getWorkspacePrimaryAction, stateEmptyCopy, statusLabel } from "../runtimeUtils";

function getLatestVerification(run: WorkRun | null) {
  if (!run) return null;
  return run.status === "verifying" || run.status === "waiting_signature" || run.status === "waiting_user" ? run : null;
}

function getWorkspaceCopy(action: WorkspacePrimaryAction) {
  switch (action.kind) {
    case "claim":
      return "没有 Agent 时先激活 Agent，完成绑定后才能开始运行任务。";
    case "energy":
      return "能量为空时先补能或进入资产中心处理恢复项。";
    case "plan":
      return "Agent 已生成计划，先看清楚再确认执行。";
    case "verify":
      return "当前任务进入验收流程，可以查看进度和结果。";
    case "report":
      return "最近有已完成的 Work Report，可以回看或分享。";
    case "retry":
      return "最近有失败的任务，先查看失败原因再重试。";
    default:
      return "从今日任务开始，让 Agent 推进一个完整工作流。";
  }
}

function settlementLabel(run: WorkRun | null) {
  if (!run) return stateEmptyCopy.noSettlement;
  return run.settled ? "已结算" : statusLabel(run.status);
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

  return (
    <section className="runtime-grid runtime-grid--workspace">
      <SectionHeader
        eyebrow="Real Asset Agent Dashboard"
        title="Agent 工作台"
        description="围绕 G、TON Gas、AI Credits、隔离 Agent Wallet 与 Skill Cards 展示 Agent 如何在用户策略限制内追踪机会任务、购买 AI capacity 并生成证据。"
        action={<PrimaryAction label={action.label} hint={action.hint} onClick={() => onPrimaryAction(action.kind)} />}
      />

      <StatCard label="G balance" value={workspaceStats.gBalance} hint="Agent 可用 G 资产；不承诺固定兑换或回报" />
      <StatCard label="TON gas" value={workspaceStats.tonBalance} hint="网络 Gas 余额，Agent Wallet 与主钱包隔离" />
      <StatCard label="AI Credits" value={workspaceStats.aiCreditBalance} hint="WorkRun 消耗的 AI capacity 预算" />
      <StatCard label="Skill Card power" value={workspaceStats.skillCardPower} hint="31-card capability catalog: 12 Normal / 12 Advanced / 7 Expert" />

      <Card title="我的 Agent 状态">
        {state.agent ? (
          <>
            <StatusExplainer title={state.agent.name} description={getWorkspaceCopy(action)} status={statusLabel(state.activeRun?.status || state.agent.status)} />
            <WorkspaceMetricRow label="状态" value={statusLabel(state.activeRun?.status || state.agent.status)} hint="状态 key 仅作辅助标签" />
            <WorkspaceMetricRow label="等级" value={state.agent.level} />
            <WorkspaceMetricRow label="Agent Wallet" value={state.agentWallet?.status || "simulated"} hint="Agent 不控制主钱包；当前 scaffold 默认 simulation-only" />
            <WorkspaceMetricRow label="Auto Purchase" value={workspaceStats.autoPurchaseEnabled ? "Enabled by policy" : "Paused / disabled"} hint="受预算、allowlist、Policy Guard 和 audit log 限制" />
            <WorkspaceMetricRow label="Skill Cards" value={`${state.realAssetAgent?.skillCardSummary.totalCanonicalCards || 31} canonical cards`} hint="12 Normal / 12 Advanced / 7 Expert" />
            <WorkspaceMetricRow label="最近验收" value={latestVerification ? statusLabel(latestVerification.status) : "暂无验收进度"} />
            <WorkspaceMetricRow label="最近证据报告" value={settlementLabel(latestSettlement)} hint="Work Report 引用 policy、purchase intent、AI Credit usage 与 skill card evidence" />
          </>
        ) : (
          <EmptyState
            title="未激活 Agent"
            description={stateEmptyCopy.noAgent}
            action={<PrimaryAction label="激活 Agent" hint="先完成绑定再开始任务" onClick={() => onPrimaryAction("claim")} />}
          />
        )}
      </Card>

      <Card title="近期进度">
        <ul className="runtime-summary-list">
          <li>最近 Work Report: {latestRun ? latestRun.taskId : stateEmptyCopy.noReport}</li>
          <li>最近 Verification: {latestVerification ? statusLabel(latestVerification.status) : stateEmptyCopy.noVerification}</li>
          <li>最近 Settlement: {settlementLabel(latestSettlement)}</li>
          <li>当前运行中任务: {state.activeRun ? state.activeRun.taskId : stateEmptyCopy.noWorkRun}</li>
        </ul>
      </Card>

      <Card title="主路径">
        <div className="action-list">
          <PrimaryAction label="查看今日可运行任务" hint="进入任务执行中心" onClick={() => setTab("Tasks")} />
          <PrimaryAction label="查看战报" hint="回看最近完成的 Work Report" onClick={() => setTab("Reports")} />
          <PrimaryAction label="进入 Agent Center" hint="查看技能与历史" onClick={() => setTab("Agents")} />
        </div>
      </Card>
    </section>
  );
}
