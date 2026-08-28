# Greenfield Backend V1 security boundary

Greenfield treats every account, product, installation, service assertion,
event, job, entitlement, build and data binding as an independently scoped
security subject. Product code receives no Greenfield database credential and
never forwards a raw user bearer. Module and engine services are reached only
through registered targets, exact-origin path resolution and short-lived
service assertions.

The canonical security gate is:

```bash
CI=true pnpm verify:greenfield-backend-v1:security
```

The gate creates a disposable Greenfield database through migration 050 and
executes the security suites serially. It also provisions two real PostgreSQL
product databases with distinct non-superuser roles and proves that one role
cannot connect to the other database. All fixtures are removed afterward.

Build verification is performed by the independent build service. It rejects
unsafe identifiers before filesystem use, permits only approved HTTPS source
origins, validates required outputs as bounded regular files, rejects archive
links/special files/traversal, hashes every archived payload against the
manifest, and only then signs provenance. Developer builds remain offline,
non-root, read-only, capability-free and without the Docker socket.

Credential verification is performed by the independent secrets service. It
scans tracked files for credential patterns, verifies service identity and
namespace scope, tests assertion replay rejection, and never records secret
values in audit output. Runtime secret material is not fetched from GitHub.

## Threat-to-proof matrix

| Threat | Enforced proof |
| --- | --- |
| Cross-account or cross-product data access | Service Fabric, extension fabric and data-ledger database tests |
| Cross-product SQL | Dedicated PostgreSQL roles plus denied cross-database connection test |
| SQL privilege escalation | Runtime-role and backup-role privilege assertions |
| Capability escalation or service impersonation | Scoped assertion and undeclared-capability rejection tests |
| Raw bearer forwarding | Header rejection plus persisted zero-value invariant |
| SSRF or service-gateway open redirect | Public-address validation, exact registered origin and zero redirects |
| Dependency cycle or confusion | Bounded cycle rejection, verified publisher namespaces and exact product IDs |
| Artifact or manifest tampering | Quarantine tests; byte-level archive/manifest validation |
| Secret leakage | Encrypted broker tests and tracked-file credential scanner |
| Event spoofing or job replay | Producer identity checks and idempotency/single-use tests |
| Unsafe paths or archives | Identifier, URL path, archive entry, symlink and checksum tests |
| SQL injection | Encoded hostile collection input rejected without record mutation |
| Remote arbitrary JavaScript | Closed manifest schema rejects executable escape fields |
| Build sandbox escape | Offline non-root read-only OCI plan, no capabilities/socket, bounded resources |
| Entitlement bypass | Append-only entitlement state and atomic quota rejection tests |
| Publisher namespace impersonation | Reserved `digital.modula` and ownership checks |
| Public test products | `test.modula.*` and `testOnly` manifests are always hidden from Product Hub |

This gate proves source and isolated behavior. It does not claim that queued
production migrations 044-050 have been applied or that production services
have converged to the source SHA.
