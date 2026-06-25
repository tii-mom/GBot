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
