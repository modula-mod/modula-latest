# GreenField production topology

Observed 2026-10-14 on `core.modula.digital` (`87.106.40.136`). Revalidate this
document before every release; addresses and certificate dates are evidence,
not configuration.

DNS is owned through Cloudflare nameservers `earl.ns.cloudflare.com` and
`tessa.ns.cloudflare.com`. `api.modula.digital` resolves through Cloudflare;
health responses are `DYNAMIC`, not proof of CDN artifact caching. Cloudflare
terminates the public certificate and forwards to nginx. The observed public
certificate is Google Trust Services WE1, valid 2026-10-11 through 2027-01-09;
`certbot.timer` is also present for origin certificates.

nginx uses the repository-identical
`ops/nginx/api.modula.digital.greenfield.conf` and proxies to loopback
`127.0.0.1:4020`. Dynamic API responses are `no-store`. Artifact routes retain
range support and immutable caching rules. nginx provides TLS 1.2/1.3,
body/time limits, forwarding headers, and baseline security headers.

Docker Compose runs one PostgreSQL 16.9 instance, Redis 7.4, one GreenField API,
and one GreenField worker on an internal bridge. Only API port 4020 is published
to host loopback. API and worker images are immutable SHA-tagged images. Media
is the bind-mounted `/var/lib/modula/greenfield-media`. Immutable release
artifacts are content-addressed PostgreSQL blobs. Registry, trust store,
installations, ledgers, outbox, jobs, search projection, and release metadata
are PostgreSQL state.

The production checkout `/root/modula-latest` is read/test/deploy only. GitHub
CI gates mainline; deployment must select exact merged SHA, serialize with the
deployment lock, migrate under the database advisory lock, and verify release
identity, live, ready, worker heartbeat, migration, nginx, smoke, and integrity.

Logs are Docker JSON logs plus systemd journal/nginx logs, rotated by the host
logrotate timer. Monitoring is intentionally lightweight: canonical safe health,
capacity, integrity, trust, backup-age, dead-letter, and TLS probes emit
machine-readable results for operator/alert integration.

Backups cover PostgreSQL (including artifacts/trust), media, required config,
and deployment provenance. At discovery time all known backup copies were on
the same VPS; that remains an explicit correlated-loss risk until an independent
destination is enrolled and restore-tested.

