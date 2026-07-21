# ADR-012 - Module Release Trust And Provenance

## Status

Accepted for Phase 7A.

## Context

Public source visibility is not permission to install or execute code. Modula needs release trust, licence evidence, checksums, signatures, quarantine, and revocation before marketplace/module installation can be credible.

## Decision

Persist publisher status, namespace ownership, trust level, licence evidence, source commit, manifest checksum, release checksum, optional signature metadata, quarantine, and revocation state for every module release.

Licence states are `firstParty`, `verified`, `declared`, `founderOverride`, `unknown`, and `denied`. Unknown blocks installation/execution; denied rejects release publication.

## Consequences

- Published releases cannot be edited in place.
- Revoked releases must not re-enter availability through registry resync.
- Checksum or signature mismatch quarantines release availability.
- Founder override is explicit evidence, not an implicit bypass.
