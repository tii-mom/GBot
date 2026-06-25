import type { RuntimeState, WorkspaceStats } from "../runtimeTypes";
import { Card } from "..";
import { classifyAsset } from "../runtimeUtils";

export function NetworkView({ state, workspaceStats }: { state: RuntimeState; workspaceStats: WorkspaceStats }) {
  return <section><Card title="Team / Contribution / Progress / Members / Rewards"><p>Team: {state.user?.username || "Current Telegram user"}</p><p>Contribution: {workspaceStats.gpEarned} GP</p><p>Progress: {workspaceStats.verifiedReports} verified reports</p><p>Members: Telegram group binding is available in Network Settings when backend pool data is connected.</p><p>Rewards: {state.inventory.filter((item) => classifyAsset(item) === "Rewards").length} reward assets</p></Card><Card title="Network Settings / Assets">{["Skills", "Boxes", "Tickets", "Rewards", "Assets"].map((group) => <p key={group}>{group}: {state.inventory.filter((item) => classifyAsset(item) === group).length}</p>)}</Card></section>;
}
