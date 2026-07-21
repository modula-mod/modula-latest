# Greenfield Extension Kernel

The extension kernel is the shared substrate for modules, tools, functions, widgets, plugins, connectors, and bridges. Phase 7A keeps using the existing extension identity tables and adds module-specific release, provenance, integrity, permission-review, settings, quarantine, and revocation layers.

## Shared Identity

Modules are extension subtypes. Installation identity remains `greenfield_extension_installations`; Phase 7A does not create a second install table. Module releases map to immutable `greenfield_extension_versions`.

## Lifecycle

Allowed module states are centrally encoded in `@modula/greenfield-module-registry-contracts`:

`notInstalled -> resolving -> permissionReview -> installing -> installedDisabled -> enabling -> enabled`

Disable, update, quarantine, and removal transitions are validated before route handlers enqueue worker jobs.

## Contributions

Module releases can contribute routes, profile tabs, board surfaces, settings, schemas, tools, functions, widgets, plugins, connectors, jobs, and events. IDs must be namespaced under the module ID. Worker registration updates declarative contributions and keeps executable function contracts disabled unless reviewed handlers exist.

## Failure Isolation

Worker jobs are leased, retried, and dead-lettered. Module failures record lifecycle/audit state and must not crash API readiness, host startup, or unrelated Greenfield records.
