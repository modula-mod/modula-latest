# Phase 7D - Runtime Platform And Engine Foundation

Status: Begins immediately after Phase 7C merges to `main`.

## Mission

Phase 7D transforms the Greenfield module platform into a runtime platform.

The objective is not to add Unity, Godot, Gaia, Automation, Media, Gubic, or Spatial providers. The objective is to build the contracts, managers, diagnostics, security rules, and compatibility model that let those providers exist later without changing installed modules.

Phase 7D must preserve the Phase 7A and Phase 7B execution boundary:

- modules are manifest-backed packages
- registry releases remain immutable and provenance-backed
- Product Hub remains the install and compatibility surface
- module source is never executed by the host
- trusted providers, not modules, own engine initialization

## Non-Goals

Phase 7D must not implement:

- Unity runtime
- Godot runtime
- Gubic
- Gaia runtime
- Automation runtime
- Media runtime
- Document runtime
- WebGPU runtime
- Spatial runtime
- downloaded native binaries
- downloaded JavaScript execution
- arbitrary module execution

Metadata-only providers may be declared for compatibility planning, but they must not be launchable.

## Package Boundaries

Phase 7D introduces two package boundaries.

### `@modula/greenfield-module-engine-contracts`

Path:

```text
packages/greenfield-module-engine-contracts/
```

Purpose:

Stable TypeScript contracts between modules, Product Hub, Greenfield API, workers, native/web hosts, and the runtime manager.

Initial contract families:

- `GreenfieldEngineKind`
- `GreenfieldEngineProvider`
- `GreenfieldEngineRequirement`
- `GreenfieldRuntimeSession`
- `GreenfieldCapability`
- `GreenfieldProviderStatus`
- `GreenfieldEngineEvent`
- `GreenfieldEngineLifecycle`
- `GreenfieldEngineCompatibility`

This package must remain contract-only. It must not import native engines, initialize providers, or contain host UI.

### `@modula/greenfield-runtime`

Path:

```text
packages/greenfield-runtime/
```

Purpose:

The orchestration layer used by the host and Greenfield services to resolve capabilities, create sessions, manage lifecycle state, isolate provider failures, emit diagnostics, and enforce runtime policy.

Initial subsystem shape:

```text
Runtime Manager
|
|-- Engine Registry
|-- Provider Registry
|-- Capability Resolver
|-- Runtime Sessions
|-- Lifecycle Manager
|-- Background Manager
|-- Resource Manager
|-- Resource Broker
|   |-- CPU allocation
|   |-- Memory allocation
|   |-- GPU allocation
|   |-- Network budget
|   |-- Background execution
|   `-- Priority scheduling
|-- Security Manager
|-- Permission Resolver
|-- Event Bus
|-- Diagnostics
`-- Recovery Manager
```

This package may implement orchestration logic and local in-memory/session state. It must not include Unity, Godot, Gaia, Automation, Media, Document, WebGPU, or Spatial provider implementations in Phase 7D.

## Provider Groups

Providers are split into operational providers and metadata-only providers.

### Operational Providers

These providers may resolve capabilities and create runtime sessions when the host has the required implementation.

| Provider | Initial role |
| --- | --- |
| `modula.declarative-ui` | Declarative module surfaces, widgets, settings, and host-rendered UI |
| `modula.records` | Namespaced module records and account-owned data |
| `modula.actions` | Reviewed host actions and lifecycle operations |
| `modula.functions` | Reviewed function contracts and host-owned execution adapters |

### Metadata-Only Providers

These providers may exist in registry, diagnostics, Product Hub compatibility answers, and module validation, but must not launch sessions.

| Provider | Future role |
| --- | --- |
| `modula.document` | Document rendering and export |
| `modula.automation` | Workflow execution and scheduling |
| `modula.media` | Media playback, capture, and processing |
| `modula.gaia` | Governed AI runtime |
| `modula.game-lite` | Lightweight game runtime |
| `modula.web-games` | Web game provider |
| `modula.godot-runtime` | Godot provider |
| `modula.unity-runtime` | Unity provider |
| `modula.spatial` | Spatial runtime provider |

No dependencies may be installed for metadata-only providers during Phase 7D.

## Engine Requirements

Modules must request runtime needs through capabilities and engine requirements. They must not request a concrete engine by brand name as their only compatibility signal.

Bad:

```json
{
  "engine": "Unity"
}
```

Good:

```json
{
  "engines": [
    {
      "kind": "game",
      "capabilities": ["game.render", "game.audio"],
      "minimumApiVersion": "1.0.0",
      "fallbackPolicy": "installable-provider-required"
    }
  ],
  "capabilities": ["game.render", "game.audio"]
}
```

The runtime manager resolves:

1. module-declared capabilities
2. granted account permissions
3. provider availability
4. provider API compatibility
5. platform support
6. native-build requirements
7. resource budgets
8. offline compatibility
9. fallback policy

## Capability System

Capabilities become runtime permissions. Modules request them, providers advertise them, and the runtime manager matches them.

