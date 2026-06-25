# Runtime Contract Lock

Status: final for PR #16 fix pass.

## Locked Runtime V1 assumptions
- WorkRun is the unit of runtime execution.
- WorkRun status drives progress display and action eligibility.
- Available runtime tasks are fetched through getTasks.
- Agent skills are fetched through getAgentSkills.
- WorkRun history is fetched through getWorkRuns.
- Active runtime work is fetched through getActiveWorkRun.
- Report detail resolves through getWorkRun, getWorkRunSteps, and getWorkReport.
- Runtime transitions use approveStep, pauseWorkRun, resumeWorkRun, cancelWorkRun, and retryStep.

## createWorkRun compatibility
`createWorkRun(taskId, idempotencyKey?)` remains valid. The client also accepts an options object with `idempotencyKey` and `input` so Research Brief topic/context can be sent without inventing a standalone Research Brief API.

## Known missing APIs
- Research Brief standalone CRUD / GET / LIST.
- Batch Settlement Query.
- API Health endpoint.
