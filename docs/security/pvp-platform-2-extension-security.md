# PVP Platform Phase 2 extension security

## Trust boundaries

Registry metadata is not executable authority. Greenfield separately verifies
release provenance, target compatibility, extension-point declaration,
capability approval, resource ownership, service policy, and lifecycle state.

## Hard rules

| Rule | Enforcement |
| --- | --- |
| Direct cross-product database access = 0 | Target-owned service/repository is the only record path; extensions receive scoped resources. |
| Raw Greenfield bearer forwarding = 0 | Existing token exchange issues a scoped assertion; database check fixes the flag to false. |
| Undeclared capability access = 0 | Broker requires a declared grant for every invocation capability. |
| Arbitrary service URL execution = 0 | Registry service binding plus existing TLS/DNS/origin/SSRF policy. |
| Unsigned/unverified release installation = 0 | Published immutable release and checksum verification precede installation. |
| Checksum bypass = 0 | Mismatch changes release to `quarantined`; no contribution is registered. |
| Cross-account access = 0 | Every graph/grant/resource/job/event query carries `account_id`; foreign resources are `NOT_FOUND`. |
| Dependency cycle acceptance = 0 | Bounded DFS returns `DEPENDENCY_CYCLE` and aborts. |
| Remote arbitrary JavaScript = 0 | Approved declarative descriptors only; no JSX, HTML, iframe/WebView, eval, or remote JS contract. |
| Undeclared UI contribution = 0 | Contribution must match a target-owned point and accepted kind. |
| Core crash caused by add-on = 0 | Per-contribution host boundaries remove the failed contribution, not the module. |

## Provenance

An install identifies repository, release tag, exact commit, manifest checksum,
artifact checksum, publisher, Standard version, and minimum host. It never
means “download main”. A checksum mismatch is quarantined before graph,
capability, or UI registration.

## Secrets and logs

Provider credentials remain Greenfield-authorised service configuration. Raw
tokens, provider secrets, note content, prompts, recordings, audio, transcripts,
and private record bodies are prohibited from audit/job operational metadata.
Only IDs, hashes, timing, lifecycle state, and safe error codes are recorded.

## High-risk connectors

Connectors are subject to registry publisher policy, explicit capabilities,
credential brokerage, URL/DNS validation, SSRF controls, audit, and revocation.
No connector receives unrestricted provider credentials from a module.

## Verification

`services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts` covers
cycle rejection, checksum quarantine, capability escalation denial,
cross-account resource/event isolation, raw-bearer absence, contribution
enable/disable boundaries, declared background actions, bounded idempotent
timeout retry with non-idempotent fail-fast behavior, and redacted jobs.
`scripts/verify-pvp-platform-2.mjs` additionally scans product/runtime sources
for prohibited executable and product-hardcoding patterns.
