# Phase 7M-B5 — Vault Notes “Not available” / “Permission required”

Canonical pipeline already passes. Live/prototype UI could still lie.

## Classification

| Symptom | Source | Fix |
| --- | --- | --- |
| Hosted route `/m/digital.modula.vault-notes` showed **Permission required** when the module was not yet installed | **PRESENTATION_BUG** — `module-host.tsx` treated every non-enabled state as a permission failure | `ModuleInstallIdentity`: Available → Install |
| Detail CTA **Not available** when `installable` was false even though the product is published | **CLIENT_STATE_BUG** + **STALE_REGISTRY_PROJECTION** — `Boolean(row.installable)` plus `priceStateForInstallability` mapped omitted/unavailable → Not available | Decoder corrects published canonical Vault Notes to `available`; UI never uses “Not available” as the customer verb |
| Installed 0 / Available 1 pills | **PRESENTATION_BUG** | Removed from Product Hub primary UI |
| Turquoise cube as identity | **PRESENTATION_BUG** | `ModuleArtwork` pack |

Not:

- VERSION_MISMATCH as the primary cause of the screenshot (identity remains `digital.modula.vault-notes`)
- WRONG_ACCOUNT_STATE as the default explanation

## Required flow

Vault Notes → Available → Install → Installing (real stages, no fake %) → Installed → Open
