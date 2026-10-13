# MODULE-DISTRIBUTION-03 preimplementation audit matrix

Date: 2026-10-13
Repository: `modula-mod/modula-latest`
Branch: `phase-module-distribution-03`
Baseline: `c6c907549a95c53f612d72fe89638e8222a97c69`
Production migration: `071_module_record_search_projection`

This is an observation-first audit of the accepted MODULE-PLATFORM-02 baseline. It records the state before MODULE-DISTRIBUTION-03 implementation. `PARTIAL` means a real implementation exists but does not yet satisfy the distribution protocol; `SPECIAL-CASED` means the behavior is tied to a legacy or fixture path rather than a generic module contract.

| Surface | Classification | Baseline evidence and gap |
| --- | --- | --- |
| Module registry | IMPLEMENTED | Registry module/product/version APIs, trust filtering, presentation metadata, and Product Hub consumers are present. It does not expose a canonical immutable release descriptor. |
| Release records | IMPLEMENTED | Releases have deterministic IDs, manifest/integrity facts, lifecycle state, provenance linkage, and immutable-state checks. Multiple historical published versions remain visible by design. |
| Release signatures | PARTIAL | Ed25519 verification and versioned canonical statement `modula.publisher-release.v1` exist. Compatibility and permissions are bound through the signed manifest digest, but the distribution-facing descriptor and explicit signature-payload version are absent. |
| Signing keys | IMPLEMENTED | Public-key registry, publisher authorization, expiry, and revocation are implemented. Private signing material is rejected and is not required by the VPS. |
| Provenance | IMPLEMENTED | Repository, immutable commit, tag, release identity, artifact digest, and provenance document verification exist in the GitHub ingestion service. |
| Artifact storage | PARTIAL | SHA-256-addressed immutable blobs and an immutability trigger exist. Releases/assets reference blobs indirectly; there is no generic release-artifact inventory, and exact frontend bytes are not retained as a downloadable blob. |
| Artifact serving | PARTIAL | Package and artwork routes return immutable cache headers and ETags. Package conditional requests, digest-addressed URLs, Range/206, resumable delivery, generic inventory, and explicit access classes are missing. |
| Frontend serving | PARTIAL | Installed/enabled users can obtain a parsed frontend projection. The exact signed frontend bytes cannot be independently downloaded and checked against the signed frontend digest. |
| Artwork serving | PARTIAL | Registry-owned icon/cover assets are served when their blobs exist. Some historical presentation metadata refers to artwork whose blob is absent; screenshots are not modeled generically. |
| Installation descriptor | PARTIAL | A launch descriptor and descriptor hash exist, but immutable release facts, mutable installation state, compatibility, and permissions are combined in one object. Conditional ETag refresh is missing. |
| Install routes | PARTIAL | Preview, install, idempotency, trust, compatibility, and release-bound permission reviews exist. Install does not return the new three-part distribution contract and does not consistently stop before mutation when review is required. |
| Update routes | PARTIAL | Version preview/update paths calculate added/removed/retained permissions and data-schema warnings. Canonical update plans, descriptor-revision concurrency, channel/version-lock policy, artifact delta, and an account update feed are missing. |
| Downgrade/version switch | PARTIAL | Governed version switching reuses trust/compatibility/permission checks and permits only the controlled untrusted-to-trusted legacy transition. Explicit rollback eligibility and data-compatibility metadata are missing. |
| Uninstall | IMPLEMENTED | Uninstall is account-scoped, idempotent, audited, and separates keep-data/export-delete/delete-data policies. Native cache deletion is correctly outside server authority. |
| Reinstall | PARTIAL | Removed installations can re-enter installation flows and module data policy is distinct, but install/uninstall/reinstall acceptance is not a dedicated distribution regression suite. |
| Product Hub | IMPLEMENTED | Product Hub consumes registry product APIs rather than product-specific shell metadata. Distribution size, complete artifact inventory, structured compatibility, and update policy are absent. |
| GitHub ingestion API | PARTIAL | Exact tag/release/commit identity, bounded redirects, digest checks, manifests, signature, publisher authorization, and provenance are checked. Production sync is disabled and packages accepted above the 25 MiB blob ceiling are not retained for distribution. |
| Worker ingestion | SPECIAL-CASED | The worker release-sync handler is a placeholder and fails closed if enabled. It is not a trustworthy automatic publisher. |
| Publish state machine | IMPLEMENTED | Draft, pending review, verified, published, quarantined, revoked, and superseded states exist; publication is trust-gated and immutable releases cannot be replaced. |
| Duplicate version protection | IMPLEMENTED | A second `moduleId + version` identity is rejected; MPS ingestion also rejects different bytes for an existing identity. |
| SemVer | BROKEN | Current hand-rolled version ordering does not correctly implement all prerelease precedence (including `2.0.0-rc.1`). |
| Host-version compatibility | PARTIAL | Minimum GreenField/Modula ranges and protocol/platform checks exist. Failure output is not consistently `required`/`actual` structured data, and a generic client message currently hides the reason. |
| Module SDK compatibility | MISSING | No explicit, meaningful Module SDK contract is distributed or evaluated. |
| Product UI compatibility | PARTIAL | MP02 defines Product UI schema `1.0.0`, but releases do not expose/evaluate it in the distribution contract. |
| Required host capabilities | PARTIAL | MP02 has portable semantic required-capability negotiation. It is not incorporated into install/update distribution plans. |
| Optional host capabilities | PARTIAL | MP02 models optional capabilities and declared fallbacks. Distribution plans do not expose the evaluated result. |
| Permission review | IMPLEMENTED | Reviews are account-, installation-, and exact-release-bound; missing review means zero effective grants. Install/update plan semantics and normalized review-required errors need tightening. |
| Release revocation | PARTIAL | Revoked releases fail trust and are excluded from normal targets. Cached descriptors/update feeds do not yet provide a generic invalidation path or safe-target metadata. |
| Signer revocation | IMPLEMENTED | Revoked signing keys invalidate release trust and prevent target eligibility. Distribution-descriptor propagation tests are missing. |
| Release channels | PARTIAL | Release channel is present in MPS material but is not a normalized release/install policy and stable selection can still encounter non-stable versions. |
| Version lock | MISSING | Installation policy does not support automatic stable, follow-channel, locked version, or manual update semantics. |
| Rollback relationship | MISSING | The server does not publish an explicit eligible rollback predecessor. A lower version is not automatically safe. |
| Activation diagnostics | MISSING | No bounded, non-authoritative downloaded/verified/activated/failed diagnostic intake exists. This is optional for the core protocol. |
| Module data migration contract | PARTIAL | Version preview carries generic schema compatibility warnings. There is no arbitrary package migration execution, which is the safe default; explicit supported transitions are not modeled. |
| Archive validation | PARTIAL | Tar-gzip validation rejects traversal, non-regular entries, links/devices, duplicate paths, excessive entries, and decompression overflow. Explicit forbidden native/executable payload policy is missing. |
| Size limits | PARTIAL | Existing limits are 50 MiB compressed package, 200 MiB expanded archive, 25 MiB individual blob, and 1 MiB frontend. The package/blob mismatch prevents complete storage of a valid package. Production packages currently top out near 2.1 MiB. |
| Download authorization | PARTIAL | Published package/artwork is public and frontend projection is installation-scoped, but this policy is implicit. Generic artifacts lack explicit public versus installation-scoped classification. |
| Range/resumption | MISSING | Artifact responses do not advertise or implement byte ranges; clients must restart downloads. |
| Cache headers | PARTIAL | Immutable package/artwork caching exists. Package `If-None-Match`/304 is absent, and mutable installation/update descriptors lack revision ETags. |
| Update feed | MISSING | Installed modules must be checked individually; there is no account-scoped batch eligibility feed. |
| Concurrent update safety | PARTIAL | Database row locks prevent split writes, but clients cannot send an expected descriptor revision and receive a deterministic stale-plan error. |
| Distribution audit logging | PARTIAL | Publish/revoke/install/update/rollback-like version switches/uninstall/reviews are audited. Artifact authorization rejection is not recorded. |
| Rate limiting | PARTIAL | Shared read/write limits apply, but immutable artifact bandwidth has no distribution-specific policy. |
| Artifact garbage collection | PARTIAL | Immutable blobs are retained and no destructive GC runs. Reference-safe orphan detection/dry-run reporting is missing. |
| Atlas | IMPLEMENTED | Accepted baseline is 616 routes (437 application, 179 framework), with source-only `0` and runtime-only `0`; candidate Atlas must be regenerated after route changes. |

