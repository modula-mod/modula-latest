# Phase 7L-B Disposable PostgreSQL Acceptance

Date: 2026-08-13
Repo: `/root/modula-latest`
Source baseline before this acceptance slice: `60493f58dd17fd996fb6adb54029f1db41582e72`
Acceptance source contents: the commit containing this document
Status: `PASS_LOCAL`

## Isolated PostgreSQL Instance

- Container: `modula-phase7l-b-pg`
- Image: `postgres:16.9-alpine`
- Binding: `127.0.0.1:55437->5432`
- Production database touched: no
- Required roles created inside disposable instance: `modula_migrator`, `modula_api`, `modula_worker`, `modula_backup`, `modula_readonly`

Primary test-harness URLs:

```text
MODULA_TEST_DATABASE_URL=postgresql://modula_api:<redacted>@127.0.0.1:55437/modula_phase7lb_acceptance_api
MODULA_DATABASE_MIGRATOR_URL=postgresql://modula_api:<redacted>@127.0.0.1:55437/modula_phase7lb_acceptance_api
MODULA_DATABASE_ADMIN_URL=postgresql://postgres:<redacted>@127.0.0.1:55437/postgres
MODULA_TEST_DATABASE_ADMIN_URL=postgresql://postgres:<redacted>@127.0.0.1:55437/postgres
```

Migration-role smoke URL:

```text
MODULA_DATABASE_MIGRATOR_URL=postgresql://modula_migrator:<redacted>@127.0.0.1:55437/modula_phase7lb_acceptance
```

Note: the existing DB-backed Vitest files read `MODULA_TEST_DATABASE_URL` and set `MODULA_DATABASE_MIGRATOR_URL` to that same URL inside the process. The test-harness acceptance DB is therefore owned by `modula_api`, whose RLS policies allow the fixture writes. A separate `modula_migrator`-owned disposable DB also applied all migrations to prove migrator-role migration compatibility.

## Migration Proof

Migration command against `modula_phase7lb_acceptance` with `modula_migrator`:

```sh
CI=true NODE_ENV=test MODULA_ENVIRONMENT=development MODULA_DATABASE_URL=<modula_api-url> MODULA_DATABASE_MIGRATOR_URL=<modula_migrator-url> pnpm --filter @modula/greenfield-api db:migrate
```

Result: applied `001_init_schema` through `037_phase7i_f5b_rollback_compatibility`.

Status command against `modula_phase7lb_acceptance_api`:

```sh
CI=true NODE_ENV=test MODULA_ENVIRONMENT=development MODULA_DATABASE_URL=<modula_api-url> MODULA_DATABASE_MIGRATOR_URL=<modula_api-url> pnpm --filter @modula/greenfield-api db:status
```

Result: `pending: []` before and after DB-backed acceptance tests.

## Acceptance Commands

```sh
CI=true NODE_ENV=test MODULA_ENVIRONMENT=development MODULA_TEST_DATABASE_URL=<modula_api-url> MODULA_DATABASE_URL=<modula_api-url> MODULA_DATABASE_MIGRATOR_URL=<modula_api-url> pnpm --filter @modula/greenfield-api exec vitest run --reporter=verbose
```

Result: `26 passed (26)`, `136 passed (136)`, no skipped tests.

```sh
CI=true NODE_ENV=test MODULA_ENVIRONMENT=development MODULA_TEST_DATABASE_URL=<modula_api-url> MODULA_DATABASE_URL=<modula_api-url> pnpm --filter @modula/greenfield-worker exec vitest run --reporter=verbose
```

Result: `8 passed (8)`, `17 passed (17)`, no skipped tests.

```sh
CI=true NODE_ENV=test MODULA_ENVIRONMENT=development MODULA_TEST_DATABASE_URL=<modula_api-url> MODULA_DATABASE_URL=<modula_api-url> MODULA_DATABASE_MIGRATOR_URL=<modula_api-url> MODULA_DATABASE_ADMIN_URL=<postgres-admin-url> MODULA_TEST_DATABASE_ADMIN_URL=<postgres-admin-url> pnpm verify:phase7e-module-runtime-2
```

Result: source checks passed, API build passed, worker build passed, isolated Standard 2 runtime integration test passed, verifier-created DB was dropped. Overall command remains non-zero only because live production still fails version agreement before deployment: `LIVE_DEPLOYMENT_FAILURE`.

```sh
CI=true NODE_ENV=test MODULA_ENVIRONMENT=development MODULA_TEST_DATABASE_URL=<modula_api-url> MODULA_DATABASE_URL=<modula_api-url> MODULA_DATABASE_MIGRATOR_URL=<modula_api-url> MODULA_DATABASE_ADMIN_URL=<postgres-admin-url> MODULA_TEST_DATABASE_ADMIN_URL=<postgres-admin-url> pnpm verify:phase7e-vault-notes
```

Result: Vault Notes external package build/test passed, API lifecycle/data/search/security test passed, worker search projector test passed, migration rollback through `022_phase7e_module_records_and_vault_notes` passed, isolated DB was dropped.

## Source Repairs Found During Acceptance

- `services/greenfield-api/src/modules/beta-catalogue-policy.ts`: fixed stale `BetaModuleClassification` type reference so `@modula/greenfield-api` builds directly.
- `services/greenfield-api/tests/phase7e.search-platform.test.ts`: increased event-delivery drain attempts to handle shared acceptance DB backlog while still using real worker event delivery.
- `services/greenfield-worker/src/search/module-projector.ts`: generated `digital.modula.search-*` fixtures are tombstoned instead of indexed as active beta search results.
- `services/greenfield-worker/src/search/module-release-projector.ts`: generated fixture releases are tombstoned instead of indexed as active beta search results.

## Verdict

Disposable DB acceptance environment: `PASS_LOCAL`.

Outstanding boundary: live deployment identity remains behind local main and is intentionally not repaired until all source P0/P1 repairs are complete.
