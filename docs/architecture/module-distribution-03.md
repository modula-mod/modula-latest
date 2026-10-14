# Module Distribution 03

## Authority and boundaries

GreenField is authoritative for release identity, publisher signatures, immutable artifact identity, provenance, compatibility, installation selection, reviewed grants, update eligibility, rollback eligibility, and revocation. Native is authoritative for local bytes and the `ACTIVE`, `PREVIOUS_GOOD`, and `STAGED` cache slots. A client success report is diagnostic evidence, never a source of release trust.

Downloaded products are declarative/JavaScript business packages executed through versioned Modula contracts. Release validation rejects native libraries, frameworks, object files, WebAssembly, application packages, Java bytecode, executable archive entries, path traversal, links/devices, duplicate archive paths, and native executable magic. This boundary does not by itself make an App Store compliance claim.

## Canonical contracts

The platform-neutral TypeScript contract is `packages/greenfield-module-registry-contracts/src/distribution.ts`.

- `ModuleReleaseDescriptor` is immutable release truth. It carries release/channel identity, manifest/package/frontend digests, Ed25519 evidence, artifact inventory, SDK/UI/capability requirements, requested permissions, provenance, and current revocation/trust truth.
- `ModuleInstallationDescriptor` is account-derived mutable launch state. It carries the selected release, enabled state, compatibility, exact-release permission review, effective grants, update policy, launch eligibility, and a deterministic descriptor revision. It never returns an account identifier.
- `ModuleInstallPlan` previews an install without mutation.
- `ModuleUpdatePlan` compares one installation and target: permission delta, target artifact delta, compatibility, schema direction, rollback candidate, blockers, and the expected descriptor revision.
- `ModuleUpdateFeed` provides one conditional account request for all installed products.

The v1 Ed25519 statement remains `modula.publisher-release.v1` (`schemaVersion: 1.0.0`, descriptor `signaturePayloadVersion: 1`). It directly binds product/module ID, version, publisher, repository, exact source SHA/tag, package digest, normalized adapter-manifest digest, exact product-manifest digest, exact frontend digest, and key ID. Permissions, host compatibility, Module SDK metadata, and adapter facts are bound by the signed adapter-manifest digest; Product UI capability requirements, channel, presentation declarations, and frontend facts are bound by the signed product/frontend digests. Schema/static bytes are also transitively bound by the signed package digest. A future signing scope must introduce another statement type/payload version rather than guessing historical semantics.

## HTTP protocol

| Operation | Route | Cache/auth policy |
| --- | --- | --- |
| Release descriptor | `GET /v1/registry/releases/:releaseId/descriptor` | Public metadata; trust/revocation is live, so clients refresh it. |
| Artifact | `GET /v1/registry/artifacts/:sha256` | Public for artwork; bearer plus an owned installation of that module for executable/offline artifacts. |
| Install plan | `POST /v1/modules/:moduleId/install-plan` | Authenticated, no mutation. |
| Install | `POST /v1/modules/:moduleId/install` | Authenticated and idempotent; canonical descriptor is returned for distribution-ready releases. |
| Installation descriptor | `GET /v1/modules/:moduleId/installation-descriptor` | `ETag`, `If-None-Match`, `304`, `private, no-cache, must-revalidate`. |
| Update feed | `GET /v1/modules/updates` | One account request; `ETag`/`304`; current trust is explicit. |
| Update plan | `POST /v1/modules/:moduleId/update-plan` | Authenticated, no mutation. |
| Update | `POST /v1/modules/:moduleId/update` | Idempotency key and optional expected descriptor revision. |
| Policy | `PATCH /v1/modules/installations/:installationId/update-policy` | `automaticStable`, `followChannel`, `lockedVersion`, or `manual`. |
| Rollback | `POST /v1/modules/:moduleId/rollback` | Exact eligible candidate plus expected descriptor revision and idempotency key. |

The old release-ID artifact route is retained as an authenticated, deprecated alias and advertises the digest route as its successor. It no longer makes executable bytes public.

