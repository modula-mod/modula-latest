# GREENFIELD API ATLAS

Production SHA: `c7c46dfa3d85b89617de833723aab8f207f0ba94`
Production migration: `062_public_status_support_cases`
API service: `modula-production-greenfield-api-1` (healthy)
Worker service: `modula-production-greenfield-worker-1` (DB heartbeat fresh; no Docker healthcheck)
Database: PostgreSQL 16.9
Public API base: `https://api.modula.digital`
HTTP routes discovered: 384 application / 535 runtime method routes
Public routes: 74
Authenticated routes: 220
Admin/internal routes: 90
Mutating routes: 234
Read-only routes: 150
Routes with request schemas: 0
Routes with response schemas: 0
Routes with automated tests: 312
Routes live-probed: 17 unique routes
Routes with known callers: 200
Database tables: 283
Workers: 1 GreenField worker
Queues: PostgreSQL outbox plus background job tables
Scheduled jobs: 0 module schedules; worker poll/reap loops are process timers
Webhooks: 1 module-backend ingress family; 0 provider webhook families and 0 production module webhook deliveries
Complete capabilities: 32
Partial capabilities: 12
Missing capabilities: 5
P0 gaps: 0
P1 gaps: 16
P2 gaps: 21
P3 gaps: 4

Status: **PARTIAL**. Gates A, B, C (static), D, E, F, G, H, J and K are evidenced. Gate I is partial: 26 bounded anonymous requests passed across 17 unique routes, but safe authenticated cross-user/write acceptance was unavailable. This report therefore does not claim PASS.

## Domain summary

| Domain | Routes | Complete capabilities | Partial capabilities | Missing/client-only | P0 gaps |
| --- | --- | --- | --- | --- | --- |
| Auth | 50 | 5 | 0 | 1 | 0 |
| Account | 16 | 4 | 1 | 0 | 0 |
| Profile | 7 | 2 | 3 | 1 | 0 |
| Social | 9 | 0 | 0 | 0 | 0 |
| Feed | 3 | 2 | 1 | 0 | 0 |
| Posts | 7 | 11 | 0 | 2 | 0 |
| Comments | 8 | 0 | 0 | 0 | 0 |
| Reactions | 5 | 0 | 0 | 0 | 0 |
| Media | 12 | 0 | 0 | 0 | 0 |
| Search | 9 | 4 | 0 | 0 | 0 |
| Discover | 1 | 1 | 4 | 0 | 0 |
| Activity | 4 | 1 | 1 | 1 | 0 |
| Modules | 118 | 2 | 2 | 0 | 0 |
| Module Runtime | 29 | 0 | 0 | 0 | 0 |
| Intelligence | 20 | 0 | 0 | 0 | 0 |
| Moderation | 2 | 0 | 0 | 0 | 0 |
| Operations | 6 | 0 | 0 | 0 | 0 |

## Production conclusions

- The running API and worker are the same OCI revision, `c7c46dfa3d85b89617de833723aab8f207f0ba94`; that revision differs from both the dirty canonical checkout HEAD and current `origin/main`.
- Source/runtime reconciliation is exact: 535 = 384 application routes + 151 automatic framework routes; there are no unexplained source-only or runtime-only application routes.
- The primary blocking risks are unsigned-but-trusted module releases, missing module artifacts/assets, implicit module permission grants, follower-only privacy without requests, legacy function/AI-stream ownership omissions, dead-lettered reaction notifications, non-operational AI/GAIA/Nodus paths, client-only link/poll composition, and media edge/durability gaps.
- No P0 was established without a safe authenticated acceptance harness. That is an evidence boundary, not proof that no P0 exists.

## What GreenField Is Missing

### Missing for Modula Native

- A profile modules surface, follow-request lifecycle, dedicated request/mention activity contracts, and real link/poll persistence. Evidence: capability matrix and gaps API-ATLAS-GAP-002/013.

### Missing for Social

- Private-profile approval semantics, stable pagination for Discover/activity, production notification delivery reliability, and a documented real-time/polling contract.

### Missing for Profiles

- Profile-link CRUD and one canonical owned-media path; raw public avatar/cover URLs remain a competing model.

### Missing for Posts/Media

- Explicit link/poll contracts, aligned public upload limits, scheduled orphan/expired-file cleanup, and host-loss recovery/object replication.

### Missing for Product Hub

- Complete immutable package/artwork bytes, production artwork, and automated signed ingestion.

### Missing for Modules

- Required publisher signatures, fail-closed recorded permission grants, complete historical descriptors, and removal of Vault-specific branches.

### Missing for Third-Party Module Developers

- Enabled community/remote execution, working source synchronization, signed release ceremony and a fully generic governed action/function path.

### Missing for GAIA/AKI/AGI

- An operational planner/provider and production mission acceptance. AKI/Governor/command enforcement exists but production state is empty.

### Missing for Nodus Integration

- A local/offline Nodus handshake, capability discovery, proposal/approval and ledger synchronization contract.

### Missing for Security

- Production cross-user acceptance, account scoping on legacy function and AI-stream mutations, schema-declared boundaries, signature-required trust and uniform private-resource not-found semantics.

### Missing for Production Operations

- Worker container health, storage readiness/recovery, end-to-end correlation/metrics, and resolved dead letters.

### Missing for Developer Experience

- Canonical OpenAPI schemas, deterministic typed clients, explicit route deprecations and runtime SQL-to-route tracing in a disposable harness.

Every item above is expanded with evidence, impact, dependency and verification in `11-gap-register.md` and `12-remediation-roadmap.md`.

## Existing GreenField Capabilities Not Currently Used

- Complete passkey/TOTP/recovery/session security APIs, developer/build coordination, module installation descriptors, generic verified MPS ModuleHost execution, and governed intelligence mission routes exist beyond current observed client usage.
- 204 registered routes have no statically observed product-client caller; 144 are test-observed without a product-client caller. Per-route evidence is in `api-atlas.json`.
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
