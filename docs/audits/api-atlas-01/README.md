# MODULA GREENFIELD — API-ATLAS-01

Status: **PASS**. Candidate source and locally built runtime routes are reconciled; deployment, database, edge and operational facts remain sourced only from the production snapshot. Route completeness passed: 891 runtime method routes = 628 mapped application routes + 263 explicitly excluded framework-derived routes. Dedicated production audit identities executed authenticated cross-user and write acceptance; controlled exact-schema tests characterize module, intelligence and known expected-failure behavior.

This directory combines production truth captured at 2026-10-14T15:33:43.469Z with fresh local candidate route evidence captured at 2026-11-11T00:56:18.502Z. The machine-readable source of truth is `api-atlas.json`; Markdown files are generated views. Candidate evidence never claims deployment. Secret values and production row data are excluded.

## Contents

- `00-production-truth.md`: deployed topology, repository/runtime identity, edge and configuration status.
- `01-application-boot-map.md`: Fastify process and plugin registration graph.
- `02-http-api-atlas.md`, `api-atlas.json`, `api-atlas.csv`: complete route inventory.
- `03-auth-permissions-matrix.md`: per-route access controls.
- `04-database-api-map.md`, `route-data-map.json`: schema and route/data relationships.
- `05-media-storage-map.md`: attachment, profile, post, story and delivery paths.
- `06-module-platform-map.md`: registry through host/runtime.
- `07-intelligence-api-map.md`: Mission through governed ledger.
- `08-events-workers-jobs.md`: outbox, jobs, consumers, mail and failures.
- `09-client-capability-coverage.md`: product/client contract coverage.
- `10-live-probe-results.md`: anonymous and authenticated production probes.
- `11-gap-register.md`, `gap-register.json`: evidence-based findings.
- `12-remediation-roadmap.md`: sequenced follow-up missions; no fixes were made here.
- `13-verification-results.md`: audit-tool, typecheck and test outcomes plus explicit limitations.
- `openapi.generated.yaml`: generated implementation snapshot, intentionally incomplete where route schemas do not exist.
- `evidence/production-snapshot.json`, `evidence/authenticated-acceptance.json`: sanitized production facts; no secrets or user rows.
- `evidence/candidate-runtime.json`: locally built feature-branch route registration plus an API-source fingerprint; never production truth.

## Reproduce

`pnpm api:atlas:capture` reads production state without changing it. `pnpm api:atlas:capture-candidate` builds the API and captures feature-branch route registration without connecting to PostgreSQL. `pnpm api:atlas:probe` runs the bounded anonymous probe set. `pnpm api:atlas:acceptance` runs cleanup-capable authenticated acceptance with protected credentials. `pnpm api:atlas` regenerates the atlas. `pnpm api:atlas:verify` checks evidence provenance, source freshness, determinism, parsability, route reconciliation and secret safety.
