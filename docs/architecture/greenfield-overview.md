# Greenfield Overview

Greenfield is the production backend runtime for Modula's profile-first module platform. It owns accounts, repositories, records, extension catalogue state, module registry state, lifecycle jobs, audit events, and safe public API envelopes.

The **external product contract** is the Modula Product Standard (MPS 1.0).
The **platform protocol** is Greenfield Protocol `greenfield.v1`. The **module
profile** is Module Standard 2.1. See `docs/architecture/greenfield-product-standard.md`.

Phase 7A adds a module platform on top of the existing Greenfield extension kernel:

- Manifest v1 contracts live in `@modula/greenfield-module-manifest`.
- Registry API contracts live in `@modula/greenfield-module-registry-contracts`.
- Authoring helpers live in `@modula/greenfield-module-sdk`.
- Persistence lives in migration `009_phase7a_module_platform.sql`.
- Runtime routes live under `services/greenfield-api/src/modules`.
- Worker lifecycle handlers live under `services/greenfield-worker/src/modules`.

Greenfield remains ready without GitHub, AT Protocol, DIMON, or Vault Notes repository availability. Manual trusted-checkout import is enabled; automatic GitHub sync is disabled in Phase 7A.

## Runtime Flags

- `GREENFIELD_MODULE_REGISTRY_ENABLED=true`
- `GREENFIELD_MODULE_INSTALLATION_ENABLED=true`
- `GREENFIELD_MODULE_DECLARATIVE_CONTRIBUTIONS_ENABLED=true`
- `GREENFIELD_MODULE_FIRST_PARTY_EXECUTION_ENABLED=true`
- `GREENFIELD_MODULE_REMOTE_FUNCTIONS_ENABLED=false`
- `GREENFIELD_MODULE_COMMUNITY_EXECUTION_ENABLED=false`
- `GREENFIELD_MODULE_GITHUB_SYNC_ENABLED=false`
- `GREENFIELD_VAULT_NOTES_REFERENCE_ENABLED=true`
- `GREENFIELD_DIMON_ENABLED=false`

## Security Posture

The platform registers declarations and reviewed first-party handlers only. It does not evaluate module JavaScript, install packages dynamically, run GitHub source, accept module SQL, or load unreviewed native code.
