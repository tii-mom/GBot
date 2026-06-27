# TON Testnet Executor Rollback Runbook V1

> Status: readiness-only runbook. This PR does not enable executor, signing, broadcasting, or live chain execution.

## 1. Purpose

This runbook defines the rollback and safety response expected before any future TON testnet executor PR is allowed to start implementation or launch review.

## 2. Scope

- Future TON testnet executor incidents.
- Admin Review Queue reconciliation.
- Tx Status Tracker reconciliation.
- Global pause and executor disable procedures.
- Audit evidence capture for simulated and future DB-backed runtime records.

## 3. Non-goals

- This PR does not enable executor.
- This PR does not sign transactions.
- This PR does not broadcast transactions.
- This PR does not execute chain transactions.
- This PR does not store private keys.
- This PR does not store seed phrases.
- This PR does not store mnemonics.
- This PR does not control the user main wallet.
- This PR does not run production D1 migration apply.
- This PR does not deploy.

## 4. Stop Conditions

Stop any future executor rollout immediately if any of the following occurs:

- `executorEnabled`, `testnetExecutorEnabled`, or `liveExecutorEnabled` becomes `true` unexpectedly.
- Admin global pause cannot be read or audited.
- Tx status transitions become inconsistent with stored intent/audit evidence.
- Review Queue items cannot be reconciled against policy decisions.
- Any path introduces signing, broadcasting, custody, private-key storage, seed phrase storage, mnemonic storage, or main wallet control.

## 5. Global Pause Procedure

1. Open Admin Risk Console.
2. Confirm the `global_pause` readiness gate and current pause status.
3. Enable Admin global pause in the approved future executor control surface.
4. Record operator, timestamp, scope, and reason in audit evidence.
5. Confirm downstream executor state remains disabled and no new submission path starts.

## 6. Disable Executor Procedure

1. Set executor control flags to disabled.
2. Verify `executorEnabled: false`.
3. Verify `testnetExecutorEnabled: false`.
4. Verify `liveExecutorEnabled: false`.
5. Verify `liveExecution: false`.
6. Append audit evidence with operator, reason, and impacted intent ids if any exist.

## 7. Intent Rollback / Cancellation Strategy

- New intents must stop entering execution review.
- Pending intents move to `cancelled` or `blocked` according to operator review.
- No rollback path may sign or broadcast on behalf of the user.
- If future reservation logic exists, release reserved budget only after audit evidence is appended.

## 8. Tx Status Tracker Reconciliation

- Compare review queue items, intent status rows, transaction status rows, and audit events.
- Any simulated placeholder such as `submitted_testnet_placeholder` must remain visibly non-live.
- Missing or conflicting statuses must be recorded as `blocked` until reviewed.

## 9. Audit Evidence Collection

Capture:

- operator identity
- incident start/end time
- affected intent ids
- affected purchase intent ids
- affected queue items
- pause / disable actions taken
- user-visible impact
- follow-up remediation owner

## 10. Admin Review Queue Reconciliation

- Review unresolved items first.
- Confirm policy decision, risk level, and latest summary are still correct.
- Mark items `resolved`, `denied`, `failed`, or `cancelled` only after notes are attached.
- Never use Admin UI to sign, submit, broadcast, or enable executor.

## 11. User Communication Principles

- Explain that execution is policy-limited and audit-first.
- Do not promise guaranteed outcomes.
- Do not imply risk-free behavior.
- Do not imply funds are custodied by the Agent.
- Be explicit when the system is simulation-only or degraded.

## 12. Production D1 Safety

- No production D1 migration apply is part of this runbook.
- If future incidents involve persistence mismatch, diagnose first and prepare a separate approved migration/remediation PR if needed.
- Do not mutate production D1 ad hoc during rollout response.

## 13. No Private-Key / No Custody Boundary

- No private keys.
- No seed phrases.
- No mnemonics.
- No custody behavior.
- No Agent control of user main wallet.

These boundaries remain mandatory during rollback, smoke test, and future executor work.

## 14. Post-incident Review Checklist

- Confirm global pause behavior was readable and auditable.
- Confirm executor disable path worked.
- Confirm Tx Status Tracker and Review Queue were reconciled.
- Confirm audit evidence was collected.
- Confirm no private-key, seed phrase, mnemonic, custody, or main wallet control boundary was crossed.
- Document root cause, blast radius, and next PR slice.
