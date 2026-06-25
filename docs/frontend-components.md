# Runtime UI Components

Status: final for PR #16 fix pass.

## Component inventory
- Card: base panel for runtime pages.
- StatCard: numeric workspace metric card.
- RuntimeBadge: combines runtime status and optional progress.
- StatusBadge: normalized status pill.
- ProgressCard: WorkRun progress row with progress bar.
- ReportCard: clickable WorkRun report entry.
- AgentCard: current agent summary; renders as a button only when an `onOpen` handler exists and as a non-interactive article otherwise.
- RuntimeTimeline: WorkRun step timeline.
- TaskLine: available runtime task row.
- EnvironmentBadge: environment and derived API status badge.

## Usage map
- Workspace uses Card and StatCard.
- Agents uses Card, AgentCard, RuntimeBadge, and StatusBadge.
- Tasks uses Card, TaskLine, ProgressCard, and state-gated runtime action buttons.
- Reports uses ReportCard, Card, StatusBadge, and RuntimeTimeline.
- Network uses Card for team/settings/assets secondary sections.

## Interaction rules
Interactive components must expose an action. AgentCard is intentionally non-focusable when no `onOpen` handler is provided. WorkRun action buttons are state-gated by helper functions in `main.tsx`.
