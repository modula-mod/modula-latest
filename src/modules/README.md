# Modules

The main application contains the module host.

- Actual modules are external packages or GitHub-backed repositories.
- Module implementation must not be hardcoded into the host application.
- Modules register routes through approved contracts.
- Modules register settings through manifests.
- Modules receive design tokens from the host.
- Modules receive namespaced storage.
- Modules run behind error boundaries.
- Modules declare permissions.
- Modules cannot import private host internals.
- The host must remain launchable when every optional module is disabled.

Do not implement dynamic code fetching during Phase 0.
Do not create Vault Notes, Tasks, or CRM yet.
