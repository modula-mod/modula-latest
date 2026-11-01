Observed production truth at 2026-10-14T15:33:43.469Z: api.modula.digital terminates at nginx and proxies to a healthy loopback-only Fastify container running `f05d03c237c62d1b0946a760610d1155f02a8520`, backed by PostgreSQL 16.9, a same-revision worker, host-bound media storage, and an apparently unused Redis service.

# Production Truth

## Host and repository

- Host: `core.modula.digital`; OS: Ubuntu 24.04.4 LTS; architecture: x86_64; kernel: Linux 6.8.0-137-generic; uptime: up 9 weeks, 3 days, 16 hours, 51 minutes.
- Canonical checkout: `/root/modula-latest`; origin: `https://github.com/modula-mod/modula-latest.git`; branch: `main`; HEAD: `f05d03c237c62d1b0946a760610d1155f02a8520`.
- Canonical checkout is dirty: 17 tracked modifications and 0 untracked files. Those files were not changed by this audit.
- `origin/main` at capture: `f05d03c237c62d1b0946a760610d1155f02a8520`.
- Running SHA: `f05d03c237c62d1b0946a760610d1155f02a8520`. It matches canonical checkout HEAD and `origin/main`. OCI revision, `/version.json`, worker heartbeat and runtime route introspection correlate the running code to this exact source revision.
- Audit worktree: `/root/modula-worktrees/greenfield-v1-closeout-final`, branch `phase-greenfield-v1-closeout-final`.

## Runtime inventory

| Role | Container/image | Created | Ports | Health | Revision |
| --- | --- | --- | --- | --- | --- |
| API | `modula-greenfield-api:f05d03c237c62d1b0946a760610d1155f02a8520` | 2026-10-14T14:59:12.109622031Z | `127.0.0.1:4020 -> 4020` | healthy | `f05d03c237c62d1b0946a760610d1155f02a8520` |
| Worker | `modula-greenfield-worker:f05d03c237c62d1b0946a760610d1155f02a8520` | 2026-10-14T14:53:47.87504411Z | internal only | no Docker healthcheck | `f05d03c237c62d1b0946a760610d1155f02a8520` |
| Database | `postgres:16.9-alpine` | 2026-10-10T09:10:30.086517622Z | Docker network only | healthy | image-pinned PostgreSQL |
| Redis | `redis:7.4-alpine` | 2026-08-09T00:27:09.295758521Z | Docker network only | healthy | no GreenField source consumer found |

- Host Node v24.15.0; container Node v24.18.0; pnpm 11.11.0; npm 11.12.1; nginx/1.31.3.
- PostgreSQL data uses a named Docker volume. Media uses read/write host bind `/var/lib/modula/greenfield-media`; 60 files / 29931163 bytes were counted without reading user contents.
- PostgreSQL queue/outbox drives asynchronous work. Redis reports append-only disabled and snapshot saving disabled; no GreenField source reference was found.
- Related internal services on the Docker network: Modula AI backend and secrets service. Their own repositories are outside this atlas. Old verifier/recovery/preview PostgreSQL containers are explicitly non-production and listed in sanitized evidence.

## Edge topology

`api.modula.digital` resolves through Cloudflare. The observed certificate is issued by Google Trust Services for `modula.digital` and expires 2026-11-11.

```mermaid
flowchart TD
  internet[Internet clients] --> dns[Cloudflare DNS and TLS path]
  dns --> nginx[nginx api.modula.digital]
  nginx -->|catch-all 127.0.0.1:4020| api[GreenField Fastify API f05d03c]
  api --> postgres[(PostgreSQL 16.9 named volume)]
  api --> media[(Host bind /var/lib/modula/greenfield-media)]
  api --> outbox[(PostgreSQL outbox and jobs)]
  outbox --> worker[GreenField worker f05d03c]
  api --> ai[Internal Modula AI backend when configured]
  api --> secrets[Internal secrets service]
  redis[(Redis 7.4 no persistence)] -. no source consumer found .- api
```

## nginx public routing

