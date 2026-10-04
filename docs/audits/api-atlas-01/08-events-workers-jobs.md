# Events, Workers and Jobs

## Infrastructure

- One `modula-greenfield-worker:11bfc7638c6d757215e75a934d02e40c9a40c839` process polls PostgreSQL; it has no externally bound port and no Docker healthcheck.
- API mutations append to the outbox and/or background jobs in the same database. Redis is not referenced by the GreenField source.
- Worker configuration: poll 1000 ms, empty backoff 5000 ms, outbox batch 50, lease 60000 ms.
- Heartbeat: 1/1 fresh, release `11bfc7638c6d757215e75a934d02e40c9a40c839`.
- Outbox: 470 total, 0 pending, 0 failed. Event deliveries: completed=362.
- Registration inventory: 8 engine jobs, 11 engine consumers, 0 module jobs, 0 scheduled module jobs, 2 extension subscriptions.

## Job inventory

| Job type | Historical count | Producer/trigger | Effect | Retry/failure |
| --- | --- | --- | --- | --- |
| `atproto.publish.delete` | 50 | post mutation when bridge enabled | external AT Protocol publish | leased PostgreSQL job; retry/dead-letter state |
| `atproto.publish.update` | 10 | post mutation when bridge enabled | external AT Protocol publish | leased PostgreSQL job; retry/dead-letter state |
| `extension.job.execute` | 2 | extension/runtime route | declared extension/function effect | leased PostgreSQL job; retry/dead-letter state |
| `function.invoke` | 15 | extension/runtime route | declared extension/function effect | leased PostgreSQL job; retry/dead-letter state |
| `mail.deliver` | 331 | auth/account security APIs | SMTP delivery or identity state | leased PostgreSQL job; retry/dead-letter state |
| `mail.identity.provision` | 10 | auth/account security APIs | SMTP delivery or identity state | leased PostgreSQL job; retry/dead-letter state |
| `module.disable` | 34 | module lifecycle/registry APIs | installation/release lifecycle | leased PostgreSQL job; retry/dead-letter state |
| `module.enable` | 66 | module lifecycle/registry APIs | installation/release lifecycle | leased PostgreSQL job; retry/dead-letter state |
| `module.install` | 60 | module lifecycle/registry APIs | installation/release lifecycle | leased PostgreSQL job; retry/dead-letter state |
| `module.release.imported` | 2 | module lifecycle/registry APIs | installation/release lifecycle | leased PostgreSQL job; retry/dead-letter state |
| `module.release.publish` | 30 | module lifecycle/registry APIs | installation/release lifecycle | leased PostgreSQL job; retry/dead-letter state |
| `module.release.verify` | 30 | module lifecycle/registry APIs | installation/release lifecycle | leased PostgreSQL job; retry/dead-letter state |
| `module.uninstall` | 24 | module lifecycle/registry APIs | installation/release lifecycle | leased PostgreSQL job; retry/dead-letter state |
| `module.update` | 92 | module lifecycle/registry APIs | installation/release lifecycle | leased PostgreSQL job; retry/dead-letter state |
| `notification.comment` | 24 | post/comment/reaction/share domain events | notification rows | leased PostgreSQL job; retry/dead-letter state |
| `notification.create` | 38 | post/comment/reaction/share domain events | notification rows | leased PostgreSQL job; retry/dead-letter state |
| `notification.mention` | 2 | post/comment/reaction/share domain events | notification rows | leased PostgreSQL job; retry/dead-letter state |
| `notification.quote` | 6 | post/comment/reaction/share domain events | notification rows | leased PostgreSQL job; retry/dead-letter state |
| `notification.reaction` | 60 | post/comment/reaction/share domain events | notification rows | leased PostgreSQL job; retry/dead-letter state |
| `notification.reply` | 8 | post/comment/reaction/share domain events | notification rows | leased PostgreSQL job; retry/dead-letter state |
| `notification.repost` | 30 | post/comment/reaction/share domain events | notification rows | leased PostgreSQL job; retry/dead-letter state |
| `plugin.disable` | 6 | extension/runtime route | declared extension/function effect | leased PostgreSQL job; retry/dead-letter state |
| `plugin.enable` | 14 | extension/runtime route | declared extension/function effect | leased PostgreSQL job; retry/dead-letter state |
| `search.index.post` | 182 | profile/post writes or admin reindex | search projections | leased PostgreSQL job; retry/dead-letter state |
| `search.index.profile` | 76 | profile/post writes or admin reindex | search projections | leased PostgreSQL job; retry/dead-letter state |
| `search.reindex` | 4 | profile/post writes or admin reindex | search projections | leased PostgreSQL job; retry/dead-letter state |

The worker runner recognizes 72 case labels. Lifecycle event-name cases (`runner.ts:95-112`), `module.settings.migrate` (`:140`) and `audit.checkpoint` (`:183`) currently return success without a domain effect and are classified as dead/no-op paths.

## Failures and dead letters

Status totals: FAILED=4, SUCCEEDED=1180, DEAD_LETTER=22.

| Job type | State | Count | Latest UTC |
| --- | --- | --- | --- |
| `mail.identity.provision` | DEAD_LETTER | 6 | 2026-08-15T15:23:34.49+00:00 |
| `mail.identity.provision` | FAILED | 4 | 2026-08-31T20:17:21.136+00:00 |
| `notification.reaction` | DEAD_LETTER | 10 | 2026-10-02T00:07:46.278+00:00 |
| `plugin.enable` | DEAD_LETTER | 2 | 2026-07-18T10:29:42.108+00:00 |
| `search.reindex` | DEAD_LETTER | 4 | 2026-07-29T08:56:58.964+00:00 |

Failure codes: 23505=10, 42P18=2, PLUGIN_FAILED=1, PLUGIN_TIMEOUT=1, UNSUPPORTED_RECORD_TYPE=10, MAIL_PROVISIONER_DISABLED=10. Reaction notification uniqueness failures (PostgreSQL 23505) are current and product-visible. Mail identity failures reflect the disabled provisioner; SMTP delivery itself is configured separately.

## Notification creation

Post/comment/reply/reaction/repost/quote/mention mutations produce domain events or jobs → worker consumer → notification row → `GET /v1/notifications`. Production has 119 active notifications, 110 unread. List, mark-one-read and mark-all-read routes exist; no dedicated requests route and no dedicated mentions filter were found.

## Email flows

Verification, resend, forgot/reset and security/account workflows enqueue mail work using templates and outbox/job persistence. Worker `mail.deliver` sends via required SMTP with TLS; SMTP credentials are PRESENT but never captured. Identity-provision jobs call a separately gated provisioner and have 10 historical failures/dead letters because it is disabled. Retry state is stored in PostgreSQL.

## Webhooks

- Module backend ingress under `/v1/modules/:moduleId/backend/webhooks/modula` verifies the backend bearer token/service assertion plus HMAC and idempotency before dispatch.
- Connector provider metadata advertises webhook support, but no matching provider inbound route, signature verifier or retry store is registered.
- Production module webhook deliveries: 0.

## Scheduling and cron

No Modula cron file or systemd timer was found. The worker's internal poll, outbox-drain, lease-reap and optional ingestion intervals are process timers. Module scheduled jobs are zero; GitHub ingestion is disabled.

## Observability

Fastify and worker use structured logs, request IDs and database trace fields. nginx access/error logs exist, but no shared edge-generated correlation ID, tracing backend, metrics endpoint/exporter or dead-letter alert integration was discovered. One synthetic request cannot presently be proven end-to-end across edge → API → outbox → worker from the captured interfaces alone.