Artifact responses use a registry-controlled MIME type, exact `Content-Length`, `X-Content-Type-Options: nosniff`, SHA-256 `ETag`, digest header, safe content disposition, and immutable caching. Public artwork uses `public`; installation artifacts use `private`. The source-controlled production nginx location preserves that API-owned policy for both digest-addressed artifacts and release artwork instead of appending the catch-all `no-store` header. Single byte ranges return `206` and `Content-Range`; invalid/multiple/out-of-bounds ranges return `416`. A client may resume with `Range` and `If-Range`; without a matching ETag it restarts from the full response.

## Publication and ingestion

Automated GitHub ingestion requires an exact release tag, immutable 40-character source commit, digest-verified provenance sidecar and package, identity-consistent MPS/adapter/legacy manifests, validated archive contents, publisher authorization/key verification, and exact signed MPS/frontend facts. The verified package and all distribution bytes are stored before the release is published. Release channel is also fixed before publication.

The registry never needs a private signing key. Publisher/CI/KMS signs elsewhere; GreenField receives public key, statement evidence, signature, and bytes, then rebuilds and verifies the statement.

Published identity, version, publisher, manifest/package digests, source, product kind, channel, and manifest JSON are database-enforced immutable facts. Different bytes cannot replace an existing `moduleId + version`. Corrections are new releases.

The operator command `pnpm --filter @modula/greenfield-api registry:backfill-distribution-artifacts` is dry-run by default. `--apply` only rebuilds missing inventory from registry-held packages whose stored signature is verified; it does not download, sign, or delete anything. The orphan endpoint is also dry-run only: `GET /v1/admin/registry/artifacts/orphans`.

Current limits are based on observed production packages (largest about 2.1 MiB): 50 MiB compressed package, 200 MiB expanded archive, 25 MiB presentation asset, 1 MiB frontend contract, and 256 KiB per record schema. The headroom is deliberate; limits are enforcement boundaries, not target sizes.

## Compatibility and updates

Compatibility is structured and may report required/actual host marketing contract, Module SDK, Product UI contract, platform, and semantic host capabilities. Portable names such as `ui.graph`, `media.attachment-picker`, `share`, `intelligence.local`, and `biometrics` are used; platform-framework class names are not protocol facts. Required capability absence is incompatible. Optional absence does not block installation, and an optional declared fallback may be selected by the host.

Normal policy follows stable only. Beta, RC, and dev are never selected by an automatic-stable installation. Version ordering is SemVer, including prereleases; compatibility and rollback are never inferred from ordering alone.

Permission reviews are release-bound. Retained reviewed grants remain only where the exact contract permits, removals need no new review, and every new permission yields `PERMISSION_REVIEW_REQUIRED`. Review rows cannot be reused across a different signed release. Optimistic descriptor revision plus row locking makes concurrent transitions coherent.

Rollback candidate selection searches actual trusted published/superseded history. It rejects revoked/quarantined/untrusted/incompatible targets, permission uplift, and a target with known older/missing data schemas. `PREVIOUS_GOOD` remains local Native state.

Normalized plan/trust failures include `UNTRUSTED_RELEASE`, `INCOMPATIBLE_HOST`/structured compatibility reasons, `CAPABILITY_UNAVAILABLE`, `PERMISSION_REVIEW_REQUIRED`, `RELEASE_REVOKED`, `SIGNER_REVOKED`, `INSTALLATION_DISABLED` where lifecycle-enforced, `TARGET_NOT_FOUND`, and `REVISION_CONFLICT`.

## Revocation, retention, and rollout

A revoked release is excluded from new install, update, rollback, and artifact authorization. Existing installation/data rows are retained; descriptors and update feeds reveal the revoked trust state so Native can stop future activation and prefer a safe target. Signer revocation produces the same fail-closed distribution behavior and changes descriptor/update-feed revisions.

Immutable blobs referenced by any artifact mapping, release digest, presentation asset, published or installed release, rollback history, or audit/provenance retention are not garbage-collection candidates. Orphan discovery is report-only in this phase; no production mass deletion is authorized.

Percentage/ring rollout and rollout pause are compatible future policy layers over target selection, but are intentionally deferred. They must not weaken signature, compatibility, permission, or revocation gates.
