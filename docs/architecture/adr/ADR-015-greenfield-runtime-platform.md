# ADR-015: Greenfield Runtime Platform

Date: 2026-07-26
Status: Proposed for Phase 7D

## Context

Phase 7A established Greenfield modules as manifest-backed packages with immutable registry releases and no host execution of repository source.

Phase 7B proved module installation, lifecycle APIs, Product Hub flows, and Vault Notes as the first module proof.

Phase 7C turns the shell, social loop, profile, Board, Product Hub, Vault Notes, settings, reliability, and native acceptance into the Founder Alpha product.

The next architecture risk is provider drift. Future work needs Gaia, Automation, Media, Gubic, Game Lite, WebGPU, Godot, Unity, and Spatial capabilities, but each provider must not invent its own lifecycle, security model, diagnostics, resource rules, or permission resolver.

## Decision

Introduce Phase 7D as the Greenfield Runtime Platform and Engine Foundation.

Phase 7D adds two package boundaries:

- `packages/greenfield-module-engine-contracts/` as `@modula/greenfield-module-engine-contracts`
- `packages/greenfield-runtime/` as `@modula/greenfield-runtime`

The runtime platform owns:

- Engine Registry
- Provider Registry
- Capability Resolver
- Runtime Sessions
- Lifecycle Manager
- Background Manager
- Resource Manager
- Runtime Resource Broker
- Security Manager
- Permission Resolver
- Event Bus
- Diagnostics
- Recovery Manager

Modules declare engine requirements and capabilities. Providers advertise capabilities. The Runtime Manager resolves compatibility, permissions, availability, platform support, resource budgets, native-build requirements, and launch policy.

Modules never initialize providers directly.

## Provider Policy

Operational providers for Phase 7D:

- `modula.declarative-ui`
- `modula.records`
- `modula.actions`
- `modula.functions`

Metadata-only providers for Phase 7D:

- `modula.document`
- `modula.automation`
- `modula.media`
- `modula.gaia`
- `modula.game-lite`
- `modula.web-games`
- `modula.godot-runtime`
- `modula.unity-runtime`
- `modula.spatial`

Metadata-only providers may be visible in contracts, Product Hub compatibility, and Developer diagnostics. They must not launch runtime sessions and must not introduce engine dependencies.

## Runtime Lifecycle

All providers must use the canonical lifecycle:

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

The lifecycle is shared across UI, records, actions, functions, documents, automation, media, AI, games, WebGPU, Godot, Unity, and spatial providers.

## Capability Policy

Modules must request capabilities rather than a hardcoded provider brand.

Examples:

- `records.read`
- `records.write`
- `game.render`
- `game.audio`
- `media.playback`
- `media.capture`
- `automation.workflow`
- `automation.schedule`
- `document.render`
- `document.export`
- `ai.chat`
- `ai.generate`
- `connector.http`
- `connector.oauth`

Capabilities become the bridge between module declarations, account permissions, provider support, Product Hub install previews, runtime sessions, and diagnostics.

## Resource Broker

The Runtime Resource Broker is part of the Runtime Manager.

It is the single authority for:

- CPU allocation
- memory allocation
- GPU allocation
- network budget
- storage budget
- background execution
- battery impact
- priority scheduling

In Phase 7D the broker may start as contracts plus diagnostics. Later operational providers must request resource allocation through the broker.

## Security

The following remain forbidden permanently:

- remote JavaScript execution
- downloaded native binaries
- downloaded Unity runtime
- downloaded Godot runtime
- self-modifying modules
- arbitrary DLL loading
- arbitrary dynamic library loading
- direct module initialization of providers
- unreviewed executable community code
- feature-level provider imports that bypass platform/runtime adapters

Everything executes through trusted providers registered with the Runtime Manager.

## Consequences

- Future engines can be added as providers without changing module declarations.
- Product Hub can distinguish installable modules from launchable modules.
- A game module can install before `modula.game-lite` exists, while launch remains disabled with a clear compatibility reason.
- A Gaia-dependent module can declare AI runtime needs before Gaia exists.
- Automation-dependent modules can declare workflow needs before Automation exists.
- Provider failures are isolated by runtime sessions and recovery UI.
- Developer diagnostics can inspect runtime sessions without exposing internal payloads to normal settings.
- Resource control stays centralized instead of spreading across providers.

## Implementation Rules

Phase 7D implementation must:

- keep contracts in package boundaries
- keep feature code out of direct engine/provider imports
- keep provider initialization inside `@modula/greenfield-runtime`
- keep metadata-only providers non-launchable
- avoid installing inactive provider dependencies
- keep DIMON inactive
- keep AT Protocol optional and non-runtime
- preserve all Phase 7C product verifiers
- add Phase 7D runtime verifiers

## Validation Requirements

Before merging Phase 7D:

- contract package builds
- runtime package builds
- lifecycle transitions are tested
- capability resolution is tested
- provider registry is tested
- metadata-only provider launch denial is tested
- resource broker decisions are tested
- runtime events are privacy-safe
- Product Hub compatibility answers are tested
- provider failure recovery is tested
- forbidden execution paths are tested
- Phase 7C verifiers still pass
- native readiness checks still pass
