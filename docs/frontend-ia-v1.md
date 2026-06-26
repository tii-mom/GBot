# Frontend IA V1 (Legacy / Superseded)

> Status: legacy. Replaced by [GBot Canonical V1](./GBOT_CANONICAL_V1.md) and the real-asset frontend docs.

This document is preserved for historical reference only.

Status: final for PR #16 fix pass. The IA below matches `apps/miniapp/src/main.tsx`.

## Primary navigation
Runtime V1 primary navigation is exactly:

1. Workspace
2. Agents
3. Tasks
4. Reports
5. Network

The V0 primary labels Home, Mission, Bag, Market, and Crew are not used as top-level tabs in the Runtime V1 entry.

## Workspace
Workspace is the operational overview. It summarizes active agents, running tasks, verified reports, settlements, and GP earned. Recent Activity highlights Research Brief, Verification, Settlement, and Work Report signals derived from tasks and WorkRuns. Quick Actions route users to Research Brief creation, Reports, and Tasks.

## Agents
Agents is the Agent Center. It displays current agent identity, energy, skills, last runtime, Overview, Runtime, Skills, and History. Agent Studio is available as an action using the existing component contract.

## Tasks
Tasks replaces V0 Mission as the runtime work area. It contains Research Brief WorkRun creation, available tasks, WorkRun progress, and state-gated runtime controls. Runtime actions are only shown when the current WorkRun state makes them valid.

## Reports
Reports is the Work Report surface. It lists WorkRuns as report cards and opens a shareable canonical report URL with Input, Execution, Evidence, Verification, Settlement, and step timeline sections.

## Network
Network replaces Crew / Group Pool as a primary entry. It contains team, contribution, progress, members, rewards, Network Settings, and Assets as secondary content.
