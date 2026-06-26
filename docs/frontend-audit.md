# Frontend Runtime V1 Audit (Legacy / Superseded)

> Status: legacy. Replaced by [GBot Canonical V1](./GBOT_CANONICAL_V1.md) and the real-asset frontend docs.

This document is preserved for historical reference only.

Status: final for PR #16 fix pass. This audit describes the current code, not a future plan.

## Current routes / tabs
The Mini App entry remains `apps/miniapp/index.html` loading `apps/miniapp/src/main.tsx`. `main.tsx` owns the Runtime V1 tabs: Workspace, Agents, Tasks, Reports, and Network.

## Current pages
- Workspace: shows active agent count, running tasks, verified report count, settlements, GP earned, Recent Activity, and Quick Actions.
- Agents: shows Agent Center, Overview, Runtime, Skills, and History using the current agent, skills, and WorkRun history.
- Tasks: shows Research Brief WorkRun creation, available task list, WorkRun progress, and state-gated runtime actions.
- Reports: shows WorkRun report cards and Work Report detail sections for Input, Execution, Evidence, Verification, and Settlement.
- Network: shows Team, Contribution, Progress, Members, Rewards, and Network Settings / Assets as the V1 replacement for Crew as a primary tab.

## Current components
Runtime pages use shared components from `apps/miniapp/src/components/runtime`: Card, StatCard, RuntimeBadge, StatusBadge, ProgressCard, ReportCard, AgentCard, RuntimeTimeline, TaskLine, and EnvironmentBadge.

## Current state management
Runtime state is local React state in `main.tsx`. Bootstrap loads the current user/agent, tasks, inventory, skills, WorkRuns, and active WorkRun from API responses. Derived counts are computed from those responses. No Runtime V1-only mock dataset is introduced.

## Current API calls
Used by Runtime V1: loginOrRegister, getMe, getInventory, getTasks, getAgentSkills, getWorkRuns, getActiveWorkRun, getWorkRun, getWorkRunSteps, getWorkReport, createWorkRun, approveStep, pauseWorkRun, resumeWorkRun, cancelWorkRun, retryStep.

## Backend capability mapping
- WorkRun contract exists on main and is the runtime unit used by the Mini App.
- WorkRun step/event APIs exist and are consumed by report detail and action gating.
- Task availability exists through getTasks and is treated as V1 available runtime task input, not V0 Mission primary IA.
- WorkReport detail is expected at `/work-runs/:runId/report`; the client method is wired and tolerates absence by rendering WorkRun/step-derived detail.

## Frontend used / unused API mapping
Used APIs are listed above. Unused by the Runtime V1 entry: marketplace listing APIs, FOMO snapshot, box opening, store, leaderboard, and V0 farm execution.

## Gap matrix
| Gap | Current behavior | Impact |
| --- | --- | --- |
| Research Brief standalone CRUD / GET / LIST | Missing; frontend submits Research Brief input into createWorkRun compatibility body | Cannot list standalone briefs outside WorkRun history |
| Batch Settlement Query | Missing; settlement is derived from WorkRun/report fields | Network/workspace settlement totals are conservative |
| API Health endpoint | Missing; EnvironmentBadge derives health from bootstrap success/fallback/failure | No independent health probe |
