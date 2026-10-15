# Module Platform Map

## Operational flow

Publisher manifest/package → validation → release tables → integrity/signature/trust → artifact/artwork → install plan/descriptor → generic ModuleHost frontend → runtime authorization → record/action services → PostgreSQL.

The generic host is real: `src/features/modules/runtime/module-host.tsx:16` fetches the verified MPS frontend, resolves declarative or host-contribution mode, adapts it and renders it. Product-specific branches still exist around that host and are listed below.

## Production state

| Surface | Observed production truth |
| --- | --- |
| Releases | 41 total; 12 published; 7/12 published unsigned |
| Signing | 11 publisher keys, 34 signatures, 43 integrity rows |
| Artifacts | 26/41 release package blobs; 38 total release asset blobs |
| Artwork | 10/17 retrievable; 17 development-only |
| Frontends | 8 verified: declarative=4, host-contribution=4 |
| Install plans | 83 total; 53 carry descriptor and digest |
| Installations | failed=1, enabled=11, removed=17, disabled=1, uninstalled=3, installedDisabled=2 |
| Permissions | 12 active installations; 1 without a review row |
| Ingestion | 0 sources (0 enabled); GitHub automation disabled; historical runs {"completed":2} |

## Release integrity and trust

- Ed25519 cryptographic verification is implemented in `services/greenfield-api/src/modules/release-signing.ts:207` and invoked by `release-service.ts:441` when signing material exists.
- Production policy now rejects unsigned or invalid releases for executable transitions. 5 published releases have verified signatures; 7 historical published releases remain unsigned and untrusted. Missing artifact blobs are tracked separately from signature trust.
- A live Vault Notes release artifact and icon were retrieved and SHA-256 matched. A declared unavailable AI module asset returned 404 as metadata predicted. These probes prove the delivery mechanisms for present blobs, not completeness.

## Install descriptor and installed-state correctness

The descriptor service (`install-descriptor-service.ts:14`, `:77`) returns module/publisher/installation IDs, release/version/state, manifest, package artifact digest/ref, verified frontend digest/mode/ref, requested/granted permissions, compatibility, trust, issue time and descriptor digest. Production keys exactly match that contract.

Historical `removed` and `uninstalled` rows are excluded by centralized active-status logic (`installation-status.ts:1`) and runtime access checks. No stale historical row bug was reproduced. 1 active production installations have no permission review; the fail-closed runtime gives them zero implicit grants and requires explicit review for privileged operations.

### Missing permission-review inventory

This inventory excludes account and installation identifiers. It records only the module and authorization facts needed for remediation.

| Module ID | Requested permission classes | Requested permissions | Review row present | Effective authorization source |
| --- | --- | --- | --- | --- |
| `digital.modula.vault-notes.ai` | ai, notes | ai.context.private, ai.request, notes.actions.contribute, notes.editor.contribute, notes.read | false | no recorded grants (fail closed) |

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
| Publisher trust | first-party Ed25519 public key registered | offline private key remains on Mac |
| Package/frontend digests | integrity and live digest checks | most package blobs absent |
| Release signature | real Ed25519 verify enforced | historical unsigned releases remain untrusted |
| Install grant | review and descriptor tables | missing review grants nothing; user review still needed |
| Account/module isolation | scoped runtime access and record SQL | controlled cross-user production probe passed |
| Workspace isolation | workspace-aware APIs where declared | not universal; per-route matrix is authoritative |
| Outbound/filesystem policy | remote/community execution disabled | no general sandbox policy exercised |
