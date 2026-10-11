# MP02 Native and Product UI handoff

Status: contract handoff only. MP02 does not change Native source or claim that an unavailable renderer exists.

## ModuleHost responsibilities

The Native phase must consume the versioned `host.capabilities` descriptors from
`@modula/greenfield-module-ui-contracts`. A required unavailable capability
blocks the surface with `CAPABILITY_UNAVAILABLE`. An optional capability may use
only the fallback explicitly declared by the module; a host-advertised fallback
is never implicit.

ModuleHost must also provide:

- permission review for the exact trusted release before enabling data or actions;
- capability discovery with status, renderer, fallback hint and bounded constraints;
- a local-intelligence broker that routes `localOnly` to the on-device provider and never Greenfield;
- scope-bound incremental sync and conflict/tombstone presentation;
- an authorized media picker that returns bindable asset identity, not filesystem paths;
- semantic share actions that preserve record and module authorization;
- a native renderer for supported Product UI primitives and truthful unavailable status for the rest.

Biometrics, background work and secrets are exposed as `biometrics`,
`background-sync` and `secure-storage` capabilities. Module business logic must
not refer to Face ID, SwiftUI, UIKit, activities, intents or platform paths.

## iOS, Expo UI and Liquid Glass

The future iOS renderer maps semantics, not product-specific components:

| Product UI semantic | Expected native mapping |
|---|---|
| `Button(role=prominent)` | Expo UI/SwiftUI native button with platform appearance |
| `Search` | Native platform search control where available |
| `Menu` / `CommandMenu` | Native menu and command presentation |
| `Toolbar` / `EditorToolbar` | Native toolbar; Liquid Glass surface where appropriate |
| `Sheet` | Native sheet with platform detents and accessibility behavior |
| `Form` / `PropertyEditor` | Native form controls selected from field semantics |
| `List` / `RecordTable` / `RecordBoard` | Native list/table/board renderer when advertised |
| `RichDocumentEditor` | Native document editor only when `ui.document-editor` is available |

Liquid Glass is a renderer choice, never a manifest property. A module asks for
a semantic toolbar or sheet and remains functional on hosts that use another
platform appearance. Unsupported advanced primitives must block or use the
module's explicit fallback; they must not render as generic boxes.

## Android handoff

Android ModuleHost implements the same descriptor, negotiation, action and data
contracts. Android renderers may map semantics to Compose or later platform
controls without changing module record logic, actions, permissions or Product
UI declarations. Media selection, biometrics, sharing, secure storage,
background work and local intelligence remain semantic host capabilities, so
existing module source requires no iOS-to-Android business-logic rewrite.
