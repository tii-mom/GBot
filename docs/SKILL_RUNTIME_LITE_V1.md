# Skill Runtime Lite V1 Documentation

This document describes the design, implementation, and boundaries of the Skill Runtime Lite V1 in PR #8.

## System Boundaries and Scope
- **Standalone Runtime Engine**: PR #8 delivers the standalone engine containing Preview, Execute, and Audit endpoints:
  - `POST /agents/:agentId/runtime/preview`
  - `POST /agents/:agentId/runtime/execute`
  - `POST /agents/:agentId/runtime/executions/:executionId/recover`
  - `GET /skills/runtime-status`
- **Workflow Simulation**: The legacy `/tasks/:taskId/run` endpoint remains a simulated workflow. It has **not** been connected to the real Skill Runtime engine.
- **Real Task Integration**: The actual connection of user tasks and `WorkRun` execution with the new Skill Runtime will be implemented in the next phase (**PR #9**).
- **Crucial Warning**: Under no circumstances should it be claimed that the existing `WorkRun` steps or mock execution routes are using the real Skill Runtime.
