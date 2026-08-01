# Module Standard Package Consumption

Phase 7E Block 6 started with the main application consuming Modula Module Standard 1.0 through local `file:../modula-mod/modula-module-standard/...` dependencies. Block 10 advances the development target to Standard 1.2 so provider-neutral AI product actions are owned by the external Standard repository. This remains development-only. It preserves fast local iteration while the Standard, validators, SDK and reference modules are still evolving together, but it is not an immutable production dependency.

## Current Development Links

The main app currently consumes these local Standard 1.2 packages:

- `@modula/module-standard`
- `@modula/module-validator`
- `@modula/module-sdk`
- `@modula/create-module`
- `@modula/module-testing`
- `@modula/module-fixtures`

The source location is `/home/andrei/modula-mod/modula-module-standard`. The accepted Standard 1.2 release identity is:

- release tag: `mms-v1.2.0`
- release commit: recorded in the Module Standard 1.2 release provenance and tag
- required package version: `1.2.0`
- contract addition: provider-neutral AI product actions

## Production Requirement

Production deployments must not depend on a mutable filesystem path. Before production deployment, the main app must consume immutable Standard packages by one of these approved forms:

- checksum-pinned package tarballs;
- Git release artifacts addressed by tag and checksum;
- registry packages locked by exact version, integrity and lockfile provenance.

The expected package names remain the same as the development links. The migration changes only package source and integrity metadata, not imports or Standard APIs.

## Checksum Strategy

Every production artifact must record:

- package name;
- package version;
- source repository;
- release tag;
- release commit SHA;
- SHA-256 checksum of the package artifact;
- lockfile integrity, when registry-backed;
- validator output from `pnpm verify` in the Standard repository.

The package checksum must be calculated from the immutable artifact that production installs, not from a mutable checkout. Any checksum mismatch must fail closed before install, build, publish, or deployment proceeds.

## Migration Path

1. Build and verify the Standard repository at `mms-v1.2.0`.
2. Publish or attach immutable package artifacts for the six Standard packages.
3. Replace the main app `file:` specifiers with exact immutable package references.
4. Refresh `pnpm-lock.yaml` and record artifact checksums in release evidence.
5. Run the existing Phase 7E gates:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm verify:phase7e-module-standard`
   - `pnpm verify:phase7e-module-validator`
   - `pnpm verify:phase7e-module-sdk`
   - `pnpm verify:phase7e-module-security`
6. Block production deployment if any package cannot be fetched, verified, or matched to the recorded Standard release commit.

## Fail-Closed Behaviour

If an external Standard package is unavailable, mutable, unsigned where signing is required, or checksum-mismatched, the main app must fail closed:

- module release publishing is blocked;
- module release import is rejected;
- module installation is rejected;
- module activation is rejected;
- production build and deployment evidence cannot be marked ready.

Local `file:` links remain acceptable only for Phase 7E development and verifier work. Block 6 must preserve this workflow while producing immutable Vault Notes release metadata that can later be consumed without branch or filesystem identity.

## Vault Notes 1.1 Reference Artifact

Vault Notes 1.1 proves the same transition pattern for an external module:

- repository: `modula-mod/modula-vault-notes`;
- release tag: `vault-notes-v1.1.0`;
- release commit: recorded in the release provenance and tag;
- package artifact: `modula-vault-notes-1.1.0.tgz`;
- package checksum: recorded in `release/vault-notes-v1.1.0.provenance.json`;
- Standard tag: `mms-v1.2.0`;
- Standard commit: recorded in the release provenance and tag.
