# Frontend Runtime Gap Matrix

Status: final for PR #16 fix pass.

| Area | Current Runtime V1 behavior | Remaining gap | Severity |
| --- | --- | --- | --- |
| Official entry | `main.tsx` is Runtime V1 entry with Workspace / Agents / Tasks / Reports / Network | None for P0 | P0 closed |
| Research Brief input | Topic/context sent in createWorkRun input body | Standalone Research Brief CRUD/list missing | P1 |
| Report sharing | Reports persist canonical `?tab=Reports&runId=<id>` URL and hydrate on startup | Deep route style can be improved later | P2 |
| Runtime actions | Buttons gated by WorkRun status and step approval/failure signals | More granular backend transition metadata would reduce frontend heuristics | P1 |
| Settlement | WorkRun/report-derived settlement display | Batch Settlement Query missing | P1 |
| Health status | EnvironmentBadge derives API status from bootstrap behavior | API Health endpoint missing | P2 |
| Legacy V0 surfaces | Not primary Runtime V1 navigation | Legacy code remains outside V1 entry | P2 |