Initial capability namespaces:

| Capability | Meaning |
| --- | --- |
| `records.read` | Read permitted namespaced records |
| `records.write` | Write permitted namespaced records |
| `game.render` | Render an interactive game surface |
| `game.audio` | Play game audio |
| `media.playback` | Play media |
| `media.capture` | Capture media from device sources |
| `automation.workflow` | Define or run workflows |
| `automation.schedule` | Schedule background automation |
| `document.render` | Render document content |
| `document.export` | Export document content |
| `ai.chat` | Use governed chat runtime |
| `ai.generate` | Use governed generation runtime |
| `connector.http` | Call approved HTTP destinations |
| `connector.oauth` | Use approved OAuth connections |

Capability grants must be auditable and account-scoped. They do not replace module permissions; they are the runtime-level interpretation of those permissions.

## Runtime Lifecycle

Every provider must follow the same lifecycle.

Canonical states:

```text
Creating
Resolving
Preparing
Ready
Starting
Running
Suspending
Suspended
Resuming
Stopping
Terminated
Failed
Recovery
```

Allowed transition intent:

| From | To |
| --- | --- |
| `Creating` | `Resolving`, `Failed` |
| `Resolving` | `Preparing`, `Failed` |
| `Preparing` | `Ready`, `Failed` |
| `Ready` | `Starting`, `Stopping`, `Terminated` |
| `Starting` | `Running`, `Failed` |
| `Running` | `Suspending`, `Stopping`, `Failed` |
| `Suspending` | `Suspended`, `Failed` |
| `Suspended` | `Resuming`, `Stopping`, `Terminated` |
| `Resuming` | `Running`, `Failed` |
| `Stopping` | `Terminated`, `Failed` |
| `Failed` | `Recovery`, `Terminated` |
| `Recovery` | `Preparing`, `Terminated` |

Required lifecycle guarantees:

- module disable terminates active sessions
- sign-out terminates account-scoped sessions
- quarantined providers cannot launch
- unavailable providers produce compatibility answers instead of crashes
- failed providers are isolated from the shell
- modules never initialize native engines directly
- remote binary and JavaScript execution remain forbidden

## Scheduling

Runtime sessions declare and receive scheduling intent.

Canonical scheduling classes:

- `foreground`
- `background`
- `idle`
- `suspended`
- `highPriority`
- `interactive`
- `lowPriority`

Scheduling is advisory in the first contract release, then becomes enforceable as operational providers mature.

## Resource Management

Every runtime session exposes a resource profile.

Tracked resource dimensions:

- memory
- CPU
- GPU
- storage
- network
- background execution
- battery impact

The Resource Broker is the single authority for future allocation and monitoring. In Phase 7D it may expose contracts and diagnostics first. Later providers must request budget through the broker instead of making local provider-specific decisions.

## Runtime Events

Everything emits structured events through the runtime event bus.

Initial event names:

- `RuntimeCreated`
- `RuntimeDestroyed`
- `RuntimeReady`
- `ProviderRegistered`
- `ProviderLoaded`
- `ProviderUnavailable`
- `ProviderFailed`
- `SessionCreated`
- `SessionStarted`
- `SessionSuspended`
- `SessionResumed`
- `SessionStopped`
- `SessionTerminated`
- `SessionFailed`
- `SessionRecovered`
- `CapabilityGranted`
- `CapabilityDenied`
- `CompatibilityResolved`
- `ResourceBudgetAssigned`
- `ResourceBudgetDenied`

Events must be safe for diagnostics and future Gaia observation. They must not include post bodies, note contents, passwords, tokens, secrets, private messages, or raw provider payloads.

Minimum event envelope:

```ts
type GreenfieldEngineEvent = {
  id: string
  type: string
  occurredAt: string
  accountId?: string
  moduleId?: string
  providerId?: string
  sessionId?: string
  capability?: string
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical'
  data?: Record<string, unknown>
}
```

## Runtime Compatibility

Every module must be able to answer:

- Can this run?
- Why?
- Which provider?
- Which provider version?
- Which runtime API version?
- Can it degrade?
- Can it run offline?
- Does it require a native build?
- Does it support iOS?
- Does it support Android?
- Does it support web?

Product Hub must display compatibility prominently only when it affects install or launch. Detailed provider metadata belongs in developer disclosure.

Compatibility statuses:

- `compatible`
- `degraded`
- `providerUnavailable`
- `providerQuarantined`
- `unsupportedPlatform`
- `nativeBuildRequired`
- `permissionDenied`
- `capabilityDenied`
- `resourceBudgetDenied`
- `offlineUnsupported`
- `unknown`

## Recovery

The shell must never crash because a provider fails.

Required recovery behavior:

1. terminate the failed session
2. preserve shell navigation state
3. record a structured runtime failure event
4. show a user-safe recovery UI
5. expose technical diagnostics only under Developer
6. allow retry only when the provider status permits it

The same model applies to game, media, AI, automation, document, and future spatial providers.

## Security Rules

Forbidden permanently:

