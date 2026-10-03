# MODULA GREENFIELD — API-ATLAS-01

Status: **PASS**. Production, source, runtime, edge, database, module, intelligence and asynchronous surfaces were reconciled. Route completeness passed: 535 runtime method routes = 384 mapped application routes + 151 explicitly excluded framework-derived routes. Dedicated production audit identities executed authenticated cross-user and write acceptance; controlled exact-schema tests characterize module, intelligence and known expected-failure behavior.

This directory is the canonical evidence-backed snapshot captured at 2026-10-03T10:02:55.876Z. The machine-readable source of truth is `api-atlas.json`; Markdown files are generated views. Secret values and production row data are excluded.

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

## Reproduce

`pnpm api:atlas:capture` reads production state without changing it. `pnpm api:atlas:probe` runs the bounded anonymous probe set. `pnpm api:atlas:acceptance` runs cleanup-capable authenticated acceptance with protected credentials. `pnpm api:atlas` regenerates the atlas. `pnpm api:atlas:verify` checks determinism, parsability, route reconciliation and secret safety.
