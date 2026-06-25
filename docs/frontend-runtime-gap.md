# Runtime V1 Frontend Closure

Status: final for Frontend Runtime Rebuild V1 P0 closure.

## Current routes / tabs
The Mini App official entry is `apps/miniapp/src/main.tsx` through `apps/miniapp/index.html`. Primary navigation is Workspace, Agents, Tasks, Reports, and Network.

## Current pages
- Workspace: active agents, running tasks, verified reports, settlements, GP earned, recent activity, and quick actions.
- Agents: Agent Center with Overview, Runtime, Skills, and History backed by agent data, getAgentSkills, and getWorkRuns.
- Tasks: available tasks, running work, verification-awaiting work, completed work, and WorkRun controls.
- Reports: Research Brief, Work Report, Verification Result, Settlement, and detail sections for Input, Execution, Evidence, Verification, and Settlement.
- Network: Team, Contribution, Progress, Members, Rewards, and Network Settings / Assets.

## Current components
Shared Runtime UI components are Card, StatCard, RuntimeBadge, StatusBadge, ProgressCard, ReportCard, AgentCard, RuntimeTimeline, and EnvironmentBadge.

## Current state management
State is local React state in main.tsx. It is loaded from real API calls and derived in memory; no runtime-only mock data is introduced.

## Current API calls
Used APIs: loginOrRegister, getMe, getInventory, getTasks, getAgentSkills, getWorkRuns, getActiveWorkRun, getWorkRun, getWorkRunSteps, getWorkReport, createWorkRun, approveStep, pauseWorkRun, resumeWorkRun, cancelWorkRun, retryStep.

## Backend capabilities
Main has WorkRun, WorkRunStatus, WorkRun step/event APIs, task availability, agent skills, and WorkRun transition APIs. The frontend adds the WorkReportResponse client method for the documented /work-runs/:id/report path.

## Frontend used / unused API mapping
Used APIs are listed above. Unused APIs include marketplace, FOMO snapshot, box opening, legacy farm execution, leaderboard, and store flows in this Runtime V1 entry.

## Gap matrix
- Research Brief standalone CRUD / GET / LIST: missing; current frontend uses createWorkRun(taskId) compatibility path.
- Batch Settlement Query: missing; settlement is derived from WorkRun/report detail.
- API health endpoint: missing; EnvironmentBadge derives API status from bootstrap success, fallback, or failure.

## Deprecated APIs
- runFarm is deprecated for Runtime V1 entry.
- getFomoSnapshot is not used by Runtime V1 navigation.
- V0 mission/game-oriented task usage is deprecated; V1 getTasks usage remains allowed for available runtime tasks.
