# Frontend Product IA V2

## Summary
- This IA keeps Runtime V1 as the only primary entry pattern.
- It reframes the screens in user language while preserving the existing Runtime data model.
- It does not restore Home / Missions / Bag / Market / Crew as primary tabs.

## New navigation
1. Workspace
2. Agents
3. Tasks
4. Reports
5. Network

## Page tree
- Workspace
  - Agent status
  - Today tasks
  - Energy
  - GP / Pending Points
  - Recent Work Report
  - Recent Verification
  - Recent Settlement
  - Primary action
- Agents
  - Agent card
  - Agent detail
  - Skill cards
  - Agent Studio
- Tasks
  - Research Brief compatibility path
  - Available
  - Running
  - Waiting Confirmation
  - Pending Verification
  - Completed
  - Failed / Retryable
- Reports
  - Filtered report list
  - Work Report detail
  - Share / Copy Link / Export Markdown
- Network
  - Team overview
  - Network settings
  - Assets

## V0 to Runtime V1 mapping
| V0 primary surface | Runtime V1 / V2 destination |
| --- | --- |
| Home | Workspace |
| Missions | Tasks |
| Bag | Network or Agent Detail secondary module |
| Market | Network secondary module |
| Crew | Network |

## User core path
- Claim or bind an Agent.
- Review the Agent workbench.
- Let the Agent analyze a task and generate a plan.
- Confirm execution when needed.
- Watch verification and settlement.
- Open the Work Report.
- Share the finished report or move into Network growth actions.

## Legacy component policy
- Legacy V0 components can remain in the repo if they still support secondary modules or transitional content.
- They must not return as top-level navigation surfaces.
- Bag / Market / Crew functionality belongs inside Network or Agent detail, not as primary tabs.

## Secondary module policy
- Bag can be treated as an Asset center secondary module.
- Market can remain as a Network secondary module.
- Crew growth actions and Telegram group binding stay inside Network settings and related secondary surfaces.

## Non-goals
- No full i18n replatform.
- No redesign of the whole app shell.
- No deploy, no migrations, no production config changes.
