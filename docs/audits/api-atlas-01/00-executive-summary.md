# GREENFIELD API ATLAS

Production SHA: `50dfc12045be639ad65acb95d2b4e94ea864ed42`
Production migration: `067_legacy_duplicate_installation_versions`
API service: `modula-production-greenfield-api-1` (healthy)
Worker service: `modula-production-greenfield-worker-1` (DB heartbeat fresh; no Docker healthcheck)
Database: PostgreSQL 16.9
Public API base: `https://api.modula.digital`
HTTP routes discovered: 446 application / 630 runtime method routes
Route evidence: local-candidate-runtime for feature branch phase-module-distribution-03; not deployed
Public routes: 76
Authenticated routes: 276
Admin/internal routes: 94
Mutating routes: 263
Read-only routes: 183
Routes with request schemas: 8
Routes with response schemas: 0
Routes with automated tests: 371
Routes live-probed: 26 unique routes
Routes with known callers: 237
Database tables: 305
Workers: 1 GreenField worker
Queues: PostgreSQL outbox plus background job tables
Scheduled jobs: 0 module schedules; worker poll/reap loops are process timers
Webhooks: 1 module-backend ingress family; 0 provider webhook families and 0 production module webhook deliveries
Complete capabilities: 34
Partial capabilities: 10
Missing capabilities: 5
P0 gaps: 0
P1 gaps: 15
P2 gaps: 20
P3 gaps: 4

Status: **PASS**. The map is complete: 35 bounded anonymous probes, 95 authenticated production checks, and 28 controlled ownership/trust checks passed. Known defects remain registered and regression-tested.

## Domain summary

| Domain | Routes | Complete capabilities | Partial capabilities | Missing/client-only | P0 gaps |
| --- | --- | --- | --- | --- | --- |
| Auth | 55 | 5 | 0 | 1 | 0 |
| Account | 17 | 4 | 1 | 0 | 0 |
| Profile | 8 | 4 | 1 | 1 | 0 |
| Social | 9 | 0 | 0 | 0 | 0 |
| Feed | 3 | 2 | 1 | 0 | 0 |
| Posts | 7 | 11 | 0 | 2 | 0 |
| Comments | 11 | 0 | 0 | 0 | 0 |
| Reactions | 5 | 0 | 0 | 0 | 0 |
| Media | 12 | 0 | 0 | 0 | 0 |
| Search | 9 | 4 | 0 | 0 | 0 |
| Discover | 1 | 1 | 4 | 0 | 0 |
| Activity | 4 | 1 | 1 | 1 | 0 |
| Modules | 150 | 2 | 2 | 0 | 0 |
| Module Runtime | 29 | 0 | 0 | 0 | 0 |
| Intelligence | 20 | 0 | 0 | 0 | 0 |
| Moderation | 2 | 0 | 0 | 0 | 0 |
| Operations | 6 | 0 | 0 | 0 | 0 |

## Candidate and production conclusions

- The running API and worker are the same OCI revision, `50dfc12045be639ad65acb95d2b4e94ea864ed42`; that revision exactly matches captured `origin/main`.
- Candidate source/runtime reconciliation is exact: 630 = 446 application routes + 184 automatic framework routes; there are no unexplained source-only or runtime-only application routes. Production remains separately observed at 575 runtime method routes on 50dfc12045be639ad65acb95d2b4e94ea864ed42.
- API-FIX-01 ownership, permission, private-follow, reaction and signed-release trust controls are deployed; isolated cryptographic-negative production fixtures remain pending. Historical unsigned releases remain untrusted. Remaining risks include missing module artifacts/assets, non-operational AI/GAIA/Nodus paths, client-only link/poll composition, and media edge/durability gaps.
- No P0 was established by static, authenticated production, or controlled exact-schema acceptance. Known P1/P2 failures remain explicit.

## What GreenField Is Missing

### Missing for Modula Native

- A profile modules surface, Native adoption of the now-live follow-request lifecycle, dedicated request/mention activity contracts, and real link/poll persistence. Evidence: capability matrix and gap register.

### Missing for Social

- Native adoption of the live private-follow approval contract, stable pagination for Discover/activity, and a documented real-time/polling contract. Reaction notification replay is complete; broader activity reliability remains future work.

### Missing for Profiles

- Profile-link CRUD and one canonical owned-media path; raw public avatar/cover URLs remain a competing model.

### Missing for Posts/Media

- Explicit link/poll contracts, aligned public upload limits, scheduled orphan/expired-file cleanup, and host-loss recovery/object replication.

### Missing for Product Hub

- Complete immutable package/artwork bytes, production artwork, and automated signed ingestion.

### Missing for Modules

- Complete historical artifact/descriptors, explicit review of two pre-existing unreviewed installations, and removal of Vault-specific branches. Production signatures and fail-closed recorded grants are enforced.

### Missing for Third-Party Module Developers

- Enabled community/remote execution, working source synchronization, signed release ceremony and a fully generic governed action/function path.

### Missing for GAIA/AKI/AGI

- An operational planner/provider and production mission acceptance. AKI/Governor/command enforcement exists but production state is empty.

### Missing for Nodus Integration

- A local/offline Nodus handshake, capability discovery, proposal/approval and ledger synchronization contract.

### Missing for Security

- Remediation of the reproduced legacy function and AI-stream ownership failures, schema-declared boundaries, signature-required trust and uniform private-resource not-found semantics.

### Missing for Production Operations

- Worker container health, storage readiness/recovery, end-to-end correlation/metrics, and resolved dead letters.

### Missing for Developer Experience

- Canonical OpenAPI schemas, deterministic typed clients, explicit route deprecations and runtime SQL-to-route tracing in a disposable harness.

Every item above is expanded with evidence, impact, dependency and verification in `11-gap-register.md` and `12-remediation-roadmap.md`.

## Existing GreenField Capabilities Not Currently Used

- Complete passkey/TOTP/recovery/session security APIs, developer/build coordination, module installation descriptors, generic verified MPS ModuleHost execution, and governed intelligence mission routes exist beyond current observed client usage.
- 232 registered routes have no statically observed product-client caller; 169 are test-observed without a product-client caller. Per-route evidence is in `api-atlas.json`.
- Real AI provider adapters exist, but all real providers are unconfigured; only a development mock is available and excluded by the production resolver.

## Duplicate or Competing Implementations

- Legacy base64 post media versus canonical two-stage attachments.
- Legacy sessions/likes versus account sessions/typed reactions.
- Raw profile avatar/cover URLs versus owned attachment bindings.
- Generic ModuleHost execution versus Vault-specific core branches in intelligence, AI, search and Board presentation.

The preferred paths are canonical attachments, account security/session contracts, typed reactions, owned profile-media bindings and manifest-driven generic hosting.

## Surface Exists, Backend Does Not

- Link and poll composer UI/types do not have persistence contracts.
- Connector metadata advertises webhook support without provider ingress routes.
- Module presentation rows may advertise assets without bytes; most releases lack artifact bytes.
- GAIA/provider interfaces exist, but no real provider is operational and GAIA recognizes only fixture objectives.
- Module GitHub synchronization code and routes exist, but production has no source and automation is disabled.
