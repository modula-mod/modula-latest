# Module Platform Map

## Operational flow

Publisher manifest/package → validation → release tables → integrity/signature/trust → artifact/artwork → install plan/descriptor → generic ModuleHost frontend → runtime authorization → record/action services → PostgreSQL.

The generic host is real: `src/features/modules/runtime/module-host.tsx:16` fetches the verified MPS frontend, resolves declarative or host-contribution mode, adapts it and renders it. Product-specific branches still exist around that host and are listed below.

## Production state

| Surface | Observed production truth |
| --- | --- |
| Releases | 14 total; 12 published; 12/12 published unsigned |
| Signing | 0 publisher keys, 0 signatures, 14 integrity rows |
| Artifacts | 2/14 release package blobs; 6 total release asset blobs |
| Artwork | 10/17 retrievable; 17 development-only |
| Frontends | 8 verified: declarative=4, host-contribution=4 |
| Install plans | 36 total; 6 carry descriptor and digest |
| Installations | failed=1, enabled=13, removed=4, disabled=2, uninstalled=3, installedDisabled=2 |
| Permissions | 15 active installations; 2 without a review row |
| Ingestion | 0 sources (0 enabled); GitHub automation disabled; historical runs {"completed":2} |

## Release integrity and trust

- Ed25519 cryptographic verification is implemented in `services/greenfield-api/src/modules/release-signing.ts:207` and invoked by `release-service.ts:441` when signing material exists.
- Current policy explicitly classifies an unsigned release as trusted/verified (`registry-trust-service.ts:109`, `:127`). Therefore schema validation is not the problem: production policy and absent signatures are.
- A live Vault Notes release artifact and icon were retrieved and SHA-256 matched. A declared unavailable AI module asset returned 404 as metadata predicted. These probes prove the delivery mechanisms for present blobs, not completeness.

## Install descriptor and installed-state correctness

The descriptor service (`install-descriptor-service.ts:14`, `:77`) returns module/publisher/installation IDs, release/version/state, manifest, package artifact digest/ref, verified frontend digest/mode/ref, requested/granted permissions, compatibility, trust, issue time and descriptor digest. Production keys exactly match that contract.

Historical `removed` and `uninstalled` rows are excluded by centralized active-status logic (`installation-status.ts:1`) and runtime access checks. No stale historical row bug was reproduced. A distinct security gap remains: `runtime-access.ts:71` falls back to all manifest permissions if a review row is absent; 2 active production installations are in that state.

## Runtime, records and functions

- Record create/read/update/delete/list/filter/sort/cursor paths are registered under module-scoped routes. `record-service.ts:42`, `:98`, `:216` validates schema and scopes SQL to account + installation + module collection.
- `runtime-access.ts:24` verifies authenticated account, active installation, release and permission before record/function work.
- Sensitive fields and reference validation flow through declared schema. Module settings and action/function routes share installation context.
- Remote/community functions are disabled in production. Current governed action execution reaches only the Vault record query/create boundary.

## Publisher, ingestion and administration

Publisher/developer release, build, registry administration, source sync, verification and publication APIs exist. GitHub synchronization code is substantial, but it is not operational: production has no configured source, worker ingestion is off and sync is disabled.

## Special cases outside generic platform infrastructure

- Vault-only intelligence action boundary: `services/greenfield-api/src/intelligence/action-boundary.ts:8`.
- Vault-specific GAIA fixture actions: `packages/intelligence-governance/src/gaia.ts:45`.
- Vault product AI action service: `services/greenfield-api/src/ai/product-action-service.ts:23`.
- Vault search subscribers/projector, Board screen branches, composer tool routing and repository/presentation fallbacks.

The canonical direction is the existing verified generic ModuleHost plus manifest/schema/action/projector declarations; these branches should not be mistaken for proof that generic hosting is absent.

## Security matrix

| Control | Implemented | Production caveat |
| --- | --- | --- |
| Publisher trust | publisher and key schemas exist | no production publisher signing key |
| Package/frontend digests | integrity and live digest checks | most package blobs absent |
| Release signature | real Ed25519 verify | all published releases unsigned yet trusted |
| Install grant | review and descriptor tables | missing review falls back to manifest permissions |
| Account/module isolation | scoped runtime access and record SQL | production cross-user live test not run |
| Workspace isolation | workspace-aware APIs where declared | not universal; per-route matrix is authoritative |
| Outbound/filesystem policy | remote/community execution disabled | no general sandbox policy exercised |
