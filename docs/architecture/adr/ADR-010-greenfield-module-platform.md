# ADR-010 - Greenfield Module Platform

## Status

Accepted for Phase 7A.

## Context

Modula needs modules to be first-class product surfaces without hardcoding each product module into the host. Existing Greenfield extension tables provide identity, install rows, tools, functions, widgets, plugins, and connectors, but do not provide immutable module releases, source provenance, licence evidence, or module-specific lifecycle policy.

## Decision

Add Greenfield Module Standard v1, module registry contracts, SDK manifest builders, persistence, API services, and worker lifecycle jobs while reusing extension identities and installations.

Modules remain external packages. The host consumes registry/contribution APIs and does not execute source from repositories.

## Consequences

- Module releases are immutable and GitHub-commit backed.
- Installation uses permission review and a worker-backed state machine.
- Declarative contributions can register without native/frontend changes.
- Executable community code remains disabled.
- Frontend and native paths remain unchanged after the Phase 7A baseline.