## Baseline invariants

- Production API, worker, checkout, and `origin/main` all identify `c6c907549a95c53f612d72fe89638e8222a97c69`.
- Live and ready probes return HTTP 200; worker heartbeat is current.
- Active untrusted installations: `0`.
- Vault Notes 1.8 has a verified active signer and stored package artifact.
- Vault Notes 0.2 remains unsigned historical material with no distributable package and is not a valid new-install/update/rollback target.
- Vault Notes 2.0.0-rc.1 remains unpublished and must not be signed, registered, or installed in production.

## Implementation decisions frozen by this audit

1. Keep the existing registry, lifecycle, signing, trust, installation, and Product Hub systems; add a distribution layer rather than replacing them.
2. Add distinct `ReleaseDescriptor`, `InstallationDescriptor`, and `UpdatePlan` contracts, plus install plan and batch update feed contracts.
3. Retain signature schema v1. Its signed manifest/product-manifest digests bind compatibility, permissions, channel, and frontend facts; expose this binding explicitly without invalidating historical signed releases.
4. Add a generic artifact inventory backed by immutable SHA-256 blobs. Exact signed frontend bytes become a first-class artifact.
5. Serve blobs by SHA-256 with explicit access class, ETag/304, immutable caching, and bounded single-range 206 support. Keep legacy package/artwork URLs for compatibility.
6. Model channel and installation update policy explicitly. Stable is the default and never silently follows beta, rc, or dev.
7. Compute rollback eligibility from trusted release history plus compatibility/data-policy checks; never infer it as `version - 1`.
8. Keep client `ACTIVE`, `PREVIOUS_GOOD`, and `STAGED` state outside GreenField. Server activation reports, if added, remain diagnostic only.
9. Do not enable production GitHub/worker ingestion until its operational credentials and runbook are accepted; ingestion remains fail-closed and private-key-free.
10. Never place product-specific UI or Native implementation in this phase.
