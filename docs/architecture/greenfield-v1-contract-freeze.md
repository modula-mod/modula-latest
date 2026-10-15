# GreenField v1 contract freeze

Status: candidate freeze. The freeze becomes effective only when the final CI,
deployment, production smoke, integrity, backup, and clean-restore gates pass and
the immutable freeze tag is created.

## Compatibility policy

All public v1 behavior is stable. Removing or renaming a field, changing a
required field to a different meaning, making an optional field required,
changing an HTTP status or error code, weakening authorization, changing cursor
semantics, or changing digest/signature inputs is breaking. Breaking behavior
requires a versioned endpoint or contract, a migration path, an overlap window,
and explicit consumer acceptance. Additive optional fields are permitted when
old clients can ignore them. Security fixes may reject behavior that was never
authorized by the contract, but must be documented.

Deprecations require: an owner, replacement, first-deprecated version, known
callers, telemetry or another removal proof, and a removal trigger. No public
behavior may silently change. Compatibility aliases are input-only unless a
contract explicitly says otherwise; servers emit canonical values.

## Canonical contracts

| Contract | Version | Stability | Breaking-change and deprecation rule |
|---|---:|---|---|
| API envelope and request correlation | 1.0.0 | stable | Version endpoint/envelope before incompatible shape or status changes. |
| Authentication, refresh, revocation, and session concurrency | 1.0.0 | stable | Token and session weakening is forbidden; migrations require overlap and revocation proof. |
| Module identity and compatibility aliases | 1.0.0 | stable | Canonical identity never changes in place; bounded aliases are input compatibility only. |
| Release trust, signer state, provenance, and revocation | 1.0.0 | stable-security | Digest/signature inputs are immutable; trust may fail closed after compromise. |
| Permission request and review | 1.0.0 | stable-security | New permissions require explicit review; a manifest is never an authorization grant. |
| Module records, mutation IDs, and optimistic revisions | 1.0.0 | stable | DTO or conflict changes require a versioned record contract. |
| Record references and reverse references | 1.0.0 | stable | Visibility filtering cannot be relaxed; field-path meaning is stable. |
| Immutable history and restore-as-new-revision | 1.0.0 | stable | Existing revisions are never rewritten to simulate history. |
| Signed cursor sync, tombstones, and visibility loss | 1.0.0 | stable | Cursor encoding is opaque; semantics change only under a new cursor version. |
| Record-media bindings and asset authorization | 1.0.0 | stable-security | Asset identifiers never confer access by themselves. |
| Record sharing, expiry, edit grants, and revocation | 1.0.0 | stable-security | Authorization can tighten immediately; permission meaning cannot silently broaden. |
| Module settings schemas and account/installation values | 1.0.0 | stable | `settings:read` and `settings:write` remain separately reviewable. |
| Governed functions and host request lifecycle | 1.0.0 | stable | Execution mode, schema, timeout, and idempotency changes require a new function version. |
| Inter-module actions and action lineage | 1.0.0 | stable-security | Action version, source allow-list, schema, lineage, cycle, and budget semantics are frozen. |
| Generic module search projection | 1.0.0 | stable-security | Search is a candidate generator; authoritative access is always rechecked. |
| Intelligence policy (`localOnly`, `preferLocal`, `allowRemote`) | 1.0.0 | stable-privacy | No policy may gain a less-private fallback in place. |
| Semantic Product UI | 1.0.0 | stable | Nodes/capabilities are versioned; unsupported required capability fails explicitly. |
| Host capability discovery | 1.0.0 | stable | Capability references are `id@version`; absence is not silently emulated. |
| Distribution descriptors and plans | 1.0.0 | stable-security | Reasons, trust facts, permissions, and artifact facts remain explicit. |
| Install/update and permission-delta plans | 1.0.0 | stable-security | Plans do not mutate; execution requires exact plan/release identity. |
| Artifact authorization, digest, range, and cache behavior | 1.0.0 | stable-security | Immutable digest identity and authorization-before-bytes cannot weaken. |
| Compatibility evaluation | 1.0.0 | stable | Reason codes and host/product version bounds are public behavior. |
| Release/signer revocation | 1.0.0 | stable-security | Revocation is immediate for new install/update/runtime authorization. |
| Rollback and forward-database compatibility | 1.0.0 | stable-operations | Lossy schema rollback uses verified backup restore, never fabricated down migration. |

Canonical implementation documents are
`module-platform-02-contract.md`, `module-platform-02b-contract-addendum.md`,
`module-distribution-03.md`, and `module-distribution-03-native-handoff.md`.
The versioned Native examples live under
`fixtures/greenfield-v1-native/1.0.0`.

## Retry contract

GET/HEAD are safe to retry. A mutation is safe to retry only with the same
mutation/idempotency ID and identical canonical payload. Reuse with a different
payload returns `MUTATION_REUSE_CONFLICT`. `REVISION_CONFLICT` requires the
client to refetch or resolve; it is not an automatic blind retry. `429` includes
`Retry-After`; `503` is retryable only when the operation itself is idempotent.

