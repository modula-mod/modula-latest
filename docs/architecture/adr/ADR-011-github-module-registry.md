# ADR-011 - GitHub Module Registry

## Status

Accepted for Phase 7A.

## Context

First-party and future reviewed modules need source provenance. GitHub is the initial source reference, but Greenfield readiness must not depend on GitHub availability.

## Decision

Represent module source as repository, full commit SHA, manifest path, optional release tag, optional release asset name, fetch metadata, and integrity hashes. Manual trusted-checkout import is enabled through `pnpm registry:import-module --path ... --commit ...`.

Automatic private GitHub sync is documented but disabled in Phase 7A. Personal access tokens are not permanent infrastructure.

## Consequences

- `main`, `master`, `latest`, and `HEAD` are never immutable source identifiers.
- Registry imports validate the checked-out Git repository and never execute module code.
- Greenfield API readiness does not require GitHub to be reachable.
