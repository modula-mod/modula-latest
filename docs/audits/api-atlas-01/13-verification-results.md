# Verification Results

## Audit tooling

- `pnpm api:atlas:verify`: 80/80 passed.
- Deterministic output: two consecutive generations byte-identical.
- Runtime completeness: 535 = 384 application + 151 explicitly excluded framework-derived routes.
- Parsers: JSON, RFC-style CSV and JSON-compatible OpenAPI YAML PASS.
- Mermaid sanity: request, module, intelligence, media and event flows PASS.
- Client literals: 142/142 matched; 0 unresolved.
- Safe production probes: 26/26 PASS.
- Secret scan: database URLs, bearer tokens, JWTs, private keys, cookies and credential-like assignments PASS with zero matches.
- `git diff --check`: PASS.

## Repository verification

- `CI=true pnpm --filter @modula/greenfield-api typecheck`: passed.
- `CI=true pnpm --filter @modula/greenfield-worker typecheck`: passed.
- `CI=true pnpm api:test`: 107/107 standard and 23/23 targeted database acceptance passed.
- `CI=true pnpm worker:test`: 11/11 standard and 22/22 pre-migrated database acceptance passed.
- Authenticated production acceptance: 46 passed / 0 failed.
- Controlled cross-user and expected-failure acceptance: 28 passed / 0 failed.
- Production probes: 26/26 passed against starting production revision.
- Secret scan: passed.

An initial direct API typecheck before building workspace packages failed on unresolved workspace package outputs; the canonical package `pretest` built those dependencies, after which both typechecks passed. No source repair was made.

## Deliberate exclusions

- `verify:greenfield-backend-v1` was not used as the acceptance signal because `scripts/verify-greenfield-backend-v1.mjs:98` hard-codes production schema 055 while observed production is at 062, and it requires a clean `main` checkout while this mission correctly uses `audit/api-atlas-01`. That stale verifier is recorded as a P2 gap rather than bypassed.
- Database-backed suites use a disposable database, not production. Production writes are limited to reserved audit identities and marker-scoped fixtures with recorded cleanup.
- No load test or nginx edit occurred. Product defects documented as expected failures were not remediated in this baseline phase.
