# Module Boundary

See also `src/modules/README.md`.

## Host responsibilities

- Own application startup and shell
- Provide design tokens to modules
- Provide namespaced storage
- Enforce error boundaries around modules
- Remain launchable when every optional module is disabled

## Module responsibilities

- Ship as external packages or GitHub-backed repositories
- Register routes through approved contracts
- Register settings through manifests
- Declare permissions
- Avoid importing private host internals

## Phase 0

Documentation and folder placeholders only. No dynamic code fetching. No Vault Notes, Tasks, or CRM implementations.
