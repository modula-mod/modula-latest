# GF-OPS-01 — Runtime snapshot (2026-11-13, GMT)

Capture window: 2026-11-13 11:38:24–11:38:27 GMT (UTC+0). Machine-readable copy: `runtime-snapshot.json`.

Access actually available to SENTINEL: public internet only. The box has no SSH config or keys
(`~/.ssh` absent), no VPS, Docker, DB, Cloudflare or hosting-provider access. Per mission rules,
anything not obtainable through unauthenticated public GETs or public DNS is UNKNOWN.
All responses came through the Cloudflare edge (`server: cloudflare`, `cf-cache-status: DYNAMIC`,
`cache-control: no-store`), i.e. live origin responses, not cached.

| Field | Value | Status | Source / method | Time (GMT) |
|---|---|---|---|---|
| API revision | `a91d490e61ebfff38069378ddf757429eb000449` | OBSERVED (self-reported env) | `GET /v1/version`, `/version.json` → `commit` | 11:38:26 |
| API release id | `greenfield-v1-a91d490e61eb` | OBSERVED | `/v1/version` | 11:38:26 |
| API builtAt | 2026-11-11 01:18:10 GMT | OBSERVED | `/v1/version` | 11:38:26 |
| API expected migration | `090_calls_v1` | OBSERVED | `/v1/version.expectedMigration` | 11:38:26 |
| API live / ready | 200 live / 200 ready | OBSERVED | `/v1/health/live`, `/v1/health/ready` | 11:38:25 |
| API image digest / OCI label | UNKNOWN | UNKNOWN | needs `docker image inspect` on VPS | — |
| Worker revision (own identity) | UNKNOWN | UNKNOWN | public surface exposes only API's `worker.expectedCommit` (= `a91d490e…`) — that is configuration, not worker identity. Needs `greenfield_worker_heartbeats.release_sha` or container label | — |
| Worker heartbeat | operational, last seen 11:38:17 GMT (9 s) | OBSERVED | `/v1/status` | 11:38:26 |
| Public status | operational: api 10 ms, database 1 ms, jobs pending 0, mail pending 0 | OBSERVED | `/v1/status` | 11:38:26 |
| DB migration ledger tip | `090_calls_v1` | INFERRED | ready=200 + expectedMigration=090; readiness fails closed on pending/unknown/tip mismatch (`services/greenfield-api/src/domains/system/health.ts:10-19`). Direct ledger read not performed | 11:38:25 |
| Public capabilities | mutations on; registration open + email verification; inviteOnly off; atproto off; modules (legacy) off; module registry/installation/declarative/first-party execution on; remote functions + community execution off; DIMON off; AI gateway on; modulaMail on; Apple auth not configured; mail provisioner mode `disabled` | OBSERVED (public subset) | `/v1/meta`, `/v1/version` | 11:38:27 |
| `MODULA_CALLS_ENABLED` | UNKNOWN | UNKNOWN | not on any public endpoint; calls routes require auth | — |
| Full env flag inventory | UNKNOWN | UNKNOWN | needs NAMES + present/redacted from `/etc/modula/*.env` | — |
| DNS | `api.`, apex, `www.`, `pds.modula.digital` → A 104.21.27.33, 172.67.168.220; AAAA 2606:4700:3034::ac43:a8dc, 2606:4700:3036::6815:1b21 (Cloudflare anycast), no CNAME | OBSERVED | Cloudflare DoH | 11:38:27 |
| Edge | Cloudflare proxy; HSTS `max-age=31536000; includeSubDomains` | OBSERVED | response headers | 11:38:25 |
| Origin IP / nginx live config | UNKNOWN | UNKNOWN | origin hidden by Cloudflare; needs `nginx -T` on host | — |
| Provider snapshots | UNKNOWN | UNKNOWN | needs provider console read | — |
| Local backup last success | UNKNOWN | UNKNOWN | needs `/var/backups/modula/greenfield-v1/last-success.json` + timer status | — |
| Off-host backup | UNKNOWN (and NOT FOUND IN INSPECTED SOURCE) | UNKNOWN | no off-host transport in `ops/backup/*` at `a91d490e` | — |

Note: the box's egress proxy reports `remote_ip 198.18.0.1` for all requests; that is the local
network path, not the production origin.
