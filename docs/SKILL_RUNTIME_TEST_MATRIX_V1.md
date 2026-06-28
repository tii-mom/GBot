# Skill Runtime Lite V1 Test Matrix

This document provides the verification matrix for the **PR #8: Skill Runtime Lite V1** development phase, proving the correctness, robustness, and coverage of all integration areas.

## Acceptance Test Matrix

| Area | Requirement | Test Name | Script Location | Assertion | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Runtime Catalog** | Verify runtime status of all 31 canonical skills. | `GET /skills/runtime-status returns compiled active/planned skill counts` | `scripts/verify-skill-runtime-lite.mjs` | Returns exactly 31 skills in catalog with the compiled runtime baseline active in DB and no missing canonical entries. | **PASS** |
| **Selection** | Verify previewing and selecting learned skills for task templates. | `Preview lists missing required skill and execute rejects it` <br> `Preview shows selected required skill after learning it` | `scripts/verify-skill-runtime-lite.mjs` | 1. If required skill is not learned, it is marked as missing and execution is blocked (400). <br> 2. Learned required/recommended skills are successfully selected. | **PASS** |
| **Execution** | Verify correct assembly of prompt layers and execution of LLM. | `Execute returns deterministic result, tokens/cost and audits successfully` | `scripts/verify-skill-runtime-lite.mjs` | Executes the layered prompt with instructions and level effects, returning structured JSON result and token cost usage. | **PASS** |
| **Failure Recovery** | Load `Failure Recovery` (fallback selection role) only under recovery conditions. | `Task Decomposition and Failure Recovery triggers are loaded correctly` | `scripts/verify-skill-runtime-lite.mjs` | 1. First execution attempt loads only `Task Decomposition`. <br> 2. Recovery attempt (`isRecoveryAttempt: true`) triggers and loads `Failure Recovery` fallback. | **PASS** |
| **Idempotency** | Verify idempotency key validation and conflict prevention. | `Execute returns deterministic result, tokens/cost and audits successfully` | `scripts/verify-skill-runtime-lite.mjs` | 1. Repeated request with same parameters returns cached execution results immediately. <br> 2. Repeated request with different parameters returns `idempotency_conflict` (409). | **PASS** |
| **Level Effects** | Include skill level in selected runtime info to apply corresponding prompt level instructions. | `Preview shows selected required skill after learning it` | `scripts/verify-skill-runtime-lite.mjs` | Preview returns the correct `level` of the selected skill from the agent's learned skill record. | **PASS** |
| **Security** | Secure endpoints, prevent parameter overrides, and handle timeouts. | `Execute rejects other user's agent and validates timeout mock` | `scripts/verify-skill-runtime-lite.mjs` | 1. Block unauthorized access to another user's agent (403). <br> 2. Catch and report timeout errors (408). <br> 3. Prevent preview leaking instructions. | **PASS** |
| **Audit** | Write detailed audits for executions and individual runtime usages. | `Execute returns deterministic result, tokens/cost and audits successfully` | `scripts/verify-skill-runtime-lite.mjs` | Database creates audit entries in `skill_runtime_executions` and `task_skill_runtime_usages` on completed runs. | **PASS** |
| **Fresh Migration** | Verify clean database creation and seeding of active runtimes. | `Fresh DB migration and table checks (0001 -> 0014)` | `scripts/verify-skill-runtime-lite.mjs` | 1. Blank database builds from scratch. <br> 2. Tables exist, and all compiled runtimes are seeded as active. <br> 3. `PRAGMA foreign_key_check` passes. | **PASS** |
| **Upgrade Migration** | Verify database upgrade without data loss. | `0013 to 0014 Upgrade and data retention check` | `scripts/verify-skill-runtime-lite.mjs` | 1. Upgrades existing 0013 database to 0014. <br> 2. Retains all pre-upgrade user/agent/learned skill records. <br> 3. Compiled active runtimes remain present after upgrade. | **PASS** |
| **Compatibility** | Ensure migrations in root and worker are identical. | `Migration files are identical in root and api-worker` | `scripts/verify-skill-runtime-lite.mjs` | Verifies SHA-256 of `0014_skill_runtime_lite_v1.sql` matches perfectly across project directories. | **PASS** |
| **Frontend Build** | Ensure Mini App compiles and builds successfully for production. | `npm run build -w @growthbot/miniapp` | Project Root | Compiles typescript check and packages bundles without errors. | **PASS** |

## Verification Details

To execute the full verification suite locally:
1. Running static type-checks and migration sync checks:
   ```bash
   npm run verify:static-v1
   ```
2. Running the V1 integration tests:
   ```bash
   TEST_ENDPOINT_TOKEN=ci_test_secret VITE_API_BASE=http://127.0.0.1:8787 npm run verify:integration-v1
   ```
3. Building the client application:
   ```bash
   npm run build -w @growthbot/miniapp
   ```
