# Phase 7E Search Platform Validation

This document records the Block 4 validation surface for Greenfield unified search.

## Required Environment

Run host-side validation from the repo-local Greenfield API environment:

```
set -a
. services/greenfield-api/.env
set +a
```

The repo-local file points host commands at the preview PostgreSQL listener. The container `/etc/modula/greenfield-api.env` uses Docker service DNS and is not the intended host-shell validation environment.

The isolated search verifier also needs an admin-capable connection for temporary database create/drop. Provide either `MODULA_DATABASE_ADMIN_URL` or a process-local `MODULA_ADMIN_PASSWORD`; the verifier uses the admin role only to create and drop the isolated database, and runs migrations/tests through `MODULA_TEST_DATABASE_URL`.

## Focused Search Verifier

Command:

```
MODULA_TEST_DATABASE_URL="$MODULA_DATABASE_MIGRATOR_URL" node scripts/verify-phase7e-search-platform.mjs
```

The verifier proves:

- canonical search contracts exist;
- migration `021_phase7e_unified_search.sql` and rollback exist;
- API query parsing rejects unsafe input and validates cursors;
- search uses projected documents and PostgreSQL full-text search;
- result reads invoke the central policy engine;
- public/account routes and operator diagnostics routes are registered;
- worker projectors enforce source-version ordering and sanitized failures;
- API and worker DB-backed search tests pass on an isolated database;
- rollback of migration `021` succeeds on the isolated database.

The verifier fails if the search platform is only in memory, if route handlers bypass the projection repository, if policy evaluation is absent, if internal fields are exposed in public result contracts, or if deletion leaves active searchable content.

## Full Block 4 Gate

Run:

```
pnpm lint
pnpm typecheck
pnpm --filter @modula/greenfield-contracts build
pnpm --filter @modula/api-contracts build
pnpm --filter @modula/greenfield-schema-registry build
pnpm --filter @modula/greenfield-api typecheck
pnpm --filter @modula/greenfield-api build
pnpm --filter @modula/greenfield-api test
pnpm --filter @modula/greenfield-worker typecheck
pnpm --filter @modula/greenfield-worker build
pnpm --filter @modula/greenfield-worker test
MODULA_TEST_DATABASE_URL="$MODULA_DATABASE_MIGRATOR_URL" node scripts/verify-phase7e-event-platform.mjs
MODULA_TEST_DATABASE_URL="$MODULA_DATABASE_MIGRATOR_URL" node scripts/verify-phase7e-policy-engine.mjs
MODULA_TEST_DATABASE_URL="$MODULA_DATABASE_MIGRATOR_URL" node scripts/verify-phase7e-audit-platform.mjs
MODULA_TEST_DATABASE_URL="$MODULA_DATABASE_MIGRATOR_URL" node scripts/verify-phase7e-notifications.mjs
node scripts/verify-phase7e-code-quality.mjs
MODULA_TEST_DATABASE_URL="$MODULA_DATABASE_MIGRATOR_URL" node scripts/verify-phase7e-search-platform.mjs
git diff --check
```

## Covered Behaviors

The DB-backed tests cover:

- post creation event -> search-index delivery -> document -> authorized result;
- private post account isolation;
- post update replacement;
- stale source-version rejection;
- deletion tombstone;
- duplicate delivery idempotency;
- cursor pagination;
- profile projection with hidden field non-leakage;
- malformed cursor rejection;
- account-scoped recent searches;
- module projection;
- module release projection;
- quarantined module omission from normal search;
- diagnostics;
- reindex audit and job enqueue.

## Out Of Scope

Block 4 does not validate or implement:

- embeddings;
- vector databases;
- AI-generated summaries;
- personalized AI ranking;
- Vault Notes records;
- connector file indexing;
- DIMON indexing;
- automation indexing;
- frontend universal search redesign;
- module-standard repository work.
