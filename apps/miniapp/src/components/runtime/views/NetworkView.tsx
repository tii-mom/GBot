import type { RuntimeState, WorkspaceStats } from "../runtimeTypes";
import { Card, EmptyState, SectionHeader, WorkspaceMetricRow } from "..";
import { classifyAsset, stateEmptyCopy } from "../runtimeUtils";

export function NetworkView({ state, workspaceStats }: { state: RuntimeState; workspaceStats: WorkspaceStats }) {
  const assets = ["Skills", "Boxes", "Tickets", "Rewards", "Assets"].map((group) => ({
    group,
    count: state.inventory.filter((item) => classifyAsset(item) === group).length
  }));

  return (
    <section className="runtime-stack">
      <SectionHeader
        eyebrow="Network"
        title="战队 / 邀请 / 资产 / 市场"
        description="Network 负责团队、贡献和增长入口；市场和资产作为二级模块保留。"
      />

      <Card title="团队概览">
        <WorkspaceMetricRow label="Team" value="未连接" hint={stateEmptyCopy.noNetwork} />
        <WorkspaceMetricRow label="Contribution" value={`${workspaceStats.pendingPoints} 积分`} hint="用户侧贡献以待结算积分体现" />
        <WorkspaceMetricRow label="Progress" value={`${workspaceStats.completedRuns} completed`} />
        <WorkspaceMetricRow label="Members" value="未知" hint="Telegram Group ID 绑定保留到 Network Settings" />
        <WorkspaceMetricRow label="Rewards" value={state.inventory.length} hint="资产与奖励挂载在 Network 二级模块" />
      </Card>

      <Card title="Network 设置">
        <EmptyState title="Network 数据暂未连接" description={stateEmptyCopy.noNetwork} />
      </Card>

      <Card title="资产">
        {assets.map((item) => <WorkspaceMetricRow key={item.group} label={item.group} value={item.count} />)}
      </Card>
    </section>
  );
}
