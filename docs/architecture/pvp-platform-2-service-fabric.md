# PVP Platform Phase 2 service fabric

## Boundary

The only supported backend path is:

`client → Greenfield API → capability broker → existing backend gateway → registered extension service`

The client authenticates to Greenfield. Greenfield does not forward that bearer.
After declaration, installation, target ownership, resource ownership, and grant
checks succeed, the existing signing service issues a short-lived service
assertion.

## Assertion

The assertion records and signs:

- issuer: Greenfield;
- subject/account safe internal identity;
- consumer product and installation;
- target product and installation;
- declared action and service;
- exact capabilities;
- installation/action/resource scope;
- request/correlation identity and unique `jti`;
- issue/expiry time (maximum 15 minutes; reference actions request 120 seconds).

Only its hash is persisted. The database enforces
`raw_user_bearer_forwarded = FALSE` and the maximum TTL.

## Service registration and network policy

An extension cannot supply a URL at invocation time. The endpoint comes from a
published manifest, publisher policy, service registration, and successful
discovery. The existing backend network policy enforces HTTPS, allowed host and
origin, DNS/private-network restrictions, redirect limits, response-size limits,
and timeouts. Arbitrary service URLs and private-network SSRF targets are not
accepted.

## Data minimisation

UI placement does not grant data. For a note-scoped action the broker first
loads the requested record using `account_id`, target module ID, record ID, and
optional collection. The service receives that one authorised resource, not a
database handle or the whole Vault.

Vault Notes retains record ownership. Vault AI, Voice, and future services have
no SQL path to Vault Notes tables.

## Failure isolation

The gateway applies the existing action timeout, bounded response, health
record, failure record, and circuit state. Three failures can open the circuit;
the host receives an unavailable result while the core module remains open.
Async jobs use the existing leased worker retry/backoff path and the explicit
`QUEUED/RUNNING/RETRYING/FAILED` projection. A missing provider produces the
honest terminal code `PROVIDER_NOT_CONFIGURED`.

## Observability

Invocations carry request ID, account subject, target/consumer/action/service,
scope, duration/health, and safe failure code. Payload text, note bodies,
recordings, transcripts, raw assertions, provider keys, and user bearer tokens
are excluded from operational and audit metadata.
