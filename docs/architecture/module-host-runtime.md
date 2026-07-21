# Module Host Runtime

The host runtime consumes Greenfield registry and contribution APIs. Phase 7A deliberately does not change frontend or native paths after the captured baseline.

## Backend Contract

The Mac host should treat these APIs as authoritative:

- Catalogue and release detail: `/v1/registry/modules`
- Install preview and lifecycle: `/v1/modules/:moduleId/*`
- Settings schema and values: `/v1/modules/:moduleId/settings-schema`, `/v1/modules/:moduleId/settings`
- Contribution discovery: `/v1/modules/contributions`
- Tool/function registries: `/v1/tools`, `/v1/functions`

## Rendering Rules

The native host renders module surfaces from declared contributions. It does not import module repositories, execute GitHub code, run arbitrary JavaScript, or infer permissions from UI state.

Executable contributions require explicit enablement and reviewed handlers. Declarative Vault Notes functions are visible as contracts with executable flags disabled.

## Data Rules

Module records must use namespaced collections such as `module.digital.modula.vault-notes.note`. Access must enforce account/team ownership, module permission, collection permission, visibility, schema, revision, soft deletion, and export ownership.