- Config: `/etc/nginx/conf.d/api.modula.digital.greenfield.conf`; SHA-256 `37ee1e4d2184e5d9d248c2fa2abe4d0108498a0a94a7ad44273eba250c6f19d0`.
- Default catch-all: 1 MiB request body, 10s connect, 60s send/read, no-store, HTTP/1.1 proxy to loopback API.
- Registry release assets: separate immutable-cache location.
- `/v1/stories`: 25 MiB and 300s timeouts.
- attachment byte upload: 101 MiB, proxy buffering disabled, 300s timeouts.
- Security headers: nosniff, DENY framing, no-referrer. No nginx request-rate directive or WebSocket upgrade stanza was found; 0/485 application routes carry Fastify rate-limit configuration.
- Every registered route is transport-reachable through the catch-all; feature flags and handler authorization still determine application availability. `/v1/internal/ssrf-check` is handler-hidden in production.

## Versions and migration truth

- Applied migrations: 73; latest `073_backup_sequence_acl_defaults` at 2026-10-14T01:27:28.538373+00:00.
- Git up migrations: 79; latest `079_story_attachment_pipeline.sql`. No missing, extra, duplicate-numbered or out-of-order production migration was found.
- Production runtime routes: 630; excluded automatic production framework routes: 184. Candidate route counts, when present, are reported only in the HTTP atlas and do not alter deployment truth.

## Safe configuration

| Setting | Observed value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MODULA_ENVIRONMENT` | `production` |
| `MODULA_API_HOST` | `0.0.0.0` |
| `MODULA_API_PORT` | `4020` |
| `MODULA_PUBLIC_API_URL` | `https://api.modula.digital` |
| `MODULA_PUBLIC_WEB_URL` | `https://modula.digital` |
| `MODULA_MEDIA_ROOT` | `/var/lib/modula/greenfield-media` |
| `MODULA_MEDIA_UPLOAD_MAX_BYTES` | `20971520` |
| `MODULA_REQUEST_BODY_LIMIT_BYTES` | `26214400` |
| `MODULA_RATE_LIMIT_ENABLED` | `true` |
| `MODULA_TRUST_PROXY` | `true` |
| `MODULA_PRODUCTION_WRITES_ENABLED` | `true` |
| `MODULA_PREVIEW_WRITES_ENABLED` | `false` |
| `MODULA_INVITE_ONLY` | `false` |
| `MODULA_REGISTRATION_MODE` | `open` |
| `MODULA_MINIMUM_CLIENT_VERSION` | `0.1.0` |
| `MODULA_API_DOCUMENTATION_ENABLED` | `false` |
| `MODULA_ATPROTO_ENABLED` | `false` |
| `MODULA_PDS_PILOT_ENABLED` | `false` |
| `GREENFIELD_MODULE_REGISTRY_ENABLED` | `true` |
| `GREENFIELD_MODULE_INSTALLATION_ENABLED` | `true` |
| `GREENFIELD_MODULE_DECLARATIVE_CONTRIBUTIONS_ENABLED` | `true` |
| `GREENFIELD_MODULE_FIRST_PARTY_EXECUTION_ENABLED` | `true` |
| `GREENFIELD_MODULE_REMOTE_FUNCTIONS_ENABLED` | `false` |
| `GREENFIELD_MODULE_COMMUNITY_EXECUTION_ENABLED` | `false` |
| `GREENFIELD_MODULE_GITHUB_SYNC_ENABLED` | `false` |
| `GREENFIELD_VAULT_NOTES_REFERENCE_ENABLED` | `true` |
| `GREENFIELD_DIMON_ENABLED` | `false` |
| `GREENFIELD_AI_GATEWAY_ENABLED` | `true` |
| `BACKEND_FABRIC_ENABLED` | `false` |
| `BACKEND_FABRIC_ENVIRONMENT` | `production` |
| `BACKEND_FABRIC_CONTRACT_VERSION` | `1.0` |
| `MODULA_RELEASE_SHA` | `f05d03c237c62d1b0946a760610d1155f02a8520` |
| `MODULA_WORKER_RELEASE_SHA` | `f05d03c237c62d1b0946a760610d1155f02a8520` |
| `MODULA_RELEASE_BUILT_AT` | `2026-10-14T09:36:18Z` |
| `worker:NODE_ENV` | `production` |
| `worker:MODULA_ENVIRONMENT` | `production` |
| `worker:MODULA_MAIL_TRANSPORT` | `smtp` |
| `worker:MODULA_MAIL_REQUIRED` | `true` |
| `worker:MODULA_SMTP_PORT` | `587` |
| `worker:MODULA_SMTP_SECURE` | `false` |
| `worker:MODULA_SMTP_REQUIRE_TLS` | `true` |
| `worker:MODULA_SMTP_TLS_REJECT_UNAUTHORIZED` | `true` |
| `worker:MODULA_WORKER_INGEST_ENABLED` | `false` |
| `worker:MODULA_WORKER_INGEST_INTERVAL_MS` | `60000` |
| `worker:MODULA_WORKER_POLL_INTERVAL_MS` | `1000` |
| `worker:MODULA_WORKER_EMPTY_POLL_BACKOFF_MS` | `5000` |
| `worker:MODULA_WORKER_OUTBOX_BATCH_SIZE` | `50` |
| `worker:MODULA_WORKER_OUTBOX_DRAIN_INTERVAL_MS` | `2000` |
| `worker:MODULA_WORKER_LEASE_DURATION_MS` | `60000` |
| `worker:MODULA_WORKER_LEASE_REAP_INTERVAL_MS` | `30000` |
| `worker:GREENFIELD_MODULE_GITHUB_SYNC_ENABLED` | `false` |
| `worker:GREENFIELD_MODULE_REMOTE_FUNCTIONS_ENABLED` | `false` |
| `worker:GREENFIELD_MODULE_COMMUNITY_EXECUTION_ENABLED` | `false` |
| `worker:MODULA_RELEASE_SHA` | `f05d03c237c62d1b0946a760610d1155f02a8520` |

