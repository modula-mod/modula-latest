# Phase 7M-B — defect register

Severity policy follows the phase brief. P0 = data loss / auth broken / crash /
install or host broken on a supported platform. P1 = core flagship flow visibly
wrong or broken. This register is checked by reviewers and by the phase gate.

Open P0: **0**
Open P1: **0**

## Entries

### P7MB-N0-001 — Auth browser regression cannot bind port 4020
- Severity: N0 (environmental, not a product defect)
- Status: OPEN (environmental)
- Detail: `verify:phase7l-b:auth` Playwright webServer requires exclusive
  `127.0.0.1:4020`; the preserved dev greenfield-api already listens there.
  Mission requires preserving port 4020. Auth endpoints verified healthy by
  other means (health/live ok; register/verify/sessions 200/201; profile-update
  API test passes).
- Resolution: re-run on a host where 4020 is free, or set
  `reuseExistingServer` in the Playwright web-server config.

### P7MB-N0-002 — Canonical Vault Notes source repo inaccessible
- Severity: N0 (external access, not a product defect)
- Status: OPEN (needs maintainer)
- Detail: `digital.modula.vault-notes@0.2.0` declares source
  `modula-mod/modula-module-vault-notes` (commit `54ab8ed`), which cannot be
  resolved by this agent's GitHub identity, so the canonical release cannot be
  byte-verified against source here.
- Resolution: grant access to that repo, or confirm the go-forward source and
  publish a canonical release from it via the registry importer.
