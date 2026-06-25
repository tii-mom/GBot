# Frontend Runtime Product Alignment V2

## Motivation
- Turn the Mini App into a user-readable Agent runtime product instead of an engineering验收 surface.
- Keep Runtime V1 as the single primary entry while clarifying the production entry mismatch around `app.gb8.top`.
- Preserve real API usage and productized empty states instead of inventing mock production truth.

## What changed
- Runtime V1 entry now reads as an Agent workbench: Workspace, Agents, Tasks, Reports, Network.
- Workspace, Tasks, Reports, Agents, and Network copy now speaks in product language.
- Environment/API status messaging now distinguishes Production, Staging, Preview, and Local with Healthy / Degraded / Offline states.
- Runtime components were reorganized around reusable product primitives and productized empty states.
- Documentation now covers entry audit, IA, API usage, and Runtime product alignment.

## Runtime alignment
- `createWorkRun` remains the compatibility path for Research Brief input.
- Reports are read-only projections and support Share, Copy Link, and Export Markdown.
- Work Report detail now uses five explicit sections: Input, Execution, Evidence, Verification, Settlement.
- Legacy V0 components remain in the repo but not in the primary navigation.

## Production entry audit result
- Local code entry is Runtime V1.
- If production still shows V0, the likely cause is Pages binding, cache, branch, or domain routing, not the main Runtime entry.
- Build output must be checked for old primary-nav words before claiming production mismatch.

## API usage changes
- The runtime uses agent bootstrap, task listing, WorkRun/step/report reads, and WorkRun transitions.
- Marketplace, box opening, store, and leaderboard APIs remain outside the primary Runtime entry.
- Missing APIs are recorded as gaps instead of being faked in the UI.

## Screens changed
- Workspace
- Agents
- Tasks
- Reports
- Network

## Tests run
- `npm run typecheck`
- `npm run build`
- `cd apps/miniapp && npm run typecheck` via workspace build flow
- `cd apps/miniapp && npm run build` via workspace build flow

## Known gaps
- Research Brief standalone CRUD / GET / LIST remains missing.
- API Health endpoint remains missing.
- Batch Settlement Query remains missing.
- Telegram iOS / Android device validation was not performed in this pass.

## No deploy / no migration confirmation
- No deploy.
- No migrations.
- No production D1 changes.
- No Cloudflare config changes.
- No Telegram Bot config changes.
- No mock data presented as production truth.