## Secret-presence inventory

Only presence status was captured; no value is present in this atlas.

| Secret setting | Status |
| --- | --- |
| `MODULA_DATABASE_URL` | PRESENT |
| `MODULA_DATABASE_MIGRATOR_URL` | PRESENT |
| `MODULA_BACKUP_DATABASE_URL` | PRESENT |
| `MODULA_SESSION_PEPPER` | PRESENT |
| `MODULA_AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY` | PRESENT |
| `MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY` | PRESENT |
| `MODULA_CONNECTOR_CREDENTIAL_ENCRYPTION_KEY` | PRESENT |
| `BACKEND_FABRIC_SIGNING_PRIVATE_KEY` | PRESENT |
| `MODULA_CHECKPOINT_SIGNING_KEY` | PRESENT |
| `worker:MODULA_DATABASE_URL` | PRESENT |
| `worker:MODULA_SMTP_PASSWORD` | PRESENT |
| `worker:MODULA_SMTP_USER` | PRESENT |
| `worker:MODULA_ATPROTO_OAUTH_ENCRYPTION_KEY` | PRESENT |
| `worker:BACKEND_FABRIC_SIGNING_PRIVATE_KEY` | PRESENT |

## External service dependencies

| Dependency | Status | Evidence |
| --- | --- | --- |
| SMTP email | CONFIGURED | smtp transport required, TLS required, username/password PRESENT; mail.deliver jobs have succeeded |
| Mail identity provisioner | UNCONFIGURED | provisioning disabled; historical jobs failed/dead-lettered with MAIL_PROVISIONER_DISABLED |
| AI/model providers | PLACEHOLDER | real provider rows are unconfigured; development mock is available but excluded in production resolution |
| Internal Modula AI backend | CONFIGURED NETWORK DEPENDENCY | container and URL key exist, but no operational model/provider execution was observed |
| GitHub registry source | UNCONFIGURED | sync code exists; automation false and source count zero |
| Filesystem media | CONFIGURED | host bind; no external object storage/CDN origin |
| AT Protocol/PDS | NOT USED | both feature flags false; placeholder preview code remains feature-gated |
| Connector OAuth | PARTIAL | credential encryption key PRESENT and provider metadata/routes exist; no provider webhook ingress |
| Push/APNs/web push | NOT USED | no subscription or delivery infrastructure found |
| Payment provider | NOT USED | DIMON disabled and no payment-service integration found |
