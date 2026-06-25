# Research Brief Compatibility Flow

Status: final for PR #16 fix pass.

## Current path
1. User opens Tasks.
2. User enters Research Brief topic and context.
3. User selects a Research-compatible available task when present; otherwise the available task list remains selectable.
4. Frontend calls `apiClient.createWorkRun(taskId, { input: { type: "research_brief", topic, context } })`.
5. Backend creates a WorkRun through the existing task runtime path.
6. Frontend opens Reports with a canonical `?tab=Reports&runId=<id>` URL.
7. Reports loads WorkRun, WorkRun steps, and WorkReport detail when available.

## Payload handling
The topic and context are not discarded. They are sent as input on the WorkRun creation request body. This preserves compatibility with existing `createWorkRun(taskId, idempotencyKey?)` callers while allowing Runtime V1 Research Brief input.

## Explicit non-goal
Standalone Research Brief CRUD / GET / LIST endpoints are not present in this branch. The UI copy states that it creates a WorkRun from a Research Brief compatibility path until those endpoints exist.

## Local runtime verifier API base

`npm run verify:research-brief-runtime` is an integration verifier for a locally running API worker. It intentionally requires an explicit local API base so that a missing API server is not mistaken for a frontend or runtime code regression.

Before running it, start the API worker in test mode and point the verifier at that local server:

```bash
cd apps/api-worker
npx wrangler dev --port 8787 --var APP_ENV:test --var ENABLE_TEST_ENDPOINTS:true --var TEST_ENDPOINT_TOKEN:ci_test_secret
```

In a second shell, run:

```bash
RESEARCH_BRIEF_API_BASE=http://127.0.0.1:8787 TEST_ENDPOINT_TOKEN=ci_test_secret npm run verify:research-brief-runtime
```

`VITE_API_BASE=http://127.0.0.1:8787` can also be used when `RESEARCH_BRIEF_API_BASE` is not set. The accepted base must be `http://127.0.0.1:<port>` or `http://localhost:<port>`; non-local or empty values are rejected by design. CI should not run this verifier unless the workflow also provisions a reliable local worker and test database for it.
