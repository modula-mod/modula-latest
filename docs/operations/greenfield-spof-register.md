# GreenField v1 single points of failure

| SPOF | Impact | Current mitigation/recovery | Accepted for v1? |
|---|---|---|---|
| VPS host | Total service and same-host backup loss | Immutable source/images plus full DR runbook | Only if an independent backup copy is enrolled; otherwise freeze blocker. |
| PostgreSQL instance/volume | Core state unavailable | Ready fails, worker backs off, encrypted custom dump, clean restore | Yes for single-node v1 after final restore proof. |
| Single worker | Async delay | Durable leases, expired-lease reaper, idempotency, restart | Yes. |
| nginx/origin config | Public outage | Repository config, syntax test, config backup | Yes. |
| Media disk | Media loss/core readiness failure | Digest inventory and media backup/restore | Yes only with independent backup copy. |
| Artifact store (PostgreSQL) | Install/update/offline package unavailable | Immutable digests plus DB backup and provenance | Yes after restore proof. |
| Backup destination | No recovery after host loss | Encrypted/signed sets and retention; opt-in off-host copy and off-host restore drill in source (GF-OPS-02, `ops/backup/greenfield-v1-offhost.mjs`, `ops/backup/greenfield-v1-restore-drill.mjs`; local fake-remote drill evidence in `docs/audits/GF-OPS-02/`) | No until an off-host destination is enrolled in production and a restore drill from that destination passes with real age; source support alone does not close this row. |
| DNS/Cloudflare account | Public outage/control loss | Ownership/runbook; origin remains independently diagnosable | Accepted operational dependency. |
| Signing trust store | Install/update trust unavailable | Public keys in DB backup; private offline key is not on VPS | Yes. |
| Production configuration/secrets | Rebuild blocked | Repository config plus encrypted owner-only config backup | Yes after restore proof. |

This register documents risk; it does not claim multi-region or high
availability. V1 intentionally remains a single-node deployment.

