# Launch Gate V1 (Verification Rules)

To ensure high-quality software delivery and prevent regression of mock data leaks, a strict launch gate is enforced.

## Automated Verification Suite

The validation pipeline consists of 4 dynamic modules and 1 static assertion module, unified by `verify-launch-v1.mjs`:

1. **Agent Core Verification** (`verify-agent-core.mjs`):
   - Asserts fresh registration constraints.
   - Asserts claiming attributes (Level 1, full energy, idle).
2. **Workflow State Machine Verification** (`verify-agent-workflow.mjs`):
   - Asserts whitelisted transition paths.
   - Asserts pause/resume state conservation (`paused_from_status`).
   - Asserts terminal state transition blocking.
3. **Box Store Verification** (`verify-box-store.mjs`):
   - Asserts Starter Box purchase restriction from store catalog.
   - Asserts atomic balance and stock check behaviors.
   - Asserts double box open protection.
4. **Agent Wallet Verification** (`verify-agent-wallet.mjs`):
   - Asserts TON address format validation.
   - Asserts observation mode transactions endpoint metadata payload.
   - Asserts pause/resume controls.

5. **Agent Skill Core Verification** (`verify-agent-skill-core.mjs`):
   - Asserts skill definition count (44) and tier/category correctness.
   - Asserts empty-slot learning flow with card consumption.
   - Asserts full-slot random replacement with lock protection.
   - Asserts lock/unlock limits (only one lock per agent).
   - Asserts Protection Token consumption and transient protection.
   - Asserts workflow integration through skill effects resolver.
   - Asserts database atomicity, idempotency, and event audit.
   - Requires local dev server with APP_ENV=test and ENABLE_TEST_ENDPOINTS=true.
 
 ## Static Codebase Assertions

The static checks scan the codebase automatically to prevent typical development leftovers:
- **No Production Mock Fallback**: Catch blocks in apiClient must not silently override failed API requests with mock data.
- **No Custody Keys**: Migrations and source code files must not define private key fields or generation methods.
- **No Fake Hashes**: API logic must not return hardcoded mock transaction hashes.
- **No Hardcoded Task Configuration**: All task configurations and work runs must be queried dynamically from the D1 database.
