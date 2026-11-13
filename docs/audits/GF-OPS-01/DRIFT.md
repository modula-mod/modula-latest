# GF-OPS-01 — Source vs runtime drift

Source baseline: `modula-mod/modula-latest` main `a91d490e61ebfff38069378ddf757429eb000449`
(tree `8eb1f04d…`), migration tip `090_calls_v1`. Runtime: public evidence 2026-11-13 11:38 GMT.

| Dimension | Source (a91d490e) | Runtime | Drift |
|---|---|---|---|
| API revision | `a91d490e…` | `a91d490e…` (self-reported) | **None observed** (image digest unverified) |
| Expected migration | tip `090_calls_v1` | `090_calls_v1` | **None** |
| Migration ledger tip | `090_calls_v1` | `090_calls_v1` (INFERRED from ready=200) | **None inferred**; direct read pending |
| Worker revision | `a91d490e…` | UNKNOWN (API expects `a91d490e…`; heartbeat fresh) | Cannot be determined |
| `MODULA_CALLS_ENABLED` | default OFF (`env.ts:148`, must be literal `true`) | UNKNOWN | Cannot be determined |
| Other env flags | see `services/greenfield-api/src/config/env.ts` | public subset only (see snapshot) | Cannot be determined beyond public capabilities |
| nginx | `ops/nginx/api.modula.digital.greenfield.conf` incl. `/v1/messaging/socket` (l.64) and `/v1/calls/<uuid>/signalling` (l.78) WebSocket locations; `docs/ops/calls-coturn.md:3` says "documented, not deployed", owner approves each step | UNKNOWN | Cannot be determined |
| Coturn | `ops/docker/compose.calls.yml` — manual start after owner approval | UNKNOWN | Cannot be determined |
| Backups | daily timer 02:17 UTC (`ops/systemd/modula-greenfield-backup.timer`), output `/var/backups/modula/greenfield-v1` (same host); no off-host transport in source | UNKNOWN | Cannot be determined; source itself has an off-host gap |
| Snapshots | not in source | UNKNOWN | Cannot be determined |
| Main vs ATLAS-cited SHA | ATLAS cited `0840c736…` (tree `f28554fa…`, verified) | — | 0840c736 is an ancestor of main; main has since gained #166, #167, #168. Use `a91d490e` as current. |

## Historic documents (HISTORIC OPEN — not current truth)

- `docs/audits/api-atlas-01/00-production-truth.md`: observed 2026-10-14 15:33 GMT, prod `f05d03c2…`,
  ledger `073_backup_sequence_acl_defaults`. The file was regenerated on main as recently as `4e3fc4d7`
  (2026-11-11 00:57 GMT) so its "Git up migrations: 90; latest 090_calls_v1" line mixes the new source
  count with the October runtime capture. Treat the runtime part as historic.
- `docs/audits/greenfield-feature-reality-01/FEATURE-REALITY-BASELINE.md` (2026-10-31): prod
  `db0e1e31…`, ledger `075_greenfield_messaging`, source `079`. Superseded by today's public evidence
  (`a91d490e`, 090).
- `docs/operations/greenfield-spof-register.md` (last changed 2026-10-15): "Backup destination … No while
  all copies remain on the VPS". Source review finds no off-host mechanism added since; live state UNKNOWN.
  Do not claim either "fixed" or "still broken" without host evidence.
