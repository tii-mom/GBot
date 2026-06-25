# Frontend API Usage V2

## Current used APIs
- `loginOrRegister`
- `getMe`
- `getInventory`
- `getTasks`
- `getAgentSkills`
- `getWorkRuns`
- `getActiveWorkRun`
- `getWorkRun`
- `getWorkRunSteps`
- `getWorkReport`
- `createWorkRun`
- `approveStep`
- `pauseWorkRun`
- `resumeWorkRun`
- `cancelWorkRun`
- `retryStep`

## Runtime V1 required APIs
- Agent bootstrap via `/me` or telegram login flow.
- Task listing for today’s runnable tasks.
- WorkRun list, active WorkRun, WorkRun detail, WorkRun steps, WorkReport detail.
- State transition actions for confirmation, pause, resume, cancel, retry.
- Agent skills and inventory for workbench and secondary module surfaces.

## Not currently used by the Runtime V1 entry
- Marketplace listing APIs.
- Box opening APIs.
- Store APIs.
- Leaderboard APIs.
- Group pool join APIs.
- V0 farm execution APIs.

## Legacy or compatibility APIs
- `getFomoSnapshot`
- `runFarm`
- V0 mission-oriented client flows
- legacy store / market / crew flows

## Missing APIs
- Research Brief standalone CRUD / GET / LIST.
- Batch Settlement Query.
- API Health endpoint.

## Priority
| Priority | Item | Reason |
| --- | --- | --- |
| P0 | Current Runtime V1 used APIs | Required for the product entry |
| P0 | Work Report / WorkRun / task runtime APIs | Core user journey |
| P1 | Research Brief standalone CRUD / GET / LIST | Current compatibility path works, but dedicated data model is missing |
| P1 | Batch Settlement Query | Would improve aggregation and totals |
| P1 | API Health endpoint | Would improve environment / API badge accuracy |
| P2 | Legacy marketplace and growth surfaces in Runtime entry | Useful only as secondary surfaces |

## Compatibility note
- Research Brief creation continues to use `createWorkRun` with an input body.
- This is a compatibility path, not a claim that a standalone Research Brief storage model exists.
- Missing data must render as productized empty states rather than fake success data.
