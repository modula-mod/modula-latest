# MP02 Native and Product UI handoff

Status: contract handoff only. MP02 does not change Native source or claim that an unavailable renderer exists.

## ModuleHost responsibilities

The Native phase must consume the versioned `host.capabilities` descriptors from
`@modula/greenfield-module-ui-contracts`. A required unavailable capability
blocks the surface with `CAPABILITY_UNAVAILABLE`. An optional capability may use
only the fallback explicitly declared by the module; a host-advertised fallback
is never implicit.

Every descriptor includes implementation provenance: `native`, `fallback`,
`emulated`, or `unavailable`. `renderer` names the semantic renderer,
`provider` names the implementation provider, and bounded constraints report
limits. A fallback or emulation must never be presented as a genuine native
advanced renderer. Local intelligence discovery additionally reports provider
class, supported tasks, maximum input, streaming, privacy classes, version and
availability through the module intelligence provider discovery contract.

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

Host functions follow request identity and lifecycle rather than direct native
calls. The future ModuleHost owns dispatch, cancellation, timeout, unload and
duplicate-completion handling for media picker, share, biometrics,
background-task and secure-storage requests. Downloaded modules submit only
versioned semantic requests.

## Intelligence boundary

`localOnly` terminates in the host broker. Its executor transport is
`host-capability`; a Greenfield/remote executor is not read, selected or called.
If the host has no compatible local provider, the result is
`CAPABILITY_UNAVAILABLE`. The client must never send `localOnly` content to a
server endpoint in order to learn that fact.

`preferLocal` selects a compatible host provider first. Remote fallback is
possible only after exact-release permission review, module policy, data
classification and provider/account policy all allow it. `allowRemote` still
requires the same gates and never means arbitrary provider access. GreenField
may execute an approved remote provider; it must not claim that Nodus or another
on-device provider ran server-side.

## Cache-first module lifecycle

The Native implementation sequence is:

1. install and verify the immutable release artifact;
2. place it in a local immutable artifact cache;
3. initialize the local module data cache and optional presentation cache;
4. open immediately from verified local state;
5. hydrate the semantic runtime; and
6. synchronize records, tombstones, media and release updates in background.

The cache uses three explicit slots:

- `ACTIVE`: verified artifact and data currently presented;
- `PREVIOUS_GOOD`: last known-good verified artifact for recovery; and
- `STAGED`: newly downloaded artifact awaiting verification/activation.

Activation is atomic. A failed verification or hydration leaves `ACTIVE`
unchanged. Permission review remains bound to the exact release, so promoting a
new artifact cannot inherit undeclared grants.

This document is a handoff only. MP02B does not implement the Native artifact or
data cache.

## Apple-safe downloaded-code boundary

The architecture boundary is:

`downloaded module -> versioned Modula semantic contract -> host-owned native implementation`.

A downloaded module must not require arbitrary direct access to SwiftUI, UIKit,
Objective-C runtime APIs, platform filesystem paths or dynamically downloaded
native executable code. The host owns native controls, permissions and system
framework calls and returns contract-shaped results. This is an architectural
boundary, not an App Store certification claim.

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
