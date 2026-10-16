# GreenField service dependencies

| Consumer → dependency | Class | Readiness/failure behavior |
|---|---|---|
| nginx → API | hard | Edge returns bounded 5xx while API is unavailable; live/ready are separately observable. |
| API → PostgreSQL | hard | `/ready` fails; `/live` remains process-live; requests fail boundedly. |
| worker → PostgreSQL | hard | Worker backs off with jitter and reconnects; durable leases/outbox remain in PostgreSQL. |
| API → media filesystem | hard for media/core readiness | `/ready` fails when unavailable, unwritable, or below critical free-space floor. |
| API → immutable artifact blobs in PostgreSQL | hard for distribution | Digest/authorization fail closed; no bytes are returned. |
| API/worker → Redis | soft/currently non-authoritative | No user data or job durability depends on Redis in v1. |
| API/worker → external AI/provider endpoints | optional | Provider operation fails; core live/readiness and `localOnly` privacy do not fall back remotely. |
| worker → SMTP/provisioner | optional/disabled | Mail is explicit `DISABLED`; failures do not break core API readiness. |
| API/worker → GitHub release sync | optional | Automatic publication remains disabled; registry truth stays local/immutable. |
| DNS/Cloudflare → nginx/TLS | hard for public reachability | Origin may remain healthy while public API is unavailable. |
| CI → deployment | hard release gate | CI never deploys a feature branch; operator deploy uses merged `origin/main`. |
| backup job → PostgreSQL/media/config/key material | hard recovery gate | Non-zero exit and stale success marker alert; no partial set is accepted. |
| local test providers | local-only | Disposable PostgreSQL and synthetic providers never become production dependencies. |

Readiness means the instance can safely serve its core contract. Liveness means
the process can answer and is not coupled to optional provider health.