- remote JavaScript execution
- downloaded native binaries
- downloaded Unity runtime
- downloaded Godot runtime
- self-modifying modules
- arbitrary DLL loading
- arbitrary dynamic library loading
- direct module initialization of engine providers
- feature-level native provider imports
- provider launch without capability resolution
- provider launch without permission resolution

Everything executes through trusted providers registered with the Runtime Manager.

## Engine SDK

The module SDK must let future modules declare:

```json
{
  "engines": [],
  "capabilities": []
}
```

SDK helpers may validate declarations, build manifests, and provide test mocks. They must not initialize providers.

## Preparation Scenarios

### Gubic Preparation

Expected Phase 7D behavior:

```text
Chess module
-> requires game runtime
-> host resolves capabilities
-> no operational game provider installed
-> installation can succeed when other module requirements pass
-> launch is disabled
-> Product Hub shows: Requires Game Lite Runtime
```

Later:

```text
Install Game Lite provider
-> existing Chess module becomes launchable
```

The Chess module does not change.

### Gaia Preparation

Expected Phase 7D behavior:

```text
AI module
-> requires AI runtime
-> runtime resolves modula.gaia as unavailable
-> install compatibility explains unavailable runtime
-> launch disabled until provider is operational
```

Later Gaia installation must make the same module functional without changing the module.

### Automation Preparation

Expected Phase 7D behavior:

```text
Automation module
-> requires automation.workflow or automation.schedule
-> runtime resolves modula.automation as unavailable
-> install may be allowed only as non-launchable/deferred
-> launch disabled until provider is operational
```

Later Automation provider installation must activate the same module contract.

## Developer Diagnostics

Developer mode gains runtime diagnostics, hidden unless Developer settings are explicitly enabled.

Required diagnostics:

- Runtime Providers
- Provider Versions
- Runtime Sessions
- Capability Resolution
- Launch History
- Provider Failures
- Runtime Logs
- Runtime Events
- Memory Usage
- CPU Usage
- GPU Usage
- Resource Broker decisions

Diagnostics must never be mixed into ordinary user settings.

## Product Hub Requirements

Product Hub must use the runtime compatibility contract for module details, install preview, and launch state.

Required user-facing states:

- runs now
- runs with degraded capability
- installed but launch disabled
- requires provider
- requires native build
- unsupported on this platform
- unavailable while provider is quarantined
- disabled by account permissions
- disabled by resource policy

Product Hub must distinguish installability from launchability.

## Acceptance Criteria

Phase 7D is complete only when:

- `@modula/greenfield-module-engine-contracts` exists and is contract-only
- `@modula/greenfield-runtime` exists and owns runtime orchestration
- operational and metadata-only providers are registered distinctly
- the complete lifecycle is represented and validated
- capability resolution works from module declaration to provider match
- permission resolution is account-scoped and auditable
- resource broker contracts and diagnostics exist
- runtime scheduling contracts exist
- runtime events are structured and privacy-safe
- Product Hub displays compatibility answers
- module launch is disabled when required providers are unavailable
- metadata-only providers cannot launch sessions
- failed providers cannot crash the shell
- module disable terminates active sessions
- sign-out terminates account runtime sessions
- quarantined providers block launch
- forbidden execution paths are tested
- no direct feature-level SwiftUI, Unity, Godot, Gaia, or engine imports exist
- no arbitrary module execution exists
- DIMON remains inactive
- AT Protocol remains optional and non-runtime
- all Phase 7C verifiers still pass
- all Phase 7D runtime verifiers pass
- working tree is clean

## Expected Phase 7D Verifiers

The exact scripts should be created during Phase 7D implementation.

Suggested verifier names:

- `scripts/verify-phase7d-engine-contracts.mjs`
- `scripts/verify-phase7d-runtime-manager.mjs`
- `scripts/verify-phase7d-provider-registry.mjs`
- `scripts/verify-phase7d-capability-resolution.mjs`
- `scripts/verify-phase7d-runtime-sessions.mjs`
- `scripts/verify-phase7d-resource-broker.mjs`
- `scripts/verify-phase7d-runtime-security.mjs`
- `scripts/verify-phase7d-product-hub-compatibility.mjs`
- `scripts/verify-phase7d-founder-alpha-regression.mjs`

## Roadmap Position

```text
Phase 7A
Module Platform
|
v
Phase 7B
Marketplace, Host, Vault Notes
|
v
Phase 7C
Founder Alpha product
|
v
Phase 7D
Runtime Platform, Engine Platform, Provider System
|
v
Phase 8
Notes, Tasks, CRM, SDK maturity
|
v
Phase 9
Document, Automation, Media, Gaia providers
|
v
Phase 10
Gubic and Game Lite provider
|
v
Phase 11
WebGPU provider
|
v
Phase 12
Godot provider
|
v
Phase 13
Unity provider
|
v
Phase 14
Spatial runtime
```

Phase 7D is the contract and orchestration phase that prevents later providers from hardcoding their own lifecycle, permissions, resource management, diagnostics, and failure behavior.
