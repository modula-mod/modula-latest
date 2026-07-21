# ADR-013 - Module Execution Boundary

## Status

Accepted for Phase 7A.

## Context

The module platform must support contributed tools, functions, widgets, schemas, routes, settings, plugins, jobs, and events without opening arbitrary execution paths.

## Decision

Allow declarative, built-in, background-job, and future remote-HTTP execution modes as manifest contracts. In Phase 7A:

- Declarative contributions are enabled.
- Built-in and background-job handlers are first-party/reviewed only.
- Remote HTTP is disabled by feature flag.
- Community executable code is disabled.

Forbidden paths include `eval`, `new Function`, dynamic package installation, GitHub-source execution, module SQL, unreviewed Docker execution, unreviewed native package loading, remote HTML widgets, and arbitrary WebViews.

## Consequences

The Mac host can render module surfaces and invoke reviewed APIs without importing module repositories. Future remote HTTP functions must satisfy HTTPS, exact allow-listing, DNS and redirect revalidation, private-address denial, signed envelopes, timestamps, nonces, replay protection, timeout, response-size, response-schema, and audit requirements.
