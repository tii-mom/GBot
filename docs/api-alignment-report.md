# API Alignment Report

Status: final for PR #16 fix pass.

## Used APIs
Runtime V1 pages use loginOrRegister, getMe, getInventory, getTasks, getAgentSkills, getWorkRuns, getActiveWorkRun, getWorkRun, getWorkRunSteps, getWorkReport, createWorkRun, approveStep, pauseWorkRun, resumeWorkRun, cancelWorkRun, and retryStep.

## Unused APIs
The Runtime V1 official entry does not use marketplace listing APIs, FOMO snapshot APIs, box opening, store APIs, leaderboard APIs, group pool join APIs, or V0 farm execution.

## Deprecated APIs
- runFarm: deprecated for Runtime V1 execution.
- getFomoSnapshot: not part of Runtime V1 primary IA.
- V0 mission/game-oriented task usage: deprecated as a primary product entry.

Note: getTasks itself is not deprecated. It remains the V1 available task API when used as WorkRun input.

## Missing APIs
- Research Brief standalone CRUD / GET / LIST.
- Batch Settlement Query.
- API Health endpoint.

## Compatibility notes
Research Brief creation uses createWorkRun with an input body. This aligns the frontend with current task runtime capabilities while avoiding claims that standalone Research Brief storage exists.
