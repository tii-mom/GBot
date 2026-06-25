# Frontend Production Entry Audit

## Current symptom
- `app.gb8.top` still appears to show a V0-style interface with Home / Missions / Bag / Market / Crew semantics.
- This audit does not claim the production site is fixed. It records the current code-entry and build evidence on the PR #18 candidate branch.

## Local Runtime V1 entry
- `apps/miniapp/index.html` points at `/src/main.tsx`.
- `apps/miniapp/src/main.tsx` is the Runtime V1 official entry and renders `Workspace / Agents / Tasks / Reports / Network`.
- The V0 views remain in the repo as legacy code, but they are not the primary Runtime entry.

## Build entry
- `apps/miniapp` is the Vite build target for the Mini App.
- `apps/miniapp/dist/index.html` is produced from the Runtime V1 entry and references generated JS/CSS bundles.
- This audit is based on built output, not source-only assumptions.

## Dist check
- Post-build scan of `apps/miniapp/dist` found no `Missions` or `Bag` strings.
- Post-build scan found `Home`, `Market`, and `Crew` strings in the JS bundle, but the matches are not primary Runtime nav labels.
- The `Home` match is the standard keyboard key name `Home`.
- The `Market` matches come from secondary/legacy marketplace content, including `Marketplace / campaign`, not from Runtime primary navigation.
- The `Crew` matches come from secondary/legacy content such as `Crew Box`, `Boost Crew Mission`, and `Crew unlock pool`, not from Runtime primary navigation.
- The built Runtime navigation itself is `Workspace / Agents / Tasks / Reports / Network`.

## Old V0 residue
- Old V0 components remain in the repo as legacy surfaces: `HomeView`, `EarnView`, `InventoryView`, `MarketplaceView`, `GroupPoolView`, `LeaderboardView`, `BoxOpeningView`, `StoreView`.
- They are not used as primary Runtime navigation in the V1 entry.
- They may still be referenced by secondary product surfaces and should stay legacy or secondary only.

## Production mismatch interpretation
- If production still looks V0 while local dist is Runtime V1, the likely cause is Cloudflare Pages project binding, branch binding, cache, or domain routing.
- If the built output itself ever shows `Home / Missions / Bag / Market / Crew` as top-level nav again, that would point back to code entry or build entry regression.

## Cloudflare Pages checks for a human
- Confirm the `app.gb8.top` Pages project is attached to the current repository.
- Confirm the build command targets `apps/miniapp`.
- Confirm the output directory is the current Vite dist for the Mini App.
- Confirm the branch binding resolves to `main`.
- Confirm the domain binding points to the intended Pages deployment.
- Confirm no cached legacy bundle is still mapped behind the custom domain.

## Repair guidance without deploy
- If local `apps/miniapp/dist` is clean but production still looks V0, hand off to Cloudflare Pages binding and cache investigation.
- If local `apps/miniapp/dist` reintroduces old primary nav, fix the code entry or build entry first, then rebuild and re-check.
- Do not deploy from this task.
