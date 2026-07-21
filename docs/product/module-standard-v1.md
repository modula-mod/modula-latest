# Greenfield Module Standard v1

## Identity

Module IDs are immutable reverse-domain identifiers:

- lowercase
- at least two namespace segments
- dot-separated
- letters, numbers, and hyphens inside segments
- no empty segments
- no version in the identifier
- maximum 160 characters

Reserved namespaces are `digital.modula`, `digital.greenfield`, `digital.dimon`, `modula`, `greenfield`, and `dimon`. Only first-party publishers may own them.

## Manifest

Manifest v1 is defined by `GreenfieldModuleManifestV1` and JSON Schema at:

- `packages/greenfield-module-manifest/src`
- `packages/greenfield-module-manifest/schemas/module-manifest.v1.schema.json`

It requires immutable GitHub source commit information, semver versions, semver compatibility ranges, bounded strings/arrays, known root fields, and namespaced contribution IDs.

## Release Model

Published releases are immutable. Corrections require a new version. Each release stores publisher, namespace ownership, source repository, exact commit, manifest path, manifest checksum, release checksum, optional Ed25519 signature fields, compatibility, licence state, trust level, publication timestamps, quarantine, and revocation state.

## Permissions

Permissions are declared with reasons and reviewed before install. DIMON permissions are reserved. Installation records approved permissions separately; installation does not imply every requested permission is granted.

## Execution Boundary

Allowed modes are `declarative`, `builtIn`, `backgroundJob`, and `remoteHttp`. Phase 7A enables declarative contributions and reviewed first-party handlers only. Remote HTTP and community execution are disabled by feature flags.
