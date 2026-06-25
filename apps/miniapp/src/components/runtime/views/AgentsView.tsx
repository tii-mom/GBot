import { AgentStudioView } from "../../AgentStudioView";
import type { RuntimeState } from "../runtimeTypes";
import { AgentCard, Card, RuntimeBadge } from "..";

export function AgentsView({ state, skillNames, showStudio, setShowStudio }: { state: RuntimeState; skillNames: string[]; showStudio: boolean; setShowStudio: (show: boolean) => void }) {
  return <section><Card title="Agent Center" action={<button onClick={() => setShowStudio(true)}>Open Studio</button>}>{state.agent ? <AgentCard agent={state.agent} skills={skillNames} lastRuntime={state.runs[0]?.id}/> : <p>No agent returned by /me.</p>}</Card><Card title="Overview / Runtime / Skills / History"><p>Overview: {state.agent?.profession || "No profession"}</p><p>Runtime: <RuntimeBadge status={state.activeRun?.status || state.agent?.status} progress={state.activeRun?.progress}/></p><p>Skills: {skillNames.join(", ") || "No skills returned"}</p><p>History: {state.runs.length} WorkRuns</p></Card>{showStudio && <AgentStudioView onClose={() => setShowStudio(false)} t={(k: string, d?: string) => d || k} />}</section>;
}
