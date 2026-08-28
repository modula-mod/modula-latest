# GBV1-17 security validation

Run from the Greenfield Backend V1 completion worktree:

```bash
CI=true pnpm verify:greenfield-backend-v1:security
```

Acceptance requires every source policy, independent service verifier,
disposable-database behavior suite, cross-product PostgreSQL isolation test,
and repository diff check to pass. Only then may the verifier emit the ten
zero-count security invariants and `GREENFIELD BACKEND V1 SECURITY PASS`.

Production mutation is deliberately excluded from this checkpoint. Production
schema and exact-SHA convergence remain GBV1-19 gates.
