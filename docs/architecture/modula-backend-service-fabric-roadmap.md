# Modula Backend Service Fabric Roadmap

Status: Phase 7I-D2.3 architecture preparation only.

Phase 7I-D2.3 does not build the service fabric. It verifies that the existing
Module Backend Runtime remains a safe foundation for the next architecture
phase and records the boundary that Phase 7I-E should implement.

## Purpose

The service fabric lets independently deployed backend repositories connect to
Greenfield through authenticated, versioned contracts. Greenfield remains the
profile OS control plane, public API boundary, lifecycle authority, audit
surface, and account-scoped policy point. Specialist backends own their own
runtime internals and expose only declared capabilities.

This avoids forcing every module backend into Greenfield while preserving a
single governed product surface for install, permissions, health, audit, and
operator visibility.

## Non-Goals For D2.3

- No new production service mesh.
- No broad module-backend subsystem rewrite.
- No direct cross-database reads between module services and Greenfield.
- No unversioned internal HTTP shortcuts.
- No implicit trust based on private network location.
- No declarative Standard 2.0 section may be reported as operational only
  because the manifest validator accepts it.

## Core Principles

- Service contracts are versioned and compatibility-checked before activation.
- Service identity is authenticated for every backend-to-Greenfield call.
- Capabilities are explicit, scoped, and auditable.
- Greenfield owns account identity, install state, permission grants, module
  lifecycle, operator health, and public API mediation.
- External services own their domain data and publish state changes through
  events or adapter responses.
- Cross-service data access happens through APIs, events, projections, or
  reviewed exports, not shared database credentials.
- High-risk domains keep proposal, verification, audit, and activation stages
  separate.
- Failures are isolated per service and surfaced through module health rather
  than taking down the profile OS.

## Planned Service Connections

| Service | Direction | Greenfield responsibility | Service responsibility |
| --- | --- | --- | --- |
| CRM Backend | CRM Backend <-> Greenfield | Account identity, module install, permission grants, profile placement, audit, notifications, search projection hooks. | CRM records, pipelines, contact workflows, CRM-specific business rules, service-local migrations. |
| AI Backend | AI Backend <-> Greenfield | Provider-neutral AI contract boundary, account/session context, policy mode, AKI evidence capture, rate and capability grants. | Model/provider orchestration, reasoning jobs, tool planning, inference diagnostics, provider adapters. |
| Vault Notes Backend | Vault Notes Backend <-> Greenfield | Module lifecycle, account-scoped authorization, manifest/release provenance, search projection, export permissions. | Note storage, folders, structured content, note search index materialization, import/export implementation. |
| Automation Backend | Automation Backend <-> Greenfield | Capability grants, human activation gates, account identity, event routing, audit trail, notification delivery. | Workflow definitions, job scheduling, connectors, retries, execution logs, worker fleet health. |

## Contract Shape

Each service should publish a signed or checksum-addressed contract descriptor:

```text
service_id
service_version
contract_version
module_standard_version
capabilities[]
required_permissions[]
events_produced[]
events_consumed[]
health_endpoints[]
public_api_routes[]
internal_api_routes[]
data_residency
failure_modes[]
rollback_strategy
```

Greenfield should store the accepted descriptor with immutable provenance and
reject activation when compatibility, identity, capability, or health checks
fail.

## Service Identity

Service-to-service traffic should use a dedicated service identity per backend.
The identity mechanism can be mTLS, signed requests, short-lived service JWTs,
or another reviewed credential exchange, but it must provide:

- caller identity
- intended audience
- expiry
- replay resistance
- rotation path
- audit correlation ID
- scoped capabilities

No Phase 7I-E service should rely on hardcoded credentials in source, shared
database passwords, or a broad private-network trust assumption.

## Event And Projection Boundary

Greenfield should accept event envelopes, not raw database writes:

```text
event_id
event_type
event_version
producer_service_id
account_id
module_id
occurred_at
idempotency_key
payload
evidence
```

Events that affect search, notifications, billing, AKI, AGI Governor, or module
lifecycle should be append-only and replayable into projections.

## Current D2.3 Readiness

The existing Module Backend Runtime remains suitable as a preparation layer for
the next phase because it already separates manifest normalization, runtime
support disclosure, module registry records, installation state, and module
health concepts.

Known limitation for D2.3:

- Standard 2.0 declarative sections are not automatically runtime-complete.
- Remote functions and community execution remain disabled in production
  metadata.
- Future backends need service identity, versioned adapters, health contracts,
  and explicit capability grants before production activation.

## Phase 7I-E Gates

Phase 7I-E should not begin production activation until it has:

- a contract package or schema for service descriptors
- a service identity mechanism
- a Greenfield registry table for external backend services
- lifecycle states for register, verify, enable, suspend, upgrade, and retire
- a health aggregator that keeps operator endpoints private
- per-service audit events
- capability and permission enforcement
- event ingestion with idempotency
- rollback and quarantine behavior
- verifier coverage for all supported service classes
