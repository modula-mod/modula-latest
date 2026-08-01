# Module Standard 2.0 Runtime

Status: Phase 7E Block 13 Checkpoint B.

Standard 2.0 declarations are accepted only when the host can state their runtime support level honestly. The source of truth is:

- `packages/greenfield-module-manifest/src/runtime-support.ts`
- `services/greenfield-api/src/modules/manifest-normalizer.ts`

The support registry classifies every Standard 2.0 section as one of:

- `SUPPORTED`
- `PARTIALLY_SUPPORTED`
- `DECLARATIVE_ONLY`
- `UNSUPPORTED`
- `DEPRECATED`

Validator acceptance is not the same as runtime support. Product Hub must display accepted-but-not-operational sections through registry metadata before installation.

The normalizer converts Greenfield v1 and Standard 2.0 manifests into `NormalizedModuleManifest`. Legacy manifests remain valid and are normalized into the compatible runtime model:

- Standard 1.0 manifests remain valid.
- Standard 1.1 manifests remain valid.
- Standard 1.2 manifests remain valid.
- Standard 2.0 fields are opt-in.
- A Standard 1.x manifest is normalized into the compatible runtime model.

The normalized checksum uses the release record or original manifest integrity checksum. It is not derived from normalized JSON.

Unsupported or partial declarations are carried as diagnostics. They are metadata until a later Block 13 checkpoint implements the matching runtime capability, service fabric, hook engine, lifecycle state machine, permission grant model, storage allocator, job runtime, or UI contribution runtime.
