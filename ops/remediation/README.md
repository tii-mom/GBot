# Production D1 Remediation

These files are generated for the exact production history/schema divergence documented on `2026-06-28`.

- `production-d1-remediation-schema-v1.sql`: schema-only remediation for the observed production shape
- `production-d1-remediation-history-v1.sql`: `d1_migrations` backfill to run only after schema verification passes

Commands:

```bash
npm run build:production-d1-remediation
npm run verify:production-d1-custom-remediation
```

The verification flow builds a synthetic divergent clone, applies the schema remediation, confirms the history mismatch still fails closed, backfills `d1_migrations`, and then requires preflight to pass at migration max `17`.
